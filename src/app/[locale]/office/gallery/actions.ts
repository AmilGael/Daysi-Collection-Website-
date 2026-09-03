"use server";

import { ChangeRefused, applyEach, ownerAction } from "@/lib/action-guard";
import { addGalleryWork, manageableGallery, setGalleryVisibility } from "@/lib/live-gallery";
import { saveTextOverride } from "@/lib/live-text";
import { changesOf, galleryChangeSchema } from "@/lib/office-validation";
import { setRetired } from "@/lib/retired";
import { newReference } from "@/lib/security";

export const applyGalleryChanges = ownerAction(
  changesOf(galleryChangeSchema),
  async (changes) => applyEach(changes, async (change) => {
    switch (change.type) {
      case "work-add": {
        const { type: _type, key: _key, caption, ...work } = change;
        await addGalleryWork({ id: newReference("GAL").toLowerCase(), ...work, caption: { en: caption, es: caption } });
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
    }
  }),
  { revalidate: ["/[locale]/office/gallery", "/[locale]/gallery"] },
);
