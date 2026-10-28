import { fetchAll } from "./sources.js";
import { computeIndex } from "./indexer.js";
import { forwardCurve } from "./curve.js";
import { tco } from "./tco.js";
import { PAGE } from "./page.js";
import SNAPSHOT from "../data/latest.json";
import HISTORY from "../data/history.json";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });

async function currentIndex(ctx) {
  const cache = caches.default, key = new Request("https://cpi.internal/index");
  const hit = await cache.match(key);
  if (hit) return hit.json();
  let body;
  try {
    const { quotes, errors, observedAt } = await fetchAll();
    if (quotes.length < 10) throw new Error("too few quotes");
    body = { observedAt, quoteCount: quotes.length, errors, rows: computeIndex(quotes), live: true };
  } catch (e) {
    body = { ...SNAPSHOT, live: false, fallbackReason: String(e) };
  }
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(body), { headers: { "cache-control": "max-age=3600" } })));
  return body;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/") return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/api/index") return json(await currentIndex(ctx));
    if (url.pathname === "/api/forward" || url.pathname === "/api/tco") {
      const idx = await currentIndex(ctx);
      const sku = url.searchParams.get("sku") || "H100";
      const row = idx.rows.find((r) => r.sku === sku);
      if (!row) return json({ error: "unknown sku" }, 404);
      if (url.pathname === "/api/forward") {
        const hist = [...(HISTORY[sku] || []), { date: idx.observedAt, index: row.index }];
        return json({ sku, ...forwardCurve(row.index, hist) });
      }
      const opts = {};
      for (const k of ["capexPerGpu", "years", "utilization", "dollarsPerKwh"]) if (url.searchParams.has(k)) opts[k] = Number(url.searchParams.get(k));
      try { return json({ sku, ...tco(row.index, opts) }); } catch (e) { return json({ error: e.message }, 400); }
    }
    return new Response("not found", { status: 404 });
  },
};
