import { Pool } from "pg";
import type { Membership } from "./types";

export class InMemoryMembershipStore {
  memberships = new Map<string, Membership>();

  key(userId: string, orgId: string): string {
    return `${userId}:${orgId}`;
  }

  async upsert(membership: Membership): Promise<void> {
    this.memberships.set(this.key(membership.userId, membership.orgId), { ...membership });
  }

  async get(userId: string, orgId: string): Promise<Membership | null> {
    return this.memberships.get(this.key(userId, orgId)) ?? null;
  }
}

export class PostgresMembershipStore {
  constructor(private readonly pool: Pool) {}

  async upsert(membership: Membership): Promise<void> {
    await this.pool.query(
      `INSERT INTO org_memberships (user_id, org_id, role, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, org_id)
       DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now()`,
      [membership.userId, membership.orgId, membership.role, membership.status]
    );
  }

  async get(userId: string, orgId: string): Promise<Membership | null> {
    const result = await this.pool.query(`SELECT * FROM org_memberships WHERE user_id = $1 AND org_id = $2`, [userId, orgId]);
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return { userId: row.user_id, orgId: row.org_id, role: row.role, status: row.status };
  }
}

