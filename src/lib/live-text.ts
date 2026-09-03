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
