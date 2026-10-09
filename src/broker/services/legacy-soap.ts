import { CORRELATION_HEADER, pickCorrelationId, type Handler } from "../http";
import { determine } from "../rules";
import { LEGACY_PATH, SOAP_ACTION, SoapFault, buildDetermineResponse, buildFault, parseDetermineRequest } from "../soap";

export { LEGACY_PATH };

const XML_HEADERS = { "Content-Type": "text/xml; charset=utf-8" };

/** The older eligibility system: SOAP 1.1 over HTTP, one operation, rules applied here. */
export function createLegacyService(): Handler {
  return async (req) => {
    const headers = { ...XML_HEADERS, [CORRELATION_HEADER]: pickCorrelationId(req.headers.get(CORRELATION_HEADER)) };
    const fault = (f: SoapFault) => new Response(buildFault(f), { status: 500, headers });
    try {
      if (req.method !== "POST") return new Response("POST a SOAP 1.1 envelope.", { status: 405, headers: { Allow: "POST" } });
      const action = (req.headers.get("soapaction") ?? "").replace(/^"|"$/g, "");
      if (action !== SOAP_ACTION) throw new SoapFault("soap:Client", `Missing or unknown SOAPAction. Expected "${SOAP_ACTION}".`);
      const input = parseDetermineRequest(await req.text());
      return new Response(buildDetermineResponse(determine(input)), { status: 200, headers });
    } catch (err) {
      return fault(err instanceof SoapFault ? err : new SoapFault("soap:Server", "The eligibility service failed while processing the request."));
    }
  };
}
