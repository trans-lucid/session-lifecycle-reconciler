import { Pool } from "pg";
import { createClient, type RedisClientType } from "redis";
import type { AppSession, RuntimeSession, SessionStatus } from "./types";

export class InMemorySessionStore {
  sessions: AppSession[] = [];

  async create(session: AppSession): Promise<AppSession> {
    this.sessions.push({ ...session });
    return { ...session };
  }

  async findBySessionId(sessionId: string): Promise<AppSession[]> {
    return this.sessions.filter((session) => session.sessionId === sessionId).map((session) => ({ ...session }));
  }

  async findByLoginEventId(loginEventId: string): Promise<AppSession | null> {
    return this.sessions.find((session) => session.loginEventId === loginEventId) ?? null;
  }

  async countActiveByLoginEventId(loginEventId: string): Promise<number> {
    return this.sessions.filter((session) => session.loginEventId === loginEventId && session.status === "active").length;
  }

  async updateStatus(sessionId: string, status: SessionStatus, details: { reason?: string; revokedAt?: string } = {}): Promise<void> {
    for (const session of this.sessions.filter((item) => item.sessionId === sessionId)) {
      session.status = status;
      if (details.reason) session.revokedReason = details.reason;
      if (details.revokedAt) session.revokedAt = details.revokedAt;
    }
  }

  async listExpired(now = new Date()): Promise<AppSession[]> {
    return this.sessions.filter((session) => session.status === "active" && new Date(session.expiresAt) <= now).map((session) => ({ ...session }));
  }
}

export class InMemoryRuntimeSessionStore {
  runtime = new Map<string, RuntimeSession>();

  async set(session: RuntimeSession): Promise<void> {
    this.runtime.set(session.sessionId, { ...session });
  }

  async get(sessionId: string): Promise<RuntimeSession | null> {
    return this.runtime.get(sessionId) ?? null;
  }

  async delete(sessionId: string): Promise<void> {
    this.runtime.delete(sessionId);
  }

  async clear(): Promise<void> {
    this.runtime.clear();
  }
}

export class PostgresSessionStore {
  constructor(private readonly pool: Pool) {}

  async create(session: AppSession): Promise<AppSession> {
    const result = await this.pool.query(
      `INSERT INTO app_sessions (
        id, session_id, login_event_id, user_id, org_id, risk_role, status, expires_at, revoked_at, revoked_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        session.id,
        session.sessionId,
        session.loginEventId,
        session.userId,
        session.orgId,
        session.riskRole,
        session.status,
        session.expiresAt,
        session.revokedAt ?? null,
        session.revokedReason ?? null
      ]
    );
    return rowToSession(result.rows[0]);
  }

  async findBySessionId(sessionId: string): Promise<AppSession[]> {
    const result = await this.pool.query(`SELECT * FROM app_sessions WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]);
    return result.rows.map(rowToSession);
  }

  async findByLoginEventId(loginEventId: string): Promise<AppSession | null> {
    const result = await this.pool.query(`SELECT * FROM app_sessions WHERE login_event_id = $1 ORDER BY created_at ASC LIMIT 1`, [loginEventId]);
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  async countActiveByLoginEventId(loginEventId: string): Promise<number> {
    const result = await this.pool.query(`SELECT count(*)::int AS count FROM app_sessions WHERE login_event_id = $1 AND status = 'active'`, [loginEventId]);
    return Number(result.rows[0].count);
  }

  async updateStatus(sessionId: string, status: SessionStatus, details: { reason?: string; revokedAt?: string } = {}): Promise<void> {
    await this.pool.query(
      `UPDATE app_sessions
       SET status = $2, revoked_reason = COALESCE($3, revoked_reason), revoked_at = COALESCE($4, revoked_at), updated_at = now()
       WHERE session_id = $1`,
      [sessionId, status, details.reason ?? null, details.revokedAt ?? null]
    );
  }

  async listExpired(now = new Date()): Promise<AppSession[]> {
    const result = await this.pool.query(`SELECT * FROM app_sessions WHERE status = 'active' AND expires_at <= $1`, [now.toISOString()]);
    return result.rows.map(rowToSession);
  }
}

export class RedisRuntimeSessionStore {
  client: RedisClientType;

  constructor(url = process.env.REDIS_URL ?? "redis://localhost:6379") {
    this.client = createClient({ url });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await waitForRedis(this.client);
    }
  }

  async set(session: RuntimeSession): Promise<void> {
    await this.connect();
    await this.client.set(`session:${session.sessionId}`, JSON.stringify(session));
  }

  async get(sessionId: string): Promise<RuntimeSession | null> {
    await this.connect();
    const raw = await this.client.get(`session:${sessionId}`);
    return raw ? (JSON.parse(raw) as RuntimeSession) : null;
  }

  async delete(sessionId: string): Promise<void> {
    await this.connect();
    await this.client.del(`session:${sessionId}`);
  }

  async clear(): Promise<void> {
    await this.connect();
    const keys = await this.client.keys("session:*");
    if (keys.length) await this.client.del(keys);
  }

  async close(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}

export function makePgPool(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sessions" });
}

function rowToSession(row: any): AppSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    loginEventId: row.login_event_id,
    userId: row.user_id,
    orgId: row.org_id,
    riskRole: row.risk_role,
    status: row.status,
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    revokedReason: row.revoked_reason
  };
}

async function waitForRedis(client: RedisClientType, attempts = 40): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await client.connect();
      await client.ping();
      return;
    } catch (error) {
      lastError = error;
      if (client.isOpen) await client.quit();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`redis not ready: ${String(lastError)}`);
}

