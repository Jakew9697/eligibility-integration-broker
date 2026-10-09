import type { Broker } from "@/broker";
import type { ErrorBody, ScreeningResponse } from "@/broker/contracts";
import type { Hop } from "@/broker/transport";

export interface RunOutcome {
  status: number;
  correlationId: string;
  clientName: string;
  response?: ScreeningResponse;
  error?: ErrorBody;
  hops: Hop[];
}

const BASE = "http://broker.local";

/**
 * Plays the part of the front-end client: get a token with client credentials,
 * then post the screening. One correlation ID is sent on both calls.
 */
export async function runScreening(broker: Broker, request: unknown, useWrongClient: boolean): Promise<RunOutcome> {
  const correlationId = crypto.randomUUID();
  const client = broker.clients.find((c) => c.name === (useWrongClient ? "reporting-tool" : "screening-portal"));
  if (!client) throw new Error("Demo client is not registered");
  broker.transport.clear();

  const tokenRes = await broker.fetch(
    new Request(`${BASE}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${encodeURIComponent(client.id)}:${encodeURIComponent(client.secret)}`)}`,
        "X-Correlation-ID": correlationId,
      },
      body: "grant_type=client_credentials",
    }),
  );
  const token = (await tokenRes.json()) as { access_token?: string };

  const res = await broker.fetch(
    new Request(`${BASE}/v1/screenings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.access_token ?? ""}`, "X-Correlation-ID": correlationId },
      body: JSON.stringify(request),
    }),
  );
  const body = await res.json();
  return {
    status: res.status,
    correlationId,
    clientName: client.name,
    hops: broker.transport.hops(),
    ...(res.ok ? { response: body as ScreeningResponse } : { error: body as ErrorBody }),
  };
}
