import { canonicalGpu } from "./normalize.js";
// Each quote: { source, sku, tier, pricePerGpuHr, observedAt }

export const VAST_URL =
  "https://console.vast.ai/api/v0/bundles/?q=" +
  encodeURIComponent(JSON.stringify({ verified: { eq: true }, rentable: { eq: true }, type: "on-demand", limit: 1000 }));
export const RUNPOD_URL = "https://api.runpod.io/graphql";
export const RUNPOD_QUERY = "{gpuTypes{id displayName memoryInGb securePrice communityPrice}}";

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

export async function fetchAll(fetchImpl = fetch, now = new Date().toISOString()) {
  const results = await Promise.allSettled([
    fetchImpl(VAST_URL).then((r) => r.json()).then((j) => parseVast(j, now)),
    fetchImpl(RUNPOD_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: RUNPOD_QUERY }),
    }).then((r) => r.json()).then((j) => parseRunpod(j, now)),
  ]);
  const quotes = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const errors = results.filter((r) => r.status === "rejected").map((r) => String(r.reason));
  return { quotes, errors, observedAt: now };
}
