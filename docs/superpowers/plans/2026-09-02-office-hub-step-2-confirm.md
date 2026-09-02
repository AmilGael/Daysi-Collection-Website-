# Office Hub Step 2: Confirmed Saves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every office edit collects in a per-tab draft that Daysi confirms or discards; nothing writes before she confirms. Garments and gallery photos gain add, retire and restore listings.

**Architecture:** One `ownerAction` guard over the existing `officeDenial` policy; one server action per tab taking the whole draft as a zod discriminated union; a client `OfficeDraftProvider` (pure reducer + `useOptimistic` + `useTransition`) rendering one `ConfirmBar`; uploads run at confirm time; `retired.jsonl` tombstones for kinds `style` and `gallery`.

**Tech Stack:** Next.js 15.5.25 App Router server actions, React 19.1.9 (`useOptimistic`, `useTransition`), next-intl 3.26.5, zod 3, vitest 3, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md` (Design 2, Step 2, and the Amendment at the end).

## Global Constraints

- Next stays pinned at `15.5.25`, React at `19.1.9`; `package.json` untouched.
- Nothing writes to the store until Daysi presses "Confirmar cambios"; every tab has exactly one bar.
- Every mutation goes through an `ownerAction` in a per-tab `actions.ts`; the six JSON office routes are deleted as their editors move; `api/office/uploads` and `api/office/books` remain.
- Photo uploads happen only at confirm time, after which the change carries the `/uploads/...` path.
- Nothing is physically deleted; retire is a tombstone line, restore is another line.
- No em dashes in any user-facing string. Spanish is the primary copy; every new key exists in both bundles.
- Each task is one commit and leaves `npm run typecheck && npm test` green; a route is deleted in the same commit as the editor that used it.
- Deploy is `npm run deploy`, run by the user, never by the agent.
- Commit messages: a plain sentence saying what changed and why, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Plan agent's design: one save language (draft + confirm), with retire/restore for styles and gallery

## A. Findings in the current code that shape the plan (each with the smallest fix)

| # | What is awkward | Smallest fix |
|---|---|---|
| 1 | `collection-manager.tsx:37` and `gallery-manager.tsx:38` copy props into `useState(rows)`. After a revalidation the new props never reach the state, so rows go stale. | Render from props plus the draft overlay; no row state at all. Falls out of the conversion. |
| 2 | One draft per tab, but the Work tab renders `OfficeRequestList` three times and the Collection tab renders `CollectionManager` and `StyleComposer` side by side. Separate hook instances would mean several bars. | The draft lives in a context: `<OfficeDraftProvider apply={applyXChanges}>` wraps each tab page's content and renders the one `<ConfirmBar>` itself. `useOfficeDraft()` reads the context, so `confirm()` takes no `run` argument; the provider owns the action. |
| 3 | A `File` cannot sit in a serialisable change, and uploads must happen only at confirm. | The client-side change is `{ wire, files?, withUploads? }`. The provider uploads `files` with the existing `uploadPhoto`, calls `withUploads(srcs)` to fold the `/uploads/...` paths in, and only then calls the action. A change whose upload fails is reported as `{ key, ok: false, error: "upload-failed" }` and stays in the draft. |
| 4 | The tab strip and header links live in `site-header.tsx`, rendered by the locale layout, outside any office subtree, so React context cannot reach them. | No context flag and no change to `site-header.tsx`. The provider adds a capture-phase `click` listener on `document` that calls `event.preventDefault()` on same-origin anchors when the draft is non-empty and the user declines. Next's `Link` returns early on `e.defaultPrevented` (`node_modules/next/dist/client/app-dir/link.js:310`), so the soft navigation never starts. Plus `beforeunload`. Back/forward is not guarded; accepted. |
| 5 | The spec suggests revalidating the layout for the notice. `SiteNoticeBar` is only rendered by `[locale]/page.tsx:30` and `[locale]/appointments/page.tsx:28`, not the layout. | Page revalidations only; the `[path, "layout"]` tuple form stays supported but unused. |
| 6 | `api-guard.test.ts:98` asserts `routes.length > 4`. The suite goes red on the fourth route deletion. | Task 3 relaxes it to `expect.arrayContaining(["books", "uploads"])`; Task 11 tightens to exactly `["books", "uploads"]`. |
| 7 | `styles/route.ts:17` checks existence with `allLiveStyles()`. Once that excludes retired styles, a `restore` followed by a `style-override` in the same batch would be refused. | Actions check existence with `manageableStyles()` (includes retired) and apply changes in array order. |
| 8 | `styleOverrideSchema` is a whole-record replacement (published, stock, addedPhotos, coverSrc). | The editor always stages the full override built from the draft-applied row, and when it restages a key it carries the earlier entry's `files`/`withUploads` forward. One helper, `stageOverride(row, patch)`. |
| 9 | React 19: state updates after the first `await` inside `startTransition(async ...)` are not part of the transition (documented limitation). | The provider wraps the post-await `dispatch` in a nested `startTransition`, so the draft shrinking and the revalidated props commit together. |
| 10 | `slugify` is duplicated in `styles/route.ts:39` (max 50) and `fabrics/route.ts:31` (max 40); `CUSTOMIZATION_EXTRA` is duplicated in `styles/route.ts:112` and `live-pricing.ts:64`. | `src/lib/slugify.ts` with `slugify(name, max)`; `export` the constant from `live-pricing.ts`. |
| 11 | `useOptimistic` and a persistent draft overlay overlap: the overlay already shows the pending value until the action settles. | `useOptimistic` holds the per-key "confirming" set (reverts to empty when the transition ends), which is what the rows and the bar use to show "Confirmando". The visible rollback of a failed change is simply the failed entry staying in the draft with its error. No second copy of the rows. |
| 12 | `collection/[slug]/page.tsx:54` uses `liveStyles()`, so a retired style becomes 404 as soon as `allLiveStyles()` drops retired ids. `generateStaticParams` still lists the seeded slug but the locale tree is `force-dynamic`, so the request-time 404 stands. | Nothing to do; confirm in the browser. |
| 13 | `sticky bottom-0` only pins while the tab is taller than the viewport; on a short tab the bar sits under the content. | Accept (the layout already reserves `pb-28`). Render `null` when `count === 0` so no empty strip appears. |
| 14 | Error-code text: not every code will have a message. | `t.has(\`error.${code}\`) ? t(\`error.${code}\`) : t("updateFailed")` (next-intl 3 has `t.has`). |

---

## B. Task list, in commit order

Each task = one commit; the suite is green after each. Commands per task: `npm run typecheck && npm test`; browser checks listed where they apply. Paths are absolute under `/Users/genel/Mirror/Daysi-Collection-Website-/`.

### Task 1: `isSameOriginHeaders`

**Modify** `src/lib/security.ts`
```ts
export type HeaderReader = { get(name: string): string | null };
export function isSameOriginHeaders(headers: HeaderReader): boolean  // body moved verbatim from isSameOrigin
export function isSameOrigin(request: Request): boolean { return isSameOriginHeaders(request.headers); }
```
**Modify** `src/lib/security.test.ts`, new `describe("same-origin, from headers alone")`:
- origin `http://shop.test` with host `shop.test` -> true
- origin `http://evil.test` with host `shop.test` -> false
- neither origin nor referer -> false
- referer only, same host -> true
- `x-forwarded-host` wins over `host`
Use `new Headers({...})` as the reader.

### Task 2: `ownerAction` and its test

**Create** `src/lib/action-guard.ts`
```ts
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { z, ZodTypeAny } from "zod";
import { officeDenial, type OfficeDenial } from "./api-guard";
import { isSameOriginHeaders } from "./security";
import { currentViewer } from "./auth/session";

export type ActionError = OfficeDenial["error"] | "failed";
export type ActionResult<T extends object> = ({ ok: true } & T) | { ok: false; error: ActionError };
export type Revalidation = string | readonly [path: string, type: "page" | "layout"];
export type ChangeResult = { readonly key: string; readonly ok: boolean; readonly error?: string };

export function ownerAction<Schema extends ZodTypeAny, T extends object>(
  schema: Schema,
  handle: (data: z.infer<Schema>) => Promise<T>,
  options: { readonly revalidate: readonly Revalidation[] },
): (input: unknown) => Promise<ActionResult<T>>;

/** Thrown inside a per-change handler to refuse one change with a code the row can show. */
export class ChangeRefused extends Error { constructor(readonly code: string) { super(code); } }

/** Runs `apply` over the changes in order; one failure never stops the rest. */
export async function applyEach<C extends { readonly key: string }>(
  changes: readonly C[],
  apply: (change: C) => Promise<void>,
): Promise<{ results: ChangeResult[] }>;
```
`ownerAction` body: `const h = await headers(); sameOrigin = isSameOriginHeaders(h); viewer = sameOrigin ? await currentViewer() : null; parsed = schema.safeParse(input); denial = officeDenial({ sameOrigin, role: viewer?.role ?? null, bodyValid: parsed.success }); if (denial) return { ok: false, error: denial.error }; try { data = await handle(parsed.data) } catch { return { ok: false, error: "failed" } }; for each revalidation: string -> revalidatePath(p, "page"), tuple -> revalidatePath(p, type); return { ok: true, ...data }`.
`applyEach`: `ChangeRefused` -> `{ key, ok: false, error: code }`; any other throw -> `error: "failed"`.

**Create** `src/lib/action-guard.test.ts` with `vi.mock("next/headers")` (returns a `Headers` the test sets), `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))`, `vi.mock("@/lib/auth/session", () => ({ currentViewer: vi.fn() }))`. Cases:
- cross-origin: `{ ok:false, error:"bad-origin" }`, `currentViewer` not called, handler not called
- same-origin, client role: `not-found`, handler not called
- same-origin, owner, bad body: `invalid`, handler not called
- owner + valid: handler called with parsed data (a `.default()` filled in), result spreads `{ ok:true, ...data }`, `revalidatePath` called once per pattern with `"page"`, tuple form passes its type
- handler throws: `{ ok:false, error:"failed" }`, `revalidatePath` never called
- `applyEach`: refused code preserved; generic throw becomes `failed`; the change after a failure still runs; results are in input order
- structural scan of `src/app/[locale]/office/**/actions.ts` (added here but tolerant of zero files until Task 6; see Task 11 for the exact-set assertion): for each file, first non-comment line is `"use server";`, imports `@/lib/action-guard`, every `export` is `export const <name> = ownerAction(`, no `export async function`, no `isSameOrigin`, `bad-origin`, `currentViewer(` or `role !==` in the file.

### Task 3: change unions in `office-validation.ts`

**Modify** `src/lib/office-validation.ts`. Add:
```ts
const uploadPath = z.string().regex(/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/);
export const changeKey = z.string().regex(/^[a-z-]+:[A-Za-z0-9._-]+$/).max(120);
const cents = z.number().int().min(0).max(5_000_00);
const fabricCents = z.number().int().min(1_00).max(5_000_00);
const id = z.string().trim().min(1).max(60);

export const retireChangeSchema  = z.object({ type: z.literal("retire"),  key: changeKey, id });
export const restoreChangeSchema = z.object({ type: z.literal("restore"), key: changeKey, id });

export const collectionChangeSchema = z.discriminatedUnion("type", [
  styleOverrideSchema.extend({ type: z.literal("style-override"), key: changeKey }),
  styleCreateSchema.extend({ type: z.literal("style-create"), key: changeKey }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const galleryWorkSchema = z.object({           // moved from gallery/route.ts addSchema
  src: uploadPath, width: z.number().int().min(1).max(20000), height: z.number().int().min(1).max(20000),
  category: z.enum(["runway","commissions","bridal","accessories","press","workroom"]),
  caption: z.string().trim().max(200),
});
export const galleryChangeSchema = z.discriminatedUnion("type", [
  galleryWorkSchema.extend({ type: z.literal("work-add"), key: changeKey }),
  z.object({ type: z.literal("work-visibility"), key: changeKey, id, hidden: z.boolean() }),
  retireChangeSchema,
  restoreChangeSchema,
]);

export const fabricSchema = z.object({ ... })          // moved verbatim from fabrics/route.ts, uses fabricCents
export const fabricChangeSchema = z.discriminatedUnion("type", [
  fabricSchema.extend({ type: z.literal("fabric-add"), key: changeKey }),
]);

export const priceChangeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("entry"),       key: changeKey, id: z.string().max(80), fixedPrice: cents, customizationExtra: cents }),
  z.object({ type: z.literal("alteration"),  key: changeKey, id: z.string().max(80), fixedPrice: cents, rushSurcharge: cents }),
  z.object({ type: z.literal("appointment"), key: changeKey, id: z.string().max(80), fee: cents }),
]);

export const shopfrontChangeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("notice"), key: changeKey, message: z.string().trim().max(200), visible: z.boolean() }),
]);

export const workChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("request-status"), key: changeKey,
    kind: z.enum(["alteration","order","commission","appointment","contact","premiere-signup"]),
    reference: z.string().trim().min(1).max(40),
    status: z.enum(["new","answered","scheduled","paid","closed"]),
  }),
]);

export const changesOf = <S extends ZodTypeAny>(schema: S) => z.array(schema).min(1).max(50);
export type CollectionChange = z.infer<typeof collectionChangeSchema>;  // and GalleryChange, FabricChange, PriceChange, ShopfrontChange, WorkChange
```
**Modify** `src/lib/office-validation.test.ts`: one accept and one refuse per member (12 members) plus: `changesOf` refuses `[]` and 51 items; a wrong `type` is refused; a key without a colon is refused; `work-add` refuses `width: 0`; `fabric-add` refuses empty `prices` and a price under $1; `entry` refuses `5_000_01`; `request-status` refuses status `"done"`.
**Modify** `src/lib/api-guard.test.ts:97-99` -> `expect(routes.map((r) => r.name)).toEqual(expect.arrayContaining(["books", "uploads"]))`.
**Create** `src/lib/slugify.ts`: `export function slugify(name: string, max: number): string` (body from `styles/route.ts:39-47` with `.slice(0, max)`); 3 cases in `src/lib/slugify.test.ts` (accents stripped, punctuation to one dash, truncation). **Modify** `src/lib/live-pricing.ts:64`: `export const CUSTOMIZATION_EXTRA`.

### Task 4: draft primitives

**Create** `src/components/office/draft-reducer.ts` (pure, no React):
```ts
import type { ChangeResult } from "@/lib/action-guard";   // type-only import, safe in node
export type DraftEntry<Change> = { readonly key: string; readonly change: Change; readonly error?: string };
export type DraftStatus = "idle" | "confirming" | "failed";
export type DraftState<Change> = { readonly entries: readonly DraftEntry<Change>[]; readonly status: DraftStatus; readonly error?: string };
export type DraftAction<Change> =
  | { type: "stage"; key: string; change: Change }
  | { type: "unstage"; key: string }
  | { type: "discard" }
  | { type: "confirming" }
  | { type: "settled"; results: readonly ChangeResult[] }
  | { type: "refused"; error: string };
export const emptyDraft: DraftState<never>;
export function draftReducer<Change>(state: DraftState<Change>, action: DraftAction<Change>): DraftState<Change>;
export function pendingIn<Change>(state: DraftState<Change>, key: string): DraftEntry<Change> | undefined;
```
Rules: `stage` on an existing key replaces in place (keeps position, clears `error`); on a new key appends. `settled` drops keys whose result is `ok`, keeps the others with `error` (a key missing from `results` is kept as `"failed"`), status `idle` if nothing is left else `failed`. `refused` keeps everything, status `failed`, `error` set. `discard` -> `emptyDraft`.

**Create** `src/components/office/draft-reducer.test.ts`: stage appends and counts; restage replaces in place and keeps order; unstage removes only that key; discard empties and clears status; settled removes ok keys, keeps failed with the reason, status `failed`; settled with all ok -> `idle`; refused keeps entries and sets `error`; staging a failed key clears its error; `pendingIn` finds by key. Also one `it` that `es.json` and `en.json` `office` both hold the keys added below (`pendingMark`, `changesPending`, `confirmChanges`, `confirming`, `discardChanges`, `leaveUnconfirmed`, `removePending`) and none contains an em dash (same pattern as `tabs.test.ts:34-44`).

**Create** `src/components/office/use-office-draft.tsx` (client):
```ts
export type DraftChange<Wire> = {
  readonly wire: Wire;
  readonly files?: readonly File[];
  readonly withUploads?: (srcs: readonly string[]) => Wire;
};
export type ApplyChanges<Wire> = (changes: Wire[]) => Promise<ActionResult<{ results: ChangeResult[] }>>;
export function OfficeDraftProvider<Wire>({ apply, children }: { apply: ApplyChanges<Wire>; children: ReactNode }): JSX.Element;
export function useOfficeDraft<Wire>(): {
  stage(key: string, change: DraftChange<Wire>): void;
  unstage(key: string): void;
  discard(): void;
  confirm(): void;
  pending(key: string): (DraftEntry<DraftChange<Wire>> & { confirming: boolean }) | undefined;
  readonly entries: readonly DraftEntry<DraftChange<Wire>>[];
  readonly count: number;
  readonly status: DraftStatus;
  readonly error?: string;
};
```
Provider internals: `useReducer(draftReducer, emptyDraft)`; `const [confirming, markConfirming] = useOptimistic<ReadonlySet<string>, readonly string[]>(EMPTY, (_, keys) => new Set(keys))`; `useTransition`. `confirm()`:
```
startTransition(async () => {
  dispatch({ type: "confirming" }); markConfirming(keys);
  const wires: Wire[] = []; const uploadFailures: ChangeResult[] = [];
  for (const entry of entries) {
    try {
      const srcs = entry.change.files ? await Promise.all(entry.change.files.map(uploadPhoto)) : [];
      wires.push(entry.change.files && entry.change.withUploads ? entry.change.withUploads(srcs) : entry.change.wire);
    } catch { uploadFailures.push({ key: entry.key, ok: false, error: "upload-failed" }); }
  }
  const result = wires.length > 0 ? await apply(wires) : { ok: true as const, results: [] };
  startTransition(() => dispatch(result.ok
    ? { type: "settled", results: [...result.results, ...uploadFailures] }
    : { type: "refused", error: result.error }));
});
```
Leave guard `useEffect` keyed on `count > 0`: `beforeunload` (`preventDefault` + `returnValue = ""`), and a capture-phase `document` click listener: find `closest("a[href]")`, skip modified clicks, `target="_blank"`, other origins, same pathname; otherwise `if (!window.confirm(t("leaveUnconfirmed"))) event.preventDefault()`. Renders `{children}` then `<ConfirmBar count status error onConfirm={confirm} onDiscard={discard} />`.

**Create** `src/components/office/confirm-bar.tsx` (client):
```ts
export function ConfirmBar(props: { count: number; status: DraftStatus; error?: string; onConfirm(): void; onDiscard(): void }): JSX.Element | null;
export function Pending(props: { confirming?: boolean; error?: string }): JSX.Element;
```
Bar: `null` when `count === 0`; otherwise `<div role="status" className="sticky bottom-0 z-30 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-paper/95 py-3 backdrop-blur-md">` with `t("changesPending", { count })`, an outline `discardChanges` button, a solid `confirmChanges` button (`disabled` while `status === "confirming"`, label `confirming`), and the error line via the `t.has` fallback from A.14 when `status === "failed" && error`. `Pending`: small uppercase marigold mark `pendingMark`; with `error` it turns `text-ink` and appends the error text; with `confirming` it shows `confirming`.

**Modify** `src/messages/es.json` and `en.json` (`office`): `pendingMark` "pendiente"/"pending", `changesPending` `"{count, plural, one {# cambio sin confirmar} other {# cambios sin confirmar}}"`, `confirmChanges` "Confirmar cambios", `confirming` "Confirmando…", `discardChanges` "Descartar", `leaveUnconfirmed` "Tiene cambios sin confirmar. ¿Salir de todos modos?", `removePending` "Quitar", and `error` object: `bad-origin`, `not-found` ("Su sesión terminó. Entre otra vez y vuelva a intentarlo."), `invalid`, `failed`, `upload-failed`. No em dashes.

Verify: typecheck, tests. Nothing renders yet.

### Task 5: retired lib and the assemble parameters

**Create** `src/lib/retired.ts` (reads/writes through `records.ts`, so `store-paths.test.ts` needs nothing):
```ts
export type RetiredKind = "style" | "gallery";
export type RetiredRecord = { readonly kind: RetiredKind; readonly id: string; readonly retired: boolean; readonly at: string };
const RETIRED = "retired";
export function retiredKey(kind: RetiredKind, id: string): string;          // `${kind}:${id}`
export function retiredSet(kind: RetiredKind): Set<string>;                // ids whose newest record for that kind has retired === true
export async function setRetired(kind: RetiredKind, id: string, retired: boolean): Promise<void>;
```
**Create** `src/lib/retired.test.ts` (temp `DATA_DIR` + `vi.resetModules()` + dynamic import, as `records.test.ts` does): empty set at first; retire -> present; retire then restore -> absent; restore after retire after retire -> absent; kinds do not bleed (`style:x` retired, `retiredSet("gallery")` empty); `retiredKey` shape.

**Modify** `src/lib/live-catalog.ts`:
- `assembleStyles(seed, added, overrides, retired: ReadonlySet<string> = new Set())` filters `!retired.has(style.id)` after the merge.
- `allLiveStyles()` passes `retiredSet("style")`.
- New `export function manageableStyles(): (GarmentStyle & { retired: boolean })[]` = `assembleStyles(styles, addedStyles(), styleOverrides())` flagged with `retiredSet("style")`.
**Modify** `src/lib/assemble-styles.test.ts`: retired seeded id is dropped; retired added id is dropped; empty set changes nothing; `manageableStyles` is not unit tested (reads disk).

**Modify** `src/lib/live-gallery.ts`:
- `assembleGallery(seed, added, visibility, retired: ReadonlySet<string> = new Set())` filters retired.
- `liveGallery()` passes `retiredSet("gallery")`.
- `manageableGallery(): (GalleryWork & { hidden: boolean; retired: boolean })[]`, assembled with empty visibility and empty retired, then flagged from both stores.
**Modify** `src/lib/live-gallery.test.ts`: retired seeded work dropped; retired added work dropped; a hidden-and-retired work dropped once, no crash.

**Create** `src/components/office/retired-group.tsx` (client):
```ts
export type RetiredItem = { readonly id: string; readonly name: string; readonly photo?: string };
export function RetiredGroup(props: { items: readonly RetiredItem[]; restoreKey(id: string): string; onRestore(id: string): void }): JSX.Element;
export function RetireButton(props: { name: string; onConfirm(): void }): JSX.Element;
```
`RetiredGroup`: `<details>` with `<summary>{t("retiredGroup", { count })}</summary>`; `retiredEmpty` when empty; each row shows name (+ 3rem thumb when `photo`), and either a `restore` button or `<Pending>` when `pending(restoreKey(id))`. `RetireButton`: two-tap inline confirm; first tap swaps the button for `retireConfirm {name}` with `retireYes` / `retireNo`; `Escape` or `retireNo` cancels.
**Modify** messages (`office`): `retire` "Retirar", `retireConfirm` "¿Retirar {name}? Sale del sitio. Puede restaurarla desde Retirados.", `retireYes` "Sí, retirar", `retireNo` "No", `restore` "Restaurar", `retiredGroup` `"{count, plural, =0 {Retirados} other {Retirados (#)}}"`, `retiredEmpty` "No hay nada retirado.", and error codes `unknown-style`, `unknown-work`.

Verify: typecheck, tests. Behaviour unchanged (nothing is retired yet).

### Task 6: Collection tab (reference conversion) and delete `api/office/styles`

**Create** `src/app/[locale]/office/collection/actions.ts`:
```ts
"use server";
export const applyCollectionChanges = ownerAction(
  changesOf(collectionChangeSchema),
  async (changes) => applyEach(changes, async (change) => { switch (change.type) { ... } }),
  { revalidate: ["/[locale]/office/collection", "/[locale]", "/[locale]/collection", "/[locale]/collection/[slug]", "/[locale]/prices", "/[locale]/request"] },
);
```
Cases: `style-override` -> `manageableStyles().some(id)` else `throw new ChangeRefused("unknown-style")`, then `saveStyleOverride` (strip `type`/`key`). `style-create` -> body from `styles/route.ts:50-104` verbatim, `NextResponse` errors become `ChangeRefused("unknown-fabric" | "no-sizes" | "price-required")`, `slugify(draft.name, 50)`, `CUSTOMIZATION_EXTRA` imported. `retire` -> existence via `manageableStyles()`, `setRetired("style", id, true)`. `restore` -> `setRetired("style", id, false)`.

**Modify** `src/app/[locale]/office/collection/page.tsx`: `manageableStyles()` instead of `allLiveStyles()`; map to `ManagedStyle` (add `retired: boolean`); split `active`/`retired`; wrap the section's children in `<OfficeDraftProvider apply={applyCollectionChanges}>`; pass `retired` to `CollectionManager`.

**Modify** `src/components/collection-manager.tsx`: drop `useRouter`, `useState`, `postOffice`, `savedId`, `failedId`. `const draft = useOfficeDraft<CollectionChange>()`. Per row: `const entry = draft.pending(\`style:${row.id}\`)`; `view = entry?.change.wire.type === "style-override" ? applied(row, wire) : row`; a pending `retire` renders the row dimmed with `<Pending>` and a `removePending` link (unstage). `stageOverride(row, patch, extra?: { file: File; asCover: boolean })` builds the full wire `{ type: "style-override", key, styleId, isPublished, stock, addedPhotos, coverSrc }` from `view`, merges `files`/`withUploads` from the existing entry or from `extra` (`withUploads: ([src]) => ({ ...wire, addedPhotos: [...wire.addedPhotos, src], ...(asCover ? { coverSrc: src } : {}) })`). Size checkbox and shown/hidden checkbox call `stageOverride`; `addPhoto` calls it with `extra` (the `photoCoverAsk` confirm stays). Retire via `<RetireButton>` staging `{ type: "retire", key: \`style:${id}\`, id }`. After the list: pending `style-create` entries from `draft.entries` as rows (name, category, `<Pending>`, `removePending`). Then `<RetiredGroup items={retired} restoreKey={(id) => \`style:${id}\`} onRestore={(id) => draft.stage(...restore...)}/>`. `collectionNote` count uses the draft-applied published count.

**Modify** `src/components/style-composer.tsx`: drop `useRouter`, `postOffice`, `SaveState`; keep the three client validations; `submit` stages `style-create:${crypto.randomUUID()}` with `wire` (photos `[]`), `files: files.slice(0, 8)`, `withUploads: (srcs) => ({ ...wire, photos: [...srcs] })`, then resets the form; the button label becomes `styleSave` reworded (Task 12); the `styleSaved`/`updateFailed` spans go (the bar and the pending row report).

**Delete** `src/app/api/office/styles/route.ts` (and its directory).

Verify: typecheck, tests (structural scan now finds one file), `grep -rn "api/office/styles" src` empty. Browser as owner on `/es/office/collection`: untick a size, the row shows "pendiente" and the bar reads "1 cambio sin confirmar"; tick it back, the bar disappears (equal to base -> `unstage`; implement that in `stageOverride`: if the built wire equals the base row, unstage); untick two sizes on two rows -> 2; Descartar clears both; confirm -> rows settle, `/es/collection/<slug>` shows the size as made-to-order; retire a seeded style -> confirm -> it moves to Retirados, `/es/collection/<slug>` is 404, Restaurar + confirm brings both back; add a garment -> pending row, confirm -> uploads happen only now (network tab), garment appears; click a header tab with a non-empty draft -> prompt, cancel stays.

### Task 7: Gallery tab, delete `api/office/gallery`

**Create** `src/app/[locale]/office/gallery/actions.ts`: `applyGalleryChanges = ownerAction(changesOf(galleryChangeSchema), ..., { revalidate: ["/[locale]/office/gallery", "/[locale]/gallery"] })`. `work-add` -> `addGalleryWork({ id: newReference("GAL").toLowerCase(), src, width, height, category, caption: { en, es } })`; `work-visibility` -> existence via `manageableGallery()` else `unknown-work`, `setGalleryVisibility`; `retire`/`restore` -> `setRetired("gallery", ...)`.
**Modify** `gallery/page.tsx`: `retired` flag on `ManagedWork`, split lists, provider, pass `retired`.
**Modify** `src/components/gallery-manager.tsx`: no `rows` state, no router, no fetch. Card checkbox stages `{ type: "work-visibility", key: \`gallery:${id}\`, id, hidden }` (unstage when equal to base). `<RetireButton>` per card stages retire. Add form: on submit, `createImageBitmap(file)` for width/height, stage `work-add:${uuid}` with `wire.src = ""`, `files: [file]`, `withUploads: ([src]) => ({ ...wire, src })`, keep an object URL in the entry for the pending card (store it in component state keyed by entry key; revoke on unstage/settle), reset the form. Pending `work-add` entries render as extra cards with `<Pending>` and `removePending`. `<RetiredGroup>` under the grid.
**Delete** `src/app/api/office/gallery/route.ts`.
Browser: hide a card and add a photo in one draft -> bar says 2; confirm -> both land; `/es/gallery` reflects both; retire + restore round-trip.

### Task 8: Prices tab, delete `api/office/prices`

**Create** `prices/actions.ts`: `applyPriceChanges` with the three cases from `prices/route.ts:32-57` (unknown -> `ChangeRefused("unknown-entry" | "unknown-alteration" | "unknown-appointment")`), revalidate `["/[locale]/office/prices", "/[locale]/prices", "/[locale]/alterations", "/[locale]/appointments", "/[locale]/design-studio", "/[locale]/request", "/[locale]/collection/[slug]", "/[locale]/cart", "/[locale]/office/collection"]`.
**Modify** `prices/page.tsx`: provider around `<PriceManager>`.
**Modify** `src/components/price-manager.tsx`: `PriceTable` gets `toChange(id, cents): PriceChange` instead of `toBody`; keeps a local `typing: Record<string, string[]>` for what is in the inputs; on change, parse cents; if any value is not finite or negative do nothing; if equal to `row.amounts` -> `unstage(key)`, else `stage(key, { wire: toChange(row.id, cents) })` with `key = \`${type}:${row.id}\``; shown value = `typing[row.id] ?? (pending ? amounts from pending wire : row.amounts)`; clear `typing` on blur and whenever `draft.count === 0` (an effect). The save button and `state` map go; the right-hand cell shows `<Pending confirming error>` when pending. Add error messages `unknown-entry`, `unknown-alteration`, `unknown-appointment`.
**Delete** `src/app/api/office/prices/route.ts`.
Browser: change two prices in two tables -> one bar with 2; typing "12." does not snap; confirm -> `/es/prices` shows both.

### Task 9: Fabrics tab, delete `api/office/fabrics`

**Create** `fabrics/actions.ts`: `applyFabricChanges`; body from `fabrics/route.ts:41-55` with `slugify(draft.name, 40)`, `invalid()` -> `ChangeRefused("invalid")`; revalidate `["/[locale]/office/fabrics", "/[locale]/design-studio", "/[locale]/prices", "/[locale]/office/collection", "/[locale]/office/prices"]`.
**Modify** `fabrics/page.tsx`: provider.
**Modify** `src/components/fabric-manager.tsx`: on submit compute `averageColorOf(file)` and the price map now (client checks stay), stage `fabric-add:${uuid}` with `wire.swatchImage = ""`, `files: [file]`, `withUploads: ([src]) => ({ ...wire, swatchImage: src })`; pending entries render as extra swatches (object URL) with `<Pending>` and `removePending`; form resets; `state`/router go.
**Delete** `src/app/api/office/fabrics/route.ts`.
Browser: add a fabric, Descartar -> no upload request was made; add again, confirm -> one `/api/office/uploads` POST then the action; swatch appears; it appears in `/es/design-studio`.

### Task 10: Shopfront tab, delete `api/office/notice`

**Create** `shopfront/actions.ts`: `applyShopfrontChanges` -> `saveNotice({ message, visible })`; revalidate `["/[locale]/office/shopfront", "/[locale]", "/[locale]/appointments"]`.
**Modify** `shopfront/page.tsx`: provider around the notice section only (the QR needs nothing).
**Modify** `src/components/notice-editor.tsx`: no form submit button; textarea/checkbox changes stage `{ type: "notice", key: "notice:site", message, visible }` when they differ from `initialMessage`/`initialVisible`, unstage when equal; `<Pending>` beside the checkbox when pending. Local `message`/`visible` state stays (it is the input value), reset to initial when `draft.count === 0` after a discard.
**Delete** `src/app/api/office/notice/route.ts`. Remove `saveNotice` message key.
Browser: type, bar appears; Descartar restores the text; confirm; `/es` shows the notice.

### Task 11: Work tab, delete `api/office/requests`, shrink `office-client.ts`, tighten the scans

**Create** `work/actions.ts`: `applyWorkChanges` from `requests/route.ts:22-34` (`unknown-reference`), revalidate `["/[locale]/office/work", "/[locale]/office", "/[locale]/office/books", "/[locale]/account", "/[locale]/account/orders"]`.
**Modify** `work/page.tsx`: one provider around all three lists and the sign-ups.
**Modify** `src/components/office-request-list.tsx`: drop router/busy/failed state; `select` value = pending status or `record.status`; `onChange` stages `{ type: "request-status", key: \`request:${reference}\`, kind, reference, status }` or unstages when back to the stored status; `<Pending>` under the summary. Add `unknown-reference` error message.
**Delete** `src/app/api/office/requests/route.ts`.
**Modify** `src/components/office-client.ts`: keep only `uploadPhoto`; remove `postOffice` and `SaveState`; rewrite the header comment.
**Modify** `src/lib/api-guard.test.ts`: routes assertion becomes `toEqual(["books", "uploads"])` (sorted). **Modify** `src/lib/action-guard.test.ts`: structural scan asserts the file set is exactly `collection, fabrics, gallery, prices, shopfront, work` (sorted) and each exports exactly one `apply<Tab>Changes`.
Verify: `grep -rn "router.refresh\|postOffice\|/api/office/" src` shows only `office-client.ts` (`uploads`) and `books-export.tsx`. Browser: change two statuses across Work and Sessions -> one bar; confirm; Today's figures and `/es/account/orders` (as the client) reflect it.

### Task 12: copy and the manual

**Modify** `src/messages/{es,en}.json` (`office`), sentences that promise instant saves: `collectionNote` ("... Los cambios entran al sitio cuando usted los confirma en la barra de abajo."), `pricesLead` ("Un cambio entra en vivo en cuanto lo confirma."), `styleAddLead`, `galleryLead`, `fabricsLead` as needed; `styleSave` -> "Agregarla a los cambios", `gallerySave` -> "Agregarla a los cambios", `fabricSave` -> "Agregarla a los cambios"; remove now-unused `saving`, `saved`, `savePrice`, `saveNotice`, `styleSaved`, `gallerySaved`, `fabricSaved` (grep each before deleting; `updateFailed` and `booksWorking` stay). No em dashes.
**Modify** `docs/manual-del-taller.html`:
- `#entrar`: one paragraph after the steps, "Confirmar cambios": every tab collects what she touches, marks it "pendiente", a bar at the bottom counts the changes, nothing reaches the site until she taps Confirmar cambios; Descartar throws the draft away; leaving with pending changes asks once.
- `#precios` step 3 and note ("El cambio es inmediato" -> "en cuanto lo confirma"), `#prenda` step (button name + "y luego Confirmar cambios"), `#telas` step 5, `#trabajo` step 5 and a new step "Para sacar una foto del todo, Retirar; vuelve desde Retirados con Restaurar", `#perchero` new step for Retirar/Restaurar and the note, `#aviso` step 4, `#pedidos` a sentence about confirming.

### Task 13: full verification

`npm run typecheck && npm test && npm run build`; `npm run dev` + `npm run smoke` (private checks unchanged, 10 office paths); grep from Task 11; `git grep -n "—" src/messages docs/manual-del-taller.html` shows nothing new. Browser pass as owner across all six tabs (one draft each, prompt on leaving, partial failure: point `DATA_DIR` at a read-only directory, confirm two changes, both rows show the error and stay pending, the bar stays); as the same owner signed out in another tab, confirm -> bar shows the `not-found` text, draft kept; as a client, every office path is 404; network shows no call to any deleted route.

---

## C. Sequencing notes

- Tasks 1 to 5 touch no editor and change no behaviour; they can land as one PR or one commit each.
- Tasks 6 to 11 each delete one route in the same commit as the editor that used it, which is what keeps both scans green at every commit.
- `office-client.ts` keeps `postOffice` until Task 11 because the not-yet-converted editors still import it.
- The `today` and `books` tabs are untouched.

### Critical Files for Implementation
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/action-guard.ts (new; `ownerAction`, `applyEach`, `ChangeRefused`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/office-validation.ts (six change unions, `changesOf`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/components/office/use-office-draft.tsx (provider, hook, confirm flow, leave guard) with /Users/genel/Mirror/Daysi-Collection-Website-/src/components/office/draft-reducer.ts
- /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/live-catalog.ts and /Users/genel/Mirror/Daysi-Collection-Website-/src/lib/retired.ts (retired set, `manageableStyles`)
- /Users/genel/Mirror/Daysi-Collection-Website-/src/components/collection-manager.tsx (the reference conversion every other editor copies)
