/**
 * ⚠️ OBSOLETE — DO NOT USE.
 * The Fitasy Google Ads account does not have the in-account "Scripts" feature
 * (Tools menu shows only Conversions + Measurement). Google Ads data is now pulled
 * via the Google Ads API inside apps_script_dashboard_filler.gs (pullGoogleAdsCampaigns).
 * See GOOGLE_ADS_SETUP.md. This file is kept only for reference.
 *
 * FITASY DASHBOARD — GOOGLE ADS SCRIPT (separate from Apps Script)
 *
 * This runs *inside Google Ads* (not Apps Script) — Tools & Settings → Bulk actions → Scripts.
 * No developer token needed; it uses the Google Ads account auth.
 * Pulls campaign-level metrics for the last 30 days and writes them to the
 * Campaigns tab of the FitasyDashboard sheet, matching the schema the
 * dashboard.html expects.
 *
 * SETUP (one-time, ~5 min):
 *   1. Sign in to ads.google.com → Fitasy Inc. account
 *   2. Click the wrench/Tools icon in the LEFT sidebar (between Goals and Billing)
 *   3. Look for "Bulk actions" group → click "Scripts" (may be labeled "Custom" in some UIs)
 *      ↳ If you can't find it, try: top search bar → type "scripts" → click result
 *   4. Click the blue "+" New Script button
 *   5. Delete the default code, paste this entire file
 *   6. Click "Authorize" → grant permissions for Google Ads + Google Sheets
 *   7. Click "Preview" (bottom right) — should run in ~30 sec, log lines visible
 *   8. If preview succeeds, click "Save and run", then go back and click the
 *      three-dot menu → "Frequency" → "Daily" → save
 *
 * After setup:
 *   - Script runs every morning, refreshes the Campaigns tab
 *   - Dashboard at bright-truffle-d520e5.netlify.app picks it up automatically
 */

const DASHBOARD_SHEET_ID = '1IXx602iT322QYoA7fEd4BzRrBBsCDxD9MEmeecJxnME';
const TAB_NAME = 'Campaigns';
const LOOKBACK_DAYS = 30;

function main() {
  Logger.log('=== Fitasy Google Ads → Sheet sync ===');

  // GAQL query: campaign-level last 30 days, top 50 by cost
  const query = `
    SELECT
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.impressions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  const report = AdsApp.report(query);
  const rows = [];
  const iter = report.rows();

  while (iter.hasNext()) {
    const r = iter.next();
    const costMicros = Number(r['metrics.cost_micros'] || 0);
    const cost = costMicros / 1000000;
    const cpcMicros = Number(r['metrics.average_cpc'] || 0);
    const cpc = cpcMicros / 1000000;
    const clicks = Number(r['metrics.clicks'] || 0);
    const conversions = Number(r['metrics.conversions'] || 0);
    const convValue = Number(r['metrics.conversions_value'] || 0);
    const roas = cost > 0 ? convValue / cost : 0;

    rows.push([
      r['campaign.name'],
      cost,
      clicks,
      cpc,
      conversions,
      convValue,
      roas
    ]);
  }

  // Write to FitasyDashboard sheet
  const ss = SpreadsheetApp.openById(DASHBOARD_SHEET_ID);
  let sheet = ss.getSheetByName(TAB_NAME);
  if (!sheet) sheet = ss.insertSheet(TAB_NAME);
  sheet.clear();

  const headers = ['campaign', 'cost', 'clicks', 'cpc', 'conversions', 'revenue', 'roas'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  Logger.log(`✓ Wrote ${rows.length} campaign rows to ${TAB_NAME} tab`);
}
