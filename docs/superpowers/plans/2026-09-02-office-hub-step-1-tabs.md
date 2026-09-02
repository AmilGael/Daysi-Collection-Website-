# Office Hub Step 1: Tabbed Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single 401-line office page into eight tabbed routes behind one shared owner guard, moving every panel verbatim so nothing changes in behaviour.

**Architecture:** A new `office/layout.tsx` owns the owner check, the page header and a client-side tab strip; each tab is a route segment whose `page.tsx` re-runs the same guard through a shared `officeViewer()` helper (a layout guard does not re-run on soft navigation between siblings) and reads only its own data. Tab metadata lives in one plain-TypeScript constant so a structural test can check that every tab has a page, is guarded, is in the smoke script and is named in both languages.

**Tech Stack:** Next.js 15.5.25 App Router, React 19.1.9, next-intl 3.26.5 (`Link`/`usePathname` from `@/i18n/routing`), Tailwind v4, vitest 3, zod (untouched in this step).

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md` (section "Step 1: tabbed routes").

## Global Constraints

- Next stays pinned at `15.5.25`, React at `19.1.9`; do not touch `package.json` in this step.
- No behaviour change: every editor component and every lib reader is used exactly as today. Only `src/app/[locale]/office/**`, `src/components/office/**`, `src/messages/{es,en}.json`, `scripts/smoke.mjs` and `docs/manual-del-taller.html` change.
- No em dashes in any user-facing string (repo rule; see commit 41eec78).
- Every page under `office/` calls `setRequestLocale(locale)` then `officeViewer(locale)` before any data read.
- Deploy is `npm run deploy` (audit, typecheck, tests gate it) and is run by the user, never by the agent.
- Commit messages follow the repo's style: a plain sentence saying what changed and why, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Responsibility |
|---|---|
| `src/components/office/tabs.ts` | `OFFICE_TABS` constant: id, href, message key. Plain TS so tests import it. |
| `src/components/office/tabs.test.ts` | Structural test: tab shape, messages, page files, guard usage, smoke coverage. |
| `src/components/office/office-tabs.tsx` | Client tab strip. Active tab by exact pathname match. |
| `src/components/office/figure.tsx` | `Figure` KPI tile, moved verbatim from the old page. |
| `src/app/[locale]/office/_lib/viewer.ts` | `officeViewer(locale)`: signed out → redirect to sign-in, not owner → 404. |
| `src/app/[locale]/office/layout.tsx` | Guard, `PageHeader`, tab strip, the `shell` wrapper. |
| `src/app/[locale]/office/page.tsx` | Today: four figures and the six-month bars. |
| `src/app/[locale]/office/work/page.tsx` | Orders and alterations, sessions, messages, premiere sign-ups. |
| `src/app/[locale]/office/collection/page.tsx` | The rack and the add-a-garment form. |
| `src/app/[locale]/office/gallery/page.tsx` | Portfolio photographs. |
| `src/app/[locale]/office/fabrics/page.tsx` | The fabric wall. |
| `src/app/[locale]/office/prices/page.tsx` | Garment, alteration and session prices. |
| `src/app/[locale]/office/shopfront/page.tsx` | The site notice and the printable QR. |
| `src/app/[locale]/office/books/page.tsx` | Summary line and CSV export. |

The old `page.tsx` is the source for every move. Line numbers below refer to it as it is before Task 2 touches it. Read it once in full before starting; every page task quotes the lines it moves.

---

### Task 1: Tab metadata and labels

**Files:**
- Create: `src/components/office/tabs.ts`
- Create: `src/components/office/tabs.test.ts`
- Modify: `src/messages/es.json:463` (after the `office.lead` line)
- Modify: `src/messages/en.json:463` (after the `office.lead` line)

**Interfaces:**
- Produces: `OFFICE_TABS: readonly { id: OfficeTabId; href: string; labelKey: string }[]`, `type OfficeTabId = "today" | "work" | "collection" | "gallery" | "fabrics" | "prices" | "shopfront" | "books"`. Later tasks import both from `@/components/office/tabs`.

- [ ] **Step 1: Write the failing test**

Create `src/components/office/tabs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { OFFICE_TABS } from "./tabs";

/**
 * The office is eight tabs, and everything that has to agree about them,
 * the routes, the smoke script, the two languages, the guard, is checked
 * here against one list rather than trusted to stay in step by hand.
 */

const officeMessages = (bundle: { office: Record<string, string> }) => bundle.office;

describe("the office tabs", () => {
  it("are eight, in the agreed order, each under /office", () => {
    expect(OFFICE_TABS.map((tab) => tab.id)).toEqual([
      "today",
      "work",
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

  it("are named in both languages, and the strip has a name too", () => {
    for (const bundle of [es, en]) {
      const office = officeMessages(bundle);
      expect(office.tabsLabel).toBeTruthy();
      for (const tab of OFFICE_TABS) {
        expect(office[tab.labelKey], `${tab.id} label`).toBeTruthy();
        expect(office[tab.labelKey]).not.toContain("—");
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, "Failed to resolve import ./tabs".

- [ ] **Step 3: Create the constant**

Create `src/components/office/tabs.ts`:

```ts
/**
 * The office, as a row of tabs.
 *
 * One list, read by the layout (to draw the strip), by the tests (to check
 * every tab has a page, a guard, a smoke check and a name in each language)
 * and by nothing else. The order is the order Daysi works in: what came in
 * today, then the work, then what she sells, then the shop's own settings.
 */
export const OFFICE_TABS = [
  { id: "today", href: "/office", labelKey: "tabToday" },
  { id: "work", href: "/office/work", labelKey: "tabWork" },
  { id: "collection", href: "/office/collection", labelKey: "tabCollection" },
  { id: "gallery", href: "/office/gallery", labelKey: "tabGallery" },
  { id: "fabrics", href: "/office/fabrics", labelKey: "tabFabrics" },
  { id: "prices", href: "/office/prices", labelKey: "tabPrices" },
  { id: "shopfront", href: "/office/shopfront", labelKey: "tabShopfront" },
  { id: "books", href: "/office/books", labelKey: "tabBooks" },
] as const;

export type OfficeTab = (typeof OFFICE_TABS)[number];
export type OfficeTabId = OfficeTab["id"];
```

- [ ] **Step 4: Add the labels to both message bundles**

In `src/messages/es.json`, directly after the line `"lead": "Lo que ha entrado, lo que le deben, y lo que hay en el calendario.",` insert:

```json
    "tabsLabel": "Secciones de la oficina",
    "tabToday": "Hoy",
    "tabWork": "Trabajo",
    "tabCollection": "Colección",
    "tabGallery": "Galería",
    "tabFabrics": "Telas",
    "tabPrices": "Precios",
    "tabShopfront": "Vitrina",
    "tabBooks": "Libros",
```

In `src/messages/en.json`, directly after `"lead": "What has come in, what is owed, and what is on the calendar.",` insert:

```json
    "tabsLabel": "Office sections",
    "tabToday": "Today",
    "tabWork": "Work",
    "tabCollection": "Collection",
    "tabGallery": "Gallery",
    "tabFabrics": "Fabrics",
    "tabPrices": "Prices",
    "tabShopfront": "Shopfront",
    "tabBooks": "Books",
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/office/tabs.ts src/components/office/tabs.test.ts src/messages/es.json src/messages/en.json
git commit -m "Name the office's eight tabs once, in both languages

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Guard helper, layout, tab strip, and Today

**Files:**
- Create: `src/app/[locale]/office/_lib/viewer.ts`
- Create: `src/components/office/office-tabs.tsx`
- Create: `src/components/office/figure.tsx`
- Create: `src/app/[locale]/office/layout.tsx`
- Modify: `src/app/[locale]/office/page.tsx` (rewritten as Today; the old content is the source for Tasks 3 to 8, so copy it to `/private/tmp/claude-502/-Users-genel-Mirror-Daysi-Collection-Website-/52faf0f3-baca-41f6-800a-5af618ed082e/scratchpad/old-office-page.tsx` first, or read it from `git show HEAD:src/app/\[locale\]/office/page.tsx`)
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `OFFICE_TABS`, `OfficeTabId` from Task 1; `currentViewer`, `Viewer` from `@/lib/auth/session`; `PageHeader` from `@/components/page-header`; `Link`, `usePathname` from `@/i18n/routing`.
- Produces: `officeViewer(locale: string): Promise<Viewer>` at `src/app/[locale]/office/_lib/viewer.ts`, imported by every page as `import { officeViewer } from "../_lib/viewer";` (from Today, `"./_lib/viewer"`). `Figure({ label, value, emphasis? })` at `@/components/office/figure`. `OfficeTabs({ labels, ariaLabel })`.

- [ ] **Step 1: Add the failing structural tests**

Append to `src/components/office/tabs.test.ts` (add `import fs from "node:fs";` and `import path from "node:path";` at the top):

```ts
const officeDir = path.join(process.cwd(), "src/app/[locale]/office");

function read(relative: string): string {
  return fs.readFileSync(path.join(officeDir, relative), "utf8");
}

/** A page is guarded when it calls the shared helper and nothing else. */
function expectGuarded(relative: string) {
  const source = read(relative);
  expect(source, `${relative} calls officeViewer`).toContain("officeViewer(");
  expect(source, `${relative} does not call currentViewer itself`).not.toContain("currentViewer(");
  expect(source, `${relative} does not compare roles itself`).not.toMatch(/role !== "owner"/);
}

describe("the office layout", () => {
  it("checks the owner once, through the helper", () => {
    expectGuarded("layout.tsx");
  });

  it("has a helper that redirects the signed-out and hides from the rest", () => {
    const source = read("_lib/viewer.ts");
    expect(source).toContain("redirect(`/${locale}/sign-in`)");
    expect(source).toContain("notFound()");
  });
});

describe("the today tab", () => {
  it("is guarded", () => {
    expectGuarded("page.tsx");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, "ENOENT ... layout.tsx" for the layout test and "expected ... to contain 'officeViewer('" for Today.

- [ ] **Step 3: Write the guard helper**

Create `src/app/[locale]/office/_lib/viewer.ts` (the underscore keeps the folder out of routing):

```ts
import { notFound, redirect } from "next/navigation";
import { currentViewer, type Viewer } from "@/lib/auth/session";

/**
 * Who may be in the office, decided in one place.
 *
 * Gated twice over: the viewer must be signed in, and their address must be
 * the owner address. A client who guesses the URL gets the same 404 as a page
 * that does not exist. A 403 would confirm there is something here to find.
 *
 * The layout calls this for the shell, and every tab page calls it again as
 * its first line: a layout does not re-render when the reader moves between
 * sibling tabs, so on its own it would keep the shell up after a session
 * lapsed. The pages are what re-run on every navigation.
 */
export async function officeViewer(locale: string): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  if (viewer.role !== "owner") notFound();
  return viewer;
}
```

- [ ] **Step 4: Move the Figure tile**

Create `src/components/office/figure.tsx` with the function from old `page.tsx:379-400`, exported:

```tsx
/** One of the four figures at the top of the office. */
export function Figure({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 p-6 ${emphasis ? "bg-ink text-paper" : "bg-paper"}`}>
      <p
        className={`text-[0.625rem] font-medium uppercase tracking-[0.2em] ${
          emphasis ? "text-paper-faint" : "text-ink-faint"
        }`}
      >
        {label}
      </p>
      <p className="font-display text-[1.75rem] tabular-nums leading-none">{value}</p>
    </div>
  );
}
```

- [ ] **Step 5: Write the tab strip**

Create `src/components/office/office-tabs.tsx`:

```tsx
"use client";

import { Link, usePathname } from "@/i18n/routing";
import { OFFICE_TABS, type OfficeTabId } from "./tabs";

/**
 * The row of tabs under the office heading.
 *
 * Each tab is a real link to a real route, so it can be bookmarked and the
 * back button works. Active is an exact match on the pathname, not a prefix:
 * `/office` is the start of every other tab's path, and a prefix test would
 * light Today up everywhere. `usePathname` from the routing helpers hands
 * back the path without its locale, so the comparison is against the hrefs
 * as written in the list.
 *
 * On a phone the strip scrolls sideways rather than wrapping: eight labels
 * on three lines stop reading as tabs.
 */
export function OfficeTabs({
  labels,
  ariaLabel,
}: {
  labels: Record<OfficeTabId, string>;
  ariaLabel: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className="mt-10 overflow-x-auto">
      <ul className="flex min-w-max border-b border-line">
        {OFFICE_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.75rem] uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                }`}
              >
                {labels[tab.id]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Write the layout**

Create `src/app/[locale]/office/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { OfficeTabs } from "@/components/office/office-tabs";
import { OFFICE_TABS, type OfficeTabId } from "@/components/office/tabs";
import { officeViewer } from "./_lib/viewer";

/**
 * Daysi's office: the heading, the tabs, and the guard on the door.
 *
 * Every tab under here shares this shell. The guard runs here for the shell
 * and again in each page; see `_lib/viewer.ts` for why both.
 */
export default async function OfficeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const viewer = await officeViewer(locale);
  const t = await getTranslations("office");

  const labels = Object.fromEntries(
    OFFICE_TABS.map((tab) => [tab.id, t(tab.labelKey)]),
  ) as Record<OfficeTabId, string>;

  return (
    <>
      <PageHeader title={t("title", { name: viewer.account.name || "Daysi" })} lead={t("lead")}>
        <OfficeTabs labels={labels} ariaLabel={t("tabsLabel")} />
      </PageHeader>

      <div className="shell flex flex-col gap-16 pb-28">{children}</div>
    </>
  );
}
```

- [ ] **Step 7: Rewrite the old page as Today**

Save the old file first: `git show HEAD:"src/app/[locale]/office/page.tsx" > /private/tmp/claude-502/-Users-genel-Mirror-Daysi-Collection-Website-/52faf0f3-baca-41f6-800a-5af618ed082e/scratchpad/old-office-page.tsx`. Tasks 3 to 8 copy from that file.

Replace `src/app/[locale]/office/page.tsx` entirely with (data from old lines 53-56 and 61, JSX from old lines 181-218, unchanged):

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { earningsFrom, loadLedger, monthlyReceived } from "@/lib/earnings";
import { formatMoney } from "@/lib/money";
import { Figure } from "@/components/office/figure";
import { officeViewer } from "./_lib/viewer";

/** Today: what has come in, what is owed, and the last six months at a glance. */
export default async function OfficeTodayPage({
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

  return (
    <>
      <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t("received")} value={formatMoney(earnings.received, language)} emphasis />
        <Figure label={t("outstanding")} value={formatMoney(earnings.outstanding, language)} />
        <Figure label={t("openJobs")} value={String(earnings.openCount)} />
        <Figure label={t("upcomingSessions")} value={String(appointments.length)} />
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
    </>
  );
}
```

- [ ] **Step 8: Run the tests and the type check**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS, 5 tests; `tsc` exits 0. If `t(tab.labelKey)` fails typing because the project declares typed messages, change the layout line to `t(tab.labelKey as Parameters<typeof t>[0])`.

- [ ] **Step 9: Look at it**

Start the dev server through the preview pane (`daysi-collection` in `.claude/launch.json`), sign in as an owner address from `.env.local`, open `/es/office`. Expect: header, the tab strip with Hoy underlined, the four figures and the bars, nothing else. The other seven tabs 404 for now; that is Tasks 3 to 8. Signed out, `/es/office` redirects to `/es/sign-in`.

- [ ] **Step 10: Commit**

```bash
git add "src/app/[locale]/office/_lib/viewer.ts" "src/app/[locale]/office/layout.tsx" "src/app/[locale]/office/page.tsx" src/components/office/office-tabs.tsx src/components/office/figure.tsx src/components/office/tabs.test.ts
git commit -m "Put the office behind one door and a row of tabs, and leave Today on the first one

The guard moves to a layout and a helper every tab page calls too, so a
lapsed session is caught on the next click and not only on a full load. The
other seven tabs arrive one at a time; until each does, its address is a 404.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Work tab

**Files:**
- Create: `src/app/[locale]/office/work/page.tsx`
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `officeViewer` (Task 2); `loadLedger` from `@/lib/earnings`; `listRequests`, `currentRecords` from `@/lib/request-store`; `OfficeRequestList` from `@/components/office-request-list`.

- [ ] **Step 1: Add the failing test**

Append to `tabs.test.ts`:

```ts
describe("the work tab", () => {
  it("is guarded", () => {
    expectGuarded("work/page.tsx");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, ENOENT for `work/page.tsx`.

- [ ] **Step 3: Create the page**

Data from old lines 53, 58-59, 61-62; JSX from old lines 328-373, unchanged:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { loadLedger } from "@/lib/earnings";
import { currentRecords, listRequests } from "@/lib/request-store";
import { OfficeRequestList } from "@/components/office-request-list";
import { officeViewer } from "../_lib/viewer";

/** Work: orders and alterations, sessions, messages, and the premiere list. */
export default async function OfficeWorkPage({
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
  const messages = currentRecords(listRequests("contact"));
  const signups = currentRecords(listRequests("premiere-signup"));
  const appointments = ledger.filter((record) => record.kind === "appointment");
  const work = ledger.filter((record) => record.kind !== "appointment");

  return (
    <>
      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("work")}</h2>
        <OfficeRequestList records={work} locale={language} emptyMessage={t("noWork")} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-heading">{t("sessions")}</h2>
        <OfficeRequestList
          records={appointments}
          locale={language}
          emptyMessage={t("noSessions")}
        />
      </section>

      <section className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("messages")}</h2>
          <OfficeRequestList
            records={messages}
            locale={language}
            emptyMessage={t("noMessages")}
          />
        </div>
        <div className="flex flex-col gap-6">
          <h2 className="text-heading">{t("premiereList")}</h2>
          {signups.length === 0 ? (
            <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
              {t("noSignups")}
            </p>
          ) : (
            <ul className="flex flex-col border-t border-line">
              {signups.map((signup) => (
                <li
                  key={signup.reference}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[0.875rem]"
                >
                  <span className="break-all">{signup.client.email}</span>
                  <span className="shrink-0 text-[0.75rem] text-ink-faint">
                    {String(signup.details.Season ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Run the test and type check**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS, 6 tests; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/office/work/page.tsx" src/components/office/tabs.test.ts
git commit -m "Give the work its own tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Collection tab

**Files:**
- Create: `src/app/[locale]/office/collection/page.tsx`
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `officeViewer`; `categories`, `translate` from `@/content`; `allLiveStyles`, `styleOverrides` from `@/lib/live-catalog`; `liveFabrics`, `livePriceList` from `@/lib/live-pricing`; `CollectionManager`, `ManagedStyle` from `@/components/collection-manager`; `StyleComposer` from `@/components/style-composer`.

- [ ] **Step 1: Add the failing test**

Append to `tabs.test.ts`:

```ts
describe("the collection tab", () => {
  it("is guarded", () => {
    expectGuarded("collection/page.tsx");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, ENOENT for `collection/page.tsx`.

- [ ] **Step 3: Create the page**

Data from old lines 64-97 (without line 85, the notice, which belongs to Shopfront); JSX from old lines 220-243:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import { allLiveStyles, styleOverrides } from "@/lib/live-catalog";
import { liveFabrics, livePriceList } from "@/lib/live-pricing";
import { CollectionManager, type ManagedStyle } from "@/components/collection-manager";
import { StyleComposer } from "@/components/style-composer";
import { officeViewer } from "../_lib/viewer";

/** Collection: the rack, and the form that puts a new garment on it. */
export default async function OfficeCollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const overridesById = new Map(styleOverrides().map((override) => [override.styleId, override]));
  const managedStyles: ManagedStyle[] = allLiveStyles().map((style) => ({
    id: style.id,
    name: translate(style.name, language),
    category: translate(
      categories.find((category) => category.id === style.categoryId)?.name ?? {
        en: style.categoryId,
        es: style.categoryId,
      },
      language,
    ),
    photo: (style.photos.find((photo) => photo.isPrimary) ?? style.photos[0])?.src ?? "",
    photoCount: style.photos.length,
    isPublished: style.isPublished,
    sizes: style.sizes.map((size) => ({
      sizeId: size.sizeId as "s" | "m" | "l",
      inStock: size.inStock,
    })),
    addedPhotos: overridesById.get(style.id)?.addedPhotos ?? [],
    coverSrc: overridesById.get(style.id)?.coverSrc,
  }));

  const composerCategories = categories.map((category) => ({
    id: category.id,
    label: translate(category.name, language),
  }));
  const composerFabrics = liveFabrics().map((fabric) => ({
    id: fabric.id,
    label: translate(fabric.name, language),
  }));
  const pricedPairs = Object.fromEntries(
    livePriceList().map((entry) => [entry.id, entry.fixedPrice]),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("collection")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("collectionLead")}
        </p>
      </div>
      <CollectionManager styles={managedStyles} locale={language} />

      <div className="flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex flex-col gap-2">
          <h3 className="text-[0.9375rem] font-medium">{t("styleAddTitle")}</h3>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("styleAddLead")}
          </p>
        </div>
        <StyleComposer
          categories={composerCategories}
          fabrics={composerFabrics}
          pricedPairs={pricedPairs}
          locale={language}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test and type check**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS, 7 tests; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/office/collection/page.tsx" src/components/office/tabs.test.ts
git commit -m "Give the rack its own tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Gallery tab

**Files:**
- Create: `src/app/[locale]/office/gallery/page.tsx`
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `officeViewer`; `translate` from `@/content`; `GALLERY_ORDER`, `manageableGallery` from `@/lib/live-gallery`; `GalleryManager`, `ManagedWork` from `@/components/gallery-manager`.

- [ ] **Step 1: Add the failing test**

```ts
describe("the gallery tab", () => {
  it("is guarded", () => {
    expectGuarded("gallery/page.tsx");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, ENOENT for `gallery/page.tsx`.

- [ ] **Step 3: Create the page**

Data from old lines 51 and 99-108; JSX from old lines 245-253:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { translate } from "@/content";
import { GALLERY_ORDER, manageableGallery } from "@/lib/live-gallery";
import { GalleryManager, type ManagedWork } from "@/components/gallery-manager";
import { officeViewer } from "../_lib/viewer";

/** Gallery: the portfolio photographs, and a place to add one. */
export default async function OfficeGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");
  const tg = await getTranslations("gallery");

  const galleryWorksManaged: ManagedWork[] = manageableGallery().map((work) => ({
    id: work.id,
    src: work.src,
    width: work.width,
    height: work.height,
    category: work.category,
    caption: translate(work.caption, language),
    hidden: work.hidden,
  }));
  const galleryCategories = GALLERY_ORDER.map((id) => ({ id, label: tg(`category.${id}`) }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("galleryTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("galleryLead")}
        </p>
      </div>
      <GalleryManager works={galleryWorksManaged} categories={galleryCategories} />
    </section>
  );
}
```

- [ ] **Step 4: Run the test and type check**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS, 8 tests; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/office/gallery/page.tsx" src/components/office/tabs.test.ts
git commit -m "Give the gallery its own tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Fabrics tab

**Files:**
- Create: `src/app/[locale]/office/fabrics/page.tsx`
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `officeViewer`; `categories`, `translate` from `@/content`; `customFabrics`, `liveFabrics` from `@/lib/live-pricing`; `FabricManager` from `@/components/fabric-manager`.

- [ ] **Step 1: Add the failing test**

```ts
describe("the fabrics tab", () => {
  it("is guarded", () => {
    expectGuarded("fabrics/page.tsx");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, ENOENT for `fabrics/page.tsx`.

- [ ] **Step 3: Create the page**

Data from old lines 158-171; JSX from old lines 255-263:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import { customFabrics, liveFabrics } from "@/lib/live-pricing";
import { FabricManager } from "@/components/fabric-manager";
import { officeViewer } from "../_lib/viewer";

/** Fabrics: the wall, and a place to hang a new roll. */
export default async function OfficeFabricsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const customIds = new Set(customFabrics().map((fabric) => fabric.id));
  const fabricWall = liveFabrics().map((fabric) => ({
    id: fabric.id,
    name: translate(fabric.name, language),
    swatchImage: fabric.swatchImage,
    custom: customIds.has(fabric.id),
  }));
  const fabricCategories = (["dresses", "pants", "shirts", "heritage"] as const).map((id) => ({
    id,
    label: translate(
      categories.find((category) => category.id === id)?.name ?? { en: id, es: id },
      language,
    ),
  }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("fabricsTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("fabricsLead")}
        </p>
      </div>
      <FabricManager fabrics={fabricWall} categories={fabricCategories} />
    </section>
  );
}
```

- [ ] **Step 4: Run the test and type check**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS, 9 tests; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/office/fabrics/page.tsx" src/components/office/tabs.test.ts
git commit -m "Give the fabric wall its own tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Prices tab

**Files:**
- Create: `src/app/[locale]/office/prices/page.tsx`
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `officeViewer`; `categories`, `translate` from `@/content`; `liveAlterations`, `liveAppointmentTypes`, `liveFabrics`, `livePriceList` from `@/lib/live-pricing`; `PriceManager` from `@/components/price-manager`.

- [ ] **Step 1: Add the failing test**

```ts
describe("the prices tab", () => {
  it("is guarded", () => {
    expectGuarded("prices/page.tsx");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, ENOENT for `prices/page.tsx`.

- [ ] **Step 3: Create the page**

Data from old lines 127-156; JSX from old lines 265-277:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, translate } from "@/content";
import {
  liveAlterations,
  liveAppointmentTypes,
  liveFabrics,
  livePriceList,
} from "@/lib/live-pricing";
import { PriceManager } from "@/components/price-manager";
import { officeViewer } from "../_lib/viewer";

/** Prices: garments, alterations and sessions, each a number she can change. */
export default async function OfficePricesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const language = locale as Locale;
  await officeViewer(locale);

  const t = await getTranslations("office");

  const priceEntries = livePriceList().map((entry) => ({
    id: entry.id,
    garment: translate(
      categories.find((category) => category.id === entry.categoryId)?.name ?? {
        en: entry.categoryId,
        es: entry.categoryId,
      },
      language,
    ),
    fabric: translate(
      liveFabrics().find((fabric) => fabric.id === entry.fabricId)?.name ?? {
        en: entry.fabricId,
        es: entry.fabricId,
      },
      language,
    ),
    fixedPrice: entry.fixedPrice,
    customizationExtra: entry.customizationExtra,
  }));
  const priceAlterations = liveAlterations().map((alteration) => ({
    id: alteration.id,
    name: translate(alteration.name, language),
    fixedPrice: alteration.fixedPrice,
    rushSurcharge: alteration.rushSurcharge,
  }));
  const priceAppointments = liveAppointmentTypes().map((type) => ({
    id: type.id,
    name: translate(type.name, language),
    fee: type.fee,
  }));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("pricesTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("pricesLead")}
        </p>
      </div>
      <PriceManager
        entries={priceEntries}
        alterations={priceAlterations}
        appointments={priceAppointments}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run the test and type check**

Run: `npx vitest run src/components/office/tabs.test.ts && npm run typecheck`
Expected: PASS, 10 tests; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/office/prices/page.tsx" src/components/office/tabs.test.ts
git commit -m "Give the price list its own tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Shopfront and Books tabs

**Files:**
- Create: `src/app/[locale]/office/shopfront/page.tsx`
- Create: `src/app/[locale]/office/books/page.tsx`
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `officeViewer`; `storedNotice` from `@/lib/live-catalog`; `NoticeEditor` from `@/components/notice-editor`; `SiteQrCode` from `@/components/site-qr-code`; `loadLedger` from `@/lib/earnings`; `exportSummary` from `@/lib/books`; `formatMoney` from `@/lib/money`; `BooksExport` from `@/components/books-export`.

- [ ] **Step 1: Add the failing tests, including the one that closes the set**

```ts
describe("the shopfront tab", () => {
  it("is guarded", () => {
    expectGuarded("shopfront/page.tsx");
  });
});

describe("the books tab", () => {
  it("is guarded", () => {
    expectGuarded("books/page.tsx");
  });
});

describe("every tab in the list", () => {
  it("has a page, and the page is guarded", () => {
    for (const tab of OFFICE_TABS) {
      const relative = tab.href === "/office" ? "page.tsx" : `${tab.href.slice("/office/".length)}/page.tsx`;
      expectGuarded(relative);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, ENOENT for `shopfront/page.tsx` and `books/page.tsx`.

- [ ] **Step 3: Create the Shopfront page**

Data from old line 85; JSX from old lines 302-326:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { storedNotice } from "@/lib/live-catalog";
import { NoticeEditor } from "@/components/notice-editor";
import { SiteQrCode } from "@/components/site-qr-code";
import { officeViewer } from "../_lib/viewer";

/**
 * Shopfront: what the shop says about itself. Today that is the notice at
 * the top of every page and the QR that hangs in the workroom; hours,
 * holidays and the season come here later.
 */
export default async function OfficeShopfrontPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await officeViewer(locale);

  const t = await getTranslations("office");
  const notice = storedNotice();

  return (
    <>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("noticeTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("noticeLead")}
          </p>
        </div>
        <NoticeEditor
          initialMessage={notice?.message ?? ""}
          initialVisible={notice?.visible ?? false}
        />
      </section>

      {/* The workroom QR, moved off the public contact page: it is Daysi's
          to print and hang, not a visitor's. It draws as a real SVG, so it
          prints sharp at any size straight from this page. */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-heading">{t("qrTitle")}</h2>
          <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
            {t("qrLead")}
          </p>
        </div>
        <SiteQrCode size={192} />
      </section>
    </>
  );
}
```

- [ ] **Step 4: Create the Books page**

Data from old lines 53 and 110-125; JSX from old lines 279-300:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { loadLedger } from "@/lib/earnings";
import { exportSummary } from "@/lib/books";
import { formatMoney } from "@/lib/money";
import { BooksExport } from "@/components/books-export";
import { officeViewer } from "../_lib/viewer";

/** Books: the year at a glance, and the file her accountant asks for. */
export default async function OfficeBooksPage({
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

  // Ranges an accountant actually asks for, built from today rather than hard
  // coded, so this still offers the right years in 2027.
  const today = new Date();
  const year = today.getFullYear();
  const quarter = Math.floor(today.getMonth() / 3);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const bookPresets = [
    { label: t("booksThisYear"), from: `${year}-01-01`, to: `${year}-12-31` },
    { label: t("booksLastYear"), from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    {
      label: t("booksThisQuarter"),
      from: iso(new Date(year, quarter * 3, 1)),
      to: iso(new Date(year, quarter * 3 + 3, 0)),
    },
  ];
  const booksSummary = exportSummary(ledger, `${year}-01-01`, `${year}-12-31`);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading">{t("booksTitle")}</h2>
        <p className="max-w-xl text-[0.875rem] leading-relaxed text-ink-faint">
          {t("booksLead")}
        </p>
      </div>
      <p className="text-[0.875rem] text-ink-soft">
        {t("booksSummary", {
          year: String(year),
          invoices: booksSummary.invoices,
          received: formatMoney(booksSummary.received, language),
          outstanding: formatMoney(booksSummary.outstanding, language),
          tax: formatMoney(booksSummary.salesTax, language),
        })}
      </p>
      <BooksExport
        presets={bookPresets}
        initialFrom={`${year}-01-01`}
        initialTo={`${year}-12-31`}
      />
    </section>
  );
}
```

- [ ] **Step 5: Run the whole suite and the type check**

Run: `npm run typecheck && npm test`
Expected: tsc exits 0; all files pass, `tabs.test.ts` now 13 tests.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/office/shopfront/page.tsx" "src/app/[locale]/office/books/page.tsx" src/components/office/tabs.test.ts
git commit -m "Give the shopfront and the books their tabs, and check the set is complete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Smoke coverage, the manual, and a full look

**Files:**
- Modify: `scripts/smoke.mjs:38`
- Modify: `docs/manual-del-taller.html` (lines 360-363, 386, 420-423, 466, 495, 521, 545, the `#pedidos` section, 598)
- Modify: `src/components/office/tabs.test.ts`

**Interfaces:**
- Consumes: `OFFICE_TABS`.

- [ ] **Step 1: Add the failing test**

```ts
describe("the smoke script", () => {
  it("checks that every tab is private", () => {
    const smoke = fs.readFileSync(path.join(process.cwd(), "scripts/smoke.mjs"), "utf8");
    for (const tab of OFFICE_TABS) {
      expect(smoke, `${tab.href} in PRIVATE`).toContain(`"${tab.href}"`);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: FAIL, `/office/work` not found in the script.

- [ ] **Step 3: Extend the smoke script**

Replace line 38 of `scripts/smoke.mjs`:

```js
const PRIVATE = [
  "/account",
  "/account/orders",
  "/office",
  "/office/work",
  "/office/collection",
  "/office/gallery",
  "/office/fabrics",
  "/office/prices",
  "/office/shopfront",
  "/office/books",
];
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/office/tabs.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Repoint the manual at the tabs**

In `docs/manual-del-taller.html`:

Lines 360-363 (`#entrar`, fourth step), replace the `<li>` with:

```html
      <li>
        Ya adentro, su oficina está en <span class="label">La oficina</span>,
        o directo en <span class="path">/es/office</span>. Arriba verá una
        fila de pestañas: Hoy, Trabajo, Colección, Galería, Telas, Precios,
        Vitrina y Libros. En el teléfono la fila se desliza de lado.
      </li>
```

Line 386 (`#precios`), replace with:

```html
      <li>En la oficina, toque la pestaña <span class="label">Precios</span> (o vaya directo a <span class="path">/es/office/prices</span>).</li>
```

Lines 420-423 (`#prenda`), replace with:

```html
      <li>
        En la oficina, toque la pestaña <span class="label">Colección</span>
        (<span class="path">/es/office/collection</span>) y busque
        <span class="label">Agregar una prenda a la colección</span>.
      </li>
```

Line 466 (`#perchero`), replace with:

```html
      <li>En la oficina, toque la pestaña <span class="label">Colección</span> (<span class="path">/es/office/collection</span>).</li>
```

Line 495 (`#telas`), replace with:

```html
      <li>En la oficina, toque la pestaña <span class="label">Telas</span> (<span class="path">/es/office/fabrics</span>).</li>
```

Line 521 (`#trabajo`), replace with:

```html
      <li>En la oficina, toque la pestaña <span class="label">Galería</span> (<span class="path">/es/office/gallery</span>).</li>
```

Line 545 (`#aviso`), replace with:

```html
      <li>En la oficina, toque la pestaña <span class="label">Vitrina</span> (<span class="path">/es/office/shopfront</span>).</li>
```

In `#pedidos` (section starting line 561), immediately before the list whose first item begins `<li><span class="label">Recibido</span>`, insert:

```html
    <p>
      Todo esto vive en la pestaña <span class="label">Trabajo</span>
      (<span class="path">/es/office/work</span>): los pedidos y arreglos,
      las citas, los mensajes y la lista de estreno.
    </p>
```

Line 598 (`#libros`), replace with:

```html
      <li>En la oficina, toque la pestaña <span class="label">Libros</span> (<span class="path">/es/office/books</span>).</li>
```

Then confirm nothing still tells her to scroll: `grep -n "baje hasta" docs/manual-del-taller.html` prints nothing, and `grep -c "toque la pestaña" docs/manual-del-taller.html` prints 7.

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: all exit 0; the build lists `/[locale]/office/work` and the other six new routes (Next 15.5 marks them `●` because the locale layout has `generateStaticParams`; `force-dynamic` still renders them per request, and `.next/prerender-manifest.json` contains no office route).

Start the dev server through the preview pane and run the smoke against it (the user runs `npm run smoke`; the agent replicates its checks with `curl` against `http://localhost:3000` if the script is blocked). Expected: the ten PRIVATE checks all 307 to `/es/sign-in`; every existing check still passes.

In the browser, signed in as an owner:
- `/es/office` shows the header, the strip with Hoy underlined, four figures and the bars, nothing else.
- Each tab shows exactly its old section: Trabajo has the four lists, Colección the rack and the add form, Galería the grid, Telas the wall, Precios the three tables, Vitrina the notice and the QR, Libros the summary and the export.
- Clicking a tab moves the underline and swaps the content without a full page load (the network panel shows an RSC fetch, not a document).
- At a 375px viewport the strip scrolls sideways and no label wraps.
- `/en/office/prices` renders English labels and tabs.
- Change one price on Precios and save: still works, still shows "Guardado" (no behaviour change).
- Signed out, `/es/office/books` redirects to `/es/sign-in`. Signed in as a client address, `/es/office/books` is a 404.

- [ ] **Step 7: Commit, push, open the PR**

```bash
git add scripts/smoke.mjs docs/manual-del-taller.html src/components/office/tabs.test.ts
git commit -m "Teach the smoke test and the manual where the tabs are

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin office-hub
gh pr create --base main --head office-hub --title "Office: eight tabs behind one door" --body "$(cat <<'EOF'
Step 1 of the office rebuild (spec: docs/superpowers/specs/2026-09-02-office-hub-design.md).

The one-page office becomes eight routes under one layout guard: Today, Work, Collection, Gallery, Fabrics, Prices, Shopfront, Books. Every panel moved verbatim; no editor or lib reader changed. A structural test keeps the tab list, the pages, the guard, the smoke script and both message bundles in step. The Spanish manual now names the tab for each task.

Verification: typecheck, 14 new tests, build, smoke (ten private routes), and the browser checks in docs/superpowers/plans/2026-09-02-office-hub-step-1-tabs.md Task 9.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After CI is green and the PR is merged, the user runs `npm run deploy` and `SMOKE_URL=https://daysiscollectioninc.com npm run smoke`.

---

## Deferred on purpose

- The Today tab's "needs you" list (new orders, tomorrow's sessions, unanswered messages) is new behaviour and waits for step 2, when the Work tab's data shape settles.
- No `loading.tsx` per tab: every read is a synchronous local file read; add one only if a tab measurably lags.
- No change to the `account-menu.tsx` link: `/office` is still the entry, now Today.
