"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import type { FabricChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { fabricKey, representativePrice, type ManagedFabric } from "./office/fabric-draft";
import { FabricSheet, NewFabricSheet } from "./office/fabric-sheet";
import { RetiredGroup } from "./office/retired-group";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";

/**
 * The fabric wall as cards: swatch, name, the price it writes, and a pending
 * mark. Tap a card for its sheet — the swatch, that one price (read-only:
 * Precios is where a pair is repriced), and Retirar for a bolt Daysi added
 * herself. The "+" card opens an empty sheet with one price box instead of
 * the four the old form asked for, written into every category pair at
 * once. Pending adds sit in the grid until Confirmar; retired bolts sit
 * under Retirados.
 */
export function FabricManager({
  fabrics,
  retired,
  locale,
}: {
  fabrics: readonly ManagedFabric[];
  retired: readonly ManagedFabric[];
  locale: Locale;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<FabricChange>();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  usePreviewCleanup(draft.entries);

  const opened = open !== null && open !== "new" ? (fabrics.find((row) => row.id === open) ?? null) : null;
  useEffect(() => {
    if (open !== null && open !== "new" && !opened) close();
  }, [open, opened, close]);

  const pendingAdds = draft.entries.filter((entry) => entry.change.wire.type === "fabric-add");

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <button
            type="button"
            onClick={() => setOpen("new")}
            className="flex aspect-square w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-[0.8125rem] text-ink-soft hover:border-ink"
          >
            <span className="text-3xl leading-none">+</span>
            {t("fabricAdd")}
          </button>
        </li>

        {fabrics.map((fabric) => {
          const key = fabricKey(fabric.id);
          const entry = draft.pending(key);
          const retiring = entry?.change.wire.type === "retire";
          const price = representativePrice(fabric.prices);
          return (
            <li key={fabric.id} className={`flex flex-col gap-2 ${retiring ? "opacity-50" : ""}`}>
              <button type="button" onClick={() => setOpen(fabric.id)} className="flex flex-col gap-2 text-left">
                <span className="relative block aspect-square w-full overflow-hidden bg-paper-warm">
                  <Image
                    src={fabric.swatchImage}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw"
                    className="object-cover"
                  />
                </span>
                <span className="truncate text-[0.9375rem] leading-tight">
                  {fabric.name}
                  {fabric.custom ? <span className="block text-[0.6875rem] text-ink-faint">{t("fabricYours")}</span> : null}
                </span>
                <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
                  {price === null
                    ? t("priceUnknown")
                    : price.varies
                      ? t("fabricPriceFrom", { price: formatMoney(price.cents, locale) })
                      : formatMoney(price.cents, locale)}
                </span>
              </button>
              {entry ? <Pending confirming={entry.confirming} error={entry.error} count={entry.count} /> : null}
            </li>
          );
        })}

        {pendingAdds.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "fabric-add") return null;
          const src = typeof entry.change.meta === "string" ? entry.change.meta : undefined;
          const cents = wire.prices.dresses ?? wire.prices.pants ?? wire.prices.shirts ?? wire.prices.heritage;
          return (
            <li key={entry.key} className="flex flex-col gap-2">
              <span className="relative block aspect-square w-full overflow-hidden bg-paper-warm">
                {src ? <Image src={src} alt="" fill unoptimized sizes="14rem" className="object-cover" /> : null}
              </span>
              <span className="truncate text-[0.9375rem] leading-tight">{wire.name}</span>
              {cents !== undefined ? (
                <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
                  {formatMoney(cents, locale)}
                </span>
              ) : null}
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

      <RetiredGroup
        items={retired.map((fabric) => ({ id: fabric.id, name: fabric.name, photo: fabric.swatchImage }))}
        restoreKey={(id) => fabricKey(id)}
        onRestore={(id) => {
          const key = fabricKey(id);
          draft.stage(key, { wire: { type: "restore", key, id } });
        }}
      />

      <Sheet open={open !== null} title={open === "new" ? t("newFabricTitle") : (opened?.name ?? "")} onClose={close}>
        {open === "new" ? (
          <NewFabricSheet onDone={close} />
        ) : opened ? (
          <FabricSheet row={opened} locale={locale} />
        ) : null}
      </Sheet>
    </div>
  );
}

/** A pending fabric's object URL lives as long as some staged change still names it. */
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
