import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * next/image with `fill` is absolutely positioned against its direct parent,
 * and in the homepage strip that parent is the link inside each tile, not
 * the tile itself. The link was static, so dev warned once per photograph.
 * No DOM in these tests, so the agreement is checked in the source.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/design-strip.tsx"), "utf8");

describe("the homepage design strip", () => {
  it("gives each filled photograph a positioned link the size of its tile", () => {
    const link = source.match(/<Link href=\{photo\.href\} className="([^"]+)"/)?.[1]?.split(" ") ?? [];
    expect(link).toEqual(expect.arrayContaining(["relative", "block", "h-full", "w-full"]));
    expect(source).toMatch(/<Link href=\{photo\.href\}[^>]*>\s*<Image[^>]*\bfill\b/);
  });
});
