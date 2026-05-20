import { Pool } from "pg";
import type { AuditEvent } from "./types";

export class InMemoryAuditLog {
  events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push({ ...event, details: event.details ?? {} });
  }

  async list(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

export class PostgresAuditLog {
  constructor(private readonly pool: Pool) {}

  async append(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (event_key, session_id, user_id, org_id, event_type, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        event.eventKey ?? null,
        event.sessionId ?? null,
        event.userId ?? null,
        event.orgId ?? null,
        event.eventType,
        event.reason ?? null,
        JSON.stringify(event.details ?? {})
      ]
    );
  }

  async list(): Promise<AuditEvent[]> {
    const result = await this.pool.query(`SELECT * FROM audit_events ORDER BY id`);
    return result.rows.map((row) => ({
      eventKey: row.event_key,
      sessionId: row.session_id,
      userId: row.user_id,
      orgId: row.org_id,
      eventType: row.event_type,
      reason: row.reason,
      details: row.details
    }));
  }
}

