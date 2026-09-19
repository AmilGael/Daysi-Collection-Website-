"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import type { GallerySectionOption, RetiredSection } from "@/components/gallery-cards";
import type { GalleryChange } from "@/lib/office-validation";
import { Pending } from "./confirm-bar";
import { RetireButton, RetiredGroup } from "./retired-group";
import { useOfficeDraft } from "./use-office-draft";

/**
 * The sections Daysi has added to "Dónde va" (the six coded ones don't
 * appear here — they can't be retired), each with Retirar, and the ones
 * she has retired, with Restaurar.
 */
export function GallerySectionsSheet({
  categories,
  retiredSections,
}: {
  categories: readonly GallerySectionOption[];
  retiredSections: readonly RetiredSection[];
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<GalleryChange>();
  const addedSections = categories.filter((section) => !section.coded);

  return (
    <div className="flex flex-col gap-6">
      {addedSections.length > 0 ? (
        <ul className="divide-y divide-line">
          {addedSections.map((section) => {
            const key = `section:${section.id}`;
            const entry = draft.pending(key);
            const retiring = entry?.change.wire.type === "section-retire";
            return (
              <li key={section.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className={`text-sm ${retiring ? "opacity-50" : ""}`}>{section.label}</span>
                {entry ? (
                  <span className="flex items-center gap-2">
                    <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
                    <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                      {t("removePending")}
                    </button>
                  </span>
                ) : (
                  <RetireButton
                    name={section.label}
                    onConfirm={() => draft.stage(key, { wire: { type: "section-retire", key, id: section.id } })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <RetiredGroup
        items={retiredSections.map((section) => ({ id: section.id, name: section.name }))}
        restoreKey={(id) => `section:${id}`}
        onRestore={(id) => { const key = `section:${id}`; draft.stage(key, { wire: { type: "section-restore", key, id } }); }}
      />
    </div>
  );
}
