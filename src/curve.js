import { round } from "./stats.js";
// Forward curve: fit ln(price) = a + b*t (t in months) by OLS on the index history.
// With <3 history points we fall back to a prior monthly drift (documented in README),
// because a slope from 1-2 points is noise. Output: price at tenors 1,3,6,12 months.
export const PRIOR_MONTHLY_DRIFT = -0.025; // ~-26%/yr: typical GPU rental decay after launch
export const TENORS = [0, 1, 3, 6, 12];

export function fitDrift(history) {
  // history: [{ date: ISO, index: number }]
  const pts = history.filter((h) => h.index > 0);
  if (pts.length < 3) return { drift: PRIOR_MONTHLY_DRIFT, method: "prior", points: pts.length };
  const t0 = Date.parse(pts[0].date);
  const xs = pts.map((p) => (Date.parse(p.date) - t0) / (30.44 * 864e5));
  const ys = pts.map((p) => Math.log(p.index));
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (sxx === 0) return { drift: PRIOR_MONTHLY_DRIFT, method: "prior", points: n };
  // Clamp to a sane band so one bad week can't produce a crazy curve.
  const b = Math.max(-0.15, Math.min(0.1, sxy / sxx));
  return { drift: Math.expm1(b), method: "ols", points: n };
}

export function forwardCurve(spot, history = []) {
  const { drift, method, points } = fitDrift(history);
  return {
    method, points, monthlyDrift: round(drift),
    curve: TENORS.map((m) => ({ months: m, price: round(spot * (1 + drift) ** m) })),
  };
}
