"use client";

import { useState } from "react";
import { verifyChain, type AuditEntry } from "@/broker/audit";
import { shortHash } from "@/lib/format";

type Check = { kind: "intact"; count: number } | { kind: "broken"; index: number } | null;

export function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  const [check, setCheck] = useState<Check>(null);
  const [alteredAt, setAlteredAt] = useState<number | null>(null);

  // The alter button edits a copy held here, never the broker's own log.
  const shown = alteredAt === null ? entries : entries.map((e, i) => (i === alteredAt ? { ...e, outcome: "changed after the fact" } : e));

  async function verify() {
    const bad = await verifyChain(shown);
    setCheck(bad === null ? { kind: "intact", count: shown.length } : { kind: "broken", index: bad });
  }

  function toggleAlter() {
    setCheck(null);
    setAlteredAt(alteredAt === null ? Math.floor(entries.length / 2) : null);
  }

  return (
    <div>
      <p className="mt-0 text-sm" style={{ color: "var(--ink-soft)" }}>
        Every token and screening decision is appended with the hash of the entry before it. Entries hold identifiers and outcomes, not the household&apos;s answers. Change any past entry and every hash from there on stops matching.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={verify} disabled={!entries.length}>
          Verify the chain
        </button>
        <button type="button" className="btn btn-quiet" onClick={toggleAlter} disabled={!entries.length} aria-pressed={alteredAt !== null}>
          {alteredAt === null ? "Alter one entry (demo)" : "Undo the change"}
        </button>
      </div>
      <div role="status" aria-live="polite" className="mb-4 min-h-6 font-semibold">
        {check?.kind === "intact" ? <span style={{ color: "var(--ok-ink)" }}>Chain intact: all {check.count} entries check out.</span> : null}
        {check?.kind === "broken" ? <span style={{ color: "var(--no-ink)" }}>Chain broken at entry {check.index}: its contents no longer match its hash.</span> : null}
        {alteredAt !== null && !check ? <span style={{ color: "var(--review-ink)" }}>Entry {alteredAt} was changed in this copy. Verify to see it caught.</span> : null}
      </div>

      {entries.length ? (
        <ol className="m-0 grid list-none gap-3 p-0">
          {shown.map((e, i) => (
            <li key={e.index} className={`audit-row${check?.kind === "broken" && check.index === i ? " bad" : ""}`}>
              <dl className="kv">
                <dt>Entry</dt>
                <dd className="num font-bold">{e.index}</dd>
                <dt>Time</dt>
                <dd className="num">{e.timestamp}</dd>
                <dt>Client</dt>
                <dd className="mono">{e.clientId}</dd>
                <dt>Action</dt>
                <dd>{e.action}</dd>
                <dt>Outcome</dt>
                <dd>{e.outcome}</dd>
                <dt>Correlation</dt>
                <dd className="mono">{e.correlationId}</dd>
                <dt>Previous hash</dt>
                <dd className="mono" title={e.prevHash}>{shortHash(e.prevHash)}</dd>
                <dt>Hash</dt>
                <dd className="mono" title={e.hash}>{shortHash(e.hash)}</dd>
              </dl>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0" style={{ color: "var(--ink-soft)" }}>No entries yet. Run a screening and its token and decision entries appear here.</p>
      )}
    </div>
  );
}
