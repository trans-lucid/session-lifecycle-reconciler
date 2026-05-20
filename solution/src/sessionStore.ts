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
