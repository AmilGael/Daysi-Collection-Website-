import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Everything this site keeps has to land on the persistent disk.
 *
 * In production the working directory is inside the container image and the
 * volume is mounted somewhere else, so a store that builds its path from
 * `process.cwd()` writes to a filesystem the next deploy replaces. That is not
 * a crash and nothing logs it — the site keeps answering, the office keeps
 * rendering, and the records are simply gone.
 *
 * It happened: `request-store.ts` did exactly this from the day it was written
 * until 2026-09-01, so every order, appointment, commission, contact message
 * and premiere sign-up was discarded on each deploy, taking the earnings
 * figures, the books export and the calendar's record of booked slots with it.
 *
 * `env.dataDirectory` is the one correct answer. It already falls back to
 * `.data` beside the source when `DATA_DIR` is unset, so development is
 * unchanged and there is no reason for a store to compute its own path.
 */

const libraryDirectory = path.join(process.cwd(), "src", "lib");

/** Files that persist something, and must therefore agree on where. */
const STORES = ["records.ts", "request-store.ts"] as const;

function source(file: string): string {
  return fs.readFileSync(path.join(libraryDirectory, file), "utf8");
}

/**
 * The rule is about what the file does, not what it says about itself — the
 * comment explaining this mistake naturally names `process.cwd()`, and a test
 * that read prose would fail on its own documentation.
 */
function code(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("where the stores write", () => {
  it("checks every store this rule is meant to cover", () => {
    for (const store of STORES) {
      expect(fs.existsSync(path.join(libraryDirectory, store))).toBe(true);
    }
  });

  it.each(STORES)("%s takes its directory from env.dataDirectory", (store) => {
    expect(code(store)).toMatch(/DATA_DIRECTORY\s*=\s*env\.dataDirectory/);
  });

  it.each(STORES)("%s never builds a storage path from the working directory", (store) => {
    expect(code(store)).not.toMatch(/process\.cwd\(\)/);
  });

  /**
   * The fallback belongs to `env`, and only to `env` — that is what makes a
   * single line the whole of this rule.
   */
  it("leaves the development fallback in env.ts, where it is the deliberate default", () => {
    const environment = fs.readFileSync(path.join(libraryDirectory, "env.ts"), "utf8");
    expect(environment).toMatch(/dataDirectory:\s*optional\("DATA_DIR"\)\s*\?\?/);
  });
});

/**
 * The rule above reads the source; this one runs it. A store could satisfy
 * every pattern in the file and still write somewhere else, so one request
 * actually goes through `saveRequest` with `DATA_DIR` set to a directory this
 * test owns, and the record has to turn up in it.
 */
describe("where a saved request actually lands", () => {
  const original = process.env.DATA_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = original;
    vi.resetModules();
  });

  it("writes to DATA_DIR rather than the working directory", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "daysi-store-"));
    process.env.DATA_DIR = directory;

    // `env` reads the variable once at import, so the module graph has to be
    // rebuilt after setting it — importing at the top of the file would have
    // captured the default.
    vi.resetModules();
    const { saveRequest, listRequests } = await import("./request-store");

    await saveRequest({
      reference: "DC-STORE-TEST",
      kind: "contact",
      submittedAt: new Date("2026-09-01T12:00:00Z").toISOString(),
      locale: "en",
      client: { name: "A Client", email: "client@example.com" },
      details: { message: "Does this land on the disk that survives a deploy?" },
      status: "new",
    });

    const written = path.join(directory, "contact.jsonl");
    expect(fs.existsSync(written)).toBe(true);
    expect(listRequests("contact").map((record) => record.reference)).toContain("DC-STORE-TEST");

    fs.rmSync(directory, { recursive: true, force: true });
  });
});
