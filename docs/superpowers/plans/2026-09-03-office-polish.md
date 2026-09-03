# Office Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the small findings the step 2 and step 3 reviews left behind: the tab strip follows the active tab on a phone, the gallery button copy is pinned, a change staged during a confirm is not marked failed, an unreadable photo says so instead of hanging, the Shopfront bar pins like the other tabs, undo never offers a Stripe-written line and never drops photos, `retiredSet` is read once per render, and the unused `retired:*` undo kinds are gone.

**Architecture:** No new layer. Nine contained edits across the office client components, the draft reducer, the undo registry (`office-history.ts`), the request store, and the tombstone reader; every change goes through the existing draft and confirm bar. One new client module (`image-reads.ts`) so the two bitmap reads can be unit-tested in node.

**Tech Stack:** Next.js 15.5.25 App Router server actions, React 19.1.9, next-intl 3.26.5, zod 3, vitest 3 (`environment: node`, no React test renderer), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md` (Design 3, Amendments 1 and 2). Source of the items: `docs/superpowers/plans/2026-09-03-next-session.md` section 2.

## Global Constraints

- Next stays pinned at `15.5.25`, React at `19.1.9`; `package.json` untouched on this branch.
- Nothing writes without "Confirmar cambios": every edit here stages into the draft or is a read.
- Nothing is physically deleted; a status line is only ever appended.
- The Stripe webhook keeps its raw `listRequests` read; this plan adds one field to the line it writes and nothing else.
- No em dashes in any user-facing string; both bundles (`src/messages/es.json`, `src/messages/en.json`) keep identical `office` key sets (Task 1 adds the test that enforces it).
- Each task is one commit and leaves `npm run typecheck && npm test` green.
- Tests first: each task's test is written and seen failing before the change, except Task 1, which is a test only.
- Deploy is `npm run deploy`, run by the user, never by the agent.
- The manual's font finding (`.impeccable/config.json`) is out of this plan.
- Commit messages: a plain sentence saying what changed and why, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Plan agent's design: nine contained fixes, lowest risk first

**Branch:** `office-polish` off `main` (rebased onto `758f665`, the merge of PR #25, before task 1). All paths below are under `/Users/genel/Mirror/Daysi-Collection-Website-/`.

## A. Findings in the current code that shape the plan

| # | What is awkward | Smallest fix |
|---|---|---|
| 1 | The gallery labels are already fixed: `gallerySave` reads "Agregarla a los cambios" / "Add it to the changes" (es.json:575, en.json:575) and `gallerySaved` exists in neither bundle (the step 2 plan's copy task did both). The next-session note and `docs/next-steps.md` are stale. No test pins the label, and no test checks that the two bundles have the same `office` keys (only ad hoc key lists in `draft-reducer.test.ts` and `tabs.test.ts`). | Task 1 is a test only: pin the label, assert `gallerySaved` is absent, and add the key-parity check the constraints block has been promising. |
| 2 | `scrollIntoView({ inline: "nearest" })` alone leaves `block` at its default `"start"`, so every tab change would also scroll the page vertically until the strip sits at the top. | The effect passes `{ inline: "nearest", block: "nearest" }` and runs on `[pathname]`; the active link is found from a ref on the `<nav>` by `a[aria-current="page"]`, so nothing about `Link` changes. |
| 3 | `shopfront/page.tsx:37-43` puts `OfficeDraftProvider` inside the first `<section>`, so the `sticky bottom-0` bar (confirm-bar.tsx:32) is stuck to that section's box and scrolls away over the QR section. `work/page.tsx:38-69` wraps everything in the provider and its bar sits in the layout's `div.shell flex flex-col` (layout.tsx:29), which is the whole tab. | Return `<OfficeDraftProvider>` wrapping both sections, exactly the Work shape. `NoticeEditor` and its props do not change. |
| 4 | `draftReducer` `settled` (draft-reducer.ts:45-53) walks every entry and marks any key missing from `results` as `"failed"`. `confirm` in `use-office-draft.tsx:73-74` already computes `keys` for the batch and discards it after `markConfirming`. | The `settled` action carries `keys`; entries not in `keys` are left as they are; status is `"failed"` only when a sent key failed, otherwise `"idle"` (or `emptyDraft` when nothing is left). A key restaged with the same key during the confirm is still replaced by its result; that edge is not in this plan. |
| 5 | `office.error.upload-failed` exists in both bundles (es.json:510, en.json:510) and `ErrorText` (confirm-bar.tsx:7-11) is the display path with the `updateFailed` fallback. `gallery-manager.tsx:72` awaits `createImageBitmap` with no catch and has no form error state at all; `fabric-manager.tsx:71-94` defines `averageColorOf` inline and its `formError` is a boolean rendered through an inline `t.has("error.invalid")` check. A source scan cannot exercise a rejected decode. | Move the two reads into `src/components/office/image-reads.ts` returning `undefined` on a rejected decode, unit-tested in node with stubbed globals; both forms show `<ErrorText code="upload-failed" />` under the submit button and keep the chosen file so she can pick another. |
| 6 | Nothing distinguishes a Stripe status line from an office one: `work/actions.ts:17` writes `saveRequest({ ...record, status })` and `webhook/route.ts:49` writes `saveRequest({ ...record, status: "paid" })`; `StoredRequest` (request-store.ts:47-68) has no author field. Because both spread the previous line, a new field would be inherited by whichever writer comes next unless every writer sets it explicitly. | `StoredRequest.source?: "office" \| "stripe"`. The work action writes `source: "office"`; the webhook writes `source: "stripe"` explicitly so the spread can never carry an office mark onto a Stripe line; client submissions (`notify.ts:126`) stay unmarked. The `request-status` stream gains an `undoable(latest)` hook: only a line with `source === "office"` may be undone, so a Stripe `paid` line and every line written before this ships are not offered. Rows whose newest line predates this deploy lose Deshacer until the office changes them again; the plan says so in the manual and in `next-steps.md`. |
| 7 | The style-override stream's `baseline` (office-history.ts:60-72) carries no `addedPhotos`, and `toChange` (73-81) copies the earlier line's own `addedPhotos`. Photos are only ever added (`overrideWire` in collection-manager.tsx:28-38 copies the newest list and `stageOverride` appends), so a confirmed undo writes a shorter list in both the one-line and the two-line case; the review's "stock tick plus photo" drop is the same hole twice. The controller asked for the baseline; fixing one case and not the other would leave the drop in the commoner one. | One rule in the stream: an undo change keeps every photo the newest line lists; `isPublished`, `stock` and `coverSrc` follow the reverted line (the baseline has no cover, so the coded primary leads again). The newest photos are read with `versionsOf(...).at(-1)`, one extra file read per click. |
| 8 | `retiredSet` reads and parses `retired.jsonl` on every call; a Work render calls it about twelve times (`loadLedger` 4, `activeRequests` 2, `manageableRequests` 6). React `cache` in the client build (`node_modules/react/cjs/react.development.js:893-897`) is `fn => (...args) => fn(...args)`, a pure passthrough; the react-server build (`react.react-server.development.js:554-584`) memoises through `ReactSharedInternals.A.getCacheForType`; Next's compiled runtime implements that as `resolveRequest() ? request.cache : new Map()`, so it memoises only inside a Flight render and hands out a fresh `Map` per call in a server action or a route handler. Vitest resolves `react` to `index.js` and so to the client build. | `export const retiredSet = cache((kind) => ...)` returning `ReadonlySet<string>` (every caller only calls `.has`). Write-then-read tests keep passing because the test build never memoises; an action that retires then reads in the same batch reads fresh because actions run outside a Flight request; the render after `revalidatePath` is a new request with an empty cache. Task 7's test pins the passthrough and proves the wrapper is applied under a memoising `cache`. |
| 9 | The `retired:*` undo kinds have no caller: the static `UndoLink` kinds are `style-override`, `work-visibility`, `notice`, `request-status`, and `price-manager.tsx:28-43` passes `price-entry`, `alteration`, `appointment`; the spec never names a `retired:` kind; `cc1fe32` added the `kind.startsWith("retired:")` branch in `undoableIds` only so those streams would count by id. | Drop the five kinds from `UNDO_KINDS`, delete `retiredPrefix`, `retiredStream`, the five `streamFor` cases and the `startsWith` branch; `previousChangeFor` tests for the seven remaining kinds stay. |
| 10 | The plan was drafted against `4e54f1e`; `main` has since taken #23 (vitest `3.2.4` to `3.2.7`), #24 (premieres fallback: new `premieres` and `home` keys in both bundles) and #25 (image delivery). None touches a file this plan edits except the two bundles outside `office`. | The branch was reset onto that `main` before task 1, so there is nothing to merge later. "package.json untouched" means untouched on this branch. |

## B. Task list, in commit order

Each task is one commit and leaves `npm run typecheck && npm test` green. Test files use the repo's conventions: `vitest`, `environment: node`, temp `DATA_DIR` plus `vi.resetModules()` plus dynamic import for store tests, source scans from disk for page-level checks (`src/components/office/tabs.test.ts`).

### Task 1: pin the gallery labels and the bundle key parity (test only)

- [ ] **Modify** `src/components/office/tabs.test.ts`. Add at the end of the file:

```ts
function officeKeys(bundle: { office: object }): string[] {
  const flatten = (value: object, prefix: string): string[] =>
    Object.entries(value).flatMap(([key, child]) =>
      child !== null && typeof child === "object" ? flatten(child, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  return flatten(bundle.office, "").sort();
}

describe("the office copy", () => {
  it("has the same keys in both languages", () => {
    expect(officeKeys(es)).toEqual(officeKeys(en));
  });

  it("names the gallery button after the draft, not the old tab name", () => {
    for (const bundle of [es, en]) {
      const office = officeMessages(bundle);
      expect(office.gallerySave).toBeTruthy();
      expect(office.gallerySave).not.toMatch(/Agregar al trabajo|Add to the work/);
      expect(office.gallerySave).not.toContain("—");
      expect("gallerySaved" in office, "gallerySaved was removed in step 2").toBe(false);
    }
  });
});
```

Both assertions pass today (133 flattened keys on each side; `gallerySave` is "Agregarla a los cambios" / "Add it to the changes"). No source change. Verify: `npm test`.

### Task 2: the tab strip follows the active tab on a phone

- [ ] **Test first.** **Modify** `src/components/office/tabs.test.ts`, new block:

```ts
describe("the tab strip on a phone", () => {
  it("scrolls the active tab into view without moving the page", () => {
    const strip = fs.readFileSync(path.join(process.cwd(), "src/components/office/office-tabs.tsx"), "utf8");
    expect(strip).toContain("useEffect(");
    expect(strip).toContain('a[aria-current="page"]');
    expect(strip).toContain('scrollIntoView({ inline: "nearest", block: "nearest" })');
    expect(strip).toContain("}, [pathname]);");
  });
});
```

- [ ] **Modify** `src/components/office/office-tabs.tsx`:
  - `import { useEffect, useRef } from "react";`
  - In `OfficeTabs`, after `const t = ...`:
    ```ts
    const navRef = useRef<HTMLElement>(null);
    useEffect(() => {
      const active = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      active?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    }, [pathname]);
    ```
  - `<nav ref={navRef} aria-label={t("tabsLabel")} className="overflow-x-auto">`.
  - Extend the doc comment's last paragraph with one sentence: after a tap near the right end the strip scrolls the new active tab into view; `block: "nearest"` keeps the page where it is.

Browser as owner at 375px: on `/es/office`, tap Libros (off the right edge): the strip scrolls so Libros is fully visible, the page does not jump vertically; tap Hoy: the strip scrolls back. Verify: typecheck, tests.

### Task 3: Shopfront wraps the whole tab in the draft provider

- [ ] **Test first.** **Modify** `src/components/office/tabs.test.ts`, inside `describe("the shopfront tab")`:

```ts
it("keeps both of its sections inside one draft provider, so the bar pins to the tab", () => {
  const source = read("shopfront/page.tsx");
  const open = source.indexOf("<OfficeDraftProvider");
  const close = source.indexOf("</OfficeDraftProvider>");
  expect(open).toBeGreaterThan(-1);
  expect(open).toBeLessThan(source.indexOf("<section"));
  expect(close).toBeGreaterThan(source.lastIndexOf("</section>"));
});
```

- [ ] **Modify** `src/app/[locale]/office/shopfront/page.tsx`: replace the returned fragment `<>...</>` with `<OfficeDraftProvider apply={applyShopfrontChanges}> ... </OfficeDraftProvider>` around both `<section>`s; `NoticeEditor` loses its inner provider and keeps its three props. Nothing else changes.

Browser: on `/es/office/shopfront` type a notice, scroll to the QR: the bar stays at the bottom of the viewport as it does on Trabajo. Verify: typecheck, tests.

### Task 4: `settled` only judges the keys that were sent

- [ ] **Test first.** **Modify** `src/components/office/draft-reducer.test.ts`:
  - Every existing `type: "settled"` dispatch gains `keys`: `["style:one", "style:two"]` in "settles successful keys...", `["style:one"]` in the other three.
  - New cases:
    ```ts
    it("leaves a key staged during the confirm alone", () => {
      const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
      const settled = draftReducer(state, {
        type: "settled",
        keys: ["style:one"],
        results: [{ key: "style:one", ok: true }],
      });
      expect(settled).toEqual({ entries: [{ key: "style:two", change: { value: "second" } }], status: "idle" });
    });

    it("keeps a failed sent key and an untouched key side by side", () => {
      const state = stage(stage(emptyDraft, "style:one", "first"), "style:two", "second");
      const settled = draftReducer(state, {
        type: "settled",
        keys: ["style:one"],
        results: [{ key: "style:one", ok: false, error: "in-use", count: 2 }],
      });
      expect(settled.status).toBe("failed");
      expect(settled.entries).toEqual([
        { key: "style:one", change: { value: "first" }, error: "in-use", count: 2 },
        { key: "style:two", change: { value: "second" } },
      ]);
    });
    ```
  - "marks a missing result as failed" keeps its meaning: `keys: ["style:one"], results: []` still yields `error: "failed"`.

- [ ] **Modify** `src/components/office/draft-reducer.ts`:
  - `| { type: "settled"; keys: readonly string[]; results: readonly ChangeResult[] }`
  - Case body:
    ```ts
    case "settled": {
      const sent = new Set(action.keys);
      const results = new Map(action.results.map((result) => [result.key, result]));
      let failed = false;
      const entries = state.entries.flatMap((entry) => {
        if (!sent.has(entry.key)) return [entry];
        const result = results.get(entry.key);
        if (result?.ok) return [];
        failed = true;
        return [{ ...entry, error: result?.error ?? "failed", count: result?.count }];
      });
      if (entries.length === 0) return emptyDraft;
      return { entries, status: failed ? "failed" : "idle" };
    }
    ```
- [ ] **Modify** `src/components/office/use-office-draft.tsx:103`: `{ type: "settled", keys, results: [...result.results, ...uploadFailures] }`. Typecheck enforces the new field; no other caller dispatches `settled`.

Browser: on Galería add a photo, press Confirmar, and while "Confirmando…" shows untick a second photo's "shown" box: after the confirm the added photo is gone from the list, the visibility change stays pending with no error, and the bar reads "1 cambio sin confirmar". Verify: typecheck, tests.

### Task 5: an unreadable photo says "upload-failed" instead of hanging

- [ ] **Test first.** **Create** `src/components/office/image-reads.test.ts`:
  - `afterEach(() => vi.unstubAllGlobals())`.
  - `readImageSize`: `vi.stubGlobal("createImageBitmap", async () => ({ width: 3, height: 4, close }))` with `close = vi.fn()` gives `{ width: 3, height: 4 }` and calls `close` once; `vi.stubGlobal("createImageBitmap", async () => { throw new Error("not an image"); })` gives `undefined`.
  - `readAverageColor`: with a resolved bitmap and `vi.stubGlobal("document", { createElement: () => canvas })` where `canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(400).fill(0x80) }) }) }` gives `"#808080"`; with `getContext: () => null` gives `"#8e8471"`; with a rejecting `createImageBitmap` gives `undefined`.
  - A `describe("the add forms")` source scan: for `src/components/gallery-manager.tsx` and `src/components/fabric-manager.tsx`, the source contains `from "./office/image-reads"`, contains `"upload-failed"`, contains `<ErrorText`, and does not contain `createImageBitmap(`.
  - Files are built as `new File([new Uint8Array(4)], "swatch.jpg", { type: "image/jpeg" })` (`File` is a Node global).

- [ ] **Create** `src/components/office/image-reads.ts` (no `"use client"` needed; it is only imported by client components):

```ts
/** Pixel size of an image file, or undefined when the browser cannot decode it. */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | undefined>
/** Average colour of the swatch as #rrggbb; "#8e8471" without a 2d context; undefined when the browser cannot decode it. */
export async function readAverageColor(file: File): Promise<string | undefined>
```

`readImageSize` awaits `createImageBitmap(file)` inside `try`, returns `{ width, height }` and closes the bitmap in `finally`; the catch returns `undefined`. `readAverageColor` is `averageColorOf` moved verbatim from `fabric-manager.tsx:71-94` with the same try/catch around the decode and `bitmap.close()` after `drawImage`.

- [ ] **Modify** `src/components/gallery-manager.tsx`:
  - `import { ErrorText, Pending } from "./office/confirm-bar";` and `import { readImageSize } from "./office/image-reads";`
  - `const [formError, setFormError] = useState<string | null>(null);`
  - In `add`, replace `const bitmap = await createImageBitmap(file);` and the later `bitmap.close();` with `const size = await readImageSize(file); if (!size) { setFormError("upload-failed"); return; } setFormError(null);` and use `size.width` / `size.height` in the wire.
  - After the submit `<div>`: `{formError ? <p role="alert" className="text-[0.8125rem] text-ink"><ErrorText code={formError} /></p> : null}`.
- [ ] **Modify** `src/components/fabric-manager.tsx`:
  - Same two imports; delete the inline `averageColorOf`.
  - `formError` becomes `useState<"invalid" | "upload-failed" | null>(null)`; the two `setFormError(true)` become `"invalid"`, `setFormError(false)` becomes `null`.
  - After the price validation: `const averageColor = await readAverageColor(file); if (!averageColor) { setFormError("upload-failed"); return; }` and `averageColor` in the wire.
  - The error paragraph renders `<ErrorText code={formError} />` (it already has the `updateFailed` fallback that the inline `t.has` check reproduced).

Browser: rename a text file to `.jpg` and pick it on Telas and on Galería: "La foto no se pudo subir. Intente una vez más." appears under the button, nothing is staged, the file input keeps the file. Verify: typecheck, tests.

### Task 6: drop the `retired:*` undo kinds

- [ ] **Test first.** **Modify** `src/lib/office-validation.test.ts`: import `UNDO_KINDS`; in `describe("undo query")` add `expect([...UNDO_KINDS]).toEqual(["style-override", "work-visibility", "price-entry", "alteration", "appointment", "notice", "request-status"])` and `expect(undoQuerySchema.safeParse({ kind: "retired:style", id: "x" }).success).toBe(false)`. **Modify** `src/lib/office-history.test.ts`: delete the last test, "reverses retirement records and keeps retirement kinds separate" (lines 120-141).
- [ ] **Modify** `src/lib/office-validation.ts:156-169`: `UNDO_KINDS` keeps the first seven entries.
- [ ] **Modify** `src/lib/office-history.ts`: delete `retiredPrefix` (183-189), `retiredStream` (191-204), the five `retired:` cases in `streamFor` (215-219), and in `undoableIds` restore `const id = stream.key(record);` (234-236). Remove the now-unused `import { retiredKey, type RetiredKind, type RetiredRecord } from "./retired";`.
- [ ] Verify `grep -rn '"retired:' src` is empty and `grep -rn "retired:" src/lib/office-validation.ts` is empty; typecheck (the exhaustive `switch` in `streamFor` is what catches a stray kind), tests.

### Task 7: `retiredSet` is read once per render request

- [ ] **Test first.** **Modify** `src/lib/retired.test.ts`, new block:

```ts
describe("the per-request memo on retiredSet", () => {
  afterEach(() => vi.doUnmock("react"));

  it("is a passthrough in this test build, so a write is visible on the next read", async () => {
    const { cache } = await import("react");
    let calls = 0;
    const counted = cache(() => { calls += 1; return calls; });
    counted();
    counted();
    expect(calls).toBe(2);
  });

  it("is wrapped in React cache, so a memoising build reads the file once per kind", async () => {
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      const memo = <A, R>(fn: (arg: A) => R) => {
        const seen = new Map<A, R>();
        return (arg: A) => {
          if (!seen.has(arg)) seen.set(arg, fn(arg));
          return seen.get(arg) as R;
        };
      };
      return { ...actual, cache: memo };
    });
    const { retiredSet, setRetired } = await import("./retired");
    expect(retiredSet("style")).toEqual(new Set());
    await setRetired("style", "x", true);
    expect(retiredSet("style"), "memoised within the scope").toEqual(new Set());
    expect(retiredSet("gallery"), "a different kind is a different entry").toEqual(new Set());
  });
});
```

The existing "includes an id after it is retired" case stays as the proof that write-then-read in one process still works.

- [ ] **Modify** `src/lib/retired.ts`:
  - `import { cache } from "react";`
  - ```ts
    /**
     * Memoised per render request with React `cache`: a Work render asks for
     * the request set a dozen times and the file is parsed once. Outside a
     * render (a server action, a route handler, this file's tests) `cache`
     * hands the call straight through, so a write is visible on the next read.
     * The set is shared, hence read-only.
     */
    export const retiredSet = cache((kind: RetiredKind): ReadonlySet<string> => { ...same body... });
    ```
  - Callers (`live-catalog.ts:129,134`, `live-gallery.ts:49,58`, `live-pricing.ts:171,198,203`, `request-store.ts:114,123`) only call `.has` or pass the set to an `assemble*` that takes `ReadonlySet<string>`; none changes.

Browser: retire a request on Trabajo and confirm: it moves to Retirados in the same response (the post-action render is a fresh request); Hoy and Libros agree. Verify: typecheck, tests.

### Task 8: undo of a style override keeps the photos the newest line added

- [ ] **Test first.** **Modify** `src/lib/office-history.test.ts`, new case in `describe("office undo history")`:

```ts
it("keeps the newest photos when undoing to the baseline and to the earlier line", async () => {
  const { previousChangeFor } = await import("./office-history");
  const { saveStyleOverride } = await import("./live-catalog");

  await saveStyleOverride({
    styleId: "frutera", isPublished: true, stock: { m: false },
    addedPhotos: ["/uploads/a.jpg"], coverSrc: "/uploads/a.jpg",
  });
  expect(previousChangeFor("style-override", "frutera")).toEqual({
    type: "style-override", key: "style:frutera", styleId: "frutera",
    isPublished: true, stock: { s: true, m: true, l: true },
    addedPhotos: ["/uploads/a.jpg"],
  });

  await saveStyleOverride({
    styleId: "frutera", isPublished: false, stock: { m: false },
    addedPhotos: ["/uploads/a.jpg", "/uploads/b.jpg"], coverSrc: "/uploads/b.jpg",
  });
  expect(previousChangeFor("style-override", "frutera")).toEqual({
    type: "style-override", key: "style:frutera", styleId: "frutera",
    isPublished: true, stock: { m: false },
    addedPhotos: ["/uploads/a.jpg", "/uploads/b.jpg"], coverSrc: "/uploads/a.jpg",
  });
});
```

The first existing case (no photos on either line) must keep passing unchanged: no `addedPhotos` key appears when the newest line has none.

- [ ] **Modify** `src/lib/office-history.ts`, the `styleOverride` stream only:
  - Add above it:
    ```ts
    /** Photos are only ever added from the office, so an undo never takes them away. */
    function newestPhotos(id: string): readonly string[] | undefined {
      return versionsOf<StyleOverride>("style-overrides", (record) => record.styleId, id).at(-1)?.addedPhotos;
    }
    ```
  - `baseline`: append `...(photos && photos.length > 0 ? { addedPhotos: [...photos] } : {})` with `const photos = newestPhotos(id)`; no `coverSrc`.
  - `toChange`: `const photos = newestPhotos(id) ?? record.addedPhotos;` and use it in place of `record.addedPhotos`; `coverSrc` stays from `record`.

Browser: on Colección add a photo to a garment and untick M in one go, confirm, press Deshacer, confirm: M is back on the rack, the photo count is unchanged, the coded cover leads. Verify: typecheck, tests.

### Task 9: Deshacer never offers a line Stripe wrote

- [ ] **Test first.**
  - **Modify** `src/lib/office-history.test.ts`: the `request` helper gains an optional second argument `source?: StoredRequest["source"]` spread into the record. Rewrite "only makes request status undoable after a second line" so the second line is `request("answered", "office")`, and add:
    ```ts
    it("does not offer a Stripe line or an unmarked line for undo", async () => {
      const { previousChangeFor, undoableIds } = await import("./office-history");
      const { saveRequest } = await import("./request-store");

      await saveRequest(request("new"));
      await saveRequest(request("answered"));            // unmarked: written before this shipped
      expect(previousChangeFor("request-status", "MSG-TEST")).toBeUndefined();
      expect(undoableIds("request-status")).not.toContain("MSG-TEST");

      await saveRequest(request("paid", "stripe"));
      expect(previousChangeFor("request-status", "MSG-TEST")).toBeUndefined();
      expect(undoableIds("request-status")).not.toContain("MSG-TEST");

      await saveRequest(request("closed", "office"));
      expect(previousChangeFor("request-status", "MSG-TEST")).toMatchObject({ status: "paid" });
      expect(undoableIds("request-status")).toContain("MSG-TEST");
    });
    ```
  - **Modify** `src/lib/request-store.test.ts`, new block:
    ```ts
    describe("who marks a status line", () => {
      const source = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
      it("is the office on the work action and Stripe on the webhook, and nobody on a client submission", () => {
        expect(source("src/app/[locale]/office/work/actions.ts")).toContain('source: "office"');
        expect(source("src/app/api/stripe/webhook/route.ts")).toContain('status: "paid", source: "stripe"');
        expect(source("src/lib/notify.ts")).not.toContain("source:");
      });
    });
    ```
    (import `readFileSync` from `node:fs` next to the existing imports.)

- [ ] **Modify** `src/lib/request-store.ts` `StoredRequest`, after `photoFile`:
  ```ts
  /**
   * Who appended this line when it was not the client: the office changing a
   * status, or Stripe marking a payment. Lines before September 2026 carry
   * nothing. Undo is offered only on a line the office wrote.
   */
  readonly source?: "office" | "stripe";
  ```
- [ ] **Modify** `src/app/[locale]/office/work/actions.ts:17`: `await saveRequest({ ...record, status: change.status, source: "office" });`
- [ ] **Modify** `src/app/api/stripe/webhook/route.ts:49`: `await saveRequest({ ...record, status: "paid", source: "stripe" });` with a one-line comment: the spread would otherwise carry the office's mark onto a line the office did not write.
- [ ] **Modify** `src/lib/office-history.ts`:
  - `Stream<R>` gains `readonly undoable?: (latest: R) => boolean;` ("whether the newest line may be undone at all; absent means always"); `erased` forwards it: `undoable: source.undoable ? (record) => source.undoable!(record as R) : undefined`.
  - `requestStatus` gains `undoable: (record) => record.source === "office"`.
  - `previousChangeFor`: after `const versions = stream.versions(id);` add `const latest = versions.at(-1); if (latest === undefined || (stream.undoable && !stream.undoable(latest))) return undefined;` then the existing two lines.
  - `undoableIds`: keep a `latest = new Map<string, unknown>()` alongside `counts` (set on every record, so file order leaves the newest); the filter becomes `(count >= 2 || stream.baseline(id) !== undefined) && (stream.undoable?.(latest.get(id)) ?? true)`.
- [ ] **Modify** `docs/manual-del-taller.html` `#deshacer` note, after "Deshacer dos veces vuelve a donde estaba.": `<p>Un pago con tarjeta lo anota Stripe, no usted, y esa línea no se deshace desde aquí. Las líneas de antes de septiembre de 2026 tampoco ofrecen Deshacer hasta que usted las cambie otra vez.</p>` No em dashes.

Browser: on Trabajo change a message to "Contestado", confirm: Deshacer appears; press it: "Recibido" pending. With a request whose newest line is a `paid` written by hand into `.data/order.jsonl` with `"source":"stripe"`, no Deshacer shows on that row. Verify: typecheck, tests, `git grep -n "—" docs/manual-del-taller.html` shows nothing new.

### Task 10: plain-language status and full verification

- [ ] **Modify** `docs/next-steps.md`: remove the two bullets "The office tab strip should scroll the active tab into view on a phone." and "The gallery's save button labels still say "Agregar al trabajo"." from "What could come next"; add under "Office steps 2 and 3: done" one bullet: "**Polish (branch office-polish):** the tab strip follows the active tab on a phone; a photo the browser cannot read says so instead of hanging; the Vitrina bar pins like the others; a change she makes while confirming is not marked failed; Deshacer keeps added photos, and never offers a payment that Stripe wrote (older status lines offer it again only after she changes them)."
- [ ] `npm run typecheck && npm test && npm run build`.
- [ ] `npm run dev`, then the user runs `npm run smoke` (private set unchanged).
- [ ] Greps: `grep -rn '"retired:' src` empty; `grep -rn "createImageBitmap(" src/components` shows only `image-reads.ts`; `grep -rn "type: \"settled\"" src` shows only `use-office-draft.tsx` and the reducer test; `git grep -n "—" src/messages docs/manual-del-taller.html` shows nothing new; `git diff main -- package.json` empty on this branch.
- [ ] Browser pass as owner at 375px and desktop: the checks in Tasks 2, 3, 4, 5, 7, 8, 9.

## C. Sequencing notes

- Tasks 1 to 5 touch no store and no server action; they are safe in any order but are listed by blast radius.
- Task 6 must precede Task 9: both edit `streamFor` and `undoableIds` in `office-history.ts`, and the deletion is cleaner without the new hook in the way.
- Task 7 is independent of everything else and can move earlier if the controller prefers; it changes no call site.
- Task 8 and Task 9 both edit `office-history.ts` and its test; keep them separate commits as written.
- Task 9 is the only task that touches the Stripe webhook and the stored record shape; it is last among the code tasks on purpose.
