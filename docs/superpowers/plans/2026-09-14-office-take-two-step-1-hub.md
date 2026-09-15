# Office take two, step 1: Hub, the always-visible bar, and phone-friendly prices — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the Trabajo tab into the first tab and call it Hub, keep the confirm bar on screen at all times, and make a price box behave on a phone.

**Architecture:** The office is a set of Next.js App Router pages under `src/app/[locale]/office/`, one per tab, listed once in `src/components/office/tabs.ts`; each editable tab wraps its content in `OfficeDraftProvider`, which collects changes and renders the `ConfirmBar`. This step deletes the `work/` page, moves its sections into the first page, redirects the old address in `next.config.ts`, lets `ConfirmBar` render at zero changes, and swaps the price inputs from `type="number"` to a decimal text field parsed by a new pure helper.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, next-intl 4 (messages in `src/messages/{es,en}.json`), Tailwind 4, Vitest (node environment, `src/**/*.test.ts`, no DOM), zod.

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md`, Amendment 4, sections 1, 6, 7 and 12 (step 1). Read the amendment before starting.

## Global Constraints

- Never run `fly deploy` by hand; the user deploys with `npm run deploy` from `main`. Never scale past one machine.
- Nothing saves before Daysi presses Confirmar cambios; nothing is ever physically deleted.
- Exactly one `ownerAction` per `actions.ts` file under `src/app/[locale]/office/`, checked by `src/lib/action-guard.test.ts` ("office action structure"). Do not add a second export to `office/actions.ts`.
- Every page under `office/` must appear in `OFFICE_TABS`; `src/components/office/tabs.test.ts` compares the tab list to the `page.tsx` files on disk.
- `src/messages/es.json` and `src/messages/en.json` must have the same keys under `office`, and no label may contain an em dash (`—`).
- Daysi reads Spanish; the tab label is **Hub** in both languages.
- `docs/manual-del-taller.html` and `docs/next-steps.md` are updated in the same pull request as the code they describe.
- Tests: `npm test` (Vitest, node environment, structural scans read source files with `fs`). Typecheck: `npm run typecheck`. Smoke against a running dev server: `SMOKE_URL=http://localhost:3000 npm run smoke`.
- Commit messages end with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch: `office-take-two-1-hub`, from `main` once PR #40 (the spec) is merged; from `office-take-two-spec` if it is not.

---

## File structure

| File | Responsibility after this step |
| --- | --- |
| `src/components/office/tabs.ts` | The seven tabs, first one `hub` at `/office` |
| `src/app/[locale]/office/page.tsx` | The Hub page: figures, work, sessions, messages and premiere list, six months of bars, retired group |
| `src/app/[locale]/office/work/page.tsx` | Deleted |
| `src/app/[locale]/office/work/actions.ts` | Unchanged home of `applyWorkChanges`; loses one revalidate path |
| `next.config.ts` | Permanent redirect `/:locale/office/work` to `/:locale/office` |
| `scripts/smoke.mjs` | Checks the redirect instead of listing `/office/work` as private |
| `src/components/office/confirm-bar.tsx` | Always renders; idle state reads "Sin cambios" with Confirmar greyed |
| `src/lib/money.ts` | Gains `centsFromInput(text)` |
| `src/components/price-manager.tsx` | Decimal text inputs that select on focus and parse through `centsFromInput` |
| `src/messages/{es,en}.json` | `tabHub` and `noChanges` added; `tabToday` and `tabWork` removed |
| `src/components/office/tabs.test.ts` | Seven tabs, the hub page, the redirect |
| `src/components/office/confirm-bar.test.ts` | New: structural check of the idle state |
| `src/lib/money.test.ts` | New: `centsFromInput` |
| `src/components/price-manager.test.ts` | New: structural check of the input attributes |
| `docs/manual-del-taller.html`, `docs/next-steps.md`, the spec | Words follow the code |

---

### Task 1: The Hub page

**Files:**
- Modify: `src/components/office/tabs.ts`
- Modify: `src/app/[locale]/office/page.tsx`
- Delete: `src/app/[locale]/office/work/page.tsx`
- Modify: `src/app/[locale]/office/work/actions.ts:30-38`
- Modify: `src/messages/es.json:472-473`, `src/messages/en.json:472-473`
- Modify: `src/components/office/tabs.test.ts:10-31`, `:73-83`
- Modify: `docs/manual-del-taller.html:364-365`, `:632-634`, `:684`
- Modify: `docs/next-steps.md:10`, `:21`, `:98`, `:104`, `:135`
- Modify: `docs/superpowers/specs/2026-09-02-office-hub-design.md` (Amendment 4, section 1)

**Interfaces:**
- Consumes: `applyWorkChanges` from `./work/actions` (unchanged signature, an `ownerAction` over `changesOf(workChangeSchema)`); `OfficeRequestList`, `PremiereSignupList`, `WorkRetiredGroup`, `Figure`, `OfficeDraftProvider` as they exist today.
- Produces: `OFFICE_TABS[0]` is `{ id: "hub", href: "/office", labelKey: "tabHub" }`; message keys `office.tabHub` in both languages. Task 2 relies on `work/page.tsx` being gone.

- [ ] **Step 1: Update the tab test to describe seven tabs and a hub**

In `src/components/office/tabs.test.ts`, replace the header comment and first test:

```ts
/**
 * The office is seven tabs, and everything that has to agree about them,
 * the routes, the smoke script, the two languages, the guard, is checked
 * here against one list rather than trusted to stay in step by hand.
 */
```

```ts
describe("the office tabs", () => {
  it("are seven, in the agreed order, each under /office", () => {
    expect(OFFICE_TABS.map((tab) => tab.id)).toEqual([
      "hub",
      "collection",
      "gallery",
      "fabrics",
      "prices",
      "shopfront",
      "books",
    ]);
    for (const tab of OFFICE_TABS) {
      expect(tab.href === "/office" || tab.href.startsWith("/office/")).toBe(true);
    }
    expect(new Set(OFFICE_TABS.map((tab) => tab.href)).size).toBe(OFFICE_TABS.length);
  });
```

Replace the two describes for the first pages (currently "the today tab" and "the work tab") with one:

```ts
describe("the hub tab", () => {
  it("is guarded", () => {
    expectGuarded("page.tsx");
  });

  it("holds the work inside one draft provider, so the bar pins to the tab", () => {
    const source = read("page.tsx");
    const open = source.indexOf("<OfficeDraftProvider");
    const close = source.indexOf("</OfficeDraftProvider>");
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(source.indexOf("<section"));
    expect(close).toBeGreaterThan(source.lastIndexOf("</section>"));
    expect(source).toContain("applyWorkChanges");
  });
});
```

Delete the `describe("the work tab", ...)` block entirely.

- [ ] **Step 2: Run the tab test to see it fail**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL. "are seven" fails on the id list; "holds the work" fails because `page.tsx` has no provider; "matches the pages on disk" still passes for now (nothing moved yet).

- [ ] **Step 3: Rename the first tab and drop the second**

Replace the list in `src/components/office/tabs.ts`:

```ts
export const OFFICE_TABS = [
  { id: "hub", href: "/office", labelKey: "tabHub" },
  { id: "collection", href: "/office/collection", labelKey: "tabCollection" },
  { id: "gallery", href: "/office/gallery", labelKey: "tabGallery" },
  { id: "fabrics", href: "/office/fabrics", labelKey: "tabFabrics" },
  { id: "prices", href: "/office/prices", labelKey: "tabPrices" },
  { id: "shopfront", href: "/office/shopfront", labelKey: "tabShopfront" },
  { id: "books", href: "/office/books", labelKey: "tabBooks" },
] as const;
```

Update the doc comment's last sentence to: `The order is the order Daysi works in: the hub first, then what she sells, then the shop's own settings.`

- [ ] **Step 4: Rename the labels in both languages**

In `src/messages/es.json`, replace lines 472–473:

```json
    "tabHub": "Hub",
```

In `src/messages/en.json`, replace lines 472–473 the same way:

```json
    "tabHub": "Hub",
```

(`tabToday` and `tabWork` are gone from both files. The `office.lead` sentence stays; it already describes the hub.)

- [ ] **Step 5: Write the Hub page**

Replace the whole of `src/app/[locale]/office/page.tsx` with:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { earningsFrom, loadLedger, monthlyReceived } from "@/lib/earnings";
import { formatMoney } from "@/lib/money";
import { activeRequests, manageableRequests, REQUEST_KINDS } from "@/lib/request-store";
import { undoableIds } from "@/lib/office-history";
import { Figure } from "@/components/office/figure";
import { OfficeRequestList } from "@/components/office-request-list";
import { PremiereSignupList, WorkRetiredGroup } from "@/components/office/premiere-signup-list";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "./_lib/viewer";
import { applyWorkChanges } from "./work/actions";

/**
 * Hub: the money at a glance, then what needs her, then the months.
 *
 * One tab where there were two (Hoy and Trabajo, until 14 September 2026).
 * The figures and the work read the same ledger, so it is loaded once. The
 * six months of bars sit under the work: they are read when there is time,
 * not acted on. The whole page sits inside one draft provider so the bar
 * pins to the bottom of the tab, as on every other editable tab.
 */
export default async function OfficeHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const ledger = loadLedger();
  const earnings = earningsFrom(ledger);
  const months = monthlyReceived(ledger, 6, new Date());
  const peak = Math.max(...months.map((month) => month.total), 1);

  const appointments = ledger.filter((record) => record.kind === "appointment");
  const work = ledger.filter((record) => record.kind !== "appointment");
  const messages = activeRequests("contact");
  const signups = activeRequests("premiere-signup");
  const retired = REQUEST_KINDS.flatMap(manageableRequests).filter((record) => record.retired);
  const undoable = undoableIds("request-status");
  const withUndoable = (records: typeof work) =>
    records.map((record) => ({ ...record, undoable: undoable.has(record.reference) }));

  return (
    <OfficeDraftProvider apply={applyWorkChanges}>
      <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t("received")} value={formatMoney(earnings.received, language)} emphasis />
        <Figure label={t("outstanding")} value={formatMoney(earnings.outstanding, language)} />
        <Figure label={t("openJobs")} value={String(earnings.openCount)} />
        <Figure label={t("upcomingSessions")} value={String(appointments.length)} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("work")}</h2>
        <OfficeRequestList records={withUndoable(work)} locale={language} emptyMessage={t("noWork")} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("sessions")}</h2>
        <OfficeRequestList
          records={withUndoable(appointments)}
          locale={language}
          emptyMessage={t("noSessions")}
        />
      </section>

      <section className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("messages")}</h2>
          <OfficeRequestList
            records={withUndoable(messages)}
            locale={language}
            emptyMessage={t("noMessages")}
          />
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("premiereList")}</h2>
          <PremiereSignupList records={signups} emptyMessage={t("noSignups")} />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("lastMonths")}</h2>
        {/* A plain bar row: six months is a shape you read, not a chart you study. */}
        <div className="flex items-end gap-3 border-b border-line pb-3" style={{ height: "9rem" }}>
          {months.map((month) => (
            <div key={month.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[0.6875rem] tabular-nums text-ink-faint">
                {month.total > 0 ? formatMoney(month.total, language) : ""}
              </span>
              <div
                className="w-full bg-marigold"
                style={{ height: `${Math.max((month.total / peak) * 100, 1)}%` }}
                aria-hidden
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {months.map((month) => (
            <p
              key={month.month}
              className="flex-1 text-center text-[0.625rem] uppercase tracking-[0.14em] text-ink-faint"
            >
              {new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
                month: "short",
              }).format(new Date(`${month.month}-15T12:00:00`))}
            </p>
          ))}
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("chartNote")}</p>
      </section>

      <WorkRetiredGroup records={retired} />
    </OfficeDraftProvider>
  );
}
```

- [ ] **Step 6: Delete the Work page and trim the action's revalidate list**

```bash
git rm src/app/\[locale\]/office/work/page.tsx
```

In `src/app/[locale]/office/work/actions.ts`, remove the line `"/[locale]/office/work",` from the `revalidate` array. The array keeps `"/[locale]/office"` (already there), `"/[locale]/office/books"`, `"/[locale]/account"`, `"/[locale]/account/orders"`, `"/[locale]/appointments"`. Do not move or rename the file: the structure test wants one action per file, and `office/actions.ts` already holds the undo reader.

- [ ] **Step 7: Run the tab test, the action structure test and the typecheck**

Run: `npx vitest run src/components/office/tabs.test.ts src/lib/action-guard.test.ts src/lib/request-store.test.ts && npm run typecheck`
Expected: all PASS. If "matches the pages on disk" fails, a `page.tsx` still exists under `office/work/`; if "has the same keys in both languages" fails, one of the JSON files still has `tabToday` or `tabWork`.

- [ ] **Step 8: Update the manual, the status page and the spec**

`docs/manual-del-taller.html` line 364–365, replace:

```html
        fila de pestañas: Hoy, Trabajo, Colección, Galería, Telas, Precios,
        Vitrina y Libros. En el teléfono la fila se desliza de lado.
```

with:

```html
        fila de pestañas: Hub, Colección, Galería, Telas, Precios, Vitrina y
        Libros. En el teléfono la fila se desliza de lado.
```

Lines 632–634, replace:

```html
      Todo esto vive en la pestaña <span class="label">Trabajo</span>
      (<span class="path">/es/office/work</span>): los pedidos y arreglos,
      las citas, los mensajes y la lista de estreno.
```

with:

```html
      Todo esto vive en la pestaña <span class="label">Hub</span>
      (<span class="path">/es/office</span>), debajo de las cifras del día: los
      pedidos y arreglos, las citas, los mensajes y la lista de estreno.
```

Line 684, replace `prendas. En Trabajo también puede retirar pedidos, arreglos, citas,` with `prendas. En Hub también puede retirar pedidos, arreglos, citas,`.

`docs/next-steps.md`: run

```bash
perl -pi -e 's/Hoy, Trabajo, Colección/Hub, Colección/; s/\bTrabajo\b/Hub/g' docs/next-steps.md
```

then add, under the "What is done" list, the bullet:

```markdown
- **Hub** (14 September 2026): Hoy and Trabajo are one tab. The old Trabajo address still works and lands on Hub.
```

Spec, Amendment 4 section 1: replace `which moves out of \`work/actions.ts\` into \`office/actions.ts\` beside the undo reader already there; its revalidate list names \`/[locale]/office\` where it named \`/[locale]/office/work\`.` with `which stays in \`work/actions.ts\` (the structure test allows one action per file, and \`office/actions.ts\` already holds the undo reader); its revalidate list drops \`/[locale]/office/work\`.`

- [ ] **Step 9: Commit**

```bash
git add src/components/office/tabs.ts "src/app/[locale]/office/page.tsx" "src/app/[locale]/office/work/actions.ts" src/messages/es.json src/messages/en.json src/components/office/tabs.test.ts docs/manual-del-taller.html docs/next-steps.md docs/superpowers/specs/2026-09-02-office-hub-design.md
git commit -m "Fold Trabajo into the first tab and call it Hub

One tab where there were two: the figures, then the orders, sessions,
messages and premiere list, then the six months of bars, all inside one
draft provider so the bar pins to the tab. The tab is Hub in both
languages. The work action stays in its file; only its revalidate list
loses the address that no longer exists.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The old address redirects

**Files:**
- Modify: `next.config.ts:52-56` (add `redirects()` beside `headers()`)
- Modify: `scripts/smoke.mjs:38-49`, `:107-116`
- Modify: `src/components/office/tabs.test.ts` (the "smoke script" describe)

**Interfaces:**
- Consumes: Task 1 deleted `work/page.tsx`, so `/es/office/work` currently 404s.
- Produces: `GET /es/office/work` answers 308 with `Location: /es/office`; same for `en`.

- [ ] **Step 1: Write the structural test**

In `src/components/office/tabs.test.ts`, inside `describe("the smoke script", ...)`, add a second test:

```ts
  it("checks that the old Trabajo address redirects into the office for good", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toContain('source: "/:locale(es|en)/office/work"');
    expect(config).toContain('destination: "/:locale/office"');
    expect(config).toContain("permanent: true");

    const smoke = fs.readFileSync(path.join(process.cwd(), "scripts/smoke.mjs"), "utf8");
    expect(smoke, "the redirect is checked").toContain("/es/office/work");
    expect(smoke, "as a 308").toContain("308");
    expect(smoke, "and no longer listed as a private page").not.toContain('"/office/work"');
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/office/tabs.test.ts -t "old Trabajo"`
Expected: FAIL on `next.config.ts` lacking the source string.

- [ ] **Step 3: Add the redirect**

In `next.config.ts`, after the `async headers()` method inside `config`, add:

```ts
  /**
   * Trabajo folded into Hub on 14 September 2026. The address lived in
   * bookmarks and in the manual, so it keeps working. 308 rather than 301
   * for the same reason as the www redirect in middleware: the method and
   * body survive, so nothing posted here turns into a GET.
   */
  async redirects() {
    return [
      {
        source: "/:locale(es|en)/office/work",
        destination: "/:locale/office",
        permanent: true,
      },
    ];
  },
```

- [ ] **Step 4: Change the smoke script**

In `scripts/smoke.mjs`, remove the line `  "/office/work",` from `PRIVATE`. After the `for (const path of PRIVATE) { ... }` loop, add:

```js
// Trabajo folded into Hub on 14 September 2026; the old address must land
// on the office rather than 404 for anyone who bookmarked it.
await check("the old Trabajo address redirects into the office", async () => {
  const response = await fetch(`${BASE}/es/office/work`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  return {
    ok: response.status === 308 && location.endsWith("/es/office"),
    detail: `${response.status} -> ${location || "(none)"}`,
  };
});
```

- [ ] **Step 5: Run the test and the typecheck**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Prove the redirect against a running server**

Start the dev server in one terminal (`npm run dev`, note the port it prints), then:

```bash
curl -sI http://localhost:3000/es/office/work | head -3
```

Expected: `HTTP/1.1 308 Permanent Redirect` and `location: /es/office`. Then run the smoke script:

```bash
SMOKE_URL=http://localhost:3000 npm run smoke
```

Expected: every line `ok`, including "the old Trabajo address redirects into the office" and "/office is not reachable signed out". Stop the dev server.

- [ ] **Step 7: Correct the spec's sentence about where the redirect lives**

In `docs/superpowers/specs/2026-09-02-office-hub-design.md`, Amendment 4 section 1, replace:

`` `office/work/page.tsx` stays as a permanent redirect to `/office`, so bookmarks and the manual's links keep working. ``

with:

`` The old `/office/work` address redirects permanently to `/office` through `redirects()` in `next.config.ts`, so bookmarks and the manual's links keep working; a page left under `office/work/` would count as an unlisted tab in the tab test. ``

- [ ] **Step 8: Commit**

```bash
git add next.config.ts scripts/smoke.mjs src/components/office/tabs.test.ts docs/superpowers/specs/2026-09-02-office-hub-design.md
git commit -m "Redirect the old Trabajo address into the office for good

A permanent redirect in next.config rather than a page under office/:
the tab test treats any page.tsx there as a tab, and the address only
has to land somewhere. The smoke script checks the 308 instead of
listing the address as a private page.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The bar is always on the page

**Files:**
- Modify: `src/components/office/confirm-bar.tsx:13-58`
- Create: `src/components/office/confirm-bar.test.ts`
- Modify: `src/messages/es.json:518`, `src/messages/en.json:518` (add `noChanges` after `discardChanges`)
- Modify: `docs/manual-del-taller.html:369-375`

**Interfaces:**
- Consumes: `ConfirmBar` props are unchanged: `{ count, status, error, onConfirm, onDiscard }`; `use-office-draft.tsx` already renders it unconditionally.
- Produces: message key `office.noChanges` in both languages.

- [ ] **Step 1: Write the structural test**

Create `src/components/office/confirm-bar.test.ts`:

```ts
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

describe("the confirm bar", () => {
  it("never leaves the page", () => {
    expect(source).not.toContain("if (count === 0) return null;");
    expect(source).toContain("const idle = count === 0;");
    expect(source).toContain('{idle ? t("noChanges") : t("changesPending", { count })}');
  });

  it("greys the confirm button and hides discard while there is nothing staged", () => {
    expect(source).toContain('disabled={idle || status === "confirming"}');
    expect(source).toContain("{idle ? null : (");
  });

  it("says so in both languages", () => {
    expect((es.office as Record<string, string>).noChanges).toBe("Sin cambios");
    expect((en.office as Record<string, string>).noChanges).toBe("No changes");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/office/confirm-bar.test.ts`
Expected: FAIL on all three.

- [ ] **Step 3: Add the words**

In `src/messages/es.json`, after the line `    "discardChanges": "Descartar",` add:

```json
    "noChanges": "Sin cambios",
```

In `src/messages/en.json`, after `    "discardChanges": "Discard",` add:

```json
    "noChanges": "No changes",
```

- [ ] **Step 4: Let the bar render at zero**

In `src/components/office/confirm-bar.tsx`, replace the `ConfirmBar` function (keep `ErrorText` and `Pending` as they are):

```tsx
/**
 * Always on the page, since 14 September 2026. With nothing staged it reads
 * "Sin cambios" with a greyed Confirmar and no Descartar, in the same place
 * it will be when something is: a button she can always see is one she
 * never has to look for.
 */
export function ConfirmBar({
  count,
  status,
  error,
  onConfirm,
  onDiscard,
}: {
  count: number;
  status: DraftStatus;
  error?: string;
  onConfirm(): void;
  onDiscard(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const idle = count === 0;

  return (
    <div
      role="status"
      className="sticky bottom-0 z-30 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-paper/95 py-3 backdrop-blur-md"
    >
      <div>
        <p className={`text-sm font-semibold ${idle ? "text-ink-faint" : ""}`}>
          {idle ? t("noChanges") : t("changesPending", { count })}
        </p>
        {status === "failed" && error ? (
          <p className="mt-1 text-[0.8125rem] text-ink"><ErrorText code={error} /></p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {idle ? null : (
          <button
            type="button"
            onClick={onDiscard}
            disabled={status === "confirming"}
            className="border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {t("discardChanges")}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={idle || status === "confirming"}
          className="bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40"
        >
          {status === "confirming" ? t("confirming") : t("confirmChanges")}
        </button>
      </div>
    </div>
  );
}
```

The return type changes from `JSX.Element | null` to `JSX.Element`; nothing else imports that type.

- [ ] **Step 5: Run the test, the tab test (key parity) and the typecheck**

Run: `npx vitest run src/components/office/confirm-bar.test.ts src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Update the manual**

In `docs/manual-del-taller.html` lines 369–375, replace:

```html
      <strong>Confirmar cambios:</strong> cada pestaña junta todo lo que usted
      toca y lo marca como <span class="label">pendiente</span>. Una barra abajo
      cuenta los cambios, y nada llega al sitio hasta que toca
      <span class="btn">Confirmar cambios</span>. <span class="btn">Descartar</span>
      bota ese borrador. Si intenta salir con cambios pendientes, el sitio le
      pregunta una vez antes de salir.
```

with:

```html
      <strong>Confirmar cambios:</strong> cada pestaña junta todo lo que usted
      toca y lo marca como <span class="label">pendiente</span>. La barra de
      abajo siempre está a la vista: dice <span class="label">Sin cambios</span>
      hasta que usted toca algo, y entonces cuenta los cambios. Nada llega al
      sitio hasta que toca <span class="btn">Confirmar cambios</span>.
      <span class="btn">Descartar</span> bota ese borrador. Si intenta salir
      con cambios pendientes, el sitio le pregunta una vez antes de salir.
```

In `docs/next-steps.md`, under "What is done", add:

```markdown
- **The confirm bar is always there** (14 September 2026): it reads "Sin cambios" with a greyed button until she changes something.
```

- [ ] **Step 7: Commit**

```bash
git add src/components/office/confirm-bar.tsx src/components/office/confirm-bar.test.ts src/messages/es.json src/messages/en.json docs/manual-del-taller.html docs/next-steps.md
git commit -m "Keep the confirm bar on the page at all times

It used to appear only once something was staged, so the button was
never where she last saw it. Now it is always at the bottom: Sin cambios
and a greyed Confirmar until she touches something, then the count and
Descartar as before.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: A price box that behaves on a phone

**Files:**
- Modify: `src/lib/money.ts` (add `centsFromInput`)
- Create: `src/lib/money.test.ts`
- Modify: `src/components/price-manager.tsx:1-8` (import), `:112-130` (the input)
- Create: `src/components/price-manager.test.ts`

**Interfaces:**
- Produces: `centsFromInput(text: string): number | null` in `@/lib/money`. Integer cents for a non-negative amount with up to two decimals, written with a point or a comma; `null` for anything else. Range limits stay in the caller.

- [ ] **Step 1: Write the failing test for the helper**

Create `src/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { centsFromInput } from "./money";

describe("centsFromInput", () => {
  it("reads a price typed with a point", () => {
    expect(centsFromInput("195.00")).toBe(19500);
    expect(centsFromInput("195")).toBe(19500);
    expect(centsFromInput("76.5")).toBe(7650);
    expect(centsFromInput("0")).toBe(0);
  });

  it("reads a price typed with a comma, which is what a Spanish keypad offers", () => {
    expect(centsFromInput("195,50")).toBe(19550);
    expect(centsFromInput(" 44,00 ")).toBe(4400);
  });

  it("returns null for anything that is not an amount", () => {
    for (const text of ["", "   ", "abc", "-1", "1.2.3", "1,000.00", "12.345", "$5"]) {
      expect(centsFromInput(text), JSON.stringify(text)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/money.test.ts`
Expected: FAIL with `centsFromInput` is not exported.

- [ ] **Step 3: Add the helper**

Append to `src/lib/money.ts`:

```ts
/**
 * Cents from what someone typed into a price box.
 *
 * Accepts a comma as the decimal mark: a phone showing a Spanish keyboard
 * offers a comma on its number pad where an English one offers a point, and
 * `parseFloat("195,50")` would quietly read as 195. Anything that is not a
 * plain non-negative amount with at most two decimals is null; the caller
 * decides the range.
 */
export function centsFromInput(text: string): number | null {
  const normalised = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalised)) return null;
  return Math.round(parseFloat(normalised) * 100);
}
```

- [ ] **Step 4: Run the helper test**

Run: `npx vitest run src/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the structural test for the input**

Create `src/components/price-manager.test.ts`:

```ts
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
    expect(source).toContain("onFocus={(event) => event.currentTarget.select()}");
    expect(source).toContain('import { centsFromInput } from "@/lib/money";');
    expect(source).toContain("next.map(centsFromInput)");
    expect(source).not.toContain("parseFloat(");
  });

  it("are tall enough to tap", () => {
    expect(source).toContain("min-h-11");
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run src/components/price-manager.test.ts`
Expected: FAIL on all three.

- [ ] **Step 7: Change the input**

In `src/components/price-manager.tsx`, add the import after the `useTranslations` import:

```ts
import { centsFromInput } from "@/lib/money";
```

Replace the `<input ... />` inside `PriceTable` (the element with `type="number" min="0" max="5000" step="0.01"`) with:

```tsx
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={value}
                disabled={retiring}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                  const next = [...shown];
                  next[index] = event.target.value;
                  setTyping((current) => ({ ...current, [row.id]: next }));
                  const cents = next.map(centsFromInput);
                  if (cents.some((amount) => amount === null || amount > 500_000)) return;
                  const amounts = cents.map((amount) => amount ?? 0);
                  if (amounts.every((amount, amountIndex) => amount === row.amounts[amountIndex])) draft.unstage(key);
                  else draft.stage(key, { wire: toChange(row.id, amounts) });
                }}
                onBlur={() => setTyping((current) => {
                  const { [row.id]: _removed, ...rest } = current;
                  return rest;
                })}
                className="min-h-11 w-24 bg-transparent py-1.5 pl-1 text-right text-[0.875rem] tabular-nums"
              />
```

(`amount ?? 0` never fires: the line above returns when any entry is null. It exists so TypeScript sees `number[]` without a cast.)

- [ ] **Step 8: Run both tests and the typecheck**

Run: `npx vitest run src/components/price-manager.test.ts src/lib/money.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts src/components/price-manager.tsx src/components/price-manager.test.ts
git commit -m "Make a price box behave on a phone

A decimal text field instead of a number input: the phone shows a number
pad, a tap selects the whole value so typing replaces it, and the value
goes through centsFromInput, which reads a comma as the decimal mark
because that is what a Spanish keypad offers.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Whole-suite check, browser pass, pull request

**Files:**
- None modified unless a check fails.

- [ ] **Step 1: Run everything**

Run: `npm run typecheck && npm test`
Expected: PASS, with the test count higher than before by the three new files (`confirm-bar.test.ts`, `money.test.ts`, `price-manager.test.ts`).

- [ ] **Step 2: Browser pass at phone width**

Start `npm run dev`. Request a sign-in link for the owner address in `.env.local` (`daysi@daysicollection.test`) from `/es/sign-in`; the link prints in the dev server log; open it. Then, with the browser at 375 px wide:

1. `/es/office`: the tab strip reads Hub, Colección, Galería, Telas, Precios, Vitrina, Libros. The page shows the four figures, Pedidos y arreglos, Citas, Mensajes and Lista de estreno, Los últimos seis meses, Retirados. The bar at the bottom reads **Sin cambios** with Confirmar cambios greyed and no Descartar.
2. Change a request's status: the bar switches to "1 cambio sin confirmar" with Descartar; press Descartar; it returns to Sin cambios.
3. Tap Precios in the strip: no prompt (nothing staged). On Precios, tap a price box: the whole number is selected and the keyboard is a number pad (in desktop Chrome, check the devtools device toolbar reports `inputmode=decimal`; the selection is visible). Type `200`: the box reads 200, the bar counts one change. Type `200,50` in another: it stages (the bar counts two). Press Descartar.
4. Type into a price, then tap Hub in the strip: the "Tiene cambios sin confirmar" prompt appears; cancel; Descartar.
5. `/es/office/work`: lands on `/es/office`.
6. Switch to English (`/en/office`): the tab reads Hub; the bar reads No changes.

- [ ] **Step 3: Smoke**

With the dev server still up: `SMOKE_URL=http://localhost:3000 npm run smoke`. Expected: every line `ok`. Stop the server.

- [ ] **Step 4: Open the pull request**

```bash
git push -u origin office-take-two-1-hub
gh pr create --base main --title "Office take two, step 1: Hub, the always-visible bar, phone-friendly prices" --body-file - <<'EOF'
## What changed

- **Hub.** Hoy and Trabajo are one tab, called Hub in both languages: the four figures, then orders and alterations, sessions, messages and the premiere list, then the six months of bars, then Retirados. `/office/work` redirects permanently to `/office`.
- **The bar never leaves.** With nothing staged it reads Sin cambios with a greyed Confirmar cambios; Descartar appears with the first change.
- **Price boxes on a phone.** Decimal text fields: a tap selects the whole value, the phone shows a number pad, and a comma works as the decimal mark (`centsFromInput` in `lib/money.ts`).
- Manual, status page and the spec's section 1 follow the code.

## Why

Amendment 4 of the office design (PR #40), step 1 of five. The first of the changes Gamaliel asked for on 14 September: fewer tabs, a button that is always where she left it, and a price she can type on her phone.

## Checks

- `npm run typecheck`, `npm test` green; three new test files.
- Smoke green against a dev server, including the new 308 check.
- Browser pass at 375 px: Hub sections, Sin cambios, staged change count, discard, the leave-tab prompt, select-on-focus, the comma, and the redirect.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 5: Report**

Give the user the PR URL. Deploy is theirs: after merge, `npm run deploy` from `main`, then `SMOKE_URL=https://daysiscollectioninc.com npm run smoke`, then update the "Deployed" line in `docs/next-steps.md`.
