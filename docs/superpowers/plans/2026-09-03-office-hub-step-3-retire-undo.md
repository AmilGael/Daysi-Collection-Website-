# Office Hub Step 3: Retire Everywhere and Staged Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire and restore reach custom fabrics, price entries and every request kind; every row that the office changed offers "Deshacer", which stages the previous version as a pending change that Daysi confirms.

**Architecture:** The retired tombstone layer gains three kinds and one seam per store (`activeRequests`, `manageablePriceList`, `manageableCustomFabrics`); a per-stream undo registry (`office-history.ts`) turns the previous line of a record into an ordinary draft change; one shared read-only server action returns it to the client, which stages it through the existing draft and confirm bar. In-use refusals carry a count.

**Tech Stack:** Next.js 15.5.25 App Router server actions, React 19.1.9, next-intl 3.26.5, zod 3, vitest 3, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md` (Design 3 and Amendment 2).

## Global Constraints

- Next stays pinned at `15.5.25`, React at `19.1.9`; `package.json` untouched.
- Nothing writes without "Confirmar cambios": retire, restore and undo all stage into the draft.
- Nothing is physically deleted; every removal is a tombstone line, every reversal another line.
- All reads of requests that affect money, availability or the client's account go through `activeRequests`; the Stripe webhook keeps raw reads.
- No em dashes in any user-facing string; both bundles keep identical `office` key sets.
- Each task is one commit and leaves `npm run typecheck && npm test` green.
- Deploy is `npm run deploy`, run by the user, never by the agent.
- Commit messages: a plain sentence saying what changed and why, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Plan agent's design: retire everywhere, and undo that stages a reversal

**Branch:** `office-step-3` off `main` (HEAD `fe7a591`). Spec: `docs/superpowers/specs/2026-09-02-office-hub-design.md` Design 3 + Amendment 2 (binding). All paths below are under `/Users/genel/Mirror/Daysi-Collection-Website-/`.

## A. Findings in the current code that shape the plan

| # | What is awkward | Smallest fix |
|---|---|---|
| 1 | Undo needs "the record before this one", but the office writes to several streams per entity (a style has `style-overrides` and `retired`; a request has its kind file and `retired`), and two of them carry no timestamp (`gallery-visibility` lines are `{id, hidden}`; request lines share `submittedAt`). A cross-stream "most recent" cannot be ordered honestly. | Undo is **per stream**. `UndoKind` names the stream; a row's `Deshacer` reverts its edit stream (override, visibility, price, notice, status). Retire/restore flips are registered too (tested, returned by `previousChangeFor`), but the visible reversal of a flip stays `Restaurar` in the Retirados group and `Retirar` on the row. |
| 2 | "Undoable" was framed as "history > 1 or changed this session". Most streams have a floor (the coded catalog, the coded price, no notice), so one office line is already undoable. And after a confirmed change the action's `revalidatePath` re-renders the tab in the same response, so a server-computed flag already covers "changed this session". | Per stream: `baseline(id)` returns the floor as a change or `undefined`. `undoable = versions >= 2 || (versions === 1 && baseline defined)`. No client-side "changed this session" set. |
| 3 | `ChangeRefused` carries a code only; `in-use` wants a count, and `ChangeResult`/`DraftEntry`/`Pending`/`ErrorText` only pass a string. | `ChangeRefused(code, count?)`; `ChangeResult.count?`, `DraftEntry.count?`, `Pending({count})`, `ErrorText` calls `t(key, { count: count ?? 0 })`. One message key `error.in-use` with an ICU plural; no second key. |
| 4 | `fabrics/actions.ts:15` builds `taken` from `customFabrics()`. Once that is active-only, a new fabric can reuse a retired fabric's id and inherit its tombstone (invisible on arrival). | `taken` reads `manageableCustomFabrics()`. |
| 5 | `collection/actions.ts:39` checks `livePriceList()` for the pair before creating a style. If that entry is retired, `style-create` writes a duplicate custom entry that the retired set still drops, so the new garment has no price. | Look the pair up in `manageablePriceList()`; if it exists and is retired, `throw new ChangeRefused("entry-retired")`. |
| 6 | The Trabajo premiere sign-ups are plain server JSX in `work/page.tsx:57-77`; a `Retirar` button needs a client component. | New `src/components/office/premiere-signup-list.tsx` (email, season, `RetireButton`, `Pending`) staging `retire` under `request:${reference}`. |
| 7 | `retireChangeSchema` is `{type, key, id}`; the work action needs the request's kind to find the file, and the fabric/price actions need to know which `RetiredKind` to write. | The tab decides the kind (fabrics -> `fabric`, prices -> `price-entry`, work -> `request`). For requests add `requestVersions(reference)` / `findRequest(reference)` to `request-store.ts` that scan the six kind files; references are prefixed (`ORD-`, `CIT-`, `MSG-`, ...) so a scan is unambiguous and cheap. |
| 8 | `office-validation.ts` is imported at runtime by the actions and type-only by editors; `office-history.ts` will import fs-reading libs. | `UNDO_KINDS` const and `undoQuerySchema` live in `office-validation.ts`; `office-history.ts` imports the type from there, never the other way. |
| 9 | `action-guard.test.ts:114-121` asserts exactly six `"use server"` files, keyed by `path.dirname`. | Add `"actions.ts"` to the sorted list and `".": "readPreviousChange"` to `expectedExports`. Nothing else changes. |
| 10 | Undo of a fabric swatch has no edit stream: the office only ever *adds* a fabric. | No `Deshacer` on swatches; `Retirar` is the reversal (the two-tap confirm stays). If the controller wants the link anyway, register a `custom-fabric` stream whose one-version reversal is a `retire` change (3 lines in the registry). |
| 11 | `RetireButton` says "Sale del sitio", which is wrong for an order or a message. | Optional `prompt?: string` prop; Trabajo passes `t("retireRequestConfirm", { name })`. |
| 12 | Price rows for a retired custom fabric vanish entirely (the fabric contributes no entries), so they never appear in the Prices Retirados group. That is by design (decision 1). | Nothing to code; one sentence in the manual (`#telas`): restoring the fabric brings its prices back. |

## B. Task list, in commit order

Each task is one commit and leaves `npm run typecheck && npm test` green. Tasks 1 to 6 change no behaviour for anything not yet retired.

### Task 1: retired kinds

**Modify** `src/lib/retired.ts`
```ts
export type RetiredKind = "style" | "gallery" | "fabric" | "price-entry" | "request";
```
Nothing else changes (`retiredKey`, `retiredSet`, `setRetired` are already generic).

**Modify** `src/lib/retired.test.ts`: `it.each(["fabric", "price-entry", "request"] as const)("retires and restores a %s")`; "keeps kinds separate" also asserts `retiredSet("request")` empty after `setRetired("price-entry", "x", true)`.

### Task 2: pricing reads a retired set; manageable variants

**Modify** `src/lib/live-pricing.ts`
```ts
export function assemblePriceList(
  coded, fromFabrics, custom, overrides,
  retired: ReadonlySet<string> = new Set(),
): PriceListEntry[]            // filter(!retired.has(entry.id)) after applyEntryOverrides

export function manageableCustomFabrics(): (CustomFabric & { retired: boolean })[]  // latestBy over the file, flagged from retiredSet("fabric")
export function customFabrics(): CustomFabric[]        // manageableCustomFabrics().filter(!retired), strip the flag
export function livePriceList(): PriceListEntry[]      // passes retiredSet("price-entry"); fromFabrics = customFabrics().flatMap(entriesFromCustom) (active only, unchanged call)
export function manageablePriceList(): (PriceListEntry & { retired: boolean })[]
  // assemblePriceList(priceList, customFabrics().flatMap(entriesFromCustom), customEntries(), overrides) flagged from retiredSet("price-entry")
```
`liveFabrics()`, `liveFindFabric`, `liveFindPriceEntry` change nothing and automatically exclude retired.

**Modify** `src/lib/assemble-prices.test.ts`: retired set drops a coded entry; drops a custom entry; empty set changes nothing; an override on a retired entry does not resurrect it.

**Create** `src/lib/live-pricing.test.ts` (temp `DATA_DIR` + `vi.resetModules()` + dynamic import, exactly as `retired.test.ts`): `saveCustomFabric({ id: "cereza", name, swatchImage: "/uploads/a.jpg", averageColor: "#aabbcc", prices: { dresses: 12000 } })` -> `livePriceList()` has `dresses--cereza` and `liveFabrics()` has `cereza`; after `setRetired("fabric", "cereza", true)` both are gone, `manageableCustomFabrics()` lists it `retired: true`; `setRetired("price-entry", "dresses--cereza", true)` on a restored fabric drops it from `livePriceList()` but `manageablePriceList()` flags it.

### Task 3: `activeRequests` is the single seam

**Modify** `src/lib/request-store.ts`
```ts
export const REQUEST_KINDS = ["alteration","order","commission","appointment","contact","premiere-signup"] as const satisfies readonly StoredRequestKind[];
export function activeRequests(kind: StoredRequestKind): StoredRequest[]      // currentRecords(listRequests(kind)) minus retiredSet("request") by reference
export function manageableRequests(kind: StoredRequestKind): (StoredRequest & { retired: boolean })[]
export function requestVersions(reference: string): StoredRequest[]           // every line for that reference, file order; scans REQUEST_KINDS, first kind that has it
export function findRequest(reference: string): StoredRequest | undefined     // requestVersions(reference).at(-1)
export function requestsForAccount(account, kinds): StoredRequest[]           // kinds.flatMap(activeRequests), then the ownership filter, then the sort (drop the inner currentRecords call)
```
Import `retiredSet` from `./retired` (no cycle: retired -> records -> env/signing).

**Modify** `src/lib/earnings.ts`: `loadLedger()` = `BILLABLE.flatMap(activeRequests).sort(...)`; drop the `currentRecords`/`listRequests` imports.
**Modify** `src/lib/availability.ts`: delete `latestPerReference` (lines 93-102) and its comment; `bookedSlots()` reads `activeRequests("appointment")`; import changes accordingly.
**Modify** `src/app/[locale]/office/work/page.tsx`: `messages = activeRequests("contact")`, `signups = activeRequests("premiere-signup")`.
`src/app/api/stripe/webhook/route.ts` stays on raw `listRequests` (verify with the grep in Task 13). `work/actions.ts` keeps its raw lookup for now (Task 10 replaces it with `findRequest`).

**Create** `src/lib/request-store.test.ts` (temp `DATA_DIR`): `activeRequests` keeps the newest line per reference; drops a retired reference; `manageableRequests` flags it; `requestsForAccount` for the owning account no longer lists it; `requestVersions` returns three lines in order and `findRequest` the last; unknown reference -> `[]` / `undefined`.
**Create** `src/lib/earnings.test.ts` (temp `DATA_DIR`): a paid order with `estimate.total` appears in `loadLedger()`; `setRetired("request", ref, true)` removes it (and `earningsFrom` drops to zero); restore brings it back. Books follow since `salesCsv`/`exportSummary` take the ledger.
**Create** `src/lib/availability.test.ts` (temp `DATA_DIR`): `now = new Date("2026-09-07T12:00:00Z")`; `const [day] = await availableDays("consultation-30", now)`, take `day.slots[0]`; `saveRequest` an appointment `{ kind: "appointment", reference: "CIT-TEST", status: "scheduled", details: { date: day.date, startTime, minutes: 30 } }`; the slot is gone; `setRetired("request", "CIT-TEST", true)` -> the slot is back; restore -> gone again. (The store is read per call, so no module reset between assertions.)

### Task 4: history helpers in `records.ts`

**Modify** `src/lib/records.ts`
```ts
/** Every line for one key, in file order: the record's own history. */
export function versionsOf<T>(collection: string, key: (record: T) => string, id: string): T[]
/** The line before the newest one, or undefined when there is none. */
export function previousVersion<T>(collection: string, key: (record: T) => string, id: string): T | undefined   // versionsOf(...).at(-2)
```
**Modify** `src/lib/records.test.ts`, new `describe("a record's history")`: three appends for `a` interleaved with one for `b` -> `versionsOf("things", r => r.id, "a")` has three in order; `previousVersion` is the second; with one line -> `undefined`; with none -> `undefined`.

### Task 5: change unions, undo query, in-use helpers, `ChangeRefused` count

**Modify** `src/lib/office-validation.ts`
```ts
export const fabricChangeSchema = z.discriminatedUnion("type", [ fabricSchema.extend({...fabric-add}), retireChangeSchema, restoreChangeSchema ]);
export const priceChangeSchema  = z.discriminatedUnion("type", [ entry, alteration, appointment, retireChangeSchema, restoreChangeSchema ]);   // retire/restore are price entries only; the action enforces it
export const workChangeSchema   = z.discriminatedUnion("type", [ request-status, retireChangeSchema, restoreChangeSchema ]);            // id = reference

export const UNDO_KINDS = [
  "style-override", "work-visibility", "price-entry", "alteration", "appointment", "notice", "request-status",
  "retired:style", "retired:gallery", "retired:fabric", "retired:price-entry", "retired:request",
] as const;
export type UndoKind = (typeof UNDO_KINDS)[number];
export const undoQuerySchema = z.object({ kind: z.enum(UNDO_KINDS), id: z.string().trim().min(1).max(80) });
export type UndoQuery = z.infer<typeof undoQuerySchema>;
export type OfficeChange = CollectionChange | GalleryChange | FabricChange | PriceChange | ShopfrontChange | WorkChange;
```
**Modify** `src/lib/office-validation.test.ts`: add to the `describe.each` table: fabric retire/restore (`key: "fabric:x"`), price retire/restore (`key: "entry:x"`), work retire/restore (`key: "request:CIT-1"`); `undoQuerySchema` accepts `{ kind: "notice", id: "site" }` and refuses `kind: "everything"` and an empty id.

**Modify** `src/lib/action-guard.ts`
```ts
export type ChangeResult = { readonly key: string; readonly ok: boolean; readonly error?: string; readonly count?: number };
export class ChangeRefused extends Error { constructor(readonly code: string, readonly count?: number) { super(code); } }
// applyEach: on ChangeRefused push { key, ok: false, error: code, ...(count !== undefined ? { count } : {}) }
```
**Modify** `src/lib/action-guard.test.ts` `applyEach` case: a `ChangeRefused("in-use", 3)` yields `{ key, ok: false, error: "in-use", count: 3 }`; a plain code has no `count` property.
**Modify** `src/components/office/draft-reducer.ts`: `DraftEntry.count?: number`; `settled` keeps `count: result?.count`. **Modify** `draft-reducer.test.ts`: settled carries the count.
**Modify** `src/components/office/confirm-bar.tsx`: `export function ErrorText({ code, count }: { code: string; count?: number })` -> `t(key, { count: count ?? 0 })`; `Pending({ confirming, error, count })` passes it through. Update the four `Pending` call sites that pass `entry.error` to also pass `entry.count` (collection, gallery, fabric, price, notice, request list, retired-group) as each file is touched later; nothing breaks meanwhile because the prop is optional.

**Create** `src/lib/in-use.ts`
```ts
/** Pure: how many of these styles price themselves through this entry. */
export function stylesUsingEntry(styles: readonly GarmentStyle[], entryId: string): number
/** Pure: how many price themselves through any entry of this fabric. Falls back to the `${category}--${fabric}` id shape when an entry is not in the list. */
export function stylesUsingFabric(styles: readonly GarmentStyle[], entries: readonly PriceListEntry[], fabricId: string): number
/** Live, active styles only: manageableStyles().filter(s => !s.retired). */
export function liveStylesUsingEntry(entryId: string): number
export function liveStylesUsingFabric(fabricId: string): number     // entries = manageablePriceList()
```
**Create** `src/lib/in-use.test.ts` (pure): two styles on `dresses--wax-print`, one on `shirts--wax-print`: entry count 2, fabric `wax-print` count 3, unknown fabric 0; a style whose entry is missing from the list still counts by id shape.

### Task 6: `office-history.ts`, the undo registry

**Create** `src/lib/office-history.ts`
```ts
import type { OfficeChange, UndoKind } from "./office-validation";

type Stream<R> = {
  readonly all: () => R[];                                   // every line, file order
  readonly key: (record: R) => string;
  readonly versions: (id: string) => R[];                    // versionsOf(collection, key, id) for record streams; requestVersions for requests
  readonly baseline: (id: string) => OfficeChange | undefined; // the state before the first office line, as a change; undefined when there is no floor
  readonly toChange: (record: R, id: string) => OfficeChange;
};

export function previousChangeFor(kind: UndoKind, id: string): OfficeChange | undefined
  // v = versions(id); v.length >= 2 ? toChange(v[v.length - 2], id) : v.length === 1 ? baseline(id) : undefined
export function undoableIds(kind: UndoKind): Set<string>
  // one pass over all(): count per key; include when count >= 2, or count === 1 && baseline(id) !== undefined
```
Streams (record type, collection, key, baseline, change key):
- `style-override`: `StyleOverride`, `style-overrides`, `styleId`; baseline from `assembleStyles(styles, addedStyles(), [])` -> `{ type: "style-override", key: "style:"+id, styleId, isPublished, stock: fromEntries(sizes.map(s => [s.sizeId, s.inStock])) }`; `toChange` copies `isPublished, stock, addedPhotos?, coverSrc?` (omit undefined fields so zod's optional passes).
- `work-visibility`: `GalleryVisibility`, `gallery-visibility`, `id`; baseline `{ type: "work-visibility", key: "gallery:"+id, id, hidden: false }` when `manageableGallery()` has the id.
- `price-entry`: `PriceEntryOverride`, `price-overrides`, `entryId`; baseline from `assemblePriceList(priceList, customFabrics().flatMap(entriesFromCustom), customEntries(), [])` -> `{ type: "entry", key: "entry:"+id, id, fixedPrice, customizationExtra }`.
- `alteration`: `AlterationOverride`, `alteration-overrides`, `alterationId`; baseline from coded `alterationServices` -> `{ type: "alteration", key: "alteration:"+id, id, fixedPrice, rushSurcharge }`.
- `appointment`: `AppointmentOverride`, `appointment-overrides`, `typeId`; baseline from coded `appointmentTypes` -> `{ type: "appointment", key: "appointment:"+id, id, fee }`.
- `notice`: `SiteNotice`, `site-notice`, key `() => "site"`; baseline `{ type: "notice", key: "notice:site", message: "", visible: false }`.
- `request-status`: `StoredRequest`, `all = REQUEST_KINDS.flatMap(listRequests)`, key `reference`, `versions = requestVersions`; baseline `undefined`; `toChange` -> `{ type: "request-status", key: "request:"+ref, kind: record.kind, reference: ref, status: record.status }`.
- `retired:<k>` for each `RetiredKind`: `RetiredRecord`, `retired`, key `retiredKey(r.kind, r.id)`, `versions(id) = versionsOf("retired", key, retiredKey(k, id))`; baseline `{ type: "restore", key: prefix(k)+id, id }`; `toChange(r) = r.retired ? retire : restore` with `prefix = { style: "style:", gallery: "gallery:", fabric: "fabric:", "price-entry": "entry:", request: "request:" }`. `undoableIds` for these streams filters `all()` to `kind === k` before counting.

**Create** `src/lib/office-history.test.ts` (temp `DATA_DIR`, dynamic imports of `./office-history`, `./live-catalog`, `./live-pricing`, `./request-store`, `./retired`):
- style-override: no lines -> `undefined`; one `saveStyleOverride({ styleId: "frutera", isPublished: false, stock: { m: false } })` -> baseline change with `isPublished: true` and the seed stock of `frutera`; a second override -> the first one back as a change; `undoableIds("style-override")` has `frutera` after one line.
- price-entry: one override on `dresses--wax-print` (or whichever coded id `priceList[0].id` is) -> baseline equals the coded `fixedPrice`.
- notice: one `saveNotice` -> `{ message: "", visible: false }`; two -> the first.
- request-status: one line -> `undefined` and not in `undoableIds`; `saveRequest({... status: "answered"})` again -> change with `status: "new"` and `kind` copied.
- retired:style: one retire -> `{ type: "restore", key: "style:frutera" }`; retire then restore -> `{ type: "retire" }`; `undoableIds("retired:style")` does not include an id retired only under `gallery`.

### Task 7: the shared undo action, and the scan

**Create** `src/app/[locale]/office/actions.ts`
```ts
"use server";
import { ownerAction } from "@/lib/action-guard";
import { previousChangeFor } from "@/lib/office-history";
import { undoQuerySchema } from "@/lib/office-validation";

export const readPreviousChange = ownerAction(
  undoQuerySchema,
  async ({ kind, id }) => ({ change: previousChangeFor(kind, id) ?? null }),
  { revalidate: [] },
);
```
Result type: `ActionResult<{ change: OfficeChange | null }>`; `null` means nothing to undo (a read, so no `ChangeRefused`).

**Modify** `src/lib/action-guard.test.ts` scan: expected file list gains `"actions.ts"` (sorted first); `expectedExports["."] = "readPreviousChange"`.

**Create** `src/components/office/undo-link.tsx` (client)
```ts
export function UndoLink({ kind, id }: { kind: UndoKind; id: string }): JSX.Element
```
`useOfficeDraft<OfficeChange>()`, `useTransition`, `const [error, setError] = useState<string | null>(null)`. Click -> `startTransition(async () => { const r = await readPreviousChange({ kind, id }); if (!r.ok) setError(r.error); else if (!r.change) setError("nothing-to-undo"); else { setError(null); draft.stage(r.change.key, { wire: r.change }); } })`. Renders a `text-xs underline` button labelled `t("undo")` (`t("undoPending")` and `disabled` while pending) and `<ErrorText code={error}/>` after it when set. Callers render it only when `row.undoable && !draft.pending(rowKey)`. Import path `@/app/[locale]/office/actions` (a `"use server"` module imported from a client file is a reference, as the tab pages already do through props).

**Modify** messages `office` in `src/messages/es.json` / `en.json`: `undo` "Deshacer" / "Undo"; `undoPending` "Buscando la versión anterior…" / "Finding the previous version…"; `error.nothing-to-undo` "No hay una versión anterior que recuperar." / "There is no earlier version to go back to."; `error.in-use` "{count, plural, one {# prenda del sitio todavía usa esto} other {# prendas del sitio todavía usan esto}}. Retire la prenda primero." / "{count, plural, one {# garment on the site still uses this} other {# garments on the site still use this}}. Retire the garment first."; `error.unknown-fabric` "No se encontró esa tela." / "That fabric could not be found."; `error.entry-retired` "Ese precio está retirado. Restáurelo en Precios antes de usarlo." / "That price is retired. Restore it under Prices before using it."; `retireRequestConfirm` "¿Retirar {name}? Sale de Trabajo, de los libros y de la cuenta de la clienta. Puede restaurarla desde Retirados." / "Retire {name}? It leaves Work, the books and the client's account. You can restore it from Retired.". No em dashes. Extend the key list in `draft-reducer.test.ts:108-116` with `undo`, `undoPending`, `retire`, `restore`, `retiredGroup`, `retireRequestConfirm`.

Verify: typecheck, tests (scan sees seven files). Nothing renders the link yet.

### Task 8: Prices tab, retire and restore

**Modify** `src/app/[locale]/office/prices/actions.ts`: `entry` existence via `manageablePriceList()` (so restore + edit in one batch works); new cases
```ts
case "retire":
  if (!manageablePriceList().some((e) => e.id === change.id)) throw new ChangeRefused("unknown-entry");
  { const count = liveStylesUsingEntry(change.id); if (count > 0) throw new ChangeRefused("in-use", count); }
  await setRetired("price-entry", change.id, true); return;
case "restore": await setRetired("price-entry", change.id, false);
```
**Modify** `src/app/[locale]/office/prices/page.tsx`: `manageablePriceList()`; `ManagedEntry` gains `retired: boolean`; split `active`/`retired`; pass `retiredEntries` to `PriceManager`.
**Modify** `src/components/price-manager.tsx`: `PriceManager({ entries, retiredEntries, alterations, appointments })`; `PriceTable` gains optional `retire?: { kind: "price-entry" }` used by the garments table only: a `<RetireButton name={`${row.label} · ${row.sublabel}`}>` per row staging `{ type: "retire", key: `entry:${id}`, id }`, inputs `disabled` and the row `opacity-50` while a `retire` is pending (mirror `collection-manager.tsx:140-145`), `removePending` link; `amountsFrom` returns `row.amounts` for a non-price pending wire. Under the three tables: `<RetiredGroup items={retiredEntries.map(e => ({ id: e.id, name: `${e.garment} · ${e.fabric}` }))} restoreKey={(id) => `entry:${id}`} onRestore={... restore ...}/>`.
**Modify** `src/app/[locale]/office/collection/actions.ts` (finding 5): `const existing = manageablePriceList().find(...)`; `if (existing?.retired) throw new ChangeRefused("entry-retired")`.

Browser as owner on `/es/office/prices`: retire a coded entry that a seeded style uses -> confirm -> the row shows the in-use text with the count and stays pending; Descartar. Add a custom entry via a new garment, retire that garment (Colección), then retire its entry -> confirm -> it moves to Retirados, `/es/prices` no longer lists it; Restaurar + confirm brings it back.

### Task 9: Fabrics tab, retire and restore (custom fabrics only)

**Modify** `src/app/[locale]/office/fabrics/actions.ts`: `taken` from `manageableCustomFabrics()` (finding 4); cases
```ts
case "retire":
  if (!manageableCustomFabrics().some((f) => f.id === change.id)) throw new ChangeRefused("unknown-fabric");
  { const count = liveStylesUsingFabric(change.id); if (count > 0) throw new ChangeRefused("in-use", count); }
  await setRetired("fabric", change.id, true); return;
case "restore":
  if (!manageableCustomFabrics().some((f) => f.id === change.id)) throw new ChangeRefused("unknown-fabric");
  await setRetired("fabric", change.id, false);
```
(`fabric-add` keeps its current body under `case "fabric-add"`.) Add `"/[locale]/collection/[slug]"` and `"/[locale]/request"` to the revalidate list (a fabric's entries feed both).
**Modify** `src/app/[locale]/office/fabrics/page.tsx`: `custom = manageableCustomFabrics()`; wall = `liveFabrics()` mapped with `custom: customIds.has(id)`; `retired = custom.filter(f => f.retired).map(f => ({ id, name, swatchImage }))`; pass `retired`.
**Modify** `src/components/fabric-manager.tsx`: prop `retired: readonly ManagedFabric[]`; custom swatches get `<RetireButton name={fabric.name} onConfirm={() => draft.stage(`fabric:${id}`, { wire: { type: "retire", key, id } })}/>`, dim + `Pending` + `removePending` when pending; `<RetiredGroup items={retired.map(f => ({ id, name, photo: swatchImage }))} restoreKey={(id) => `fabric:${id}`} .../>` between the wall and the add form. No `Deshacer` (finding 10).

Browser: add a fabric, confirm; create a garment on it; retire the fabric -> confirm -> in-use with count 1; retire the garment first, then the fabric -> it leaves `/es/design-studio` and its rows leave `/es/prices`; Restaurar reverses both.

### Task 10: Work tab, retire and restore for every kind

**Modify** `src/app/[locale]/office/work/actions.ts`: `request-status` looks up `findRequest(change.reference)` (kind from the record, so the `kind` field is only validated, not trusted for the file); cases
```ts
case "retire":
  if (!findRequest(change.id)) throw new ChangeRefused("unknown-reference");
  await setRetired("request", change.id, true); return;
case "restore": await setRetired("request", change.id, false);
```
Add `"/[locale]/appointments"` to the revalidate list (a retired appointment frees its slot).
**Modify** `src/app/[locale]/office/work/page.tsx`: `retired = REQUEST_KINDS.flatMap(manageableRequests).filter(r => r.retired)`; render `<RetiredGroup items={retired.map(r => ({ id: r.reference, name: `${r.reference} · ${r.client.name || r.client.email}` }))} restoreKey={(id) => `request:${id}`} .../>` as a last section inside the provider; sign-ups move to `<PremiereSignupList records={signups} emptyMessage={t("noSignups")}/>`.
**Modify** `src/components/office-request-list.tsx`: each article gets `<RetireButton name={record.reference} prompt={to("retireRequestConfirm", { name: record.reference })} onConfirm={...stage retire under `request:${reference}`...}/>`; pending retire dims the article, disables the select, shows `Pending` + `removePending`.
**Modify** `src/components/office/retired-group.tsx`: `RetireButton` gains `prompt?: string` (defaults to `t("retireConfirm", { name })`); `Pending` call passes `count`.
**Create** `src/components/office/premiere-signup-list.tsx` (client, finding 6): the `<ul>` from `work/page.tsx:63-76` plus `RetireButton`/`Pending`/`removePending` per row, staging `retire` under `request:${reference}`; empty-state paragraph when no records.

Browser: retire an appointment -> confirm -> it leaves Trabajo, Hoy's "Citas" count drops, `/es/office/books` summary drops it, `/es/appointments` offers the slot again, the client's `/es/account/orders` no longer lists it; Restaurar + confirm reverses all four. Retire a message and a sign-up; both appear in Retirados.

### Task 11: `Deshacer` across the tabs

Each page computes the flag once per stream and passes it on the row; each editor renders `<UndoLink kind id/>` next to `RetireButton` when `row.undoable && !draft.pending(key)`.

- **Collection**: `collection/page.tsx` `const undoable = undoableIds("style-override")`; `ManagedStyle.undoable: boolean`; `collection-manager.tsx` row: `<UndoLink kind="style-override" id={row.id}/>`.
- **Gallery**: `undoableIds("work-visibility")`; `ManagedWork.undoable`; card: `<UndoLink kind="work-visibility" id={work.id}/>`.
- **Prices**: three sets (`price-entry`, `alteration`, `appointment`); `Row.undoable`; `PriceTable` gets `undoKind: UndoKind`; per row `<UndoLink kind={undoKind} id={row.id}/>` in the right-hand cell when not pending.
- **Shopfront**: `undoable = undoableIds("notice").has("site")`; `NoticeEditor({ ..., undoable })` renders `<UndoLink kind="notice" id="site"/>` beside the checkbox. Because the editor keeps `message`/`visible` in local state, add an effect: when `draft.pending("notice:site")?.change.wire.type === "notice"` and its values differ from local state, copy them in (so a staged undo is visible in the textarea).
- **Work**: `undoableIds("request-status")`; `OfficeRequestList` records typed `readonly (StoredRequest & { undoable: boolean })[]`; `<UndoLink kind="request-status" id={record.reference}/>` under the select.

Browser: untick a size, confirm, `Deshacer` appears; press it -> the row shows the previous state as "pendiente" with the bar at 1; confirm -> `Deshacer` still offered; press again -> redo, confirm. Change a price, confirm, Deshacer -> the coded price returns as pending. Notice: set text, confirm, Deshacer -> empty and unchecked pending. Status: move to "Contestado", confirm, Deshacer -> "Recibido" pending. A row never touched shows no link; a seeded price with no override shows no link.

### Task 12: copy and the manual

**Modify** `docs/manual-del-taller.html`:
- Contents nav: insert `<li><a href="#deshacer">Deshacer un cambio</a></li>` after `#pedidos`; renumber `libros` 10, `fotos` 11, `problemas` 12 (the `<span class="n">` numbers).
- New `<section class="task" id="deshacer">` 09: three steps (the row keeps `Deshacer` after a confirmed change; pressing it puts the earlier version in the list as "pendiente"; `Confirmar cambios` makes it real, `Descartar` forgets it) and a note: "Deshacer dos veces vuelve a donde estaba". A second paragraph "Retirar y restaurar" for telas (only rolls she added; a fabric a garment still uses is refused with the count, retire the garment first), precios (same rule), and pedidos.
- `#precios`: a step for `Retirar`/`Restaurar` on a garment price and the in-use rule.
- `#telas`: a step for `Retirar` on her own rolls, plus the sentence from finding 12.
- `#pedidos`: replace the cancellation note with: a retired appointment frees its hour, leaves the books and the client's account; `Restaurar` puts all three back.
- `#problemas` item 4 ("Se equivocó en algo"): point to `Deshacer` and `#deshacer`.
**Modify** messages: `fabricsLead` and `pricesLead` gain one sentence each about `Retirar`/`Restaurar` (Spanish first, English mirrored). Grep both bundles for em dashes.

### Task 13: full verification

- `npm run typecheck && npm test && npm run build`.
- `npm run dev` then `npm run smoke` (private set unchanged).
- `grep -rn "listRequests(" src --include=*.ts --include=*.tsx | grep -v test` shows only `request-store.ts` and `api/stripe/webhook/route.ts`; `grep -rn "latestPerReference" src` is empty; `grep -rn "customFabrics()" src/app` shows nothing outside `office-history`/`live-pricing` except `fabrics/page.tsx` via `manageableCustomFabrics`.
- `git grep -n "—" src/messages docs/manual-del-taller.html` shows nothing new.
- Browser pass as owner across all seven tabs (the checks in Tasks 8 to 11); with `DATA_DIR` pointed at a read-only path, an undo that stages fine still fails at confirm with the row error, and `readPreviousChange` itself still works (it only reads); signed out in another tab, `Deshacer` shows the `not-found` text on the row and stages nothing; as a client every office path is 404.

## C. Sequencing notes

- Tasks 1 to 6 touch no page or editor; every new parameter defaults to "nothing retired", so `main` behaviour is unchanged until a tab writes a tombstone of the new kinds.
- Task 3 changes what the Work, Today, Books tabs and the client's account read, but with an empty `request` retired set the output is byte-identical; `availability.test.ts` is the proof the seam works before any UI can retire an appointment.
- Task 7 must land before Task 11 (the link needs the action) and after Task 6 (the action needs the registry); Tasks 8 to 10 are independent of 7 and of each other.
- Message keys are added in the task that first renders them; `draft-reducer.test.ts` guards their presence in both bundles.

### Critical Files for Implementation
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/office-history.ts (new; the per-stream registry, `previousChangeFor`, `undoableIds`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/request-store.ts (`activeRequests`, `manageableRequests`, `requestVersions`, `findRequest`, `REQUEST_KINDS`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/live-pricing.ts (`assemblePriceList` retired param, `manageableCustomFabrics`, `manageablePriceList`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/office-validation.ts (retire/restore on three more unions, `UNDO_KINDS`, `undoQuerySchema`, `OfficeChange`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/action-guard.ts and /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/action-guard.test.ts (`ChangeRefused` count, the seven-file scan)
