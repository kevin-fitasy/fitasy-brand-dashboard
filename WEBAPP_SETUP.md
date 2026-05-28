# Custom Date Range — Web App Setup

**Goal:** let the dashboard's **Custom** date picker (and the **This Month / Last
Month** buttons) work.
**Time:** ~5 minutes.

## How it works

- **Presets** (7 / 30 / 90 Days) stay instant — they read pre-computed `_Nd` tabs
  from the sheet, exactly as before.
- **Custom ranges** (any two dates, or This/Last Month) can't use pre-computed
  tabs, so the dashboard calls the Apps Script **live** as a Web App. The script
  queries GA4 / Meta / Google Ads for that exact range and returns the data as
  JSON — nothing is written to the sheet. A custom load takes ~20–40 seconds.

This setup just deploys the script as a Web App and pastes its URL into the
dashboard.

## Step 1 — Re-paste the Apps Script

The custom-range code lives in `apps_script_dashboard_filler.gs`. If you haven't
already, re-paste the latest version into the **"Fitasy Dashboard Filler"**
project at script.google.com and **Save**.

Optional sanity check: function dropdown → **`testCustomReport`** → ▶ Run. The
log should end with `Captured tabs: Campaigns, KPIs, OvpSummary, ...`.

## Step 2 — Deploy as a Web App

1. In the Apps Script editor, top right → **Deploy** → **New deployment**.
2. Click the gear next to "Select type" → choose **Web app**.
3. Configure:
   - **Description:** `Fitasy dashboard custom range`
   - **Execute as:** **Me** (so it runs with your GA4 / Ads / Meta access)
   - **Who has access:** **Anyone**
     *(The dashboard is a public page with no login, so the endpoint must be
     reachable anonymously. It is read-only — it only returns analytics numbers,
     never changes anything. This matches the dashboard's existing public
     posture.)*
4. **Deploy** → authorize if prompted → **copy the Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfy.....X/exec`

## Step 3 — Paste the URL into the dashboard

1. Open `dashboard.html`.
2. Near the top of the `<script>` block, find:
   ```js
   const WEBAPP_URL = 'PASTE_WEB_APP_EXEC_URL_HERE';
   ```
3. Replace the placeholder with your `/exec` URL from Step 2. Save.
4. Push the change so Netlify redeploys (`git commit` + `git push`, or however
   you've been updating the live site).

## Step 4 — Test

On the live dashboard:
- Click **This Month** or **Last Month** — should load in ~20–40s and the status
  pill shows `Live · This Month`.
- Click **Custom ▾**, pick a start and end date, click **Apply**.
- Click **30 Days** — should snap back to instant preset mode.

---

## Updating the script later

When you change `apps_script_dashboard_filler.gs`, the **existing** Web App
deployment keeps serving the **old** code until you redeploy. To publish changes:
**Deploy → Manage deployments → (edit, the pencil) → Version: New version →
Deploy.** The `/exec` URL stays the same, so you don't need to touch
`dashboard.html` again.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Status: "web app URL not configured" | `WEBAPP_URL` still the placeholder | Redo Step 3 |
| Status: "Custom range failed — HTTP 401/403" | Deployment access isn't "Anyone" | Redeploy with **Who has access: Anyone** |
| Custom load hangs forever | Script error mid-run | Apps Script → Executions tab → check the latest `doGet` run |
| "No data for the selected range" | No GA4/ads activity in that window | Expected for empty ranges; try a wider range |
| Changes to the script don't show up | Web App still serving old version | Redeploy a **New version** (see above) |
</content>
