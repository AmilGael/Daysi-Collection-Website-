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
  type CollectionChange,
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
 * Every change applies in this order: photos and switches, then a retire or
 * restore, then a new garment, all before any word is translated, so a
 * Spanish correction is never lost under a photo upload; text changes come
 * next; Traducir runs last, once the words it might read are already saved.
 */
const CHANGE_RANK: Record<CollectionChange["type"], number> = {
  "style-override": 0,
  retire: 0,
  restore: 0,
  "style-create": 0,
  "style-text": 1,
  translate: 2,
};

export const applyCollectionChanges = ownerAction(
  changesOf(collectionChangeSchema),
  async (changes) => {
    const ordered = [...changes].sort((a, b) => CHANGE_RANK[a.type] - CHANGE_RANK[b.type]);

    // Every Spanish word she is correcting in this batch, grouped by
    // garment, so a garment with several fields edited at once costs one
    // translation call rather than one per field.
    const esTextByGarment = new Map<string, Partial<Record<Field, string>>>();
    for (const change of ordered) {
      if (change.type === "style-text" && change.locale === "es" && change.value.length > 0) {
        esTextByGarment.set(change.id, { ...esTextByGarment.get(change.id), [change.field]: change.value });
      }
    }
    const englishCache = new Map<string, Record<string, string> | null>();

    return applyEach(ordered, async (change) => {
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
              if (!englishCache.has(change.id)) {
                englishCache.set(change.id, await translateToEnglish(esTextByGarment.get(change.id) ?? {}, "garment"));
              }
              const english = englishCache.get(change.id);
              await saveTextOverride({
                subject: "style",
                id: change.id,
                field: change.field,
                locale: "en",
                value: english?.[change.field] ?? change.value,
              });
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
          const paired = withEnglish(spanish, await translateToEnglish(spanish, "garment"));
          // withEnglish pairs every key of `spanish`, so each field below is
          // present; noUncheckedIndexedAccess cannot see that from the
          // Record<string, ...> it returns.
          const words: Record<Field, { es: string; en: string }> = {
            name: paired.name!,
            color: paired.color!,
            description: paired.description!,
            detail: paired.detail!,
          };

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
    });
  },
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
