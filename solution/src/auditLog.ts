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
