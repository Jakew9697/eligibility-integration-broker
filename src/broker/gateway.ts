import type { AuditLog } from "./audit";
import { ErrorBody, ScreeningRequest, ScreeningResponse, type ProgramResult, type TraceStep } from "./contracts";
import { CORRELATION_HEADER, json, pickCorrelationId, type Handler } from "./http";
import type { OAuthServer } from "./oauth";
import { STATUS_LABELS } from "./rules/catalog";
import type { RuleInput, WageVerification } from "./rules/types";
import { INCOME_PATH } from "./services/income";
import { LEGACY_PATH, SOAP_ACTION, SoapFault, buildDetermineRequest, parseFault } from "./soap";
import { transformDetermineResponse } from "./transform";
import type { StepInput } from "./transport";

export const GATEWAY_PATH = "/v1/screenings";
export const REQUIRED_SCOPE = "screening:write";
const BASE = "http://broker.local";
const REALM = 'realm="eligibility-gateway"';

export interface GatewayDeps {
  /** Every downstream call goes through this, so a transport can record it. */
  fetch: Handler;
  oauth: Pick<OAuthServer, "verify">;
  audit: Pick<AuditLog, "append">;
  recordStep?: (step: StepInput) => void;
}

class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Puts the person in the message so a list of errors says who each one is about. */
function namePerson(path: PropertyKey[], message: string): string {
  const person = path[0] === "members" && typeof path[1] === "number" ? `Person ${path[1] + 1}, ` : "";
  return person ? person + message.charAt(0).toLowerCase() + message.slice(1) : message;
}

const ms = (since: number) => performance.now() - since;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function createGateway(deps: GatewayDeps): Handler {
  return async (req) => {
    const correlationId = pickCorrelationId(req.headers.get(CORRELATION_HEADER));
    let clientId = "anonymous";

    const reject = async (status: number, error: string, message: string, outcome: string, extra: { fieldErrors?: ErrorBody["fieldErrors"]; headers?: Record<string, string> } = {}) => {
      await deps.audit.append({ correlationId, clientId, action: "screening.request", outcome: `${outcome} (${status})` });
      const body: ErrorBody = { error, message, correlationId, ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}) };
      return json(body, status, { [CORRELATION_HEADER]: correlationId, ...extra.headers });
    };

    if (req.method !== "POST") return reject(405, "method_not_allowed", "Use POST.", "rejected: wrong method", { headers: { Allow: "POST" } });

    // 1. Token and scope
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
    if (!bearer) {
      return reject(401, "unauthorized", "Send an access token as Authorization: Bearer <token>.", "denied: no token", { headers: { "WWW-Authenticate": `Bearer ${REALM}` } });
    }
    try {
      const token = await deps.oauth.verify(bearer);
      clientId = token.clientId;
      if (!token.scopes.includes(REQUIRED_SCOPE)) {
        return reject(403, "insufficient_scope", `This token does not carry the ${REQUIRED_SCOPE} scope.`, `denied: missing ${REQUIRED_SCOPE}`, {
          headers: { "WWW-Authenticate": `Bearer ${REALM}, error="insufficient_scope", scope="${REQUIRED_SCOPE}"` },
        });
      }
    } catch {
      return reject(401, "invalid_token", "The access token is not valid or has expired. Request a new one.", "denied: invalid token", {
        headers: { "WWW-Authenticate": `Bearer ${REALM}, error="invalid_token"` },
      });
    }

    // 2. Validate the body
    const parsed = ScreeningRequest.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: namePerson(i.path, i.message) }));
      const message = fieldErrors.length ? `The request has ${fieldErrors.length === 1 ? "1 problem" : `${fieldErrors.length} problems`}. Fix the fields listed and send it again.` : "The request body must be JSON.";
      return reject(400, "invalid_request", message, "rejected: invalid body", { fieldErrors });
    }
    const request = parsed.data;

    // 3. Call the income service, then the legacy service
    const trace: TraceStep[] = [];
    const headers = { [CORRELATION_HEADER]: correlationId };
    const timed = async (step: string, method: string, path: string, call: () => Promise<Response>) => {
      const started = performance.now();
      const res = await call();
      trace.push({ step, method, path, status: res.status, ms: round1(ms(started)) });
      return res;
    };

    try {
      let wages: WageVerification = { status: "not-requested" };
      if (request.applicantRef) {
        const res = await timed("Income service (REST)", "POST", INCOME_PATH, () =>
          deps.fetch(new Request(BASE + INCOME_PATH, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ applicantRef: request.applicantRef }) })),
        );
        if (!res.ok) throw new UpstreamError(`The income verification service answered with HTTP ${res.status}.`);
        const income = (await res.json()) as { status: string; monthlyWages: number | null };
        wages = income.status === "verified" && income.monthlyWages !== null ? { status: "verified", monthlyWages: income.monthlyWages } : { status: "no-record" };
      }

      const ruleInput: RuleInput = {
        householdSize: request.householdSize,
        members: request.members.map((m) => ({ age: m.age, disabled: m.disabled, earned: m.earnedIncome, unearned: m.unearnedIncome })),
        shelterCost: request.shelterCost,
        dependentCareCost: request.dependentCareCost,
        wages,
      };
      const envelope = buildDetermineRequest(ruleInput, correlationId);
      const legacy = await timed("Legacy eligibility service (SOAP)", "POST", LEGACY_PATH, () =>
        deps.fetch(new Request(BASE + LEGACY_PATH, { method: "POST", headers: { ...headers, "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${SOAP_ACTION}"` }, body: envelope })),
      );
      const xml = await legacy.text();
      if (!legacy.ok) {
        const fault = parseFault(xml);
        throw new UpstreamError(
          fault ? `The legacy eligibility service rejected the request (${fault.faultcode}): ${fault.faultstring}` : `The legacy eligibility service answered with HTTP ${legacy.status}.`,
        );
      }

      // 4. Transform the XML into JSON
      const transformStart = performance.now();
      let results: ProgramResult[];
      try {
        results = transformDetermineResponse(xml);
      } catch (err) {
        throw new UpstreamError(`The legacy response could not be read: ${err instanceof Error ? err.message : "unknown error"}`);
      }
      const transformMs = round1(ms(transformStart));
      trace.push({ step: "Transform (XML to JSON)", method: "TRANSFORM", path: "soap-response -> screening-result", status: 200, ms: transformMs });
      deps.recordStep?.({ name: "Transform (XML to JSON)", method: "TRANSFORM", path: "soap-response -> screening-result", status: 200, ms: transformMs, correlationId, requestBody: xml, responseBody: JSON.stringify(results, null, 2) });

      // 5. Audit, then answer
      const auditStart = performance.now();
      const summary = results.map((r) => `${r.program} ${STATUS_LABELS[r.status]}`).join(", ");
      const entry = await deps.audit.append({ correlationId, clientId, action: "screening.request", outcome: `accepted: ${summary} (200)` });
      deps.recordStep?.({
        name: "Audit log",
        method: "APPEND",
        path: "audit/chain",
        status: 200,
        ms: round1(ms(auditStart)),
        correlationId,
        requestBody: JSON.stringify({ correlationId, clientId, action: entry.action, outcome: entry.outcome }, null, 2),
        responseBody: JSON.stringify(entry, null, 2),
      });
      return json(ScreeningResponse.parse({ correlationId, results, trace }), 200, headers);
    } catch (err) {
      if (err instanceof UpstreamError || err instanceof SoapFault || err instanceof TypeError) {
        const detail = err instanceof TypeError ? "A downstream service could not be reached." : err.message;
        return reject(502, "upstream_error", detail, "failed: downstream service");
      }
      throw err;
    }
  };
}
