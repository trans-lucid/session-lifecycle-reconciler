import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

async function modules() {
  const auth = await importFromTarget<typeof import("../../src/authClient")>("src/authClient.ts");
  const audit = await importFromTarget<typeof import("../../src/auditLog")>("src/auditLog.ts");
  const membership = await importFromTarget<typeof import("../../src/membershipStore")>("src/membershipStore.ts");
  const middleware = await importFromTarget<typeof import("../../src/middleware")>("src/middleware.ts");
  const reconciler = await importFromTarget<typeof import("../../src/reconciler")>("src/reconciler.ts");
  const sessions = await importFromTarget<typeof import("../../src/sessionStore")>("src/sessionStore.ts");
  const sweeper = await importFromTarget<typeof import("../../src/sweeper")>("src/sweeper.ts");
  return { auth, audit, membership, middleware, reconciler, sessions, sweeper };
}

describe("session lifecycle public contract", () => {
  it("denies a protected route when Postgres session truth is revoked", async () => {
    const { auth, membership, middleware, reconciler, sessions } = await modules();
    const authClient = new auth.FakeAuthClient();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const membershipStore = new membership.InMemoryMembershipStore();
    await membershipStore.upsert({ userId: "user_alpha", orgId: "org_alpha", role: "member", status: "active" });

    const token = auth.makeFixtureToken({
      userId: "user_alpha",
      orgId: "org_alpha",
      sessionId: "sess-revoked",
      loginEventId: "login-revoked"
    });
    await new reconciler.SessionReconciler(authClient, sessionStore, runtimeStore).handleLoginCallback(token);
    await sessionStore.updateStatus("sess-revoked", "revoked", { reason: "support_revoked", revokedAt: new Date().toISOString() });

    const decision = await new middleware.AccessMiddleware(authClient, sessionStore, runtimeStore, membershipStore).authorizeRequest(token, "org_alpha");
    expect(decision.allow, "runtime_overrides_revocation: Redis active session must not beat revoked DB truth").toBe(false);
  });

  it("handles duplicate login callbacks idempotently", async () => {
    const { auth, reconciler, sessions } = await modules();
    const authClient = new auth.FakeAuthClient();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const token = auth.makeFixtureToken({
      userId: "user_alpha",
      orgId: "org_alpha",
      sessionId: "sess-dup",
      loginEventId: "login-dup"
    });

    const first = await new reconciler.SessionReconciler(authClient, sessionStore, runtimeStore).handleLoginCallback(token);
    const second = await new reconciler.SessionReconciler(authClient, sessionStore, runtimeStore).handleLoginCallback(token);

    expect(second.id, "duplicate_active_session: repeated login_event_id should return the existing DB session").toBe(first.id);
    await expect(sessionStore.countActiveByLoginEventId("login-dup")).resolves.toBe(1);
  });

  it("denies stale org access after membership removal", async () => {
    const { auth, membership, middleware, reconciler, sessions } = await modules();
    const authClient = new auth.FakeAuthClient();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const membershipStore = new membership.InMemoryMembershipStore();
    await membershipStore.upsert({ userId: "user_alpha", orgId: "org_alpha", role: "member", status: "active" });
    const token = auth.makeFixtureToken({
      userId: "user_alpha",
      orgId: "org_alpha",
      sessionId: "sess-member",
      loginEventId: "login-member"
    });
    await new reconciler.SessionReconciler(authClient, sessionStore, runtimeStore).handleLoginCallback(token);
    await membershipStore.upsert({ userId: "user_alpha", orgId: "org_alpha", role: "member", status: "removed" });

    const decision = await new middleware.AccessMiddleware(authClient, sessionStore, runtimeStore, membershipStore).authorizeRequest(token, "org_alpha");
    expect(decision.allow, "stale_org_access_allowed: route access must re-check current membership").toBe(false);
  });

  it("sweeps expired sessions with an audit reason", async () => {
    const { audit, sessions, sweeper } = await modules();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const auditLog = new audit.InMemoryAuditLog();
    await sessionStore.create({
      id: "expired-row",
      sessionId: "sess-expired",
      loginEventId: "login-expired",
      userId: "user_admin",
      orgId: "org_alpha",
      riskRole: "high",
      status: "active",
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });
    await runtimeStore.set({
      sessionId: "sess-expired",
      userId: "user_admin",
      orgId: "org_alpha",
      status: "active",
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });

    await new sweeper.ExpiredSessionSweeper(sessionStore, runtimeStore, auditLog).sweepExpired();
    const events = await auditLog.list();
    expect(events[0]?.reason, "missing_audit_reason: high-risk expired sessions need an audit reason").toBeTruthy();
  });
});

