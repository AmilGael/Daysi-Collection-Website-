import { describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";

/**
 * Both languages carry every key. A key written in one bundle only renders
 * as its raw path on the other language's pages.
 */
function keysOf(bundle: object, prefix = ""): string[] {
  return Object.entries(bundle).flatMap(([key, value]) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("the two message bundles", () => {
  it("carry the same keys", () => {
    expect(keysOf(es).sort()).toEqual(keysOf(en).sort());
  });
});
