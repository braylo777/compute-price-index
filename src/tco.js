import { round } from "./stats.js";
// Own-vs-rent TCO per GPU-hour.
export const DEFAULTS = {
  capexPerGpu: 30000, // purchase incl. share of server/network
  years: 4, residualPct: 0.15, kwPerGpu: 1.0, pue: 1.3, dollarsPerKwh: 0.09,
  opexPctPerYear: 0.08, // colo, support, spares as % of capex
  utilization: 0.7,
};
export function tco(rentPerGpuHr, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!(o.utilization > 0 && o.utilization <= 1)) throw new Error("utilization must be in (0,1]");
  if (!(o.years > 0)) throw new Error("years must be > 0");
  const hours = o.years * 8760;
  const depreciation = o.capexPerGpu * (1 - o.residualPct);
  const opex = o.capexPerGpu * o.opexPctPerYear * o.years;
  const fixedPerHour = (depreciation + opex) / hours;
  const powerPerHour = o.kwPerGpu * o.pue * o.dollarsPerKwh; // only when running
  const ownPerUsefulHr = fixedPerHour / o.utilization + powerPerHour;
  const breakevenUtil = rentPerGpuHr > powerPerHour ? fixedPerHour / (rentPerGpuHr - powerPerHour) : Infinity;
  return {
    ownPerUsefulHr: round(ownPerUsefulHr), rentPerGpuHr: round(rentPerGpuHr),
    breakevenUtilization: round(Math.min(breakevenUtil, 99)),
    verdict: ownPerUsefulHr < rentPerGpuHr ? "own" : "rent",
    savingsPerHr: round(rentPerGpuHr - ownPerUsefulHr),
  };
}
