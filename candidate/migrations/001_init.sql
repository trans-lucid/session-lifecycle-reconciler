CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  login_event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  risk_role TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE TABLE IF NOT EXISTS org_memberships (
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT,
  session_id TEXT,
  user_id TEXT,
  org_id TEXT,
  event_type TEXT NOT NULL,
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON app_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_login_event ON app_sessions(login_event_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status_expires ON app_sessions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_session_key ON audit_events(session_id, event_key);

