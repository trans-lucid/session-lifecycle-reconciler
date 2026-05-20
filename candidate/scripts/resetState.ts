import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { createClient } from "redis";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sessions";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const pool = new Pool({ connectionString: databaseUrl });
const redis = createClient({ url: redisUrl });

async function waitForPostgres(attempts = 40): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`postgres not ready: ${String(lastError)}`);
}

async function waitForRedis(attempts = 40): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      if (!redis.isOpen) await redis.connect();
      await redis.ping();
      return;
    } catch (error) {
      lastError = error;
      if (redis.isOpen) await redis.quit();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`redis not ready: ${String(lastError)}`);
}

try {
  await waitForPostgres();
  await pool.query("TRUNCATE audit_events, app_sessions, org_memberships RESTART IDENTITY");
  const fixture = JSON.parse(await readFile(new URL("../fixtures/public/memberships.json", import.meta.url), "utf8")) as {
    memberships: Array<{ user_id: string; org_id: string; role: string; status: string }>;
  };
  for (const membership of fixture.memberships) {
    await pool.query(
      `INSERT INTO org_memberships (user_id, org_id, role, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, org_id)
       DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now()`,
      [membership.user_id, membership.org_id, membership.role, membership.status]
    );
  }
  await waitForRedis();
  const keys = await redis.keys("session:*");
  if (keys.length) await redis.del(keys);
  console.log("session simulator state reset");
} finally {
  await pool.end();
  if (redis.isOpen) await redis.quit();
}
