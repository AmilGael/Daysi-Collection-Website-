import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The bar used to appear only once something was staged, so the button
 * moved. Since 14 September 2026 it is always there: "Sin cambios" and a
 * greyed Confirmar until she touches something. No DOM in these tests, so
 * the agreement is checked in the source, the way the tab strip's is.
 */
const source = readFileSync(
  path.join(process.cwd(), "src/components/office/confirm-bar.tsx"),
  "utf8",
);
const sheetSource = readFileSync(
  path.join(process.cwd(), "src/components/office/sheet.tsx"),
  "utf8",
);
const globalsSource = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

const officeMessages = (bundle: { office: object }) => bundle.office as Record<string, string>;

/**
 * Only the class strings, not the whole file: a docstring is free to say
 * "sticky" about something else (the site header genuinely is), so the
 * "not sticky" check below reads just the className attributes rather than
 * scanning every line as prose.
 */
function classNamesIn(fileSource: string): string {
  return [...fileSource.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
    .map(([, plain, template]) => plain ?? template ?? "")
    .join(" ");
}

describe("the confirm bar", () => {
  it("never leaves the page", () => {
    expect(source).not.toContain("if (count === 0) return null;");
    expect(source).toContain("const idle = count === 0;");
    expect(source).toContain('{idle ? t("noChanges") : t("changesPending", { count })}');
    expect(source).toContain("z-[60]");
  });

  it("greys the confirm button and hides discard while there is nothing staged", () => {
    expect(source).toContain('disabled={idle || status === "confirming"}');
    expect(source).toContain("{idle ? null : (");
  });

  it("says so in both languages", () => {
    expect(officeMessages(es).noChanges).toBe("Sin cambios");
    expect(officeMessages(en).noChanges).toBe("No changes");
  });

  /**
   * The bar used to be `sticky` inside the padded `.shell`, so its
   * background stopped at the page gutters. It is now a fixed, full-width
   * bar (rendered through a portal so no tab's nested layout can clip it),
   * with its own `.shell` row inside so the content still lines up.
   */
  it("is a fixed, full-width bar, not a sticky one clipped by the shell", () => {
    expect(classNamesIn(source)).not.toContain("sticky");
    expect(source).toContain("fixed inset-x-0 bottom-0");
    expect(source).toContain("bg-paper");
    expect(source).not.toContain("bg-paper/95");
    expect(source).toContain("shell");
    expect(source).toContain("z-[60]");
  });

  /**
   * At 375px the status text and two uppercase buttons don't fit on one
   * line ("5 cambios sin confirmar" beside Descartar and Confirmar
   * overflows), so below 640px they stack into two rows inside one fixed
   * height instead of a `min-h` that lets the bar grow past what the sheet
   * (sheet.tsx) reserves for it underneath.
   */
  it("holds one fixed height on every width, so it never overlaps the sheet", () => {
    expect(source).toContain("h-[var(--office-bar)]");
    expect(source).toContain("truncate");
    expect(source).toContain("whitespace-nowrap");
    expect(sheetSource).toContain("bottom-[var(--office-bar)]");
    expect(sheetSource).not.toContain("bottom-16");
    expect(globalsSource).toContain("--office-bar: 6rem");
    expect(globalsSource).toContain("--office-bar: 4rem");
  });

  it("labels the region in both languages", () => {
    expect(officeMessages(es).confirmBarLabel).toBe("Cambios");
    expect(officeMessages(en).confirmBarLabel).toBe("Changes");
  });
});
