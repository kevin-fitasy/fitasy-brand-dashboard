# Fitasy Brand Performance Dashboard

A single-page, vertical-scroll dashboard for Fitasy's internal weekly brand review. Built as static HTML hosted on Netlify, fed by a Google Sheet that Apps Script auto-fills hourly from GA4, Google Ads, Klaviyo, and the brand mentions log.

## Live URL

→ https://bright-truffle-d520e5.netlify.app (rename in Netlify Site Settings → Domain management)

## Architecture

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐       ┌──────────────┐
│  GA4 API    │  ──→  │  Apps Script    │  ──→  │ Google Sheet     │  ──→  │ dashboard.   │
│  Google Ads │       │  (hourly trig)  │       │ FitasyDashboard  │       │ html         │
│  Mentions   │       │  pullAll()      │       │  (13 tabs)       │       │ (Netlify)    │
└─────────────┘       └─────────────────┘       └──────────────────┘       └──────────────┘
```

## Files

| File | Purpose |
|---|---|
| `dashboard.html` | The dashboard itself — Chart.js + PapaParse, no build step |
| `apps_script_dashboard_filler.gs` | Apps Script: pulls GA4 + sentiment → writes to sheet, hourly trigger |
| `netlify.toml` | Netlify deploy config (no build, root → /dashboard.html) |
| `01_BLUEPRINT.md` | Full spec — page structure, KPIs, charts, formulas |
| `02_SETUP_GUIDE.md` | Original Looker Studio setup notes (background) |
| `03_HANDOFF.md` | Living build log across all rounds |
| `04_LIVE_DEPLOY.md` | End-to-end deploy instructions |

## Local development

```bash
cd "Brand Dashboard"
python3 -m http.server 8765
open http://localhost:8765/dashboard.html
```

The dashboard fetches from a Google Sheet via the public `gviz` CSV endpoint — no auth, no server needed.

## Data flow

1. **Hourly:** Apps Script `pullAll()` calls GA4 Data API + reads the brand mentions sheet → writes structured data to 13 tabs in the FitasyDashboard sheet
2. **On every page load:** `dashboard.html` fetches each tab as CSV → renders cards, tables, charts
3. **Status pill** in top-right shows whether the fetch succeeded

## Phases

- **Phase 1 ✅** GA4 + Brand Mentions
- **Phase 2 ⏳** Google Ads (scheduled report → Campaigns tab)
- **Phase 3 ⏳** Shopify + Klaviyo APIs
- **Phase 4 ⏳** Meta Ads (blocked on Protean Business Manager access)

See `04_LIVE_DEPLOY.md` for details on each phase.
