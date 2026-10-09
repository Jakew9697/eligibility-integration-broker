import type { ProgramResult } from "./contracts";
import { PROGRAM_NAMES, REASON_CATALOG, STATUS_BY_DETERMINATION, headline } from "./rules/catalog";
import { SoapFault, parseDetermineResponse } from "./soap";

/** Turns the legacy SOAP response (program and reason codes) into the gateway's JSON results. */
export function transformDetermineResponse(xml: string): ProgramResult[] {
  return parseDetermineResponse(xml).map((p) => {
    const status = STATUS_BY_DETERMINATION[p.determination];
    return {
      program: p.program,
      programName: PROGRAM_NAMES[p.program],
      status,
      headline: headline(p.program, status),
      reasons: p.reasons.map((r) => {
        const entry = REASON_CATALOG[r.code];
        if (!entry) throw new SoapFault("soap:Server", `The legacy service returned a reason code this broker does not know: ${r.code}.`);
        const parts = entry.parts(r.params);
        return { code: r.code, text: `What we found: ${parts.found} Why: ${parts.why} What you can do: ${parts.action}`, parts, policy: entry.policy };
      }),
    };
  });
}
