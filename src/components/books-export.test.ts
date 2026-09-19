import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The custom date-range card sits in the same grid as the four preset
 * cards (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`). At the base 2-column
 * width — a 375px phone, before `sm:` kicks in — a `sm:col-span-2` card
 * still spans only one column, so Desde and Hasta crowd into half the
 * card's width. It needs `col-span-2` unconditionally so it always spans
 * two columns, phone included. No DOM here, so the fix is checked in the
 * source, the way the other rebuilt tabs' are.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/books-export.tsx"), "utf8");

describe("the custom date-range card", () => {
  it("spans two columns at every width, not only from sm: up", () => {
    expect(source).toContain('<li className="flex h-full flex-col gap-3 border border-line p-5 col-span-2">');
    expect(source).not.toContain("sm:col-span-2");
  });
});
