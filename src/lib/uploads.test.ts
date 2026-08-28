import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveUpload, uploadsDirectory } from "./uploads";

/**
 * These files are now served by a route handler rather than by the static
 * file server, which means a name arriving from the network is turned into a
 * path on disk. That is the shape of every directory-traversal bug ever
 * written, so the guard gets tests before it gets code.
 */
describe("resolveUpload", () => {
  it("accepts a name the office itself generated", () => {
    expect(resolveUpload("img-acdefgh3.jpg")).toEqual({
      file: path.join(uploadsDirectory(), "img-acdefgh3.jpg"),
      contentType: "image/jpeg",
    });
  });

  it("accepts every format the office can store", () => {
    const types = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
    for (const [extension, contentType] of Object.entries(types)) {
      expect(resolveUpload(`img-acdefgh3.${extension}`)?.contentType).toBe(contentType);
    }
  });

  it("refuses to climb out of the uploads directory", () => {
    expect(resolveUpload("../../.data/accounts.jsonl")).toBeNull();
    expect(resolveUpload("..%2Faccounts.jsonl")).toBeNull();
    expect(resolveUpload("img-acdefgh3.jpg/../../../etc/passwd")).toBeNull();
  });

  it("refuses an absolute path", () => {
    expect(resolveUpload("/etc/passwd")).toBeNull();
  });

  it("refuses a name it did not issue", () => {
    expect(resolveUpload("accounts.jsonl")).toBeNull();
    expect(resolveUpload("img-acdefgh3.svg")).toBeNull();
    expect(resolveUpload("img-acdefgh3")).toBeNull();
    expect(resolveUpload("")).toBeNull();
  });

  it("keeps the uploads inside the data directory, so one volume holds everything", () => {
    expect(uploadsDirectory().startsWith(path.join(process.cwd(), ".data"))).toBe(true);
  });
});
