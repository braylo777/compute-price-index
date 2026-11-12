import { canonicalGpu } from "./normalize.js";
// Each quote: { source, sku, tier, pricePerGpuHr, observedAt }

export const VAST_URL =
  "https://console.vast.ai/api/v0/bundles/?q=" +
  encodeURIComponent(JSON.stringify({ verified: { eq: true }, rentable: { eq: true }, type: "on-demand", limit: 1000 }));
export const RUNPOD_URL = "https://api.runpod.io/graphql";
export const RUNPOD_QUERY = "{gpuTypes{id displayName memoryInGb securePrice communityPrice}}";
export const RUNCRATE_URL = "https://www.runcrate.ai/api/gpu-pricing";

export function parseVast(json, observedAt) {
  const out = [];
  for (const o of json?.offers ?? []) {
    const sku = canonicalGpu(o.gpu_name + (o.gpu_ram > 60000 ? " 80" : ""));
    const n = Number(o.num_gpus) || 0;
    const total = Number(o.dph_total);
    if (!sku || n <= 0 || !(total > 0)) continue;
    out.push({ source: "vast.ai", sku, tier: "marketplace", pricePerGpuHr: total / n, observedAt });
  }
  return out;
}

export function parseRunpod(json, observedAt) {
  const out = [];
  for (const g of json?.data?.gpuTypes ?? []) {
    const sku = canonicalGpu(`${g.id} ${g.displayName}`);
    if (!sku) continue;
    for (const [tier, p] of [["secure", g.securePrice], ["community", g.communityPrice]]) {
      if (Number(p) > 0) out.push({ source: "runpod", sku, tier, pricePerGpuHr: Number(p), observedAt });
    }
  }
  return out;
}

// Runcrate public feed: one list-price quote per GPU type (min_price_hr, per GPU-hour).
// Types with no orderable option (available_options < 1) are skipped, and so are NVL
// variants that have no NVL SKU here, so they do not mix into the base SKU.
export function parseRuncrate(json, observedAt) {
  const out = [];
  for (const g of json?.gpus ?? []) {
    const sku = canonicalGpu(`${g.gpu_type} ${g.name}`);
    const p = Number(g.min_price_hr);
    if (!sku || !(Number(g.available_options) >= 1) || !(p > 0)) continue;
    if (/NVL/i.test(g.name) && sku !== "H100 NVL") continue;
    out.push({ source: "runcrate", sku, tier: "on-demand", pricePerGpuHr: p, observedAt });
  }
  return out;
}

export async function fetchAll(fetchImpl = fetch, now = new Date().toISOString()) {
  const results = await Promise.allSettled([
    fetchImpl(VAST_URL).then((r) => r.json()).then((j) => parseVast(j, now)),
    fetchImpl(RUNPOD_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: RUNPOD_QUERY }),
    }).then((r) => r.json()).then((j) => parseRunpod(j, now)),
    fetchImpl(RUNCRATE_URL).then((r) => r.json()).then((j) => parseRuncrate(j, now)),
  ]);
  const quotes = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason));
  return { quotes, errors, observedAt: now };
}
