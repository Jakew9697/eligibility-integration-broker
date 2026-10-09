/** Pretty-prints JSON bodies. Everything else (XML, form data) is shown as it was sent. */
export function prettyBody(body: string): string {
  if (!body) return "(empty)";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function headerLines(headers: Record<string, string>): string {
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  return lines.length ? lines.join("\n") : "(none)";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export const shortHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-4)}`;
