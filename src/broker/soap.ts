import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import type { Determination, ProgramCode, ProgramDetermination, ReasonCode, RuleInput } from "./rules/types";

export const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
export const ELIGIBILITY_NS = "urn:demo:eligibility:v1";
export const SOAP_ACTION = "DetermineEligibility";
export const LEGACY_PATH = "/legacy/EligibilityService";

export class SoapFault extends Error {
  constructor(
    public faultcode: "soap:Client" | "soap:Server",
    public faultstring: string,
  ) {
    super(faultstring);
  }
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => ["Member", "Program", "Reason", "Param"].includes(name),
});

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
const ENVELOPE_OPEN = `<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:el="${ELIGIBILITY_NS}">`;

export function buildDetermineRequest(input: RuleInput, correlationId: string): string {
  const members = input.members
    .map(
      (m) => `        <el:Member>
          <el:Age>${m.age}</el:Age>
          <el:Disabled>${m.disabled}</el:Disabled>
          <el:EarnedIncome>${m.earned}</el:EarnedIncome>
          <el:UnearnedIncome>${m.unearned}</el:UnearnedIncome>
        </el:Member>`,
    )
    .join("\n");
  const wages =
    input.wages.status === "verified"
      ? `<el:Status>VERIFIED</el:Status>\n        <el:MonthlyWages>${input.wages.monthlyWages}</el:MonthlyWages>`
      : `<el:Status>${input.wages.status === "no-record" ? "NO_RECORD" : "NOT_REQUESTED"}</el:Status>`;
  return `${HEAD}
${ENVELOPE_OPEN}
  <soap:Header>
    <el:CorrelationId>${escapeXml(correlationId)}</el:CorrelationId>
  </soap:Header>
  <soap:Body>
    <el:DetermineEligibilityRequest>
      <el:HouseholdSize>${input.householdSize}</el:HouseholdSize>
      <el:Members>
${members}
      </el:Members>
      <el:ShelterCost>${input.shelterCost}</el:ShelterCost>
      <el:DependentCareCost>${input.dependentCareCost}</el:DependentCareCost>
      <el:WageVerification>
        ${wages}
      </el:WageVerification>
    </el:DetermineEligibilityRequest>
  </soap:Body>
</soap:Envelope>`;
}

function envelopeBody(xml: string): Record<string, unknown> {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new SoapFault("soap:Client", "DTDs and entity declarations are not accepted.");
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new SoapFault("soap:Client", `The message is not well-formed XML: ${valid.err.msg} (line ${valid.err.line}).`);
  if (!xml.includes(SOAP_NS)) throw new SoapFault("soap:Client", `Expected a SOAP 1.1 envelope in the ${SOAP_NS} namespace.`);
  const body = (parser.parse(xml) as { Envelope?: { Body?: Record<string, unknown> } }).Envelope?.Body;
  if (!body || typeof body !== "object") throw new SoapFault("soap:Client", "The envelope has no Body.");
  return body;
}

const decimal = z.string().regex(/^\d+(\.\d{1,2})?$/, "must be a non-negative amount").transform(Number);
const whole = z.string().regex(/^\d+$/, "must be a whole number").transform(Number);
const memberXml = z.object({
  Age: whole,
  Disabled: z.enum(["true", "false"]).transform((v) => v === "true"),
  EarnedIncome: decimal,
  UnearnedIncome: decimal,
});
const requestXml = z.object({
  HouseholdSize: whole,
  Members: z.object({ Member: z.array(memberXml).min(1) }),
  ShelterCost: decimal,
  DependentCareCost: decimal,
  WageVerification: z.object({
    Status: z.enum(["VERIFIED", "NO_RECORD", "NOT_REQUESTED"]),
    MonthlyWages: decimal.optional(),
  }),
});

export function parseDetermineRequest(xml: string): RuleInput {
  const op = envelopeBody(xml).DetermineEligibilityRequest;
  if (!op) throw new SoapFault("soap:Client", "The Body must contain a DetermineEligibilityRequest.");
  const parsed = requestXml.safeParse(op);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SoapFault("soap:Client", `Invalid DetermineEligibilityRequest: ${issue?.path.join("/") || "message"} ${issue?.message ?? "is not valid"}.`);
  }
  const r = parsed.data;
  const w = r.WageVerification;
  if (w.Status === "VERIFIED" && w.MonthlyWages === undefined) throw new SoapFault("soap:Client", "Invalid DetermineEligibilityRequest: WageVerification/MonthlyWages is required when Status is VERIFIED.");
  return {
    householdSize: r.HouseholdSize,
    members: r.Members.Member.map((m) => ({ age: m.Age, disabled: m.Disabled, earned: m.EarnedIncome, unearned: m.UnearnedIncome })),
    shelterCost: r.ShelterCost,
    dependentCareCost: r.DependentCareCost,
    wages: w.Status === "VERIFIED" ? { status: "verified", monthlyWages: w.MonthlyWages ?? 0 } : { status: w.Status === "NO_RECORD" ? "no-record" : "not-requested" },
  };
}

export function buildDetermineResponse(programs: ProgramDetermination[]): string {
  const body = programs
    .map((p) => {
      const reasons = p.reasons
        .map((r) => {
          const params = Object.entries(r.params)
            .map(([name, value]) => `            <el:Param name="${escapeXml(name)}">${escapeXml(value)}</el:Param>`)
            .join("\n");
          return `          <el:Reason code="${r.code}">\n${params}\n          </el:Reason>`;
        })
        .join("\n");
      return `        <el:Program code="${p.program}">
          <el:Determination>${p.determination}</el:Determination>
${reasons}
        </el:Program>`;
    })
    .join("\n");
  return `${HEAD}
${ENVELOPE_OPEN}
  <soap:Body>
    <el:DetermineEligibilityResponse>
${body}
    </el:DetermineEligibilityResponse>
  </soap:Body>
</soap:Envelope>`;
}

export function buildFault(fault: SoapFault): string {
  return `${HEAD}
<soap:Envelope xmlns:soap="${SOAP_NS}">
  <soap:Body>
    <soap:Fault>
      <faultcode>${fault.faultcode}</faultcode>
      <faultstring>${escapeXml(fault.faultstring)}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
}

/** Returns the fault if the message is a SOAP 1.1 Fault, otherwise null. Never throws. */
export function parseFault(xml: string): { faultcode: string; faultstring: string } | null {
  try {
    const fault = (parser.parse(xml) as { Envelope?: { Body?: { Fault?: { faultcode?: string; faultstring?: string } } } }).Envelope?.Body?.Fault;
    return fault ? { faultcode: String(fault.faultcode ?? ""), faultstring: String(fault.faultstring ?? "") } : null;
  } catch {
    return null;
  }
}

const programXml = z.object({
  "@_code": z.enum(["FAP", "HMP"]),
  Determination: z.enum(["ELIGIBLE", "INELIGIBLE", "REVIEW"]),
  Reason: z.array(
    z.object({
      "@_code": z.string(),
      Param: z.array(z.object({ "@_name": z.string(), "#text": z.string().optional() })).optional(),
    }),
  ),
});

export function parseDetermineResponse(xml: string): ProgramDetermination[] {
  const op = envelopeBody(xml).DetermineEligibilityResponse as { Program?: unknown } | undefined;
  const parsed = z.array(programXml).min(1).safeParse(op?.Program);
  if (!parsed.success) throw new SoapFault("soap:Server", "The response has no readable Program elements.");
  return parsed.data.map((p) => ({
    program: p["@_code"] as ProgramCode,
    determination: p.Determination as Determination,
    reasons: p.Reason.map((r) => ({
      code: r["@_code"] as ReasonCode,
      params: Object.fromEntries((r.Param ?? []).map((x) => [x["@_name"], x["#text"] ?? ""])),
    })),
  }));
}
