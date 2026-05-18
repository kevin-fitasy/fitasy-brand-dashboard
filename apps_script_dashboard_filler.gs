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
    try { pullGA4Kpis(days); }        catch (e) { console.error(`pullGA4Kpis(${days}):`, e); }
    try { pullGA4OvpSummary(days); }  catch (e) { console.error(`pullGA4OvpSummary(${days}):`, e); }
    try { pullGA4OvpChannels(days); } catch (e) { console.error(`pullGA4OvpChannels(${days}):`, e); }
    try { pullGA4ChannelMix(days); }  catch (e) { console.error(`pullGA4ChannelMix(${days}):`, e); }
    try { pullGA4Trend(days); }       catch (e) { console.error(`pullGA4Trend(${days}):`, e); }
    try { pullGA4TopPages(days); }    catch (e) { console.error(`pullGA4TopPages(${days}):`, e); }
  });

  // Period-agnostic data sources
  try { pullGoogleAdsCampaigns(); } catch (e) { console.error('pullGoogleAdsCampaigns:', e); }
  try { pullSentiment(); }          catch (e) { console.error('pullSentiment:', e); }
  try { pullMentions(); }           catch (e) { console.error('pullMentions:', e); }

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
  const cur = ga4RunReport({
    metrics: ['activeUsers', 'engagedSessions', 'engagementRate', 'purchaseRevenue', 'ecommercePurchases', 'averagePurchaseRevenue'],
    daysBack: days
  });
  const prev = ga4RunReport({
    metrics: ['activeUsers', 'engagedSessions', 'engagementRate', 'purchaseRevenue', 'ecommercePurchases', 'averagePurchaseRevenue'],
    daysBack: days, daysOffset: days
  });

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
    rows.map(r => [r[0], r[1], r[2], r[3].value, r[3].dir, r[4], r[5], r[6]]));
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
    totals[m] = resp.totals && resp.totals[0] && resp.totals[0].metricValues
      ? Number(resp.totals[0].metricValues[i].value)
      : rows.reduce((sum, r) => sum + Number(r.metrics[i] || 0), 0);
  });
  return { rows, totals };
}

// ============================ FORMATTING HELPERS ============================

function fmtNum(n) { return Math.round(Number(n)).toLocaleString('en-US'); }
function fmtMoney(n) { return '$' + Math.round(Number(n)).toLocaleString('en-US'); }
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
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
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
