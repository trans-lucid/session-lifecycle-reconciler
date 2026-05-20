import { createServer } from "node:http";

const port = Number(process.env.KEYCLOAK_SIM_PORT ?? 8085);

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data ? JSON.parse(data) : {});
    });
  });
}

function makeToken(input) {
  const claims = {
    active: true,
    userId: input.userId,
    orgId: input.orgId,
    sessionId: input.sessionId,
    loginEventId: input.loginEventId,
    expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 3600) * 1000).toISOString(),
    riskRole: input.riskRole ?? "standard"
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `sim.${payload}.sig`;
}

function decodeToken(token) {
  const payload = token.includes(".") ? token.split(".")[1] : token;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, service: "keycloak-compatible-simulator" });
  }
  if (req.method === "POST" && req.url === "/token") {
    const body = await readBody(req);
    return json(res, 200, { access_token: makeToken(body), token_type: "Bearer" });
  }
  if (req.method === "POST" && req.url === "/realms/translucid/protocol/openid-connect/token/introspect") {
    const body = await readBody(req);
    const claims = decodeToken(body.token);
    claims.active = claims.active && new Date(claims.expiresAt) > new Date();
    return json(res, 200, claims);
  }
  return json(res, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`keycloak-compatible simulator listening on ${port}`);
});

