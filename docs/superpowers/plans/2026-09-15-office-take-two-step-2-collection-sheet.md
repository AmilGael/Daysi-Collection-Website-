# Office take two, step 2: the sheet, Colección as cards, full photo control, one language typed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colección becomes cards; tapping one opens a sheet where Daysi manages every photo (add, remove, reorder, cover), writes in Spanish only, flips sizes, shown and "offered in the studio", and the site writes the English for her at confirm time.

**Architecture:** The office keeps its draft-and-confirm model: every control stages a change into the tab's draft and the bar confirms. Three new pure modules carry the logic (`photo-order.ts` for the photo list, `garment-draft.ts` for turning the sheet's state into a draft change, `translate.ts` for Spanish to English through the Claude API), so the React components are thin. `StyleOverride` records gain an ordered `photos` list and an `inStudio` flag; records without them read exactly as before. The garment action translates at confirm and falls back to a copy of the Spanish, which the sheet marks as pending.

**Tech Stack:** Next.js 15 App Router (server actions), React 19, next-intl 4, Tailwind 4, zod 3, Vitest (node, no DOM; structural tests read source with `fs`), `@anthropic-ai/sdk` 0.125.0 (new).

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md`, Amendment 4, sections 2, 3, 5, 8 (the record and switch only; the public studio page is step 4) and 12 (step 2). Read the amendment before starting.

## Global Constraints

- Never run `fly deploy` by hand; the user deploys with `npm run deploy` from `main`.
- Nothing saves before Daysi presses Confirmar cambios; nothing is ever physically deleted (a photo left out of the list is hidden, its file stays).
- Exactly one `ownerAction` per `actions.ts` file under `src/app/[locale]/office/`; every export of such a file is that action (`src/lib/action-guard.test.ts`).
- Every page under `office/` appears in `OFFICE_TABS` (`src/components/office/tabs.test.ts`).
- `src/messages/es.json` and `src/messages/en.json` keep identical keys under `office`; no label contains an em dash (`—`).
- Daysi types Spanish only. English is written by the translation service at confirm; when the service is off or fails, English is a copy of the Spanish and the confirm still succeeds. A field whose English equals its Spanish is, by definition, untranslated.
- The Claude API is called only through the official SDK `@anthropic-ai/sdk`, model `claude-opus-5`, non-streaming, structured output, one attempt with a 20-second timeout. The key is `ANTHROPIC_API_KEY`, read in `src/lib/env.ts` like every other secret.
- `npm audit --omit=dev --audit-level=high` must exit 0 after the dependency is added (the deploy gate runs it). Regenerate the lockfile with npm 10 (`npx npm@10 …`) or `npm ci` fails on CI.
- The sheet sits above the page and below the confirm bar (bar is `z-30`; sheet is `z-20`) and reserves the bar's height, so Confirmar cambios is always reachable.
- Field limits: name 2–60, colour 0–80, description 10–400, detail 0–400 characters; photos 1–12 per garment; upload paths match `/^\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/`.
- `docs/manual-del-taller.html` and `docs/next-steps.md` are updated in the same pull request.
- Tests: `npm test`; typecheck: `npm run typecheck`; smoke: `SMOKE_URL=http://localhost:<port> npm run smoke`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch: `office-take-two-2-collection`, from `main` at or after `1c0c0cb`.

---

## File structure

| File | Responsibility after this step |
| --- | --- |
| `package.json`, `package-lock.json`, `.env.example` | `@anthropic-ai/sdk` pinned; the key documented |
| `src/lib/env.ts` | `anthropicApiKey`, `translationEnabled` |
| `src/lib/translate.ts` (+test) | `translateToEnglish(fields, context, call?)` and `withEnglish(spanish, english)`; the SDK call is injectable |
| `src/content/types.ts` | `GarmentStyle.inStudio?` |
| `src/lib/live-catalog.ts` (+tests) | `StyleOverride.photos?`, `StyleOverride.inStudio?`, the merge rule, `liveStudioStyles()` |
| `src/lib/office-validation.ts` (+test) | `photos`, `inStudio` on the override; Spanish strings on create; the `translate` change |
| `src/lib/office-history.ts` (+test) | the style stream carries `photos` and `inStudio` through undo |
| `src/lib/photo-order.ts` (+test) | `PhotoSlot` and the pure list operations: move, remove, cover, add |
| `src/components/office/garment-draft.ts` (+test) | `ManagedStyle`, `OverrideView`, `viewOf`, `overrideChange`, `unchanged` |
| `src/components/office/use-office-draft.tsx` | `DraftChange.meta` (what an editor needs to redraw a pending change) |
| `src/app/[locale]/office/collection/actions.ts` | photos ownership, Spanish-only create with translation, text edits that translate, the `translate` change |
| `src/components/office/sheet.tsx` | the sheet: full screen under 640 px, a 28 rem panel above, Escape and back gesture close |
| `src/components/office/switch.tsx` | one on/off switch |
| `src/components/office/garment-photos.tsx` | the photo grid with its controls |
| `src/components/office/garment-words.tsx` | Spanish fields, Ver inglés, Corregir, Traducir |
| `src/components/office/garment-sheet.tsx` | the sheet's content for an existing garment and for a new one |
| `src/components/collection-cards.tsx` | the cards, the "+" card, pending creates, the retired group, opens the sheet |
| `src/app/[locale]/office/collection/page.tsx` | builds `ManagedStyle` rows with price and photo order |
| `src/components/collection-manager.tsx`, `src/components/style-composer.tsx` | deleted |
| `src/messages/{es,en}.json` | the sheet's words |
| `docs/manual-del-taller.html`, `docs/next-steps.md`, the spec | words follow the code |

`src/components/office/text-fields.tsx` stays: the gallery still uses it until step 3.

---

### Task 1: The translation module and its key

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `.env.example`
- Modify: `src/lib/env.ts:38-48` (add the key after `resendApiKey`), `:64-70` (add `translationEnabled`)
- Create: `src/lib/translate.ts`
- Create: `src/lib/translate.test.ts`

**Interfaces:**
- Produces: `translateToEnglish(fields: Readonly<Record<string, string>>, context: "garment" | "photo", call?: TranslationCall | null): Promise<Record<string, string> | null>`; `withEnglish(spanish: Readonly<Record<string, string>>, english: Readonly<Record<string, string>> | null): Record<string, { es: string; en: string }>`; `TranslationCall`; `translationEnabled` from `@/lib/env`. Task 4 consumes all four.

- [ ] **Step 1: Add the SDK, pinned, and prove the audit stays clean**

```bash
npx npm@10 install --save-exact @anthropic-ai/sdk@0.125.0
npm run audit
```

Expected: `package.json` gains `"@anthropic-ai/sdk": "0.125.0"` under `dependencies`; the audit exits 0 ("found 0 vulnerabilities" at high or above). If the audit fails, stop and report BLOCKED with the output; do not lower the level.

- [ ] **Step 2: Document the key**

Append to `.env.example`:

```
# Writes the English for what Daysi types in Spanish, at confirm time
# (office design, Amendment 4 §5). Optional: without it the English is a
# copy of the Spanish, marked "Inglés pendiente" in the office until a key
# arrives. A key from console.anthropic.com; a busy month costs under a dollar.
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Read the key in one place**

In `src/lib/env.ts`, after the `resendApiKey: optional("RESEND_API_KEY"),` line add:

```ts
  /**
   * Turns Daysi's Spanish into the site's English at confirm time. Without
   * it every form still works: the English is a copy of the Spanish, marked
   * pending in the office until a key arrives (design, Amendment 4 §5).
   */
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
```

After the `googleAuthEnabled` export add:

```ts
/** English is written by the translation service only when its key is present. */
export const translationEnabled = env.anthropicApiKey !== null;
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/translate.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  translateToEnglish,
  withEnglish,
  type TranslationCall,
  type TranslationRequest,
} from "./translate";

const spanish = {
  name: "Conjunto Frutera",
  color: "Esmeralda sobre una escena de mercado pintada",
  description: "Blusa esmeralda con lazo sobre una falda de fruteras con canastas.",
  detail: "",
};

describe("translateToEnglish", () => {
  it("returns what the call hands back, by field", async () => {
    const call: TranslationCall = vi.fn(async () => ({
      name: "Frutera two-piece",
      color: "Emerald over a painted market scene",
      description: "An emerald bow blouse over a skirt of market women carrying fruit.",
    }));
    const english = await translateToEnglish(spanish, "garment", call);
    expect(english).toEqual({
      name: "Frutera two-piece",
      color: "Emerald over a painted market scene",
      description: "An emerald bow blouse over a skirt of market women carrying fruit.",
    });
  });

  it("asks only for the fields that have words in them", async () => {
    const requests: TranslationRequest[] = [];
    const call: TranslationCall = async (request) => {
      requests.push(request);
      return Object.fromEntries(request.keys.map((key) => [key, `en ${key}`]));
    };
    await translateToEnglish(spanish, "garment", call);
    expect(requests).toHaveLength(1);
    expect(requests[0].keys).toEqual(["name", "color", "description"]);
    expect(requests[0].prompt).toContain("Conjunto Frutera");
    expect(requests[0].system).toContain("Garífuna");
  });

  it("returns null, and makes no call, when there is nothing to translate or no service", async () => {
    const call = vi.fn(async () => ({}));
    expect(await translateToEnglish({ detail: "  " }, "garment", call)).toBeNull();
    expect(call).not.toHaveBeenCalled();
    expect(await translateToEnglish(spanish, "garment", null)).toBeNull();
  });

  it("returns null when the reply is malformed, missing a field, or the call throws", async () => {
    expect(await translateToEnglish(spanish, "garment", async () => ({ name: 5 }))).toBeNull();
    expect(await translateToEnglish(spanish, "garment", async () => ({ name: "Frutera" }))).toBeNull();
    expect(
      await translateToEnglish(spanish, "garment", async () => {
        throw new Error("timeout");
      }),
    ).toBeNull();
  });
});

describe("withEnglish", () => {
  it("pairs each Spanish field with its English", () => {
    expect(withEnglish({ name: "Conjunto", detail: "" }, { name: "Two-piece" })).toEqual({
      name: { es: "Conjunto", en: "Two-piece" },
      detail: { es: "", en: "" },
    });
  });

  it("copies the Spanish where there is no English, which the office reads as pending", () => {
    expect(withEnglish({ name: "Conjunto", color: "Verde" }, null)).toEqual({
      name: { es: "Conjunto", en: "Conjunto" },
      color: { es: "Verde", en: "Verde" },
    });
    expect(withEnglish({ name: "Conjunto", color: "Verde" }, { name: "Two-piece" })).toEqual({
      name: { es: "Conjunto", en: "Two-piece" },
      color: { es: "Verde", en: "Verde" },
    });
  });
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run src/lib/translate.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 6: Write the module**

Create `src/lib/translate.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "./env";

/**
 * Spanish in, English out, at confirm time.
 *
 * Daysi writes every word once, in Spanish. This turns the fields that
 * changed into English through the Claude API and hands them back by the
 * same keys; the action writes both languages. It answers null for every
 * kind of trouble (no key, nothing to say, a malformed reply, a timeout)
 * and never throws, because a translation problem must never stop a photo
 * from landing: the caller copies the Spanish instead, and the office shows
 * that copy as "Inglés pendiente" until she asks for it again.
 *
 * The SDK call is one injectable function so the rest is testable without
 * a network. A refusal is treated like any other failure; the copy is the
 * fallback, so no server-side fallback model is configured.
 */

export type TranslationContext = "garment" | "photo";

export type TranslationRequest = {
  readonly system: string;
  readonly prompt: string;
  readonly keys: readonly string[];
};
export type TranslationCall = (request: TranslationRequest) => Promise<unknown>;

const SYSTEM = [
  "You translate a Bronx tailoring atelier's Spanish copy into English for its website.",
  "Daysi Collection makes custom garments, alterations and Garífuna heritage pieces.",
  "Garment and fabric names are names and stay as they are (Frutera, Sirena, Amapola).",
  "Keep the register plain and warm, and keep roughly the same length.",
  "No quotation marks, no added claims, no explanations: return only the fields asked for.",
].join(" ");

function promptFor(fields: Readonly<Record<string, string>>, keys: readonly string[], context: TranslationContext): string {
  const picked = Object.fromEntries(keys.map((key) => [key, fields[key]]));
  const what = context === "garment" ? "a garment for sale" : "a caption under a finished piece in the gallery";
  return `Context: ${what}.\nTranslate each field from Spanish to English:\n${JSON.stringify(picked)}`;
}

function sdkCall(apiKey: string): TranslationCall {
  const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 0 });
  return async ({ system, prompt, keys }) => {
    const shape = Object.fromEntries(keys.map((key) => [key, z.string()]));
    const response = await client.messages.parse({
      model: "claude-opus-5",
      // Short copy: at most four fields of at most 400 characters each.
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(z.object(shape)) },
    });
    return response.parsed_output;
  };
}

function defaultCall(): TranslationCall | null {
  return env.anthropicApiKey ? sdkCall(env.anthropicApiKey) : null;
}

export async function translateToEnglish(
  fields: Readonly<Record<string, string>>,
  context: TranslationContext,
  call: TranslationCall | null = defaultCall(),
): Promise<Record<string, string> | null> {
  const keys = Object.keys(fields).filter((key) => fields[key].trim().length > 0);
  if (!call || keys.length === 0) return null;
  try {
    const raw = await call({ system: SYSTEM, prompt: promptFor(fields, keys, context), keys });
    const reply = z.object(Object.fromEntries(keys.map((key) => [key, z.string().trim().min(1)])));
    const parsed = reply.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Each field as the pair the catalog stores; the Spanish stands in where there is no English. */
export function withEnglish(
  spanish: Readonly<Record<string, string>>,
  english: Readonly<Record<string, string>> | null,
): Record<string, { es: string; en: string }> {
  return Object.fromEntries(
    Object.entries(spanish).map(([key, es]) => [key, { es, en: english?.[key] ?? es }]),
  );
}
```

- [ ] **Step 7: Run the tests and the typecheck**

Run: `npx vitest run src/lib/translate.test.ts && npm run typecheck`
Expected: PASS. If the typecheck rejects `output_config` or `parsed_output`, the SDK's names differ from this plan's: run `grep -n "parsed_output\|output_config" node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts | head` and use the names it shows, then say so in your report.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/env.ts src/lib/translate.ts src/lib/translate.test.ts
git commit -m "Add the translation module: Spanish in, English out, at confirm

One injectable call to the Claude API through the official SDK, a system
prompt that knows what the atelier is, and null for every kind of trouble
so a translation problem never stops a confirm. withEnglish pairs the
languages and copies the Spanish where there is no English, which the
office will read as pending.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Records, merge, schema and undo

**Files:**
- Modify: `src/content/types.ts:80-95` (`GarmentStyle`)
- Modify: `src/lib/live-catalog.ts:18-30` (`StyleOverride`), `:50-90` (`applyOverrides`), after `liveStyles` (add `liveStudioStyles`)
- Modify: `src/lib/live-catalog.test.ts`
- Create: `src/lib/live-studio.test.ts`
- Modify: `src/lib/office-validation.ts:27-57` (override and create schemas), `:108-121` (collection union)
- Modify: `src/lib/office-validation.test.ts:47-90` (the create fixture and its tests)
- Modify: `src/lib/office-history.ts:62-100` (the style stream)
- Modify: `src/lib/office-history.test.ts`

**Interfaces:**
- Produces: `StyleOverride.photos?: readonly string[]`, `StyleOverride.inStudio?: boolean`, `GarmentStyle.inStudio?: boolean`, `liveStudioStyles(): GarmentStyle[]`; `styleOverrideSchema` accepts `photos` (1–12) and `inStudio`; `styleCreateSchema` takes `name`, `color`, `description`, `detail` as Spanish strings and `inStudio` (default false); `translateChangeSchema` `{ type: "translate", key, id, fields }` joins `collectionChangeSchema`. Tasks 3, 4 and 6 consume these.

- [ ] **Step 1: Write the failing merge tests**

Append to `src/lib/live-catalog.test.ts`:

```ts
describe("the photo list on an override", () => {
  const frutera = () => styles.find((style) => style.id === "frutera")!;
  const coded = () => frutera().photos.map((photo) => photo.src);

  it("shows the photos the record lists, in that order, the first as the cover", () => {
    const [first, second] = coded();
    const merged = applyOverrides(styles, [override({ photos: [second, first] })]);
    const photos = merged.find((style) => style.id === "frutera")!.photos;
    expect(photos.map((photo) => photo.src)).toEqual([second, first]);
    expect(photos.map((photo) => photo.isPrimary)).toEqual([true, false]);
    // A coded photo keeps its own alt text.
    expect(photos[0].alt).toEqual(frutera().photos[1].alt);
  });

  it("hides a coded photo the list leaves out, and gives an upload the atelier alt", () => {
    const [first] = coded();
    const merged = applyOverrides(styles, [
      override({ photos: ["/uploads/img-abc12345.jpg", first] }),
    ]);
    const photos = merged.find((style) => style.id === "frutera")!.photos;
    expect(photos.map((photo) => photo.src)).toEqual(["/uploads/img-abc12345.jpg", first]);
    expect(photos[0].alt.es).toContain("fotografiado en el taller");
    expect(photos[0].isPrimary).toBe(true);
  });

  it("drops a photo the garment does not own, and keeps the coded photos when nothing is left", () => {
    const [first] = coded();
    const withStranger = applyOverrides(styles, [override({ photos: ["/images/real/other.jpg", first] })]);
    expect(withStranger.find((style) => style.id === "frutera")!.photos.map((photo) => photo.src)).toEqual([first]);
    const nothingLeft = applyOverrides(styles, [override({ photos: ["/images/real/other.jpg"] })]);
    expect(nothingLeft.find((style) => style.id === "frutera")!.photos).toEqual(frutera().photos);
  });

  it("reads a record without a photo list exactly as before: added after coded, cover by src", () => {
    const merged = applyOverrides(styles, [
      override({ addedPhotos: ["/uploads/img-abc12345.jpg"], coverSrc: "/uploads/img-abc12345.jpg" }),
    ]);
    const photos = merged.find((style) => style.id === "frutera")!.photos;
    expect(photos[0].src).toBe("/uploads/img-abc12345.jpg");
    expect(photos[0].isPrimary).toBe(true);
    expect(photos).toHaveLength(coded().length + 1);
  });
});

describe("offered in the studio", () => {
  it("is off for a coded garment and follows the record when it says so", () => {
    expect(applyOverrides(styles, []).find((style) => style.id === "frutera")!.inStudio).toBeUndefined();
    const on = applyOverrides(styles, [override({ inStudio: true })]);
    expect(on.find((style) => style.id === "frutera")!.inStudio).toBe(true);
    const silent = applyOverrides(styles, [override({ stock: { m: false } })]);
    expect(silent.find((style) => style.id === "frutera")!.inStudio).toBeUndefined();
  });
});
```

Create `src/lib/live-studio.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GarmentStyle } from "@/content/types";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-live-studio-"));
  process.env.DATA_DIR = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const added: GarmentStyle = {
  id: "sty-studio01",
  slug: "studio-one",
  name: { es: "Prueba", en: "Test" },
  categoryId: "dresses",
  priceEntryId: "dresses--daisy-cotton",
  color: { es: "", en: "" },
  description: { es: "Una prueba", en: "A test" },
  detail: { es: "", en: "" },
  sizes: [{ sizeId: "s", inStock: true }],
  photos: [{ src: "/uploads/img-studio01.jpg", alt: { es: "", en: "" }, isPrimary: true }],
  customizationAvailable: true,
  isPublished: true,
  inStudio: true,
};

describe("liveStudioStyles", () => {
  it("offers a garment switched on, and drops it when hidden, unpublished or retired", async () => {
    const catalog = await import("./live-catalog");
    const { setRetired } = await import("./retired");

    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");
    await catalog.saveAddedStyle(added);
    expect(catalog.liveStudioStyles().map((style) => style.id)).toContain("sty-studio01");

    await catalog.saveStyleOverride({ styleId: "sty-studio01", isPublished: false, stock: {} });
    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");

    await catalog.saveStyleOverride({ styleId: "sty-studio01", isPublished: true, stock: {}, inStudio: false });
    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");

    await catalog.saveStyleOverride({ styleId: "sty-studio01", isPublished: true, stock: {}, inStudio: true });
    expect(catalog.liveStudioStyles().map((style) => style.id)).toContain("sty-studio01");

    await setRetired("style", "sty-studio01", true);
    expect(catalog.liveStudioStyles().map((style) => style.id)).not.toContain("sty-studio01");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/live-catalog.test.ts src/lib/live-studio.test.ts`
Expected: FAIL (the photo list is ignored; `inStudio` and `liveStudioStyles` do not exist; the typecheck inside vitest reports `inStudio` on the fixture).

- [ ] **Step 3: The type, the record and the merge**

In `src/content/types.ts`, inside `GarmentStyle` after `readonly isPublished: boolean;` add:

```ts
  /**
   * Offered in the design studio, where a fabric is shown beside its photo
   * (office design, Amendment 4 §8). Unset on every coded garment: Daysi
   * switches a piece on from the office.
   */
  readonly inStudio?: boolean;
```

In `src/lib/live-catalog.ts`, inside `StyleOverride` after `coverSrc` add:

```ts
  /**
   * The complete list of photos to show, in order; the first is the cover.
   * A coded photo left out is hidden, never deleted. Absent on records
   * written before 15 September 2026, which read by addedPhotos and
   * coverSrc as they always did.
   */
  readonly photos?: readonly string[];
  /** Offered in the design studio. Absent says nothing, so the garment's own flag stands. */
  readonly inStudio?: boolean;
```

Replace the body of `applyOverrides` (from `const byId` to the closing `});`) with:

```ts
  const byId = new Map(overrides.map((override) => [override.styleId, override]));
  return catalog.map((style) => {
    const override = byId.get(style.id);
    if (!override) return style;

    const atelierAlt = {
      en: `${style.name.en}, photographed in the atelier.`,
      es: `${style.name.es}, fotografiado en el taller.`,
    };

    let photos: StylePhoto[];
    if (override.photos) {
      // The list is the truth: coded photos keep their alt, uploads get the
      // atelier's, a src the garment never owned is dropped, and a list that
      // names nothing it owns changes nothing.
      const coded = new Map(style.photos.map((photo) => [photo.src, photo]));
      const listed = override.photos.flatMap((src) => {
        const known = coded.get(src);
        if (known) return [known];
        if (src.startsWith("/uploads/")) return [{ src, alt: atelierAlt, isPrimary: false }];
        return [];
      });
      photos = (listed.length > 0 ? listed : [...style.photos]).map((photo, index) => ({
        ...photo,
        isPrimary: index === 0,
      }));
    } else {
      const added = (override.addedPhotos ?? []).map((src) => ({ src, alt: atelierAlt, isPrimary: false }));
      photos = [...style.photos, ...added];
      if (override.coverSrc && photos.some((photo) => photo.src === override.coverSrc)) {
        photos = [
          ...photos.filter((photo) => photo.src === override.coverSrc).map((photo) => ({ ...photo, isPrimary: true })),
          ...photos.filter((photo) => photo.src !== override.coverSrc).map((photo) => ({ ...photo, isPrimary: false })),
        ];
      }
    }

    return {
      ...style,
      isPublished: override.isPublished,
      photos,
      sizes: style.sizes.map((offered) => {
        const stocked = override.stock[offered.sizeId as keyof SizeStock];
        return stocked === undefined ? offered : { ...offered, inStock: stocked };
      }),
      ...(override.inStudio === undefined ? {} : { inStudio: override.inStudio }),
    };
  });
```

Add `StylePhoto` to the type import at the top: `import type { GarmentStyle, Premiere, StylePhoto } from "@/content/types";`.

After `liveStyles()` add:

```ts
/** The garments the design studio offers beside a fabric: live, and switched on. */
export function liveStudioStyles(): GarmentStyle[] {
  return liveStyles().filter((style) => style.inStudio === true);
}
```

- [ ] **Step 4: Run the merge tests**

Run: `npx vitest run src/lib/live-catalog.test.ts src/lib/live-studio.test.ts src/lib/assemble-styles.test.ts`
Expected: PASS.

- [ ] **Step 5: The schemas, test first**

In `src/lib/office-validation.test.ts`, replace the `draft` fixture inside `describe("what the office accepts for a new garment", ...)` with Spanish strings:

```ts
  const draft = {
    name: "Cumbia maxi",
    description: "Un maxi de cintura fruncida en un estampado dorado.",
    detail: "",
    color: "",
    categoryId: "dresses",
    fabricId: "medallon-print",
    sizes: { s: true, m: true, l: false },
    photos: ["/uploads/img-abc123.jpg"],
  };
```

Fix any test in that describe that reaches into `draft.name.es` to use `draft.name`. Then append to the file:

```ts
describe("the photo list and the studio switch on an override", () => {
  it("accepts a list of coded and uploaded photos, and the studio flag", () => {
    const result = styleOverrideSchema.safeParse({
      styleId: "frutera",
      ...override,
      photos: ["/images/real/frutera-capri.jpg", "/uploads/img-abc12345.jpg"],
      inStudio: true,
    });
    expect(result.success).toBe(true);
  });

  it("refuses an empty list and a list of more than twelve", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, photos: [] }).success).toBe(false);
    expect(
      styleOverrideSchema.safeParse({
        styleId: "frutera",
        ...override,
        photos: Array.from({ length: 13 }, (_, index) => `/uploads/img-${index}.jpg`),
      }).success,
    ).toBe(false);
  });
});

describe("a new garment is typed in Spanish only", () => {
  it("takes one string per field and defaults the studio switch to off", () => {
    const result = styleCreateSchema.safeParse({
      name: "Cumbia maxi",
      description: "Un maxi de cintura fruncida en un estampado dorado.",
      detail: "",
      color: "",
      categoryId: "dresses",
      fabricId: "medallon-print",
      sizes: { s: true, m: true, l: false },
      photos: ["/uploads/img-abc123.jpg"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inStudio).toBe(false);
  });

  it("refuses the old two-language shape", () => {
    const result = styleCreateSchema.safeParse({
      name: { es: "Cumbia maxi", en: "Cumbia maxi" },
      description: "Un maxi de cintura fruncida en un estampado dorado.",
      detail: "",
      color: "",
      categoryId: "dresses",
      fabricId: "medallon-print",
      sizes: { s: true, m: true, l: false },
      photos: ["/uploads/img-abc123.jpg"],
    });
    expect(result.success).toBe(false);
  });
});

describe("asking for a translation", () => {
  it("names the garment and the fields", () => {
    const result = collectionChangeSchema.safeParse({
      type: "translate",
      key: "translate:style:frutera",
      id: "frutera",
      fields: ["name", "description"],
    });
    expect(result.success).toBe(true);
  });

  it("refuses an unknown field and an empty list", () => {
    expect(
      collectionChangeSchema.safeParse({ type: "translate", key: "translate:style:frutera", id: "frutera", fields: ["slug"] }).success,
    ).toBe(false);
    expect(
      collectionChangeSchema.safeParse({ type: "translate", key: "translate:style:frutera", id: "frutera", fields: [] }).success,
    ).toBe(false);
  });
});
```

Run: `npx vitest run src/lib/office-validation.test.ts`
Expected: FAIL on the new describes and on the Spanish-only fixture.

- [ ] **Step 6: Change the schemas**

In `src/lib/office-validation.ts`:

Replace `styleOverrideSchema` with:

```ts
export const styleOverrideSchema = z.object({
  styleId: z.string().trim().min(1).max(60),
  isPublished: z.boolean(),
  stock: z
    .object({ s: z.boolean().optional(), m: z.boolean().optional(), l: z.boolean().optional() })
    .strict(),
  addedPhotos: z
    .array(uploadPath)
    .max(12)
    .optional(),
  coverSrc: z.string().max(200).optional(),
  /** The full photo order, cover first: a coded src or an upload path each. Absent keeps the older rule. */
  photos: z.array(z.string().trim().min(1).max(200)).min(1).max(12).optional(),
  inStudio: z.boolean().optional(),
});
```

Replace `styleCreateSchema` with:

```ts
/** Typed in Spanish only; the action writes the English (design, Amendment 4 §5). */
export const styleCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(400),
  detail: z.string().trim().max(400),
  color: z.string().trim().max(80),
  categoryId: z.enum(categories.map((category) => category.id) as [string, ...string[]]),
  fabricId: z.string().trim().min(1).max(60),
  /** Only consulted when the garment-and-cloth pair has no published price. */
  fixedPrice: z.number().int().min(0).max(5_000_00).optional(),
  sizes: z.object({ s: z.boolean(), m: z.boolean(), l: z.boolean() }).strict(),
  photos: z
    .array(uploadPath)
    .min(1)
    .max(8),
  inStudio: z.boolean().default(false),
});
```

Delete the `pair` helper if nothing else uses it (`galleryWorkSchema` still does until step 3, so keep it if so).

After `workTextSchema` add:

```ts
/** "Traducir": write the English for these fields from their current Spanish. */
export const translateChangeSchema = z.object({
  type: z.literal("translate"),
  key: changeKey,
  id,
  fields: z.array(z.enum(["name", "color", "description", "detail"])).min(1).max(4),
});
```

And add `translateChangeSchema,` to the `collectionChangeSchema` union after `styleTextSchema,`.

Run: `npx vitest run src/lib/office-validation.test.ts`
Expected: PASS.

- [ ] **Step 7: Undo carries the new fields, test first**

Append to `src/lib/office-history.test.ts` inside `describe("office undo history", ...)`:

```ts
  it("restores the photo order and the studio switch a previous override carried", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");
    const a = "/images/real/frutera-capri.jpg";
    const b = "/images/real/frutera-campaign.jpg";

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, photos: [b, a], inStudio: true });
    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, photos: [a, b], inStudio: false });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: {},
      photos: [b, a],
      inStudio: true,
    });
  });
```

Run: `npx vitest run src/lib/office-history.test.ts -t "photo order"`
Expected: FAIL (the change carries `addedPhotos` and no `photos`).

- [ ] **Step 8: Teach the style stream**

In `src/lib/office-history.ts`, replace the doc comment and function `newestPhotos` and the `styleOverride` stream with:

```ts
/**
 * Records written before the photo list existed only ever added photos, so
 * an undo of one of those never takes a photo away. A record with a `photos`
 * list is the whole truth and is restored as it was.
 */
function newestPhotos(id: string): readonly string[] | undefined {
  return versionsOf<StyleOverride>("style-overrides", (record) => record.styleId, id).at(-1)?.addedPhotos;
}

const styleOverride = recordStream<StyleOverride>(
  "style-overrides",
  (record) => record.styleId,
  (id) => {
    const style = assembleStyles(styles, addedStyles(), []).find((candidate) => candidate.id === id);
    if (!style) return undefined;
    const photos = newestPhotos(id);
    return {
      type: "style-override",
      key: `style:${id}`,
      styleId: id,
      isPublished: style.isPublished,
      stock: Object.fromEntries(
        style.sizes.map((size) => [size.sizeId, size.inStock]),
      ) as SizeStock,
      ...(photos && photos.length > 0 ? { addedPhotos: [...photos] } : {}),
    };
  },
  (record, id) => {
    const legacy = record.photos ? undefined : (newestPhotos(id) ?? record.addedPhotos);
    return {
      type: "style-override",
      key: `style:${id}`,
      styleId: id,
      isPublished: record.isPublished,
      stock: record.stock,
      ...(record.photos ? { photos: [...record.photos] } : {}),
      ...(legacy === undefined ? {} : { addedPhotos: [...legacy] }),
      ...(record.coverSrc === undefined || record.photos ? {} : { coverSrc: record.coverSrc }),
      ...(record.inStudio === undefined ? {} : { inStudio: record.inStudio }),
    };
  },
);
```

- [ ] **Step 9: Run the history tests and the typecheck**

Run: `npx vitest run src/lib/office-history.test.ts && npm run typecheck`
Expected: PASS. The typecheck will now fail in `src/app/[locale]/office/collection/actions.ts`, `src/components/style-composer.tsx` and `src/components/collection-manager.tsx` because the create schema changed shape: that is expected and is fixed by Tasks 4 and 6. Report the exact files it names; nothing else may fail.

- [ ] **Step 10: Commit**

```bash
git add src/content/types.ts src/lib/live-catalog.ts src/lib/live-catalog.test.ts src/lib/live-studio.test.ts src/lib/office-validation.ts src/lib/office-validation.test.ts src/lib/office-history.ts src/lib/office-history.test.ts
git commit -m "Give a garment's override a photo order and a studio switch

The list is the whole truth when present: coded photos keep their alt,
uploads get the atelier's, a stranger is dropped, the first is the cover.
Records without it read exactly as before. A new garment is typed in
Spanish only, and a translate change asks for the English later. Undo
restores the list and the switch as they were.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The pure editor helpers

**Files:**
- Create: `src/lib/photo-order.ts`, `src/lib/photo-order.test.ts`
- Create: `src/components/office/garment-draft.ts`, `src/components/office/garment-draft.test.ts`
- Modify: `src/components/office/use-office-draft.tsx:27-31` (`DraftChange`)

**Interfaces:**
- Consumes: `CollectionChange` from Task 2's schema; `DraftChange` from `use-office-draft.tsx`.
- Produces: `PhotoSlot`, `moveSlot`, `removeSlot`, `coverSlot`, `addFiles`, `slotKey` from `@/lib/photo-order`; `ManagedStyle`, `OverrideView`, `viewOf`, `overrideChange`, `unchanged` from `@/components/office/garment-draft`; `DraftChange.meta`. Task 6 builds every control on these.

- [ ] **Step 1: Write the failing photo-order tests**

Create `src/lib/photo-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addFiles, coverSlot, moveSlot, removeSlot, slotKey, type PhotoSlot } from "./photo-order";

const src = (name: string): PhotoSlot => ({ kind: "src", src: `/images/real/${name}.jpg` });
const file = (name: string): PhotoSlot => ({
  kind: "file",
  file: new File(["x"], `${name}.jpg`, { type: "image/jpeg" }),
  preview: `blob:${name}`,
});
const keys = (slots: readonly PhotoSlot[]) => slots.map(slotKey);

describe("the photo list", () => {
  it("moves a photo earlier or later and stays put at the edges", () => {
    const list = [src("a"), src("b"), src("c")];
    expect(keys(moveSlot(list, 2, 1))).toEqual(keys([src("a"), src("c"), src("b")]));
    expect(keys(moveSlot(list, 0, -1))).toEqual(keys(list));
    expect(keys(moveSlot(list, 2, 3))).toEqual(keys(list));
  });

  it("makes any photo the cover by moving it first", () => {
    expect(keys(coverSlot([src("a"), src("b"), src("c")], 2))).toEqual(keys([src("c"), src("a"), src("b")]));
  });

  it("removes a photo, but never the last one", () => {
    expect(keys(removeSlot([src("a"), src("b")], 0))).toEqual(keys([src("b")]));
    expect(keys(removeSlot([src("a")], 0))).toEqual(keys([src("a")]));
  });

  it("appends files as pending slots with a preview each, up to twelve in all", () => {
    const list = [src("a")];
    const chosen = new File(["x"], "p.jpg", { type: "image/jpeg" });
    const next = addFiles(list, [chosen], (f) => `blob:${f.name}`);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ kind: "file", preview: "blob:p.jpg" });
    const full = Array.from({ length: 12 }, (_, index) => src(`s${index}`));
    expect(addFiles(full, [new File([], "extra.jpg")], () => "blob:extra")).toHaveLength(12);
  });

  it("keys a slot by its src or its preview, so React can tell them apart", () => {
    expect(slotKey(src("a"))).toBe("/images/real/a.jpg");
    expect(slotKey(file("p"))).toBe("blob:p");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/photo-order.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

Create `src/lib/photo-order.ts`:

```ts
/**
 * The photo list as the sheet edits it, before anything is uploaded.
 *
 * A slot is a photo the garment already has (a src) or a file she has just
 * chosen (with an object URL to draw it). Every operation returns a new
 * list; nothing here touches the draft, the network or the DOM, so the
 * sheet's buttons are one call each and the rules are tested on their own.
 */

export type PhotoSlot =
  | { readonly kind: "src"; readonly src: string }
  | { readonly kind: "file"; readonly file: File; readonly preview: string };

export const MAX_PHOTOS = 12;

export function slotKey(slot: PhotoSlot): string {
  return slot.kind === "src" ? slot.src : slot.preview;
}

export function moveSlot(slots: readonly PhotoSlot[], from: number, to: number): PhotoSlot[] {
  if (to < 0 || to >= slots.length || from < 0 || from >= slots.length) return [...slots];
  const next = [...slots];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function coverSlot(slots: readonly PhotoSlot[], index: number): PhotoSlot[] {
  return moveSlot(slots, index, 0);
}

/** The last photo stays: a garment with no photo cannot be shown. */
export function removeSlot(slots: readonly PhotoSlot[], index: number): PhotoSlot[] {
  if (slots.length <= 1) return [...slots];
  return slots.filter((_, current) => current !== index);
}

export function addFiles(
  slots: readonly PhotoSlot[],
  files: readonly File[],
  preview: (file: File) => string,
): PhotoSlot[] {
  const room = Math.max(0, MAX_PHOTOS - slots.length);
  return [
    ...slots,
    ...files.slice(0, room).map((file): PhotoSlot => ({ kind: "file", file, preview: preview(file) })),
  ];
}
```

- [ ] **Step 4: Run the photo-order tests**

Run: `npx vitest run src/lib/photo-order.test.ts`
Expected: PASS.

- [ ] **Step 5: Give a draft change a place for editor state**

In `src/components/office/use-office-draft.tsx`, replace the `DraftChange` type with:

```ts
export type DraftChange<Wire> = {
  readonly wire: Wire;
  readonly files?: readonly File[];
  readonly withUploads?: (srcs: readonly string[]) => Wire;
  /**
   * Whatever the editor that staged this needs to redraw it: the sheet keeps
   * its photo slots here so a pending order survives closing and reopening.
   * The provider never reads it.
   */
  readonly meta?: unknown;
};
```

- [ ] **Step 6: Write the failing garment-draft tests**

Create `src/components/office/garment-draft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PhotoSlot } from "@/lib/photo-order";
import { overrideChange, unchanged, viewOf, type ManagedStyle, type OverrideView } from "./garment-draft";

const row: ManagedStyle = {
  id: "frutera",
  slug: "frutera",
  name: "Conjunto Frutera",
  category: "Herencia",
  price: 29500,
  photos: ["/images/real/frutera-capri.jpg", "/images/real/frutera-campaign.jpg"],
  isPublished: true,
  inStudio: false,
  sizes: [
    { sizeId: "s", inStock: true },
    { sizeId: "m", inStock: true },
    { sizeId: "l", inStock: false },
  ],
  retired: false,
  undoable: false,
  texts: {
    name: { es: "Conjunto Frutera", en: "Frutera two-piece" },
    color: { es: "Esmeralda", en: "Emerald" },
    description: { es: "Blusa esmeralda.", en: "An emerald blouse." },
    detail: { es: "", en: "" },
  },
  codedTexts: {
    name: { es: "Conjunto Frutera", en: "Frutera two-piece" },
    color: { es: "Esmeralda", en: "Emerald" },
    description: { es: "Blusa esmeralda.", en: "An emerald blouse." },
    detail: { es: "", en: "" },
  },
};

const fileSlot = (name: string): PhotoSlot => ({
  kind: "file",
  file: new File(["x"], `${name}.jpg`, { type: "image/jpeg" }),
  preview: `blob:${name}`,
});

describe("viewOf", () => {
  it("mirrors the saved row when nothing is pending", () => {
    const view = viewOf(row, undefined);
    expect(view.isPublished).toBe(true);
    expect(view.inStudio).toBe(false);
    expect(view.stock).toEqual({ s: true, m: true, l: false });
    expect(view.slots).toEqual(row.photos.map((src) => ({ kind: "src", src })));
  });

  it("redraws a pending change from its meta", () => {
    const pending = overrideChange(row.id, { ...viewOf(row, undefined), inStudio: true });
    expect(viewOf(row, pending).inStudio).toBe(true);
  });
});

describe("overrideChange", () => {
  it("lists only srcs on the wire and carries no files when there are none", () => {
    const change = overrideChange(row.id, viewOf(row, undefined));
    expect(change.wire).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: { s: true, m: true, l: false },
      photos: row.photos,
      inStudio: false,
    });
    expect(change.files).toBeUndefined();
    expect(change.withUploads).toBeUndefined();
    expect(change.meta).toEqual(viewOf(row, undefined).slots);
  });

  it("carries chosen files and puts their uploaded srcs back in slot order", () => {
    const view: OverrideView = {
      ...viewOf(row, undefined),
      slots: [fileSlot("new"), { kind: "src", src: row.photos[0] }, { kind: "src", src: row.photos[1] }],
    };
    const change = overrideChange(row.id, view);
    expect(change.files?.map((file) => file.name)).toEqual(["new.jpg"]);
    expect(change.wire.type === "style-override" && change.wire.photos).toEqual(row.photos);
    const uploaded = change.withUploads!(["/uploads/img-new12345.jpg"]);
    expect(uploaded.type === "style-override" && uploaded.photos).toEqual([
      "/uploads/img-new12345.jpg",
      row.photos[0],
      row.photos[1],
    ]);
  });
});

describe("unchanged", () => {
  it("is true when the view matches the saved row and false for any edit", () => {
    const view = viewOf(row, undefined);
    expect(unchanged(view, row)).toBe(true);
    expect(unchanged({ ...view, stock: { ...view.stock, l: true } }, row)).toBe(false);
    expect(unchanged({ ...view, isPublished: false }, row)).toBe(false);
    expect(unchanged({ ...view, inStudio: true }, row)).toBe(false);
    expect(unchanged({ ...view, slots: [view.slots[1], view.slots[0]] }, row)).toBe(false);
    expect(unchanged({ ...view, slots: [...view.slots, fileSlot("new")] }, row)).toBe(false);
  });
});
```

- [ ] **Step 7: Run them to see them fail**

Run: `npx vitest run src/components/office/garment-draft.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 8: Write the module**

Create `src/components/office/garment-draft.ts`:

```ts
import type { CollectionChange } from "@/lib/office-validation";
import { type PhotoSlot } from "@/lib/photo-order";
import type { DraftChange } from "./use-office-draft";

/**
 * What the sheet knows about one garment, and how its state becomes a draft
 * change. Pure: the components call these and stage the result.
 */

export type SizeId = "s" | "m" | "l";
export type Stock = Record<SizeId, boolean>;

export type ManagedStyle = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  /** Cents, from the price list through the garment's price entry; null when the pair has none. */
  readonly price: number | null;
  /** Current order, cover first, as the site shows it now. */
  readonly photos: readonly string[];
  readonly isPublished: boolean;
  readonly inStudio: boolean;
  readonly sizes: readonly { readonly sizeId: SizeId; readonly inStock: boolean }[];
  readonly retired: boolean;
  readonly undoable: boolean;
  readonly texts: {
    readonly name: { readonly es: string; readonly en: string };
    readonly color: { readonly es: string; readonly en: string };
    readonly description: { readonly es: string; readonly en: string };
    readonly detail: { readonly es: string; readonly en: string };
  };
  readonly codedTexts: ManagedStyle["texts"];
};

export type OverrideView = {
  readonly isPublished: boolean;
  readonly inStudio: boolean;
  readonly stock: Stock;
  readonly slots: readonly PhotoSlot[];
};

type OverrideWire = Extract<CollectionChange, { type: "style-override" }>;

export function overrideKey(styleId: string): string {
  return `style:${styleId}`;
}

function stockOf(row: ManagedStyle): Stock {
  const stock: Stock = { s: false, m: false, l: false };
  for (const size of row.sizes) stock[size.sizeId] = size.inStock;
  return stock;
}

/** The sheet's state: the pending change if there is one, otherwise the saved row. */
export function viewOf(row: ManagedStyle, pending: DraftChange<CollectionChange> | undefined): OverrideView {
  const wire = pending?.wire.type === "style-override" ? pending.wire : undefined;
  const slots = Array.isArray(pending?.meta) ? (pending!.meta as readonly PhotoSlot[]) : undefined;
  return {
    isPublished: wire?.isPublished ?? row.isPublished,
    inStudio: wire?.inStudio ?? row.inStudio,
    stock: { ...stockOf(row), ...(wire?.stock ?? {}) },
    slots: slots ?? row.photos.map((src) => ({ kind: "src", src })),
  };
}

/** One draft change for the garment: srcs on the wire now, files uploaded at confirm and put back in slot order. */
export function overrideChange(styleId: string, view: OverrideView): DraftChange<CollectionChange> {
  const wire: OverrideWire = {
    type: "style-override",
    key: overrideKey(styleId),
    styleId,
    isPublished: view.isPublished,
    stock: view.stock,
    photos: view.slots.flatMap((slot) => (slot.kind === "src" ? [slot.src] : [])),
    inStudio: view.inStudio,
  };
  const files = view.slots.flatMap((slot) => (slot.kind === "file" ? [slot.file] : []));
  if (files.length === 0) return { wire, meta: view.slots };
  return {
    wire,
    files,
    meta: view.slots,
    withUploads: (srcs) => {
      let next = 0;
      return {
        ...wire,
        photos: view.slots.map((slot) => (slot.kind === "src" ? slot.src : (srcs[next++] ?? ""))).filter((src) => src.length > 0),
      };
    },
  };
}

/** True when confirming would change nothing, so the entry can leave the draft. */
export function unchanged(view: OverrideView, row: ManagedStyle): boolean {
  const saved = stockOf(row);
  return (
    view.isPublished === row.isPublished &&
    view.inStudio === row.inStudio &&
    view.stock.s === saved.s &&
    view.stock.m === saved.m &&
    view.stock.l === saved.l &&
    view.slots.length === row.photos.length &&
    view.slots.every((slot, index) => slot.kind === "src" && slot.src === row.photos[index])
  );
}
```

- [ ] **Step 9: Run the tests and the typecheck**

Run: `npx vitest run src/components/office/garment-draft.test.ts src/lib/photo-order.test.ts && npm run typecheck 2>&1 | grep -v "collection/actions.ts\|style-composer.tsx\|collection-manager.tsx" | tail -5`
Expected: tests PASS; the only typecheck errors left are in the three files Tasks 4 and 6 replace.

- [ ] **Step 10: Commit**

```bash
git add src/lib/photo-order.ts src/lib/photo-order.test.ts src/components/office/garment-draft.ts src/components/office/garment-draft.test.ts src/components/office/use-office-draft.tsx
git commit -m "Pure helpers for the garment sheet: the photo list and the draft change

A slot is a photo the garment has or a file just chosen; move, cover,
remove and add are one call each. overrideChange turns the sheet's state
into one draft change, srcs on the wire and files uploaded at confirm
then put back in slot order, and keeps the slots in the change's meta so
a pending order survives closing the sheet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The garment action: photo ownership, Spanish in, English written

**Files:**
- Modify: `src/app/[locale]/office/collection/actions.ts` (whole file)
- Modify: `src/messages/es.json`, `src/messages/en.json` (three `office.error` keys)

**Interfaces:**
- Consumes: Task 1's `translateToEnglish`, `withEnglish`, `translationEnabled`; Task 2's schemas and `StyleOverride` fields.
- Produces: `applyCollectionChanges` accepting `style-override` with `photos`/`inStudio`, `style-create` in Spanish, `style-text` that writes both languages, and `translate`; refusal codes `unknown-photo`, `translation-off`, `translation-failed`. Task 6 stages against exactly these.

- [ ] **Step 1: The refusal words**

In `src/messages/es.json`, inside `office.error` after the `"entry-retired"` line add:

```json
      "unknown-photo": "Esa foto no es de esta prenda.",
      "translation-off": "La traducción automática no está configurada; el inglés queda igual al español.",
      "translation-failed": "No se pudo traducir ahora. Intente otra vez."
```

In `src/messages/en.json`, the same keys:

```json
      "unknown-photo": "That photo does not belong to this garment.",
      "translation-off": "Automatic translation is not set up; the English stays a copy of the Spanish.",
      "translation-failed": "The translation did not come through. Try again."
```

Mind the comma on the line before each block.

- [ ] **Step 2: Rewrite the action**

Replace the whole of `src/app/[locale]/office/collection/actions.ts` with:

```ts
"use server";

import { styles } from "@/content";
import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { translationEnabled } from "@/lib/env";
import {
  addedStyles,
  assembleStyles,
  manageableStyles,
  saveAddedStyle,
  saveStyleOverride,
} from "@/lib/live-catalog";
import { saveTextOverride } from "@/lib/live-text";
import {
  TEXT_LIMITS,
  collectionChangeSchema,
  changesOf,
} from "@/lib/office-validation";
import {
  CUSTOMIZATION_EXTRA,
  liveFabrics,
  livePriceList,
  manageablePriceList,
  saveCustomEntry,
} from "@/lib/live-pricing";
import { restoreRefusal } from "@/lib/in-use";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { slugify } from "@/lib/slugify";
import { translateToEnglish, withEnglish } from "@/lib/translate";

type Field = "name" | "color" | "description" | "detail";

/**
 * A Spanish correction carries its English with it: translated when the
 * service answers, a copy of the Spanish otherwise, which the office shows
 * as "Inglés pendiente" until she asks for it again.
 */
async function writeEnglishFor(id: string, spanish: Partial<Record<Field, string>>): Promise<void> {
  const english = await translateToEnglish(spanish, "garment");
  for (const [field, es] of Object.entries(spanish) as [Field, string][]) {
    await saveTextOverride({ subject: "style", id, field, locale: "en", value: english?.[field] ?? es });
  }
}

export const applyCollectionChanges = ownerAction(
  changesOf(collectionChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "style-override": {
          const style = manageableStyles().find((candidate) => candidate.id === change.styleId);
          if (!style) throw new ChangeRefused("unknown-style");
          const { type: _type, key: _key, ...override } = change;
          if (override.photos) {
            // What the garment owns: the photos it shipped or was created
            // with (even ones hidden today), whatever it shows now, and any
            // upload, whose path only this server can have issued.
            const shipped = assembleStyles(styles, addedStyles(), [], new Set()).find(
              (candidate) => candidate.id === change.styleId,
            );
            const owned = new Set([
              ...(shipped?.photos ?? []).map((photo) => photo.src),
              ...style.photos.map((photo) => photo.src),
            ]);
            if (override.photos.some((src) => !owned.has(src) && !src.startsWith("/uploads/"))) {
              throw new ChangeRefused("unknown-photo");
            }
          }
          await saveStyleOverride({
            ...override,
            // Readers of older records, and undo, still look at addedPhotos.
            ...(override.photos
              ? { addedPhotos: override.photos.filter((src) => src.startsWith("/uploads/")) }
              : {}),
          });
          return;
        }
        case "style-text": {
          if (!manageableStyles().some((style) => style.id === change.id)) {
            throw new ChangeRefused("unknown-style");
          }
          if (change.value.length > TEXT_LIMITS[change.field]) {
            throw new ChangeRefused("too-long");
          }
          await saveTextOverride({
            subject: "style",
            id: change.id,
            field: change.field,
            locale: change.locale,
            value: change.value,
          });
          if (change.locale === "es") {
            if (change.value.length === 0) {
              // A cleared box returns both languages to the coded words.
              await saveTextOverride({ subject: "style", id: change.id, field: change.field, locale: "en", value: "" });
            } else {
              await writeEnglishFor(change.id, { [change.field]: change.value });
            }
          }
          return;
        }
        case "translate": {
          if (!translationEnabled) throw new ChangeRefused("translation-off");
          const style = manageableStyles().find((candidate) => candidate.id === change.id);
          if (!style) throw new ChangeRefused("unknown-style");
          const spanish = Object.fromEntries(change.fields.map((field) => [field, style[field].es]));
          const english = await translateToEnglish(spanish, "garment");
          if (!english) throw new ChangeRefused("translation-failed");
          for (const field of change.fields) {
            const value = english[field];
            if (value) await saveTextOverride({ subject: "style", id: change.id, field, locale: "en", value });
          }
          return;
        }
        case "style-create": {
          const { type: _type, key: _key, ...draft } = change;
          if (!liveFabrics().some((fabric) => fabric.id === draft.fabricId)) {
            throw new ChangeRefused("unknown-fabric");
          }
          if (!Object.values(draft.sizes).some(Boolean)) {
            throw new ChangeRefused("no-sizes");
          }

          const priceEntryId = `${draft.categoryId}--${draft.fabricId}`;
          const existing = manageablePriceList().find((entry) => entry.id === priceEntryId);
          if (existing?.retired) throw new ChangeRefused("entry-retired");
          if (!existing) {
            if (draft.fixedPrice === undefined || draft.fixedPrice <= 0) {
              throw new ChangeRefused("price-required");
            }
            await saveCustomEntry({
              id: priceEntryId,
              categoryId: draft.categoryId,
              fabricId: draft.fabricId,
              fixedPrice: draft.fixedPrice,
              customizationExtra: CUSTOMIZATION_EXTRA[draft.categoryId] ?? 9500,
              customizationNote: {
                en: "Made to your measurements, with your choice of neckline, sleeve and length.",
                es: "Hecho a su medida, con el escote, la manga y el largo que usted elija.",
              },
              effectiveDate: new Date().toISOString().slice(0, 10),
            });
          }

          const spanish = {
            name: draft.name,
            color: draft.color,
            description: draft.description,
            detail: draft.detail,
          };
          const words = withEnglish(spanish, await translateToEnglish(spanish, "garment"));

          // Retired styles keep their slugs so restoring one cannot create a collision.
          const taken = new Set(manageableStyles().map((style) => style.slug));
          const base = slugify(words.name.es, 50) || newReference("STY").toLowerCase();
          let slug = base;
          for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

          await saveAddedStyle({
            id: newReference("STY").toLowerCase(),
            slug,
            name: words.name,
            categoryId: draft.categoryId,
            priceEntryId,
            color: words.color,
            description: words.description,
            detail: words.detail,
            sizes: (["s", "m", "l"] as const).map((sizeId) => ({
              sizeId,
              inStock: draft.sizes[sizeId],
            })),
            photos: draft.photos.map((src, index) => ({
              src,
              alt: words.name,
              isPrimary: index === 0,
            })),
            customizationAvailable: true,
            isPublished: true,
            inStudio: draft.inStudio,
          });
          return;
        }
        case "retire":
          if (!manageableStyles().some((style) => style.id === change.id)) {
            throw new ChangeRefused("unknown-style");
          }
          await setRetired("style", change.id, true);
          return;
        case "restore": {
          const style = manageableStyles().find((candidate) => candidate.id === change.id);
          if (!style) throw new ChangeRefused("unknown-style");
          const refusal = restoreRefusal(style, livePriceList());
          if (refusal) throw new ChangeRefused(refusal);
          await setRetired("style", change.id, false);
        }
      }
    }),
  {
    revalidate: [
      "/[locale]/office/collection",
      "/[locale]",
      "/[locale]/collection",
      "/[locale]/collection/[slug]",
      "/[locale]/prices",
      "/[locale]/request",
      "/[locale]/design-studio",
    ],
  },
);
```

- [ ] **Step 3: Run the structure scan, the key-parity test and the typecheck**

Run: `npx vitest run src/lib/action-guard.test.ts src/components/office/tabs.test.ts && npm run typecheck 2>&1 | grep -v "style-composer.tsx\|collection-manager.tsx" | tail -5`
Expected: tests PASS (one export, produced by `ownerAction`, `"use server"` first); the only typecheck errors left are in the two components Task 6 deletes. If `style[field].es` is rejected, `style` is typed without the `Field` keys: index as `style[field as keyof typeof style]` is wrong; instead write `const text = { name: style.name, color: style.color, description: style.description, detail: style.detail }[field].es;`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/office/collection/actions.ts" src/messages/es.json src/messages/en.json
git commit -m "The garment action learns the photo list, Spanish-only words and translation

A photo list is checked against what the garment owns, hidden coded
photos included, and any upload. A new garment arrives in Spanish and
leaves with its English, translated or copied. A Spanish correction
carries its English with it; a cleared box clears both. A translate
change asks for the English later, and says so when the service is off.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The sheet and the switch

**Files:**
- Create: `src/components/office/sheet.tsx`
- Create: `src/components/office/switch.tsx`
- Create: `src/components/office/sheet.test.ts`
- Modify: `src/messages/es.json`, `src/messages/en.json` (`sheetDone`, `sheetClose`)

**Interfaces:**
- Produces: `<Sheet open title onClose>{children}</Sheet>` and `<Switch checked onChange label disabled?>`. Task 6 composes the garment sheet from them.

- [ ] **Step 1: Write the structural test**

Create `src/components/office/sheet.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The sheet is where Daysi edits one thing at a time. The agreements the
 * design makes (Amendment 4 §2) are checked in the source: it sits below
 * the confirm bar and leaves the bar's height free, Escape and the phone's
 * back gesture close it, and the history entry it pushes keeps Next's own
 * state so the router never sees a foreign entry.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office/sheet.tsx"), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

describe("the sheet", () => {
  it("is a dialog that stays under the confirm bar", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("fixed inset-0 z-20");
    expect(source).toContain("bottom-16");
  });

  it("closes on Escape and on the back gesture, and keeps the router's history state", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('window.addEventListener("popstate"');
    expect(source).toContain("window.history.pushState({ ...window.history.state, sheet: true }");
  });

  it("is closed by Listo in both languages", () => {
    expect(office(es).sheetDone).toBe("Listo");
    expect(office(en).sheetDone).toBe("Done");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/office/sheet.test.ts`
Expected: FAIL (no such file).

- [ ] **Step 3: The words**

In `src/messages/es.json`, in `office` after `"noChanges": "Sin cambios",` add:

```json
    "sheetDone": "Listo",
    "sheetClose": "Cerrar",
```

In `src/messages/en.json`, after `"noChanges": "No changes",` add:

```json
    "sheetDone": "Done",
    "sheetClose": "Close",
```

- [ ] **Step 4: The sheet**

Create `src/components/office/sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui";

/**
 * A place to edit one thing, not a place that saves.
 *
 * Under 640 px it fills the screen; above, it is a panel on the right.
 * Either way it sits above the page and below the confirm bar, and leaves
 * the bar's height free at its foot, so Confirmar cambios is always there
 * (design, Amendment 4 §2). Every control inside stages into the tab's
 * draft, so closing loses nothing: Listo, Escape, the backdrop and the
 * phone's back gesture all just close.
 *
 * The back gesture works through one pushed history entry per open sheet.
 * The entry keeps Next's own state (spread first) so the router still
 * recognises it; closing by any other route pops that entry again. The
 * effect runs on `open` and `onClose`, so `onClose` must be stable
 * (`useCallback`): a fresh function on every render would pop the entry
 * while the sheet is still open.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}): JSX.Element | null {
  const t = useTranslations("office");
  const panel = useRef<HTMLDivElement>(null);
  const closing = useRef<"pop" | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const pop = () => {
      closing.current = "pop";
      onClose();
    };
    window.history.pushState({ ...window.history.state, sheet: true }, "");
    window.addEventListener("popstate", pop);
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", key);
      window.removeEventListener("popstate", pop);
      document.body.style.overflow = overflow;
      if (closing.current !== "pop" && window.history.state?.sheet) window.history.back();
      closing.current = null;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-ink/40" aria-hidden onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 top-0 bottom-16 flex flex-col bg-paper shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[28rem] sm:border-l sm:border-line"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 className="min-w-0 truncate font-display text-[1.25rem]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sheetClose")}
            className={buttonClass({ size: "small", tone: "solid" })}
          >
            {t("sheetDone")}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: The switch**

Create `src/components/office/switch.tsx`:

```tsx
"use client";

import type { JSX } from "react";

/** One on/off switch with its label, the size of a thumb. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-[0.9375rem]">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          checked ? "bg-ink" : "bg-paper-deep"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-1 h-5 w-5 rounded-full bg-paper transition-[left] ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  );
}
```

- [ ] **Step 6: Run the test, key parity and the typecheck**

Run: `npx vitest run src/components/office/sheet.test.ts src/components/office/tabs.test.ts && npm run typecheck 2>&1 | grep -v "style-composer.tsx\|collection-manager.tsx" | tail -5`
Expected: PASS; only the two doomed components still fail the typecheck.

- [ ] **Step 7: Commit**

```bash
git add src/components/office/sheet.tsx src/components/office/switch.tsx src/components/office/sheet.test.ts src/messages/es.json src/messages/en.json
git commit -m "Add the sheet and the switch the office edits with

The sheet fills a phone and is a panel on a computer, sits under the
confirm bar and leaves its height free, and closes on Listo, Escape, the
backdrop or the back gesture without losing anything, because every
control inside stages into the draft. The switch is one thumb-sized
on/off with its label.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Colección as cards, and the garment sheet

**Files:**
- Create: `src/components/office/garment-photos.tsx`
- Create: `src/components/office/garment-words.tsx`
- Create: `src/components/office/garment-sheet.tsx`
- Create: `src/components/collection-cards.tsx`
- Create: `src/components/collection-cards.test.ts`
- Modify: `src/app/[locale]/office/collection/page.tsx` (whole file)
- Delete: `src/components/collection-manager.tsx`, `src/components/style-composer.tsx`
- Modify: `src/messages/es.json`, `src/messages/en.json` (the sheet's words)

**Interfaces:**
- Consumes: Task 3's `photo-order` and `garment-draft`; Task 5's `Sheet` and `Switch`; Task 4's change types and refusal codes; `Pending`, `RetireButton`, `RetiredGroup`, `UndoLink`, `useOfficeDraft`, `buttonClass`, `centsFromInput`, `formatMoney` as they exist.
- Produces: `<CollectionCards styles retired locale categories fabrics pricedPairs undoableTexts />`; `GarmentSheet`, `NewGarmentSheet`, `Picker`.

- [ ] **Step 1: Write the structural test**

Create `src/components/collection-cards.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * Colección is cards and a sheet since 15 September 2026. The old row
 * editor and the add form are gone, nothing asks with a browser pop-up any
 * more, and the sheet's words exist in both languages. No DOM here, so the
 * agreements are read from the source, as the tab strip's are.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");
const office = (bundle: { office: object }) => bundle.office as Record<string, string>;

describe("the collection tab", () => {
  it("renders cards and the sheet, not the old editor and form", () => {
    const page = read("src/app/[locale]/office/collection/page.tsx");
    expect(page).toContain("<CollectionCards");
    expect(page).not.toContain("CollectionManager");
    expect(page).not.toContain("StyleComposer");
    expect(existsSync(at("src/components/collection-manager.tsx"))).toBe(false);
    expect(existsSync(at("src/components/style-composer.tsx"))).toBe(false);
  });

  it("never asks with a browser pop-up", () => {
    for (const file of [
      "src/components/collection-cards.tsx",
      "src/components/office/garment-sheet.tsx",
      "src/components/office/garment-photos.tsx",
      "src/components/office/garment-words.tsx",
    ]) {
      expect(read(file), file).not.toContain("window.confirm(");
    }
  });

  it("types Spanish only on the create sheet and stages one style-create", () => {
    const sheet = read("src/components/office/garment-sheet.tsx");
    expect(sheet).toContain('type: "style-create"');
    expect(sheet).not.toContain("nameEn");
    expect(sheet).toContain("inStudio");
  });

  it("has the sheet's words in both languages, and not the pop-up's", () => {
    for (const bundle of [es, en]) {
      const words = office(bundle);
      for (const key of [
        "addGarment", "newGarmentTitle", "photosTitle", "photoCoverMark", "photoMakeCover",
        "photoEarlier", "photoLater", "photoRemove", "photoAdd", "photoUploadsOnConfirm",
        "wordsTitle", "seeEnglish", "hideEnglish", "englishPending", "translateNow",
        "correctEnglish", "sizesTitle", "shownOnSite", "inStudio", "hiddenChip", "studioChip",
        "priceUnknown", "dropChanges",
      ]) {
        expect(words[key], key).toBeTruthy();
        expect(words[key], key).not.toContain("—");
      }
      expect("photoCoverAsk" in words).toBe(false);
      expect("addPhoto" in words).toBe(false);
    }
    expect(office(es).inStudio).toBe("Se ofrece en el estudio");
    expect(office(es).seeEnglish).toBe("Ver inglés");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/collection-cards.test.ts`
Expected: FAIL on every test.

- [ ] **Step 3: The words**

In `src/messages/es.json` under `office`:

Replace these existing values:

```json
    "collectionLead": "Toque una prenda para abrirla: sus fotos, sus palabras, sus tallas y si se muestra. Las tallas también se cambian desde la tarjeta.",
    "styleAddLead": "Una pieza que usted hizo y quiere vender. Queda en la lista como pendiente hasta que confirme.",
    "styleSave": "Agregar a los cambios",
    "styleNote": "Escriba en español. El inglés se escribe solo cuando confirma; puede verlo y corregirlo con Ver inglés.",
```

Delete the lines for `"styleAddTitle"`, `"addPhoto"` and `"photoCoverAsk"`.

Add, after `"sheetClose": "Cerrar",`:

```json
    "addGarment": "Agregar una prenda",
    "newGarmentTitle": "Una prenda nueva",
    "photosTitle": "Las fotos",
    "photoCoverMark": "Portada",
    "photoMakeCover": "Hacer portada",
    "photoEarlier": "Mover antes",
    "photoLater": "Mover después",
    "photoRemove": "Quitar",
    "photoAdd": "Agregar fotos",
    "photoUploadsOnConfirm": "Sube al confirmar",
    "wordsTitle": "Las palabras",
    "seeEnglish": "Ver inglés",
    "hideEnglish": "Ocultar inglés",
    "englishPending": "Inglés pendiente",
    "translateNow": "Traducir",
    "correctEnglish": "Corregir",
    "sizesTitle": "Tallas en existencia",
    "shownOnSite": "Se muestra en el sitio",
    "inStudio": "Se ofrece en el estudio",
    "hiddenChip": "Oculta",
    "studioChip": "Estudio",
    "priceUnknown": "Sin precio",
    "dropChanges": "Quitar los cambios",
```

In `src/messages/en.json`, the same edits with these values:

```json
    "collectionLead": "Tap a garment to open it: its photos, its words, its sizes and whether it is shown. Sizes can also be changed from the card.",
    "styleAddLead": "A piece you have made and want to sell. It sits in the list as pending until you confirm.",
    "styleSave": "Add to the changes",
    "styleNote": "Write in Spanish. The English is written when you confirm; see and correct it with See the English.",
```

```json
    "addGarment": "Add a garment",
    "newGarmentTitle": "A new garment",
    "photosTitle": "The photos",
    "photoCoverMark": "Cover",
    "photoMakeCover": "Make it the cover",
    "photoEarlier": "Move earlier",
    "photoLater": "Move later",
    "photoRemove": "Remove",
    "photoAdd": "Add photos",
    "photoUploadsOnConfirm": "Uploads when you confirm",
    "wordsTitle": "The words",
    "seeEnglish": "See the English",
    "hideEnglish": "Hide the English",
    "englishPending": "English pending",
    "translateNow": "Translate",
    "correctEnglish": "Correct",
    "sizesTitle": "Sizes in stock",
    "shownOnSite": "Shown on the site",
    "inStudio": "Offered in the design studio",
    "hiddenChip": "Hidden",
    "studioChip": "Studio",
    "priceUnknown": "No price",
    "dropChanges": "Drop the changes",
```

Run `npx vitest run src/components/office/tabs.test.ts -t "same keys"` to prove both files still agree.

- [ ] **Step 4: The photo grid**

Create `src/components/office/garment-photos.tsx`:

```tsx
"use client";

import Image from "next/image";
import type { JSX } from "react";
import { useTranslations } from "next-intl";
import {
  MAX_PHOTOS,
  addFiles,
  coverSlot,
  moveSlot,
  removeSlot,
  slotKey,
  type PhotoSlot,
} from "@/lib/photo-order";

/**
 * Every photo of the garment, in the order the site will show them, the
 * first marked as the cover. Each has Hacer portada, Mover antes, Mover
 * después and Quitar; a "+" tile adds files, which show as pending until
 * confirm uploads them. Arrows rather than drag: a drag that works under a
 * mouse and a thumb needs a library or a pointer engine, and a garment has
 * two to four photos.
 */
export function GarmentPhotos({
  slots,
  onChange,
  max = MAX_PHOTOS,
  disabled,
}: {
  slots: readonly PhotoSlot[];
  onChange(next: PhotoSlot[]): void;
  max?: number;
  disabled?: boolean;
}): JSX.Element {
  const t = useTranslations("office");
  const link = "min-h-8 text-[0.6875rem] underline underline-offset-4 disabled:opacity-60";

  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {slots.map((slot, index) => (
        <li key={slotKey(slot)} className="flex flex-col gap-1.5">
          <span
            className={`relative block aspect-3/4 overflow-hidden border ${
              index === 0 ? "border-2 border-marigold" : "border-line"
            }`}
          >
            {slot.kind === "src" ? (
              <Image src={slot.src} alt="" fill sizes="(min-width: 640px) 6rem, 30vw" className="object-cover" />
            ) : (
              <Image src={slot.preview} alt="" fill unoptimized sizes="6rem" className="object-cover" />
            )}
            {index === 0 ? (
              <span className="absolute left-1 top-1 bg-marigold px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink">
                {t("photoCoverMark")}
              </span>
            ) : null}
          </span>
          {slot.kind === "file" ? (
            <span className="text-[0.6875rem] text-marigold-deep">{t("photoUploadsOnConfirm")}</span>
          ) : null}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0">
            {index > 0 ? (
              <button type="button" disabled={disabled} onClick={() => onChange(coverSlot(slots, index))} className={link}>
                {t("photoMakeCover")}
              </button>
            ) : null}
            {index > 0 ? (
              <button type="button" disabled={disabled} aria-label={t("photoEarlier")} onClick={() => onChange(moveSlot(slots, index, index - 1))} className={link}>
                ◀
              </button>
            ) : null}
            {index < slots.length - 1 ? (
              <button type="button" disabled={disabled} aria-label={t("photoLater")} onClick={() => onChange(moveSlot(slots, index, index + 1))} className={link}>
                ▶
              </button>
            ) : null}
            {slots.length > 1 ? (
              <button type="button" disabled={disabled} onClick={() => onChange(removeSlot(slots, index))} className={link}>
                {t("photoRemove")}
              </button>
            ) : null}
          </span>
        </li>
      ))}
      {slots.length < max ? (
        <li>
          <label className="flex aspect-3/4 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-line-strong text-center text-[0.75rem] text-ink-faint hover:border-ink">
            <span className="text-2xl leading-none">+</span>
            {t("photoAdd")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={disabled}
              className="sr-only"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length > 0) {
                  onChange(addFiles(slots, files, (file) => URL.createObjectURL(file)).slice(0, max));
                }
                event.target.value = "";
              }}
            />
          </label>
        </li>
      ) : null}
    </ul>
  );
}
```

- [ ] **Step 5: The words**

Create `src/components/office/garment-words.tsx`:

```tsx
"use client";

import { useState, type FocusEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import { TEXT_LIMITS, type CollectionChange } from "@/lib/office-validation";
import { Pending } from "./confirm-bar";
import type { ManagedStyle } from "./garment-draft";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

type Field = "name" | "color" | "description" | "detail";
type LabelKey = "styleName" | "styleColor" | "styleDescription" | "styleDetail";
const FIELDS: readonly { readonly field: Field; readonly labelKey: LabelKey; readonly multiline: boolean }[] = [
  { field: "name", labelKey: "styleName", multiline: false },
  { field: "color", labelKey: "styleColor", multiline: false },
  { field: "description", labelKey: "styleDescription", multiline: true },
  { field: "detail", labelKey: "styleDetail", multiline: true },
];

const box = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink focus:border-ink";

/**
 * The words of one garment, typed in Spanish. The English is written at
 * confirm; Ver inglés shows it read-only, marks a line whose English still
 * equals its Spanish as pending with a Traducir link, and Corregir opens a
 * box for the rare English she wants to write herself. Every box stages
 * the same style-text change the old editor did, keyed per field and
 * language, so undo and history are unchanged.
 */
export function GarmentWords({
  row,
  undoable,
}: {
  row: ManagedStyle;
  undoable: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const [english, setEnglish] = useState(false);
  const [correcting, setCorrecting] = useState<readonly Field[]>([]);

  const textKey = (field: Field, locale: "es" | "en") => `text:style:${row.id}:${field}:${locale}`;
  const staged = (field: Field, locale: "es" | "en"): string | undefined => {
    const wire = draft.pending(textKey(field, locale))?.change.wire;
    return wire?.type === "style-text" ? wire.value : undefined;
  };
  const current = (field: Field, locale: "es" | "en") => staged(field, locale) ?? row.texts[field][locale];
  const pendingEnglish = FIELDS.map(({ field }) => field).filter(
    (field) => current(field, "es") !== "" && current(field, "en") === current(field, "es"),
  );
  const translateKey = `translate:style:${row.id}`;
  const translating = draft.pending(translateKey);

  function blur(field: Field, locale: "es" | "en", event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const value = event.target.value.trim();
    const merged = row.texts[field][locale];
    const coded = row.codedTexts[field][locale];
    const key = textKey(field, locale);
    if (value === merged || (value === "" && merged === coded)) {
      draft.unstage(key);
      return;
    }
    draft.stage(key, { wire: { type: "style-text", key, id: row.id, field, locale, value } });
  }

  function control(field: Field, locale: "es" | "en", multiline: boolean, label: string): JSX.Element {
    const value = current(field, locale);
    const common = {
      defaultValue: value,
      maxLength: TEXT_LIMITS[field],
      "aria-label": label,
      className: box,
      onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => blur(field, locale, event),
    };
    return multiline ? (
      <textarea key={`${field}:${locale}:${value}`} rows={3} {...common} />
    ) : (
      <input key={`${field}:${locale}:${value}`} type="text" {...common} />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-[0.9375rem] font-medium">{t("wordsTitle")}</h3>
      {FIELDS.map(({ field, labelKey, multiline }) => {
        const pending = draft.pending(textKey(field, "es"));
        return (
          <label key={field} className="grid gap-1 text-[0.75rem] text-ink-faint">
            <span className="flex items-center gap-2">
              {t(labelKey)}
              {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
            </span>
            {control(field, "es", multiline, t(labelKey))}
            {undoable.has(`${row.id}:${field}:es`) && !pending ? (
              <UndoLink kind="style-text" id={`${row.id}:${field}:es`} />
            ) : null}
          </label>
        );
      })}
      <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("styleNote")}</p>

      <button
        type="button"
        onClick={() => setEnglish(!english)}
        aria-expanded={english}
        className="w-fit text-xs underline underline-offset-4"
      >
        {english ? t("hideEnglish") : t("seeEnglish")}
      </button>

      {english ? (
        <div className="grid gap-3 border-l border-line pl-4">
          {pendingEnglish.length > 0 ? (
            <span className="flex flex-wrap items-center gap-3 text-[0.8125rem]">
              <span className="font-semibold text-marigold-deep">{t("englishPending")}</span>
              {translating ? (
                <Pending confirming={translating.confirming} error={translating.error} />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    draft.stage(translateKey, {
                      wire: { type: "translate", key: translateKey, id: row.id, fields: pendingEnglish },
                    })
                  }
                  className="underline underline-offset-4"
                >
                  {t("translateNow")}
                </button>
              )}
            </span>
          ) : null}
          {FIELDS.map(({ field, labelKey, multiline }) => {
            const pending = draft.pending(textKey(field, "en"));
            const open = correcting.includes(field) || pending !== undefined;
            const label = `${t(labelKey)}, ${t("textsEnglish")}`;
            return (
              <div key={field} className="grid gap-1 text-[0.75rem] text-ink-faint">
                <span className="flex items-center gap-2">
                  {label}
                  {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
                  {!pending && pendingEnglish.includes(field) ? (
                    <span className="text-marigold-deep">{t("englishPending")}</span>
                  ) : null}
                </span>
                {open ? (
                  control(field, "en", multiline, label)
                ) : (
                  <span className="flex items-start justify-between gap-3 text-[0.9375rem] text-ink">
                    <span className="min-w-0 whitespace-pre-wrap">{current(field, "en")}</span>
                    <button
                      type="button"
                      onClick={() => setCorrecting([...correcting, field])}
                      className="shrink-0 text-xs underline underline-offset-4"
                    >
                      {t("correctEnglish")}
                    </button>
                  </span>
                )}
                {undoable.has(`${row.id}:${field}:en`) && !pending ? (
                  <UndoLink kind="style-text" id={`${row.id}:${field}:en`} />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 6: The sheet's content, for a garment and for a new one**

Create `src/components/office/garment-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { centsFromInput, formatMoney } from "@/lib/money";
import type { CollectionChange } from "@/lib/office-validation";
import type { PhotoSlot } from "@/lib/photo-order";
import { buttonClass } from "@/components/ui";
import { Pending } from "./confirm-bar";
import {
  overrideChange,
  overrideKey,
  unchanged,
  viewOf,
  type ManagedStyle,
  type OverrideView,
  type SizeId,
} from "./garment-draft";
import { GarmentPhotos } from "./garment-photos";
import { GarmentWords } from "./garment-words";
import { RetireButton } from "./retired-group";
import { Switch } from "./switch";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

export type Picker = { readonly id: string; readonly label: string };
const SIZES: readonly SizeId[] = ["s", "m", "l"];
const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

/**
 * One garment, everything about it: the photos, the words, the sizes, shown,
 * offered in the studio, retire and undo. Every control stages into the one
 * style:<id> override (or a text change), and the sheet's state is read back
 * from the draft, so closing and reopening shows exactly what is pending.
 */
export function GarmentSheet({
  row,
  undoableTexts,
}: {
  row: ManagedStyle;
  undoableTexts: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const key = overrideKey(row.id);
  const entry = draft.pending(key);
  const retiring = entry?.change.wire.type === "retire";
  const view = viewOf(row, entry?.change);

  function update(next: OverrideView) {
    if (unchanged(next, row)) draft.unstage(key);
    else draft.stage(key, overrideChange(row.id, next));
  }

  return (
    <div className={`flex flex-col gap-8 ${retiring ? "opacity-50" : ""}`}>
      {entry ? (
        <span className="flex items-center gap-3">
          <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
          <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
            {t("dropChanges")}
          </button>
        </span>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("photosTitle")}</h3>
        <GarmentPhotos slots={view.slots} disabled={retiring} onChange={(slots) => update({ ...view, slots })} />
      </section>

      <GarmentWords row={row} undoable={undoableTexts} />

      <section className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-medium">{t("sizesTitle")}</h3>
        {SIZES.map((size) => (
          <Switch
            key={size}
            label={size.toUpperCase()}
            checked={view.stock[size]}
            disabled={retiring}
            onChange={(on) => update({ ...view, stock: { ...view.stock, [size]: on } })}
          />
        ))}
      </section>

      <section className="flex flex-col gap-1 border-t border-line pt-4">
        <Switch label={t("shownOnSite")} checked={view.isPublished} disabled={retiring} onChange={(on) => update({ ...view, isPublished: on })} />
        <Switch label={t("inStudio")} checked={view.inStudio} disabled={retiring} onChange={(on) => update({ ...view, inStudio: on })} />
      </section>

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton
            name={row.name}
            onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })}
          />
          {row.undoable && !entry ? <UndoLink kind="style-override" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A garment that does not exist yet: the same sheet, empty, in Spanish
 * only. Agregar a los cambios stages one style-create with its files and
 * closes; the card list shows it as pending until she confirms.
 */
export function NewGarmentSheet({
  categories,
  fabrics,
  pricedPairs,
  locale,
  onDone,
}: {
  categories: readonly Picker[];
  fabrics: readonly Picker[];
  pricedPairs: Readonly<Record<string, number>>;
  locale: Locale;
  onDone(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState<Record<SizeId, boolean>>({ s: true, m: true, l: true });
  const [inStudio, setInStudio] = useState(false);
  const [slots, setSlots] = useState<readonly PhotoSlot[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // Previews chosen and then abandoned (the sheet closed without adding) are
  // released here; the ones that were staged belong to the draft's entry.
  const staged = useRef(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(
    () => () => {
      if (staged.current) return;
      for (const slot of slotsRef.current) if (slot.kind === "file") URL.revokeObjectURL(slot.preview);
    },
    [],
  );

  const existingPrice = pricedPairs[`${categoryId}--${fabricId}`];
  const needsPrice = existingPrice === undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    const files = slots.flatMap((slot) => (slot.kind === "file" ? [slot.file] : []));
    if (files.length === 0) return setProblem(t("stylePhotoRequired"));
    if (!SIZES.some((size) => stock[size])) return setProblem(t("styleSizeRequired"));
    const cents = needsPrice ? centsFromInput(price) : null;
    if (needsPrice && !(cents !== null && cents > 0)) return setProblem(t("stylePriceRequired"));

    const key = `style-create:${crypto.randomUUID()}`;
    const wire: CollectionChange = {
      type: "style-create",
      key,
      name: name.trim(),
      color: color.trim(),
      description: description.trim(),
      detail: detail.trim(),
      categoryId,
      fabricId,
      sizes: stock,
      photos: [],
      inStudio,
      ...(needsPrice && cents !== null ? { fixedPrice: cents } : {}),
    };
    staged.current = true;
    draft.stage(key, {
      wire,
      files,
      withUploads: (srcs) => ({ ...wire, photos: [...srcs] }),
      meta: slots,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("styleAddLead")}</p>

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("photosTitle")}</h3>
        <GarmentPhotos slots={slots} max={8} onChange={setSlots} />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[0.9375rem] font-medium">{t("wordsTitle")}</h3>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleName")}
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required placeholder={t("styleNamePlaceholder")} className={field} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleColor")}
          <input value={color} onChange={(event) => setColor(event.target.value)} maxLength={80} placeholder={t("styleColorPlaceholder")} className={field} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleDescription")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={400} required rows={3} placeholder={t("styleDescriptionPlaceholder")} className={`${field} resize-none`} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleDetail")}
          <textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={400} rows={3} placeholder={t("styleDetailPlaceholder")} className={`${field} resize-none`} />
        </label>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("styleNote")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleCategory")}
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={field}>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleFabric")}
          <select value={fabricId} onChange={(event) => setFabricId(event.target.value)} className={field}>
            {fabrics.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint sm:col-span-2">
          {t("stylePrice")}
          {needsPrice ? (
            <span className="flex items-center border border-line bg-paper px-2 focus-within:border-ink">
              <span className="text-[0.8125rem] text-ink-faint">$</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                onFocus={(event) => {
                  const box = event.currentTarget;
                  requestAnimationFrame(() => box.select());
                }}
                className="min-h-11 w-full bg-transparent py-2 pl-1 text-[0.9375rem] tabular-nums text-ink"
              />
            </span>
          ) : (
            <span className="py-2 text-[0.9375rem] tabular-nums text-ink-soft">
              {formatMoney(existingPrice, locale)}
              <span className="ml-2 text-[0.75rem] text-ink-faint">{t("stylePriceFromList")}</span>
            </span>
          )}
        </label>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-medium">{t("styleSizes")}</h3>
        {SIZES.map((size) => (
          <Switch key={size} label={size.toUpperCase()} checked={stock[size]} onChange={(on) => setStock({ ...stock, [size]: on })} />
        ))}
      </section>

      <section className="border-t border-line pt-4">
        <Switch label={t("inStudio")} checked={inStudio} onChange={setInStudio} />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("styleSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 7: The cards**

Create `src/components/collection-cards.tsx`:

```tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import type { CollectionChange } from "@/lib/office-validation";
import type { PhotoSlot } from "@/lib/photo-order";
import { Pending } from "./office/confirm-bar";
import {
  overrideChange,
  overrideKey,
  unchanged,
  viewOf,
  type ManagedStyle,
  type OverrideView,
  type SizeId,
} from "./office/garment-draft";
import { GarmentSheet, NewGarmentSheet, type Picker } from "./office/garment-sheet";
import { RetiredGroup } from "./office/retired-group";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";

const SIZES: readonly SizeId[] = ["s", "m", "l"];

/**
 * The rack as cards: cover, name, category and price, the photo count, and
 * the three sizes right on the card because "S is out" is the daily action.
 * Tap a card for its sheet; the "+" card opens an empty one. Pending new
 * garments sit in the grid until confirm, retired ones under Retirados.
 */
export function CollectionCards({
  styles,
  retired,
  locale,
  categories,
  fabrics,
  pricedPairs,
  undoableTexts,
}: {
  styles: readonly ManagedStyle[];
  retired: readonly ManagedStyle[];
  locale: Locale;
  categories: readonly Picker[];
  fabrics: readonly Picker[];
  pricedPairs: Readonly<Record<string, number>>;
  undoableTexts: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  usePreviewCleanup(draft.entries);

  const opened = open !== null && open !== "new" ? (styles.find((row) => row.id === open) ?? null) : null;
  const pendingCreates = draft.entries.filter((entry) => entry.change.wire.type === "style-create");
  const shown = styles.filter((row) => viewOf(row, draft.pending(overrideKey(row.id))?.change).isPublished).length;
  const chip = "absolute top-2 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em]";

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <button
            type="button"
            onClick={() => setOpen("new")}
            className="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-[0.8125rem] text-ink-soft hover:border-ink"
          >
            <span className="text-3xl leading-none">+</span>
            {t("addGarment")}
          </button>
        </li>

        {styles.map((row) => {
          const key = overrideKey(row.id);
          const entry = draft.pending(key);
          const retiring = entry?.change.wire.type === "retire";
          const view = viewOf(row, entry?.change);
          const cover = view.slots[0];
          const update = (next: OverrideView) => {
            if (unchanged(next, row)) draft.unstage(key);
            else draft.stage(key, overrideChange(row.id, next));
          };
          return (
            <li key={row.id} className={`flex flex-col gap-2 ${retiring ? "opacity-50" : ""}`}>
              <button type="button" onClick={() => setOpen(row.id)} className="flex flex-col gap-2 text-left">
                <span className="relative block aspect-3/4 w-full overflow-hidden bg-paper-warm">
                  {cover?.kind === "src" ? (
                    <Image src={cover.src} alt="" fill sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                  ) : cover ? (
                    <Image src={cover.preview} alt="" fill unoptimized sizes="14rem" className="object-cover" />
                  ) : null}
                  {!view.isPublished ? <span className={`${chip} left-2 bg-ink text-paper`}>{t("hiddenChip")}</span> : null}
                  {view.inStudio ? <span className={`${chip} right-2 bg-marigold text-ink`}>{t("studioChip")}</span> : null}
                </span>
                <span className="font-display text-[1.0625rem] leading-tight">{row.name}</span>
                <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
                  {row.category} · {row.price === null ? t("priceUnknown") : formatMoney(row.price, locale)} ·{" "}
                  {t("photoCount", { count: view.slots.length })}
                </span>
              </button>
              <fieldset className="flex items-center gap-2">
                <legend className="sr-only">{t("stockLegend", { name: row.name })}</legend>
                {SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    role="switch"
                    aria-checked={view.stock[size]}
                    aria-label={size.toUpperCase()}
                    disabled={retiring}
                    onClick={() => update({ ...view, stock: { ...view.stock, [size]: !view.stock[size] } })}
                    className={`min-h-9 min-w-9 border text-[0.75rem] font-semibold uppercase disabled:opacity-60 ${
                      view.stock[size] ? "border-ink bg-ink text-paper" : "border-line text-ink-faint line-through"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </fieldset>
              {entry ? <Pending confirming={entry.confirming} error={entry.error} count={entry.count} /> : null}
            </li>
          );
        })}

        {pendingCreates.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "style-create") return null;
          const first = Array.isArray(entry.change.meta) ? (entry.change.meta as readonly PhotoSlot[])[0] : undefined;
          return (
            <li key={entry.key} className="flex flex-col gap-2">
              <span className="relative block aspect-3/4 w-full overflow-hidden bg-paper-warm">
                {first?.kind === "file" ? <Image src={first.preview} alt="" fill unoptimized sizes="14rem" className="object-cover" /> : null}
              </span>
              <span className="font-display text-[1.0625rem] leading-tight">{wire.name}</span>
              <span className="flex items-center gap-3">
                <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
                <button type="button" onClick={() => draft.unstage(entry.key)} className="text-xs underline underline-offset-4">
                  {t("dropChanges")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("collectionNote", { count: shown })}</p>

      <RetiredGroup
        items={retired.map((row) => ({ id: row.id, name: row.name, photo: row.photos[0] }))}
        restoreKey={(id) => overrideKey(id)}
        onRestore={(id) => {
          const key = overrideKey(id);
          draft.stage(key, { wire: { type: "restore", key, id } });
        }}
      />

      <Sheet open={open !== null} title={open === "new" ? t("newGarmentTitle") : (opened?.name ?? "")} onClose={close}>
        {open === "new" ? (
          <NewGarmentSheet categories={categories} fabrics={fabrics} pricedPairs={pricedPairs} locale={locale} onDone={close} />
        ) : opened ? (
          <GarmentSheet row={opened} undoableTexts={undoableTexts} />
        ) : null}
      </Sheet>
    </div>
  );
}

/** An object URL for a chosen file lives as long as some pending change still names it. */
function usePreviewCleanup(entries: readonly { readonly change: { readonly meta?: unknown } }[]): void {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const live = new Set<string>();
    for (const entry of entries) {
      if (!Array.isArray(entry.change.meta)) continue;
      for (const slot of entry.change.meta as readonly PhotoSlot[]) {
        if (slot.kind === "file") live.add(slot.preview);
      }
    }
    for (const url of seen.current) if (!live.has(url)) URL.revokeObjectURL(url);
    seen.current = live;
  }, [entries]);
  useEffect(
    () => () => {
      for (const url of seen.current) URL.revokeObjectURL(url);
    },
    [],
  );
}
```

- [ ] **Step 8: The page**

Replace the whole of `src/app/[locale]/office/collection/page.tsx` with:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { categories, styles, translate } from "@/content";
import { addedStyles, assembleStyles, manageableStyles } from "@/lib/live-catalog";
import { liveFabrics, livePriceList } from "@/lib/live-pricing";
import { undoableIds } from "@/lib/office-history";
import { CollectionCards } from "@/components/collection-cards";
import type { ManagedStyle } from "@/components/office/garment-draft";
import { OfficeDraftProvider } from "@/components/office/use-office-draft";
import { officeViewer } from "../_lib/viewer";
import { applyCollectionChanges } from "./actions";

/** Colección: the rack as cards, and the sheet that opens one. */
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

  const undoable = undoableIds("style-override");
  const undoableTexts = undoableIds("style-text");
  const codedStyles = new Map(
    assembleStyles(styles, addedStyles(), [], new Set()).map((style) => [style.id, style]),
  );
  const prices = new Map(livePriceList().map((entry) => [entry.id, entry.fixedPrice]));
  const managedStyles: ManagedStyle[] = manageableStyles().map((style) => ({
    id: style.id,
    slug: style.slug,
    name: translate(style.name, language),
    category: translate(
      categories.find((category) => category.id === style.categoryId)?.name ?? {
        en: style.categoryId,
        es: style.categoryId,
      },
      language,
    ),
    price: prices.get(style.priceEntryId) ?? null,
    photos: style.photos.map((photo) => photo.src),
    isPublished: style.isPublished,
    inStudio: style.inStudio === true,
    sizes: style.sizes.map((size) => ({
      sizeId: size.sizeId as "s" | "m" | "l",
      inStock: size.inStock,
    })),
    retired: style.retired,
    undoable: undoable.has(style.id),
    texts: {
      name: style.name,
      color: style.color,
      description: style.description,
      detail: style.detail,
    },
    codedTexts: {
      name: codedStyles.get(style.id)?.name ?? style.name,
      color: codedStyles.get(style.id)?.color ?? style.color,
      description: codedStyles.get(style.id)?.description ?? style.description,
      detail: codedStyles.get(style.id)?.detail ?? style.detail,
    },
  }));
  const active = managedStyles.filter((style) => !style.retired);
  const retired = managedStyles.filter((style) => style.retired);

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
      <OfficeDraftProvider apply={applyCollectionChanges}>
        <CollectionCards
          styles={active}
          retired={retired}
          locale={language}
          categories={composerCategories}
          fabrics={composerFabrics}
          pricedPairs={pricedPairs}
          undoableTexts={undoableTexts}
        />
      </OfficeDraftProvider>
    </section>
  );
}
```

- [ ] **Step 9: Delete the old editor and form**

```bash
git rm src/components/collection-manager.tsx src/components/style-composer.tsx
grep -rn "collection-manager\|style-composer\|CollectionManager\|StyleComposer" src docs/superpowers/plans/2026-09-15-office-take-two-step-2-collection-sheet.md --include=*.ts --include=*.tsx | grep -v "\.test\.ts"
```

Expected: the grep prints nothing (nothing imports them any more). If it prints a file, that import must go.

- [ ] **Step 10: Run every test, the typecheck and the lint**

Run: `npm run typecheck && npm test && npm run lint`
Expected: typecheck clean, every test green (the new structural test included), lint clean. A lint warning about `<img>` cannot appear: every image goes through `next/image` (object URLs with `unoptimized`).

- [ ] **Step 11: Commit**

```bash
git add src/components/office/garment-photos.tsx src/components/office/garment-words.tsx src/components/office/garment-sheet.tsx src/components/collection-cards.tsx src/components/collection-cards.test.ts "src/app/[locale]/office/collection/page.tsx" src/messages/es.json src/messages/en.json
git commit -m "Colección as cards, and a sheet for one garment at a time

A card is the cover, the name, the price and the three sizes; tap it and
the sheet shows every photo with Hacer portada, the arrows and Quitar,
the words in Spanish with Ver inglés beside them, the sizes, shown, and
offered in the studio. The + card opens the same sheet empty. The old
row editor and add form are gone.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The manual, the status page and the spec follow the code

**Files:**
- Modify: `docs/manual-del-taller.html` (sections 03, 04, 05)
- Modify: `docs/next-steps.md` (the "What is done" list)
- Modify: `docs/superpowers/specs/2026-09-02-office-hub-design.md` (Amendment 4 §3, one clause)

- [ ] **Step 1: Section 03, adding a garment**

In `docs/manual-del-taller.html`, replace the whole `<ol class="steps">` inside `<section class="task" id="prenda">` (from `<ol class="steps">` to its `</ol>`) with:

```html
    <ol class="steps">
      <li>
        En la oficina, toque la pestaña <span class="label">Colección</span>
        (<span class="path">/es/office/collection</span>) y toque la tarjeta
        <span class="btn">+ Agregar una prenda</span>. Se abre una hoja.
      </li>
      <li>
        <span class="label">Las fotos</span>: toque <span class="btn">Agregar fotos</span>
        y escoja una o varias del carrete. La primera es la portada; con
        <span class="btn">Hacer portada</span> y las flechas las pone en el
        orden que quiera.
      </li>
      <li>
        <span class="label">Cómo se llama</span>, <span class="label">Color</span>,
        <span class="label">Qué es</span> y <span class="label">Cómo está hecha</span>:
        en español, en sus palabras. El inglés lo escribe el sitio cuando usted
        confirma.
      </li>
      <li>
        <span class="label">Prenda</span> y <span class="label">Tela</span>: de dónde sale el precio.
      </li>
      <li>
        <span class="label">Tallas que tiene</span>: deje encendidas solamente
        las que tiene hechas. Las demás salen agotadas.
      </li>
      <li>
        <span class="label">Se ofrece en el estudio</span>: enciéndalo si quiere
        que esta pieza aparezca en el taller de diseño con las telas al lado.
      </li>
      <li>
        Toque <span class="btn">Agregar a los cambios</span>. La prenda queda en
        la lista como pendiente; toque <span class="btn">Confirmar cambios</span>
        abajo y sube al sitio.
      </li>
    </ol>
```

The `<div class="note">` about the price that follows stays as it is.

- [ ] **Step 2: Section 04, sizes, photos and hiding**

Replace the whole `<section class="task" id="perchero">` … `</section>` with:

```html
  <section class="task" id="perchero">
    <h2><span class="n">04</span>Esconder una pieza, cambiar sus fotos, o marcar las tallas que le quedan</h2>
    <p>
      Se vendió la última mediana, quiere otra foto de portada, o quiere sacar
      una pieza del sitio por un tiempo sin borrarla. Todo se hace desde la
      tarjeta de esa prenda.
    </p>
    <ol class="steps">
      <li>En la oficina, toque la pestaña <span class="label">Colección</span> (<span class="path">/es/office/collection</span>).</li>
      <li>
        Para las tallas no hace falta abrir nada: en la tarjeta, toque la letra
        de la talla que se acabó y queda tachada. La pieza se queda en el sitio
        y esa talla sale agotada.
      </li>
      <li>Para todo lo demás, toque la tarjeta y se abre la hoja de esa prenda.</li>
      <li>
        <span class="label">Las fotos</span>: <span class="btn">Hacer portada</span>
        pone una foto de primera, las flechas la mueven,
        <span class="btn">Quitar</span> la saca del sitio y
        <span class="btn">Agregar fotos</span> sube nuevas.
      </li>
      <li>Para esconderla entera: apague <span class="label">Se muestra en el sitio</span>.</li>
      <li>Para sacarla del todo, toque <span class="btn">Retirar</span>. Vuelve desde <span class="label">Retirados</span> con <span class="btn">Restaurar</span>.</li>
      <li>
        Toque <span class="btn">Listo</span> para cerrar la hoja y
        <span class="btn">Confirmar cambios</span> para aplicar todo lo que
        marcó. Cerrar la hoja no pierde nada: lo pendiente sigue en la barra.
      </li>
    </ol>
    <div class="note">
      <p>
        <strong>Nada se borra nunca.</strong> Una pieza oculta o retirada sigue
        guardada, con sus fotos y su precio. Una foto quitada tampoco se borra:
        <span class="btn">Deshacer</span> en la hoja la trae de vuelta con el
        orden que tenía.
      </p>
    </div>
  </section>
```

- [ ] **Step 3: Section 05, the words**

Replace the whole `<section class="task" id="palabras">` … `</section>` with:

```html
  <section class="task" id="palabras">
    <h2><span class="n">05</span>Corregir las palabras de una prenda o una foto</h2>
    <p>
      Todo lo que está escrito en el sitio se puede arreglar desde aquí. Si una
      prenda quedó con el nombre mal escrito, o la descripción ya no dice lo que
      usted quiere decir, no hay que llamar a nadie.
    </p>
    <ol class="steps">
      <li>
        Para una prenda: en <span class="label">Colección</span>, toque su
        tarjeta. En la hoja, bajo <span class="label">Las palabras</span>,
        escriba encima de lo que quiera cambiar. Solo en español.
      </li>
      <li>
        Para una foto de la galería: en <span class="label">La galería</span>,
        toque <span class="btn">Editar textos</span> en esa foto y escriba en la
        casilla.
      </li>
      <li><span class="btn">Confirmar cambios</span> lo hace real, igual que todo lo demás.</li>
    </ol>
    <div class="note">
      <p><strong>El inglés se escribe solo.</strong></p>
      <p>
        Cuando usted confirma una palabra en español, el sitio escribe el inglés
        al mismo tiempo. Si quiere verlo, toque <span class="btn">Ver inglés</span>
        en la hoja. Si una línea dice <span class="label">Inglés pendiente</span>,
        el inglés todavía es una copia del español: toque
        <span class="btn">Traducir</span> y confirme. Y si prefiere escribir el
        inglés usted misma, <span class="btn">Corregir</span> le abre la casilla.
      </p>
      <p>
        <strong>Si borra una casilla y la deja vacía</strong>, vuelven las
        palabras con las que la pieza salió, en los dos idiomas. Es la manera de
        arrepentirse sin tener que acordarse de lo que decía antes.
      </p>
    </div>
  </section>
```

- [ ] **Step 4: The status page**

In `docs/next-steps.md`, under "## What is done", after the bullet that begins `- **The confirm bar is always there**`, add:

```markdown
- **Colección is cards and a sheet** (15 September 2026). Tap a garment to open it. Every photo can be added, removed, moved and made the cover. Daysi types Spanish only; the site writes the English when she confirms. Each garment has a switch "Se ofrece en el estudio"; the studio page that uses it is step 4.
- **The English needs a key.** Without `ANTHROPIC_API_KEY` on Fly, the English is a copy of the Spanish and the sheet says "Inglés pendiente" with a Traducir link. To turn it on, from a machine with the Fly CLI: `fly secrets set -a daysicollectioninc ANTHROPIC_API_KEY="sk-ant-..."` (a key from console.anthropic.com; a busy month costs under a dollar). Locally, the same line goes in `.env.local`.
```

- [ ] **Step 5: The spec's one clause**

In `docs/superpowers/specs/2026-09-02-office-hub-design.md`, Amendment 4 section 3, "The garment sheet" paragraph, replace `hold-to-move to reorder,` with `**Mover antes** and **Mover después** arrows to reorder (arrows rather than drag: a drag that works under a mouse and a thumb needs a library or a pointer engine, and a garment has two to four photos),`.

- [ ] **Step 6: Check the manual still parses and commit**

Run: `node -e 'const s=require("fs").readFileSync("docs/manual-del-taller.html","utf8"); const open=(s.match(/<section /g)||[]).length, close=(s.match(/<\/section>/g)||[]).length; console.log(open, close); process.exit(open===close?0:1)'`
Expected: two equal numbers, exit 0.

```bash
git add docs/manual-del-taller.html docs/next-steps.md docs/superpowers/specs/2026-09-02-office-hub-design.md
git commit -m "Tell Daysi about the cards, the sheet and the English that writes itself

Sections 03, 04 and 05 of the manual describe the + card, the photo
controls, the sizes on the card, the sheet's switches, and Ver inglés,
Inglés pendiente and Traducir. The status page says where the key goes.
The spec says arrows, which is what was built, rather than hold-to-move.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Whole-suite check, browser pass, smoke, pull request

**Files:**
- None modified unless a check fails.

- [ ] **Step 1: Run everything**

Run: `npm run typecheck && npm test && npm run lint && npm run audit`
Expected: all clean. The suite has grown by `translate`, `live-studio`, `photo-order`, `garment-draft`, `sheet` and `collection-cards` test files.

- [ ] **Step 2: Browser pass, no key locally**

Start `npm run dev` (note the port), request a sign-in link for `daysi@daysicollection.test` from `/es/sign-in`, open the link the dev log prints. Any garment photo for the upload steps can come from `public/images/real/`. At 375 px wide:

1. `/es/office/collection`: cards with the cover, the name, "HERENCIA · $295 · 2 fotos", the three size letters, and "+ Agregar una prenda" first. The bar reads Sin cambios.
2. On a card, tap M: it goes struck through, the bar counts one change; tap it again: Sin cambios.
3. Tap a card: the sheet fills the screen, its title is the garment's name, Listo is at the top right, and the confirm bar is still visible and tappable at the bottom. Under Las fotos the first photo says Portada. Tap Hacer portada on the second: it moves first, the bar counts one change. Tap Quitar on the last: it goes; the bar still counts one (same garment). Tap Listo; reopen the card: the pending order is still shown.
4. Confirmar cambios. Open `/es/collection/<slug>` for that garment: the new first photo is the cover and the removed one is absent. Back in the sheet, Deshacer, confirm: the original order returns on the public page.
5. In the sheet, change Cómo se llama and tap outside the box: the bar counts one. Tap Ver inglés: the English line is the old English. Confirm. Reopen: Ver inglés shows the line marked Inglés pendiente (the English is now the Spanish copy) with Traducir. Tap Traducir, confirm: the change is refused with "La traducción automática no está configurada" on the row, and the bar keeps it pending. Quitar los cambios.
6. Tap "+ Agregar una prenda": the empty sheet. Agregar fotos with two files; the second's Hacer portada moves it first. Fill the four Spanish fields, pick a garment and cloth that already have a price (the price shows "de la lista de precios"), switch off L, switch on Se ofrece en el estudio, Agregar a los cambios: the sheet closes and a pending card sits in the grid with its preview. Confirmar: the card becomes a real one with the Estudio chip. On `/en/collection`, the new garment shows Spanish words (the copy).
7. Open a sheet, press Escape: it closes. Open one, press the browser's back: it closes and the address is still `/es/office/collection`. Open one, tap the dark backdrop: it closes.
8. Stage one change, tap Precios in the strip: the "Tiene cambios sin confirmar" prompt appears; cancel; Descartar.
9. Retire a garment from its sheet, confirm; restore it from Retirados, confirm.
10. At 1280 px wide: the sheet is a right-hand panel about 28 rem wide, the cards are four across, the bar stays visible.

- [ ] **Step 3: Browser pass, with a key (only if the user has put `ANTHROPIC_API_KEY` in `.env.local`)**

Restart the dev server. Add a garment in Spanish and confirm. On `/en/collection/<slug>` the name and description read as English. In the sheet, Ver inglés shows no Inglés pendiente. Change the Spanish description, confirm: the English changes too. Skip this step and say so in the report if there is no key.

- [ ] **Step 4: Smoke**

With the dev server up: `SMOKE_URL=http://localhost:<port> npm run smoke`. Expected: every line `ok`. Stop the server.

- [ ] **Step 5: Open the pull request**

```bash
git push -u origin office-take-two-2-collection
gh pr create --base main --title "Office take two, step 2: Colección as cards, the sheet, full photo control, Spanish only" --body-file - <<'EOF'
## What changed

- **Colección is cards.** Cover, name, category and price, the photo count, and the three sizes on the card. A "+" card first.
- **The sheet.** Tap a card and everything about the garment opens: every photo with Hacer portada, Mover antes, Mover después, Quitar and Agregar fotos; the words in Spanish; the sizes, Se muestra en el sitio and Se ofrece en el estudio as switches; Retirar and Deshacer. Full screen on a phone, a right-hand panel on a computer; it sits under the confirm bar and closes on Listo, Escape, the backdrop or the back gesture without losing anything.
- **Photos are hers.** A garment's saved settings gain an ordered photo list; a coded photo left out is hidden, never deleted; records without the list read exactly as before; undo restores the order.
- **Spanish only, English written for her.** Every form takes Spanish. At confirm the site asks the Claude API (official SDK, `claude-opus-5`, structured output, one attempt, 20 s) for the English. Without a key or on any failure the English is a copy, the confirm still succeeds, and the sheet shows Inglés pendiente with a Traducir link. This reverses the two-box create forms from Amendment 3.
- **A studio switch** on every garment (`inStudio`), and `liveStudioStyles()` for step 4's studio page.
- Manual sections 03 to 05, the status page and the spec follow.

## Why

Amendment 4 of the office design, step 2 of five: the big one. Daysi manages pictures and words from her phone without boxes in two languages.

## To turn the English on

```
fly secrets set -a daysicollectioninc ANTHROPIC_API_KEY="sk-ant-..."
```

A key from console.anthropic.com. Without it the site works as before, with the copy-of-Spanish fallback.

## Checks

- `npm run typecheck`, `npm test`, `npm run lint`, `npm run audit` clean; six new test files.
- Browser pass at 375 px and 1280 px signed in as the owner: cards, size taps, the sheet and the bar together, photo order and cover on the public page, Deshacer, Spanish edit with the pending English and the refusal without a key, a new garment end to end, Escape, back and backdrop, the leave-tab prompt, retire and restore.
- Smoke green against a dev server.

## Still owed

- The add-a-fabric form still has `type="number"` price boxes; step 3 rebuilds it.
- A pass on a real iPhone: open a sheet, add a photo from the camera roll, move it, confirm.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 6: Report**

Give the user the PR URL and, if there was no key locally, say the translation path was proven only as the fallback.

---

## Decisions baked into this plan

Each is a call the spec left open or a departure from its letter; the executor follows the plan, the user can reverse any of them.

1. **Arrows, not hold-to-move.** The spec's §3 says "hold-to-move to reorder"; the plan gives each photo Mover antes and Mover después. A drag that works under a mouse and a thumb needs a library or a pointer engine, and a garment has two to four photos. Task 7 corrects the spec's sentence.
2. **A pending file keeps its place.** The spec says a new file "is appended to `photos`"; here it takes the slot she gives it (cover, third, last) and the uploaded path lands in that position at confirm, because `withUploads` walks the slots. Strictly better than the spec, at no cost.
3. **A hidden coded photo comes back only through Deshacer.** The sheet shows the photos the site shows; a coded photo she removed is not listed for restoring. The action still accepts it, so undo works, and a later step can add a "Fotos quitadas" row if she asks.
4. **A cleared Spanish box clears the English too.** The spec says a blank returns the field to the coded words; the plan returns both languages, so a garment never shows coded Spanish beside a stale English correction.
5. **A Spanish edit overwrites a hand-corrected English.** As the spec says: the English follows the Spanish at confirm. Corregir is for the rare case she wants to write the English herself, and it stands until the Spanish changes again.
6. **No server-side refusal fallback on the translation call.** The feature's own fallback (a copy) covers a refusal or any other failure, so the SDK's fallback model parameter is not used.
