# Acceptance: Eligibility Integration Broker demo

Each line is one observable check. The evaluator runs the tests, builds the static site, serves it, and drives it in a browser.

## Build and tests
- A1. `bun run typecheck` exits 0 with TypeScript `strict: true`.
- A2. `bun run test` exits 0, and the suite includes every test named in section T.
- A3. `bun run build` produces a static export in `out/` with the Pages base path applied when `PAGES_BASE_PATH` is set.
- A4. `bun run serve` starts a local HTTP server, and the README's curl examples return the documented status codes against it: token 200, screening 200, screening without a token 401, malformed body 400.

## Tests that must exist (section T)
- T1. FAP limits from the 2026 HHS poverty guideline equal the RFT 250 values in effect 10/1/2026: household of 1 is $1,729 gross (130%), $1,330 net (100%) and $2,660 (200%); household of 4 is $3,575, $2,750 and $5,500; each additional person adds $616, $474 and $948.
- T2. A household at or under 200% of the poverty line is likely eligible for FAP under BEM 213 categorical eligibility. One dollar over is not.
- T3. A household with a senior or disabled member over 200% is judged on the net-income test (100%) instead, and the reason cites BEM 213.
- T4. HMP: an adult aged 19 to 64 at or under 138% of the poverty line is likely eligible, and the reason cites BEM 137. Someone 65 or older gets a "needs review, other Medicaid categories" result instead of a denial.
- T5. Gateway: a request with no token gets 401, a token without the `screening:write` scope gets 403, and a malformed body gets 400 with field-level errors.
- T6. One correlation ID appears on every hop of a screening and in the response.
- T7. The legacy SOAP service returns a SOAP 1.1 Fault with `faultcode` `soap:Client` for an invalid envelope, and the gateway turns that into a 502 with a readable JSON error.
- T8. When reported wages differ from the wage record by more than $100 a month, FAP comes back "needs review" and the reason says a worker would ask for pay stubs.
- T9. The audit log hash chain verifies, and changing any one past entry makes verification fail at that entry.

## Page (desktop 1280 wide and phone 390 wide)
- P1. A banner at the top of every view says this is an independent demo, not affiliated with the State of Michigan or MDHHS, that all data is made up, and that it is not a benefits decision.
- P2. No state seal, no Michigan logo, and no michigan.gov look-alike styling.
- P3. Four sample households load into the form with one click each, and the form can also be filled by hand.
- P4. Running a screening shows one result card per program (Food Assistance, Healthy Michigan Plan) with a status, a plain-language reason, and at least one policy citation that links to the public BEM or RFT PDF.
- P5. The trace panel lists each hop in order (token, gateway, income service, legacy SOAP service, transform), with method, path, status, time in milliseconds, and the shared correlation ID. Expanding a hop shows its request and response, with the SOAP hop showing real XML.
- P6. A Contracts view shows the gateway's JSON Schema, generated from the Zod schema, and the legacy service's WSDL.
- P7. An Audit view lists the hash-chained events and has a Verify button that reports the chain intact.
- P8. Every form control has a visible label. Submitting with errors shows an error summary at the top that links to each bad field. Everything works with the keyboard alone, with a visible focus ring.
- P9. Results arrive in an `aria-live` region. Text contrast meets WCAG 2.1 AA. Animations stop under `prefers-reduced-motion`.
- P10. No horizontal scroll at 390 px wide.
- P11. The browser console shows no errors during a full run through all four sample households.

## Repository
- R1. The README explains what the demo shows, how the pieces map to an integration layer (gateway, token service, REST service, SOAP service, transform, audit), how to run it, the curl examples, and the policy sources with their effective dates.
- R2. No secrets in the repository. The demo client credentials are generated at runtime.
- R3. A GitHub Actions workflow runs typecheck, tests and the build on every push, and deploys `out/` to GitHub Pages from `main`.
