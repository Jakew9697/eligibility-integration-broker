import type { Hop } from "@/broker/transport";
import { headerLines, prettyBody } from "@/lib/format";

function statusClass(status: number) {
  if (status < 300) return "pill-ok";
  if (status < 500) return "pill-review";
  return "pill-no";
}

function Block({ label, text, wrap = true }: { label: string; text: string; wrap?: boolean }) {
  return (
    // Rendered as text children, so XML and JSON from the services can never become markup.
    <pre className={`codeblock${wrap ? "" : " nowrap"}`} tabIndex={0} aria-label={label}>
      {text}
    </pre>
  );
}

function Side({ title, side, step }: { title: string; side: Hop["request"]; step: boolean }) {
  return (
    <div className="min-w-0">
      <h4>{title}</h4>
      {step ? null : <Block label={`${title} headers`} text={headerLines(side.headers)} />}
      <Block label={`${title} body`} text={prettyBody(side.body)} />
    </div>
  );
}

export function TracePanel({ hops }: { hops: Hop[] }) {
  if (!hops.length) {
    return <p className="m-0" style={{ color: "var(--ink-soft)" }}>Run a screening to see every hop here.</p>;
  }
  return (
    <div>
      <p className="mt-0 mb-3 text-sm" style={{ color: "var(--ink-soft)" }}>
        {hops.length} hops, in the order they started. The gateway hop wraps the income, SOAP, transform and audit steps. Open a hop to see what went in and what came back.
      </p>
      <ol className="m-0 grid list-none gap-3 p-0">
        {hops.map((hop, i) => {
          const step = hop.kind === "step";
          return (
            <li key={hop.seq}>
              <details className="hop">
                <summary>
                  <svg className="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 4l6 6-6 6" />
                  </svg>
                  <span className="min-w-0">
                    <span className="num font-bold">{i + 1}. </span>
                    <span className="font-bold">{hop.name}</span>
                    <span className="mono block break-all" style={{ color: "var(--ink-soft)" }}>
                      {hop.method} {hop.path}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`pill num ${statusClass(hop.status)}`}>{hop.status}</span>
                    <span className="num text-sm" style={{ color: "var(--ink-soft)" }}>
                      {hop.ms.toFixed(1)} ms
                    </span>
                  </span>
                  <span className="mono col-span-3 break-all text-xs" style={{ color: "var(--ink-soft)" }}>
                    correlation ID {hop.correlationId || "none"}
                  </span>
                </summary>
                <div className="hop-body">
                  <Side title={step ? "Input" : "Request"} side={hop.request} step={step} />
                  <Side title={step ? "Output" : "Response"} side={hop.response} step={step} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
