// Pulls live quotes, computes today's index, writes data/snapshots/<day>.json.
// If DATABASE_URL is unset, also persists into a local PGlite DB at data/pgdata.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fetchAll } from "../src/sources.js";
import { computeIndex } from "../src/indexer.js";
const { quotes, errors, observedAt } = await fetchAll();
const day = observedAt.slice(0, 10);
const rows = computeIndex(quotes);
mkdirSync("data/snapshots", { recursive: true });
writeFileSync(`data/snapshots/${day}.json`, JSON.stringify({ observedAt, errors, quoteCount: quotes.length, rows }, null, 1));
try {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite("data/pgdata");
  const { migrate, insertQuotes, upsertIndex } = await import("../src/db.js");
  await migrate(db, readFileSync("src/schema.sql", "utf8"));
  await insertQuotes(db, quotes);
  await upsertIndex(db, day, rows);
} catch (e) { console.error("db skipped:", e.message); }
console.log(`${day}: ${quotes.length} quotes, ${rows.length} SKUs, errors=${errors.length}`);
