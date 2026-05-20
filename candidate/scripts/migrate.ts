import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sessions";

async function waitForPostgres(pool: Pool, attempts = 40) {
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

const pool = new Pool({ connectionString: databaseUrl });
try {
  await waitForPostgres(pool);
  const sql = await readFile(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("postgres migration complete");
} finally {
  await pool.end();
}

