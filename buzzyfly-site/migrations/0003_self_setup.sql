-- Self-configuring secrets (generated on first run) and email-link admin sign-in.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_links (
  hash TEXT PRIMARY KEY,         -- sha256 of the one-time sign-in token
  expires_at INTEGER NOT NULL,   -- ms epoch
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  hash TEXT PRIMARY KEY,         -- sha256 of the session cookie value
  expires_at INTEGER NOT NULL
);
