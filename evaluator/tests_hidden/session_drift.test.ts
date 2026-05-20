import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

async function modules() {
  const auth = await importFromTarget<any>("src/authClient.ts");
  const audit = await importFromTarget<any>("src/auditLog.ts");
  const membership = await importFromTarget<any>("src/membershipStore.ts");
  const middleware = await importFromTarget<any>("src/middleware.ts");
  const reconciler = await importFromTarget<any>("src/reconciler.ts");
  const sessions = await importFromTarget<any>("src/sessionStore.ts");
  const sweeper = await importFromTarget<any>("src/sweeper.ts");
  return { auth, audit, membership, middleware, reconciler, sessions, sweeper };
}

describe("hidden session lifecycle evaluator", () => {
  it("denies Redis-only sessions with no Postgres row", async () => {
    const { auth, membership, middleware, sessions } = await modules();
    const authClient = new auth.FakeAuthClient();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const membershipStore = new membership.InMemoryMembershipStore();
    await membershipStore.upsert({ userId: "user_hidden", orgId: "org_hidden", role: "member", status: "active" });
    await runtimeStore.set({
      sessionId: "sess-redis-only",
      userId: "user_hidden",
      orgId: "org_hidden",
      status: "active",
      expiresAt: new Date(Date.now() + 3600_000).toISOString()
    });
    const token = auth.makeFixtureToken({
      userId: "user_hidden",
      orgId: "org_hidden",
      sessionId: "sess-redis-only",
      loginEventId: "login-redis-only"
    });
    const decision = await new middleware.AccessMiddleware(authClient, sessionStore, runtimeStore, membershipStore).authorizeRequest(token, "org_hidden");
    expect(decision.allow).toBe(false);
  });

  it("does not leak stale organization context into a different org request", async () => {
    const { auth, membership, middleware, reconciler, sessions } = await modules();
    const authClient = new auth.FakeAuthClient();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const membershipStore = new membership.InMemoryMembershipStore();
    await membershipStore.upsert({ userId: "user_hidden", orgId: "org_alpha", role: "member", status: "active" });
    await membershipStore.upsert({ userId: "user_hidden", orgId: "org_beta", role: "member", status: "removed" });
    const token = auth.makeFixtureToken({
      userId: "user_hidden",
      orgId: "org_alpha",
      sessionId: "sess-org-leak",
      loginEventId: "login-org-leak"
    });
    await new reconciler.SessionReconciler(authClient, sessionStore, runtimeStore).handleLoginCallback(token);
    const decision = await new middleware.AccessMiddleware(authClient, sessionStore, runtimeStore, membershipStore).authorizeRequest(token, "org_beta");
    expect(decision.allow).toBe(false);
  });

  it("keeps duplicate callback replay to one active DB session", async () => {
    const { auth, reconciler, sessions } = await modules();
    const authClient = new auth.FakeAuthClient();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const token = auth.makeFixtureToken({
      userId: "user_hidden",
      orgId: "org_hidden",
      sessionId: "sess-hidden-dup",
      loginEventId: "login-hidden-dup"
    });
    const sessionReconciler = new reconciler.SessionReconciler(authClient, sessionStore, runtimeStore);
    await sessionReconciler.handleLoginCallback(token);
    await sessionReconciler.handleLoginCallback(token);
    await sessionReconciler.handleLoginCallback(token);
    await expect(sessionStore.countActiveByLoginEventId("login-hidden-dup")).resolves.toBe(1);
  });

  it("high-risk expired sessions include an audit reason and details", async () => {
    const { audit, sessions, sweeper } = await modules();
    const sessionStore = new sessions.InMemorySessionStore();
    const runtimeStore = new sessions.InMemoryRuntimeSessionStore();
    const auditLog = new audit.InMemoryAuditLog();
    await sessionStore.create({
      id: "hidden-expired",
      sessionId: "sess-hidden-expired",
      loginEventId: "login-hidden-expired",
      userId: "admin_hidden",
      orgId: "org_hidden",
      riskRole: "high",
      status: "active",
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });
    await new sweeper.ExpiredSessionSweeper(sessionStore, runtimeStore, auditLog).sweepExpired();
    const event = (await auditLog.list())[0];
    expect(event.reason).toBe("high_risk_session_expired");
    expect(event.details?.riskRole).toBe("high");
  });
});
