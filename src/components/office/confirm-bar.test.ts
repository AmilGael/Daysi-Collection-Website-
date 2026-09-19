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

/** The text between two markers, so a check can land on one element (the
 * outer bar, one button) instead of the whole file. */
function sectionBetween(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  return text.slice(start, text.indexOf(endMarker, start));
}

describe("the confirm bar", () => {
  it("never leaves the page", () => {
    expect(source).not.toContain("if (count === 0) return null;");
    expect(source).toContain("const idle = count === 0;");
    expect(source).toContain('const statusLine = idle ? t("noChanges") : t("changesPending", { count });');
    expect(source).toContain("{statusLine}");
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

  /**
   * Measured in the browser at 375px and 1280px: Descartar (outline, a
   * real border) was 41px tall and Confirmar (solid, no border) 39px, and
   * on phones the two flex-1 buttons split the row down the middle even
   * though "Confirmar cambios" needs more than half of it. Confirmar's own
   * transparent border matches Descartar's real one so both are the same
   * height; Descartar takes its natural width and Confirmar takes the
   * rest, so the split reflects what the labels actually need. The bar's
   * height also moved from the inner row to this outer, bordered element,
   * since border-box counts the border inside a fixed height only when
   * it's on the element that has it.
   */
  it("matches the two buttons so neither is taller or the odd width", () => {
    const outerBar = sectionBetween(source, 'aria-label={t("confirmBarLabel")}', '<div className="shell');
    const confirmButton = sectionBetween(source, "onClick={onConfirm}", "</button>");
    const discardButton = sectionBetween(source, "onClick={onDiscard}", "</button>");

    expect(outerBar).toContain("h-[var(--office-bar)]");
    expect(confirmButton).toContain("border-transparent");
    expect(confirmButton).toContain("flex-1");
    expect(discardButton).toContain("flex-none");
  });

  it("labels the region in both languages", () => {
    expect(officeMessages(es).confirmBarLabel).toBe("Cambios");
    expect(officeMessages(en).confirmBarLabel).toBe("Changes");
  });

  /**
   * The bar is portalled to `document.body` and fixed, so it covers the last
   * `--office-bar` worth of whatever else is on the page — the site footer,
   * on every office tab — instead of pushing it up. `data-office-bar` marks
   * the bar so a global rule can pad the body clear of it, at whichever
   * height the current breakpoint sets.
   */
  it("marks itself so the page can pad its footer clear of the fixed bar", () => {
    const outerBar = sectionBetween(source, 'export function ConfirmBar', 'role="region"');
    expect(outerBar).toContain("data-office-bar");
    expect(globalsSource).toContain("body:has([data-office-bar])");
    expect(globalsSource).toContain("padding-bottom: var(--office-bar);");
  });

  /**
   * A client card's email is the one thing on it that must be unique, and
   * an account holder's is theirs alone: both refusals get words of their
   * own rather than the general "that change did not save".
   */
  it("words a client card's email refusals, in both languages and without dashes", () => {
    expect(source).toContain('taken: "clientErrorTaken"');
    expect(source).toContain('"locked-email": "clientErrorLockedEmail"');
    for (const bundle of [es, en]) {
      for (const key of ["clientErrorTaken", "clientErrorLockedEmail"]) {
        expect(officeMessages(bundle)[key], key).toBeTruthy();
        expect(officeMessages(bundle)[key]).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });

  /**
   * The error shares the truncated status line, which can hide it on a
   * phone. `title` carries the untruncated status plus error so it can
   * still be read on long-press/hover.
   */
  it("gives the status line a title with the full text, error included", () => {
    const statusParagraph = sectionBetween(source, "<p\n", "</p>");
    expect(statusParagraph).toContain("title={fullStatus}");
    expect(source).toContain(
      'const fullStatus = errorLine ? `${statusLine} · ${errorLine}` : statusLine;',
    );
  });
});
