CREATE TABLE IF NOT EXISTS revoked_sessions (
  tokenHash TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('disabled', 'archived', 'expired')),
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (accountId) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_account ON revoked_sessions(accountId);
