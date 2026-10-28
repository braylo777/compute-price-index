# Compute Price Index & Forward Curve

A daily, methodology-documented price index for rented GPU compute ($ per GPU-hour), a forward curve, and an own-vs-rent TCO calculator.

**Live:** https://compute-price-index.braylo777.workers.dev · API: `/api/index`, `/api/forward?sku=H100`, `/api/tco?sku=H100&utilization=0.6`

## What it does
1. **Scrapes** public prices from two live sources: the vast.ai marketplace API (per-listing, divided by GPU count) and RunPod's public GraphQL (secure + community tiers).
2. **Normalizes** vendor names to 11 canonical SKUs (B200, H200, H100, H100 NVL, MI300X, A100 80/40GB, L40S, RTX 5090/4090, A6000).
3. **Cleans** quotes with outlier rules, then **computes the index**.
4. **Stores** quotes and daily index rows in **Postgres** (`src/schema.sql`; tests run it on PGlite, the scheduled job persists to a local PGlite DB and to JSON snapshots in `data/snapshots/`).
5. Serves a **chart page + JSON API** from a Cloudflare Worker that recomputes from live sources (1 h edge cache) and falls back to the last committed snapshot if a source is down.

## Index methodology
- Hard bounds: drop quotes outside $0.05–$50 / GPU-hr.
- Outliers: modified z-score `|0.6745·(x−median)/MAD| > 3.5` (Iglewicz–Hoaglin), per SKU per source; skipped when MAD = 0 or < 3 quotes.
- **Index = mean of per-source medians** (equal source weight, so a marketplace with hundreds of listings can't swamp a provider's list price). Spread reported as p25–p75 of all clean quotes, with quote and drop counts.
- Forward curve: OLS on `ln(index)` vs months over the daily history, slope clamped to [−15%, +10%] / month. With < 3 days of history it uses a stated **prior of −2.5%/month** and labels the curve `method: prior`. It is a trend extrapolation, not a tradable forward.
- TCO: (capex·(1−residual) + opex%·capex·years) / hours ÷ utilization + kW·PUE·$/kWh; also returns the break-even utilization vs. the current index.

## Run
```bash
npm ci
npm test            # 21 Vitest tests (parsers, outliers, index, curve, TCO, Postgres schema)
npm run snapshot    # pull live quotes -> data/snapshots/<day>.json (+ PGlite)
node scripts/rollup.mjs
npm run build       # bundle the Worker to dist/worker.js
```
Daily snapshots run from `.github/workflows/snapshot.yml`; CI runs tests and the build on every push.

## Limits (honest)
- Two sources today; AWS/GCP/Azure/Lambda list prices need auth or HTML scraping and are not included yet.
- History starts 2026-10-28, so the curve uses the prior until 3+ days accumulate.
- No secrets are needed: both sources are public endpoints.

See `DEPLOYS.md` for deploy history and rollback points.
