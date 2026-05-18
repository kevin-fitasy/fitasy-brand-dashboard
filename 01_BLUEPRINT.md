# Fitasy Brand Performance Dashboard — Blueprint

**Platform:** Google Looker Studio
**Audience:** Internal team, weekly review (Monday morning standup format)
**Refresh:** Live where possible; daily batch for paid social / Klaviyo / brand mentions
**Default time range:** Last 7 days vs. previous 7 days, with selector for 28d / QTD / YTD

---

## Brand voice for the dashboard

- Tone: premium, understated, confident — matches Brand Book 2026
- Palette: `#000000` (text), `#FFFFF6` (background), `#3c4a51` (primary accent), `#5f7c8e` (secondary), `#b0a778` (highlight), `#91a5a6` (muted), `#d5d0a3` (soft), `#807e71` (neutral)
- Status colors: success `#5a7d5a`, warning `#b0a778`, danger `#a35a4f`
- Typography: serif (display) + sans-serif (data) — clean, generous whitespace

---

## Page 1 — Pulse (Executive Overview)

Single-screen "is the brand winning this week?" view.

### Hero band (full width, top)
- **Week of [date range]** — Brand pulse statement (auto-generated from data: "Revenue +18% WoW, ROAS up across all paid channels, organic search slipping")
- 3 callout tiles: Biggest Win / Biggest Concern / Action Required

### KPI scorecard row (8 tiles, equal width)
For each: large number, WoW arrow + %, sparkline of last 28 days, vs. target chip
1. **Revenue** (Shopify)
2. **Orders** (Shopify)
3. **AOV** (Shopify)
4. **Sessions** (GA4)
5. **CVR** (GA4 — Sessions → Purchase)
6. **Blended ROAS** (Revenue / Total Ad Spend)
7. **Total Followers** (sum across IG, TikTok, X, YouTube)
8. **Email Revenue %** (Klaviyo attributed revenue / total revenue)

### Channel mix donut + revenue trend (side by side)
- Left: Revenue attribution donut — Organic Search, Direct, Paid Search, Paid Social, Email, Referral, Other
- Right: Daily revenue line, last 28 days, with paid-spend area overlay

### Brand pillar performance (table)
Rows = Precision Fit, Style, ECO, Tech, Ortho/Medical, Confidence Redefined
Cols = Spend, Impressions, Clicks, Add-to-Carts, Purchases, Revenue, ROAS
Color heatmap on ROAS column.

---

## Page 2 — Commerce (Shopify + Paid Media)

### Top row: Sales scorecard
- Gross revenue, net revenue (after refunds/discounts), orders, AOV, units per order, refund rate, repeat customer rate

### Funnel (horizontal bar)
Sessions → Product views → Add to cart → Checkout started → Purchase
Show count + % drop-off at each step. Compare to prior period in lighter shade.

### Top products table
SKU, units, revenue, AOV, refund rate, inventory days remaining. Sort by revenue desc.

### Paid media performance (split into Google + Meta sections, mirror Protean's report)

**Google block:**
- MoM table: Month, Spend, Impressions, Clicks, CPC, CTR, Purchases, Revenue, CPP, ROAS
- Campaign type breakdown (Search / PMax / Shopping / Display)
- Top 10 keywords by spend (with conv. rate, conv. value / cost)
- Top 5 ad groups
- Geographic heatmap (US states)

**Meta block:**
- Pillar performance: Precision Fit, Style, ECO, Tech, Ortho/Medical, Confidence Redefined (Spend, ATC, Purchases, ROAS)
- Placement breakdown (Feed, Reels, Stories, Explore, Audience Network)
- Audience type (Prospecting vs. Engaged vs. Retargeting)
- Ad format (Single Image, Carousel, Flexible Video, Catalog)
- Top creatives by ROAS (with thumbnail if possible)

### Spend pacing
Month-to-date spend vs. budget, by channel. Projected end-of-month spend.

---

## Page 3 — Acquisition (Traffic, Search, Social Reach)

### GA4 traffic overview
- Sessions, Users, New Users, Engaged Sessions, Engagement Rate, Avg. Engagement Time
- Sessions by channel grouping (line chart, 28 days)
- Top 10 landing pages: sessions, engagement rate, conversion rate, revenue
- Device split (desktop/mobile/tablet)

### Search Console
- Impressions, Clicks, CTR, Avg. Position — KPI tiles with WoW
- Impressions vs. clicks trend (dual-axis line)
- Top 20 queries: query, impressions, clicks, CTR, position, position Δ
- Top 10 pages by clicks
- New ranking queries (queries that gained position WoW)

### Organic social
For each platform (IG, TikTok, X, YouTube):
- Followers (current + Δ WoW)
- Posts published this week
- Total reach
- Engagement rate
- Top performing post (image + caption + metrics)

### Brand search & mentions
- Branded search volume (Search Console queries containing "fitasy")
- Brand mentions volume from social listening (manual input via Sheet, or via Brand24/Mention.com integration)
- Sentiment ratio (pos/neu/neg) — color stacked bar
- Share of voice vs. competitors (if competitor list provided)

---

## Page 4 — Retention & Brand Health

### Email/SMS (Klaviyo)
- List size + Δ WoW (subscribers, unsubs, net change)
- Campaigns sent this week (table: name, send, opens, OR, clicks, CTR, revenue, RPR)
- Flow performance: Welcome, Abandoned Cart, Post-Purchase, Browse Abandon, Winback (revenue + open rate per flow)
- Email % of total revenue (line trend, 12 weeks)

### Customer behavior
- New vs. returning customer split (orders + revenue)
- Customer LTV by acquisition cohort (Jan, Feb, Mar, Apr cohorts)
- Repeat purchase rate at 30/60/90 days
- Top customer geos (countries/states)

### Brand health & GEO (AI search visibility)
- AI citability score (overall, 0-100) — gauge
- Platform readiness: Google AI Overviews, ChatGPT, Perplexity, Gemini, Bing Copilot (5 mini gauges)
- Brand mention frequency in AI responses (manual check or via GEO tool)
- Schema markup coverage % (technical SEO)
- llms.txt status (present/absent/last updated)

### Press & PR
- Articles/mentions this period (manual entry via Sheet or Notion)
- Domain authority of mention sources
- Earned media value estimate

---

## Calculated fields (Looker Studio formulas)

```
Blended ROAS = SUM(Revenue) / SUM(Ad Spend - Google + Meta + TikTok)
CPP = SUM(Spend) / SUM(Purchases)
CVR = SUM(Purchases) / SUM(Sessions)
Email Revenue % = SUM(Klaviyo Attributed Revenue) / SUM(Total Revenue)
WoW Δ = (Current Period - Prior Period) / Prior Period
Engagement Rate = (Likes + Comments + Saves + Shares) / Reach
```

---

## Filters (global, top of every page)

- Date range selector (default: Last 7 days)
- Comparison toggle (Previous period / Previous year / None)
- Brand pillar filter (multi-select)
- Geo filter (US states / countries)

---

## Page layout principles

- Generous whitespace — premium, not crammed
- Maximum 6-7 visual elements per page
- KPI tiles always at top, deeper data below
- Every chart has a one-line annotation explaining what to look for
- Color used sparingly — accent colors only on the metric that matters
- Mobile-friendly: stack to single column under 768px width
