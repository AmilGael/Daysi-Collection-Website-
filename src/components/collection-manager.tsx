"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { CollectionChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { RetiredGroup, RetireButton } from "./office/retired-group";
import { TextFields } from "./office/text-fields";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft, type DraftChange } from "./office/use-office-draft";

export type ManagedStyle = {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly photo: string;
  readonly photoCount: number;
  readonly isPublished: boolean;
  readonly sizes: readonly { readonly sizeId: "s" | "m" | "l"; readonly inStock: boolean }[];
  readonly addedPhotos: readonly string[];
  readonly coverSrc?: string;
  readonly retired: boolean;
  readonly undoable: boolean;
  readonly texts: {
    readonly name: { readonly es: string; readonly en: string };
    readonly color: { readonly es: string; readonly en: string };
    readonly description: { readonly es: string; readonly en: string };
    readonly detail: { readonly es: string; readonly en: string };
  };
};

type StyleOverrideChange = Extract<CollectionChange, { type: "style-override" }>;

function overrideWire(row: ManagedStyle): StyleOverrideChange {
  return {
    type: "style-override",
    key: `style:${row.id}`,
    styleId: row.id,
    isPublished: row.isPublished,
    stock: Object.fromEntries(row.sizes.map((size) => [size.sizeId, size.inStock])),
    addedPhotos: [...row.addedPhotos],
    ...(row.coverSrc ? { coverSrc: row.coverSrc } : {}),
  };
}

function applied(row: ManagedStyle, wire: StyleOverrideChange): ManagedStyle {
  return {
    ...row,
    isPublished: wire.isPublished,
    sizes: row.sizes.map((size) => ({
      ...size,
      inStock: wire.stock[size.sizeId] ?? size.inStock,
    })),
    addedPhotos: wire.addedPhotos ?? [],
    coverSrc: wire.coverSrc,
    photo: wire.coverSrc ?? row.photo,
  };
}

function sameOverride(left: StyleOverrideChange, right: StyleOverrideChange): boolean {
  return left.isPublished === right.isPublished
    && left.stock.s === right.stock.s
    && left.stock.m === right.stock.m
    && left.stock.l === right.stock.l
    && JSON.stringify(left.addedPhotos ?? []) === JSON.stringify(right.addedPhotos ?? [])
    && left.coverSrc === right.coverSrc;
}

export function CollectionManager({
  styles,
  retired,
  locale: _locale,
  undoableTexts,
}: {
  styles: readonly ManagedStyle[];
  retired: readonly ManagedStyle[];
  locale: Locale;
  undoableTexts: ReadonlySet<string>;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();

  function stageOverride(
    row: ManagedStyle,
    patch: Partial<Pick<ManagedStyle, "isPublished" | "sizes">>,
    extra?: { file: File; asCover: boolean },
  ) {
    const key = `style:${row.id}`;
    const entry = draft.pending(key);
    const existingWire = entry?.change.wire.type === "style-override" ? entry.change.wire : undefined;
    const view = existingWire ? applied(row, existingWire) : row;
    const wire = overrideWire({ ...view, ...patch });
    const priorFiles = entry?.change.files ?? [];
    const priorUploads = entry?.change.withUploads;

    if (!extra && priorFiles.length === 0 && sameOverride(wire, overrideWire(row))) {
      draft.unstage(key);
      return;
    }

    let change: DraftChange<CollectionChange> = { wire };
    if (priorFiles.length > 0 && priorUploads) {
      change = {
        wire,
        files: priorFiles,
        withUploads: (srcs) => {
          const uploaded = priorUploads(srcs);
          return uploaded.type === "style-override"
            ? { ...uploaded, isPublished: wire.isPublished, stock: wire.stock }
            : wire;
        },
      };
    }
    if (extra) {
      const priorCount = priorFiles.length;
      change = {
        wire,
        files: [...priorFiles, extra.file],
        withUploads: (srcs) => {
          const previous = priorUploads?.(srcs.slice(0, priorCount));
          const uploaded = previous?.type === "style-override"
            ? { ...previous, isPublished: wire.isPublished, stock: wire.stock }
            : wire;
          const src = srcs[priorCount];
          if (!src) return uploaded;
          return {
            ...uploaded,
            addedPhotos: [...(uploaded.addedPhotos ?? []), src],
            ...(extra.asCover ? { coverSrc: src } : {}),
          };
        },
      };
    }
    draft.stage(key, change);
  }

  const visibleRows = styles.map((row) => {
    const entry = draft.pending(`style:${row.id}`);
    return entry?.change.wire.type === "style-override" ? applied(row, entry.change.wire) : row;
  });
  const pendingCreates = draft.entries.filter((entry) => entry.change.wire.type === "style-create");

  return (
    <div className="flex flex-col border-t border-line">
      {styles.map((row) => {
        const key = `style:${row.id}`;
        const entry = draft.pending(key);
        const view = entry?.change.wire.type === "style-override" ? applied(row, entry.change.wire) : row;
        const retiring = entry?.change.wire.type === "retire";

        return (
          <div
            key={row.id}
            className={`grid grid-cols-[3rem_1fr] items-center gap-4 border-b border-line py-4 sm:grid-cols-[3rem_1fr_auto_auto] sm:gap-6 ${retiring ? "opacity-50" : ""}`}
          >
            <div className="relative aspect-3/4 overflow-hidden bg-paper-warm">
              <Image src={view.photo} alt="" fill sizes="3rem" className="object-cover" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[0.9375rem]">{view.name}</p>
              <p className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
                {view.category}
                <span className="ml-3 normal-case tracking-normal">
                  {t("photoCount", { count: view.photoCount + (entry?.change.files?.length ?? 0) })}
                </span>
              </p>
              {entry ? (
                <span className="flex items-center gap-3">
                  <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
                  <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                    {t("removePending")}
                  </button>
                </span>
              ) : null}
              <label className="mt-1 w-fit cursor-pointer text-[0.75rem] underline underline-offset-4 hover:text-marigold-deep">
                {t("addPhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) stageOverride(row, {}, { file, asCover: window.confirm(t("photoCoverAsk")) });
                    event.target.value = "";
                  }}
                />
              </label>
              {!retiring ? (
                <span className="flex items-center gap-3">
                  <RetireButton
                    name={view.name}
                    onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })}
                  />
                  {row.undoable && !entry ? <UndoLink kind="style-override" id={row.id} /> : null}
                </span>
              ) : null}
              <TextFields
                subject="style"
                id={row.id}
                undoable={undoableTexts}
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
            </div>

            <fieldset className="col-start-2 flex items-center gap-4 sm:col-start-3">
              <legend className="sr-only">{t("stockLegend", { name: view.name })}</legend>
              {view.sizes.map((size) => (
                <label key={size.sizeId} className="flex cursor-pointer items-center gap-1.5 text-[0.8125rem] uppercase">
                  <input
                    type="checkbox"
                    checked={size.inStock}
                    disabled={retiring}
                    onChange={(event) => stageOverride(row, {
                      sizes: view.sizes.map((candidate) => candidate.sizeId === size.sizeId
                        ? { ...candidate, inStock: event.target.checked }
                        : candidate),
                    })}
                    className="h-4 w-4 accent-ink"
                  />
                  {size.sizeId}
                </label>
              ))}
            </fieldset>

            <label className="col-start-2 flex w-fit cursor-pointer items-center gap-2 text-[0.8125rem] sm:col-start-4">
              <input
                type="checkbox"
                checked={view.isPublished}
                disabled={retiring}
                onChange={(event) => stageOverride(row, { isPublished: event.target.checked })}
                className="h-4 w-4 accent-ink"
              />
              {view.isPublished ? t("shown") : t("hidden")}
            </label>
          </div>
        );
      })}

      {pendingCreates.map((entry) => {
        const wire = entry.change.wire;
        if (wire.type !== "style-create") return null;
        return (
          <div key={entry.key} className="flex items-center gap-4 border-b border-line py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem]">{wire.name}</p>
              <p className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">{wire.categoryId}</p>
            </div>
            <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
            <button type="button" onClick={() => draft.unstage(entry.key)} className="text-xs underline underline-offset-4">
              {t("removePending")}
            </button>
          </div>
        );
      })}

      <p className="pt-4 text-[0.8125rem] leading-relaxed text-ink-faint">
        {t("collectionNote", { count: visibleRows.filter((row) => row.isPublished).length })}
      </p>
      <RetiredGroup
        items={retired.map((row) => ({ id: row.id, name: row.name, photo: row.photo }))}
        restoreKey={(id) => `style:${id}`}
        onRestore={(id) => {
          const key = `style:${id}`;
          draft.stage(key, { wire: { type: "restore", key, id } });
        }}
      />
    </div>
  );
}
