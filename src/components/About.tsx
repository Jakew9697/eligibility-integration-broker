import { BEM_137, BEM_213, BEM_556, RFT_250 } from "@/broker/rules/policy";
import { formatDate } from "@/lib/format";

const SOURCES = [RFT_250, BEM_213, BEM_556, BEM_137];

export function About() {
  return (
    <section aria-labelledby="about-title" className="card mt-10">
      <h2 id="about-title" className="text-2xl font-bold">
        About this demo
      </h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <p className="m-0">
            Agencies that run eligibility programs often keep older systems behind a newer front end. Something in the middle has to check who is calling, validate what arrives, translate between a modern JSON service and an older SOAP one, and leave a record. This page is a small working version of that middle layer. Everything runs in your browser, and the same service code also runs as a local HTTP server.
          </p>
          <p className="m-0">
            The people, wage records and services are all made up. The rules are a simplified reading of public policy. This demo does not estimate a benefit amount, it skips deductions it does not model, and it is not a benefits decision.
          </p>
        </div>
        <div>
          <p className="m-0">Every number comes from these public policy items, at the version in effect on the date shown, plus the <a className="policy-link" href="https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines" target="_blank" rel="noopener noreferrer">2026 HHS poverty guideline<span className="sr-only"> (opens in a new tab)</span></a>.</p>
          <ul className="mb-0 mt-2 grid list-none gap-1 p-0">
            {SOURCES.map((p) => (
              <li key={p.item}>
                <a className="policy-link" href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.manual} {p.item}, {p.title}
                  <span className="sr-only"> (opens the public PDF in a new tab)</span>
                </a>
                <span style={{ color: "var(--ink-soft)" }}>, effective {formatDate(p.effective)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
