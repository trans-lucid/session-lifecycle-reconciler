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
