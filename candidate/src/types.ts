export type SessionStatus = "active" | "revoked" | "expired";
export type MembershipStatus = "active" | "removed";

export interface TokenClaims {
  active: boolean;
  userId: string;
  orgId: string;
  sessionId: string;
  loginEventId: string;
  expiresAt: string;
  riskRole: "standard" | "high";
}

export interface AppSession {
  id: string;
  sessionId: string;
  loginEventId: string;
  userId: string;
  orgId: string;
  riskRole: "standard" | "high";
  status: SessionStatus;
  expiresAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
}

export interface RuntimeSession {
  sessionId: string;
  userId: string;
  orgId: string;
  status: SessionStatus;
  expiresAt: string;
}

export interface Membership {
  userId: string;
  orgId: string;
  role: string;
  status: MembershipStatus;
}

export interface AuditEvent {
  eventKey?: string;
  sessionId?: string;
  userId?: string;
  orgId?: string;
  eventType: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface AccessDecision {
  allow: boolean;
  reason: string;
  session?: AppSession | RuntimeSession;
}

