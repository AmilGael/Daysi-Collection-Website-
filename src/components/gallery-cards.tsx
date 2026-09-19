"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { GalleryChange } from "@/lib/office-validation";
import { sectionId } from "@/lib/slugify";
import { Pending } from "./office/confirm-bar";
import { GalleryWorkSheet, NewWorkSheet } from "./office/gallery-work-sheet";
import { GallerySectionsSheet } from "./office/gallery-sections-sheet";
import { RetiredGroup } from "./office/retired-group";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";
import { Tag, buttonClass } from "./ui";

export type ManagedWork = {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly category: string;
  readonly caption: string;
  readonly texts: {
    readonly caption: { readonly es: string; readonly en: string };
  };
  readonly codedTexts: ManagedWork["texts"];
  readonly hidden: boolean;
  readonly retired: boolean;
  readonly undoable: boolean;
};

/** One option in "Dónde va": the six coded sections, plus whatever Daysi has added. */
export type GallerySectionOption = { readonly id: string; readonly label: string; readonly coded: boolean };
export type RetiredSection = { readonly id: string; readonly name: string };

const chip = "absolute top-2 left-2 bg-ink px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-paper";

/**
 * The gallery as cards: photo, caption, the section it belongs to and an
 * "Oculta" mark when hidden. Tap a card for its sheet; the "+" card opens an
 * empty one. Pending new photos sit in the grid until confirm, retired ones
 * under Retirados, and the sections Daysi has named have their own small
 * sheet behind the "Secciones" button.
 */
export function GalleryCards({
  works,
  retired,
  categories,
  retiredSections,
  undoableTexts,
}: {
  works: readonly ManagedWork[];
  retired: readonly ManagedWork[];
  categories: readonly GallerySectionOption[];
  retiredSections: readonly RetiredSection[];
  undoableTexts: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<GalleryChange>();
  const [open, setOpen] = useState<string | "new" | "sections" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  usePreviewCleanup(draft.entries);

  const opened = open !== null && open !== "new" && open !== "sections" ? (works.find((row) => row.id === open) ?? null) : null;
  useEffect(() => {
    if (open !== null && open !== "new" && open !== "sections" && !opened) close();
  }, [open, opened, close]);

  const sectionLabelOf = (id: string): string =>
    categories.find((option) => option.id === id)?.label ?? retiredSections.find((section) => section.id === id)?.name ?? id;

  const pendingAdds = draft.entries.filter((entry) => entry.change.wire.type === "work-add");

  // Removing the photo that named a new section should take the section
  // with it, unless another pending photo still carries the same category —
  // otherwise confirming would leave behind a section with nothing filed
  // under it.
  function removePendingWork(entryKey: string, category: string) {
    draft.unstage(entryKey);
    const stillNamed = pendingAdds.some(
      (other) => other.key !== entryKey && other.change.wire.type === "work-add" && other.change.wire.category === category,
    );
    if (stillNamed) return;
    const section = draft.entries.find(
      (candidate) => candidate.change.wire.type === "section-add" && sectionId(candidate.change.wire.name) === category,
    );
    if (section) draft.unstage(section.key);
  }

  const title =
    open === "new" ? t("newWorkTitle") : open === "sections" ? t("gallerySections") : opened ? opened.caption || opened.id : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen("sections")} className={buttonClass({ size: "small", tone: "outline" })}>
          {t("gallerySections")}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <button
            type="button"
            onClick={() => setOpen("new")}
            className="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-[0.8125rem] text-ink-soft hover:border-ink"
          >
            <span className="text-3xl leading-none">+</span>
            {t("galleryAdd")}
          </button>
        </li>

        {works.map((work) => {
          const key = `gallery:${work.id}`;
          const entry = draft.pending(key);
          const hidden = entry?.change.wire.type === "work-visibility" ? entry.change.wire.hidden : work.hidden;
          const retiring = entry?.change.wire.type === "retire";
          return (
            <li key={work.id} className={`flex flex-col gap-2 ${retiring ? "opacity-50" : ""}`}>
              <button type="button" onClick={() => setOpen(work.id)} className="flex flex-col gap-2 text-left">
                <span className="relative block aspect-3/4 w-full overflow-hidden bg-paper-warm">
                  <Image src={work.src} alt="" fill sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                  {hidden ? <span className={chip}>{t("hiddenChip")}</span> : null}
                </span>
                <span className="truncate text-[0.9375rem] leading-tight">{work.texts.caption.es || work.id}</span>
                <Tag>{sectionLabelOf(work.category)}</Tag>
              </button>
              {entry ? <Pending confirming={entry.confirming} error={entry.error} count={entry.count} /> : null}
            </li>
          );
        })}

        {pendingAdds.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "work-add") return null;
          const src = typeof entry.change.meta === "string" ? entry.change.meta : undefined;
          return (
            <li key={entry.key} className="flex flex-col gap-2">
              <span className="relative block aspect-3/4 w-full overflow-hidden bg-paper-warm">
                {src ? <Image src={src} alt="" fill unoptimized sizes="14rem" className="object-cover" /> : null}
              </span>
              <span className="truncate text-[0.9375rem] leading-tight">{wire.caption.es}</span>
              <span className="flex items-center gap-3">
                <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
                <button type="button" onClick={() => removePendingWork(entry.key, wire.category)} className="text-xs underline underline-offset-4">
                  {t("dropChanges")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <RetiredGroup
        items={retired.map((work) => ({ id: work.id, name: work.caption || work.id, photo: work.src }))}
        restoreKey={(id) => `gallery:${id}`}
        onRestore={(id) => { const key = `gallery:${id}`; draft.stage(key, { wire: { type: "restore", key, id } }); }}
      />

      <Sheet open={open !== null} title={title} onClose={close}>
        {open === "new" ? (
          <NewWorkSheet categories={categories} onDone={close} />
        ) : open === "sections" ? (
          <GallerySectionsSheet categories={categories} retiredSections={retiredSections} />
        ) : opened ? (
          <GalleryWorkSheet row={opened} sectionLabel={sectionLabelOf(opened.category)} undoableTexts={undoableTexts} />
        ) : null}
      </Sheet>
    </div>
  );
}

/** A pending photo's object URL lives as long as some staged change still names it. */
function usePreviewCleanup(entries: readonly { readonly change: { readonly meta?: unknown } }[]): void {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const live = new Set<string>();
    for (const entry of entries) {
      if (typeof entry.change.meta === "string") live.add(entry.change.meta);
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
