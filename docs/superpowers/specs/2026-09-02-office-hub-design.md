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

## Amendment 3, 2026-09-03 (decided with the user before step 4)

Steps 1 to 3 are on `main` and deployed (PRs #17, #18, #20, #21, plus the polish PR #27). Step 4 adds the one layer the original design named but never built: words. Today the live layers override state (published, stock, price, hidden, retired) and never text, so fixing a typo in a garment description is a deploy. Two decisions bound the step.

**1. Scope is garments and gallery photos only.** Four fields on a garment (name, colour, description, detail) and one on a gallery photo (caption), for seeded and office-added items alike. Fabrics, alterations, appointment types, premieres and the site notice keep today's behaviour; they belong to the tabs that steps 5 and 6 rebuild, and pulling them forward would mean building those editors first.

**2. An override speaks about one field in one language.** A record names the subject, the id, the field and the locale. Spanish and English of the same field are independent, so correcting a Spanish typo on a seeded garment leaves its English translation untouched. A blank value is not a blank page: it clears that one override and returns the field to the coded words, which for an added garment are the words Daysi typed when she created it.

### Record and merge

New append-only collection `text-overrides`, one record per box confirmed:

```ts
type TextOverride = {
  subject: "style" | "gallery";
  id: string;
  field: "name" | "color" | "description" | "detail" | "caption";
  locale: "es" | "en";
  value: string;      // "" clears the override
  updatedAt: string;
};
```

`latestBy` keys on subject, id, field and locale together. A new pure module `src/lib/live-text.ts` merges them, and is called inside `assembleStyles` **before** `applyOverrides`, and inside `assembleGallery`. The order is not arbitrary: `applyOverrides` builds alt text for office-added photos out of the garment's name, so the text layer runs first and the corrected name reaches those photos. No page changes: every public and office read already goes through those two assemblers.

Validation mirrors `styleCreateSchema` (name 60, colour 80, description 400, detail 400, caption 200), trimmed, with the empty string allowed as the clear.

### Editing surface

Each row in Collection and each photo in Gallery gains an "Editar textos" disclosure holding two columns, Español and English, each box pre-filled with what the site shows now. Editing stages an ordinary pending change into the tab's draft, with the same pending mark, the same confirm bar, the same discard prompt. No new routes and no new server actions: two change types, `style-text` and `work-text`, join `collectionChangeSchema` and `galleryChangeSchema`, keyed `text:<subject>:<id>:<field>:<locale>` so the draft dedupes per box.

### Undo

Two streams join the registry in `office-history.ts`, keyed by id, field and locale, reading `versionsOf("text-overrides", ...)`. The baseline for a field never overridden is the empty value, so Deshacer on a first edit stages a return to the coded words, and undo of an undo is another staged reversal. `UNDO_KINDS` grows by `style-text` and `work-text`.

### The monolingual creation fix

The layer above lets Daysi correct words after the fact; this half stops them being born wrong. `collection/actions.ts` and `gallery/actions.ts` copy one typed string into both locale slots, so every garment and photo she adds reads as Spanish to an English visitor. Both create forms gain an English column beside the Spanish one, mirroring what she types until she edits the English box, and `styleCreateSchema` and `galleryWorkSchema` take pairs rather than single strings for name, colour, description, detail and caption. Roughly double the fields on those two forms, and the last place in the office where a language is invented.

### Testing

A pure merge test for field and locale precision and for blank clearing, over seeded and added items; schema tests for the two change types and the paired create schemas; history tests for the baseline and the previous version; and the existing structural scans, which stay green because no new `use server` file appears. Browser pass: correct a Spanish description on a seeded garment and confirm the English is unchanged on the English page, clear a box and see the coded words return, add a garment with both languages filled.

## Amendment 4, 2026-09-14: take two (decided with the user on 14 September)

Steps 1 to 4 are live. On 14 September Gamaliel walked every tab and judged the result a picture of what the office could be rather than something Daysi can run: too many boxes, two languages everywhere, photos she can add but not manage, a design studio she cannot touch. The walk-through was checked against the running code and written up with nine questions in `docs/superpowers/plans/2026-09-14-office-take-two-draft.md`. The answers, all given the same day, bound this amendment:

| Question | Answer |
| --- | --- |
| First tab's name | Hub, with the work under it (Hoy was the first answer; changed to Hub the same day) |
| Phone or computer | Phone |
| Where English comes from | Written automatically by a translation service |
| Photos | Add, remove, reorder, mark the cover; no cropping |
| Design studio | A set of shapes drawn once; Daysi turns them on and off and names them |
| Prices | Keep the list, fix phone typing |
| Confirm button | Always visible, greyed until there is something to confirm |
| A helper in the office | Not now |
| Fabric prices | Four, one per garment type |

One principle governs everything below: **the office is a phone app.** Lists show; a sheet edits; one thing per screen; Spanish is the only language typed; photos are large. The draft, the confirm bar, retire and restore, undo, the record format, the guard and the one-action-per-tab pattern all stay exactly as amendments 1 to 3 left them.

### 1. Hub: Hoy and Trabajo become one tab

`OFFICE_TABS` loses `work` and its first entry becomes `{ id: "hub", href: "/office", labelKey: "tabHub" }`, labelled **Hub** in both languages; the office is seven tabs. `office/page.tsx` renders, in this order: the four figures; orders and alterations; sessions; messages and the premiere list side by side; the six months of bars; the retired group. Money at a glance, then what needs her, then the months she reads when she has time. The page wraps its work sections in one `OfficeDraftProvider` over the work action, which moves out of `work/actions.ts` into `office/actions.ts` beside the undo reader already there; its revalidate list names `/[locale]/office` where it named `/[locale]/office/work`.

`office/work/page.tsx` stays as a permanent redirect to `/office`, so bookmarks and the manual's links keep working. The smoke script keeps `/office/work` and expects it to land on the office. `tabs.test.ts` asserts seven tabs and the redirect. Messages lose `tabWork` and `tabToday` and gain `tabHub`; the `work` heading key stays because the section does. The manual and `next-steps.md` say Hub wherever they said Hoy or Trabajo.

### 2. The sheet

One new client component, `src/components/office/sheet.tsx`: a `<dialog>` that fills the screen below 640 px and is a right-hand panel of 28 rem above. It is a place to edit, not a place that saves. Every control inside it stages change types the tab's action already accepts (`style-override`, `style-create`, `style-text`, `retire`, `restore`, `work-add`, `work-visibility`, `work-text`, `fabric-add`) plus the two this amendment adds (`translate`, `shape`), keyed as today, so the bar, the pending marks, discard and undo need no new code paths. **Listo** closes the sheet; so does Escape and the phone's back gesture. Nothing is lost on close because staged changes live in the tab's draft, not in the sheet.

The bar stays reachable inside a sheet: the sheet sits above the page content and below the bar in stacking order, and reserves the bar's height at its foot, so **Confirmar cambios** is visible and tappable whether a sheet is open or not.

### 3. Colección

The list becomes cards. Each card: the cover photo at 3:4, the name, category and price (looked up from the live price list through the garment's price entry), the photo count, the three size switches S M L, and an **Oculta** chip when the garment is not shown. Ticking a size stages a `style-override` straight from the card, because "S is out" is the daily action and should not need a sheet. A **+** card at the head of the list opens the create sheet. Retired garments sit under Retirados as today.

**The garment sheet.** Photos first: every photo of the garment in its current order, the cover marked **Portada**, each with a menu of **Portada** and **Quitar**, hold-to-move to reorder, and a **+ Agregar** tile that appends a file (previewed from an object URL until confirm, uploaded at confirm as today). Then the words in Spanish only: Nombre, Color, Qué es, Cómo está hecha; beneath them a **Ver inglés** disclosure that shows the English read-only, with **Corregir** turning each line into a box that stages a `style-text` for `en`. Then Tallas as switches, **Se muestra en el sitio** as a switch, **Retirar**, and Deshacer where the row is undoable. Listo.

**The create sheet** is the same layout, empty: photos (at least one), the words in Spanish, Prenda and Tela pickers, a price only when the pair has none on the price list, sizes. It stages one `style-create`.

**Record.** `StyleOverride` gains an optional field:

```ts
/** The complete list of photos to show, in order; the first is the cover.
 *  A coded photo left out is hidden, never deleted. */
readonly photos?: readonly string[];
```

`applyOverrides` treats `photos` as authoritative when present: the garment's photos become those srcs in that order, each resolved from the coded photo of the same src (keeping its alt) or, for an `/uploads/` src, given the atelier alt as added photos are today; `photos[0]` is primary; a src the garment does not own is dropped. When `photos` is absent the existing `addedPhotos` and `coverSrc` rule runs unchanged, so every record already on the volume reads exactly as before. The schema allows one to twelve entries, each a coded src or an upload path; the action refuses a src the garment does not own with `unknown-photo`. Reorder, Quitar and Portada all edit the one `style:<id>` override in the draft, as stock and shown do; a new file rides on `files` and `withUploads` and is appended to `photos`. Undo needs nothing new: restoring the previous override restores its `photos`, which also closes the gap noted after step 3 (an undo used to drop photos added in the same override).

### 4. Galería and Telas

**Galería** is a grid of photos, three across on a phone, a hidden photo dimmed with an **Oculta** chip, a **+** tile first. Tap a photo for its sheet: the photo large, the caption in Spanish with Ver inglés, **Se muestra** as a switch, Retirar, Deshacer. The add sheet asks for the photo, where it belongs, and one caption in Spanish.

**Telas** is a grid of swatches with a **+** tile first. The add sheet asks for a name, the swatch photograph, and the four garment types as rows, each with a **Se ofrece** switch and a price box that appears only when the switch is on; at least one must be on. That is the same `fabric-add` record as today, shown as rows instead of four bare boxes. Tapping an existing swatch opens a sheet that shows its name, swatch and the four prices read-only with a **Cambiar en Precios** link, and **Retirar** when it is one she added. Fabric names stay one string used for both languages; they are cloth names, not sentences.

Below the fabric wall, Telas gains the studio section described in 8.

### 5. One language typed, two published

Every form and sheet asks for Spanish only. At confirm, the action translates whatever Spanish changed and writes the English beside it: for a create, into the `en` slot of each pair; for a correction, as a second `text-overrides` record for the same field with locale `en`, so per-box undo per language keeps working. This reverses the second half of amendment 3: `styleCreateSchema` and `galleryWorkSchema` take one Spanish string per field again and the action builds the pair, so the English is translated or plainly marked as a copy, never invented by a form.

New module `src/lib/translate.ts`, one function: `translateToEnglish(fields, context)`, taking a map of field name to Spanish text and a context (`"garment"`, `"photo"`) and returning the same keys in English, or `null`. It calls the Claude API through the official SDK (`@anthropic-ai/sdk`), model `claude-opus-5`, non-streaming, with a structured-output format that mirrors the input keys so the reply is parsed rather than scraped, a short system prompt (a Bronx atelier; Garífuna heritage pieces; garment names are names and stay; keep the register and roughly the length; no quotation marks), a 20-second timeout and one attempt. The key is `ANTHROPIC_API_KEY`, read in `env.ts` like every other secret, with `translationEnabled` beside `paymentsEnabled` and `emailEnabled`.

**Fallback.** When translation is off, times out, is refused or fails, the English is a copy of the Spanish, which is what the office does today, and the confirm still succeeds; a translation problem must never stop a photo from landing. Nothing new is recorded to mark it: a field whose English equals its Spanish is, by definition, untranslated. The sheet's Ver inglés shows **Inglés pendiente** on such a line with a **Traducir** link that stages a `translate` change (`{ type: "translate", key, id, fields }`) in the tab's draft; confirming it runs the same call and writes the `en` records. `translate` joins `collectionChangeSchema` and `galleryChangeSchema`.

Cost, for the manual and `next-steps.md`: a garment's four fields are about 150 words; each translation is a fraction of a cent, and a busy month is under a dollar.

### 6. Precios on a phone

No structural change. Every price box gets `inputMode="decimal"`, selects its whole value on focus so a tap never lands mid-number, and a tap target at least 2.75 rem tall. The list, the two columns and Retirar stay.

### 7. The bar, always visible

`ConfirmBar` no longer returns null at zero changes. With nothing staged it reads **Sin cambios**, hides Descartar, and shows Confirmar cambios greyed and disabled, in the same place, so the button is always where she left it. Every tab with a draft provider shows it; Libros has nothing to confirm and shows none. The layout's bottom padding already reserves the space.

### 8. The studio's shapes

`src/content/silhouettes.ts` grows from five to twelve, three per price category, drawn once against the croquis: dresses (puff-sleeve dress, square-neck midi, shirt dress); pants (palazzo, straight-leg, wide culotte); shirts (camp-collar shirt, bow blouse, tie-front blouse); heritage (wrap dress with head wrap, blouse and full skirt two-piece, head wrap alone). The seven new shapes ship **off**, so the public studio does not change on deploy; the original five ship on.

New append-only collection `studio-shapes`:

```ts
type ShapeOverride = {
  readonly shapeId: string;
  readonly enabled: boolean;
  readonly name?: { readonly es: string; readonly en: string };
  readonly updatedAt: string;
};
```

`latestBy(shapeId)`. A new reader `liveSilhouettes()` in `src/lib/live-studio.ts` returns the coded shapes with names overridden and disabled ones removed; the design studio page reads it instead of the coded list. The action refuses disabling the last enabled shape (`last-shape`), so the studio can never be empty.

Office surface: a section **Las formas del estudio** under the fabric wall in Telas, a grid of the twelve shapes drawn small in a neutral fill by the same mockup drawer, each with an on/off switch. Tap a shape for its sheet: the name in Spanish with Ver inglés, and the switch. A `shape` change (`{ type: "shape", key, shapeId, enabled, name? }`) joins `fabricChangeSchema`; the fabric action writes it and revalidates `/[locale]/design-studio`. `UNDO_KINDS` gains `studio-shape`, registered in `office-history.ts` over `versionsOf("studio-shapes", shapeId)` with the coded name and shipped on/off state as the baseline.

### 9. What does not change

The draft reducer and confirm flow; retire, restore and the in-use refusals; undo; `records.ts` and every existing collection; the guard; one `ownerAction` per tab; the uploads route; Vitrina; Libros; the price list's structure and the Precios action.

### 10. Testing

Pure tests: `applyOverrides` with `photos` (order kept, a coded photo left out is hidden, a foreign src is dropped, a record without `photos` reads as before); `liveSilhouettes` (names overridden, disabled removed, last-shape refusal); `translateToEnglish` with an injected client (a good reply is parsed by key, a malformed reply returns null, no key returns null without a call) and the actions' fallback (English equals Spanish, confirm still succeeds); schema tests for `photos`, `translate` and `shape`; the tabs test at seven with the redirect; the guard scan unchanged.

Browser pass at 375 px, signed in: the bar reads Sin cambios on every editable tab before anything is touched; open a garment's sheet, remove a shipped photo, move another first, mark a cover, Listo, confirm, and see the public page agree; add a garment in Spanish only and, with a key, read its English on the English site, or without one see Inglés pendiente and Traducir; type into a price and see the whole number selected; add a fabric with two of four types on; turn a shape on and find it in the public studio; the leave-tab prompt still fires.

### 11. Order of work

Each step is its own pull request from `main`, deployed with `npm run deploy` as it lands, with `docs/manual-del-taller.html` and `docs/next-steps.md` updated in the same PR.

1. Hub: Hoy and Trabajo become one tab; the bar always visible; Precios phone typing. One small PR.
2. The sheet; Colección as cards and a sheet with full photo control; `translate.ts` and Spanish-only in that sheet and the create sheet. The big one.
3. Galería and Telas as grids and sheets, Spanish-only, with the fabric rows.
4. The studio's seven new shapes and the Telas section that controls them.

Step 2 lands the translation module because the Colección sheet is the first Spanish-only surface; steps 3 and 4 reuse it.
