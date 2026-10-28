// Works with any client exposing query(sql, params) -> { rows } (pg.Pool or PGlite).
export async function migrate(db, schemaSql) { await db.exec(schemaSql); }
export async function insertQuotes(db, quotes) {
  for (const q of quotes)
    await db.query(
      "INSERT INTO quotes (observed_at, source, sku, tier, price_per_gpu_hr) VALUES ($1,$2,$3,$4,$5)",
      [q.observedAt, q.source, q.sku, q.tier, q.pricePerGpuHr]);
}
export async function upsertIndex(db, day, rows) {
  for (const r of rows)
    await db.query(
      `INSERT INTO index_daily (day, sku, index_value, p25, p75, n, dropped) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (day, sku) DO UPDATE SET index_value=EXCLUDED.index_value, p25=EXCLUDED.p25,
       p75=EXCLUDED.p75, n=EXCLUDED.n, dropped=EXCLUDED.dropped`,
      [day, r.sku, r.index, r.p25, r.p75, r.n, r.dropped]);
}
export async function history(db, sku) {
  const { rows } = await db.query(
    "SELECT day::text AS date, index_value::float AS index FROM index_daily WHERE sku=$1 ORDER BY day", [sku]);
  return rows;
}
