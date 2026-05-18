# Live Dashboard Deploy Guide

End-to-end setup for turning `dashboard.html` into a live, auto-updating dashboard hosted on Netlify, fed by Google Sheets that Apps Script fills hourly.

---

## Architecture (one diagram)

```
   ┌─────────────┐         ┌──────────────────┐         ┌───────────────────┐
   │  GA4 API    │  ──→    │   Apps Script    │   ──→   │ FitasyDashboard   │
   │  Google Ads │  hourly │ (dashboard_filler│  writes │   Google Sheet    │
   │  Mentions   │         │      .gs)        │         │  (13 tabs)        │
   └─────────────┘         └──────────────────┘         └───────────────────┘
                                                                  │
                                                                  │ public CSV export
                                                                  ▼
                                                        ┌──────────────────┐
                                                        │  dashboard.html  │  ←── team opens
                                                        │  hosted on       │      dashboard.fitasy.ai
                                                        │  Netlify         │      in their browser
                                                        └──────────────────┘
```

---

## Phase 1 — Today (~15 min, you do this)

### 1.1  Create the data sheet
1. Open `sheets.new` in your browser
2. Rename it **`FitasyDashboard`**
3. Click **Share** (top right)
4. Change "General access" to **"Anyone with the link → Viewer"** ← this is required so the public HTML can read it via CSV export with no auth
5. Copy the URL — the sheet ID is the long string between `/d/` and `/edit`

### 1.2  Tell me the sheet ID
Paste the ID in the chat. I'll then:
- Create the 13 tabs with correct column headers
- Update `apps_script_dashboard_filler.gs` line 26 with your sheet ID
- Update `dashboard.html` line ~580 with your sheet ID

### 1.3  Create the GitHub repo (or let me do it via gh CLI if you've signed in)
```
# What you'll see in the repo
brand-dashboard/
├── dashboard.html          ← the actual dashboard
├── netlify.toml           ← Netlify build config
├── README.md              ← repo description
└── docs/
    ├── 01_BLUEPRINT.md
    ├── 02_SETUP_GUIDE.md
    ├── 03_HANDOFF.md
    ├── 04_LIVE_DEPLOY.md
    └── apps_script_dashboard_filler.gs
```

### 1.4  Sign up for Netlify (~2 min)
1. Go to **netlify.com** → Sign up with GitHub (uses the account from 1.3)
2. After signing in, choose "Import an existing project" → "Deploy with GitHub" → pick your `brand-dashboard` repo
3. Build settings: leave defaults (Netlify reads `netlify.toml` automatically)
4. Click **Deploy site**. In ~30 sec you'll have a URL like `random-name-12345.netlify.app`
5. Site settings → Domain management → either:
   - **Free:** rename the Netlify subdomain to something like `fitasy-dashboard.netlify.app`
   - **Custom domain:** add `dashboard.fitasy.ai` (Netlify gives you DNS instructions; takes ~10 min to propagate)

---

## Phase 2 — This week (~30 min, split across two evenings)

### 2.1  Set up the Apps Script project
1. Go to **script.google.com** → New project
2. Rename it **"Fitasy Dashboard Filler"**
3. Delete the default `function myFunction() {}` boilerplate
4. Paste the entire contents of **`apps_script_dashboard_filler.gs`**
5. Save (⌘+S or the disk icon)

### 2.2  Enable Google Analytics Data API
1. Top menu: **Services** (the `+` icon next to "Services" in the left sidebar)
2. Find **"Google Analytics Data API"** in the list
3. Click **Add** — leave the identifier as `AnalyticsData`
4. Click **Save**

### 2.3  First-run + OAuth consent
1. In the file editor, select function **`setUp`** from the dropdown (top toolbar, says "Select function")
2. Click ▶ **Run**
3. Google will show "Authorization required" → click **Review permissions**
4. Pick `kevin.wu@fitasy.ai`
5. You'll see a scary "Google hasn't verified this app" warning — that's normal for your own scripts. Click **Advanced** → **Go to Fitasy Dashboard Filler (unsafe)** → **Allow**
6. The script runs. Check the "Execution log" at the bottom for any errors
7. Open your `FitasyDashboard` sheet — you should see rows appearing in the KPIs, OvpSummary, ChannelMix, etc. tabs

### 2.4  Set up the hourly trigger
1. Select function **`installHourlyTrigger`** from the dropdown
2. Click ▶ Run — done. (You can verify in the ⏰ Triggers tab on the left sidebar: should see one trigger for `pullAll`, time-based, every hour.)

### 2.5  Set up Google Ads data
The Google Ads API requires a developer token (free but takes ~24h to approve). **Easier path** that works today:

1. In **ads.google.com** → top-right ⚙ Tools → **Reports** (under Measurement)
2. Click **+ Custom** → choose a "Table" report
3. Columns to include: `Campaign`, `Cost`, `Clicks`, `Avg CPC`, `Conversions`, `Conv. value`, `Conv. value / cost`
4. Set date range: **Last 30 days**
5. Click **Save** with a name like "Fitasy Dashboard Campaigns"
6. Top-right ⋮ menu on the report → **Schedule** → 
   - Frequency: **Daily** at e.g. 5:00 AM
   - Destination: **Google Drive (Google Sheets)**
   - Select your `FitasyDashboard` sheet → tab **`Campaigns`** → **Overwrite existing**
7. Save the schedule

That's it — Google Ads will overwrite the `Campaigns` tab every morning. The HTML reads it on every page load.

---

## Phase 3 — Week 2 (Shopify + Klaviyo)

### 3.1  Shopify daily snapshot

**Quickest path** (manual, ~5 min/morning):
1. Open Shopify admin → Analytics → Reports → "Sales over time"
2. Filter to "Last 30 days"
3. Copy the row totals (Orders, Gross sales, AOV)
4. Paste into the `KPIs` tab (rows for `transactions`, `purchase_revenue`, `aov`) — this overrides the GA4 numbers with Shopify's source-of-truth values

**Automated path** (~1 hr setup):
1. Shopify admin → Apps → Develop apps → Create app "Fitasy Dashboard Reader"
2. Configure Admin API access scopes: `read_orders`, `read_products`, `read_analytics`
3. Install + generate access token (save it, you only see it once)
4. Add a `pullShopify()` function to the Apps Script that hits `https://fitasy.myshopify.com/admin/api/2024-01/orders.json` with the token, sums revenue/orders, writes to the sheet
5. I can write this function once you have the token — just paste it in chat (Apps Script stores secrets safely via `PropertiesService`)

### 3.2  Klaviyo
1. Klaviyo → Account → Settings → API Keys → Create Private API Key
   - Permissions needed: `Metrics: Read`, `Lists: Read`, `Campaigns: Read`
2. Paste the key in chat
3. I'll add a `pullKlaviyo()` function to the Apps Script that hits the Klaviyo Metrics API and writes to the `Email` tab

---

## Phase 4 — When Protean grants Meta Business Manager access

1. Once you're added as Admin/Analyst on Protean's BM, the existing Supermetrics Meta connector in Looker Studio will work
2. We can either keep Meta in Looker Studio (separate page) OR add `pullMeta()` to Apps Script using Meta Marketing API
3. For the live dashboard, easier is to add Meta numbers as KPI rows in the existing `KPIs` tab — same row format

---

## Sheet schema reference

### Config (key/value pairs)
| key | value |
|---|---|
| synced | 18 May 2026 14:07 |
| period | Last 30 days |
| property | 461873881 |

### KPIs (one row per card)
| id | label | value | delta | delta_direction | meta | prefix | suffix |
|---|---|---|---|---|---|---|---|
| active_users | Active users | 8593 | 12% | up | vs prior 30d | | |
| purchase_revenue | Purchase revenue | 5297 | 22% | up | vs prior 30d | $ | |
| roas | Google ROAS | 0.33 | 0.05 | up | vs prior 30d | | × |

`delta_direction` is one of: `up`, `down`, `flat`. Empty `delta` = no delta shown.

### OvpSummary (2 rows: Organic, Paid)
| class | revenue | sub | sessions | transactions | cvr | rev_per_session |

### OvpChannels (one row per source/medium)
| channel | class | sessions | transactions | revenue | cvr | rev_per_session |

`class` is one of: `Organic`, `Paid`, `Direct`.

### ChannelMix (donut data)
| source_medium | sessions | percentage |

### Campaigns (Google Ads)
| campaign | cost | clicks | cpc | conversions | revenue | roas |

### Trend (daily)
| date | cost | revenue | organic_sessions | paid_sessions |

`date` is just the label like "May 17". 30 rows ideally.

### Pillars
| pillar | sessions | atc | transactions | revenue |

### Products (Shopify)
| product | units | revenue | atc_rate | pdp_sessions |

### TopPages (GA4)
| path | views | avg_engagement | conv_value |

### Sentiment (weekly rollup)
| week | positive | neutral | negative |

### Mentions (recent posts)
| source | title | sentiment | days_ago | url |

### Email (Klaviyo, 4 rows)
| id | label | value | delta | delta_direction | meta |
|---|---|---|---|---|---|
| email_subscribers | Subscribers | 2418 | 62 | up | net |
| email_sent | Sent | 8 | | | campaigns |
| email_open_rate | Open rate | 38.2% | 2.1pp | up | vs prior 30d |
| email_revenue | Attributed revenue | $510 | 18% | up | vs prior 30d |

---

## Troubleshooting

**"Demo data — sheet ID not configured"** (status pill says this)
→ The `SHEET_ID` constant in dashboard.html line ~580 is still the placeholder. Update it to your real sheet ID.

**"Could not reach sheet"** (status pill)
→ Sheet sharing isn't set to "Anyone with the link → Viewer". Re-check the Share dialog.

**Apps Script "Service has not been enabled" error**
→ You skipped step 2.2. Services + → add "Google Analytics Data API".

**Apps Script "Insufficient permissions"**
→ The OAuth grant didn't include all scopes. Run `setUp()` again and re-accept the consent screen.

**Dashboard shows old data**
→ Hard refresh the browser (`⌘+Shift+R`). The cache TTL in `netlify.toml` is 5 minutes.

**Apps Script trigger isn't firing**
→ Apps Script → ⏰ Triggers (left sidebar) → confirm there's one for `pullAll`. If not, run `installHourlyTrigger()`.

---

## Phased rollout summary

| Phase | What | Time | Status |
|---|---|---|---|
| 1 | Create sheet, sign up Netlify, deploy HTML with placeholder data | 15 min | _your turn_ |
| 2 | Apps Script GA4 puller + hourly trigger + Google Ads scheduled report | 30 min | _waiting on Phase 1_ |
| 3 | Shopify + Klaviyo connectors | 1-2 hr | _later_ |
| 4 | Meta Ads (waiting on Protean access) | — | _blocked on Protean_ |

After Phase 2 the dashboard is fully live and self-updating for the most important data sources (GA4 + Google Ads + brand sentiment). Phases 3-4 add Shopify (source-of-truth orders), Klaviyo (email), and Meta as data sources come online.
