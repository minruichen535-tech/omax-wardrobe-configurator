CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'dealer')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'archived')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastLoginAt TEXT,
  expiresAt TEXT
);

CREATE TABLE IF NOT EXISTS dealer_profiles (
  dealerId TEXT PRIMARY KEY,
  companyName TEXT NOT NULL DEFAULT '',
  brandName TEXT NOT NULL DEFAULT '',
  logoUrl TEXT NOT NULL DEFAULT '',
  logoReference TEXT NOT NULL DEFAULT '',
  contactName TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  wechat TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (dealerId) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS dealer_permissions (
  dealerId TEXT PRIMARY KEY,
  allowedSeries TEXT NOT NULL DEFAULT '[]',
  canUseAiPlanner INTEGER NOT NULL DEFAULT 0,
  canExport INTEGER NOT NULL DEFAULT 1,
  canSubmitOrder INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (dealerId) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  tokenHash TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  userAgent TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (accountId) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS dealer_orders (
  id TEXT PRIMARY KEY,
  dealerId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  planId TEXT NOT NULL DEFAULT '',
  planName TEXT NOT NULL DEFAULT '',
  seriesId TEXT NOT NULL DEFAULT '',
  customerReference TEXT NOT NULL DEFAULT '',
  dealerProfileSnapshot TEXT NOT NULL DEFAULT '{}',
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (dealerId) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_role_status ON accounts(role, status);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(accountId);
CREATE INDEX IF NOT EXISTS idx_dealer_orders_dealer ON dealer_orders(dealerId, createdAt);
