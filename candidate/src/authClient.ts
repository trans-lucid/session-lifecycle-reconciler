import type { TokenClaims } from "./types";

export interface AuthClient {
  introspectToken(token: string): Promise<TokenClaims>;
}

function decodeToken(token: string): TokenClaims {
  const payload = token.includes(".") ? token.split(".")[1] : token;
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as TokenClaims;
}

export class FakeAuthClient implements AuthClient {
  async introspectToken(token: string): Promise<TokenClaims> {
    return decodeToken(token);
  }
}

export class KeycloakLikeAuthClient implements AuthClient {
  constructor(private readonly baseUrl = "http://localhost:8085") {}

  async introspectToken(token: string): Promise<TokenClaims> {
    await waitForHttp(`${this.baseUrl}/health`);
    const response = await fetch(`${this.baseUrl}/realms/translucid/protocol/openid-connect/token/introspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    });
    if (!response.ok) {
      throw new Error(`token introspection failed: ${response.status}`);
    }
    return (await response.json()) as TokenClaims;
  }

  async issueToken(input: {
    userId: string;
    orgId: string;
    sessionId: string;
    loginEventId: string;
    expiresInSeconds?: number;
    riskRole?: "standard" | "high";
  }): Promise<string> {
    await waitForHttp(`${this.baseUrl}/health`);
    const response = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      throw new Error(`token issue failed: ${response.status}`);
    }
    return ((await response.json()) as { access_token: string }).access_token;
  }
}

export function makeFixtureToken(input: {
  userId: string;
  orgId: string;
  sessionId: string;
  loginEventId: string;
  expiresInSeconds?: number;
  riskRole?: "standard" | "high";
}): string {
  const expiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 3600) * 1000).toISOString();
  const claims: TokenClaims = {
    active: true,
    userId: input.userId,
    orgId: input.orgId,
    sessionId: input.sessionId,
    loginEventId: input.loginEventId,
    expiresAt,
    riskRole: input.riskRole ?? "standard"
  };
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `fixture.${encoded}.sig`;
}

async function waitForHttp(url: string, attempts = 40): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`http service not ready at ${url}: ${String(lastError)}`);
}

