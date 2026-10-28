// Rebuilds data/history.json + data/latest.json from data/snapshots/*.json (feeds the forward curve).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const files = readdirSync("data/snapshots").filter((f) => f.endsWith(".json")).sort();
const hist = {};
let last;
for (const f of files) {
  last = JSON.parse(readFileSync(`data/snapshots/${f}`, "utf8"));
  for (const r of last.rows) (hist[r.sku] ??= []).push({ date: last.observedAt, index: r.index });
}
writeFileSync("data/history.json", JSON.stringify(hist, null, 1));
writeFileSync("data/latest.json", JSON.stringify(last, null, 1));
console.log(`rolled up ${files.length} snapshots`);
