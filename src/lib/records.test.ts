import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A line on the volume is only a record if this server wrote it. Anyone with
 * a shell on the machine can append to the disk; the signature is what keeps
 * that from being a login.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-records-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const file = (collection: string) => path.join(dir, `${collection}.jsonl`);

describe("signed records", () => {
  it("round-trips what this server wrote", async () => {
    const { appendSignedRecord, readSignedRecords } = await import("./records");
    await appendSignedRecord("things", { b: 2, a: "one", c: null });
    expect(readSignedRecords("things")).toEqual([{ b: 2, a: "one", c: null }]);
  });

  it("does not care about key order on disk", async () => {
    const { appendSignedRecord, readSignedRecords } = await import("./records");
    await appendSignedRecord("things", { b: 2, a: "one" });
    const stored = JSON.parse(readFileSync(file("things"), "utf8").trim());
    const reordered = { sig: stored.sig, a: stored.a, b: stored.b };
    writeFileSync(file("things"), `${JSON.stringify(reordered)}\n`);
    expect(readSignedRecords("things")).toEqual([{ a: "one", b: 2 }]);
  });

  it("ignores an unsigned line, a wrong signature, and an edited body", async () => {
    const { appendSignedRecord, readSignedRecords } = await import("./records");
    await appendSignedRecord("things", { who: "genuine" });
    const genuine = JSON.parse(readFileSync(file("things"), "utf8").trim());
    appendFileSync(file("things"), `${JSON.stringify({ who: "planted" })}\n`);
    appendFileSync(file("things"), `${JSON.stringify({ who: "planted", sig: "nope" })}\n`);
    appendFileSync(file("things"), `${JSON.stringify({ ...genuine, who: "edited" })}\n`);
    expect(readSignedRecords("things")).toEqual([{ who: "genuine" }]);
  });

  it("ignores everything once the secret changes", async () => {
    const first = await import("./records");
    await first.appendSignedRecord("things", { who: "genuine" });
    process.env.AUTH_SECRET = "a-different-key";
    vi.resetModules();
    const second = await import("./records");
    expect(second.readSignedRecords("things")).toEqual([]);
  });
});

describe("a record's history", () => {
  it("returns one key's versions in file order and its previous version", async () => {
    const { appendRecord, previousVersion, versionsOf } = await import("./records");
    await appendRecord("things", { id: "a", value: 1 });
    await appendRecord("things", { id: "b", value: 20 });
    await appendRecord("things", { id: "a", value: 2 });
    await appendRecord("things", { id: "a", value: 3 });

    const key = (record: { id: string }) => record.id;
    expect(versionsOf("things", key, "a")).toEqual([
      { id: "a", value: 1 },
      { id: "a", value: 2 },
      { id: "a", value: 3 },
    ]);
    expect(previousVersion("things", key, "a")).toEqual({ id: "a", value: 2 });
  });

  it("has no previous version with only one line", async () => {
    const { appendRecord, previousVersion } = await import("./records");
    await appendRecord("things", { id: "a", value: 1 });
    expect(
      previousVersion<{ id: string; value: number }>("things", (record) => record.id, "a"),
    ).toBeUndefined();
  });

  it("has no previous version when the key has no lines", async () => {
    const { previousVersion } = await import("./records");
    expect(
      previousVersion<{ id: string }>("things", (record) => record.id, "missing"),
    ).toBeUndefined();
  });
});
