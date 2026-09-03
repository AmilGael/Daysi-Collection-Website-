# Office step 4: text overrides implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Daysi correct the words on any garment and gallery photo from the office, in both languages independently, without a deploy.

**Architecture:** A fourth append-only override layer, `text-overrides`, one record per field per locale, merged by a new pure module inside the two existing assemblers before `applyOverrides` runs. Editing is a disclosure on each existing row that stages into the tab's existing draft and confirm bar, so no new routes and no new server actions appear. The two create forms start taking both languages, which is where monolingual text is born today.

**Tech Stack:** Next.js 15 App Router, React 19 server components, TypeScript strict, zod, next-intl 3.26.5, vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-office-hub-design.md`, Amendment 3 (2026-09-03).

## Global Constraints

- Money is whole cents, never floats. Not touched by this step, but do not introduce a float anywhere.
- Copy is bilingual in `src/messages/es.json` and `src/messages/en.json`, both bundles always updated together. Spanish is the default locale and Daysi's language. **No em dashes in any user-facing copy.**
- Every office write goes through `ownerAction` in `src/lib/action-guard.ts`. Never add a route handler for office data.
- Every office edit stages into the draft and is written only on "Confirmar cambios". Nothing saves on blur, on click, or on navigation.
- Append-only store: never rewrite or delete a record. A correction is a new record.
- `src/lib/records.ts` helpers only: `appendRecord(collection, record)`, `readRecords<T>(collection)`, `latestBy(records, key)`, `versionsOf<T>(collection, key, id)`.
- Tests are vitest, `src/**/*.test.ts`, run with `npm test`. Typecheck with `npm run typecheck`.
- Do not run `fly deploy`. Do not run `npm run deploy`. The user runs those.
- Commit after every task with the message given in the task's final step.

---

### Task 1: The record and the pure merge

**Files:**
- Create: `src/lib/live-text.ts`
- Create: `src/lib/live-text.test.ts`

**Interfaces:**
- Consumes: `readRecords`, `latestBy` from `src/lib/records.ts`; `GarmentStyle`, `GalleryWork`, `Localized` from `src/content/types.ts`.
- Produces: `type TextSubject = "style" | "gallery"`; `type TextField = "name" | "color" | "description" | "detail" | "caption"`; `type TextOverride`; `textKey(subject, id, field, locale): string`; `applyStyleText(catalog, overrides): GarmentStyle[]`; `applyGalleryText(works, overrides): GalleryWork[]`; `textOverrides(): TextOverride[]`; `saveTextOverride(override): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/live-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyGalleryText, applyStyleText, textKey, type TextOverride } from "./live-text";
import type { GalleryWork, GarmentStyle } from "@/content/types";

const style = {
  id: "s1",
  slug: "s1",
  name: { es: "Vestido", en: "Dress" },
  categoryId: "dresses",
  priceEntryId: "dresses--laguna",
  color: { es: "Azul", en: "Blue" },
  description: { es: "Descripción vieja", en: "Old description" },
  detail: { es: "Detalle viejo", en: "Old detail" },
  sizes: [{ sizeId: "m", inStock: true }],
  photos: [{ src: "/a.jpg", alt: { es: "a", en: "a" }, isPrimary: true }],
  customizationAvailable: true,
  isPublished: true,
} satisfies GarmentStyle;

const work = {
  id: "g1",
  src: "/g.jpg",
  width: 100,
  height: 100,
  category: "runway",
  caption: { es: "Pie viejo", en: "Old caption" },
} satisfies GalleryWork;

function override(patch: Partial<TextOverride>): TextOverride {
  return {
    subject: "style",
    id: "s1",
    field: "description",
    locale: "es",
    value: "Descripción nueva",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...patch,
  };
}

describe("applyStyleText", () => {
  it("leaves the catalog alone when there are no overrides", () => {
    expect(applyStyleText([style], [])).toEqual([style]);
  });

  it("replaces one field in one language and leaves the other language alone", () => {
    const [merged] = applyStyleText([style], [override({})]);
    expect(merged!.description.es).toBe("Descripción nueva");
    expect(merged!.description.en).toBe("Old description");
  });

  it("leaves the other fields alone", () => {
    const [merged] = applyStyleText([style], [override({})]);
    expect(merged!.name).toEqual(style.name);
    expect(merged!.detail).toEqual(style.detail);
  });

  it("treats an empty value as a return to the coded words", () => {
    const [merged] = applyStyleText([style], [override({ value: "" })]);
    expect(merged!.description.es).toBe("Descripción vieja");
  });

  it("ignores an override for a style that is not there", () => {
    expect(applyStyleText([style], [override({ id: "missing" })])).toEqual([style]);
  });

  it("ignores a gallery override when merging styles", () => {
    expect(applyStyleText([style], [override({ subject: "gallery" })])).toEqual([style]);
  });

  it("overrides the name in both languages when both are given", () => {
    const [merged] = applyStyleText([style], [
      override({ field: "name", locale: "es", value: "Falda" }),
      override({ field: "name", locale: "en", value: "Skirt" }),
    ]);
    expect(merged!.name).toEqual({ es: "Falda", en: "Skirt" });
  });
});

describe("applyGalleryText", () => {
  it("replaces a caption in one language", () => {
    const [merged] = applyGalleryText([work], [
      override({ subject: "gallery", id: "g1", field: "caption", locale: "es", value: "Pie nuevo" }),
    ]);
    expect(merged!.caption).toEqual({ es: "Pie nuevo", en: "Old caption" });
  });

  it("ignores a caption override aimed at a style", () => {
    expect(
      applyGalleryText([work], [override({ id: "g1", field: "caption", value: "x" })]),
    ).toEqual([work]);
  });
});

describe("textKey", () => {
  it("names the subject, the id, the field and the locale", () => {
    expect(textKey("style", "s1", "description", "es")).toBe("style:s1:description:es");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/live-text.test.ts`
Expected: FAIL, cannot resolve `./live-text`.

- [ ] **Step 3: Write the module**

Create `src/lib/live-text.ts`:

```ts
import type { GalleryWork, GarmentStyle, Localized } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import { appendRecord, latestBy, readRecords } from "./records";

/**
 * The words layer.
 *
 * The other live layers say what state a thing is in: published, in stock,
 * priced, hidden, retired. None of them ever said what a thing is called, so
 * fixing a typo in a description meant a deploy. A record here speaks about
 * exactly one field of one item in one language, which is what lets Daysi
 * correct the Spanish on a seeded garment without touching a good English
 * translation. An empty value is not an empty page: it clears the override and
 * returns that field to the coded words.
 */

export type TextSubject = "style" | "gallery";
export type TextField = "name" | "color" | "description" | "detail" | "caption";

export type TextOverride = {
  readonly subject: TextSubject;
  readonly id: string;
  readonly field: TextField;
  readonly locale: Locale;
  readonly value: string;
  readonly updatedAt: string;
};

const TEXTS = "text-overrides";

export function textKey(
  subject: TextSubject,
  id: string,
  field: TextField,
  locale: Locale,
): string {
  return `${subject}:${id}:${field}:${locale}`;
}

export function textOverrides(): TextOverride[] {
  return latestBy(readRecords<TextOverride>(TEXTS), (record) =>
    textKey(record.subject, record.id, record.field, record.locale),
  );
}

export async function saveTextOverride(
  override: Omit<TextOverride, "updatedAt">,
): Promise<void> {
  await appendRecord(TEXTS, { ...override, updatedAt: new Date().toISOString() });
}

/** Index the overrides for one subject by id, then by field, then by locale. */
function index(
  overrides: readonly TextOverride[],
  subject: TextSubject,
): Map<string, TextOverride[]> {
  const byId = new Map<string, TextOverride[]>();
  for (const override of overrides) {
    if (override.subject !== subject) continue;
    const list = byId.get(override.id);
    if (list) list.push(override);
    else byId.set(override.id, [override]);
  }
  return byId;
}

/** Apply one field's overrides to a bilingual value. An empty value clears. */
function merge(
  coded: Localized,
  applicable: readonly TextOverride[],
  field: TextField,
): Localized {
  let value = coded;
  for (const override of applicable) {
    if (override.field !== field) continue;
    const text = override.value.trim();
    if (text.length === 0) continue;
    value = { ...value, [override.locale]: text };
  }
  return value;
}

/**
 * Pure, so it can be tested without touching the filesystem. Runs BEFORE
 * `applyOverrides` in `assembleStyles`: that one builds alt text for
 * office-added photos out of the garment name, so the corrected name has to be
 * in place first.
 */
export function applyStyleText(
  catalog: readonly GarmentStyle[],
  overrides: readonly TextOverride[],
): GarmentStyle[] {
  const byId = index(overrides, "style");
  return catalog.map((style) => {
    const applicable = byId.get(style.id);
    if (!applicable) return style;
    return {
      ...style,
      name: merge(style.name, applicable, "name"),
      color: merge(style.color, applicable, "color"),
      description: merge(style.description, applicable, "description"),
      detail: merge(style.detail, applicable, "detail"),
    };
  });
}

export function applyGalleryText(
  works: readonly GalleryWork[],
  overrides: readonly TextOverride[],
): GalleryWork[] {
  const byId = index(overrides, "gallery");
  return works.map((work) => {
    const applicable = byId.get(work.id);
    if (!applicable) return work;
    return { ...work, caption: merge(work.caption, applicable, "caption") };
  });
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/live-text.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-text.ts src/lib/live-text.test.ts
git commit -m "Add the text override layer: one record per field per language"
```

---

### Task 2: Wire the merge into both assemblers

**Files:**
- Modify: `src/lib/live-catalog.ts` (`assembleStyles`, and the two callers `allLiveStyles` and `manageableStyles`)
- Modify: `src/lib/live-gallery.ts` (`assembleGallery`, `liveGallery`, `manageableGallery`)
- Modify: `src/lib/assemble-styles.test.ts`
- Modify: `src/lib/live-gallery.test.ts`

**Interfaces:**
- Consumes: `applyStyleText`, `applyGalleryText`, `textOverrides`, `type TextOverride` from Task 1.
- Produces: `assembleStyles(seed, added, overrides, retired?, texts?)` and `assembleGallery(seed, added, visibility, retired?, texts?)`, both with the new parameter last and defaulting to an empty array, so every existing caller keeps compiling.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/assemble-styles.test.ts`:

```ts
describe("assembleStyles with text overrides", () => {
  it("applies a text override to a seeded garment", () => {
    const seed = styles.slice(0, 1);
    const merged = assembleStyles(seed, [], [], new Set(), [
      {
        subject: "style",
        id: seed[0]!.id,
        field: "description",
        locale: "es",
        value: "Palabras nuevas",
        updatedAt: "2026-09-03T00:00:00.000Z",
      },
    ]);
    expect(merged[0]!.description.es).toBe("Palabras nuevas");
    expect(merged[0]!.description.en).toBe(seed[0]!.description.en);
  });

  it("gives an office-added photo the corrected name in its alt text", () => {
    const seed = styles.slice(0, 1);
    const merged = assembleStyles(
      seed,
      [],
      [
        {
          styleId: seed[0]!.id,
          isPublished: true,
          stock: {},
          addedPhotos: ["/uploads/new.jpg"],
          updatedAt: "2026-09-03T00:00:00.000Z",
        },
      ],
      new Set(),
      [
        {
          subject: "style",
          id: seed[0]!.id,
          field: "name",
          locale: "es",
          value: "Nombre corregido",
          updatedAt: "2026-09-03T00:00:00.000Z",
        },
      ],
    );
    const added = merged[0]!.photos.find((photo) => photo.src === "/uploads/new.jpg");
    expect(added!.alt.es).toContain("Nombre corregido");
  });
});
```

Append to `src/lib/live-gallery.test.ts`:

```ts
describe("assembleGallery with text overrides", () => {
  it("applies a caption override", () => {
    const seed = [
      {
        id: "g1",
        src: "/g.jpg",
        width: 10,
        height: 10,
        category: "runway",
        caption: { es: "Viejo", en: "Old" },
      },
    ] as const;
    const merged = assembleGallery(seed, [], [], new Set(), [
      {
        subject: "gallery",
        id: "g1",
        field: "caption",
        locale: "en",
        value: "New caption",
        updatedAt: "2026-09-03T00:00:00.000Z",
      },
    ]);
    expect(merged[0]!.caption).toEqual({ es: "Viejo", en: "New caption" });
  });
});
```

Both files already import what they need except the assembler under test and `styles`; add imports only if the file does not have them.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/lib/assemble-styles.test.ts src/lib/live-gallery.test.ts`
Expected: FAIL, `assembleStyles` takes four arguments, not five.

- [ ] **Step 3: Thread the parameter through both assemblers**

In `src/lib/live-catalog.ts`, add the import and change `assembleStyles` and its two callers:

```ts
import { applyStyleText, textOverrides, type TextOverride } from "./live-text";

export function assembleStyles(
  seed: readonly GarmentStyle[],
  added: readonly GarmentStyle[],
  overrides: readonly StyleOverride[],
  retired: ReadonlySet<string> = new Set(),
  texts: readonly TextOverride[] = [],
): GarmentStyle[] {
  const newest = new Map(added.map((style) => [style.id, style]));
  const seeded = new Set(seed.map((style) => style.id));
  const catalog = [
    ...seed.map((style) => newest.get(style.id) ?? style),
    ...[...newest.values()].filter((style) => !seeded.has(style.id)),
  ];
  // Words first: applyOverrides builds alt text for added photos out of the name.
  return applyOverrides(applyStyleText(catalog, texts), overrides).filter(
    (style) => !retired.has(style.id),
  );
}
```

```ts
export function allLiveStyles(): GarmentStyle[] {
  return assembleStyles(
    styles,
    addedStyles(),
    styleOverrides(),
    retiredSet("style"),
    textOverrides(),
  );
}

export function manageableStyles(): (GarmentStyle & { retired: boolean })[] {
  const retired = retiredSet("style");
  return assembleStyles(styles, addedStyles(), styleOverrides(), new Set(), textOverrides()).map(
    (style) => ({ ...style, retired: retired.has(style.id) }),
  );
}
```

In `src/lib/live-gallery.ts`:

```ts
import { applyGalleryText, textOverrides, type TextOverride } from "./live-text";

export function assembleGallery(
  seed: readonly GalleryWork[],
  added: readonly GalleryWork[],
  visibility: readonly GalleryVisibility[],
  retired: ReadonlySet<string> = new Set(),
  texts: readonly TextOverride[] = [],
): GalleryWork[] {
  const hidden = new Map(visibility.map((record) => [record.id, record.hidden]));
  const newest = new Map(added.map((work) => [work.id, work]));
  const seeded = new Set(seed.map((work) => work.id));

  return applyGalleryText(
    [
      ...seed.map((work) => newest.get(work.id) ?? work),
      ...[...newest.values()].filter((work) => !seeded.has(work.id)),
    ],
    texts,
  ).filter((work) => hidden.get(work.id) !== true && !retired.has(work.id));
}
```

Then pass `textOverrides()` as the fifth argument in `liveGallery`, and in `manageableGallery` pass `new Set()` as the fourth and `textOverrides()` as the fifth.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS. Every existing caller of both assemblers still compiles because the new parameter defaults.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-catalog.ts src/lib/live-gallery.ts src/lib/assemble-styles.test.ts src/lib/live-gallery.test.ts
git commit -m "Merge the words layer inside both assemblers, before the state overrides"
```

---

### Task 3: The two change types and their validation

**Files:**
- Modify: `src/lib/office-validation.ts`
- Modify: `src/lib/office-validation.test.ts`

**Interfaces:**
- Consumes: `TextField`, `TextSubject` from Task 1.
- Produces: `styleTextSchema`, `workTextSchema`, both members of the existing per-tab unions; `TEXT_LIMITS`; `UNDO_KINDS` grows by `"style-text"` and `"work-text"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/office-validation.test.ts`:

```ts
describe("text changes", () => {
  const base = {
    type: "style-text" as const,
    key: "text:style:s1:description:es",
    id: "s1",
    field: "description" as const,
    locale: "es" as const,
    value: "Palabras nuevas",
  };

  it("accepts a staged style text change", () => {
    expect(collectionChangeSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an empty value, which clears the override", () => {
    expect(collectionChangeSchema.safeParse({ ...base, value: "" }).success).toBe(true);
  });

  it("refuses a field the garment does not have", () => {
    expect(collectionChangeSchema.safeParse({ ...base, field: "caption" }).success).toBe(false);
  });

  it("refuses a locale the site does not serve", () => {
    expect(collectionChangeSchema.safeParse({ ...base, locale: "fr" }).success).toBe(false);
  });

  it("refuses a value past the longest field's limit", () => {
    expect(
      collectionChangeSchema.safeParse({ ...base, value: "x".repeat(401) }).success,
    ).toBe(false);
  });

  it("accepts a long name at the schema, which the action then refuses", () => {
    // TEXT_LIMITS.name is 60; the schema's outer bound is the longest field.
    expect(
      collectionChangeSchema.safeParse({ ...base, field: "name", value: "x".repeat(100) }).success,
    ).toBe(true);
  });

  it("accepts a staged caption change on the gallery tab", () => {
    expect(
      galleryChangeSchema.safeParse({
        type: "work-text",
        key: "text:gallery:g1:caption:en",
        id: "g1",
        field: "caption",
        locale: "en",
        value: "A June wedding dress.",
      }).success,
    ).toBe(true);
  });

  it("refuses a garment field on the gallery tab", () => {
    expect(
      galleryChangeSchema.safeParse({
        type: "work-text",
        key: "text:gallery:g1:name:en",
        id: "g1",
        field: "name",
        locale: "en",
        value: "x",
      }).success,
    ).toBe(false);
  });
});

describe("UNDO_KINDS", () => {
  it("carries the two text streams", () => {
    expect(UNDO_KINDS).toContain("style-text");
    expect(UNDO_KINDS).toContain("work-text");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/office-validation.test.ts`
Expected: FAIL, the union has no `style-text` member.

- [ ] **Step 3: Add the schemas**

In `src/lib/office-validation.ts`, above `collectionChangeSchema`:

```ts
/** Field limits mirror styleCreateSchema and galleryWorkSchema, so a correction
 *  can never be longer than the words it replaces were allowed to be. */
export const TEXT_LIMITS = {
  name: 60,
  color: 80,
  description: 400,
  detail: 400,
  caption: 200,
} as const;

const localeField = z.enum(["es", "en"]);

/** An empty value is the clear: it returns the field to the coded words. */
const textValue = <F extends keyof typeof TEXT_LIMITS>(field: F) =>
  z.string().trim().max(TEXT_LIMITS[field]);

/**
 * One flat object, not a refinement: `z.discriminatedUnion` refuses a
 * `ZodEffects` member, and turning the collection union into a plain `z.union`
 * would cost the discriminated error messages every other change type relies
 * on. The outer bound here is the longest field; the exact per-field limit is
 * enforced in the action, where every other refusal already lives.
 */
export const styleTextSchema = z.object({
  type: z.literal("style-text"),
  key: changeKey,
  id,
  field: z.enum(["name", "color", "description", "detail"]),
  locale: localeField,
  value: z.string().trim().max(400),
});

export const workTextSchema = z.object({
  type: z.literal("work-text"),
  key: changeKey,
  id,
  field: z.literal("caption"),
  locale: localeField,
  value: textValue("caption"),
});
```

`z.discriminatedUnion` cannot take a `ZodEffects` member, so add `styleTextSchema` to the collection union as its inner object and keep the length refinement on the union:

```ts
export const collectionChangeSchema = z.discriminatedUnion("type", [
  styleOverrideSchema.extend({ type: z.literal("style-override"), key: changeKey }),
  styleCreateSchema.extend({ type: z.literal("style-create"), key: changeKey }),
  styleTextSchema,
  retireChangeSchema,
  restoreChangeSchema,
]);

export const galleryChangeSchema = z.discriminatedUnion("type", [
  galleryWorkSchema.extend({ type: z.literal("work-add"), key: changeKey }),
  z.object({ type: z.literal("work-visibility"), key: changeKey, id, hidden: z.boolean() }),
  workTextSchema,
  retireChangeSchema,
  restoreChangeSchema,
]);
```

Add the two kinds to `UNDO_KINDS`:

```ts
export const UNDO_KINDS = [
  "style-override",
  "work-visibility",
  "price-entry",
  "alteration",
  "appointment",
  "notice",
  "request-status",
  "style-text",
  "work-text",
] as const;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/office-validation.test.ts && npm run typecheck`
Expected: PASS. The typecheck matters here: `OfficeChange` now includes the two text members, and every `switch` over it must stay exhaustive.

- [ ] **Step 5: Commit**

```bash
git add src/lib/office-validation.ts src/lib/office-validation.test.ts
git commit -m "Validate the two text changes and register their undo kinds"
```

---

### Task 4: Apply the changes in the two server actions

**Files:**
- Modify: `src/app/[locale]/office/collection/actions.ts`
- Modify: `src/app/[locale]/office/gallery/actions.ts`
- Modify: `src/lib/action-guard.test.ts` (the structural scan, only if it enumerates change types)

**Interfaces:**
- Consumes: `saveTextOverride` from Task 1; the two change types from Task 3.
- Produces: no new exports. `applyCollectionChanges` and `applyGalleryChanges` accept and persist the text changes.

- [ ] **Step 1: Write the failing test**

Create `src/lib/live-text.store.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `records.ts` reads the data directory into a module-level constant, so the
// store tests reset the module registry and import inside the test. Copied
// from src/lib/office-history.test.ts; keep the two in step.
let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-text-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("saveTextOverride", () => {
  it("writes one record per field and language, newest winning", async () => {
    const { saveTextOverride, textOverrides } = await import("./live-text");
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Primera",
    });
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Segunda",
    });
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "en",
      value: "English",
    });

    const overrides = textOverrides();
    expect(overrides).toHaveLength(2);
    expect(overrides.find((record) => record.locale === "es")!.value).toBe("Segunda");
    expect(overrides.find((record) => record.locale === "en")!.value).toBe("English");
  });
});
```

The dynamic `await import("./live-text")` inside each test is required, not a style choice: `src/lib/records.ts` reads the directory into a module-level constant at import time, so a static import would bind the real data directory before `beforeEach` runs.

- [ ] **Step 2: Run the test and watch it fail or pass**

Run: `npx vitest run src/lib/live-text.store.test.ts`
Expected: PASS if Task 1 is correct. This test guards the store shape, not new behaviour. If it fails on the temporary directory, fix the harness to match `records.test.ts`.

- [ ] **Step 3: Handle the change in both actions**

In `src/app/[locale]/office/collection/actions.ts`, add the import and a case inside the switch, after `style-override`:

```ts
import { saveTextOverride } from "@/lib/live-text";
```

and add `TEXT_LIMITS` to the existing import from `@/lib/office-validation`.

```ts
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
          return;
        }
```

In `src/app/[locale]/office/gallery/actions.ts`:

```ts
import { saveTextOverride } from "@/lib/live-text";
```

```ts
      case "work-text": {
        if (!manageableGallery().some((work) => work.id === change.id)) {
          throw new ChangeRefused("unknown-work");
        }
        await saveTextOverride({
          subject: "gallery",
          id: change.id,
          field: change.field,
          locale: change.locale,
          value: change.value,
        });
        return;
      }
```

The collection action's `revalidate` list already covers the pages a garment's words appear on. The gallery action's list is `["/[locale]/office/gallery", "/[locale]/gallery"]`, which is correct for captions.

- [ ] **Step 4: Run the suite and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-text.store.test.ts "src/app/[locale]/office/collection/actions.ts" "src/app/[locale]/office/gallery/actions.ts"
git commit -m "Persist a confirmed text change from the collection and gallery actions"
```

---

### Task 5: Undo for the two text streams

**Files:**
- Modify: `src/lib/office-history.ts`
- Modify: `src/lib/office-history.test.ts`

**Interfaces:**
- Consumes: `TextOverride`, `textKey` from Task 1; `UndoKind` from Task 3.
- Produces: `previousChangeFor("style-text" | "work-text", id)` and `undoableIds` for both, where `id` is the composite `"<id>:<field>:<locale>"`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/office-history.test.ts`, following the temporary-store pattern the file already uses:

```ts
describe("text undo", () => {
  it("stages the previous words", async () => {
    const { saveTextOverride } = await import("./live-text");
    const { previousChangeFor } = await import("./office-history");
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Primera",
    });
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Segunda",
    });

    const change = previousChangeFor("style-text", "s1:description:es");
    expect(change).toMatchObject({
      type: "style-text",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Primera",
    });
  });

  it("stages a return to the coded words when there is only one version", async () => {
    const { saveTextOverride } = await import("./live-text");
    const { previousChangeFor } = await import("./office-history");
    await saveTextOverride({
      subject: "gallery",
      id: "g1",
      field: "caption",
      locale: "en",
      value: "Only",
    });

    expect(previousChangeFor("work-text", "g1:caption:en")).toMatchObject({
      type: "work-text",
      id: "g1",
      field: "caption",
      locale: "en",
      value: "",
    });
  });

  it("offers undo on a field that has been edited once", async () => {
    const { saveTextOverride } = await import("./live-text");
    const { undoableIds } = await import("./office-history");
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "name",
      locale: "es",
      value: "Nombre",
    });
    expect(undoableIds("style-text").has("s1:name:es")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/office-history.test.ts`
Expected: FAIL, `streamFor` has no case for `style-text`.

- [ ] **Step 3: Add the two streams**

In `src/lib/office-history.ts`, add the import and two streams, then the two `switch` cases:

```ts
import { textKey, type TextField, type TextOverride, type TextSubject } from "./live-text";
```

```ts
/**
 * Text is keyed by the item, the field and the language together, so each box
 * has its own history. The baseline is the empty value, which the merge reads
 * as a return to the coded words, so a first edit is undoable like any other.
 */
function textStream(subject: TextSubject, type: "style-text" | "work-text"): Stream<TextOverride> {
  const composite = (record: TextOverride) => `${record.id}:${record.field}:${record.locale}`;
  const split = (id: string) => {
    const [itemId, field, locale] = id.split(":");
    return { itemId: itemId ?? "", field: (field ?? "") as TextField, locale: (locale ?? "es") as "es" | "en" };
  };
  const toChange = (record: TextOverride, id: string): OfficeChange => {
    const { itemId, field, locale } = split(id);
    return {
      type,
      key: `text:${subject}:${itemId}:${field}:${locale}`,
      id: itemId,
      field,
      locale,
      value: record.value,
    } as OfficeChange;
  };
  return {
    all: () => readRecords<TextOverride>("text-overrides").filter((r) => r.subject === subject),
    key: composite,
    versions: (id) =>
      readRecords<TextOverride>("text-overrides").filter(
        (record) => record.subject === subject && composite(record) === id,
      ),
    baseline: (id) => {
      const { itemId, field, locale } = split(id);
      if (itemId.length === 0 || field.length === 0) return undefined;
      return {
        type,
        key: `text:${subject}:${itemId}:${field}:${locale}`,
        id: itemId,
        field,
        locale,
        value: "",
      } as OfficeChange;
    },
    toChange,
  };
}

const styleText = textStream("style", "style-text");
const workText = textStream("gallery", "work-text");
```

Add to `streamFor`:

```ts
    case "style-text": return erased(styleText);
    case "work-text": return erased(workText);
```

`versionsOf` is not used here because the records of both subjects share one collection and the key is composite; filtering `readRecords` directly is the same read and keeps the key logic in one place.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/office-history.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/office-history.ts src/lib/office-history.test.ts
git commit -m "Undo a word change back to its previous version or to the coded words"
```

---

### Task 6: The editing surface on both tabs

**Files:**
- Create: `src/components/office/text-fields.tsx`
- Modify: `src/components/collection-manager.tsx`
- Modify: `src/components/gallery-manager.tsx`
- Modify: `src/app/[locale]/office/collection/page.tsx`
- Modify: `src/app/[locale]/office/gallery/page.tsx`
- Modify: `src/messages/es.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: `useOfficeDraft`, `type DraftChange` from `src/components/office/use-office-draft.tsx`; `UndoLink` from `src/components/office/undo-link.tsx`; `TEXT_LIMITS` from Task 3.
- Produces: `<TextFields subject id fields />` where `fields` is `readonly { field: TextField; label: string; es: string; en: string; multiline?: boolean }[]`. `ManagedStyle` grows a `texts` property carrying both languages of the four fields; the gallery row type grows the same for `caption`.

- [ ] **Step 1: Write the component**

Create `src/components/office/text-fields.tsx`:

```tsx
"use client";

import { useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { TEXT_LIMITS } from "@/lib/office-validation";
import type { OfficeChange } from "@/lib/office-validation";
import { useOfficeDraft } from "./use-office-draft";

type Field = {
  readonly field: "name" | "color" | "description" | "detail" | "caption";
  readonly label: string;
  readonly es: string;
  readonly en: string;
  readonly multiline?: boolean;
};

/**
 * The words of one row, in both languages.
 *
 * Every box is pre-filled with what the site shows now, and only a box she
 * actually changes is staged, so correcting the Spanish leaves a good English
 * translation alone. Clearing a box stages the empty value, which the merge
 * reads as a return to the coded words.
 */
export function TextFields({
  subject,
  id,
  fields,
}: {
  subject: "style" | "gallery";
  id: string;
  fields: readonly Field[];
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<OfficeChange>();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs underline underline-offset-4"
        aria-expanded={open}
      >
        {open ? t("textsHide") : t("textsEdit")}
      </button>
      {open ? (
        <div className="mt-3 grid gap-3">
          {fields.map((entry) => (
            <fieldset key={entry.field} className="grid gap-2 sm:grid-cols-2">
              <legend className="text-xs uppercase tracking-wide opacity-70">{entry.label}</legend>
              {(["es", "en"] as const).map((locale) => {
                const key = `text:${subject}:${id}:${entry.field}:${locale}`;
                const pending = draft.pending(key);
                const staged = pending?.change.wire;
                const current =
                  staged && "value" in staged ? staged.value : locale === "es" ? entry.es : entry.en;
                const common = {
                  defaultValue: current,
                  maxLength: TEXT_LIMITS[entry.field],
                  "aria-label": `${entry.label}, ${locale === "es" ? "español" : "English"}`,
                  className: "w-full rounded border px-2 py-1 text-sm",
                  onBlur: (
                    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
                  ) => {
                    const value = event.target.value.trim();
                    const coded = locale === "es" ? entry.es : entry.en;
                    if (value === coded) {
                      draft.unstage(key);
                      return;
                    }
                    draft.stage(key, {
                      wire: {
                        type: subject === "style" ? "style-text" : "work-text",
                        key,
                        id,
                        field: entry.field,
                        locale,
                        value,
                      } as OfficeChange,
                    });
                  },
                };
                return (
                  <label key={locale} className="grid gap-1 text-sm">
                    <span className="text-xs opacity-70">
                      {locale === "es" ? t("textsSpanish") : t("textsEnglish")}
                      {pending ? ` ${t("pending")}` : ""}
                    </span>
                    {entry.multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

Read `src/components/office/confirm-bar.tsx` for the exact class names and the pending mark used elsewhere, and match them rather than inventing new ones. Check the existing `t("pending")` key name in `src/messages/es.json` and use whatever the other rows use.

- [ ] **Step 2: Add the copy to both bundles**

In `src/messages/es.json`, `office` object:

```json
"textsEdit": "Editar textos",
"textsHide": "Cerrar los textos",
"textsSpanish": "Español",
"textsEnglish": "Inglés",
"textsName": "Nombre",
"textsColor": "Color",
"textsDescription": "Descripción",
"textsDetail": "Detalle",
"textsCaption": "Pie de foto"
```

In `src/messages/en.json`, `office` object:

```json
"textsEdit": "Edit the words",
"textsHide": "Close the words",
"textsSpanish": "Spanish",
"textsEnglish": "English",
"textsName": "Name",
"textsColor": "Colour",
"textsDescription": "Description",
"textsDetail": "Detail",
"textsCaption": "Caption"
```

No em dashes. Check whether the repo has a test that asserts the two bundles have identical key sets; if so it will catch a miss.

- [ ] **Step 3: Feed both languages to the rows**

In `src/app/[locale]/office/collection/page.tsx`, extend the `ManagedStyle` mapping with the raw bilingual values, which `manageableStyles()` already returns as `Localized`:

```ts
    texts: {
      name: style.name,
      color: style.color,
      description: style.description,
      detail: style.detail,
    },
```

Add the matching property to `ManagedStyle` in `src/components/collection-manager.tsx`:

```ts
  readonly texts: {
    readonly name: { readonly es: string; readonly en: string };
    readonly color: { readonly es: string; readonly en: string };
    readonly description: { readonly es: string; readonly en: string };
    readonly detail: { readonly es: string; readonly en: string };
  };
```

Render it inside the active row, directly after the existing retire and undo controls near line 186:

```tsx
<TextFields
  subject="style"
  id={row.id}
  fields={[
    { field: "name", label: t("textsName"), es: row.texts.name.es, en: row.texts.name.en },
    { field: "color", label: t("textsColor"), es: row.texts.color.es, en: row.texts.color.en },
    {
      field: "description",
      label: t("textsDescription"),
      es: row.texts.description.es,
      en: row.texts.description.en,
      multiline: true,
    },
    {
      field: "detail",
      label: t("textsDetail"),
      es: row.texts.detail.es,
      en: row.texts.detail.en,
      multiline: true,
    },
  ]}
/>
```

Do the same for the gallery: pass `caption` as a `Localized` from `src/app/[locale]/office/gallery/page.tsx` into the row type in `src/components/gallery-manager.tsx`, and render one `TextFields` with the single caption field, `multiline: true`.

- [ ] **Step 4: Typecheck, test and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS. The build matters because these are client components inside server pages.

- [ ] **Step 5: Commit**

```bash
git add src/components/office/text-fields.tsx src/components/collection-manager.tsx src/components/gallery-manager.tsx "src/app/[locale]/office/collection/page.tsx" "src/app/[locale]/office/gallery/page.tsx" src/messages/es.json src/messages/en.json
git commit -m "Edit a row's words in both languages, staged into the confirm bar"
```

---

### Task 7: Undo link on each box

**Files:**
- Modify: `src/components/office/text-fields.tsx`
- Modify: `src/app/[locale]/office/collection/page.tsx`
- Modify: `src/app/[locale]/office/gallery/page.tsx`
- Modify: `src/components/collection-manager.tsx`, `src/components/gallery-manager.tsx`

**Interfaces:**
- Consumes: `undoableIds` from Task 5; `UndoLink` from `src/components/office/undo-link.tsx`.
- Produces: `TextFields` takes one more prop, `undoable: ReadonlySet<string>`, holding composite ids `"<id>:<field>:<locale>"`.

- [ ] **Step 1: Pass the undoable set from both pages**

In `src/app/[locale]/office/collection/page.tsx`, beside the existing `undoableIds("style-override")` call:

```ts
  const undoableTexts = undoableIds("style-text");
```

Pass it into `CollectionManager` as a prop and hand it down to `TextFields`. Do the same in the gallery page with `undoableIds("work-text")`.

- [ ] **Step 2: Render the link under a box that has history**

In `text-fields.tsx`, widen the props first:

```tsx
export function TextFields({
  subject,
  id,
  fields,
  undoable,
}: {
  subject: "style" | "gallery";
  id: string;
  fields: readonly Field[];
  undoable: ReadonlySet<string>;
}): JSX.Element {
```

Then, inside the `label`, after the input:

```tsx
{undoable.has(`${id}:${entry.field}:${locale}`) && !pending ? (
  <UndoLink kind={subject === "style" ? "style-text" : "work-text"} id={`${id}:${entry.field}:${locale}`} />
) : null}
```

Import `UndoLink` from `./undo-link`.

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/office/text-fields.tsx src/components/collection-manager.tsx src/components/gallery-manager.tsx "src/app/[locale]/office/collection/page.tsx" "src/app/[locale]/office/gallery/page.tsx"
git commit -m "Offer Deshacer on a word box that has a previous version"
```

---

### Task 8: The create forms take both languages

**Files:**
- Modify: `src/lib/office-validation.ts` (`styleCreateSchema`, `galleryWorkSchema`)
- Modify: `src/app/[locale]/office/collection/actions.ts`
- Modify: `src/app/[locale]/office/gallery/actions.ts`
- Modify: `src/components/style-composer.tsx`
- Modify: `src/components/gallery-manager.tsx` (the add form)
- Modify: `src/lib/office-validation.test.ts`
- Modify: `src/messages/es.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `styleCreateSchema` where `name`, `color`, `description` and `detail` are `{ es: string; en: string }`; `galleryWorkSchema` where `caption` is the same shape.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/office-validation.test.ts`:

```ts
describe("bilingual creation", () => {
  const draft = {
    type: "style-create" as const,
    key: "create:1",
    name: { es: "Vestido", en: "Dress" },
    description: { es: "Una descripción larga.", en: "A long enough description." },
    detail: { es: "", en: "" },
    color: { es: "Azul", en: "Blue" },
    categoryId: "dresses",
    fabricId: "laguna",
    sizes: { s: false, m: true, l: false },
    photos: ["/uploads/a.jpg"],
  };

  it("accepts a garment with both languages", () => {
    expect(collectionChangeSchema.safeParse(draft).success).toBe(true);
  });

  it("refuses a garment whose English name is missing", () => {
    expect(
      collectionChangeSchema.safeParse({ ...draft, name: { es: "Vestido", en: "" } }).success,
    ).toBe(false);
  });

  it("accepts a gallery photo with both captions", () => {
    expect(
      galleryChangeSchema.safeParse({
        type: "work-add",
        key: "add:1",
        src: "/uploads/g.jpg",
        width: 10,
        height: 10,
        category: "runway",
        caption: { es: "Un vestido marfil.", en: "An ivory dress." },
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/office-validation.test.ts`
Expected: FAIL, `name` is a string, not an object.

- [ ] **Step 3: Make the schemas bilingual**

In `src/lib/office-validation.ts`, add a helper and change the two schemas:

```ts
/** A field Daysi fills in both languages. The English box is pre-filled from
 *  the Spanish as she types, so neither side is ever blank by accident. */
const pair = (min: number, max: number) =>
  z.object({
    es: z.string().trim().min(min).max(max),
    en: z.string().trim().min(min).max(max),
  });

export const styleCreateSchema = z.object({
  name: pair(2, 60),
  description: pair(10, 400),
  detail: pair(0, 400),
  color: pair(0, 80),
  categoryId: z.enum(categories.map((category) => category.id) as [string, ...string[]]),
  fabricId: z.string().trim().min(1).max(60),
  fixedPrice: z.number().int().min(0).max(5_000_00).optional(),
  sizes: z.object({ s: z.boolean(), m: z.boolean(), l: z.boolean() }).strict(),
  photos: z.array(uploadPath).min(1).max(8),
});
```

and in `galleryWorkSchema` replace `caption: z.string().trim().max(200)` with `caption: pair(0, 200)`.

- [ ] **Step 4: Store the pair in both actions**

In `src/app/[locale]/office/collection/actions.ts`, the `style-create` case: `slugify(draft.name, 50)` becomes `slugify(draft.name.es, 50)`, and the four copied fields become the pair itself:

```ts
            name: draft.name,
            color: draft.color,
            description: draft.description,
            detail: draft.detail,
```

with the photo alt following the name:

```ts
            photos: draft.photos.map((src, index) => ({
              src,
              alt: draft.name,
              isPrimary: index === 0,
            })),
```

In `src/app/[locale]/office/gallery/actions.ts`, the `work-add` case becomes:

```ts
      case "work-add": {
        const { type: _type, key: _key, ...work } = change;
        await addGalleryWork({ id: newReference("GAL").toLowerCase(), ...work });
        return;
      }
```

- [ ] **Step 5: Add the English column to both forms**

In `src/components/style-composer.tsx`, each of the four text inputs becomes a pair of inputs under one label, Spanish then English. Hold the English value in its own state, and mirror the Spanish into it on every Spanish keystroke **until the English box has been edited once**, tracked by a boolean per field:

```tsx
const [nameEs, setNameEs] = useState("");
const [nameEn, setNameEn] = useState("");
const [nameTouched, setNameTouched] = useState(false);

function changeNameEs(value: string) {
  setNameEs(value);
  if (!nameTouched) setNameEn(value);
}
```

Stage `{ es: nameEs.trim(), en: nameEn.trim() }` in the `style-create` wire. Repeat for colour, description and detail, and for the gallery add form's caption in `src/components/gallery-manager.tsx`. Add the labels using the `textsSpanish` and `textsEnglish` keys from Task 6.

- [ ] **Step 6: Run everything**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/office-validation.ts src/lib/office-validation.test.ts "src/app/[locale]/office/collection/actions.ts" "src/app/[locale]/office/gallery/actions.ts" src/components/style-composer.tsx src/components/gallery-manager.tsx src/messages/es.json src/messages/en.json
git commit -m "Take both languages when a garment or a photo is created"
```

---

### Task 9: Browser pass and the manual

**Files:**
- Modify: `docs/manual-del-taller.html`
- Modify: `docs/next-steps.md`

**Interfaces:**
- Consumes: everything above.
- Produces: no code.

- [ ] **Step 1: Run the site**

Use the Browser pane's `preview_start` with the `.claude/launch.json` entry. Do not run `next build` while the dev server is up: both write `.next`. Sign in as the owner; with no Resend key locally the sign-in link prints to the dev server log, and the owner address is in `.env.local`.

- [ ] **Step 2: Walk the four checks**

1. On Collection, open a seeded garment's words, change the Spanish description, confirm, then open the English page for that garment and check the English description is exactly as it was.
2. Clear that same Spanish box, confirm, and check the coded Spanish words are back.
3. Press Deshacer on a box that was edited twice and check the previous words are staged, not written, until Confirmar.
4. Add a garment with a Spanish name and an English name that differ, and check each locale's collection page shows its own.

- [ ] **Step 3: Write it down**

Add a short section to `docs/manual-del-taller.html` in Daysi's voice and in Spanish, explaining that every piece of writing has two boxes, that leaving one empty brings back the original words, and that nothing is saved until Confirmar cambios. Match the surrounding tone. No em dashes.

Update `docs/next-steps.md` to say step 4 is built and awaiting deploy.

- [ ] **Step 4: Commit**

```bash
git add docs/manual-del-taller.html docs/next-steps.md
git commit -m "Write down the two language boxes for Daysi, and update the status"
```

---

## After the plan

Open one pull request from `office-step-4` against `main`. CI must be green. Ask for one whole-branch review before merging. The user runs `npm run deploy` and the production click-through.
