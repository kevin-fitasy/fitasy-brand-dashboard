# Shopify → Dashboard Setup

**Goal:** pull the real order count + revenue from Shopify so the dashboard stops
under-counting sales (GA4's Shopify pixel typically misses 50-75% of purchases
due to ad-blockers, consent refusals, and iOS ITP).

**Time:** ~5 minutes.

## Why this matters

Business Suite says 8 orders. GA4 says 2. Shopify (source of truth) says 8. Without
this connector the dashboard trusts GA4 — that's the root cause of the "dashboard
shows 2 orders when Meta shows 6+" complaint. With this connector the dashboard
uses Shopify for totals and Meta/Google for paid attribution, so the reconciliation
lines up with reality.

## Step 1 — Create a Custom App in Shopify Admin

1. Sign in to Shopify Admin.
2. **Settings** (bottom-left gear) → **Apps and sales channels** → **Develop apps**.
   - If you see a "Allow custom app development" button, click it first.
3. **Create an app** → name it `Fitasy Dashboard` → contact email `kevin.wu@fitasy.ai`.
4. **Configure Admin API scopes** → tick:
   - `read_orders` — reads orders from the last 60 days
   - `read_all_orders` — reads orders older than 60 days (needed for 90-day dashboard window)
5. **Save**.

## Step 2 — Install and copy the access token

1. Top-right → **Install app** → confirm.
2. Once installed, an **Admin API access token** appears — starts with `shpat_...`.
3. **Reveal and copy it now.** Shopify only shows this token once; if you close the tab you'll have to rotate it.

## Step 3 — Add the Script Properties

1. **script.google.com** → "Fitasy Dashboard Filler" → ⚙ **Project Settings** → **Script properties** → **Edit script properties** → **Add script property**:

   | Property | Value |
   |---|---|
   | `SHOPIFY_SHOP`  | `fitasy-ai`  *(the handle — the part before `.myshopify.com` in your Admin URL. Verify by looking at your Admin URL bar.)* |
   | `SHOPIFY_TOKEN` | the `shpat_...` string from Step 2 |

2. **Save.**

## Step 4 — Run and verify

1. Function dropdown → **`pullAll`** → ▶ **Run**.
2. In the execution log, look for a line per period:
   ```
   pullShopify(30): 42 orders, $8,124 revenue
   ```
3. Refresh the dashboard — **Transactions** and **Purchase revenue** cards now show
   Shopify's numbers, subtitled `Shopify · vs prior 30d`. **Organic vs Paid** reconciles
   using Shopify as total.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `skipped (SHOPIFY_SHOP / SHOPIFY_TOKEN not set)` | Properties missing | Redo Step 3 |
| HTTP 401 / `Invalid API key or access token` | Token wrong or app uninstalled | Regenerate in Shopify Admin, update Script Property |
| HTTP 403 | Missing `read_orders` scope | Edit app scopes in Shopify → tick `read_orders` and `read_all_orders` → reinstall |
| Number lower than Shopify Admin count | You're viewing "paid" orders only (financial_status=paid); pending/refunded orders are excluded | Expected — matches what most agencies report |
| `pullShopify: HTTP 429` | Rate-limited (unusual for a small store) | Wait an hour; the hourly cron will retry |

## Security notes

- The token is **read-only** — `read_orders` scope can view order data but cannot create, modify, or refund.
- If leaked: Shopify Admin → Apps → Develop apps → your app → **Uninstall app**. Then re-create and update Script Properties.
</content>
