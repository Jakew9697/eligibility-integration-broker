import type { ProgramResult, ProgramStatus } from "@/broker/contracts";
import { formatDate } from "@/lib/format";
import type { RunOutcome } from "@/lib/runner";

const STATUS: Record<ProgramStatus, { label: string; className: string; icon: React.ReactNode }> = {
  "likely-eligible": {
    label: "Likely eligible",
    className: "pill-ok",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8.5l3.2 3.2L13 4.8" />
      </svg>
    ),
  },
  "likely-ineligible": {
    label: "Likely not eligible",
    className: "pill-no",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M3.5 8h9" />
      </svg>
    ),
  },
  "needs-review": {
    label: "Needs review",
    className: "pill-review",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M8 3v6M8 12.2v.1" />
      </svg>
    ),
  },
};

function ResultCard({ result, index }: { result: ProgramResult; index: number }) {
  const status = STATUS[result.status];
  return (
    <article className="card rise" style={{ animationDelay: `${index * 90}ms` }} aria-labelledby={`result-${result.program}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`result-${result.program}`} className="text-lg font-bold">
          {result.programName}
        </h3>
        <span className={`pill ${status.className}`}>
          {status.icon}
          {status.label}
        </span>
      </div>
      <p className="mt-1 font-semibold" style={{ color: "var(--ink-soft)" }}>
        {result.headline}
      </p>
      <div className="mt-3 grid gap-3">
        {result.reasons.map((reason) => (
          <div key={reason.code} className="card-inner reason">
            <dl className="m-0">
              <dt style={{ marginTop: 0 }}>What we found</dt>
              <dd>{reason.parts.found}</dd>
              <dt>Why</dt>
              <dd>{reason.parts.why}</dd>
              <dt>What you can do</dt>
              <dd>{reason.parts.action}</dd>
            </dl>
            <p className="mt-3 text-sm">
              Policy:{" "}
              <a className="policy-link" href={reason.policy.url} target="_blank" rel="noopener noreferrer">
                {reason.policy.manual} {reason.policy.item}, {reason.policy.title}
                <span className="sr-only"> (opens the public PDF in a new tab)</span>
              </a>
              <span style={{ color: "var(--ink-soft)" }}>, effective {formatDate(reason.policy.effective)}</span>
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function Results({ outcome }: { outcome: RunOutcome | null }) {
  if (!outcome) {
    return (
      <div className="card">
        <p className="m-0" style={{ color: "var(--ink-soft)" }}>
          Pick a sample household or fill in the form, then choose Run screening. Results appear here, and the trace below shows each hop.
        </p>
      </div>
    );
  }

  if (outcome.response) {
    return (
      <div className="grid gap-4">
        <p className="sr-only">Screening finished. {outcome.response.results.map((r) => `${r.programName}: ${STATUS[r.status].label}.`).join(" ")}</p>
        {outcome.response.results.map((r, i) => (
          <ResultCard key={r.program} result={r} index={i} />
        ))}
        <p className="m-0 text-sm" style={{ color: "var(--ink-soft)" }}>
          This demo does not estimate a benefit amount, and it is not a benefits decision. Only a caseworker can decide.
        </p>
      </div>
    );
  }

  const error = outcome.error;
  return (
    <div className="card rise" style={{ boxShadow: "0 0 0 2px var(--no-ink)" }}>
      <h3 className="text-lg font-bold" style={{ color: "var(--no-ink)" }}>
        {outcome.status === 400 ? "The gateway could not use that request" : `The gateway answered ${outcome.status}`}
      </h3>
      <p className="mt-1">
        {error?.message ?? "Something went wrong."}
        {outcome.status === 403 ? " This is the expected result when you use the wrong client." : ""}
      </p>
      <p className="mono mt-2" style={{ color: "var(--ink-soft)" }}>
        {error?.error} (HTTP {outcome.status}), client {outcome.clientName}
      </p>
    </div>
  );
}
