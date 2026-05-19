# Meta Marketing API — Getting a System User Access Token

You've granted `kevin.wu@fitasy.ai` access to Fitasy's Meta Business Manager. The last step is generating a long-lived API token so the Apps Script can pull Meta Ads data daily. ~10 minutes one-time.

## Step 1 — Find your Ad Account ID (~30 sec)

1. Go to **business.facebook.com** → switch to Fitasy's Business Manager (top-left dropdown)
2. **Settings** (⚙ icon, left sidebar) → **Accounts** → **Ad accounts**
3. Click on the Fitasy ad account → copy the **Account ID** at the top
4. It looks like `123456789012345`. You'll prefix it with `act_` later → `act_123456789012345`

## Step 2 — Create a System User (~3 min)

System users are the recommended way to give programmatic access without tying tokens to a personal account that might leave.

1. Business Manager → **Settings** → **Users** → **System users**
2. Click **Add** → name it `Fitasy Dashboard Reader`, role **Employee**, click **Create**
3. On the new system user's row, click **Add assets** → **Ad accounts** → pick the Fitasy ad account → toggle **View performance** on → Save

## Step 3 — Generate the token (~3 min)

1. Still on the system user → click **Generate New Token** button
2. App: select any app from your Business (or create a generic one called "Fitasy Internal" if none exist — Settings → Apps → Add)
3. Token expiration: **Never** (system user tokens are long-lived)
4. Permissions to check:
   - `ads_read` ✅
   - `business_management` ✅
5. Click **Generate Token**
6. **COPY THE TOKEN IMMEDIATELY** — Meta only shows it once. Looks like `EAAxxxxxxxx...` (very long)

## Step 4 — Paste both into Apps Script (~1 min)

1. **script.google.com** → your "Fitasy Dashboard Filler" project
2. ⚙ **Project Settings** (gear icon, left sidebar)
3. Scroll to **Script properties** → click **Edit script properties**
4. Add two properties:
   | Property | Value |
   |---|---|
   | `META_TOKEN` | the long `EAA...` string from Step 3 |
   | `META_AD_ACCOUNT_ID` | `act_` followed by your account ID from Step 1 |
5. Save

## Step 5 — Test (~30 sec)

1. Back in the script editor → function dropdown → `pullAll` → ▶ Run
2. Watch the execution log — should see `✓ MetaKpis_7d: wrote 4 rows`, etc.
3. Refresh `bright-truffle-d520e5.netlify.app` — the Paid Meta KPI row should fill in with real spend, ROAS, purchases, CTR

## Troubleshooting

- **"Invalid OAuth access token"** → token expired or wrong format. Regenerate.
- **"Insufficient permissions"** → in Step 2, the system user wasn't granted access to the ad account, or the token in Step 3 didn't include `ads_read`. Recheck both.
- **"User request limit reached"** → Meta rate-limited the account. Wait 1 hour and re-run.

## Once it's working

The Meta KPI cards on the dashboard will show:
- **Spend** — Meta ad spend in your reporting period (matches Protean's monthly PDF figure)
- **ROAS** — Purchase ROAS (revenue / spend)
- **Purchases** — count of purchase events attributed to Meta
- **CTR** — average click-through rate across all active ads

For the **Active Creatives** section to populate, we'd need additional API calls to `adcreatives` endpoint. That's a follow-up — let me know once you've verified the KPI cards are populating and I'll add it.
