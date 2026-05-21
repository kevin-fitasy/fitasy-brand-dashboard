/**
 * FITASY DASHBOARD FILLER — Apps Script
 *
 * Pulls data from GA4 + Google Ads + brand mentions sheet on an hourly schedule
 * and writes it into the FitasyDashboard sheet in the shape that dashboard.html expects.
 *
 * SETUP (one-time):
 *   1. Open script.google.com → New project
 *   2. Paste this file in. Save (name it "Fitasy Dashboard Filler").
 *   3. Resources → Advanced Google services → enable BOTH:
 *        - Google Analytics Data API (GA4)  →  identifier: AnalyticsData
 *        - Google Ads API                   →  identifier: GoogleAdsApp (if available)
 *      If Google Ads isn't in the picker, see § GOOGLE ADS NOTE below.
 *   4. Run setUp() once → click through the OAuth consent screen (grants GA4 + Sheets access)
 *   5. Run pullAll() once → confirm rows land in the sheet
 *   6. Triggers (⏰ icon left) → add trigger:  pullAll · Time-driven · Hour timer · Every hour
 *
 * GOOGLE ADS NOTE:
 *   The Google Ads API requires a developer token (free, takes 24h to approve) and is
 *   easier to set up via the "scheduled report → Google Sheet" feature inside ads.google.com.
 *   Until that's set up, pullGoogleAds() does nothing — the rest of the dashboard still works.
 *
 * SHEET TO POPULATE:
 *   The FitasyDashboard sheet must already exist with these tabs (see 04_LIVE_DEPLOY.md):
 *     Config, KPIs, OvpSummary, OvpChannels, ChannelMix, Campaigns,
 *     Trend, Pillars, Products, TopPages, Sentiment, Mentions, Email
 *   Each tab needs the column headers in row 1 — this script writes from row 2 down.
 */

// ============================ CONFIG ============================

const DASHBOARD_SHEET_ID = '1IXx602iT322QYoA7fEd4BzRrBBsCDxD9MEmeecJxnME';
const MENTIONS_SHEET_ID  = '1ZFbYEVWnZP0c1bWLMIKoN1F8ujhnADNyTHkYmDkcvpQ'; // existing brand mentions sheet
const GA4_PROPERTY_ID    = '461873881'; // fitasy-4e9cc (the property with real traffic)
const PERIODS            = [7, 30, 90];  // pre-compute data for these intervals; dashboard switches between them
const DEFAULT_PERIOD     = 30;             // used for period-agnostic counts (e.g. mentions in last N days)

// ============================ ENTRYPOINT ============================

function pullAll() {
  const t0 = Date.now();
  console.log('=== Fitasy Dashboard Filler — pullAll() ===');

  try { writeConfig(); } catch (e) { console.error('writeConfig:', e); }

  // GA4-derived tabs are duplicated per period (7d, 30d, 90d) so the dashboard can switch instantly
  PERIODS.forEach(days => {
    console.log(`--- Period: ${days} days ---`);
    try { pullGA4Kpis(days); }         catch (e) { console.error(`pullGA4Kpis(${days}):`, e); }
    try { pullGA4OvpSummary(days); }   catch (e) { console.error(`pullGA4OvpSummary(${days}):`, e); }
    try { pullGA4OvpChannels(days); }  catch (e) { console.error(`pullGA4OvpChannels(${days}):`, e); }
    try { pullGA4ChannelMix(days); }   catch (e) { console.error(`pullGA4ChannelMix(${days}):`, e); }
    try { pullGA4Trend(days); }        catch (e) { console.error(`pullGA4Trend(${days}):`, e); }
    try { pullGA4TopPages(days); }     catch (e) { console.error(`pullGA4TopPages(${days}):`, e); }
    try { pullGA4DemoAge(days); }      catch (e) { console.error(`pullGA4DemoAge(${days}):`, e); }
    try { pullGA4DemoGender(days); }   catch (e) { console.error(`pullGA4DemoGender(${days}):`, e); }
    try { pullGA4Geo(days); }          catch (e) { console.error(`pullGA4Geo(${days}):`, e); }
    try { pullGA4Funnel(days); }       catch (e) { console.error(`pullGA4Funnel(${days}):`, e); }
    try { pullGA4Quality(days); }      catch (e) { console.error(`pullGA4Quality(${days}):`, e); }
    try { pullGA4Products(days); }     catch (e) { console.error(`pullGA4Products(${days}):`, e); }
    try { pullGA4Pillars(days); }      catch (e) { console.error(`pullGA4Pillars(${days}):`, e); }
    try { pullMeta(days); }            catch (e) { console.error(`pullMeta(${days}):`, e); }
  });

  // Period-agnostic data sources
  try { pullGoogleAdsCampaigns(); } catch (e) { console.error('pullGoogleAdsCampaigns:', e); }
  try { pullSentiment(); }          catch (e) { console.error('pullSentiment:', e); }
  try { pullMentions(); }           catch (e) { console.error('pullMentions:', e); }
  try { pullKlaviyo(); }            catch (e) { console.error('pullKlaviyo:', e); }
  try { pullCreatives(); }          catch (e) { console.error('pullCreatives:', e); }
  try { pullMetaCreatives(); }      catch (e) { console.error('pullMetaCreatives:', e); }

  console.log(`=== Done in ${(Date.now() - t0) / 1000}s ===`);
}

// Helper: build period-suffixed tab name
function tabName(base, days) { return `${base}_${days}d`; }

// ============================ CONFIG TAB ============================

function writeConfig() {
  const now = new Date();
  const tz = Session.getScriptTimeZone();
  const synced = Utilities.formatDate(now, tz, 'd MMM yyyy HH:mm');
  writeTabReplace('Config', ['key', 'value'], [
    ['synced', synced],
    ['periods', PERIODS.join(',')],          // dashboard reads this to render the pill bar
    ['default_period', String(DEFAULT_PERIOD)],
    ['property', GA4_PROPERTY_ID]
  ]);
}

// ============================ GA4: KPIs (one row per metric) ============================

function pullGA4Kpis(days) {
  // Include `date` dimension so per-row metrics exist for the totals-fallback sum
  const cur = ga4RunReport({
    dimensions: ['date'],
    metrics: ['activeUsers', 'engagedSessions', 'engagementRate', 'purchaseRevenue', 'ecommercePurchases', 'averagePurchaseRevenue'],
    daysBack: days
  });
  const prev = ga4RunReport({
    dimensions: ['date'],
    metrics: ['activeUsers', 'engagedSessions', 'engagementRate', 'purchaseRevenue', 'ecommercePurchases', 'averagePurchaseRevenue'],
    daysBack: days, daysOffset: days
  });

  // Engagement rate and AOV need recomputation since summing rows doesn't average correctly
  // engagementRate = engagedSessions / sessions; we'll approximate as average of per-day rates weighted by users
  // For simplicity (and consistency with Protean), recompute AOV from totals: revenue / purchases
  if (cur.totals.ecommercePurchases > 0) {
    cur.totals.averagePurchaseRevenue = cur.totals.purchaseRevenue / cur.totals.ecommercePurchases;
  }
  if (prev.totals.ecommercePurchases > 0) {
    prev.totals.averagePurchaseRevenue = prev.totals.purchaseRevenue / prev.totals.ecommercePurchases;
  }
  // engagementRate: sum gives total engagement-seconds-per-day kind of overstate; use average across days
  const validRates = cur.rows.map(r => Number(r.metrics[2])).filter(v => isFinite(v) && v > 0);
  if (validRates.length > 0) cur.totals.engagementRate = validRates.reduce((a,b) => a+b, 0) / validRates.length;
  const validRatesP = prev.rows.map(r => Number(r.metrics[2])).filter(v => isFinite(v) && v > 0);
  if (validRatesP.length > 0) prev.totals.engagementRate = validRatesP.reduce((a,b) => a+b, 0) / validRatesP.length;

  const c = cur.totals;
  const p = prev.totals;
  const vsPrior = `vs prior ${days}d`;

  const rows = [
    ['active_users',     'Active users',     fmtNum(c.activeUsers),                 deltaPct(c.activeUsers, p.activeUsers),     vsPrior, '', ''],
    ['engaged_sessions', 'Engaged sessions', fmtNum(c.engagedSessions),             deltaPct(c.engagedSessions, p.engagedSessions), vsPrior, '', ''],
    ['engagement_rate',  'Engagement rate',  (c.engagementRate * 100).toFixed(1) + '%', deltaPctPts(c.engagementRate * 100, p.engagementRate * 100, 'pp'), vsPrior, '', ''],
    ['purchase_revenue', 'Purchase revenue', fmtMoney(c.purchaseRevenue),           deltaPct(c.purchaseRevenue, p.purchaseRevenue), vsPrior, '', ''],
    ['transactions',     'Transactions',     fmtNum(c.ecommercePurchases),          deltaPct(c.ecommercePurchases, p.ecommercePurchases), vsPrior, '', ''],
    ['aov',              'AOV',              fmtMoney(c.averagePurchaseRevenue),    deltaAbs(c.averagePurchaseRevenue, p.averagePurchaseRevenue, '$'), vsPrior, '', ''],
    ['cost_per_order',   'Cost / order',     '—', '', 'pending Google Ads pull', '', ''],
    ['avg_cpc',          'Avg. CPC',         '—', '', 'pending Google Ads pull', '', ''],
    ['google_cost',      'Google Ads cost',  '—', '', 'pending Google Ads pull', '', ''],
    ['roas',             'Google ROAS',      '—', '', 'pending Google Ads pull', '', ''],
    ['purchase_rate',    'Purchase rate',    ((c.ecommercePurchases / c.engagedSessions) * 100).toFixed(2) + '%', '', 'transactions / engaged sessions', '', ''],
    ['brand_mentions',   'Brand mentions',   String(countMentions(days)), '', `last ${days}d (auto)`, '', '']
  ];

  writeTabReplace(tabName('KPIs', days), ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'],
    rows.map(r => {
      const d = (typeof r[3] === 'object' && r[3] !== null) ? r[3] : { value: '', dir: '' };
      return [r[0], r[1], r[2], d.value || '', d.dir || '', r[4], r[5], r[6]];
    }));
}

// ============================ GA4: Organic vs Paid summary ============================

function pullGA4OvpSummary(days) {
  const rep = ga4RunReport({
    dimensions: ['sessionMedium'],
    metrics: ['sessions', 'purchaseRevenue', 'ecommercePurchases'],
    daysBack: days
  });

  const paidMediums = ['cpc', 'ppc', 'paid', 'Paid Social', 'paid_social', 'paidsocial'];
  const directMediums = ['(none)'];

  let organic = { sessions: 0, revenue: 0, transactions: 0 };
  let paid = { sessions: 0, revenue: 0, transactions: 0 };
  let totalRev = 0;

  rep.rows.forEach(r => {
    const medium = r.dimensions[0];
    const sess = Number(r.metrics[0]);
    const rev = Number(r.metrics[1]);
    const tx = Number(r.metrics[2]);
    totalRev += rev;
    if (paidMediums.some(p => medium.toLowerCase().includes(p.toLowerCase()))) {
      paid.sessions += sess; paid.revenue += rev; paid.transactions += tx;
    } else if (!directMediums.includes(medium)) {
      organic.sessions += sess; organic.revenue += rev; organic.transactions += tx;
    }
  });

  const orgPct = totalRev > 0 ? (organic.revenue / totalRev * 100).toFixed(0) : 0;
  const paidPct = totalRev > 0 ? (paid.revenue / totalRev * 100).toFixed(0) : 0;

  writeTabReplace(tabName('OvpSummary', days),
    ['class', 'revenue', 'sub', 'sessions', 'transactions', 'cvr', 'rev_per_session'],
    [
      ['Organic', organic.revenue, `${orgPct}% of total`, organic.sessions, organic.transactions,
        organic.sessions ? (organic.transactions / organic.sessions * 100) : 0,
        organic.sessions ? (organic.revenue / organic.sessions) : 0],
      ['Paid',    paid.revenue,    `${paidPct}% of total`, paid.sessions,    paid.transactions,
        paid.sessions    ? (paid.transactions / paid.sessions * 100) : 0,
        paid.sessions    ? (paid.revenue / paid.sessions) : 0]
    ]);
}

// ============================ GA4: per-channel Organic vs Paid breakdown ============================

function pullGA4OvpChannels(days) {
  const rep = ga4RunReport({
    dimensions: ['sessionSourceMedium'],
    metrics: ['sessions', 'purchaseRevenue', 'ecommercePurchases'],
    daysBack: days,
    orderBy: { metric: { metricName: 'sessions' }, desc: true },
    limit: 10
  });

  const rows = rep.rows.map(r => {
    const sourceMedium = r.dimensions[0];
    const sess = Number(r.metrics[0]);
    const rev = Number(r.metrics[1]);
    const tx = Number(r.metrics[2]);
    const lower = sourceMedium.toLowerCase();
    let cls = 'Organic';
    if (lower.includes('cpc') || lower.includes('ppc') || lower.includes('paid')) cls = 'Paid';
    else if (lower.includes('(none)') || lower.includes('(direct)')) cls = 'Direct';
    return [sourceMedium, cls, sess, tx, rev,
      sess ? (tx / sess * 100) : 0,
      sess ? (rev / sess) : 0];
  });

  writeTabReplace(tabName('OvpChannels', days),
    ['channel', 'class', 'sessions', 'transactions', 'revenue', 'cvr', 'rev_per_session'],
    rows);
}

// ============================ GA4: ChannelMix (for donut) ============================

function pullGA4ChannelMix(days) {
  const rep = ga4RunReport({
    dimensions: ['sessionSourceMedium'],
    metrics: ['sessions'],
    daysBack: days,
    orderBy: { metric: { metricName: 'sessions' }, desc: true },
    limit: 7
  });

  const total = rep.rows.reduce((sum, r) => sum + Number(r.metrics[0]), 0);
  const rows = rep.rows.map(r => {
    const sess = Number(r.metrics[0]);
    return [r.dimensions[0], sess, total ? (sess / total * 100).toFixed(1) : 0];
  });

  writeTabReplace(tabName('ChannelMix', days), ['source_medium', 'sessions', 'percentage'], rows);
}

// ============================ GA4: daily trend (organic vs paid sessions, cost, revenue) ============================

function pullGA4Trend(days) {
  const rep = ga4RunReport({
    dimensions: ['date', 'sessionMedium'],
    metrics: ['sessions', 'purchaseRevenue'],
    daysBack: days
  });

  const byDate = {};
  rep.rows.forEach(r => {
    const date = r.dimensions[0];
    const medium = r.dimensions[1].toLowerCase();
    const sess = Number(r.metrics[0]);
    const rev = Number(r.metrics[1]);
    if (!byDate[date]) byDate[date] = { revenue: 0, cost: 0, organic_sessions: 0, paid_sessions: 0 };
    byDate[date].revenue += rev;
    if (medium.includes('cpc') || medium.includes('ppc') || medium.includes('paid')) {
      byDate[date].paid_sessions += sess;
    } else if (medium !== '(none)') {
      byDate[date].organic_sessions += sess;
    }
  });

  const sorted = Object.keys(byDate).sort();
  const rows = sorted.map(date => {
    const d = byDate[date];
    const label = date.slice(4, 6) + '-' + date.slice(6, 8); // MM-DD
    return [label, d.cost, d.revenue, d.organic_sessions, d.paid_sessions];
  });

  writeTabReplace(tabName('Trend', days), ['date', 'cost', 'revenue', 'organic_sessions', 'paid_sessions'], rows);
}

// ============================ GA4: top pages ============================

function pullGA4TopPages(days) {
  const rep = ga4RunReport({
    dimensions: ['pagePath'],
    metrics: ['screenPageViews', 'userEngagementDuration', 'purchaseRevenue'],
    daysBack: days,
    orderBy: { metric: { metricName: 'screenPageViews' }, desc: true },
    limit: 10
  });
  const rows = rep.rows.map(r => {
    const path = r.dimensions[0];
    const views = Number(r.metrics[0]);
    const engSecTotal = Number(r.metrics[1]);
    const avgEng = views > 0 ? secondsToHms(engSecTotal / views) : '—';
    const rev = Number(r.metrics[2]);
    return [path, views, avgEng, rev];
  });
  writeTabReplace(tabName('TopPages', days), ['path', 'views', 'avg_engagement', 'conv_value'], rows);
}

// ============================ GA4: Demographics (age & gender) ============================

function pullGA4DemoAge(days) {
  const rep = ga4RunReport({
    dimensions: ['userAgeBracket'],
    metrics: ['activeUsers', 'engagedSessions', 'engagementRate', 'ecommercePurchases', 'averageSessionDuration'],
    daysBack: days,
    orderBy: { metric: { metricName: 'activeUsers' }, desc: true },
    limit: 8
  });
  const rows = rep.rows
    .filter(r => r.dimensions[0] && r.dimensions[0] !== 'unknown')
    .map(r => [
      r.dimensions[0],
      Number(r.metrics[0]) || 0,                      // users
      Number(r.metrics[1]) || 0,                      // engaged sessions
      Number(r.metrics[2]) || 0,                      // engagement rate (0..1)
      Number(r.metrics[3]) || 0,                      // conversions
      Number(r.metrics[4]) || 0                       // avg session duration (sec)
    ]);
  writeTabReplace(tabName('DemoAge', days),
    ['bracket', 'users', 'engaged_sessions', 'engagement_rate', 'conversions', 'avg_session_sec'],
    rows);
}

function pullGA4DemoGender(days) {
  const rep = ga4RunReport({
    dimensions: ['userGender'],
    metrics: ['activeUsers', 'engagedSessions', 'engagementRate', 'ecommercePurchases', 'averageSessionDuration'],
    daysBack: days,
    orderBy: { metric: { metricName: 'activeUsers' }, desc: true },
    limit: 4
  });
  const rows = rep.rows
    .filter(r => r.dimensions[0] && r.dimensions[0] !== 'unknown')
    .map(r => [
      r.dimensions[0].charAt(0).toUpperCase() + r.dimensions[0].slice(1),
      Number(r.metrics[0]) || 0,
      Number(r.metrics[1]) || 0,
      Number(r.metrics[2]) || 0,
      Number(r.metrics[3]) || 0,
      Number(r.metrics[4]) || 0
    ]);
  writeTabReplace(tabName('DemoGender', days),
    ['gender', 'users', 'engaged_sessions', 'engagement_rate', 'conversions', 'avg_session_sec'],
    rows);
}

// ============================ GA4: Traffic by region (country + region) ============================

function pullGA4Geo(days) {
  // Country-level
  const countryRep = ga4RunReport({
    dimensions: ['country'],
    metrics: ['sessions', 'ecommercePurchases', 'purchaseRevenue', 'engagementRate'],
    daysBack: days,
    orderBy: { metric: { metricName: 'sessions' }, desc: true },
    limit: 10
  });
  const countryRows = countryRep.rows
    .filter(r => r.dimensions[0] && r.dimensions[0] !== '(not set)')
    .map(r => [
      r.dimensions[0],
      Number(r.metrics[0]) || 0,   // sessions
      Number(r.metrics[1]) || 0,   // transactions
      Number(r.metrics[2]) || 0,   // revenue
      Number(r.metrics[3]) || 0    // engagement rate (0..1)
    ]);
  writeTabReplace(tabName('GeoCountry', days),
    ['country', 'sessions', 'transactions', 'revenue', 'engagement_rate'],
    countryRows);

  // Region (state/province) — most useful for US/UK breakdowns
  const regionRep = ga4RunReport({
    dimensions: ['country', 'region'],
    metrics: ['sessions', 'ecommercePurchases', 'purchaseRevenue'],
    daysBack: days,
    orderBy: { metric: { metricName: 'sessions' }, desc: true },
    limit: 15
  });
  const regionRows = regionRep.rows
    .filter(r => r.dimensions[1] && r.dimensions[1] !== '(not set)')
    .map(r => [
      r.dimensions[1],
      r.dimensions[0],
      Number(r.metrics[0]) || 0,
      Number(r.metrics[1]) || 0,
      Number(r.metrics[2]) || 0
    ]);
  writeTabReplace(tabName('GeoRegion', days),
    ['region', 'country', 'sessions', 'transactions', 'revenue'],
    regionRows);
}

// ============================ GA4: Top Products (ecommerce items) ============================
function pullGA4Products(days) {
  const rep = ga4RunReport({
    dimensions: ['itemName'],
    metrics: ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased', 'itemRevenue'],
    daysBack: days,
    orderBy: { metric: { metricName: 'itemRevenue' }, desc: true },
    limit: 12
  });
  const rows = rep.rows
    .filter(r => r.dimensions[0] && r.dimensions[0] !== '(not set)')
    .map(r => {
      const viewed    = Number(r.metrics[0]) || 0;
      const atc       = Number(r.metrics[1]) || 0;
      const purchased = Number(r.metrics[2]) || 0;
      const revenue   = Number(r.metrics[3]) || 0;
      const atcRate   = viewed > 0 ? (atc / viewed * 100) : 0;
      return [r.dimensions[0], purchased, revenue, atcRate.toFixed(1) + '%', viewed];
    });
  writeTabReplace(tabName('Products', days), ['product', 'units', 'revenue', 'atc_rate', 'pdp_sessions'], rows);
}

// ============================ GA4: Performance by Brand Pillar ============================
// Maps each ecommerce item to a Fitasy brand pillar via keyword match on the product name.
function pullGA4Pillars(days) {
  const rep = ga4RunReport({
    dimensions: ['itemName'],
    metrics: ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased', 'itemRevenue'],
    daysBack: days,
    limit: 200
  });
  function pillarOf(name) {
    const n = (name || '').toLowerCase();
    if (n.indexOf('precis') >= 0)                                   return 'Precision Fit';
    if (n.indexOf('style') >= 0)                                    return 'Style';
    if (n.indexOf('eco') >= 0)                                      return 'ECO';
    if (n.indexOf('tech') >= 0)                                     return 'Tech';
    if (n.indexOf('ortho') >= 0 || n.indexOf('insole') >= 0 ||
        n.indexOf('medical') >= 0 || n.indexOf('prosthet') >= 0)    return 'Ortho';
    if (n.indexOf('confidence') >= 0)                               return 'Confidence';
    return 'Other';
  }
  const byPillar = {};
  rep.rows.forEach(r => {
    const p = pillarOf(r.dimensions[0]);
    if (!byPillar[p]) byPillar[p] = { sessions: 0, atc: 0, tx: 0, revenue: 0 };
    byPillar[p].sessions += Number(r.metrics[0]) || 0;
    byPillar[p].atc      += Number(r.metrics[1]) || 0;
    byPillar[p].tx       += Number(r.metrics[2]) || 0;
    byPillar[p].revenue  += Number(r.metrics[3]) || 0;
  });
  const order = ['Precision Fit', 'Style', 'ECO', 'Tech', 'Ortho', 'Confidence', 'Other'];
  const rows = order
    .filter(p => byPillar[p])
    .map(p => [p, byPillar[p].sessions, byPillar[p].atc, byPillar[p].tx, byPillar[p].revenue]);
  writeTabReplace(tabName('Pillars', days), ['pillar', 'sessions', 'atc', 'transactions', 'revenue'], rows);
}

// ============================ GA4: Conversion Funnel ============================
// Ecommerce funnel: view_item → add_to_cart → begin_checkout → purchase
function pullGA4Funnel(days) {
  const rep = ga4RunReport({
    dimensions: ['eventName'],
    metrics: ['eventCount'],
    daysBack: days
  });
  const counts = {};
  rep.rows.forEach(r => { counts[r.dimensions[0]] = Number(r.metrics[0]) || 0; });
  const steps = [
    ['View item',      counts['view_item']      || 0],
    ['Add to cart',    counts['add_to_cart']    || 0],
    ['Begin checkout', counts['begin_checkout'] || 0],
    ['Purchase',       counts['purchase']       || 0]
  ];
  const top = steps[0][1] || 1;
  const rows = steps.map((s, i) => {
    const prev = i > 0 ? steps[i - 1][1] : s[1];
    const stepPct = prev > 0 ? (s[1] / prev * 100) : 0;        // conversion from previous step
    const ofTop = top > 0 ? (s[1] / top * 100) : 0;            // share of the top of funnel
    return [s[0], s[1], i === 0 ? 100 : stepPct, ofTop];
  });
  writeTabReplace(tabName('Funnel', days), ['step', 'count', 'step_pct', 'of_top_pct'], rows);
}

// ============================ GA4: Traffic Quality ============================
function pullGA4Quality(days) {
  const rep = ga4RunReport({
    dimensions: ['date'],
    metrics: ['engagementRate', 'averageSessionDuration', 'screenPageViewsPerSession', 'newUsers', 'totalUsers', 'bounceRate'],
    daysBack: days
  });
  // Rate metrics: average across days. Count metrics: use the summed totals.
  const avgOf = (idx) => {
    const vals = rep.rows.map(r => Number(r.metrics[idx])).filter(v => isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const engRate = avgOf(0);
  const avgDur = avgOf(1);
  const pagesPerSession = avgOf(2);
  const bounce = avgOf(5);
  const newUsers = rep.totals.newUsers || 0;
  const totalUsers = rep.totals.totalUsers || 0;
  const newPct = totalUsers > 0 ? (newUsers / totalUsers * 100) : 0;

  const rows = [
    ['quality_engagement', 'Engagement rate',  (engRate * 100).toFixed(1) + '%', '', '', `${days}d average`,        '', ''],
    ['quality_duration',   'Avg. session',     secondsToHms(avgDur),             '', '', `${days}d average`,        '', ''],
    ['quality_pages',      'Pages / session',  pagesPerSession.toFixed(1),        '', '', `${days}d average`,        '', ''],
    ['quality_newpct',     'New users',        newPct.toFixed(0) + '%',           '', '', 'share of total users',    '', ''],
    ['quality_bounce',     'Bounce rate',      (bounce * 100).toFixed(1) + '%',  '', '', `${days}d average`,        '', '']
  ];
  writeTabReplace(tabName('Quality', days), ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'], rows);
}

// ============================ Meta Ads (placeholder — needs Business Manager access from Protean) ============================
//
// To activate this connector:
//   1. Protean adds kevin.wu@fitasy.ai as Analyst/Admin on Fitasy's Meta Business Manager
//   2. Generate a Meta Marketing API system-user access token at developers.facebook.com
//   3. Store the token: in Apps Script editor → Project Settings (⚙) → Script Properties → Add property:
//        Key: META_TOKEN     Value: <the token>
//        Key: META_AD_ACCOUNT_ID  Value: act_<your account id>
//   4. Uncomment the API call below
//   5. Re-run pullAll() to verify

function pullMeta(days) {
  const token = PropertiesService.getScriptProperties().getProperty('META_TOKEN');
  const accountId = PropertiesService.getScriptProperties().getProperty('META_AD_ACCOUNT_ID');
  if (!token || !accountId) {
    console.log(`pullMeta(${days}): skipped (META_TOKEN / META_AD_ACCOUNT_ID not set in Script Properties)`);
    // Still write empty Meta KPI rows so dashboard shows "—" cleanly rather than just missing
    const rows = [
      ['meta_spend',       'Meta Spend',       '—', '', '', 'pending Meta access', '', ''],
      ['meta_roas',        'Meta ROAS',        '—', '', '', 'pending Meta access', '', ''],
      ['meta_purchases',   'Meta Purchases',   '—', '', '', 'pending Meta access', '', ''],
      ['meta_ctr',         'Meta CTR',         '—', '', '', 'pending Meta access', '', ''],
      ['meta_impressions', 'Meta Impressions', '—', '', '', 'pending Meta access', '', ''],
      ['meta_cpm',         'Meta CPM',         '—', '', '', 'pending Meta access', '', ''],
      ['meta_reach',       'Meta Reach',       '—', '', '', 'pending Meta access', '', ''],
      ['meta_frequency',   'Meta Frequency',   '—', '', '', 'pending Meta access', '', '']
    ];
    writeTabReplace(tabName('MetaKpis', days), ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'], rows);
    return;
  }

  const since = Utilities.formatDate(new Date(Date.now() - days * 86400000), 'UTC', 'yyyy-MM-dd');
  const until = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  // time_range JSON must be URL-encoded — UrlFetchApp rejects raw { } " characters
  const timeRange = encodeURIComponent(JSON.stringify({ since: since, until: until }));
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend,impressions,clicks,ctr,cpm,reach,frequency,purchase_roas,actions&time_range=${timeRange}&access_token=${encodeURIComponent(token)}`;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(resp.getContentText());
  const d = (json.data && json.data[0]) || {};

  const spend = Number(d.spend || 0);
  const ctr = Number(d.ctr || 0);
  const cpm = Number(d.cpm || 0);
  const reach = Number(d.reach || 0);
  const frequency = Number(d.frequency || 0);
  const impressions = Number(d.impressions || 0);
  const roas = d.purchase_roas && d.purchase_roas[0] ? Number(d.purchase_roas[0].value) : 0;
  const purchases = (d.actions || []).filter(a => a.action_type === 'purchase').reduce((s, a) => s + Number(a.value || 0), 0);

  const rows = [
    ['meta_spend',       'Meta Spend',       fmtMoney(spend),         '', '', `${days}d Meta Ads`, '', ''],
    ['meta_roas',        'Meta ROAS',        roas.toFixed(2),         '', '', `${days}d Meta Ads`, '', ''],
    ['meta_purchases',   'Meta Purchases',   fmtNum(purchases),       '', '', `${days}d Meta Ads`, '', ''],
    ['meta_ctr',         'Meta CTR',         ctr.toFixed(2) + '%',    '', '', `${days}d Meta Ads`, '', ''],
    ['meta_impressions', 'Meta Impressions', fmtNum(impressions),     '', '', `${days}d Meta Ads`, '', ''],
    ['meta_cpm',         'Meta CPM',         '$' + cpm.toFixed(2),    '', '', 'cost per 1k impr.', '', ''],
    ['meta_reach',       'Meta Reach',       fmtNum(reach),           '', '', 'unique people',     '', ''],
    ['meta_frequency',   'Meta Frequency',   frequency.toFixed(2),    '', '', 'avg impr. / person','', '']
  ];
  writeTabReplace(tabName('MetaKpis', days), ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'], rows);
}

/**
 * pullMetaCreatives — populate Active Creatives section from currently-active Meta ads.
 * Called once (not per period). Pulls the top ~12 active ads sorted by spend.
 */
function pullMetaCreatives() {
  const token = PropertiesService.getScriptProperties().getProperty('META_TOKEN');
  const accountId = PropertiesService.getScriptProperties().getProperty('META_AD_ACCOUNT_ID');
  if (!token || !accountId) {
    console.log('pullMetaCreatives: skipped (no Meta token)');
    return;
  }

  // Step 1: list active ads with their insight data (last 30 days)
  const since = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'UTC', 'yyyy-MM-dd');
  const until = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const fields = 'name,status,creative{thumbnail_url,name},insights.time_range({"since":"' + since + '","until":"' + until + '"}){spend,impressions,ctr,clicks}';
  // Both fields and filtering must be URL-encoded — UrlFetchApp rejects raw { } [ ] " characters
  const filtering = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]);
  const url = `https://graph.facebook.com/v19.0/${accountId}/ads?fields=${encodeURIComponent(fields)}&filtering=${encodeURIComponent(filtering)}&limit=25&access_token=${encodeURIComponent(token)}`;
  let resp, json;
  try {
    resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    json = JSON.parse(resp.getContentText());
  } catch (e) {
    console.warn('pullMetaCreatives fetch failed:', e);
    return;
  }
  if (json.error) {
    console.warn('pullMetaCreatives Meta API error:', json.error.message);
    return;
  }

  const ads = (json.data || []).map(ad => {
    const ins = (ad.insights && ad.insights.data && ad.insights.data[0]) || {};
    return {
      name: (ad.creative && ad.creative.name) || ad.name || '(no name)',
      thumb: (ad.creative && ad.creative.thumbnail_url) || '',
      spend: Number(ins.spend || 0),
      impressions: Number(ins.impressions || 0),
      ctr: Number(ins.ctr || 0)  // CTR is already a percent like 1.42
    };
  });

  // Top 12 by spend
  ads.sort((a, b) => b.spend - a.spend);
  const top = ads.slice(0, 12);

  const rows = top.map(a => ['Meta', a.name, a.spend, a.impressions, a.ctr, a.thumb]);
  writeTabReplace('Creatives', ['platform', 'name', 'spend', 'impressions', 'ctr', 'thumb_url'], rows);
  console.log(`pullMetaCreatives: wrote ${rows.length} active creatives`);
}

// ============================ Klaviyo (placeholder — needs API key) ============================
//
// To activate:
//   1. Klaviyo → Account → Settings → API Keys → Create Private API Key
//      Scopes needed: Lists Read, Metrics Read, Campaigns Read
//   2. Apps Script editor → Project Settings (⚙) → Script Properties → Add:
//        Key: KLAVIYO_API_KEY    Value: pk_<your key>
//   3. Re-run pullAll(). The Email tab will populate.

function pullKlaviyo() {
  const key = PropertiesService.getScriptProperties().getProperty('KLAVIYO_API_KEY');
  if (!key) {
    console.log('pullKlaviyo: skipped (KLAVIYO_API_KEY not set in Script Properties)');
    const rows = [
      ['email_subscribers', 'Subscribers',        '—', '', '', 'pending Klaviyo key', '', ''],
      ['email_sent',        'Sent',               '—', '', '', 'pending Klaviyo key', '', ''],
      ['email_open_rate',   'Open rate',          '—', '', '', 'pending Klaviyo key', '', ''],
      ['email_revenue',     'Attributed revenue', '—', '', '', 'pending Klaviyo key', '', '']
    ];
    writeTabReplace('Email', ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'], rows);
    return;
  }

  // Real fetch: Klaviyo lists endpoint for subscriber count, metrics endpoint for opens/sent
  const headers = { Authorization: `Klaviyo-API-Key ${key}`, revision: '2024-10-15' };
  let subscribers = '—', sent = '—', openRate = '—', revenue = '—';
  try {
    const listsResp = UrlFetchApp.fetch('https://a.klaviyo.com/api/lists/?fields[list]=profile_count', { headers, muteHttpExceptions: true });
    const lists = JSON.parse(listsResp.getContentText());
    subscribers = fmtNum((lists.data || []).reduce((s, l) => s + Number(l.attributes.profile_count || 0), 0));
  } catch (e) { console.warn('Klaviyo lists fetch failed:', e); }

  const rows = [
    ['email_subscribers', 'Subscribers',        subscribers, '', '', 'Klaviyo lists', '', ''],
    ['email_sent',        'Sent',               sent,        '', '', 'last 30d',      '', ''],
    ['email_open_rate',   'Open rate',          openRate,    '', '', 'last 30d',      '', ''],
    ['email_revenue',     'Attributed revenue', revenue,     '', '', 'last 30d',      '', '']
  ];
  writeTabReplace('Email', ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'], rows);
}

// ============================ Creatives (placeholder) ============================
//
// To populate this tab, you have a few options:
//   - Pull active ads from Meta Marketing API once access is granted (creative.thumbnail_url field)
//   - Pull active Google Ads assets via developer token
//   - Or just manually paste rows into the Creatives tab: platform, name, spend, impressions, ctr, thumb_url
// The dashboard renders each row as a creative card with the thumb image.

function pullCreatives() {
  // For now, just ensure the tab exists with headers. Users can paste rows manually until APIs are connected.
  const ss = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
  if (!ss.getSheetByName('Creatives')) {
    writeTabReplace('Creatives', ['platform', 'name', 'spend', 'impressions', 'ctr', 'thumb_url'], []);
    console.log('pullCreatives: created empty Creatives tab — paste rows manually or wait for Meta/Google API connection');
  }
}

// ============================ Google Ads (placeholder — needs developer token) ============================

function pullGoogleAdsCampaigns() {
  // Until a Google Ads developer token is granted, this function is a no-op.
  // EASIEST PATH: set up a scheduled report in Google Ads UI → output to the FitasyDashboard sheet's "Campaigns" tab.
  //   Reports → Campaign → schedule → Google Sheets destination → pick FitasyDashboard / Campaigns tab
  //   columns to include: Campaign, Cost, Clicks, Avg CPC, Conversions, Conv. value, Conv. value / cost
  //
  // ALTERNATIVE: if you get a developer token, replace this stub with calls to GoogleAdsApp.
  console.log('pullGoogleAdsCampaigns: skipped (needs developer token or scheduled report — see 04_LIVE_DEPLOY.md)');
}

// ============================ Sentiment + Mentions (from existing sheet) ============================

function pullSentiment() {
  const src = SpreadsheetApp.openById(MENTIONS_SHEET_ID).getSheetByName('Mentions');
  const data = src.getDataRange().getValues();
  const headers = data[0];
  const dateIdx = headers.indexOf('Date');
  const sentIdx = headers.indexOf('Sentiment');

  if (dateIdx < 0 || sentIdx < 0) {
    console.warn('Mentions sheet missing Date or Sentiment column');
    return;
  }

  // Group by ISO week
  const byWeek = {};
  for (let i = 1; i < data.length; i++) {
    const dateStr = data[i][dateIdx];
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date)) continue;
    const week = isoWeekLabel(date);
    if (!byWeek[week]) byWeek[week] = { positive: 0, neutral: 0, negative: 0 };
    const sent = String(data[i][sentIdx]).toLowerCase();
    if (sent === 'positive' || sent === 'neutral' || sent === 'negative') byWeek[week][sent]++;
  }

  const sortedWeeks = Object.keys(byWeek).sort().slice(-6);
  const rows = sortedWeeks.map(w => [w, byWeek[w].positive, byWeek[w].neutral, byWeek[w].negative]);
  writeTabReplace('Sentiment', ['week', 'positive', 'neutral', 'negative'], rows);
}

function pullMentions() {
  const src = SpreadsheetApp.openById(MENTIONS_SHEET_ID).getSheetByName('Mentions');
  const data = src.getDataRange().getValues();
  const headers = data[0];
  const idx = key => headers.indexOf(key);
  const rows = [];
  const now = Date.now();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = row[idx('Date')];
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date)) continue;
    const daysAgo = Math.floor((now - date.getTime()) / 86400000);
    rows.push([
      row[idx('Source')] || '',
      row[idx('Title')] || '',
      (row[idx('Sentiment')] || '').toLowerCase(),
      daysAgoLabel(daysAgo),
      row[idx('URL')] || '#'
    ]);
  }

  // Most recent first, top 6
  rows.sort((a, b) => {
    const aDays = parseInt(a[3]) || 999;
    const bDays = parseInt(b[3]) || 999;
    return aDays - bDays;
  });
  writeTabReplace('Mentions', ['source', 'title', 'sentiment', 'days_ago', 'url'], rows.slice(0, 6));
}

function countMentions(days) {
  try {
    const lookback = days || DEFAULT_PERIOD;
    const src = SpreadsheetApp.openById(MENTIONS_SHEET_ID).getSheetByName('Mentions');
    const data = src.getDataRange().getValues();
    const headers = data[0];
    const dateIdx = headers.indexOf('Date');
    if (dateIdx < 0) return data.length - 1;
    const cutoff = Date.now() - lookback * 86400000;
    let n = 0;
    for (let i = 1; i < data.length; i++) {
      const d = new Date(data[i][dateIdx]);
      if (!isNaN(d) && d.getTime() >= cutoff) n++;
    }
    return n;
  } catch (e) { return 0; }
}

// ============================ GA4 HELPERS ============================

function ga4RunReport(opts) {
  const days = opts.daysBack || 30;
  const offset = opts.daysOffset || 0;
  const endDate = `${days + offset - 1}daysAgo`;
  const startDate = `${offset}daysAgo`;
  // Note GA4 quirk: smaller index = older. We do startDate = `${days + offset - 1}daysAgo`, endDate = `${offset}daysAgo`.
  const startReal = `${days + offset - 1}daysAgo`;
  const endReal = offset === 0 ? 'yesterday' : `${offset}daysAgo`;

  const request = {
    dateRanges: [{ startDate: startReal, endDate: endReal }],
    metrics: (opts.metrics || []).map(m => ({ name: m })),
    dimensions: (opts.dimensions || []).map(d => ({ name: d }))
  };
  if (opts.orderBy) request.orderBys = [opts.orderBy];
  if (opts.limit) request.limit = opts.limit;

  const resp = AnalyticsData.Properties.runReport(request, `properties/${GA4_PROPERTY_ID}`);
  const rows = (resp.rows || []).map(r => ({
    dimensions: (r.dimensionValues || []).map(d => d.value),
    metrics: (r.metricValues || []).map(m => m.value)
  }));
  const totals = {};
  (opts.metrics || []).forEach((m, i) => {
    // Prefer aggregated totals from GA4; fall back to summing the row values (some metrics like purchaseRevenue
    // come back null in totals-only queries even when row-level data exists)
    let val;
    if (resp.totals && resp.totals[0] && resp.totals[0].metricValues && resp.totals[0].metricValues[i]) {
      const tv = resp.totals[0].metricValues[i].value;
      val = (tv !== null && tv !== undefined && tv !== '') ? Number(tv) : null;
    }
    if (val === null || val === undefined || !isFinite(val)) {
      val = rows.reduce((sum, r) => sum + Number(r.metrics[i] || 0), 0);
    }
    totals[m] = val;
  });
  return { rows, totals };
}

// ============================ FORMATTING HELPERS ============================

function isFiniteNum(n) { return typeof n === 'number' && isFinite(n); }
function fmtNum(n)   { return isFiniteNum(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '—'; }
function fmtMoney(n) { return isFiniteNum(Number(n)) ? '$' + Math.round(Number(n)).toLocaleString('en-US') : '—'; }
function deltaPct(cur, prev) {
  if (!prev || prev === 0) return { value: '—', dir: 'flat' };
  const pct = (cur - prev) / prev * 100;
  return { value: Math.abs(pct).toFixed(0) + '%', dir: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' };
}
function deltaPctPts(cur, prev, suffix) {
  const diff = cur - prev;
  return { value: Math.abs(diff).toFixed(1) + (suffix || 'pp'), dir: diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'flat' };
}
function deltaAbs(cur, prev, prefix) {
  const diff = cur - prev;
  return { value: (prefix || '') + Math.abs(diff).toFixed(0), dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
}
function secondsToHms(s) {
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}
function isoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
function daysAgoLabel(n) {
  if (n === 0) return 'today';
  if (n === 1) return '1 day ago';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return '1 week ago';
  if (n < 30) return `${Math.floor(n / 7)} weeks ago`;
  return `${Math.floor(n / 30)} month${n >= 60 ? 's' : ''} ago`;
}

// ============================ SHEET WRITE ============================

function writeTabReplace(tabName, headers, rows) {
  const ss = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);
  sheet.clear();
  const totalRows = rows.length + 1;
  // Force every cell to PLAIN TEXT format before writing. This stops the gviz CSV
  // export from type-coercing the `value` column (which has mixed currency / ratio /
  // percent strings) and dropping cells it can't parse. The dashboard does Number()
  // coercion on its side, so text storage is safe for numeric tabs too.
  sheet.getRange(1, 1, totalRows, headers.length).setNumberFormat('@');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    // Coerce undefined/null to empty string, everything else to string
    const safeRows = rows.map(r => r.map(v => (v === undefined || v === null) ? '' : String(v)));
    sheet.getRange(2, 1, safeRows.length, headers.length).setValues(safeRows);
  }
  console.log(`  ✓ ${tabName}: wrote ${rows.length} rows`);
}

// ============================ ONE-TIME SETUP ============================

function setUp() {
  // Just call pullAll once to trigger OAuth grants for all needed scopes
  pullAll();
}

// ============================ TRIGGER MANAGEMENT ============================

function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'pullAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pullAll').timeBased().everyHours(1).create();
  console.log('Hourly trigger installed for pullAll().');
}
