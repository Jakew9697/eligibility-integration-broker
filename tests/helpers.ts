import { createBroker, type Broker } from "../src/broker";
import type { ScreeningRequest } from "../src/broker/contracts";
import type { RuleInput } from "../src/broker/rules/types";

export const BASE = "http://broker.local";

export function member(age: number, earned = 0, unearned = 0, disabled = false) {
  return { age, disabled, earned, unearned };
}

export function ruleInput(overrides: Partial<RuleInput> = {}): RuleInput {
  return { householdSize: 1, members: [member(40)], shelterCost: 0, dependentCareCost: 0, wages: { status: "not-requested" }, ...overrides };
}

export function screeningBody(overrides: Partial<ScreeningRequest> = {}): ScreeningRequest {
  return {
    householdSize: 1,
    members: [{ age: 40, disabled: false, earnedIncome: 1100, unearnedIncome: 0 }],
    shelterCost: 700,
    dependentCareCost: 0,
    applicantRef: "SAMPLE-A",
    ...overrides,
  };
}

export async function getToken(broker: Broker, clientName = "screening-portal", correlationId?: string): Promise<string> {
  const client = broker.clients.find((c) => c.name === clientName);
  if (!client) throw new Error(`no client ${clientName}`);
  const res = await broker.fetch(
    new Request(`${BASE}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${client.id}:${client.secret}`)}`,
        ...(correlationId ? { "X-Correlation-ID": correlationId } : {}),
      },
      body: "grant_type=client_credentials",
    }),
  );
  return ((await res.json()) as { access_token: string }).access_token;
}

export function screen(broker: Broker, body: unknown, token?: string, extra: Record<string, string> = {}) {
  return broker.fetch(
    new Request(`${BASE}/v1/screenings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

export { createBroker };
