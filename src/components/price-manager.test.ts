import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * On a phone a tap into a number box landed the cursor mid-number, so typing
 * 1 into 195.00 produced 1915.00. The box is a decimal text field now: the
 * phone shows a number pad, a tap selects the whole value, and what she
 * types goes through centsFromInput, which also accepts a comma.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/price-manager.tsx"), "utf8");

describe("the price boxes", () => {
  it("are decimal text fields, not number inputs", () => {
    expect(source).not.toContain('type="number"');
    expect(source).toContain('inputMode="decimal"');
  });

  it("select the whole value on focus and parse through centsFromInput", () => {
    expect(source).toContain("requestAnimationFrame(() => box.select());");
    expect(source).toContain("const box = event.currentTarget;");
    expect(source).toContain('import { centsFromInput } from "@/lib/money";');
    expect(source).toContain("next.map(centsFromInput)");
    expect(source).not.toContain("parseFloat(");
  });

  it("are tall enough to tap", () => {
    expect(source).toContain("min-h-11");
  });
});
