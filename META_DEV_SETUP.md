# Meta Marketing API Setup — Developer Instructions

**For:** Fitasy's developer
**Goal:** Generate a long-lived (non-expiring) Meta System User access token with `ads_read` scope so an automated script can pull Meta Ads metrics (spend, ROAS, purchases, CTR, active creatives) into the Fitasy brand dashboard.
**Time:** ~15 minutes
**Requested by:** Kevin Wu (kevin.wu@fitasy.ai)

---

## Context (what this is for)

We've built an internal brand-performance dashboard (live at `bright-truffle-d520e5.netlify.app`). It's fed by a Google Apps Script that pulls from GA4, Google Ads, and Klaviyo every hour. The last missing data source is **Meta Ads**.

The Apps Script already has the Meta connector code written (`pullMeta()` + `pullMetaCreatives()` in `apps_script_dashboard_filler.gs`). It just needs two credentials dropped into Script Properties:
- `META_TOKEN` — a System User access token
- `META_AD_ACCOUNT_ID` — the Fitasy ad account ID, formatted `act_XXXXXXXXX`

Kevin hit a wall doing this himself: his personal Facebook account is gated from `developers.facebook.com`. A developer account should sail through.

---

## What you need access to

1. **Fitasy's Meta Business Manager** — Business ID `587178113993011`. Ask Kevin to add you as an **Admin** (Business Settings → Users → People → Add). You need Admin, not Employee, to manage system users and apps.
2. **A registered Meta developer account** — your own personal FB account, registered at developers.facebook.com (instructions below).

---

## Known facts about Fitasy's setup (saves you discovery time)

- There is already a System User in the BM named **"Conversions API System User"**, ID `61586264168283`. You can reuse it OR create a fresh one named `Fitasy Dashboard Reader` — your call. Reusing is fine.
- The ad account that runs Fitasy's paid Meta campaigns is managed by their agency **Protean Digital**. Confirm with Kevin which ad account ID is the live one — it should be visible under Business Settings → Accounts → Ad accounts.
- If the live ad account is owned by Protean's BM (not Fitasy's), you have two choices:
  - (a) Ask Protean to share API access / generate the token from their side, or
  - (b) Have Protean grant Fitasy's BM partner-access to the ad account, then proceed below.

---

## Step 1 — Register as a Meta developer

1. Go to **developers.facebook.com**
2. Top-right → **Get Started** (or **Log In** if you already have a dev account)
3. Accept the Meta Platform Terms + Developer Policies
4. Complete phone/email verification if prompted
5. You should land on the **My Apps** dashboard

---

## Step 2 — Create (or identify) the Meta App

If Fitasy already has a suitable Business-type app, use it. Otherwise create one:

1. **developers.facebook.com/apps** → **Create App**
2. Use case: **Other** → Next
3. App type: **Business** → Next
4. Details:
   - App name: `Fitasy Dashboard`
   - Contact email: `kevin.wu@fitasy.ai`
   - Business portfolio: **Fitasy Inc.**
5. **Create app**
6. In the new app's left sidebar → **Add Product** → find **Marketing API** → **Set up**

Note the **App ID** (visible in the app's Settings → Basic) — you'll need it implicitly during token generation.

---

## Step 3 — Add the System User as a Developer on the app

This is the step that fixes the "No permissions available" error Kevin kept hitting.

1. In the app dashboard → left sidebar → **App Roles** → **Roles**
2. Find the **"System Users"** subsection (separate from the regular people-roles list)
3. Click **Add System User**
4. Select `Conversions API System User` (or your newly created one)
5. Role: **Developer** (Admin also works)
6. **Save changes**

---

## Step 4 — Assign the Ad Account to the System User

1. **business.facebook.com** → Business Settings → Users → **System users**
2. Select the system user
3. **Assign assets** → **Ad accounts** → select Fitasy's live ad account
4. Enable **View performance** permission (read-only is sufficient and safer)
5. Save

While you're here: also **Assign assets → Apps →** select the `Fitasy Dashboard` app, enable Develop/Manage. (Belt-and-suspenders with Step 3.)

---

## Step 5 — Generate the token

1. Still on the system user's page → **Generate New Token**
2. **Select app:** `Fitasy Dashboard`
3. **Token expiration:** **Never** ← critical — System User tokens are non-expiring, which means no 60-day refresh cycle
4. **Assign permissions:** the permissions list should now populate (it was empty before because of the missing Step 3). Check:
   - ✅ `ads_read`
   - ✅ `business_management`
   - ✅ `pages_read_engagement` ← needed for FB Page follower count + growth
   - ✅ `pages_show_list`         ← needed to read the Page asset
   - ✅ `instagram_basic`         ← needed for the IG account + follower count
   - ✅ `instagram_manage_insights` ← needed for IG follower growth over a date range
   - Leave everything else unchecked (least-privilege)
5. **Generate Token**
6. **Copy the token immediately** — Meta shows it exactly once. It's a long string starting with `EAA...`

---

## Step 6 — Get the Ad Account ID and Page ID

1. business.facebook.com → Business Settings → Accounts → **Ad accounts**
2. Click the Fitasy ad account → copy the numeric **Account ID** (e.g. `123456789012345`)
3. The script needs it prefixed: `act_123456789012345`
4. Then Business Settings → Accounts → **Pages** → click the Fitasy Facebook Page → copy the numeric **Page ID** (e.g. `987654321098765`). No prefix.

## Step 6b — Assign the Page to the System User

Just like Step 4 did for the ad account, the system user needs explicit access to the Page asset:

1. Business Settings → Users → **System users** → select the system user
2. **Assign assets** → **Pages** → tick the Fitasy Page → enable **View performance**
3. Save

If the Instagram account is **linked to that Page** (the normal setup for a business IG account), no separate step is needed — the IG follower endpoints will work through the Page permissions. If IG is unlinked, link it: business.facebook.com → Business Settings → Accounts → **Instagram accounts** → connect Fitasy's IG → assign it to the same Page.

---

## Step 7 — Hand the credentials back securely

**Do NOT send the token over plain Slack/email.** Use a password manager share (1Password, Bitwarden), or paste it directly into the destination yourself (Step 8) if Kevin gives you temporary access to the Apps Script project.

You need to deliver three values:
| Key | Value |
|---|---|
| `META_TOKEN` | the `EAA...` string from Step 5 |
| `META_AD_ACCOUNT_ID` | `act_` + the number from Step 6 |
| `META_FB_PAGE_ID` | the digits-only Page ID from Step 6 (no prefix) |

---

## Step 8 — Where the credentials go (whoever has Apps Script access)

1. **script.google.com** → open the **"Fitasy Dashboard Filler"** project
2. Left sidebar → ⚙ **Project Settings**
3. Scroll to **Script properties** → **Edit script properties** → **Add script property**:
   - Property: `META_TOKEN` — Value: the token
   - Property: `META_AD_ACCOUNT_ID` — Value: `act_...`
   - Property: `META_FB_PAGE_ID` — Value: the Page ID (digits only)
4. **Save**
5. In the editor, function dropdown → `pullAll` → ▶ **Run**
6. Check the execution log for:
   ```
   ✓ MetaKpis_30d: wrote 4 rows
   pullMetaCreatives: wrote N active creatives
   ```
7. If you see those, it's done — the dashboard will show Meta data within the hour (or immediately on next page refresh).

---

## Verification

After Step 8, open `bright-truffle-d520e5.netlify.app`:
- The **"Paid Meta"** KPI row (Spend / ROAS / Purchases / CTR) should show real numbers instead of "—"
- The **Active Creatives** section should show thumbnails of currently-running Meta ads

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No permissions available" at token step | System user isn't a Developer on the app | Redo Step 3 |
| "Invalid OAuth access token" in script log | Token wrong/expired | Regenerate (Step 5) |
| "Unsupported get request" / object ID error | Wrong ad account ID or missing `act_` prefix | Recheck Step 6 |
| "(#200) Requires ads_read permission" | Token generated without `ads_read` | Regenerate, check the box (Step 5.4) |
| Empty data but no error | Ad account has no spend in the lookback window, or wrong account | Confirm the live ad account ID with Protean |

---

## Security notes

- The token grants **read-only** access to ad performance data — it cannot spend money, change campaigns, or post anything.
- System User tokens don't expire, so this is a one-time setup. If the system user is ever deleted, the token dies with it.
- If the token is ever leaked, revoke it: business.facebook.com → System users → select user → **Revoke tokens**, then regenerate.

---

## Questions

Ping Kevin (kevin.wu@fitasy.ai). The dashboard codebase is at github.com/kevin-fitasy/fitasy-brand-dashboard — the Meta connector is `pullMeta()` and `pullMetaCreatives()` in `apps_script_dashboard_filler.gs` if you want to see exactly what the token will be used for.
