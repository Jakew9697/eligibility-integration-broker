import { sha256Hex } from "./http";

export interface AuditEntry {
  index: number;
  timestamp: string;
  correlationId: string;
  clientId: string;
  action: string;
  outcome: string;
  prevHash: string;
  hash: string;
}

export type AuditInput = Pick<AuditEntry, "correlationId" | "clientId" | "action" | "outcome">;

export const GENESIS_HASH = "0".repeat(64);

/** The hash covers every field except itself, in a fixed order, plus the previous entry's hash. */
export function hashEntry(e: Omit<AuditEntry, "hash">): Promise<string> {
  return sha256Hex(JSON.stringify([e.index, e.timestamp, e.correlationId, e.clientId, e.action, e.outcome, e.prevHash]));
}

/** Returns the index of the first entry that does not check out, or null if the whole chain is intact. */
export async function verifyChain(entries: readonly AuditEntry[]): Promise<number | null> {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] as AuditEntry;
    if (e.index !== i || e.prevHash !== prev || e.hash !== (await hashEntry(e))) return i;
    prev = e.hash;
  }
  return null;
}

/** Append-only. Entries hold identifiers and outcomes, never the household's answers. */
export class AuditLog {
  private log: AuditEntry[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  append(input: AuditInput): Promise<AuditEntry> {
    // Chain appends so concurrent requests cannot read the same previous hash.
    const next = this.queue.then(async () => {
      const prev = this.log.at(-1);
      const body = {
        index: this.log.length,
        timestamp: new Date().toISOString(),
        ...input,
        prevHash: prev?.hash ?? GENESIS_HASH,
      };
      const entry: AuditEntry = { ...body, hash: await hashEntry(body) };
      this.log.push(entry);
      return entry;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  entries(): AuditEntry[] {
    return this.log.map((e) => ({ ...e }));
  }

  verify(): Promise<number | null> {
    return verifyChain(this.log);
  }
}
