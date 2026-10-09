import { IncomeVerificationRequest, type IncomeVerificationResponse } from "../contracts";
import { CORRELATION_HEADER, json, pickCorrelationId, type Handler } from "../http";

export const INCOME_PATH = "/income/v1/verifications";

/** Made-up wage records, one quarter of total wages per reference. */
const QUARTER = "2026-Q3";
const WAGE_RECORDS: Record<string, number> = {
  "SAMPLE-A": 3300,
  "SAMPLE-B": 12600,
  "SAMPLE-D": 3300,
};

/** A small REST service: POST a reference, get back verified monthly wages or "no record found". */
export function createIncomeService(): Handler {
  return async (req) => {
    const headers = { [CORRELATION_HEADER]: pickCorrelationId(req.headers.get(CORRELATION_HEADER)) };
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, { ...headers, Allow: "POST" });

    const parsed = IncomeVerificationRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid_request", message: "Send JSON like {\"applicantRef\": \"SAMPLE-A\"}." }, 400, headers);

    const ref = parsed.data.applicantRef;
    const quarterly = Object.hasOwn(WAGE_RECORDS, ref) ? WAGE_RECORDS[ref] : undefined;
    const body: IncomeVerificationResponse =
      quarterly === undefined
        ? { applicantRef: ref, status: "no-record", monthlyWages: null, quarter: null, source: "Quarterly wage record (made up). No record found." }
        : { applicantRef: ref, status: "verified", monthlyWages: Math.round((quarterly / 3) * 100) / 100, quarter: QUARTER, source: "Quarterly wage record (made up)" };
    return json(body, 200, headers);
  };
}
