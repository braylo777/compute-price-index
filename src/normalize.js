// Canonical GPU SKUs. Anything not matched is dropped (keeps the index comparable).
const RULES = [
  [/B200/i, "B200"],
  [/H200/i, "H200"],
  [/H100.*(NVL)/i, "H100 NVL"],
  [/H100/i, "H100"],
  [/MI300X/i, "MI300X"],
  [/A100.*(80|SXM4-80|PCIE 80)/i, "A100 80GB"],
  [/A100/i, "A100 40GB"],
  [/L40S/i, "L40S"],
  [/RTX ?5090/i, "RTX 5090"],
  [/RTX ?4090/i, "RTX 4090"],
  [/A6000/i, "RTX A6000"],
];
export function canonicalGpu(name) {
  if (!name) return null;
  for (const [re, sku] of RULES) if (re.test(name)) return sku;
  return null;
}
export const SKUS = [...new Set(RULES.map((r) => r[1]))];
