# Looker Studio Setup Guide — Fitasy Brand Dashboard

This guide takes you from zero to a working live dashboard. Plan for ~4–6 hours of setup spread over a week (most time is waiting for OAuth + first-time data syncs).

---

## Architecture at a glance

```
   ┌─────────────────┐
   │  Looker Studio  │ ◄── the dashboard your team sees
   └────────┬────────┘
            │ reads from
   ┌────────┴──────────────────────────────────────────┐
   │                                                    │
   ▼                                                    ▼
NATIVE CONNECTORS (free, Google-owned)        VIA BIGQUERY or SHEETS
- GA4                                          - Shopify ────► Supermetrics / Daton / Hightouch
- Search Console                               - Meta Ads ───► Supermetrics
- Google Ads                                   - TikTok Ads ─► Supermetrics
- YouTube Analytics                            - Klaviyo ────► Supermetrics
- Google Sheets (for manual data)              - IG/TikTok organic ─► Supermetrics
                                               - Brand mentions ──► Manual via Google Sheet
                                               - GEO score ──► Manual via Google Sheet (monthly)
```

**Recommendation:** Start with the FREE native connectors (GA4, Search Console, Google Ads, YouTube). That alone gives you ~60% of the dashboard. Then layer Shopify + Meta via Supermetrics. Manual sheets for the rest.

---

## Phase 1 — Foundation (Day 1, ~2 hours)

### 1.1 Create the Looker Studio report

1. Go to https://lookerstudio.google.com (sign in with kevin.wu@fitasy.ai)
2. Click **Blank Report**
3. Title it: `Fitasy · Brand Performance Dashboard`
4. Set theme: **Custom theme** → upload colors from blueprint (`#FFFFF6` bg, `#000000` text, `#3c4a51` primary)

### 1.2 Connect free data sources (in this order)

| Source | Connector | Notes |
|---|---|---|
| Google Analytics 4 | Native "Google Analytics" | Choose your GA4 property. Grant Looker Studio access. |
| Google Search Console | Native "Search Console" | Add property — choose **Site Impression** for query data. |
| Google Ads | Native "Google Ads" | Connect your Ads account. |
| YouTube Analytics | Native "YouTube Analytics" | If you have a brand channel. |
| Google Sheets | Native "Google Sheets" | We'll use this for manual data (brand mentions, GEO score, PR). |

Each connector adds a "data source" to your report. You can add multiple charts pulling from each.

### 1.3 Build Page 1 (Pulse)

Mirror the structure in `01_BLUEPRINT.md`:
- Hero band → use a **Text box** at the top, pre-populated with template language. Update weekly.
- 8 KPI scorecards → use **Scorecard** chart type, set comparison to "Previous period"
- Revenue trend → **Time series** chart, GA4 source, metric `Purchase revenue`, dimension `Date`
- Channel mix donut → **Pie chart**, dimension `Session default channel group`, metric `Purchase revenue`

You don't have Shopify revenue yet (we add that in Phase 3), so for now wire it to **GA4's `Purchase revenue`** as a proxy. It's slightly under-counted vs. Shopify (GA4 misses some attribution) but close.

---

## Phase 2 — Search & Social (Day 2, ~1 hour)

### 2.1 Page 3 (Acquisition) — works with what you already have

- GA4 + Search Console give you everything for the top half of Page 3
- For organic social: **Manual input via Google Sheets** is fine for v1
  - Create a Sheet: `Fitasy Social Snapshot` with columns: `Date, Platform, Followers, Posts, Reach, Engagement Rate, Top Post URL`
  - Update weekly (10 min job)
  - Connect that sheet as a data source in Looker Studio

### 2.2 Page 4 (Brand Health) — manual for now

Same approach. Create Sheets:
- `Fitasy Brand Mentions` — `Date, Source, Sentiment, Reach, URL`
- `Fitasy GEO Score` — monthly snapshot, `Month, Google AIO Score, ChatGPT Score, Perplexity, Gemini, Bing, llms.txt Status, Schema Coverage`
- `Fitasy PR & Press` — `Date, Outlet, Type, DA, EMV, Status, URL`

These let you ship a useful dashboard without buying a single SaaS connector.

---

## Phase 3 — Shopify + paid social (Week 2)

This is where you decide: **build vs. buy.**

### Option A — Supermetrics (recommended, $79–$200/mo)
- Single tool, connects all of: Shopify, Meta Ads, TikTok Ads, Klaviyo, IG organic, TikTok organic
- Marketplace add-on for Looker Studio: https://lookerstudio.google.com/data?search=supermetrics
- 14-day free trial → connect Shopify first to validate revenue numbers match
- Pricing: Essential plan ~$79/mo (3 connectors), Core ~$149/mo (10+ connectors)
- **Best ROI for a brand at your stage.**

### Option B — Power My Analytics ($30–$80/mo)
- Cheaper, slightly less polished, similar connector coverage
- https://app.powermyanalytics.com/

### Option C — Funnel.io ($350+/mo)
- Enterprise-grade, deep historical backfill, ideal once you cross ~$50k/mo revenue
- Overkill right now

### Option D — DIY via BigQuery (free–$10/mo + dev time)
- Shopify → BigQuery via free **Shopify → BigQuery** connector (Hightouch free tier or Stitch)
- Meta → BigQuery via free **Meta Ads → BigQuery** export
- Klaviyo → BigQuery via Klaviyo's CDP export
- Looker Studio reads from BigQuery natively
- Cheapest, most flexible, but ~1–2 days of setup. Worth it if you'll add a data analyst.

**My recommendation for Fitasy right now:** Supermetrics Essential ($79/mo) → covers Shopify + Meta + 1 more (Klaviyo). Upgrade to Core ($149) when you add TikTok ads.

---

## Phase 4 — Polish & share (Week 3)

### 4.1 Calculated fields to add (Looker Studio → Resource → Manage added data sources → Edit → Add a field)

```
Blended ROAS = SUM(Revenue) / (SUM(Google Spend) + SUM(Meta Spend) + SUM(TikTok Spend))
Email Revenue % = SUM(Klaviyo Attributed Revenue) / SUM(Total Revenue) * 100
CPA = SUM(Total Ad Spend) / SUM(New Customers)
LTV/CAC = SUM(Customer LTV) / SUM(CAC)
```

### 4.2 Filters (page-level, applied globally)

- Date range control → set default to "Last 7 days"
- Comparison toggle → "Previous period"
- Brand pillar dimension filter (once your campaign naming convention is in place — see below)

### 4.3 Campaign naming convention (critical)

For the pillar filter to work, all Google + Meta campaigns must follow this naming:
```
{pillar}_{channel}_{objective}_{audience}_{date}
e.g. PrecisionFit_Meta_Conv_Prospecting_2026-05
```
Pillars: `PrecisionFit | Style | ECO | Tech | Ortho | Confidence`

Looker Studio will then parse the pillar from the campaign name via a `REGEXP_EXTRACT` calculated field.

### 4.4 Share

- **View-only link:** Share → "Anyone with the link can view" — paste in team Slack
- **PDF schedule:** Share → "Schedule email delivery" → every Monday 8 AM EST to the team list
- **Embed:** Use the embed link in Notion or a team wiki

---

## Cost summary

| Item | Cost | Required? |
|---|---|---|
| Looker Studio | $0 | Yes |
| Native Google connectors (GA4, GSC, Ads, YT) | $0 | Yes |
| Google Sheets (manual data) | $0 | Yes (v1) |
| Supermetrics Essential (Shopify + Meta + Klaviyo) | $79/mo | Recommended |
| Domain authority lookups (for PR EMV) | $0 (use Moz free) | Optional |
| Brand mention monitoring (Brand24 or Mention) | $99/mo | Optional, manual works at your stage |
| **Total v1** | **$0–79/mo** | |

---

## What I can't do for you (and you should know about)

- **I can't create the Looker Studio report on your behalf** — it requires authenticated browser access to lookerstudio.google.com. You drive the wizard; the blueprint is the spec.
- **I can't connect your Shopify** — OAuth flow requires you to be logged in. Once Supermetrics is installed, the connector wizard walks you through it.
- **The mockup colors and KPI values are illustrative.** Real values will reflect your live data. The structure is what you're approving.

---

## First-week checklist

- [ ] Open Looker Studio with kevin.wu@fitasy.ai
- [ ] Create blank report titled `Fitasy · Brand Performance Dashboard`
- [ ] Connect GA4, Search Console, Google Ads (native, free)
- [ ] Build Page 1 (Pulse) with GA4 data
- [ ] Build Page 3 (Acquisition) top half with GA4 + GSC
- [ ] Create 3 manual Google Sheets (Social, Mentions, GEO)
- [ ] Share view-only link with team
- [ ] Decide: Supermetrics yes/no for Phase 3
