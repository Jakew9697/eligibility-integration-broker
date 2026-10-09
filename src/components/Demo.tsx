"use client";

import { useEffect, useRef, useState } from "react";
import { createBroker, type Broker } from "@/broker";
import type { AuditEntry } from "@/broker/audit";
import { emptyForm, toRequest, type FormState } from "@/lib/form";
import { runScreening, type RunOutcome } from "@/lib/runner";
import { SAMPLES } from "@/lib/samples";
import { AuditPanel } from "./AuditPanel";
import { ContractsPanel } from "./ContractsPanel";
import { Results } from "./Results";
import { ScreeningForm, type FieldIssue } from "./ScreeningForm";
import { Tabs } from "./Tabs";
import { TracePanel } from "./TracePanel";

export function Demo() {
  const [broker, setBroker] = useState<Broker | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sample, setSample] = useState<string | null>(null);
  const [wrongClient, setWrongClient] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState("trace");
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLHeadingElement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<"summary" | "results" | null>(null);

  useEffect(() => {
    let alive = true;
    createBroker().then((b) => alive && setBroker(b));
    return () => {
      alive = false;
    };
  }, []);

  // Move focus after the new content is in the DOM.
  useEffect(() => {
    if (!pendingFocus) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (pendingFocus === "summary") summaryRef.current?.focus();
    else {
      resultsRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      resultsRef.current?.focus({ preventScroll: true });
    }
    setPendingFocus(null);
  }, [pendingFocus]);

  async function submit() {
    if (!broker) return;
    setRunning(true);
    const result = await runScreening(broker, toRequest(form), wrongClient);
    setOutcome(result);
    setAudit(broker.audit.entries());
    setIssues(result.status === 400 ? (result.error?.fieldErrors ?? []) : []);
    setRunning(false);
    setPendingFocus(result.status === 400 ? "summary" : "results");
  }

  function loadSample(key: string) {
    const s = SAMPLES.find((x) => x.key === key);
    if (!s) return;
    setForm(structuredClone(s.form));
    setSample(key);
    setIssues([]);
  }

  function edit(next: FormState) {
    setForm(next);
    setSample(null);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-6">
        <section aria-labelledby="samples-title" className="card">
          <h2 id="samples-title" className="text-xl font-bold">
            Sample households
          </h2>
          <p className="mb-3 mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
            Each button fills the form. Then choose Run screening.
          </p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {SAMPLES.map((s) => (
              <li key={s.key}>
                <button type="button" className="sample-btn" aria-pressed={sample === s.key} onClick={() => loadSample(s.key)}>
                  <span className="block font-bold">{s.title}</span>
                  <span className="mt-0.5 block text-sm" style={{ color: "var(--ink-soft)" }}>
                    {s.summary}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="form-title" className="card">
          <h2 id="form-title" className="mb-4 text-xl font-bold">
            Screening request
          </h2>
          <ScreeningForm
            form={form}
            onChange={edit}
            issues={issues}
            summaryRef={summaryRef}
            wrongClient={wrongClient}
            onWrongClient={setWrongClient}
            ready={broker !== null}
            running={running}
            onSubmit={submit}
            onReset={() => {
              setForm(emptyForm());
              setSample(null);
              setIssues([]);
            }}
          />
        </section>
      </div>

      <div className="grid min-w-0 gap-6">
        <section aria-labelledby="results-title">
          <h2 id="results-title" ref={resultsRef} tabIndex={-1} className="mb-3 text-xl font-bold">
            Results
          </h2>
          <div aria-live="polite" aria-atomic="false" id="results-live">
            <Results outcome={outcome} />
          </div>
        </section>

        <section aria-label="How the request moved" className="card">
          <Tabs
            label="Trace, contracts and audit"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "trace", label: "Trace", content: <TracePanel hops={outcome?.hops ?? []} /> },
              { id: "contracts", label: "Contracts", content: <ContractsPanel /> },
              { id: "audit", label: "Audit", content: <AuditPanel entries={audit} /> },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
