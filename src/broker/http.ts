export type Handler = (req: Request) => Promise<Response>;

export const CORRELATION_HEADER = "X-Correlation-ID";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Accept a caller-supplied correlation ID only if it is short and made of safe characters. */
export function pickCorrelationId(supplied: string | null): string {
  return supplied && /^[A-Za-z0-9._-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID();
}
