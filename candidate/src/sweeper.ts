import type { InMemoryAuditLog } from "./auditLog";
import type { InMemoryRuntimeSessionStore, InMemorySessionStore } from "./sessionStore";

type SessionStoreLike = Pick<InMemorySessionStore, "listExpired" | "updateStatus">;
type RuntimeStoreLike = Pick<InMemoryRuntimeSessionStore, "delete">;
type AuditLogLike = Pick<InMemoryAuditLog, "append">;

export class ExpiredSessionSweeper {
  constructor(
    private readonly sessionStore: SessionStoreLike,
    private readonly runtimeStore: RuntimeStoreLike,
    private readonly auditLog: AuditLogLike
  ) {}

  async sweepExpired(now = new Date()) {
    const expired = await this.sessionStore.listExpired(now);
    for (const session of expired) {
      await this.sessionStore.updateStatus(session.sessionId, "expired");
      await this.runtimeStore.delete(session.sessionId);
      // Starter bug: this audit record is too thin for support/security review.
      await this.auditLog.append({
        eventType: "session_expired",
        sessionId: session.sessionId,
        userId: session.userId,
        orgId: session.orgId
      });
    }
    return expired;
  }
}

