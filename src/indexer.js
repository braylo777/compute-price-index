import { median, mad, quantile, round } from "./stats.js";

// Outlier rule: modified z-score |0.6745*(x-med)/MAD| > 3.5 (Iglewicz & Hoaglin), plus hard
// bounds ($0.05..$50 per GPU-hr) to drop junk listings. When MAD==0 only the hard bounds apply.
export const BOUNDS = { min: 0.05, max: 50 };
export const Z_CUTOFF = 3.5;

export function filterOutliers(prices) {
  const inBounds = prices.filter((p) => p >= BOUNDS.min && p <= BOUNDS.max);
  if (inBounds.length < 3) return { kept: inBounds, dropped: prices.length - inBounds.length };
  const m = median(inBounds), d = mad(inBounds);
  const kept = d === 0 ? inBounds : inBounds.filter((p) => Math.abs((0.6745 * (p - m)) / d) <= Z_CUTOFF);
  return { kept, dropped: prices.length - kept.length };
}

// Index methodology: for each SKU, clean quotes per source, take each source's median, then the
// index is the mean of source medians (equal source weight, so one marketplace with 500 listings
// cannot swamp a provider with 2 list prices). Spread = p25..p75 of all clean quotes.
export function computeIndex(quotes) {
  const bySku = new Map();
  for (const q of quotes) {
    if (!bySku.has(q.sku)) bySku.set(q.sku, new Map());
    const src = bySku.get(q.sku);
    if (!src.has(q.source)) src.set(q.source, []);
    src.get(q.source).push(q.pricePerGpuHr);
  }
  const rows = [];
  for (const [sku, sources] of bySku) {
    const perSource = {}, all = [];
    let dropped = 0;
    for (const [s, prices] of sources) {
      const f = filterOutliers(prices);
      dropped += f.dropped;
      if (!f.kept.length) continue;
      perSource[s] = round(median(f.kept));
      all.push(...f.kept);
    }
    const meds = Object.values(perSource);
    if (!meds.length) continue;
    rows.push({
      sku,
      index: round(meds.reduce((a, b) => a + b, 0) / meds.length),
      p25: round(quantile(all, 0.25)),
      p75: round(quantile(all, 0.75)),
      n: all.length,
      dropped,
      sources: perSource,
    });
  }
  return rows.sort((a, b) => b.index - a.index);
}
