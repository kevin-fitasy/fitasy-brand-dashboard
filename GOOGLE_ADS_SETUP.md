# Google Ads → Dashboard Setup

**Goal:** pull Google Ads campaign metrics into the Fitasy dashboard.
**Time:** ~10 minutes (plus possible developer-token approval wait).

## Why this approach

The Fitasy Google Ads account doesn't have the in-account **Scripts** feature
(Tools menu only shows Conversions + Measurement — no "Bulk actions / Scripts").
So instead of a separate Google Ads Script, the existing **Apps Script**
(`apps_script_dashboard_filler.gs`) now calls the **Google Ads API** directly,
in the same hourly run that already pulls GA4, Meta, and Klaviyo.

The connector is `pullGoogleAdsCampaigns()`. It writes the **Campaigns** tab and
fills the four Google Ads KPI rows (Cost / order, Avg. CPC, Google Ads cost,
Google ROAS). It is **read-only** — it can't change campaigns or spend.

`google_ads_script.gs` in this folder is now obsolete and can be ignored.

---

## Step 1 — Get a Google Ads developer token

1. Sign in to **ads.google.com** with the Fitasy account.
2. Top right → **Admin** (gear) → **API Center**.
   (If you don't see API Center, you're likely in a non-manager account — see
   the note on manager accounts at the bottom.)
3. Accept the API Terms if prompted. Copy the **Developer token**.
   - A brand-new token starts with **Test Account** access — that can only query
     test accounts, not the live one. Apply for **Basic access** on the same page
     (a short form: describe the use as "internal reporting dashboard,
     read-only"). Basic access is usually granted quickly.
   - If the token already shows **Basic** access, you're set.

## Step 2 — Add the Ads API OAuth scope to the script

1. **script.google.com** → open the **"Fitasy Dashboard Filler"** project.
2. Left sidebar → ⚙ **Project Settings** → tick **"Show 'appsscript.json'
   manifest file in editor"**.
3. Back in the **Editor**, open **`appsscript.json`**. Add an `oauthScopes`
   array containing the Ads scope (merge it in if the key already exists):

   ```json
   {
     "oauthScopes": [
       "https://www.googleapis.com/auth/adwords",
       "https://www.googleapis.com/auth/spreadsheets",
       "https://www.googleapis.com/auth/script.external_request",
       "https://www.googleapis.com/auth/analytics.readonly"
     ]
   }
   ```

   Keep any other top-level keys (`timeZone`, `dependencies`, etc.) as they are —
   only add/extend `oauthScopes`. Save.

## Step 3 — Add the Script Properties

1. Project Settings (⚙) → scroll to **Script properties** → **Edit script
   properties** → **Add script property**:

   | Property | Value |
   |---|---|
   | `GOOGLE_ADS_DEVELOPER_TOKEN` | the token from Step 1 |
   | `GOOGLE_ADS_CUSTOMER_ID` | `7448767442` — the Fitasy Ads account ID, **digits only, no dashes** |
   | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | *(only if accessed via a manager account)* the MCC ID, digits only |

2. **Save.**

## Step 4 — Run and authorize

1. In the editor, function dropdown → **`pullAll`** → ▶ **Run**.
2. Re-authorize when prompted — the new `adwords` scope means Google will ask
   for consent again. Approve it.
3. Check the execution log for:

   ```
   pullGoogleAdsCampaigns: wrote N campaign rows (30d spend $X, Y conversions)
   ```

4. If you see that, it's done. The dashboard's **Campaign Performance** section
   and the four Google KPI cards fill in on the next page refresh.

---

## Troubleshooting

| Log message | Cause | Fix |
|---|---|---|
| `skipped (... not set in Script Properties)` | Properties missing | Redo Step 3 |
| HTTP 401 / `invalid authentication` | Scope not authorized | Redo Step 2, re-run, re-approve consent |
| HTTP 403 / `DEVELOPER_TOKEN_NOT_APPROVED` | Token still Test-access | Apply for Basic access (Step 1) |
| HTTP 403 / `USER_PERMISSION_DENIED` | Wrong customer ID, or account is under a manager | Check `GOOGLE_ADS_CUSTOMER_ID`; add `GOOGLE_ADS_LOGIN_CUSTOMER_ID` |
| HTTP 404 | Customer ID has dashes / wrong number | Use digits only |
| `0 campaign rows` | Account has no spend in last 30d | Expected if no ads ran |

## Note on manager (MCC) accounts

If the Fitasy account is accessed through a manager account (e.g. an agency
MCC), the developer token usually lives on the **manager** account. In that
case set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the manager account's ID and keep
`GOOGLE_ADS_CUSTOMER_ID` as the Fitasy account (`7448767442`). The API call
sends both — `login-customer-id` is the manager, the path customer is Fitasy.
</content>
</invoke>
