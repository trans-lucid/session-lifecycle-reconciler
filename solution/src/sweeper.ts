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
      const reason = session.riskRole === "high" ? "high_risk_session_expired" : "session_expired";
      await this.sessionStore.updateStatus(session.sessionId, "expired", { reason });
      await this.runtimeStore.delete(session.sessionId);
      await this.auditLog.append({
        eventType: "session_expired",
        sessionId: session.sessionId,
        userId: session.userId,
        orgId: session.orgId,
        reason,
        eventKey: `expire:${session.sessionId}`,
        details: { riskRole: session.riskRole, expiresAt: session.expiresAt }
      });
    }
    return expired;
  }
}
