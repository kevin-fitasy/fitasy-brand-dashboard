# Handoff — Looker Studio Build Status

**Date:** 2026-05-15 (updated 2026-05-17)

## ✅ Resolved: GA4 data source mismatch (the saga)

What looked like "tag not installed" turned out to be a **three-property mess**. The diagnosis:

1. **`Fitasy Web`** (Measurement ID `G-ZPFD17FTYZ`, property 497196325) — under kevin.wu@fitasy.ai. EMPTY, never tagged.
2. **`fitasy.ai`** (Measurement ID `G-1JXH3ZBPKL`, property 479271588) — under kevinshenhao@gmail.com / "Google Ads Account". EMPTY.
3. **`fitasy-4e9cc`** (Measurement ID `G-L09ZBD8ZD1`, property 461873881) — under fitasydevelop@gmail.com / "Default Account for Firebase". **THIS IS THE REAL ONE.** Has 2.5K active users last 7d, 17K events, fully tracked e-commerce (add_to_cart, begin_checkout, view_item, etc.). Co-admin = media-manager@proteandigital.io (Protean Digital).

The Shopify Google & YouTube app is correctly firing tags to `fitasy-4e9cc`. The other two properties exist as orphans.

**Actions taken:**
- Signed fitasydevelop@gmail.com into Chrome
- Added `kevin.wu@fitasy.ai` as **Administrator** on the fitasy-4e9cc property (GA4 admin → Property access management)
- Edited the Looker Studio data source connection → swapped property from `Fitasy Web` to `fitasy-4e9cc` (kept the data source named "Fitasy Web" in Looker Studio; rename it later if you want clarity)
- **Verified:** Active users scorecard renders **8.3k** (Last 28 days excl today)

## 🧹 Cleanup suggestion (optional, do later)

You have two orphan empty GA4 properties — `Fitasy Web` (G-ZPFD17FTYZ) and `fitasy.ai` (G-1JXH3ZBPKL). They risk future confusion (someone could connect ads or downstream tools to the wrong one). Consider deleting both via GA4 → Admin → Property details → Move to Trash. Keep only `fitasy-4e9cc`.



---

## Reference dashboards (Protean Digital)

These two shared links are the visual + structural inspiration for the build:

- **Meta Ads | Fitasy** — https://dashboard.proteandigital.io/shared/24CYPi2DFGjgybzBm9/ipsh44mahBCuqsaAC/project/v/QCzbh9kdiy77rcirj
- **Google Ads | Fitasy** — https://dashboard.proteandigital.io/shared/24CYPi2DFGjgybzBm9/ipsh44mahBCuqsaAC/project/v/ND5NKGzwCmNgqrqc3

**Style Protean uses (worth mirroring later via Page → Theme):**
- Dark theme (near-black background, slightly lighter card surfaces)
- Big white sans-serif KPI numbers, small grey labels
- "Last 60 Days" / "Last 30 Days" date pill top-right
- Per-section title above each row ("Main KPIs", "Spend vs Revenue", "Campaign Breakdown")
- Lime-green for spend/revenue area charts

**Protean's campaign naming convention** (visible in their Meta Ads breakdown — adopt this for filters to work):
`PD | Fitasy | {Pillar} | {ABO|CBO}` — pillars include Stride 1.0, Pillar Testing, Eco, Tech, Style/Confidence Redefined, Custom Fit/Precision Fit

**Reference numbers from Protean (validates our build is reading the right account):**
- Google Ads Last 30d: Cost $5,542.65 · Revenue $1,482 · ROAS 0.27 · 8 purchases → Our Looker Studio (Last 28d): Cost $5,325.85 · Revenue $1,482 · ROAS 0.28 · 8 conversions ✓ **matches**
- Meta Ads Last 60d: Spend $11,853.92 · Revenue $3,767.50 · ROAS 0.32

## ✅ What's built (as of 2026-05-17, third pass)

### Looker Studio report
- **URL (edit):** https://datastudio.google.com/u/1/reporting/272fecc3-e1a5-47bb-8e1a-b973be08bcd4/page/rqHyF/edit
- **URL (view-only):** https://datastudio.google.com/u/1/reporting/272fecc3-e1a5-47bb-8e1a-b973be08bcd4
- **Owner:** kevin.wu@fitasy.ai
- **Data source:** GA4 — `fitasy-4e9cc` (property 461873881, the REAL one with traffic)
- **Sharing:** Restricted to owner. Open Share dialog to add team members.

### Page 1 — Pulse (GA4 data, both pages share global filter)

| Widget | Value | Notes |
|---|---|---|
| Date range control | Last 28 days excl today | Page-level filter, all widgets respect it |
| Active users (scorecard) | **8,300** | unique users |
| Engaged sessions (scorecard) | **9,307** | sessions w/ engagement >10s or 2+ events |
| Engagement rate (scorecard) | **86.60%** | very strong signal |
| Purchase revenue (scorecard) | **$5,062.50** | from GA4 purchase events |
| Transactions (scorecard) | **28** | implied AOV $180 — higher than Shopify's $82, GA4 likely counts line-items not orders |
| Sessions by Source/Medium (table) | 63 rows | google/cpc leads (5,254 = 57%), Meta/Paid Social 2,672 (29%), direct 510, ig/social 185, google/organic 227 |
| Top landing pages (table) | 44 rows | homepage + Stride PDPs + checkout pages |

### Page 3 — Organic vs Paid (new, this round)

Single table breaking down all GA4 channels by Sessions / Revenue / Transactions. Date range respects page 1's Last 28d filter.

| Channel | Sessions | Revenue | Transactions | $/session | CVR |
|---|---|---|---|---|---|
| Paid Social (Meta) | 2,726 | $2,050 | 10 | $0.75 | 0.37% |
| Cross-network (PMax) | 3,274 | $381 | 2 | $0.12 | 0.06% |
| Paid Shopping | 1,487 | $180 | 1 | $0.12 | 0.07% |
| Paid Search | 566 | $0 | 0 | $0.00 | 0.00% |
| **Paid subtotal** | **8,053** | **$2,611** | **13** | **$0.32** | **0.16%** |
| Direct | 510 | $2,050 | **13** | **$4.02** | **2.55%** |
| Organic Search | 267 | $401 | 2 | $1.50 | 0.75% |
| Organic Social | 263 | $0 | 0 | $0.00 | 0.00% |
| Referral | 103 | $0 | 0 | $0.00 | 0.00% |
| **Non-paid subtotal** | **1,143** | **$2,451** | **15** | **$2.14** | **1.31%** |

**This changes the strategic story:**
- Direct + Organic = **15 transactions from 14% of sessions**
- Paid = **13 transactions from 86% of sessions**
- Non-paid CVR is **8× higher** than paid CVR
- Caveat: GA4 attributes last-non-direct click — so some "Direct" likely includes paid-influenced traffic that converted later. Worth a deeper attribution conversation (think MMM or a GA4 attribution model report).

**Updated blended ROAS calculation:** $5,063 GA4 revenue ÷ $5,326 Google Ads spend = **0.95** on Google alone. Add Meta spend (~$5,900 in the same 28d window, extrapolated from Protean's 60d $11,854) and blended ROAS drops to ~$5,063 / ~$11,200 = **0.45**. Paid media is paying for ~$2,611 of revenue at a cost of ~$11,200 — direct ROAS on paid channels alone is ~0.23.

### Page 2 — Google Ads (mirroring Protean's "Main KPIs" structure)

Data source: Google Ads → Fitasy Inc. (744-876-7442) → Overall Account Fields. Connected via kevin.wu@fitasy.ai OAuth (had access already because of GA4 linked-account roles).

| Widget | Value | vs. Protean |
|---|---|---|
| Cost (scorecard) | **$5,325.85** | $5,542.65 (date-window delta) |
| Impressions (scorecard) | **303,978** | 305,670 ✓ |
| Clicks (scorecard) | **6,062** | 6,137 ✓ |
| Conversions (scorecard) | **8** | 8 ✓ exact |
| Conv. value (scorecard) | **1,482** | $1,482 ✓ exact |
| Conv. value / cost ROAS (scorecard) | **0.28** | 0.27 ✓ |
| Campaign breakdown (table) | 9 campaigns w/ Cost | — |

**Top Google Ads spend (Last 28d):** Search NB $2,483 · PMax PILLARS $1,755 · Shopping $995 · Demand Gen $93 · everything else $0. Three campaigns = 98% of spend.

### Page 4 — Page Engagement (new this round)

Single page-level engagement table from GA4. Date range respects Last 28d filter.

| Page path | Views | User engagement time (cumulative) |
|---|---|---|
| /products/stride-2-3d-printed-sneakers | 6,904 | 19h 01m |
| /products/stride-3d-printed-sneaker-custom-fit | 5,364 | 16h 38m |
| / (homepage) | 3,148 | 11h 41m |
| /pages/medical | 429 | 4h 19m |
| /collections/all-products | 421 | 1h 52m |
| /cart | 354 | 1h 26m |
| /pages/about-us | 329 | 1h 52m |
| /pages/contact | 173 | 1h 18m |
| ... | (137 unique paths) | |

**Observations:**
- /pages/medical has 429 views but **4h 19m** total engagement (~36 sec/view average). That's the most engaged-per-view page on the site — the medical/adaptive use case is resonating.
- Stride 2.0 PDP has 6,904 views but only ~10 sec/view average engagement. People are looking and bouncing.
- /pages/about-us 329 views / ~1h 52m = ~20 sec/view — decent.
- Purchase revenue at page level is mostly $0 because GA4 only attributes purchase events to /cart or /thank-you pages. Page-level revenue attribution requires multi-touch attribution config (separate project).

### Page 2 — Google Ads (rebuilt with new Ad Group breakdown)

6 KPI scorecards (Cost $5,326 · Impressions 304K · Clicks 6,062 · Conversions 8 · All conv. value $20.1K · ROAS 0.28) + Ad Group breakdown table.

**Top 8 ad groups by spend (Last 28d):**
| Ad group | Cost |
|---|---|
| Custom-Fit-Shoes | $1,327 |
| Standard Sizes | $995 |
| Custom Insoles x Orthotics | $657 |
| Orthotic Shoes | $287 |
| UGC Style - For Shorts | $93 |
| Competitor - Zellerfeld | $93 |
| Healthcare_Shoes | $67 |
| Amputees x prosthetics | $51 |
| ... (28 total ad groups) | |

**What this reveals:** Of $5,326 Google spend, $3,266 (61%) is concentrated in 4 ad groups around custom-fit / orthotics. The Custom-Fit-Shoes ad group alone = 25% of all Google spend. Worth a deeper look at which of these ad groups actually drove the 8 conversions and $1,482 revenue — add a Conversions column to the table to find out (one drag to add).

**Note:** The "All conv. value" scorecard reads $20.1K (includes view-through + all conversion types) vs the original "Purchase conv. value" of $1,482. If you want the original purchase-only number back, click the scorecard, change metric from "All conv. value (by conv. date)" to "Conv. value (by conv. date)".

### Page name housekeeping
Pages still render as "Untitled page" in the page list. To rename: open the Pages panel (left edge button), hover over a page row, click the three-dot menu → Rename. Suggested: Page 1 → "Pulse", Page 2 → "Google Ads", Page 3 → "Organic vs Paid", Page 4 → "Page Engagement".

---

## ✅ Round 5 results (this session)

### Sentiment auto-pull system — LIVE
- **Google Sheet:** `Fitasy Brand Mentions` (under kevin.wu@fitasy.ai, [open](https://docs.google.com/spreadsheets/d/1ZFbYEVWnZP0c1bWLMIKoN1F8ujhnADNyTHkYmDkcvpQ/edit))
- **Mentions tab populated** with ~28 entries from Google News + Hacker News (Reddit returned no Fitasy posts this run)
- **First headline scan:** **4 positive · 23 neutral · 0 negative** — no negative online sentiment detected for Fitasy
- **Apps Script + hourly trigger active.** Pulls from Google News RSS + Reddit JSON + Hacker News Algolia API every hour. Dedupes by URL. Tags sentiment via positive/negative keyword lists.
- **Page 5 (Sentiment Monitoring)** in Looker Studio — Sentiment breakdown table connected to the Mentions sheet. Auto-refreshes when the sheet updates.

## 🚧 Round 6 — partial consolidation + critical Meta finding

### Sentiment cleanup — DONE
Ran `cleanRelevance()` successfully: **kept 8 of 27 mentions, removed 19 irrelevant entries** (Fitsync/Fitalytic/AmigaOS noise). The Mentions sheet is now clean and future hourly fetches will use the v2 filter.

### Interactive charts added on Page 5
Started transitioning Page 5 toward a Protean-style consolidated view:
- **Area chart** — Mentions over time, color-coded by sentiment (neutral vs positive)
- **Donut chart** — Sentiment breakdown: **75% neutral · 25% positive**

These are the first two interactive charts in the dashboard. They're live and respond to date filters.

### 🚨 Meta Ads access — CRITICAL BLOCKER FOUND
Tried to add Meta Ads via Supermetrics now that you've activated the trial. The connector worked and showed all Meta ad accounts kevin.wu@fitasy.ai has access to. The list was:

| Account | Status |
|---|---|
| Kevin Wu (act_1856485968464250) | Active (personal account, likely no Fitasy ads) |
| **Fitasy Inc Ad Account** | **CLOSED** ⚠️ |
| CLOSED: Kevin Wu | Closed |
| CLOSED: Kevin Wu (act_1475367346753678) | Closed |

**Implication:** Protean Digital is running Meta ads ($11,854 in 60 days per their report) but on a **Meta Business Manager that kevin.wu@fitasy.ai is NOT a member of** — likely a Business Manager owned by Protean themselves, or by `fitasydevelop@gmail.com`. You can verify by:
- Asking Protean directly which Business Manager + Ad Account ID runs Fitasy's Meta ads
- Then have whoever owns that BM grant kevin.wu@fitasy.ai access via business.facebook.com → Users → Add People

Once granted, the Supermetrics connector will pick up the active Fitasy ad account and we can build the Meta Ads section.

### 1-page consolidation — partial
You asked for everything on one page like Protean's view. **What I've started:** Page 5 is being repositioned as the consolidated view (sentiment chart + donut + page engagement table + sentiment table). **What's still needed for the full consolidated view:**
- KPI scorecards row at the top (Active users, Sessions, Revenue, Transactions, Google Cost, Google ROAS)
- Sessions-over-time area chart (GA4)
- Sessions by channel donut (GA4)
- Top campaigns table (Google Ads)
- Top page engagement table (already there)
- Top mentions detail table

Building these via UI click-automation in Looker Studio is slow and fragile (each chart is ~30s of clicks). Realistic estimate: 20-30 minutes of additional clicks to finish. **Faster path:** since the pattern is established (KPI scorecards on Pages 1-2-3, channel breakdown on Page 3, page engagement on Page 4), you (or a team member) can replicate them onto Page 5 by following the existing examples — it's ~5 drag operations per chart.

### Script v2 — relevance filter added (this round)

Upgraded the Apps Script with two new safeguards:
1. **`isRelevant(text)`** — requires the text to contain "Fitasy" as a standalone word (regex `\bfitasy\b`, case-insensitive), AND not contain any blocklist keyword
2. **Blocklist:** `fantasy`, `fitsync`, `fitalytic`, `fitbit`, `amiga`, `account takeover`, `cracking`, `hacking`, `venture pimp`, `crypto`, `blockchain`, `nft`
3. **Google News query upgraded** to exact-phrase search (`"Fitasy"`) — narrows results at the source
4. **`cleanRelevance()` function** added — one-shot scrubber that re-filters existing rows in the sheet against the new logic

**Status:** script v2 saved to Drive. The hourly fetchMentions trigger will now filter every run. The one-shot `cleanRelevance` was triggered but the Apps Script editor hung mid-run (likely an OAuth re-prompt for the script's expanded permissions). To finish:
- Open https://script.google.com/u/1/home/projects/1uFNWEOIF6fltqQ5IcNFNfEgUgAkhxejGsH2P3ThHSSIX9pGv1w1rp56k/edit
- If you see a permission prompt, click through it
- Function picker → `cleanRelevance` → Run
- The execution log will say "Kept N of M mentions. Removed X irrelevant entries."

If that's painful, you can also just open the Mentions sheet ([link](https://docs.google.com/spreadsheets/d/1ZFbYEVWnZP0c1bWLMIKoN1F8ujhnADNyTHkYmDkcvpQ/edit)) and manually delete the rows where Title contains "Fitsync", "Fitalytic", "AmigaOS", "account cracking", "Venture Pimp" etc. (about 5 rows). Future hourly fetches will be clean.

### Supermetrics — STILL BLOCKED
The Looker Studio OAuth completed, but Supermetrics requires you to **start the free trial on their Hub** before the connector works. The connector page shows "⚠️ No license". You need to:
1. Visit https://hub.supermetrics.com/looker-studio/onboarding/FA
2. Sign in with kevin.wu@fitasy.ai
3. Activate the 14-day free trial
4. Come back to Looker Studio → Resource → Manage data sources → reconnect Facebook Ads → select Fitasy Inc.'s Meta Business account

Once the license is active, I can add Meta Ads as a data source and build Page 6 (Meta Ads detail) + Page 7 (Instagram post analytics).

### Push notification status
Still failing — "Mobile push not sent (Remote Control inactive)" despite your earlier toggle. Possibly the Mac terminal isn't paired with phone. Toggle off → quit Claude app → reopen → toggle on again. Or pair via QR code in Settings.

---

## 🔄 In-flight (round 4): Supermetrics + sentiment auto-pull

**Status as of pause:**
1. **Supermetrics Facebook Ads connector** — clicked "Authorize" in Looker Studio. OAuth popup window opened (probably in a separate Chrome window outside MCP visibility). Needs you to click through Google account picker → log in to Meta/Facebook with the account that owns Fitasy's Business Manager → grant Supermetrics access. After that, I can pick the Fitasy ad account and build Page 5: Meta Ads detail.
2. **Sentiment Google Sheet + Apps Script** — created `Fitasy Brand Mentions` sheet under kevin.wu@fitasy.ai (ID `1ZFbYEVWnZP0c1bWLMIKoN1F8ujhnADNyTHkYmDkcvpQ`), pasted a script that pulls from **Google News RSS + Reddit search + Hacker News** hourly into a `Mentions` tab. Code is saved. Triggered first run → OAuth popup. Needs you to:
   - Click "Review permissions"
   - Pick kevin.wu@fitasy.ai
   - **See "Google hasn't verified this app" warning** (normal for unverified personal scripts) → click "Advanced" → "Go to Untitled project (unsafe)"
   - Grant Sheets / URL fetch / Triggers access
   
   After auth, I'll re-run `fetchMentions` to populate the sheet with initial data, then `setupTrigger` to schedule hourly.
3. **Remote Control push notifications** — toggled on by you, but pushes still aren't reaching. The push tool reports "Mobile push not sent (Remote Control inactive)". Try toggling off → quit Claude app → reopen → toggle on again, OR check that the Mac terminal and phone are linked to the same Anthropic account.

**Script details (so you know what's running):**
- **Sources pulled hourly:**
  - Google News RSS for "Fitasy"
  - Reddit search for "Fitasy" (latest 25 posts)
  - Hacker News (Algolia API) for "Fitasy" stories
- **Sentiment scoring:** simple keyword match against positive (love/great/awesome/etc.) and negative (bad/scam/refund/etc.) word lists. Each mention tagged positive/negative/neutral.
- **Output columns:** Date | Source | Title | URL | Sentiment | Engagement | Snippet
- **Dedupe:** by URL — same mention won't be added twice
- **Cost:** $0/mo (all free APIs). Limitations: misses Instagram/Twitter (paid API required), can't see private DMs/comments, basic keyword sentiment misses sarcasm.

---

## 🚦 Decisions blocking the next wave (when you have a minute)

The latest ask (Meta ads detail, Instagram post analytics, online sentiment) crosses data sources we don't yet have connected. Three decisions:

### Decision 1: Supermetrics 14-day free trial?
- Cost: free 14 days, then ~$79/mo (Essential plan) or ~$149/mo (Core)
- Unblocks: Meta Ads detail (campaign/ad-set/ad level), Instagram post analytics, Klaviyo email data — all from one connector
- Alternative: manually paste numbers from Protean's PDFs into a Google Sheet weekly (~30 min/week of labor)
- Sign-up flow: lookerstudio.google.com → Add data → search "Supermetrics" → 14-day trial starts on first connect

### Decision 2: Sentiment monitoring tool?
- **Brand24** (~$99/mo) — best price/feature ratio, web + social mention tracking with sentiment scoring
- **Mention.com** (~$83/mo) — similar feature set, slightly cheaper, marginally less polish
- **Sprout Social** (~$249/mo) — enterprise; overkill at Fitasy's stage
- **Manual** (free) — Google Alerts + a Sheet, you tag sentiment by hand weekly; works but ~1h/week of labor and misses social platforms

### Decision 3: Enable Remote Control on your phone for push notifications
- Open Claude app on phone → Settings → Remote Control → toggle on
- Then I can ping you on the go when I need a decision (instead of queueing it in chat)



## 🔥 Findings worth a real conversation

### 1. Paid drives traffic but Direct + Organic drive conversions
Sessions are 86% paid (8,053 of 9,196). But TRANSACTIONS are 54% non-paid (15 of 28). **Non-paid CVR = 1.31% vs Paid CVR = 0.16% — non-paid converts 8× better.** See Page 3 table for the full breakdown by channel group.

If you shut paid down tomorrow, traffic crashes ~86%, but you'd only lose ~46% of transactions. The math implies paid spend may largely be funding awareness for visitors who eventually convert via Direct (last-non-direct attribution rewards the second-to-last touch). Worth running GA4's attribution comparison report to confirm.

### 2. Both paid channels are bleeding money right now
| Channel | Spend (period) | Revenue | ROAS |
|---|---|---|---|
| Google Ads (Last 28d) | $5,326 | $1,482 | **0.28** |
| Meta Ads (Last 60d, per Protean) | $11,854 | $3,768 | **0.32** |
| **Blended** | **~$17,180** | **~$5,250** | **~0.31** |

You're spending ~$3.20 to make $1. Burn rate on paid acquisition is ~$11,930 over the period (cost minus revenue, GA4-tracked only). This is fine if it's intentional learning spend (and the cohort retention data suggests product-market fit is strengthening) — but the **discount rate also being 65% on Shopify gross sales** means the underlying margin is even worse than ROAS suggests. Worth modeling true unit economics: paid CAC × discount × COGS vs. LTV.

### 3. Search NB is the spend concentration risk
$2,483 of $5,326 Google Ads spend (47%) is in one campaign ("Search | NB" — non-brand search). If that one campaign degrades, half the Google spend instantly under-performs. Worth diversifying or stress-testing.

## 🧹 Cleanup suggestion (optional, do later)

You have two orphan empty GA4 properties — `Fitasy Web` (G-ZPFD17FTYZ) and `fitasy.ai` (G-1JXH3ZBPKL). They risk future confusion (someone could connect ads or downstream tools to the wrong one). Consider deleting both via GA4 → Admin → Property details → Move to Trash. Keep only `fitasy-4e9cc`.

Also consider renaming the data source in Looker Studio from "Fitasy Web" → "Fitasy GA4 (fitasy-4e9cc)" so the source name matches the actual property.

### HTML mockup (`Brand Dashboard/dashboard.html`)
Updated with **real Fitasy numbers** pulled from your Shopify admin:
- **Page 1 (Pulse) hero band** — real WoW storyline + biggest win/concern/action
- **Page 1 KPI tiles** — Net sales $1,400 (+98%), Orders 18 (+50%), AOV $82.82 (+44%), Sessions 3,253 (−25%), CVR 0.21% (+135%), Returning customer rate 18.75% (+125%); Blended ROAS and Email rev share marked "pending — connect ads / Klaviyo"
- **Page 2 (Commerce)** — gross/net/discount KPIs, real funnel (3,253 → 63 ATC → 36 checkout → 7 web purchases), Stride 1.0 vs 2.0 product comparison, real top geos (Miami, Chicago, LA, NY, Brooklyn)
- **Page 3 (Acquisition)** — real top landing pages (Stride 2.0 PDP 1,514 sessions, Stride 1.0 PDP 780, etc.)

---

## 🔍 Surprising findings (from Shopify Last 7 Days)

These are worth investigating regardless of the dashboard:

1. **65% discount rate.** Gross sales $4,220, but discounts removed $2,729 → net $1,400. If this is intentional (launch promo), fine — but margin pressure is severe. If unintentional (over-permissioned codes), needs audit.
2. **Stride 1.0 outperforms Stride 2.0 by 6×.** Stride 1.0 generated $1,586 from 780 sessions ($2.03/session); Stride 2.0 Custom-Fit generated $578 from 1,514 sessions ($0.38/session). PDP, pricing, or stock issue on the 2.0?
3. **Sessions down 25% WoW** while orders up 50%. Conversion improving sharply but top-of-funnel slipping. Two opposing forces — worth understanding which is durable.
4. **18 orders / 7 from web funnel.** 11 of your 18 weekly orders came from non-web sources (manual orders, draft orders, retailer pipeline). Worth tracking that channel separately.
5. **Site CVR 0.21% vs ~1–3% industry benchmark.** The biggest leak is sessions → ATC (3,253 → 63 = 1.93%). Industry typical is 5–8%.

---

## 🚨 Root cause of the 0.0 (and a bigger finding)

The Sessions scorecard shows **0.0** because **GA4 has never received a single page view from your Shopify storefront**. I verified this two ways:

1. Tested an alternate metric (Active users) — also returned 0.0 → not a metric-specific bug
2. Opened GA4 directly at https://analytics.google.com/analytics/web/?authuser=1#/p497196325/ → page literally says **"No data received from your website yet."**

There is exactly one GA4 property under the Fitasy account: **Fitasy Web** (ID 497196325, Measurement ID **G-ZPFD17FTYZ**) — and it is not installed on the live store.

**This is a much bigger problem than the dashboard.** Right now:
- All your Google Ads conversion tracking is GA4-blind
- All your Meta attribution comparisons against GA4 are meaningless
- You're relying solely on Shopify's first-party numbers for attribution
- Any Looker Studio dashboard built on GA4 will be empty until tag fires

### How to fix (Shopify-specific, ~10 min)

The cleanest path on Shopify is the official **Google & YouTube** app:

1. Shopify admin → Apps → install/open "Google & YouTube" (by Google)
2. Connect your Google account (kevin.wu@fitasy.ai)
3. Connect Google Analytics → choose property "Fitasy Web" → confirm
4. Shopify auto-injects the GA4 tag site-wide and on the post-purchase page (the latter is harder to do manually and matters for revenue attribution)
5. Verify in GA4 → Realtime report after 5 min — should show your own visit
6. Wait ~24h for the daily aggregates the dashboard reads from to fill

**Alternative (manual, theme-edit):**
- Shopify admin → Online Store → Themes → Edit code → `theme.liquid`
- Paste the GA4 tag snippet just before `</head>` (use the snippet GA4 shows in the "Get tagging instructions" button)
- Less ideal because it misses the post-purchase page → checkout conversions won't track

**Once the tag is firing**, the existing Looker Studio report will populate automatically — no rebuild needed.

---

## 📋 Recommended next steps

In priority order:

### TODAY — unblock GA4 (15 min, highest leverage)
- [ ] **Install GA4 tag on Shopify** (see "How to fix" above). Without this, the dashboard, Google Ads, and any cross-channel attribution stay broken.
- [ ] Open https://analytics.google.com/analytics/web/?authuser=1#/p497196325/realtime — once tag fires, you'll see yourself in Realtime within ~30s.

### Tomorrow (after data starts flowing, ~30 min)
- [ ] Open the report — the Sessions scorecard should now show real numbers.
- [ ] **Connect Search Console.** Add data → Search Console → pick fitasy.ai property. Free, native connector. Will only have data if Search Console was previously verified for the domain.
- [ ] **Connect Google Ads.** Same flow. Free.
- [ ] **Add a global Date range control.** Toolbar → Add a control → Date range control → drop at top of page. Set default = Last 7 days (excl today). All charts on the page then respect it — no per-chart date config.
- [ ] Decide on sharing: keep restricted, share with team list, or "Anyone at fitasy.ai with the link."

### This week (~2h)
- [ ] **Build the rest of Page 1 (Pulse)** following [01_BLUEPRINT.md](01_BLUEPRINT.md): 8 KPI scorecards, hero band as a Text box, channel mix donut, revenue trend line.
- [ ] **Implement campaign naming convention** so the brand-pillar filter works: `{pillar}_{channel}_{objective}_{audience}_{date}`. Document this for whoever runs paid media (Protean Digital).

### Week 2 (~3h)
- [ ] **Decide Shopify connector.** Per [02_SETUP_GUIDE.md](02_SETUP_GUIDE.md): Supermetrics Essential ($79/mo) is the recommended call. 14-day free trial.
- [ ] **Create the 3 manual Google Sheets** (Social, Brand Mentions, GEO Score) and connect each as a data source.

### Interim option (skip if you'll install the GA4 tag today)

If GA4 can't be tagged for some reason, you can still build a useful Shopify-only dashboard right now:

1. Create a Google Sheet titled `Fitasy Shopify Daily Snapshot` with columns: `Date, Sessions, Orders, Gross Sales, Net Sales, Discounts, Returns, AOV, Top Product, Top Geo`
2. Manually paste yesterday's numbers from Shopify Analytics each morning (10 min/day) — or schedule a person to
3. In Looker Studio: Add data → Google Sheets → connect that sheet → use as the source for Page 1 KPIs
4. Drop the GA4-dependent widgets until the tag fires

This gives you a working dashboard *today* with real numbers, just one source.

---

## What I couldn't do (and why)

- **Build all 4 pages with all widgets.** Each chart in Looker Studio needs add → drag → configure (data source, dimensions, metrics, date range, style) — realistically 30s–2min per widget × ~30 widgets = 1–2 hours of pure click automation per page. Worth it for high-volume drudgery; not worth it when you can drive the wizard faster yourself once the pattern is set with one example. The blueprint + setup guide give you the pattern; the live scorecard shows the mechanics.
- **Connect Shopify.** Native Looker Studio doesn't have a Shopify connector. Requires a third-party paid connector (Supermetrics, Power My Analytics) which I shouldn't initiate a paid trial for without explicit confirmation.
- **Share more broadly.** Sharing is a permissions change — needs your call on scope (you only? team? whole org?).

---

## Files in this folder

| File | Purpose |
|---|---|
| [01_BLUEPRINT.md](01_BLUEPRINT.md) | Full dashboard spec — every page, KPI, chart, formula, filter |
| [02_SETUP_GUIDE.md](02_SETUP_GUIDE.md) | Step-by-step build guide with connector cost breakdown |
| [03_HANDOFF.md](03_HANDOFF.md) | This doc — current build status |
| [dashboard.html](dashboard.html) | Visual mockup with real Fitasy data, open in browser |

---

## Round 7 — Consolidated Page 5 (2026-05-18)

### Decision: one consolidated page
Kevin asked for a single Protean-style page rather than the multi-page structure in the blueprint. New build target: **Page 5** as the everything-on-one-canvas dashboard, with the original Pages 1–4 left as-is for reference/archive.

### Page 5 — widgets added this round

All bindings verified against live data sources. **Layout is messy** (widgets stacked/overlapping) — Kevin needs ~10 min in Looker to drag into the intended grid. Bindings are the hard part; that's done.

| Widget | Source | Metric/Dim | Live value |
|---|---|---|---|
| Active users (scorecard) | Fitasy Web | Active users | **8,593** |
| Engaged sessions (scorecard) | Fitasy Web | Engaged sessions | **9,478** |
| Purchase revenue (scorecard) | Fitasy Web | Purchase revenue | **$5,296.50** |
| E-commerce purchases (scorecard) | Fitasy Web | E-commerce purchases | rendered |
| Google Cost (scorecard) | Google Ads | Cost | **$5,572.38** |
| ROAS (scorecard) | Google Ads | Conv. value / cost | **0.33** |
| Sessions area chart | Fitasy Web | Sessions over Day, breakdown by Event name | stacked area, ~10 series (session_start, page_view, view_item, first_visit, user_engagement, scroll, form_start, add_to_cart, form_submit, …) |
| Channel mix donut | Fitasy Web | Sessions by Session source/medium | **google/cpc 51.6%**, Meta/Paid Social 28.7%, (direct)/(none), google/organic, ig/social, admin.shopify.com, etc. |
| Top campaigns table | Google Ads | Campaign × (Conversions, Cost, Clicks, Conv. value/cost) | PMax AGs-PILLARS-April26 leads ($1,844.84 / 3,452 clicks / 0.4 ROAS), then Search NB ($2,535.59 / 721 / 0.2), Shopping Only ($1,046.63 / 2,046 / 0.3) |

### Pre-existing widgets still on Page 5 (from earlier sessions)
- Sentiment area chart (over time, neutral vs positive)
- Sentiment summary table (8 mentions, neutral 6 / positive 2)
- Page engagement table (137 rows from GA4)
- Sentiment donut (75% neutral / 25% positive)

### Honest gotchas
- **Widget repositioning via UI automation is brittle.** Drag-via-screenshot was unreliable; the 6 scorecards ended up stacked at top-left because precise drags kept missing the widget body. Pattern: each scorecard's data source + metric is correctly bound — just drag them apart in Looker.
- **Sessions area chart sits on top of the page-engagement table.** Move one of them.
- **The 6 scorecards stack also sits on top of the sentiment area chart.** Move scorecards to a row above it.

### Meta Ads — still blocked
Kevin needs Protean to add him to their Meta Business Manager (Settings → Users → add `kevin.wu@fitasy.ai` as Admin or Analyst). Until then, Supermetrics Meta connector errors ("No license / no ad account access") and we can't build the Meta section of Page 5.

### Suggested Page 5 layout (when Kevin rearranges)
```
[Page title bar]
[Date range control]

Row 1 — KPI scorecards (6 across):
  Active users | Engaged sessions | Purchase revenue | E-com purchases | Google Cost | ROAS

Row 2 — Trends (50/50 split):
  Sessions area chart (by event)  |  Sentiment area chart

Row 3 — Mix (33/33/33 split):
  Channel mix donut  |  Sentiment donut  |  Sentiment table

Row 4 — Detail tables (50/50 split):
  Top campaigns table  |  Page engagement table
```

### What to do next
1. **Kevin: rearrange widgets in Looker** (~10 min). Once positioned, the page reads like Protean's reports.
2. **Kevin: ask Protean for Meta Business Manager access** (blocker for Meta section).
3. **Next session: build Meta Ads block** (cost, ROAS, top creatives) once access lands.
4. **Optional polish:** apply Fitasy theme colors via Page → Theme & layout (cream `#FFFFF6`, navy headers).

---

## Round 8 — Protean layout + Organic vs Paid (2026-05-18)

### What Kevin asked for
- Match Protean's layout pattern (vertical scroll, section cards stacked)
- Link everything to detail views ("click to drill down")
- Clearly indicate **Organic vs Paid** sales

### What was built

**1. HTML mockup completely rewritten** (`dashboard.html`)
- Single-page vertical scroll, Protean-style section cards
- 11 sections in this order: Banner → **Main KPIs** (12-card grid) → **Organic vs Paid** (split cards + comparison chart + breakdown table) → Cost vs Revenue trend → Traffic Sources (donut + table) → Campaign Performance → Pillar Performance → Top Products → Site Engagement → Brand Health → Email → **View in detail** (8 platform links)
- Fitasy cream theme retained; Organic in sage green, Paid in dark slate
- Every section has a "View in X" link to the source platform

**2. Looker Studio Page 5 — canvas expanded to 1200×4000px** so widgets can scroll vertically.

**3. Live Organic vs Paid table added to Looker Studio** with real GA4 data:

| Session medium | Class | Sessions | Purchase revenue | E-com purchases |
|---|---|---|---|---|
| cpc | Paid (Google) | 5,704 | $741 | 4 |
| Paid Social | Paid (Meta) | 3,170 | $2,230 | 11 |
| (none) | Direct | 862 | $1,924.50 | 12 |
| referral | Organic | 393 | $0 | 0 |
| organic | Organic | 361 | $401 | 2 |
| social | Organic | 339 | $0 | 0 |
| (data not available) | n/a | 80 | $0 | 0 |
| (not set) | n/a | 43 | $0 | 0 |
| paid | Paid | 42 | $0 | 0 |
| email | Organic | 29 | $0 | 0 |
| ppc | Paid | 13 | $0 | 0 |
| product_sync | n/a | 9 | $0 | 0 |
| feed | n/a | 1 | $0 | 0 |

**Key insight:** Direct traffic ($1,924.50 on 862 sessions = **$2.23/session**) outperforms paid (cpc + Paid Social + paid + ppc = **$0.33/session**). Worth investigating attribution lag (paid driving brand searches that show up as Direct/Organic later).

**4. Detail-view links text widget added** to Looker Studio with 7 platform URLs (Google Ads, GA4, Shopify, Meta BM, Search Console, Klaviyo, Brand Mentions sheet). Looker Studio auto-renders URLs as clickable hyperlinks in View mode.

### Layout target (matches Protean's pattern)
Open the dashboard in Looker, position widgets like this top-to-bottom:

```
Y= 50  ┌─ Date range control + Page title text ─┐
Y= 150 ┌─ Row 1: 6 KPI scorecards ─────────────┐
       │  Active users │ Engaged │ Revenue │ E-com │ Cost │ ROAS │
Y= 350 ┌─ Section title: "Organic vs Paid" ────┐
Y= 400 ┌─ Organic vs Paid table (13 rows) ─────┐
Y= 900 ┌─ Section title: "Cost vs Revenue" ────┐
Y= 950 ┌─ Sessions area chart (by event) ──────┐
Y=1500 ┌─ Section title: "Channel Mix" ────────┐
Y=1550 ┌─ Channel donut + Top campaigns table ─┐
Y=2300 ┌─ Section title: "Brand Health" ───────┐
Y=2350 ┌─ Sentiment area + donut + table ──────┐
Y=3000 ┌─ Section title: "Site Engagement" ────┐
Y=3050 ┌─ Page engagement table ───────────────┐
Y=3700 ┌─ Section title + "View in detail" links ─┐
```

### What's still messy
- The 6 KPI scorecards from Round 7 are still stacked at top-left (positioning via UI automation is too fragile). Drag them into a row in Looker.
- The Sessions area chart still overlaps the Page engagement table. Move one of them.
- The new Organic vs Paid widgets are placed in the empty zone below Y=2000, ready to be arranged.

### Optional next-round adds
- **Calculated field for clean Organic/Paid bucket**: in Looker Studio create a calculated field via Data source editor → Add field:
  ```
  CASE
    WHEN REGEXP_MATCH(Session medium, "^(cpc|ppc|paid|Paid Social)$") THEN "Paid"
    WHEN Session medium = "(none)" THEN "Direct"
    ELSE "Organic"
  END
  ```
  Then use it as a dimension for a clean 3-row split.
- **Chart interactions**: select each chart → ⋮ menu → "Cross-filtering" so clicking a campaign in the table filters all other widgets to that campaign.
- **Date range picker**: add a Date control widget at top so the whole page filters together.

