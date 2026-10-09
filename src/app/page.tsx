import { About } from "@/components/About";
import { Demo } from "@/components/Demo";

export default function Page() {
  return (
    <>
      <header className="mx-auto max-w-[1280px] px-4 pt-8 pb-4 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--green-800)" }}>
          Portfolio demo
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Eligibility Integration Broker</h1>
        <p className="mt-3 max-w-[62ch]" style={{ color: "var(--ink-soft)" }}>
          One screening request goes in. The broker checks a token, validates the request, asks a modern income service and an older SOAP eligibility service, turns the XML answer into JSON, writes an audit entry, and returns plain-language results with the policy behind each one. The trace shows every hop.
        </p>
      </header>
      <main id="main" className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
        <Demo />
        <About />
      </main>
    </>
  );
}
