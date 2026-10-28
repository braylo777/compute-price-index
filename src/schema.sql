-- Postgres schema (runs on Postgres 15+ and PGlite).
CREATE TABLE IF NOT EXISTS quotes (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  sku TEXT NOT NULL,
  tier TEXT NOT NULL,
  price_per_gpu_hr NUMERIC(10,4) NOT NULL CHECK (price_per_gpu_hr > 0)
);
CREATE INDEX IF NOT EXISTS quotes_sku_time ON quotes (sku, observed_at);
CREATE TABLE IF NOT EXISTS index_daily (
  day DATE NOT NULL,
  sku TEXT NOT NULL,
  index_value NUMERIC(10,4) NOT NULL,
  p25 NUMERIC(10,4), p75 NUMERIC(10,4),
  n INT NOT NULL, dropped INT NOT NULL,
  PRIMARY KEY (day, sku)
);
