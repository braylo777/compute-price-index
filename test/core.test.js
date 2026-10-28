import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalGpu } from "../src/normalize.js";
import { parseVast, parseRunpod, fetchAll } from "../src/sources.js";
import { filterOutliers, computeIndex } from "../src/indexer.js";
import { median, mad, quantile } from "../src/stats.js";
import { fitDrift, forwardCurve, PRIOR_MONTHLY_DRIFT } from "../src/curve.js";
import { tco } from "../src/tco.js";
import { migrate, insertQuotes, upsertIndex, history } from "../src/db.js";

const T = "2026-10-28T00:00:00Z";
const q = (source, sku, p) => ({ source, sku, tier: "x", pricePerGpuHr: p, observedAt: T });

describe("normalize", () => {
  it("maps vendor names to SKUs", () => {
    expect(canonicalGpu("NVIDIA H100 80GB HBM3")).toBe("H100");
    expect(canonicalGpu("H100 NVL")).toBe("H100 NVL");
    expect(canonicalGpu("NVIDIA A100-SXM4-80GB")).toBe("A100 80GB");
    expect(canonicalGpu("A100 SXM4")).toBe("A100 40GB");
    expect(canonicalGpu("AMD Instinct MI300X OAM")).toBe("MI300X");
  });
  it("drops unknown and empty names", () => {
    expect(canonicalGpu("GTX 1080")).toBeNull();
    expect(canonicalGpu(undefined)).toBeNull();
  });
});

describe("parsers", () => {
  it("vast: divides bundle price by GPU count and skips junk", () => {
    const out = parseVast({ offers: [
      { gpu_name: "H100 SXM", num_gpus: 8, dph_total: 20, gpu_ram: 81000 },
      { gpu_name: "H100 SXM", num_gpus: 0, dph_total: 2 },
      { gpu_name: "Quadro", num_gpus: 1, dph_total: 1 },
      { gpu_name: "RTX 4090", num_gpus: 1, dph_total: -1 },
    ] }, T);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sku: "H100", pricePerGpuHr: 2.5, source: "vast.ai" });
  });
  it("runpod: emits one quote per priced tier, skips zero prices", () => {
    const out = parseRunpod({ data: { gpuTypes: [
      { id: "NVIDIA A100-SXM4-40GB", displayName: "A100 SXM 40GB", securePrice: 0, communityPrice: 1 },
      { id: "NVIDIA H100 80GB HBM3", displayName: "H100 SXM", securePrice: 2.99, communityPrice: 2.69 },
    ] } }, T);
    expect(out.map((o) => o.tier)).toEqual(["community", "secure", "community"]);
  });
  it("parsers tolerate malformed payloads", () => {
    expect(parseVast(null, T)).toEqual([]);
    expect(parseRunpod({ errors: [1] }, T)).toEqual([]);
  });
  it("fetchAll isolates a failing source", async () => {
    const fake = async (url) => {
      if (String(url).includes("vast")) throw new Error("down");
      return { json: async () => ({ data: { gpuTypes: [{ id: "H100", displayName: "H100", securePrice: 3, communityPrice: 0 }] } }) };
    };
    const r = await fetchAll(fake, T);
    expect(r.quotes).toHaveLength(1);
    expect(r.errors[0]).toContain("down");
  });
});

describe("stats + outliers", () => {
  it("median/quantile/mad", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(mad([1, 2, 3, 4, 100])).toBe(1);
  });
  it("drops a planted outlier", () => {
    const f = filterOutliers([2, 2.1, 2.2, 1.9, 2.05, 40]);
    expect(f.kept).not.toContain(40);
    expect(f.dropped).toBe(1);
  });
  it("applies hard bounds even with few quotes", () => {
    expect(filterOutliers([0.01, 2, 99]).kept).toEqual([2]);
  });
  it("keeps everything when MAD is zero", () => {
    expect(filterOutliers([2, 2, 2, 2]).kept).toHaveLength(4);
  });
});

describe("index", () => {
  it("equal-weights sources so a big marketplace cannot swamp", () => {
    const quotes = [...Array(50)].map(() => q("vast.ai", "H100", 2)).concat([q("runpod", "H100", 4)]);
    const [row] = computeIndex(quotes);
    expect(row.index).toBe(3);
    expect(row.n).toBe(51);
  });
  it("sorts SKUs by price and reports spread", () => {
    const rows = computeIndex([q("a", "B200", 6), q("a", "H100", 2), q("b", "H100", 3)]);
    expect(rows.map((r) => r.sku)).toEqual(["B200", "H100"]);
    expect(rows[1].p25).toBeLessThanOrEqual(rows[1].p75);
  });
  it("real snapshot computes a sane H100 index", () => {
    const snap = JSON.parse(readFileSync("data/latest.json", "utf8"));
    const h = snap.rows.find((r) => r.sku === "H100");
    expect(h.index).toBeGreaterThan(0.5);
    expect(h.index).toBeLessThan(15);
  });
});

describe("forward curve", () => {
  it("uses the prior with fewer than 3 points", () => {
    expect(fitDrift([{ date: T, index: 2 }])).toMatchObject({ method: "prior", drift: PRIOR_MONTHLY_DRIFT });
  });
  it("recovers a known decay via OLS", () => {
    const hist = [0, 1, 2, 3].map((m) => ({ date: new Date(Date.parse(T) + m * 30.44 * 864e5).toISOString(), index: 4 * 0.97 ** m }));
    const f = fitDrift(hist);
    expect(f.method).toBe("ols");
    expect(f.drift).toBeCloseTo(-0.03, 3);
  });
  it("clamps a crazy slope", () => {
    const hist = [0, 1, 2].map((m) => ({ date: new Date(Date.parse(T) + m * 30.44 * 864e5).toISOString(), index: 4 * 3 ** m }));
    expect(fitDrift(hist).drift).toBeLessThanOrEqual(Math.expm1(0.1) + 1e-9);
  });
  it("curve starts at spot and is monotone for negative drift", () => {
    const c = forwardCurve(3, []).curve.map((x) => x.price);
    expect(c[0]).toBe(3);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThan(c[i - 1]);
  });
});

describe("tco", () => {
  it("cheap rent => rent; expensive rent => own", () => {
    expect(tco(0.5).verdict).toBe("rent");
    expect(tco(10).verdict).toBe("own");
  });
  it("break-even utilization makes own == rent", () => {
    const r = tco(2);
    const at = tco(2, { utilization: r.breakevenUtilization });
    expect(at.ownPerUsefulHr).toBeCloseTo(2, 2);
  });
  it("validates inputs", () => {
    expect(() => tco(2, { utilization: 0 })).toThrow();
    expect(() => tco(2, { years: 0 })).toThrow();
  });
});

describe("postgres schema (PGlite)", () => {
  it("migrates, stores quotes, upserts index and reads history", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await migrate(db, readFileSync("src/schema.sql", "utf8"));
    await insertQuotes(db, [q("a", "H100", 2.5)]);
    await upsertIndex(db, "2026-10-27", [{ sku: "H100", index: 2.6, p25: 2, p75: 3, n: 1, dropped: 0 }]);
    await upsertIndex(db, "2026-10-28", [{ sku: "H100", index: 2.5, p25: 2, p75: 3, n: 1, dropped: 0 }]);
    await upsertIndex(db, "2026-10-28", [{ sku: "H100", index: 2.4, p25: 2, p75: 3, n: 1, dropped: 0 }]);
    const h = await history(db, "H100");
    expect(h).toEqual([{ date: "2026-10-27", index: 2.6 }, { date: "2026-10-28", index: 2.4 }]);
    await expect(db.query("INSERT INTO quotes (observed_at,source,sku,tier,price_per_gpu_hr) VALUES (now(),'a','b','c',0)")).rejects.toThrow();
  });
});
