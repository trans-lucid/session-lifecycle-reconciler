import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KeycloakLikeAuthClient } from "../../src/authClient";
import { PostgresAuditLog } from "../../src/auditLog";
import { PostgresMembershipStore } from "../../src/membershipStore";
import { AccessMiddleware } from "../../src/middleware";
import { SessionReconciler } from "../../src/reconciler";
import { makePgPool, PostgresSessionStore, RedisRuntimeSessionStore } from "../../src/sessionStore";
import { ExpiredSessionSweeper } from "../../src/sweeper";
import { importFromTarget } from "./loadTarget";

async function targetClasses() {
  if (!process.env.EVAL_TARGET) {
    return { AccessMiddleware, SessionReconciler, ExpiredSessionSweeper };
  }
  const middleware = await importFromTarget<typeof import("../../src/middleware")>("src/middleware.ts");
  const reconciler = await importFromTarget<typeof import("../../src/reconciler")>("src/reconciler.ts");
  const sweeper = await importFromTarget<typeof import("../../src/sweeper")>("src/sweeper.ts");
  return {
    AccessMiddleware: middleware.AccessMiddleware,
    SessionReconciler: reconciler.SessionReconciler,
    ExpiredSessionSweeper: sweeper.ExpiredSessionSweeper
  };
}

describe("Docker-backed session lifecycle path", () => {
  let pool: Pool;
  let redis: RedisRuntimeSessionStore;

  beforeAll(async () => {
    pool = makePgPool();
    redis = new RedisRuntimeSessionStore();
    await pool.query("TRUNCATE audit_events, app_sessions, org_memberships RESTART IDENTITY");
    await redis.clear();
    await new PostgresMembershipStore(pool).upsert({ userId: "user_alpha", orgId: "org_alpha", role: "member", status: "active" });
  });

  afterAll(async () => {
    await redis.close();
    await pool.end();
  });

  it("uses token simulator, Postgres, and Redis for route authorization", async () => {
    const classes = await targetClasses();
    const auth = new KeycloakLikeAuthClient();
    const sessionStore = new PostgresSessionStore(pool);
    const membershipStore = new PostgresMembershipStore(pool);
    const auditLog = new PostgresAuditLog(pool);
    const token = await auth.issueToken({
      userId: "user_alpha",
      orgId: "org_alpha",
      sessionId: "sess-int",
      loginEventId: "login-int"
    });

    const first = await new classes.SessionReconciler(auth, sessionStore, redis).handleLoginCallback(token);
    const second = await new classes.SessionReconciler(auth, sessionStore, redis).handleLoginCallback(token);
    expect(second.id, "duplicate_active_session: integration login callback should be idempotent").toBe(first.id);
    await expect(sessionStore.countActiveByLoginEventId("login-int")).resolves.toBe(1);

    await sessionStore.updateStatus("sess-int", "revoked", { reason: "security_revoked", revokedAt: new Date().toISOString() });
    const revokedDecision = await new classes.AccessMiddleware(auth, sessionStore, redis, membershipStore).authorizeRequest(token, "org_alpha");
    expect(revokedDecision.allow, "runtime_overrides_revocation: Postgres revocation must beat Redis active session").toBe(false);

    await sessionStore.create({
      id: "expired-int-row",
      sessionId: "sess-expire-int",
      loginEventId: "login-expire-int",
      userId: "user_alpha",
      orgId: "org_alpha",
      riskRole: "high",
      status: "active",
      expiresAt: new Date(Date.now() - 10_000).toISOString()
    });
    await redis.set({
      sessionId: "sess-expire-int",
      userId: "user_alpha",
      orgId: "org_alpha",
      status: "active",
      expiresAt: new Date(Date.now() - 10_000).toISOString()
    });
    await new classes.ExpiredSessionSweeper(sessionStore, redis, auditLog).sweepExpired();
    const events = await auditLog.list();
    expect(events.some((event) => event.reason), "missing_audit_reason: integration sweeper should write audit reason").toBe(true);
  });
});
