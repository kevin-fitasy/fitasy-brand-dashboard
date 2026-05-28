/**
 * FITASY DASHBOARD FILLER — Apps Script
 *
 * Pulls data from GA4 + Google Ads + brand mentions sheet on an hourly schedule
 * and writes it into the FitasyDashboard sheet in the shape that dashboard.html expects.
 *
 * SETUP (one-time):
 *   1. Open script.google.com → New project
 *   2. Paste this file in. Save (name it "Fitasy Dashboard Filler").
 *   3. Resources → Advanced Google services → enable:
 *        - Google Analytics Data API (GA4)  →  identifier: AnalyticsData
 *   4. Run setUp() once → click through the OAuth consent screen (grants GA4 + Sheets access)
 *   5. Run pullAll() once → confirm rows land in the sheet
 *   6. Triggers (⏰ icon left) → add trigger:  pullAll · Time-driven · Hour timer · Every hour
 *
 * GOOGLE ADS NOTE:
 *   Google Ads data is pulled via the Google Ads API REST endpoint directly from this
 *   script (the in-account "Scripts" feature isn't available on the Fitasy Ads account).
 *   See the Google Ads section further down and GOOGLE_ADS_SETUP.md for the 3-step setup.
 *   Until configured, pullGoogleAdsCampaigns() is a clean no-op — the rest still works.
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

// Populated by pullGoogleAdsCampaigns() (runs before the period loop) so pullGA4Kpis()
// can fill in the four Google Ads KPI rows (cost/order, avg CPC, cost, ROAS).
// Stays null if the Google Ads connector isn't configured — those rows then show "—".
var GOOGLE_ADS_KPI = null;

// Populated by pullMeta() so pullGA4Kpis() can compute *blended* (Google+Meta) cost/order.
// Stays null if Meta isn't configured.
var META_KPI = null;

// ---- Custom date-range mode (used by the doGet web app for the dashboard's custom picker) ----
// When CUSTOM_RANGE is set, every pull function computes against an explicit start/end
// instead of "N days ago", and tabName() drops the _Nd suffix.
// When CAPTURE is set, writeTabReplace() collects results in memory instead of writing
// to the sheet. Both are null during the normal hourly pullAll() run.
//   CUSTOM_RANGE = { startDate, endDate, prevStartDate, prevEndDate, days }
var CUSTOM_RANGE = null;
var CAPTURE = null;

// ============================ ENTRYPOINT ============================

function pullAll() {
  const t0 = Date.now();
  console.log('=== Fitasy Dashboard Filler — pullAll() ===');

  try { writeConfig(); } catch (e) { console.error('writeConfig:', e); }

  // Google Ads first — it populates GOOGLE_ADS_KPI, which pullGA4Kpis() reads to fill
  // the four Google Ads KPI rows for every period.
  try { pullGoogleAdsCampaigns(); } catch (e) { console.error('pullGoogleAdsCampaigns:', e); }

  // GA4-derived tabs are duplicated per period (7d, 30d, 90d) so the dashboard can switch instantly
  PERIODS.forEach(days => {
    console.log(`--- Period: ${days} days ---`);
    // Meta first so META_KPI is set before pullGA4Kpis builds the blended cost/order row.
    try { pullMeta(days); }            catch (e) { console.error(`pullMeta(${days}):`, e); }
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
  });

  // Period-agnostic data sources
  try { pullSentiment(); }          catch (e) { console.error('pullSentiment:', e); }
  try { pullMentions(); }           catch (e) { console.error('pullMentions:', e); }
  try { pullKlaviyo(); }            catch (e) { console.error('pullKlaviyo:', e); }
  try { pullCreatives(); }          catch (e) { console.error('pullCreatives:', e); }
  try { pullMetaCreatives(); }      catch (e) { console.error('pullMetaCreatives:', e); }

  console.log(`=== Done in ${(Date.now() - t0) / 1000}s ===`);
}

// Helper: build period-suffixed tab name.
// In custom-range mode there is no _Nd suffix — results are captured in memory by base name.
function tabName(base, days) { return CUSTOM_RANGE ? base : `${base}_${days}d`; }

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
  // Pull `sessions` too so engagement rate and conversion rate can be computed properly
  // from totals (sums of per-day rates would be wrong).
  const cur = ga4RunReport({
    dimensions: ['date'],
    metrics: ['activeUsers', 'sessions', 'engagedSessions', 'purchaseRevenue', 'ecommercePurchases'],
    daysBack: days
  });
  const prev = ga4RunReport({
    dimensions: ['date'],
    metrics: ['activeUsers', 'sessions', 'engagedSessions', 'purchaseRevenue', 'ecommercePurchases'],
    daysBack: days, daysOffset: days
  });

  // Derive everything from totals so the math is internally consistent:
  //   engagementRate = engagedSessions / sessions  (weighted properly)
  //   AOV            = purchaseRevenue / ecommercePurchases
  //   purchaseRate   = ecommercePurchases / sessions  (industry-standard CVR)
  function derive(t) {
    t.engagementRate = (t.sessions > 0) ? t.engagedSessions / t.sessions : 0;
    t.averagePurchaseRevenue = (t.ecommercePurchases > 0) ? t.purchaseRevenue / t.ecommercePurchases : 0;
    t.purchaseRate = (t.sessions > 0) ? t.ecommercePurchases / t.sessions : 0;
  }
  derive(cur.totals);
  derive(prev.totals);

  const c = cur.totals;
  const p = prev.totals;
  const vsPrior = `vs prior ${days}d`;

  // Google Ads rows — filled from GOOGLE_ADS_KPI when the connector is configured.
  const g = GOOGLE_ADS_KPI;
  const gMeta = g ? '30d Google Ads' : 'pending Google Ads pull';
  const avgCpc       = (g && g.clicks > 0) ? '$' + (g.cost / g.clicks).toFixed(2) : '—';
  const googleCost   = g ? fmtMoney(g.cost) : '—';
  const googleRoas   = (g && g.cost > 0) ? (g.revenue / g.cost).toFixed(2) : '—';
  const googleCpm    = (g && g.impressions > 0) ? '$' + (g.cost / (g.impressions / 1000)).toFixed(2) : '—';

  // Blended CPM = (Google + Meta cost) / (Google + Meta impressions / 1000)
  const blendedSpend = (g && g.cost ? g.cost : 0) + (META_KPI && META_KPI.spend ? META_KPI.spend : 0);
  const blendedImps  = (g && g.impressions ? g.impressions : 0) + (META_KPI && META_KPI.impressions ? META_KPI.impressions : 0);
  const blendedCpm   = blendedImps > 0 ? '$' + (blendedSpend / (blendedImps / 1000)).toFixed(2) : '—';
  const blendedCpmMetaParts = [];
  if (g && g.cost > 0)               blendedCpmMetaParts.push('Google');
  if (META_KPI && META_KPI.spend > 0) blendedCpmMetaParts.push('Meta');
  const blendedCpmMeta = blendedCpmMetaParts.length ? `${blendedCpmMetaParts.join(' + ')} blended` : 'pending ad data';

  // Blended cost / order = (Google + Meta ad spend) / GA4 transactions.
  // GA4 transactions is the ground-truth order count (one purchase = one order, no
  // double-counting like ad-platform-attributed conversions can do). When neither ad
  // connector is configured this still shows "—".
  const adSpend = (g && g.cost ? g.cost : 0) + (META_KPI && META_KPI.spend ? META_KPI.spend : 0);
  const hasAnyAdCost = (g && g.cost > 0) || (META_KPI && META_KPI.spend > 0);
  const cpoMetaParts = [];
  if (g && g.cost > 0)               cpoMetaParts.push('Google');
  if (META_KPI && META_KPI.spend > 0) cpoMetaParts.push('Meta');
  const cpoMeta = cpoMetaParts.length ? `blended (${cpoMetaParts.join(' + ')}) / GA4 orders`
                                      : 'pending ad cost data';
  const costPerOrder = (hasAnyAdCost && c.ecommercePurchases > 0)
    ? fmtMoney(adSpend / c.ecommercePurchases) : '—';

  const rows = [
    ['active_users',     'Active users',     fmtNum(c.activeUsers),       deltaPct(c.activeUsers, p.activeUsers),         vsPrior, '', ''],
    ['engaged_sessions', 'Engaged sessions', fmtNum(c.engagedSessions),   deltaPct(c.engagedSessions, p.engagedSessions), vsPrior, '', ''],
    ['engagement_rate',  'Engagement rate',  (c.engagementRate * 100).toFixed(1) + '%',
      deltaPctPts(c.engagementRate * 100, p.engagementRate * 100, 'pp'), vsPrior, '', ''],
    ['purchase_revenue', 'Purchase revenue', fmtMoney(c.purchaseRevenue), deltaPct(c.purchaseRevenue, p.purchaseRevenue), vsPrior, '', ''],
    ['transactions',     'Transactions',     fmtNum(c.ecommercePurchases),deltaPct(c.ecommercePurchases, p.ecommercePurchases), vsPrior, '', ''],
    ['aov',              'AOV',              fmtMoney(c.averagePurchaseRevenue),
      deltaAbs(c.averagePurchaseRevenue, p.averagePurchaseRevenue, '$'), vsPrior, '', ''],
    ['cost_per_order',   'Cost / order',     costPerOrder, '', cpoMeta, '', ''],
    ['avg_cpc',          'Avg. CPC',         avgCpc,       '', gMeta, '', ''],
    ['google_cost',      'Google Ads cost',  googleCost,   '', gMeta, '', ''],
    ['roas',             'Google ROAS',      googleRoas,   '', gMeta, '', ''],
    ['google_cpm',       'Google CPM',       googleCpm,    '', gMeta, '', ''],
    ['blended_cpm',      'Blended CPM',      blendedCpm,   '', blendedCpmMeta, '', ''],
    ['purchase_rate',    'Purchase rate',    (c.purchaseRate * 100).toFixed(2) + '%', '',
      'transactions / sessions', '', ''],
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
  // Pull both source and medium so we can catch un-UTM'd Meta ad clicks
  // (logged as `referral` from facebook/instagram domains).
  const rep = ga4RunReport({
    dimensions: ['sessionSource', 'sessionMedium'],
    metrics: ['sessions', 'purchaseRevenue', 'ecommercePurchases'],
    daysBack: days
  });

  // Sum the totals first (across all sessions), then derive organic = total − paid.
  // Guarantees Organic + Paid == Total and the % labels sum to 100% — matches
  // Kevin's definition: organic sales = all sales minus sales from ads.
  let total = { sessions: 0, revenue: 0, transactions: 0 };
  let paid  = { sessions: 0, revenue: 0, transactions: 0 };

  rep.rows.forEach(r => {
    const source = r.dimensions[0];
    const medium = r.dimensions[1];
    const sess = Number(r.metrics[0]);
    const rev = Number(r.metrics[1]);
    const tx = Number(r.metrics[2]);
    total.sessions += sess; total.revenue += rev; total.transactions += tx;
    if (isPaidTraffic(source, medium)) {
      paid.sessions += sess; paid.revenue += rev; paid.transactions += tx;
    }
  });

  const organic = {
    sessions:     total.sessions     - paid.sessions,
    revenue:      total.revenue      - paid.revenue,
    transactions: total.transactions - paid.transactions
  };

  const orgPct  = total.revenue > 0 ? Math.round(organic.revenue / total.revenue * 100) : 0;
  const paidPct = total.revenue > 0 ? 100 - orgPct : 0;  // guaranteed to sum to 100

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

// Single source of truth for "is this GA4 session paid?". Looks at both source and medium.
// - Properly UTM-tagged paid traffic (medium = cpc / ppc / paid_*) → paid.
// - Meta ad clicks usually arrive un-UTM'd as `referral` from facebook/instagram domains.
//   GA4 has no way to know they're paid. At Fitasy's stage, organic Facebook/Instagram
//   referrals are negligible, so we treat referrals from those domains as Paid Social.
//   If organic social starts driving meaningful traffic, narrow this list.
// The proper fix is UTMs on Meta ad URLs (utm_medium=paid_social); this is the band-aid
// until those land. Pass medium only (old call sites) and it still works.
function isPaidTraffic(source, medium) {
  const m = String(medium || '').toLowerCase().trim();
  if (m === 'cpc' || m === 'ppc' || m === 'paid' ||
      m === 'paid_social' || m === 'paidsocial' ||
      m === 'paid_search' || m === 'paidsearch' ||
      m.indexOf('paid_') === 0) return true;

  const s = String(source || '').toLowerCase().trim();
  const PAID_SOCIAL_DOMAINS = new Set([
    'facebook.com', 'm.facebook.com', 'l.facebook.com',
    'instagram.com', 'l.instagram.com',
    'fb.me', 'fb.com'
  ]);
  if (PAID_SOCIAL_DOMAINS.has(s) && (m === 'referral' || m === '' || m === '(not set)')) return true;
  return false;
}
// Back-compat wrapper for any caller that only has medium (no source available).
function isPaidMedium(medium) { return isPaidTraffic('', medium); }

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
    // sessionSourceMedium is "source / medium" — split and run through the same
    // isPaidTraffic predicate used by OvpSummary and Trend.
    const parts = String(sourceMedium).split(' / ');
    const source = (parts[0] || '').trim();
    const medium = (parts[1] || '').trim();
    let cls;
    if (isPaidTraffic(source, medium))                                cls = 'Paid';
    else if (medium === '(none)' || sourceMedium.includes('(direct)')) cls = 'Direct';
    else                                                                cls = 'Organic';
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
    dimensions: ['date', 'sessionSource', 'sessionMedium'],
    metrics: ['sessions', 'purchaseRevenue'],
    daysBack: days
  });

  const byDate = {};
  rep.rows.forEach(r => {
    const date = r.dimensions[0];
    const source = r.dimensions[1];
    const medium = r.dimensions[2];
    const sess = Number(r.metrics[0]);
    const rev = Number(r.metrics[1]);
    if (!byDate[date]) byDate[date] = { revenue: 0, cost: 0, organic_sessions: 0, paid_sessions: 0 };
    byDate[date].revenue += rev;
    // Same paid classification as OvpSummary: properly-tagged paid mediums + the
    // facebook/instagram referral heuristic. Direct ("(none)") rolls into organic.
    if (isPaidTraffic(source, medium)) byDate[date].paid_sessions += sess;
    else                                byDate[date].organic_sessions += sess;
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
  const pageId = PropertiesService.getScriptProperties().getProperty('META_FB_PAGE_ID');

  const HEADERS = ['id', 'label', 'value', 'delta', 'delta_direction', 'meta', 'prefix', 'suffix'];

  // Empty-state row sets (used when a connector isn't configured).
  const emptyAdRows = (note) => [
    ['meta_spend',       'Meta Spend',       '—', '', '', note, '', ''],
    ['meta_roas',        'Meta ROAS',        '—', '', '', note, '', ''],
    ['meta_purchases',   'Meta Purchases',   '—', '', '', note, '', ''],
    ['meta_ctr',         'Meta CTR',         '—', '', '', note, '', ''],
    ['meta_impressions', 'Meta Impressions', '—', '', '', note, '', ''],
    ['meta_cpm',         'Meta CPM',         '—', '', '', note, '', ''],
    ['meta_reach',       'Meta Reach',       '—', '', '', note, '', ''],
    ['meta_frequency',   'Meta Frequency',   '—', '', '', note, '', '']
  ];
  const emptyFollowerRows = (note) => [
    ['followers_total', 'Followers',       '—', '', '', note, '', ''],
    ['followers_ig',    'Instagram',       '—', '', '', note, '', ''],
    ['followers_fb',    'Facebook Page',   '—', '', '', note, '', ''],
    ['cpf',             'Cost / follower', '—', '', '', note, '', '']
  ];

  if (!token || !accountId) {
    console.log(`pullMeta(${days}): skipped (META_TOKEN / META_AD_ACCOUNT_ID not set in Script Properties)`);
    writeTabReplace(tabName('MetaKpis', days), HEADERS,
      [].concat(emptyAdRows('pending Meta access'), emptyFollowerRows('pending Meta access')));
    return;
  }

  const since = CUSTOM_RANGE ? CUSTOM_RANGE.startDate
    : Utilities.formatDate(new Date(Date.now() - days * 86400000), 'UTC', 'yyyy-MM-dd');
  const until = CUSTOM_RANGE ? CUSTOM_RANGE.endDate
    : Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');

  // --- Ad performance ---
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

  const adRows = [
    ['meta_spend',       'Meta Spend',       fmtMoney(spend),         '', '', `${days}d Meta Ads`, '', ''],
    ['meta_roas',        'Meta ROAS',        roas.toFixed(2),         '', '', `${days}d Meta Ads`, '', ''],
    ['meta_purchases',   'Meta Purchases',   fmtNum(purchases),       '', '', `${days}d Meta Ads`, '', ''],
    ['meta_ctr',         'Meta CTR',         ctr.toFixed(2) + '%',    '', '', `${days}d Meta Ads`, '', ''],
    ['meta_impressions', 'Meta Impressions', fmtNum(impressions),     '', '', `${days}d Meta Ads`, '', ''],
    ['meta_cpm',         'Meta CPM',         '$' + cpm.toFixed(2),    '', '', 'cost per 1k impr.', '', ''],
    ['meta_reach',       'Meta Reach',       fmtNum(reach),           '', '', 'unique people',     '', ''],
    ['meta_frequency',   'Meta Frequency',   frequency.toFixed(2),    '', '', 'avg impr. / person','', '']
  ];

  // --- Followers + CPF ---
  let followerRows;
  if (!pageId) {
    followerRows = emptyFollowerRows('set META_FB_PAGE_ID');
  } else {
    const stats = fetchMetaFollowerStats(token, pageId, since, until);
    if (!stats) {
      followerRows = emptyFollowerRows('Meta Graph API error — check token scopes');
    } else {
      const total = stats.fb + stats.ig;
      const newTotal = stats.fbNew + stats.igNew;
      const sign = (n) => n > 0 ? 'up' : (n < 0 ? 'down' : 'flat');
      const absStr = (n) => String(Math.abs(Math.round(n)));
      const cpf = (spend > 0 && newTotal > 0) ? fmtMoney(spend / newTotal) : '—';
      const window = `net ${days}d`;
      followerRows = [
        ['followers_total', 'Followers',       fmtNum(total),    absStr(newTotal),   sign(newTotal),   window, '', ''],
        ['followers_ig',    'Instagram',       fmtNum(stats.ig), absStr(stats.igNew), sign(stats.igNew), window, '', ''],
        ['followers_fb',    'Facebook Page',   fmtNum(stats.fb), absStr(stats.fbNew), sign(stats.fbNew), window, '', ''],
        ['cpf',             'Cost / follower', cpf, '', '', `${days}d Meta spend / new followers`, '', '']
      ];
    }
  }

  writeTabReplace(tabName('MetaKpis', days), HEADERS, [].concat(adRows, followerRows));

  // Stash totals so pullGA4Kpis() can compute the blended (Google + Meta) cost/order.
  META_KPI = { spend: spend, purchases: purchases, impressions: impressions };
}

/**
 * Fetches FB Page + Instagram follower snapshots and period growth from the Meta Graph API.
 * Returns { fb, ig, fbNew, igNew } or null on error.
 * Requires the Meta token to have scopes: pages_read_engagement, instagram_basic,
 * instagram_manage_insights — and the system user assigned to the Page asset.
 */
function fetchMetaFollowerStats(token, pageId, since, until) {
  // 1. Current FB + IG snapshot (one call, expands IG account).
  const fields = 'fan_count,followers_count,instagram_business_account{id,followers_count}';
  const baseUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  let basics;
  try {
    const resp = UrlFetchApp.fetch(baseUrl, { muteHttpExceptions: true });
    basics = JSON.parse(resp.getContentText());
  } catch (e) {
    console.warn('fetchMetaFollowerStats basics fetch failed:', e);
    return null;
  }
  if (basics.error) {
    console.warn('fetchMetaFollowerStats Meta API error:', basics.error.message);
    return null;
  }
  const fb = Number(basics.followers_count || basics.fan_count || 0);
  const igAccount = basics.instagram_business_account;
  const igId = igAccount && igAccount.id;
  const ig = igAccount ? Number(igAccount.followers_count || 0) : 0;

  // 2. Period growth — best-effort. Each is wrapped: a single failure shouldn't sink the row.
  function sumDailyMetric(url) {
    try {
      const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const j = JSON.parse(r.getContentText());
      if (j.error) { console.warn('  insights error:', j.error.message); return 0; }
      if (!j.data || !j.data[0] || !j.data[0].values) return 0;
      return j.data[0].values.reduce((s, v) => s + Number(v.value || 0), 0);
    } catch (e) { console.warn('  insights fetch failed:', e); return 0; }
  }
  const fbNew = sumDailyMetric(
    `https://graph.facebook.com/v19.0/${pageId}/insights?metric=page_follows&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`
  );
  const igNew = igId ? sumDailyMetric(
    `https://graph.facebook.com/v19.0/${igId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`
  ) : 0;

  return { fb: fb, ig: ig, fbNew: fbNew, igNew: igNew };
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

// ============================ Google Ads (Google Ads API — REST) ============================
//
// This connector hits the Google Ads API directly from Apps Script (no in-account
// "Scripts" feature needed — that feature isn't available on the Fitasy Ads account).
//
// TO ACTIVATE — three one-time steps (see GOOGLE_ADS_SETUP.md for full detail):
//   1. Get a developer token: ads.google.com → Admin → API Center → copy the token.
//   2. Add the Ads API OAuth scope to the script manifest (appsscript.json):
//        Project Settings (⚙) → tick "Show appsscript.json" → in the editor open
//        appsscript.json and add to (or create) "oauthScopes":
//          "https://www.googleapis.com/auth/adwords"
//   3. Project Settings (⚙) → Script properties → add:
//        GOOGLE_ADS_DEVELOPER_TOKEN   = the token from step 1
//        GOOGLE_ADS_CUSTOMER_ID       = 7448767442   (the Fitasy account ID, digits only, no dashes)
//        GOOGLE_ADS_LOGIN_CUSTOMER_ID = (optional) the MCC/manager account ID, digits only,
//                                       only if the account is accessed through a manager account
//   Then run pullAll() and re-authorize when prompted.
//
// Read-only: queries campaign metrics only. Cannot change campaigns or spend.

const GOOGLE_ADS_API_VERSION = 'v17';
const GOOGLE_ADS_CAMPAIGN_HEADERS = ['campaign', 'cost', 'clicks', 'cpc', 'conversions', 'revenue', 'roas'];

function pullGoogleAdsCampaigns() {
  const props = PropertiesService.getScriptProperties();
  const devToken    = props.getProperty('GOOGLE_ADS_DEVELOPER_TOKEN');
  const customerId  = (props.getProperty('GOOGLE_ADS_CUSTOMER_ID') || '').replace(/\D/g, '');
  const loginCid    = (props.getProperty('GOOGLE_ADS_LOGIN_CUSTOMER_ID') || '').replace(/\D/g, '');

  if (!devToken || !customerId) {
    console.log('pullGoogleAdsCampaigns: skipped (GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CUSTOMER_ID not set in Script Properties)');
    // Ensure the tab exists with headers so the dashboard shows a clean empty state.
    const ss = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
    if (!ss.getSheetByName('Campaigns')) writeTabReplace('Campaigns', GOOGLE_ADS_CAMPAIGN_HEADERS, []);
    return;
  }

  // GAQL: campaign-level metrics, top 50 by cost. Date window is the custom range
  // when set, otherwise the trailing 30 days.
  const dateClause = CUSTOM_RANGE
    ? `segments.date BETWEEN '${CUSTOM_RANGE.startDate}' AND '${CUSTOM_RANGE.endDate}'`
    : 'segments.date DURING LAST_30_DAYS';
  const query =
    'SELECT campaign.name, metrics.cost_micros, metrics.clicks, metrics.average_cpc, ' +
    'metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.impressions ' +
    'FROM campaign ' +
    `WHERE ${dateClause} AND campaign.status != 'REMOVED' ` +
    'ORDER BY metrics.cost_micros DESC LIMIT 50';

  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`;
  const headers = {
    'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
    'developer-token': devToken
  };
  if (loginCid) headers['login-customer-id'] = loginCid;

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const body = resp.getContentText();
  if (code !== 200) {
    console.warn(`pullGoogleAdsCampaigns: Google Ads API HTTP ${code} — ${body.slice(0, 500)}`);
    const ss = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
    if (!ss.getSheetByName('Campaigns')) writeTabReplace('Campaigns', GOOGLE_ADS_CAMPAIGN_HEADERS, []);
    return;
  }

  // searchStream returns a JSON array of chunks: [{ results: [...] }, ...]
  let chunks;
  try {
    chunks = JSON.parse(body);
  } catch (e) {
    console.warn('pullGoogleAdsCampaigns: could not parse response —', e);
    return;
  }
  if (!Array.isArray(chunks)) chunks = [chunks];

  const rows = [];
  let totCost = 0, totClicks = 0, totConv = 0, totRevenue = 0, totImps = 0;

  chunks.forEach(chunk => {
    (chunk.results || []).forEach(r => {
      const campaign = (r.campaign && r.campaign.name) || '(unnamed)';
      const m = r.metrics || {};
      // REST JSON returns metrics camelCased; micros come back as strings.
      const cost      = Number(m.costMicros || 0) / 1e6;
      const clicks    = Number(m.clicks || 0);
      const cpc       = Number(m.averageCpc || 0) / 1e6;
      const conv      = Number(m.conversions || 0);
      const revenue   = Number(m.conversionsValue || 0);
      const imps      = Number(m.impressions || 0);
      const roas      = cost > 0 ? revenue / cost : 0;
      rows.push([campaign, cost, clicks, cpc, conv, revenue, roas]);
      totCost += cost; totClicks += clicks; totConv += conv; totRevenue += revenue; totImps += imps;
    });
  });

  writeTabReplace('Campaigns', GOOGLE_ADS_CAMPAIGN_HEADERS, rows);

  // Stash account totals so pullGA4Kpis() can fill the Google Ads KPI rows.
  GOOGLE_ADS_KPI = { cost: totCost, clicks: totClicks, conversions: totConv, revenue: totRevenue, impressions: totImps };
  console.log(`pullGoogleAdsCampaigns: wrote ${rows.length} campaign rows ` +
    `(30d spend ${fmtMoney(totCost)}, ${totConv} conversions)`);
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
    const src = SpreadsheetApp.openById(MENTIONS_SHEET_ID).getSheetByName('Mentions');
    const data = src.getDataRange().getValues();
    const headers = data[0];
    const dateIdx = headers.indexOf('Date');
    if (dateIdx < 0) return data.length - 1;

    // Custom-range mode: count mentions inside the explicit window. Otherwise: trailing N days.
    let lo, hi;
    if (CUSTOM_RANGE) {
      lo = new Date(CUSTOM_RANGE.startDate + 'T00:00:00Z').getTime();
      hi = new Date(CUSTOM_RANGE.endDate + 'T23:59:59Z').getTime();
    } else {
      lo = Date.now() - (days || DEFAULT_PERIOD) * 86400000;
      hi = Date.now();
    }
    let n = 0;
    for (let i = 1; i < data.length; i++) {
      const d = new Date(data[i][dateIdx]);
      if (!isNaN(d) && d.getTime() >= lo && d.getTime() <= hi) n++;
    }
    return n;
  } catch (e) { return 0; }
}

// ============================ GA4 HELPERS ============================

function ga4RunReport(opts) {
  let startReal, endReal;
  if (CUSTOM_RANGE) {
    // Custom-range mode: GA4 accepts explicit YYYY-MM-DD dates directly.
    // A truthy daysOffset means the caller wants the prior comparison window.
    if (opts.daysOffset) { startReal = CUSTOM_RANGE.prevStartDate; endReal = CUSTOM_RANGE.prevEndDate; }
    else                 { startReal = CUSTOM_RANGE.startDate;     endReal = CUSTOM_RANGE.endDate; }
  } else {
    const days = opts.daysBack || 30;
    const offset = opts.daysOffset || 0;
    // GA4 quirk: smaller index = older. startDate is the older bound.
    startReal = `${days + offset - 1}daysAgo`;
    endReal = offset === 0 ? 'yesterday' : `${offset}daysAgo`;
  }

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
  // Capture mode (custom-range web app): collect in memory, don't touch the sheet.
  if (CAPTURE) {
    CAPTURE[tabName] = {
      headers: headers,
      rows: rows.map(r => r.map(v => (v === undefined || v === null) ? '' : v))
    };
    console.log(`  ✓ [capture] ${tabName}: ${rows.length} rows`);
    return;
  }

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

// ============================ CUSTOM DATE-RANGE WEB APP ============================
//
// The dashboard's custom date picker calls this script (deployed as a Web App) with
// ?start=YYYY-MM-DD&end=YYYY-MM-DD. It computes every period-dependent dataset for that
// exact range in memory and returns JSON — nothing is written to the sheet.
//
// DEPLOY (one-time): Deploy → New deployment → type "Web app" →
//   Execute as: Me   ·   Who has access: Anyone
// Copy the /exec URL and paste it into dashboard.html as WEBAPP_URL.
// See WEBAPP_SETUP.md.

function doGet(e) {
  const p = (e && e.parameter) || {};
  const start = p.start, end = p.end;
  const out = { ok: false };
  try {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!start || !end || !isoRe.test(start) || !isoRe.test(end)) {
      out.error = 'start and end query params (YYYY-MM-DD) are required';
    } else if (start > end) {
      out.error = 'start date must be on or before end date';
    } else {
      const captured = buildCustomReport(start, end);
      // Convert each captured {headers, rows} into an array of row-objects —
      // the same shape PapaParse produces, so the dashboard renders it unchanged.
      const data = {};
      Object.keys(captured).forEach(base => {
        const t = captured[base];
        data[base] = t.rows.map(r => {
          const o = {};
          t.headers.forEach((h, i) => { o[h] = r[i]; });
          return o;
        });
      });
      out.ok = true;
      out.range = { start: start, end: end };
      out.data = data;
    }
  } catch (err) {
    out.error = String(err && err.message ? err.message : err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * buildCustomReport — runs every period-dependent pull for an explicit date range
 * and returns the captured datasets keyed by base tab name.
 */
function buildCustomReport(startDate, endDate) {
  const span = daysBetweenInclusive(startDate, endDate);
  const prev = priorRangeOf(startDate, endDate);
  CUSTOM_RANGE = {
    startDate: startDate, endDate: endDate,
    prevStartDate: prev.start, prevEndDate: prev.end,
    days: span
  };
  CAPTURE = {};
  try {
    // Google Ads first so GOOGLE_ADS_KPI is set before pullGA4Kpis reads it.
    try { pullGoogleAdsCampaigns(); } catch (err) { console.error('custom pullGoogleAdsCampaigns:', err); }

    // Meta first so META_KPI is set before pullGA4Kpis builds the blended cost/order row.
    const steps = [
      pullMeta,
      pullGA4Kpis, pullGA4OvpSummary, pullGA4OvpChannels, pullGA4ChannelMix,
      pullGA4Trend, pullGA4TopPages, pullGA4DemoAge, pullGA4DemoGender,
      pullGA4Geo, pullGA4Funnel, pullGA4Quality, pullGA4Products, pullGA4Pillars
    ];
    steps.forEach(fn => {
      try { fn(span); } catch (err) { console.error('custom ' + fn.name + ':', err); }
    });
    return CAPTURE;
  } finally {
    // Always clear globals so the next hourly pullAll() runs normally.
    CUSTOM_RANGE = null;
    CAPTURE = null;
    GOOGLE_ADS_KPI = null;
    META_KPI = null;
  }
}

// Inclusive day count between two YYYY-MM-DD dates (e.g. Apr 1 → Apr 30 = 30).
function daysBetweenInclusive(a, b) {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime();
  return Math.round(ms / 86400000) + 1;
}

// The equally-long window immediately before [start, end], for period-over-period deltas.
function priorRangeOf(start, end) {
  const span = daysBetweenInclusive(start, end);
  const prevEnd = new Date(new Date(start + 'T00:00:00Z').getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (span - 1) * 86400000);
  return {
    start: Utilities.formatDate(prevStart, 'UTC', 'yyyy-MM-dd'),
    end: Utilities.formatDate(prevEnd, 'UTC', 'yyyy-MM-dd')
  };
}

// Convenience: run a custom report straight from the editor for testing.
function testCustomReport() {
  const r = buildCustomReport('2026-04-01', '2026-04-30');
  console.log('Captured tabs: ' + Object.keys(r).join(', '));
}
