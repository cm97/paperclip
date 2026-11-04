-- Refunds revoke access: a pass for a refunded order stops working.
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'paid'; -- paid | refunded
-- Failed admin sign-ins, for lockout.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
