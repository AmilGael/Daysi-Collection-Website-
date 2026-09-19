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
  translationEnabled,
}: {
  styles: readonly ManagedStyle[];
  retired: readonly ManagedStyle[];
  locale: Locale;
  categories: readonly Picker[];
  fabrics: readonly Picker[];
  pricedPairs: Readonly<Record<string, { readonly fixedPrice: number; readonly customizationExtra: number }>>;
  undoableTexts: ReadonlySet<string>;
  translationEnabled: boolean;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  usePreviewCleanup(draft.entries);

  const opened = open !== null && open !== "new" ? (styles.find((row) => row.id === open) ?? null) : null;
  useEffect(() => {
    if (open !== null && open !== "new" && !opened) close();
  }, [open, opened, close]);
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
            else draft.stage(key, overrideChange(row, next));
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
                {SIZES.map((size) => {
                  const stocked = view.stock[size];
                  // A counted size shows what is left and is changed in the
                  // sheet; a size never counted keeps its quick switch.
                  if (typeof stocked === "number") {
                    return (
                      <span
                        key={size}
                        className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1 border px-2 text-[0.75rem] font-semibold uppercase ${
                          stocked > 0 ? "border-ink text-ink" : "border-line text-ink-faint line-through"
                        }`}
                      >
                        {size}
                        <span className="tabular-nums">{stocked}</span>
                      </span>
                    );
                  }
                  return (
                    <button
                      key={size}
                      type="button"
                      role="switch"
                      aria-checked={stocked}
                      aria-label={size.toUpperCase()}
                      disabled={retiring}
                      onClick={() => update({ ...view, stock: { ...view.stock, [size]: !stocked } })}
                      className={`min-h-9 min-w-9 border text-[0.75rem] font-semibold uppercase disabled:opacity-60 ${
                        stocked ? "border-ink bg-ink text-paper" : "border-line text-ink-faint line-through"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
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
          <GarmentSheet row={opened} locale={locale} undoableTexts={undoableTexts} translationEnabled={translationEnabled} />
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
