export const median = (xs) => quantile(xs, 0.5);
export function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function mad(xs) {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}
export const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
