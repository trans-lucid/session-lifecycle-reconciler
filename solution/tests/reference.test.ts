import { describe, expect, it } from "vitest";
import { FakeAuthClient, makeFixtureToken } from "../src/authClient";
import { InMemoryAuditLog } from "../src/auditLog";
import { InMemoryMembershipStore } from "../src/membershipStore";
import { AccessMiddleware } from "../src/middleware";
import { SessionReconciler } from "../src/reconciler";
import { InMemoryRuntimeSessionStore, InMemorySessionStore } from "../src/sessionStore";
import { ExpiredSessionSweeper } from "../src/sweeper";

describe("reference solution", () => {
  it("reconciles duplicate login, revocation, membership drift, and expiry audit", async () => {
    const auth = new FakeAuthClient();
    const sessionStore = new InMemorySessionStore();
    const runtimeStore = new InMemoryRuntimeSessionStore();
    const membershipStore = new InMemoryMembershipStore();
    const auditLog = new InMemoryAuditLog();
    await membershipStore.upsert({ userId: "user_ref", orgId: "org_ref", role: "admin", status: "active" });
    const token = makeFixtureToken({
      userId: "user_ref",
      orgId: "org_ref",
      sessionId: "sess-ref",
      loginEventId: "login-ref",
      riskRole: "high"
    });
    const reconciler = new SessionReconciler(auth, sessionStore, runtimeStore);
    const first = await reconciler.handleLoginCallback(token);
    const second = await reconciler.handleLoginCallback(token);
    expect(second.id).toBe(first.id);

    await sessionStore.updateStatus("sess-ref", "revoked", { reason: "security_review", revokedAt: new Date().toISOString() });
    const revoked = await new AccessMiddleware(auth, sessionStore, runtimeStore, membershipStore).authorizeRequest(token, "org_ref");
    expect(revoked.allow).toBe(false);

    await sessionStore.create({
      id: "expired-ref",
      sessionId: "sess-expired-ref",
      loginEventId: "login-expired-ref",
      userId: "user_ref",
      orgId: "org_ref",
      riskRole: "high",
      status: "active",
      expiresAt: new Date(Date.now() - 1000).toISOString()
    });
    await new ExpiredSessionSweeper(sessionStore, runtimeStore, auditLog).sweepExpired();
    expect((await auditLog.list())[0].reason).toBe("high_risk_session_expired");
  });
});

