import { SignJWT, jwtVerify } from "jose";
import type { AuditLog } from "./audit";
import { CORRELATION_HEADER, json, pickCorrelationId, randomHex, type Handler } from "./http";

const ISSUER = "eligibility-broker-demo";
const AUDIENCE = "eligibility-gateway";
const TOKEN_LIFETIME_SECONDS = 300;

export interface DemoClient {
  id: string;
  secret: string;
  name: string;
  scopes: string[];
}

export interface VerifiedToken {
  clientId: string;
  scopes: string[];
}

export interface OAuthServer {
  handler: Handler;
  verify(token: string): Promise<VerifiedToken>;
  clients: DemoClient[];
}

/** Credentials are generated each time the broker starts. Nothing here is a stored secret. */
function generateClient(name: string, scopes: string[]): DemoClient {
  return { id: `${name}-${randomHex(3)}`, secret: randomHex(24), name, scopes };
}

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function oauthError(status: number, error: string, description: string, correlationId: string): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store", [CORRELATION_HEADER]: correlationId };
  if (status === 401) headers["WWW-Authenticate"] = 'Basic realm="token"';
  return json({ error, error_description: description }, status, headers);
}

function readCredentials(req: Request, form: URLSearchParams): { id: string; secret: string } | null {
  const basic = /^Basic\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (basic?.[1]) {
    try {
      const decoded = atob(basic[1]);
      const colon = decoded.indexOf(":");
      if (colon > 0) return { id: decodeURIComponent(decoded.slice(0, colon)), secret: decodeURIComponent(decoded.slice(colon + 1)) };
    } catch {
      return null;
    }
    return null;
  }
  const id = form.get("client_id");
  const secret = form.get("client_secret");
  return id && secret ? { id, secret } : null;
}

export async function createOAuth(audit: Pick<AuditLog, "append">): Promise<OAuthServer> {
  const key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const clients = [generateClient("screening-portal", ["screening:write"]), generateClient("reporting-tool", ["reports:read"])];

  const handler: Handler = async (req) => {
    const correlationId = pickCorrelationId(req.headers.get(CORRELATION_HEADER));
    if (req.method !== "POST") return oauthError(405, "invalid_request", "Use POST.", correlationId);
    if (!(req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
      return oauthError(400, "invalid_request", "Send the request as application/x-www-form-urlencoded.", correlationId);
    }
    const form = new URLSearchParams(await req.text());

    const creds = readCredentials(req, form);
    const client = creds && clients.find((c) => safeEqual(c.id, creds.id));
    if (!creds || !client || !safeEqual(client.secret, creds.secret)) {
      await audit.append({ correlationId, clientId: creds?.id ?? "anonymous", action: "token.issue", outcome: "denied: invalid client credentials (401)" });
      return oauthError(401, "invalid_client", "Client authentication failed.", correlationId);
    }
    if (form.get("grant_type") !== "client_credentials") {
      return oauthError(400, "unsupported_grant_type", "Only client_credentials is supported.", correlationId);
    }
    const requested = form.get("scope")?.split(/\s+/).filter(Boolean) ?? client.scopes;
    if (!requested.every((s) => client.scopes.includes(s))) {
      await audit.append({ correlationId, clientId: client.id, action: "token.issue", outcome: "denied: scope not allowed for this client (400)" });
      return oauthError(400, "invalid_scope", `This client may only request: ${client.scopes.join(" ")}.`, correlationId);
    }

    const token = await new SignJWT({ scope: requested.join(" ") })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(client.id)
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`)
      .sign(key);

    await audit.append({ correlationId, clientId: client.id, action: "token.issue", outcome: `issued: ${requested.join(" ")} (200)` });
    return json(
      { access_token: token, token_type: "Bearer", expires_in: TOKEN_LIFETIME_SECONDS, scope: requested.join(" ") },
      200,
      { "Cache-Control": "no-store", [CORRELATION_HEADER]: correlationId },
    );
  };

  async function verify(token: string): Promise<VerifiedToken> {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return { clientId: String(payload.sub), scopes: String(payload.scope ?? "").split(" ").filter(Boolean) };
  }

  return { handler, verify, clients };
}
