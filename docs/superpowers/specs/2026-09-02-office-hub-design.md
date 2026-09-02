# Office hub rebuild, steps 1 to 3

## Context

Daysi's office is one 401-line server page ([office/page.tsx](src/app/[locale]/office/page.tsx)) rendering twelve panels at once. Every visit reads ten data sources, every one of seven editors ends in `router.refresh()` that re-renders all twelve panels, three editors bypass the shared client and hand-roll their own states, and nothing she creates can be deleted, renamed or retired: there is no delete anywhere under `/api/office`, and a custom fabric added by mistake is on the site forever. The 2026-09-01 plan (artifact "Rebuilding the Office") agreed a six-step rebuild; this plan is its first three steps, chosen by the user on 2026-09-02, each shippable alone:

1. Tabbed routes behind one layout guard, no behaviour change.
2. One save language: server actions with optimistic rows, scoped revalidation, one status component.
3. Tombstone delete and one-step undo for everything the office manages.

Approach chosen by the user: **C**, server actions for every mutation, with the two non-mutations (multipart photo upload, CSV download) staying as route handlers. All four design sections below were approved in chat.

One correction to the original plan's reasoning: [layout.tsx:37](src/app/[locale]/layout.tsx:37) forces dynamic rendering for the whole locale tree, so the "whole-site cache dumped per save" cost is notional. The real cost is the twelve-panel re-render, which the tab split removes. Actions therefore revalidate only their own tab path, for the owner's router cache, not for visitors.

## Design (approved)

### 1. Routes and guard

- New `src/app/[locale]/office/layout.tsx`: `currentViewer()`, redirect to `/${locale}/sign-in` when signed out, `notFound()` when not owner (the exact check now at page.tsx:46-48), then heading plus `<OfficeTabs/>` and `{children}`.
- `src/components/office/office-tabs.tsx` (client): next-intl `Link` per tab, active by `usePathname()`, `overflow-x-auto` strip with `whitespace-nowrap` so it scrolls sideways on a phone.
- Segments, in tab order: `page.tsx` Today (figures, six-month bars, a "needs you" list of new orders, tomorrow's sessions, unanswered messages), `work/`, `collection/`, `gallery/`, `fabrics/`, `prices/`, `shopfront/` (notice and QR for now), `books/`. Each page reads only its own sources. Step 1 moves the existing panel JSX and editor components verbatim.
- `src/messages/{es,en}.json` `office` namespace gains eight tab labels; the Spanish manual's anchors and the sentences that say "scroll down to" are repointed at the tabs.
- `scripts/smoke.mjs` `PRIVATE` gains the seven sub-routes.

### 2. Saves

- New `src/lib/action-guard.ts`: `ownerAction(schema, handler)` reusing `officeDenial` from [api-guard.ts:44](src/lib/api-guard.ts:44). Origin comes from `headers()` through the same `isSameOrigin` logic, role from `currentViewer()`, body through zod. Returns `{ ok: true, ...data } | { ok: false, error: "bad-origin" | "not-found" | "invalid" | "failed" }` and never throws for an expected denial. On success it calls `revalidatePath` for the tab that owns the action, nothing wider.
- Per-tab `actions.ts` files with `"use server"`: `collection/actions.ts` (setStyleOverride, createStyle), `gallery/actions.ts` (addWork, setWorkHidden), `fabrics/actions.ts` (addFabric), `prices/actions.ts` (setPrice, setAlterationPrice, setAppointmentFee), `shopfront/actions.ts` (setNotice), `work/actions.ts` (setRequestStatus). Zod schemas stay in `src/lib/office-validation.ts`.
- Client: `src/components/office/save-status.tsx` (one component, one vocabulary: saving, saved, didn't save, try again) and `useSave()` hook wrapping `useTransition`. Row toggles use `useOptimistic` and roll back only their own row when the action returns `ok: false`. Forms use `useActionState`. The hand-rolled optimism in `collection-manager.tsx` and `gallery-manager.tsx`, and the raw `fetch` in `office-request-list.tsx`, are removed.
- `office-client.ts` shrinks to `uploadPhoto` only; `postOffice` goes when its last caller does.
- Routes deleted once their editors move: `api/office/{styles,gallery,fabrics,prices,notice,requests}`. `api/office/uploads` and `api/office/books` stay on `ownerRequest`.
- [api-guard.test.ts:87-120](src/lib/api-guard.test.ts:87) gains a sibling scan: every exported function in `src/app/[locale]/office/**/actions.ts` must be produced by `ownerAction`, and no action file may import `isSameOrigin` or compare roles itself.

### 3. Delete and undo

- One collection `retired.jsonl`, lines `{ kind, id, retired: boolean, at }`, `kind` in `style | fabric | gallery | price-entry | request`, read with `latestBy` keyed `${kind}:${id}`. New `src/lib/retired.ts`: `retiredIds(kind): Set<string>`, `setRetired(kind, id, retired)`.
- Every assemble and list function skips retired ids: `assembleStyles`, `assembleGallery`, `assemblePriceList`, `liveFabrics`, and `currentRecords` in `request-store.ts` (so a retired appointment frees its slot in `availability.ts` and a retired test order leaves the ledger and the books). Seeded items can be retired; the merge simply drops them.
- `manageable*` variants return retired items flagged `retired: true` so each tab shows a collapsed "Retired" group with Restore.
- History in `records.ts`: `versionsOf<T>(collection, key)` and `previousVersion<T>(collection, key)` over the append-only file. `undoLast(kind, id)` action appends the previous version again with a fresh `updatedAt`, or flips `retired`. After any successful save the row shows "Saved · Undo" for the rest of the session.
- Nothing is physically deleted, ever. No data migration: existing files are read unchanged.

### 4. Testing and rollout

- Unit: assemble functions with a retired set; `versionsOf`/`previousVersion`; `ownerAction` denial order (same three cases as `officeDenial`); the actions scan; `currentRecords` skipping retired references and `availability` freeing the slot.
- Smoke: office sub-routes private; existing 51 checks unchanged.
- Each step is its own PR to `main`, deployed with `npm run deploy` by the user (the deploy command is blocked for the agent). The Spanish manual ships with step 1.

## Snags in the current code, and the smallest fix for each

| Snag | Fix |
|---|---|
| A layout guard does not re-run on soft navigation between sibling tabs | `officeViewer(locale)` helper in `office/_lib/viewer.ts` (redirect / notFound inside); the layout and every tab page call it first |
| `api-guard.test.ts:98` asserts more than four office routes; after step 2 only two remain | Assert the route set equals exactly `["books", "uploads"]` |
| `isSameOrigin(request)` needs a Request; actions only have `headers()` | Add `isSameOriginHeaders(headers)` in `security.ts`; `isSameOrigin` delegates to it |
| Actions cannot carry a `File` | Editors call `uploadPhoto()` first, then the action with the `/uploads/...` path the schemas already validate |
| Dropping `router.refresh()` only works if the action revalidates the tab it ran from | `ownerAction` takes `revalidate: readonly string[]` route patterns, always including the tab, plus public paths that show the data |
| Request readers are scattered (`earnings.loadLedger`, `availability.ts:98-105` with its own `latestPerReference`, `requestsForAccount`, the Work tab) | One `activeRequests(kind)` in `request-store.ts`; all four read through it |
| Retiring a fabric or price entry a live style points at breaks its estimate | `retireAction` refuses with `in-use` and a count |
| Gallery already has hide; retire is a different idea | Keep both: Hide stays a toggle on the card, Retire moves it to the Retired group |
| Half the zod schemas live inside route files | Step 2 moves them all into `office-validation.ts` |
| Seeded fabrics are referenced by seeded styles | Retire control offered on custom fabrics only; seeded styles, gallery works and price entries can be retired |

## Step 1: tabbed routes (no behaviour change)

Create `office/_lib/viewer.ts`, `office/layout.tsx` (PageHeader + `<OfficeTabs/>` + the `shell` wrapper from page.tsx:180), `src/components/office/tabs.ts` (`OFFICE_TABS` const, plain TS so tests can import it), `src/components/office/office-tabs.tsx` (client; next-intl `Link` + `usePathname`, exact-match active because `/office` prefixes every tab, `overflow-x-auto` strip, `aria-current`), `src/components/office/figure.tsx` (moved from page.tsx:379-400). Seven new `page.tsx` files plus Today rewritten in place, each starting with `await officeViewer(locale)` and holding the data lines and JSX moved verbatim: Today 53-61 + 181-218; Work 58-62 + 328-373; Collection 64-97 + 220-243; Gallery 99-108 + 245-253; Fabrics 158-171 + 255-263; Prices 127-156 + 265-277; Shopfront 85 + 302-326; Books 110-125 + 279-300.

Modify: `src/messages/{es,en}.json` (`tabToday` … `tabBooks`, `tabsLabel`); `scripts/smoke.mjs:38` PRIVATE gains the seven tab paths; `docs/manual-del-taller.html` first step of each task names the tab and path, `#entrar` mentions the strip.

Tests, `src/components/office/tabs.test.ts`: every tab has a page file; every tab page and the layout contain `officeViewer(` and never `currentViewer(` or a role comparison; the smoke script lists every tab; both message files name every tab.

Verify: typecheck, tests, smoke (ten private checks). Browser as owner: each tab shows only its old section, active underline moves without a full reload, strip scrolls at 375px; signed out, a tab redirects to sign-in; as a client, 404.

## Step 2: one save language

Create `src/lib/action-guard.ts`: `ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }`; `ownerAction(schema, handle, { revalidate })` does headers → `isSameOriginHeaders`, `currentViewer()` only when same-origin, `schema.safeParse(input)`, `officeDenial(...)` → `{ ok: false, error }` (never throws for a denial); on success `revalidatePath(pattern, "page")` per pattern (allow `[pattern, "layout"]` for the notice, which the site layout renders). `src/components/office/use-save.ts`: `useSave()` over `useTransition`, per-key `{ status, error, undo }`, "saved" clears after 2 s as `collection-manager.tsx:67` does now. `src/components/office/save-status.tsx`: one component for saving / saved / didn't save, with `office.error.<code>` text when a key exists.

Per-tab `actions.ts` (`"use server"`, every export is an `ownerAction`): collection (`saveStyleOverrideAction`, `createStyleAction` returning `{ slug }`), gallery (`addGalleryWorkAction`, `setGalleryVisibilityAction`), fabrics (`addFabricAction` returning `{ id }`), prices (`savePriceAction`, discriminated union), shopfront (`saveNoticeAction`), work (`setRequestStatusAction`). Bodies move verbatim from the routes; `slugify` moves next to its writers; `CUSTOMIZATION_EXTRA` is exported from `live-pricing.ts` instead of duplicated. Revalidate lists per action: the tab plus the public pages that show the data (collection pages, prices, alterations, appointments, design-studio, request, home, gallery, account pages).

Modify editors in place, each losing `useRouter`, its own state words and hand-rolled rollback: `collection-manager.tsx` (reference conversion: `useOptimistic` row + `useSave` + `SaveStatus`), `gallery-manager.tsx` (optimistic hide, `useActionState` add form), `fabric-manager.tsx`, `style-composer.tsx`, `notice-editor.tsx` (`useActionState`), `price-manager.tsx` (drafts stay, per-row `useSave`), `office-request-list.tsx` (optimistic status). `office-client.ts` keeps only `uploadPhoto`. `office-validation.ts` gains the six moved schemas. `security.ts` gains `isSameOriginHeaders`. `api-guard.test.ts:97-99` asserts exactly `books` and `uploads`.

Delete: `api/office/{styles,gallery,fabrics,prices,notice,requests}/route.ts`, each in the same commit as its editor's conversion so both scans stay green.

Tests: `action-guard.test.ts` (denial order with mocked `next/headers`, session and `next/cache`; handler never runs on denial; revalidate called per pattern on success and not on handler failure; structural scan of `office/**/actions.ts`: `"use server"` first, imports the guard, every `export const` is `ownerAction(`, no origin or role logic inline; at least six files); `office-validation.test.ts` one accept and one refuse per moved schema; `security.test.ts` two cases for `isSameOriginHeaders`.

Verify: typecheck, tests, `grep -rn "router.refresh\|postOffice\|/api/office/" src` shows only `uploadPhoto` and the CSV fetch, smoke. Browser: a size checkbox flips instantly and persists; with `DATA_DIR` pointed at a read-only path the same toggle snaps back with the inline message on that row only; signed out in another tab, a toggle snaps back with not-found; network shows no calls to the deleted routes.

## Step 3: tombstone delete and undo

Create `src/lib/retired.ts` (`RetiredKind`, `retiredKey`, `retiredSet()`, `isRetired`, `setRetired`, on `records.ts` so `store-paths.test.ts` needs nothing); `versionsOf` and `previousVersion` in `records.ts`; `src/lib/office-history.ts` (registry of undoable kinds → collection, key, baseline, writer; `undoLast(handle)`; undo of a retire flips it, undo of an undo is a redo; requests via `previousRequestVersion(reference)`); shared `office/actions.ts` with `retireAction` (in-use refusal) and `undoLastAction`; `src/components/office/retired-group.tsx` (collapsed `<details>`, Restore per row).

Modify: `assembleStyles`, `assembleGallery`, `assemblePriceList` gain a `retired` set parameter defaulting to empty (behaviour unchanged until wired); `allLiveStyles`, `liveGallery`, `livePriceList`, `customFabrics` pass `retiredSet()`; new `manageableStyles`, `manageableCustomFabrics`, `manageablePriceList`, `manageableRequests` return items flagged `retired`; `request-store.ts` gains `activeRequests`; `earnings.loadLedger`, `availability.bookedSlots` (drop `latestPerReference`), `requestsForAccount` read through it; the Stripe webhook keeps raw `listRequests`. `ActionResult` gains `undo?: UndoHandle`; every step 2 action returns its handle (creation's undo is retire). `SaveStatus` renders "Saved · Undo" from the handle and swaps it on success. Each tab passes active and retired lists and renders `<RetiredGroup>`; per-row Retire on collection rows, gallery cards, custom fabrics, price entries and work rows. Messages: `undo`, `redo`, `retire`, `restore`, `retiredGroup`, `retiredEmpty`, `retireConfirm`, `error.inUse`, `error.nothingToUndo`. Manual gains `#deshacer`.

Tests: `retired.test.ts`; `records.test.ts` versions and previous; `assemble-styles`, `live-gallery`, `assemble-prices` each with a retired case; `office-history.test.ts` (re-append previous override, seed baseline when none, flip a retire, request status, nothing-to-undo); new `availability.test.ts` (retired appointment frees its slot); ledger excludes a retired reference; the shared actions file is in the scan.

Verify: typecheck, tests, smoke. Browser: retire a seeded style, it leaves the list instantly, its public page is 404, Restore brings both back; untick a size then Undo then Undo again (redo); retiring an in-use fabric shows the count and changes nothing; retiring an appointment frees the slot on `/appointments`, drops it from Books and from the client's orders, and Restore reverses all three.

## Sequencing and rollout

- Step 1 touches no lib code and ships first. Step 2 lands the guard, its test and the schema moves before converting editors one tab at a time. Step 3 lands `retired.ts`, the `assemble*` parameters and `activeRequests` (all defaulting to "nothing retired") before any UI.
- Each step: its own branch off `main`, PR, CI green, merge, then the user runs `npm run deploy` and the smoke against production.
- After plan approval: commit this design as `docs/superpowers/specs/2026-09-02-office-hub-design.md`, then use the writing-plans skill to turn it into the executable task list, then build with TDD.

## Amendment, 2026-09-02 evening (decided with the user before step 2)

Step 1 is on `main` and deployed (PRs #17 and #18: tabs, and the office tabs in the header bar). Two decisions change the shape of step 2:

**1. Nothing saves until Daysi confirms.** The instant-flip model in section 2 is replaced by a draft. On each tab, edits (a size ticked off, a price typed, a status changed, a garment or photo added, an item retired or restored) collect in a client-side draft; the row shows the pending value with a small "pendiente" mark. A bar pinned to the bottom of the tab reads "N cambios sin confirmar" with two buttons, "Confirmar cambios" and "Descartar". Confirming sends the whole draft to ONE server action for that tab (a zod discriminated union of change records), inside a transition; `useOptimistic` shows the confirmed state at once and rolls back only the changes the action reports as failed, with the reason on the row. Leaving the tab with a non-empty draft asks once ("Tiene cambios sin confirmar"). Retiring an item asks once more inline before it enters the draft. Uploads (garment photos, gallery photos, fabric swatches) run at confirm time, before the action, so a cancelled draft uploads nothing. Undo (step 3) stays as designed; the confirmation is the review step, undo is the regret step.

**2. Add and remove listings for the collection and the gallery come into step 2.** Each of those two tabs shows the full listing with add, edit and "Retirar", and a collapsed "Retirados" group with "Restaurar". This brings forward from step 3, for kinds `style` and `gallery` only: `src/lib/retired.ts` (`retiredSet`, `setRetired`), the `retired` parameter on `assembleStyles` and `assembleGallery`, and `manageableStyles` / the `retired` flag on `manageableGallery`. Fabrics, price entries and requests keep their remove for step 3, together with undo and the in-use check.

Everything else in section 2 holds: `ownerAction` over `officeDenial`, per-tab `actions.ts`, the six JSON routes deleted, uploads and the CSV kept as routes, one `SaveStatus` vocabulary, the actions scan in the guard test.

## Amendment 2, 2026-09-03 (decided with the user before step 3)

Step 2 is on `main` and deployed (PR #20). Step 3 keeps Design section 3 with these adjustments:

**1. Undo stages a reversal; it never writes on its own.** After a confirmed change, the row keeps a small "Deshacer" link. Pressing it reads the previous version of that record off the append-only store (`versionsOf` / `previousVersion` in `records.ts`, with a per-kind baseline when no earlier line exists) and stages it as an ordinary pending change of the same kind; Daysi still presses "Confirmar cambios". Undo of an undo is therefore just another staged reversal. The link is offered for the rest of the session on rows the office itself changed, and for any row whose store history holds more than one version.

**2. Retire and restore reach fabrics, price entries, and everything in Trabajo.** Kinds become `style | gallery | fabric | price-entry | request`; requests are keyed by reference and cover orders, alteration requests, commissions, appointments, contact messages and premiere sign-ups. One `activeRequests(kind)` in `request-store.ts` is the single seam: the ledger, the books, `availability` (a retired appointment frees its slot), the client's account pages and the Work tab all read through it; the Stripe webhook keeps reading raw records. Custom fabrics only (seeded fabrics are referenced by seeded styles); a price entry or fabric that a live garment points at is refused with `in-use` and a count. Restore is always available from the tab's "Retirados" group.

**3. Everything goes through the confirm bar**, including retire, restore and undo, exactly as in step 2.
