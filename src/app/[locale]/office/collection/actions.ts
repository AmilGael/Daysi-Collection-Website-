"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import {
  manageableStyles,
  saveAddedStyle,
  saveStyleOverride,
} from "@/lib/live-catalog";
import {
  collectionChangeSchema,
  changesOf,
} from "@/lib/office-validation";
import {
  CUSTOMIZATION_EXTRA,
  liveFabrics,
  livePriceList,
  saveCustomEntry,
} from "@/lib/live-pricing";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { slugify } from "@/lib/slugify";

export const applyCollectionChanges = ownerAction(
  changesOf(collectionChangeSchema),
  async (changes) =>
    applyEach(changes, async (change) => {
      switch (change.type) {
        case "style-override": {
          if (!manageableStyles().some((style) => style.id === change.styleId)) {
            throw new ChangeRefused("unknown-style");
          }
          const { type: _type, key: _key, ...override } = change;
          await saveStyleOverride(override);
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
          const existing = livePriceList().find((entry) => entry.id === priceEntryId);
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

          // Retired styles keep their slugs so restoring one cannot create a collision.
          const taken = new Set(manageableStyles().map((style) => style.slug));
          const base = slugify(draft.name, 50) || newReference("STY").toLowerCase();
          let slug = base;
          for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

          await saveAddedStyle({
            id: newReference("STY").toLowerCase(),
            slug,
            name: { en: draft.name, es: draft.name },
            categoryId: draft.categoryId,
            priceEntryId,
            color: { en: draft.color, es: draft.color },
            description: { en: draft.description, es: draft.description },
            detail: { en: draft.detail, es: draft.detail },
            sizes: (["s", "m", "l"] as const).map((sizeId) => ({
              sizeId,
              inStock: draft.sizes[sizeId],
            })),
            photos: draft.photos.map((src, index) => ({
              src,
              alt: { en: draft.name, es: draft.name },
              isPrimary: index === 0,
            })),
            customizationAvailable: true,
            isPublished: true,
          });
          return;
        }
        case "retire":
          if (!manageableStyles().some((style) => style.id === change.id)) {
            throw new ChangeRefused("unknown-style");
          }
          await setRetired("style", change.id, true);
          return;
        case "restore":
          await setRetired("style", change.id, false);
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
    ],
  },
);
