import { CORRELATION_HEADER, json, type Handler } from "./http";

export interface RouteSpec {
  path: string;
  /** Label shown in the trace. */
  name: string;
  handler: Handler;
}

export interface HopSide {
  headers: Record<string, string>;
  body: string;
}

export interface Hop {
  seq: number;
  kind: "http" | "step";
  name: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  correlationId: string;
  request: HopSide;
  response: HopSide;
}

export type StepInput = Omit<Hop, "seq" | "kind" | "request" | "response"> & { requestBody: string; responseBody: string };

function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key === "authorization") {
      const [scheme, credential = ""] = value.split(/\s+/, 2);
      out[key] = scheme?.toLowerCase() === "bearer" ? `Bearer ${credential.slice(0, 14)}... (shortened)` : `${scheme} [redacted]`;
    } else out[key] = value;
  });
  return out;
}

/** Keeps secrets out of the trace: client secrets in form bodies and most of any issued token. */
function redactBody(text: string): string {
  return text
    .replace(/(client_secret=)[^&]*/g, "$1[redacted]")
    .replace(/("access_token":")([^"]{14})[^"]*"/g, '$1$2... (shortened)"');
}

/**
 * In-memory stand-in for the network. It routes a Request by URL path to a handler and records
 * every hop. The browser demo uses it, and the Bun server uses the same handlers over real HTTP.
 */
export class Transport {
  private routes = new Map<string, RouteSpec>();
  private recorded: Hop[] = [];
  private nextSeq = 0;

  constructor(
    routes: RouteSpec[] = [],
    private maxHops = 500,
  ) {
    for (const r of routes) this.routes.set(r.path, r);
  }

  addRoute(route: RouteSpec) {
    this.routes.set(route.path, route);
  }

  fetch: Handler = async (req) => {
    const seq = this.nextSeq++;
    const url = new URL(req.url);
    const route = this.routes.get(url.pathname);
    const requestBody = await req.clone().text();
    const started = performance.now();
    const res = route ? await route.handler(req) : json({ error: "not_found", message: `No service at ${url.pathname}.` }, 404);
    const ms = performance.now() - started;
    const responseBody = await res.clone().text();
    this.push({
      seq,
      kind: "http",
      name: route?.name ?? "Unknown path",
      method: req.method,
      path: url.pathname,
      status: res.status,
      ms,
      correlationId: req.headers.get(CORRELATION_HEADER) ?? res.headers.get(CORRELATION_HEADER) ?? "",
      request: { headers: redactHeaders(req.headers), body: redactBody(requestBody) },
      response: { headers: redactHeaders(res.headers), body: redactBody(responseBody) },
    });
    return res;
  };

  /** Records work that is not an HTTP call, such as the XML to JSON transform. */
  record = (step: StepInput) => {
    const { requestBody, responseBody, ...rest } = step;
    this.push({
      ...rest,
      seq: this.nextSeq++,
      kind: "step",
      request: { headers: {}, body: requestBody },
      response: { headers: {}, body: responseBody },
    });
  };

  hops(): Hop[] {
    return [...this.recorded].sort((a, b) => a.seq - b.seq);
  }

  clear() {
    this.recorded = [];
  }

  private push(hop: Hop) {
    this.recorded.push(hop);
    if (this.recorded.length > this.maxHops) this.recorded.splice(0, this.recorded.length - this.maxHops);
  }
}
