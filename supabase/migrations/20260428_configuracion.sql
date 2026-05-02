CREATE TABLE IF NOT EXISTS configuracion (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solo admin" ON configuracion FOR ALL USING (false);
