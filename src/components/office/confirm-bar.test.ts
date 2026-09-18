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

const officeMessages = (bundle: { office: object }) => bundle.office as Record<string, string>;

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
    expect(source).not.toContain("sticky");
    expect(source).toContain("fixed inset-x-0 bottom-0");
    expect(source).toContain("bg-paper");
    expect(source).not.toContain("bg-paper/95");
    expect(source).toContain("shell");
    expect(source).toContain("z-[60]");
  });
});
