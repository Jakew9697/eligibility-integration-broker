import { describe, expect, it } from "vitest";
import { AuditLog, GENESIS_HASH, verifyChain } from "../src/broker/audit";

async function filled(n = 5) {
  const log = new AuditLog();
  await Promise.all(Array.from({ length: n }, (_, i) => log.append({ correlationId: `corr-${i}`, clientId: "c1", action: "screening.request", outcome: `accepted ${i}` })));
  return log;
}

describe("T9 audit hash chain", () => {
  it("verifies and links each entry to the one before", async () => {
    const log = await filled();
    const entries = log.entries();
    expect(entries[0]?.prevHash).toBe(GENESIS_HASH);
    entries.slice(1).forEach((e, i) => expect(e.prevHash).toBe(entries[i]?.hash));
    expect(await log.verify()).toBeNull();
  });

  it("keeps order when appends overlap", async () => {
    const log = await filled(20);
    expect(log.entries().map((e) => e.index)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(await log.verify()).toBeNull();
  });

  it("fails at the entry that was changed, for any entry and any field", async () => {
    const log = await filled();
    const fields = ["timestamp", "correlationId", "clientId", "action", "outcome"] as const;
    for (let i = 0; i < 5; i++) {
      for (const field of fields) {
        const copy = log.entries();
        copy[i] = { ...copy[i]!, [field]: "tampered" };
        expect(await verifyChain(copy), `${field} of entry ${i}`).toBe(i);
      }
    }
  });

  it("fails at the next entry if someone also recomputes the changed entry's hash", async () => {
    const log = await filled();
    const copy = log.entries();
    copy[2] = { ...copy[2]!, outcome: "tampered", hash: "f".repeat(64) };
    expect(await verifyChain(copy)).toBe(2);
  });

  it("detects a removed entry", async () => {
    const copy = (await filled()).entries();
    copy.splice(1, 1);
    expect(await verifyChain(copy)).toBe(1);
  });

  it("does not let callers change the log through entries()", async () => {
    const log = await filled(2);
    log.entries()[0]!.outcome = "tampered";
    expect(await log.verify()).toBeNull();
  });
});
