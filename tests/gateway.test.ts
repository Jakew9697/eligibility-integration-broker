import { describe, expect, it } from "vitest";
import { ScreeningResponse } from "../src/broker/contracts";
import { BASE, createBroker, getToken, screen, screeningBody } from "./helpers";

const asJson = async (res: Response) => (await res.json()) as Record<string, any>;

describe("token service", () => {
  it("issues a bearer JWT for valid client credentials, from Basic auth or the body", async () => {
    const broker = await createBroker();
    const c = broker.clients[0]!;
    const body = `grant_type=client_credentials&client_id=${c.id}&client_secret=${c.secret}`;
    const res = await broker.fetch(new Request(`${BASE}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }));
    const json = await asJson(res);
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ token_type: "Bearer", scope: "screening:write" });
    expect(json.access_token.split(".")).toHaveLength(3);
  });

  it("rejects a wrong secret, an unknown grant type and a scope the client does not hold", async () => {
    const broker = await createBroker();
    const c = broker.clients[0]!;
    const post = (auth: string, body: string) =>
      broker.fetch(new Request(`${BASE}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: auth }, body }));
    expect((await post(`Basic ${btoa(`${c.id}:wrong`)}`, "grant_type=client_credentials")).status).toBe(401);
    const good = `Basic ${btoa(`${c.id}:${c.secret}`)}`;
    expect((await post(good, "grant_type=password")).status).toBe(400);
    expect((await post(good, "grant_type=client_credentials&scope=reports:read")).status).toBe(400);
  });

  it("generates different credentials every time the broker starts", async () => {
    const a = await createBroker();
    const b = await createBroker();
    expect(a.clients[0]!.secret).not.toBe(b.clients[0]!.secret);
    expect(a.clients[0]!.secret).toMatch(/^[0-9a-f]{48}$/);
  });
});

describe("T5 gateway authentication and validation", () => {
  it("no token gets 401 with WWW-Authenticate", async () => {
    const broker = await createBroker();
    const res = await screen(broker, screeningBody());
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
  });

  it("a garbage token gets 401 invalid_token", async () => {
    const broker = await createBroker();
    const res = await screen(broker, screeningBody(), "not.a.jwt");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/invalid_token/);
  });

  it("a token without screening:write gets 403", async () => {
    const broker = await createBroker();
    const token = await getToken(broker, "reporting-tool");
    const res = await screen(broker, screeningBody(), token);
    expect(res.status).toBe(403);
    expect(res.headers.get("www-authenticate")).toMatch(/insufficient_scope/);
    expect((await asJson(res)).error).toBe("insufficient_scope");
  });

  it("a malformed body gets 400 with field-level errors", async () => {
    const broker = await createBroker();
    const token = await getToken(broker);
    const res = await screen(broker, { ...screeningBody(), householdSize: 1, members: [{ age: 200, disabled: false }], shelterCost: -5 }, token);
    expect(res.status).toBe(400);
    const body = await asJson(res);
    const paths = body.fieldErrors.map((e: { path: string }) => e.path);
    expect(paths).toContain("members.0.age");
    expect(paths).toContain("shelterCost");
    expect(body.fieldErrors.every((e: { message: string }) => e.message.length > 0)).toBe(true);
  });

  it("rejects bodies that are not JSON, and a household size that does not match the members", async () => {
    const broker = await createBroker();
    const token = await getToken(broker);
    expect((await screen(broker, "{nope", token)).status).toBe(400);
    const res = await screen(broker, screeningBody({ householdSize: 3 }), token);
    expect(res.status).toBe(400);
    expect((await asJson(res)).fieldErrors[0].path).toBe("members");
  });

  it("returns the screening for a valid request", async () => {
    const broker = await createBroker();
    const res = await screen(broker, screeningBody(), await getToken(broker));
    expect(res.status).toBe(200);
    const body = ScreeningResponse.parse(await res.json());
    expect(body.results.map((r) => [r.program, r.status])).toEqual([["FAP", "likely-eligible"], ["HMP", "likely-eligible"]]);
    for (const r of body.results) {
      expect(r.reasons.length).toBeGreaterThan(0);
      expect(r.reasons[0]?.policy.url).toMatch(/^https:\/\/mdhhs-pres-prod\.michigan\.gov\/olmweb\/EX\/(BP\/Public\/BEM|RF\/Public\/RFT)\/\d+\.pdf$/);
    }
  });
});

describe("T6 one correlation ID on every hop", () => {
  it("uses the caller's ID on the token call, gateway, income, SOAP and in the response", async () => {
    const broker = await createBroker();
    const id = "test-correlation-0001";
    const token = await getToken(broker, "screening-portal", id);
    const res = await screen(broker, screeningBody(), token, { "X-Correlation-ID": id });
    expect((await asJson(res)).correlationId).toBe(id);
    expect(res.headers.get("x-correlation-id")).toBe(id);

    const hops = broker.transport.hops();
    expect(hops.map((h) => h.name)).toEqual([
      "Token service (OAuth 2.0)",
      "Gateway",
      "Income service (REST)",
      "Legacy eligibility service (SOAP)",
      "Transform (XML to JSON)",
      "Audit log",
    ]);
    for (const hop of hops) expect(hop.correlationId, hop.name).toBe(id);
    for (const hop of hops.filter((h) => h.kind === "http")) expect(hop.request.headers["x-correlation-id"], hop.name).toBe(id);
    const soap = hops.find((h) => h.path === "/legacy/EligibilityService")!;
    expect(soap.request.body).toContain(`<el:CorrelationId>${id}</el:CorrelationId>`);
  });

  it("creates one when the caller sends none and passes it downstream", async () => {
    const broker = await createBroker();
    const res = await screen(broker, screeningBody(), await getToken(broker));
    const id = (await asJson(res)).correlationId as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const downstream = broker.transport.hops().filter((h) => h.path === "/income/v1/verifications" || h.path === "/legacy/EligibilityService");
    expect(downstream).toHaveLength(2);
    for (const hop of downstream) expect(hop.request.headers["x-correlation-id"]).toBe(id);
  });

  it("ignores an unsafe caller-supplied ID", async () => {
    const broker = await createBroker();
    const res = await screen(broker, screeningBody(), await getToken(broker), { "X-Correlation-ID": "bad id<script>" });
    expect((await asJson(res)).correlationId).not.toContain("<");
  });
});

describe("T7 legacy SOAP fault becomes a 502", () => {
  const legacyPath = `${BASE}/legacy/EligibilityService`;
  const soapPost = (broker: Awaited<ReturnType<typeof createBroker>>, body: string, action = '"DetermineEligibility"') =>
    broker.fetch(new Request(legacyPath, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: action }, body }));

  it("the service answers an invalid envelope with a SOAP 1.1 Fault, soap:Client, HTTP 500", async () => {
    const broker = await createBroker();
    for (const bad of ["<not-xml", "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body/></soap:Envelope>", "<a/>"]) {
      const res = await soapPost(broker, bad);
      const xml = await res.text();
      expect(res.status).toBe(500);
      expect(xml).toContain("<faultcode>soap:Client</faultcode>");
      expect(xml).toContain("<soap:Fault>");
      expect(xml).toMatch(/<faultstring>.+<\/faultstring>/);
    }
  });

  it("rejects a missing SOAPAction and DTDs", async () => {
    const broker = await createBroker();
    expect((await soapPost(broker, "<a/>", "")).status).toBe(500);
    const dtd = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e "boom">]><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>';
    expect(await (await soapPost(broker, dtd)).text()).toContain("DTDs");
  });

  it("the gateway maps the fault to 502 with a readable JSON error", async () => {
    // A contract change on the legacy side: it now sees a body it cannot parse.
    const broker = await createBroker({ override: (real) => ({ legacy: (req) => real.legacy(new Request(req.url, { method: req.method, headers: req.headers, body: "<broken" })) }) });
    const res = await screen(broker, screeningBody(), await getToken(broker));
    expect(res.status).toBe(502);
    const body = await asJson(res);
    expect(body.error).toBe("upstream_error");
    expect(body.message).toMatch(/soap:Client/);
    expect(body.message).toMatch(/not well-formed/);
    expect(body.correlationId).toBeTruthy();
  });

  it("maps an unreachable income service to 502 too", async () => {
    const broker = await createBroker({ override: () => ({ income: async () => new Response("down", { status: 503 }) }) });
    const res = await screen(broker, screeningBody(), await getToken(broker));
    expect(res.status).toBe(502);
    expect((await asJson(res)).message).toMatch(/income verification service/);
  });
});

describe("T8 wage mismatch through the gateway", () => {
  it("reported wages $800 above the wage record make FAP needs-review and mention pay stubs", async () => {
    const broker = await createBroker();
    const body = screeningBody({ householdSize: 2, members: [{ age: 29, disabled: false, earnedIncome: 1900, unearnedIncome: 0 }, { age: 5, disabled: false, earnedIncome: 0, unearnedIncome: 0 }], applicantRef: "SAMPLE-D" });
    const res = await screen(broker, body, await getToken(broker));
    const fap = ScreeningResponse.parse(await res.json()).results[0]!;
    expect(fap.status).toBe("needs-review");
    expect(fap.reasons[0]?.text).toMatch(/pay stubs/);
  });

  it("an unknown reference is not a mismatch", async () => {
    const broker = await createBroker();
    const res = await screen(broker, screeningBody({ applicantRef: "SAMPLE-C", members: [{ age: 40, disabled: false, earnedIncome: 1900, unearnedIncome: 0 }] }), await getToken(broker));
    expect(ScreeningResponse.parse(await res.json()).results[0]?.status).toBe("likely-eligible");
  });

  it("no reference skips the income service", async () => {
    const broker = await createBroker();
    const { applicantRef: _omit, ...noRef } = screeningBody();
    await screen(broker, noRef, await getToken(broker));
    expect(broker.transport.hops().some((h) => h.path === "/income/v1/verifications")).toBe(false);
  });
});

describe("audit through the gateway", () => {
  it("records token, rejections and screenings in one verifiable chain without household answers", async () => {
    const broker = await createBroker();
    const token = await getToken(broker);
    await screen(broker, screeningBody(), token);
    await screen(broker, screeningBody());
    await screen(broker, "{}", token);
    const entries = broker.audit.entries();
    expect(entries.map((e) => e.outcome)).toEqual([
      "issued: screening:write (200)",
      "accepted: FAP likely-eligible, HMP likely-eligible (200)",
      "denied: no token (401)",
      "rejected: invalid body (400)",
    ]);
    expect(JSON.stringify(entries)).not.toContain("1100");
    expect(await broker.audit.verify()).toBeNull();
  });
});

describe("trace redaction", () => {
  it("never records the client secret or a whole token", async () => {
    const broker = await createBroker();
    const secret = broker.clients[0]!.secret;
    const token = await getToken(broker);
    await screen(broker, screeningBody(), token);
    const dump = JSON.stringify(broker.transport.hops());
    expect(dump).not.toContain(secret);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(btoa(`${broker.clients[0]!.id}:${secret}`));
  });
});
