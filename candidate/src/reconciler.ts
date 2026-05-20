import { randomUUID } from "node:crypto";
import type { AuthClient } from "./authClient";
import type { InMemoryRuntimeSessionStore, InMemorySessionStore } from "./sessionStore";

type SessionStoreLike = Pick<InMemorySessionStore, "create" | "findByLoginEventId">;
type RuntimeStoreLike = Pick<InMemoryRuntimeSessionStore, "set">;

export class SessionReconciler {
  constructor(
    private readonly authClient: AuthClient,
    private readonly sessionStore: SessionStoreLike,
    private readonly runtimeStore: RuntimeStoreLike
  ) {}

  async handleLoginCallback(token: string) {
    const claims = await this.authClient.introspectToken(token);
    if (!claims.active) throw new Error("inactive token");

    // Starter bug: repeated callbacks for the same login_event_id create
    // duplicate active database rows instead of returning the existing session.
    const session = await this.sessionStore.create({
      id: randomUUID(),
      sessionId: claims.sessionId,
      loginEventId: claims.loginEventId,
      userId: claims.userId,
      orgId: claims.orgId,
      riskRole: claims.riskRole,
      status: "active",
      expiresAt: claims.expiresAt
    });

    await this.runtimeStore.set({
      sessionId: claims.sessionId,
      userId: claims.userId,
      orgId: claims.orgId,
      status: "active",
      expiresAt: claims.expiresAt
    });

    return session;
  }
}

