import type { AuthClient } from "./authClient";
import type { InMemoryMembershipStore } from "./membershipStore";
import type { InMemoryRuntimeSessionStore, InMemorySessionStore } from "./sessionStore";
import type { AccessDecision } from "./types";

type SessionStoreLike = Pick<InMemorySessionStore, "findBySessionId">;
type RuntimeStoreLike = Pick<InMemoryRuntimeSessionStore, "get">;
type MembershipStoreLike = Pick<InMemoryMembershipStore, "get">;

export class AccessMiddleware {
  constructor(
    private readonly authClient: AuthClient,
    private readonly sessionStore: SessionStoreLike,
    private readonly runtimeStore: RuntimeStoreLike,
    private readonly membershipStore: MembershipStoreLike
  ) {}

  async authorizeRequest(token: string, requestedOrgId: string): Promise<AccessDecision> {
    const claims = await this.authClient.introspectToken(token);
    if (!claims.active) return { allow: false, reason: "inactive_token" };

    const runtime = await this.runtimeStore.get(claims.sessionId);
    if (!runtime || runtime.status !== "active" || new Date(runtime.expiresAt) <= new Date()) {
      return { allow: false, reason: "runtime_session_missing_or_expired" };
    }

    const membership = await this.membershipStore.get(claims.userId, requestedOrgId);
    if (!membership || membership.status !== "active") {
      return { allow: false, reason: "membership_missing_or_removed" };
    }

    const dbSessions = await this.sessionStore.findBySessionId(claims.sessionId);
    const revoked = dbSessions.find((session) => session.status === "revoked");
    if (revoked) return { allow: false, reason: "db_session_revoked", session: revoked };
    const active = dbSessions.find(
      (session) => session.status === "active" && session.orgId === requestedOrgId && new Date(session.expiresAt) > new Date()
    );
    if (!active) return { allow: false, reason: "db_session_missing_or_expired" };
    return { allow: true, reason: "db_session_active", session: active };
  }
}
