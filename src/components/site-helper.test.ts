import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `Sheet`'s own back-gesture concern does not apply here (this panel is not
 * a `Sheet`), but the same shape of bug does: `HelperPanel` is only ever
 * mounted while `open`, so a fresh `onClose` on every render of `SiteHelper`
 * would still be handed down correctly — the real risk this guards against
 * is the thread's own state creeping up into `SiteHelper` and re-mounting
 * (and so resetting) `HelperPanel` on an unrelated render. See
 * `office/help-sheet.test.ts` for the sibling case this mirrors.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/site-helper.tsx"), "utf8");

describe("the site helper", () => {
  it("holds a stable close callback rather than a fresh one each render", () => {
    expect(source).toContain("const close = useCallback(() => setOpen(false), [])");
    expect(source).toContain("onClose={close}");
    expect(source).not.toContain("onClose={() => setOpen(false)}");
  });

  it("keeps the thread's own state in HelperPanel, not in the button that owns open/close", () => {
    const outer = source.slice(source.indexOf("export function SiteHelper"), source.indexOf("function HelperPanel"));
    expect(outer).toContain("useState(false)");
    expect(outer).not.toContain("Turn[]");

    const inner = source.slice(source.indexOf("function HelperPanel"));
    expect(inner).toContain("useState<readonly Turn[]>([])");
  });

  it("hides on the office, the cart and checkout, so it never sits over the pay button on a phone", () => {
    const gate = source.slice(source.indexOf("export function SiteHelper"), source.indexOf("function HelperPanel"));
    expect(gate).toContain('pathname.startsWith("/office")');
    expect(gate).toContain('pathname === "/cart"');
    expect(gate).toContain('pathname.startsWith("/checkout")');
  });

  /**
   * A question that never got an answer never happened: the thread and the
   * box both go back to what they held before it was asked, so the next
   * question's history is well formed (see `site-helper.test.ts`'s "drops a
   * leading assistant turn" case, in `lib/`, for the other half of this).
   */
  it("rolls the thread — and the typed question — back on a failed ask, in both failure paths", () => {
    const askStart = source.indexOf("async function ask");
    const body = source.slice(askStart, source.indexOf("return (\n", askStart));
    const rollbacks = body.split("setThread(history);").length - 1;
    expect(rollbacks).toBe(2);
    expect(body).toContain("setQuestion(trimmed);");
  });

  it("keeps the WhatsApp button outside the form, so it stays visible whatever the thread shows", () => {
    const afterForm = source.slice(source.indexOf("</form>"));
    expect(afterForm).toContain("ExternalButtonLink");
    expect(afterForm).toContain('whatsappLink(t("whatsappMessage"))');
  });

  /**
   * The model's own words are never markup (RULES tells it to write plain
   * text, `lib/site-helper.test.ts`), so a path it quotes is turned into a
   * `Link` by building elements from `tokenizeAnswer`'s segments — never by
   * handing the model's text to `dangerouslySetInnerHTML`. Only an answer is
   * tokenized; the visitor's own question renders as plain text.
   */
  it("turns an answer's own quoted path into a real Link, never by trusting the model's text as markup", () => {
    expect(source).toContain("import { tokenizeAnswer } from \"@/lib/answer-links\"");
    expect(source).not.toContain("dangerouslySetInnerHTML={");
    expect(source).toContain('turn.role === "assistant" ? renderAnswer(turn.text) : turn.text');

    const renderAnswer = source.slice(source.indexOf("function renderAnswer"), source.indexOf("const SUGGESTIONS"));
    expect(renderAnswer).toContain("tokenizeAnswer(text)");
    expect(renderAnswer).toContain('segment.type === "link"');
    expect(renderAnswer).toMatch(/<Link key=\{index\} href=\{segment\.href\}/);
  });
});
