# Eligibility Integration Broker (demo)

[![CI](https://github.com/Jakew9697/eligibility-integration-broker/actions/workflows/ci.yml/badge.svg)](https://github.com/Jakew9697/eligibility-integration-broker/actions/workflows/ci.yml)

Independent portfolio demo by Jake Worsham. Not affiliated with or endorsed by the State of Michigan or MDHHS. All people and data are made up. This is not a benefits decision.

## What it is

A small integration layer of the kind a benefits agency runs between a modern front end and older back-end systems. One screening request goes in. The broker:

1. checks an OAuth 2.0 client-credentials token and its scope,
2. validates the request and reports field-level errors,
3. calls a REST income-verification service,
4. calls an older SOAP 1.1 eligibility service that applies the rules,
5. transforms the XML answer into JSON,
6. appends a hash-chained audit entry,
7. returns plain-language results for Food Assistance (FAP) and the Healthy Michigan Plan (HMP), each with the policy item behind it.

The web page runs all of this in the browser and shows every hop: method, path, status, time, correlation ID, and the request and response of each call, including the raw SOAP XML.

## Architecture

```
 browser client
     |  1. POST /oauth/token  (client credentials)        +---------------+
     +--------------------------------------------------->| token service |
     |  2. POST /v1/screenings  (Bearer token)            +---------------+
     v
 +---------+  verify token and scope  -> 401 / 403
 | gateway |  validate body           -> 400 with field errors
 |         |  X-Correlation-ID passed to every call
 |         |--- POST /income/v1/verifications ------->  income service (REST, JSON)
 |         |--- POST /legacy/EligibilityService ----->  legacy service (SOAP 1.1, XML)
 |         |  transform XML to JSON, map reason codes to text and policy cites
 |         |  SOAP fault or downstream failure -> 502 with a readable JSON error
 |         |--- append ------------------------------>  audit log (SHA-256 hash chain)
 +---------+
```

How each piece maps to a real integration layer:

| Piece | In this demo | In a real layer |
| --- | --- | --- |
| Token service | `src/broker/oauth.ts`, HS256 JWTs signed with a key generated at start | An identity provider issuing short-lived tokens with scopes |
| Gateway | `src/broker/gateway.ts` | An API gateway or integration service enforcing auth, validation and routing |
| REST service | `src/broker/services/income.ts` | A wage or income verification API |
| SOAP service | `src/broker/services/legacy-soap.ts`, contract in `public/legacy-eligibility.wsdl` | The older eligibility engine behind a SOAP interface |
| Transform | `src/broker/soap.ts`, `src/broker/transform.ts` | Message mapping between XML and JSON |
| Audit | `src/broker/audit.ts` | An append-only log of who did what, tamper-evident |
| Transport | `src/broker/transport.ts` | The network. Here it is in memory so the static site can run it and record each hop |

Every service is a plain `(req: Request) => Promise<Response>` handler, so the same code runs in the browser and over real HTTP.

## Run it

```
bun install
bun run dev        # http://localhost:3000
bun run test       # Vitest
bun run typecheck
bun run build      # static export to out/
bun run serve      # the same handlers over HTTP on localhost:8787
```

`bun run serve` generates the demo client ID and secret each time it starts and prints them as `export` lines. Copy those into your shell, then:

```
# Token: 200
curl -s -u "$CLIENT_ID:$CLIENT_SECRET" -d grant_type=client_credentials http://localhost:8787/oauth/token
TOKEN=<paste access_token from the response>

# Screening: 200
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"householdSize":1,"members":[{"age":34,"disabled":false,"earnedIncome":1100,"unearnedIncome":0}],"shelterCost":700,"dependentCareCost":0,"applicantRef":"SAMPLE-A"}' \
  -w '\n%{http_code}\n' http://localhost:8787/v1/screenings

# No token: 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Content-Type: application/json" -d '{}' http://localhost:8787/v1/screenings

# Malformed body: 400 with field errors
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"householdSize":0}' -w '\n%{http_code}\n' http://localhost:8787/v1/screenings

# Wrong client (reporting-tool has no screening:write scope): get its token, then repeat the screening call with it for a 403
curl -s -u "$OTHER_CLIENT_ID:$OTHER_CLIENT_SECRET" -d grant_type=client_credentials http://localhost:8787/oauth/token
```

The WSDL is also served at `http://localhost:8787/legacy/EligibilityService?wsdl`.

## What the rules do

- FAP income limits come from the 2026 HHS poverty guideline and match RFT 250 exactly for sizes 1 to 8 (the 200% column is twice the 100% column, as published). Larger households add the published per-person amounts.
- A household at or under 200% of the guideline is likely eligible (BEM 213, categorical eligibility).
- A household over 200% with someone 60 or older, or with a disability, is judged on net income against 100% instead. Net income counts earnings at 80%, subtracts dependent care, then subtracts shelter above half the remaining income with no cap (BEM 556).
- If reported earnings differ from the wage record by more than $100 a month, FAP becomes "needs review": a worker would send a verification checklist asking for pay stubs, due in 10 calendar days (BEM 213).
- HMP applies to ages 19 to 64 with income at or under 138% of the guideline (133% plus the standard 5 percent income disregard). Younger and older applicants get "needs review" for other Medicaid categories, not a denial. HMP is judged on the first person listed.

Not modeled: the standard deduction, medical deductions, assets, citizenship, benefit amounts. This demo does not estimate a benefit amount.

## Policy sources

| Item | Version used | Link |
| --- | --- | --- |
| HHS poverty guideline | 2026 | https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines |
| RFT 250, SNAP Income Limits | effective Oct 1, 2026 | https://mdhhs-pres-prod.michigan.gov/olmweb/EX/RF/Public/RFT/250.pdf |
| BEM 213, Categorical Eligibility | effective Feb 1, 2026 | https://mdhhs-pres-prod.michigan.gov/olmweb/EX/BP/Public/BEM/213.pdf |
| BEM 556, Computing the Food Assistance Budget | effective Nov 1, 2025 | https://mdhhs-pres-prod.michigan.gov/olmweb/EX/BP/Public/BEM/556.pdf |
| BEM 137, Healthy Michigan Plan | effective Jan 1, 2024 | https://mdhhs-pres-prod.michigan.gov/olmweb/EX/BP/Public/BEM/137.pdf |

## Notes

- Secrets: none are stored. The demo client IDs and secrets, and the token signing key, are generated with Web Crypto each time the broker starts. The trace hides client secrets and most of each token.
- The wage records (`SAMPLE-A`, `SAMPLE-B`, `SAMPLE-D`) are made up.
- Deployment: the CI workflow builds with `PAGES_BASE_PATH=/eligibility-integration-broker` and publishes `out/` to GitHub Pages from `main`.
