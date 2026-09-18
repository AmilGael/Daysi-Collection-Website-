"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import {
  CODED_SECTIONS,
  addGallerySection,
  addGalleryWork,
  addedGallerySections,
  liveGallerySections,
  manageableGallery,
  sectionId,
  setGalleryVisibility,
} from "@/lib/live-gallery";
import { saveTextOverride } from "@/lib/live-text";
import { changesOf, galleryChangeSchema, type GalleryChange } from "@/lib/office-validation";
import { retiredSet, setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";
import { translateToEnglish, withEnglish } from "@/lib/translate";

/**
 * section-add runs before everything else in the batch, so a photo filed
 * under a section staged in the same batch finds it already on the live
 * list when work-add's own check runs a moment later; every other change
 * on this tab applies in the order it arrived, as it always did.
 */
const CHANGE_RANK: Record<GalleryChange["type"], number> = {
  "section-add": 0,
  "work-add": 1,
  "work-visibility": 1,
  "work-text": 1,
  retire: 1,
  restore: 1,
  "section-retire": 1,
  "section-restore": 1,
};

/**
 * A retire or a restore of a section, by the same reasoning
 * office/prices/actions.ts uses for an added alteration or session: a coded
 * one came with the site and is not hers to take away, and one she added
 * can only go if no visible, unretired photo still sits in it — a hidden or
 * already-retired photo does not count, since it is not showing anywhere
 * that filtering by section would matter.
 */
async function setSectionRetired(id: string, retired: boolean): Promise<void> {
  if ((CODED_SECTIONS as readonly string[]).includes(id)) throw new ChangeRefused("coded-section");
  if (!addedGallerySections().some((section) => section.id === id)) throw new ChangeRefused("unknown-section");
  if (retired) {
    const count = manageableGallery().filter(
      (work) => !work.hidden && !work.retired && work.category === id,
    ).length;
    if (count > 0) throw new ChangeRefused("section-in-use", count);
  }
  await setRetired("gallery-section", id, retired);
}

export const applyGalleryChanges = ownerAction(
  changesOf(galleryChangeSchema),
  async (changes) => {
    const ordered = [...changes].sort((a, b) => CHANGE_RANK[a.type] - CHANGE_RANK[b.type]);
    return applyEach(ordered, async (change) => {
      switch (change.type) {
        case "work-add": {
          if (!liveGallerySections().some((section) => section.id === change.category)) {
            throw new ChangeRefused("unknown-section");
          }
          const { type: _type, key: _key, ...work } = change;
          await addGalleryWork({ id: newReference("GAL").toLowerCase(), ...work });
          return;
        }
        case "work-visibility":
          if (!manageableGallery().some((work) => work.id === change.id)) throw new ChangeRefused("unknown-work");
          await setGalleryVisibility(change.id, change.hidden);
          return;
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
        case "retire":
          if (!manageableGallery().some((work) => work.id === change.id)) throw new ChangeRefused("unknown-work");
          await setRetired("gallery", change.id, true);
          return;
        case "restore":
          await setRetired("gallery", change.id, false);
          return;
        case "section-add": {
          const id = sectionId(change.name);
          if (liveGallerySections().some((section) => section.id === id)) throw new ChangeRefused("section-exists");
          if (retiredSet("gallery-section").has(id)) throw new ChangeRefused("section-retired");
          const words = withEnglish({ name: change.name }, await translateToEnglish({ name: change.name }, "section"));
          await addGallerySection({ id, name: words.name!, addedAt: new Date().toISOString() });
          return;
        }
        case "section-retire":
          await setSectionRetired(change.id, true);
          return;
        case "section-restore":
          await setSectionRetired(change.id, false);
      }
    });
  },
  { revalidate: ["/[locale]/office/gallery", "/[locale]/gallery"] },
);
