import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `Sheet`'s back-gesture effect keys off `onClose` (`sheet.tsx`), so a fresh
 * closure on every render — one keystroke in the question box, one ask()
 * settling — would pop the sheet's history entry, steal focus back to the
 * opener, and re-run the first-focusable-element scan, all while the sheet
 * stays open. `close` has to be the same function across renders.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office/help-sheet.tsx"), "utf8");

describe("the help sheet", () => {
  it("holds a stable close callback rather than a fresh one each render", () => {
    expect(source).toContain('import { useCallback, useState, type JSX } from "react"');
    expect(source).toContain("const close = useCallback(() => setOpen(false), [])");
    expect(source).toContain("onClose={close}");
    expect(source).not.toContain("onClose={() => setOpen(false)}");
  });

  /**
   * A question that never got an answer never happened: the thread and the
   * box both go back to what they held before it was asked, so the next
   * question's history is well formed (see `office-helper.test.ts`'s
   * "drops a leading assistant turn" case for the other half of this).
   */
  it("rolls the thread — and the typed question — back on a failed ask, in both failure paths", () => {
    const body = source.slice(source.indexOf("async function ask"), source.indexOf("return (\n"));
    const rollbacks = body.split("setThread(history);").length - 1;
    expect(rollbacks).toBe(2);
    expect(body).toContain("setQuestion(trimmed);");
  });
});
