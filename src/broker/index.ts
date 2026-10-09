import { AuditLog } from "./audit";
import { createGateway, GATEWAY_PATH } from "./gateway";
import type { Handler } from "./http";
import { createOAuth } from "./oauth";
import { createIncomeService, INCOME_PATH } from "./services/income";
import { createLegacyService, LEGACY_PATH } from "./services/legacy-soap";
import { Transport } from "./transport";

export interface BrokerOptions {
  /** Replace a downstream service. Tests use this to simulate a failing or changed system. */
  override?: (real: { income: Handler; legacy: Handler }) => Partial<{ income: Handler; legacy: Handler }>;
}

/** Wires the token service, gateway, income service and legacy service onto one in-memory transport. */
export async function createBroker(options: BrokerOptions = {}) {
  const audit = new AuditLog();
  const oauth = await createOAuth(audit);
  const real = { income: createIncomeService(), legacy: createLegacyService() };
  const services = { ...real, ...options.override?.(real) };

  const transport = new Transport();
  const gateway = createGateway({ fetch: transport.fetch, oauth, audit, recordStep: transport.record });
  transport.addRoute({ path: "/oauth/token", name: "Token service (OAuth 2.0)", handler: oauth.handler });
  transport.addRoute({ path: GATEWAY_PATH, name: "Gateway", handler: gateway });
  transport.addRoute({ path: INCOME_PATH, name: "Income service (REST)", handler: services.income });
  transport.addRoute({ path: LEGACY_PATH, name: "Legacy eligibility service (SOAP)", handler: services.legacy });

  return { fetch: transport.fetch, transport, audit, clients: oauth.clients };
}

export type Broker = Awaited<ReturnType<typeof createBroker>>;
