-- Orders: one row per verified payment.
CREATE TABLE IF NOT EXISTS orders (
  ref TEXT PRIMARY KEY,            -- PayPal order id or Stripe session id
  provider TEXT NOT NULL,          -- paypal | stripe
  product TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  email TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Support tickets. `secret` lets the customer view replies without an account.
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  order_ref TEXT,
  status TEXT NOT NULL DEFAULT 'open',  -- open | answered | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  author TEXT NOT NULL,            -- customer | support
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- Survey answers from students, parents, teachers and businesses.
CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,              -- personal | business
  role TEXT,
  org TEXT,
  org_size TEXT,
  need TEXT NOT NULL,
  would_pay TEXT,
  email TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Simple rate limiting for public forms (by hashed IP, per hour).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
