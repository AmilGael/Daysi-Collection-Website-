import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Without the key, `helperVisible()` still defaults to `true` (the panel is
 * shown until Daysi hides it) — but the panel never actually shows itself
 * with no key, since `layout.tsx` also requires `helperEnabled`. Drawing the
 * switch checked in that state would tell Daysi the opposite of what is
 * true. `disabled` has to fold into `checked` itself, not just block the
 * click.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/helper-switch.tsx"), "utf8");

describe("the helper switch", () => {
  it("draws off, not on, when there is no key to answer with — even though the stored value is shown", () => {
    expect(source).toContain("checked={visible && !disabled}");
    expect(source).not.toContain("checked={visible}");
  });

  it("hides the undo link too when there is no key, so nothing there offers an action that changes nothing visible", () => {
    expect(source).toContain("{undoable && !pending && !disabled ? <UndoLink kind=\"helper\" id=\"site\" /> : null}");
  });
});
