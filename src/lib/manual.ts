import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The office manual, `docs/manual-del-taller.html`, read in one place for
 * everything that needs it: the office page that shows it
 * (`office/manual/page.tsx`), the helper that answers from it
 * (`office-helper.ts`), and the old raw route (`api/office/manual`).
 *
 * The file carries no styling of its own. The page dresses it with the
 * site's `.manual` rules in `globals.css`, so it reads in the office's own
 * type and colours rather than as a separate document.
 */

const MANUAL_PATH = path.join(process.cwd(), "docs", "manual-del-taller.html");

/** Read once per server lifetime; missing is a fact, not a retry. */
let manualHtml: string | null | undefined;

/** The manual's raw HTML. `null` when it is missing. */
export function readManual(): string | null {
  if (manualHtml === undefined) {
    try {
      manualHtml = readFileSync(MANUAL_PATH, "utf8");
    } catch {
      manualHtml = null;
    }
  }
  return manualHtml;
}

const SHEET_OPEN = '<div class="sheet">';

/**
 * Only what sits inside `<div class="sheet">`, which is the manual itself:
 * the head of the file (charset, title) has no place inside a page the
 * office layout already frames. The sheet is the outermost div and closes
 * last, so its end is the file's last `</div>`; the notes inside it are
 * divs too, which is why this does not stop at the first one.
 */
export function manualSheet(html: string): string | null {
  const start = html.indexOf(SHEET_OPEN);
  const end = html.lastIndexOf("</div>");
  if (start === -1 || end <= start) return null;
  return html.slice(start + SHEET_OPEN.length, end).trim();
}
