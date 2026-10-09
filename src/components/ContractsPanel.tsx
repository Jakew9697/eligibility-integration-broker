"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ScreeningRequest, ScreeningResponse } from "@/broker/contracts";

const WSDL_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/legacy-eligibility.wsdl`;

function Code({ label, text }: { label: string; text: string }) {
  return (
    <pre className="codeblock nowrap" tabIndex={0} aria-label={label} style={{ maxHeight: "26rem" }}>
      {text}
    </pre>
  );
}

export function ContractsPanel() {
  const schemas = useMemo(
    () => ({
      request: JSON.stringify(z.toJSONSchema(ScreeningRequest, { io: "input" }), null, 2),
      response: JSON.stringify(z.toJSONSchema(ScreeningResponse), null, 2),
    }),
    [],
  );
  const [wsdl, setWsdl] = useState("Loading the WSDL...");

  useEffect(() => {
    let alive = true;
    fetch(WSDL_URL)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => alive && setWsdl(t))
      .catch(() => alive && setWsdl("The WSDL could not be loaded. It ships as public/legacy-eligibility.wsdl."));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <section aria-labelledby="c-req">
        <h3 id="c-req" className="text-base font-bold">Gateway request: POST /v1/screenings</h3>
        <p className="mb-2 mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>JSON Schema generated from the Zod schema the gateway validates with.</p>
        <Code label="Gateway request JSON Schema" text={schemas.request} />
      </section>
      <section aria-labelledby="c-res">
        <h3 id="c-res" className="text-base font-bold">Gateway response</h3>
        <p className="mb-2 mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>Generated from the same module. The gateway parses its own answer with this schema before it sends it.</p>
        <Code label="Gateway response JSON Schema" text={schemas.response} />
      </section>
      <section aria-labelledby="c-wsdl">
        <h3 id="c-wsdl" className="text-base font-bold">Legacy service: SOAP 1.1 WSDL</h3>
        <p className="mb-2 mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>One operation, DetermineEligibility, at POST /legacy/EligibilityService.</p>
        <Code label="Legacy service WSDL" text={wsdl} />
      </section>
    </div>
  );
}
