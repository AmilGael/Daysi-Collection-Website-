import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The garment checklist's own row used a raw `accent-ink` checkbox, the
 * shape every other office sheet moved off of onto the shared `Switch`
 * (`shopfront-cards.test.ts`'s "no raw accent-ink checkbox" case, and
 * `garment-sheet.tsx`/`gallery-work-sheet.tsx`, which already use it). This
 * pins the same move here: the thumbnail stays, the checkbox is the office
 * Switch, and both `PremiereSheet` and the create form's checklist still
 * stage exactly as before. No DOM here, so the fix is checked in the
 * source, the way the other rebuilt sheets' are.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/premiere-manager.tsx"), "utf8");

describe("the premiere checklist's garment row", () => {
  it("has no raw accent-ink checkbox left over", () => {
    expect(source).not.toContain("accent-ink");
    expect(source).not.toContain('type="checkbox"');
  });

  it("uses the shared office Switch instead, with the garment's own label", () => {
    expect(source).toContain('import { Switch } from "./office/switch";');
    const row = source.slice(source.indexOf("function StyleRow"), source.indexOf("function PremiereSheet"));
    expect(row).toContain("<Switch label={style.label} checked={checked} disabled={disabled} onChange={onToggle} />");
  });

  it("keeps the thumbnail beside the row, outside the Switch's own label text", () => {
    const row = source.slice(source.indexOf("function StyleRow"), source.indexOf("function PremiereSheet"));
    expect(row).toContain('<Image src={style.photo} alt=""');
  });

  it("still stages the same toggle from both the sheet and the create form", () => {
    expect(source).toContain("onToggle={() => toggleStyle(style.id)}");
    expect(source).toContain("styleIds.includes(style.id)\n                    ? styleIds.filter((candidate) => candidate !== style.id)");
  });
});
