"use client";

import { useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { centsFromInput } from "@/lib/money";
import type { PriceChange } from "@/lib/office-validation";
import { inBox } from "./garment-draft";
import { MoneyBox } from "./garment-sheet";
import { Pending } from "./confirm-bar";
import {
  alterationKey,
  appointmentKey,
  entryKey,
  type ManagedAlteration,
  type ManagedAppointment,
  type ManagedEntry,
} from "./price-draft";
import { RetireButton } from "./retired-group";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

/** The most any price on this tab may be, as everywhere else in the office. */
const MAX_CENTS = 500_000;

/** The dropped-pending row shown at the top of every sheet below, once. */
function PendingRow({ pending, onDrop }: { pending: { confirming?: boolean; error?: string; count?: number }; onDrop(): void }): JSX.Element {
  const t = useTranslations("office");
  return (
    <span className="flex items-center gap-3">
      <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
      <button type="button" onClick={onDrop} className="text-xs underline underline-offset-4">
        {t("dropChanges")}
      </button>
    </span>
  );
}

/**
 * One garment price already on the list: its two money boxes (the same
 * decimal box the whole office uses), Retirar, and Deshacer. Every box
 * stages into the one `entry:<id>` change, read back from the draft, so
 * closing and reopening the sheet shows exactly what is pending. Replaces
 * editing this row's two inputs inline in a table of thirty, which on a
 * phone dropped the cursor mid-number.
 */
export function EntryPriceSheet({ row }: { row: ManagedEntry }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const key = entryKey(row.id);
  const pending = draft.pending(key);
  const wire = pending?.change.wire;
  const retiring = wire?.type === "retire";
  const fixedPrice = wire?.type === "entry" ? wire.fixedPrice : row.fixedPrice;
  const customizationExtra = wire?.type === "entry" ? wire.customizationExtra : row.customizationExtra;
  const [typing, setTyping] = useState<{ price?: string; extra?: string }>({});
  const shownPrice = typing.price ?? inBox(fixedPrice);
  const shownExtra = typing.extra ?? inBox(customizationExtra);

  function change(next: { price?: string; extra?: string }) {
    setTyping((current) => ({ ...current, ...next }));
    const priceCents = centsFromInput(next.price ?? shownPrice);
    const extraCents = centsFromInput(next.extra ?? shownExtra);
    if (priceCents === null || extraCents === null || priceCents > MAX_CENTS || extraCents > MAX_CENTS) return;
    if (priceCents === row.fixedPrice && extraCents === row.customizationExtra) draft.unstage(key);
    else draft.stage(key, { wire: { type: "entry", key, id: row.id, fixedPrice: priceCents, customizationExtra: extraCents } });
  }

  return (
    <div className={`flex flex-col gap-8 ${retiring ? "opacity-50" : ""}`}>
      {pending ? <PendingRow pending={pending} onDrop={() => draft.unstage(key)} /> : null}

      {row.ownPriced > 0 ? (
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("entryOwnPriced", { count: row.ownPriced })}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyBox
          label={t("pricesPrice")}
          value={shownPrice}
          disabled={retiring}
          onChange={(text) => change({ price: text })}
          onBlur={() => setTyping((current) => ({ ...current, price: undefined }))}
        />
        <MoneyBox
          label={t("pricesExtra")}
          value={shownExtra}
          disabled={retiring}
          onChange={(text) => change({ extra: text })}
          onBlur={() => setTyping((current) => ({ ...current, extra: undefined }))}
        />
      </div>

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton
            name={`${row.garment} · ${row.fabric}`}
            onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id, kind: "price-entry" } })}
          />
          {row.undoable && !pending ? <UndoLink kind="price-entry" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One alteration already on the list: Precio and Urgente. Only one Daysi
 * added carries Retirar — the ones the site shipped with only change price.
 */
export function AlterationPriceSheet({ row }: { row: ManagedAlteration }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const key = alterationKey(row.id);
  const pending = draft.pending(key);
  const wire = pending?.change.wire;
  const retiring = wire?.type === "retire";
  const fixedPrice = wire?.type === "alteration" ? wire.fixedPrice : row.fixedPrice;
  const rushSurcharge = wire?.type === "alteration" ? wire.rushSurcharge : row.rushSurcharge;
  const [typing, setTyping] = useState<{ price?: string; rush?: string }>({});
  const shownPrice = typing.price ?? inBox(fixedPrice);
  const shownRush = typing.rush ?? inBox(rushSurcharge);

  function change(next: { price?: string; rush?: string }) {
    setTyping((current) => ({ ...current, ...next }));
    const priceCents = centsFromInput(next.price ?? shownPrice);
    const rushCents = centsFromInput(next.rush ?? shownRush);
    if (priceCents === null || rushCents === null || priceCents > MAX_CENTS || rushCents > MAX_CENTS) return;
    if (priceCents === row.fixedPrice && rushCents === row.rushSurcharge) draft.unstage(key);
    else draft.stage(key, { wire: { type: "alteration", key, id: row.id, fixedPrice: priceCents, rushSurcharge: rushCents } });
  }

  return (
    <div className={`flex flex-col gap-8 ${retiring ? "opacity-50" : ""}`}>
      {pending ? <PendingRow pending={pending} onDrop={() => draft.unstage(key)} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyBox
          label={t("pricesPrice")}
          value={shownPrice}
          disabled={retiring}
          onChange={(text) => change({ price: text })}
          onBlur={() => setTyping((current) => ({ ...current, price: undefined }))}
        />
        <MoneyBox
          label={t("pricesRush")}
          value={shownRush}
          disabled={retiring}
          onChange={(text) => change({ rush: text })}
          onBlur={() => setTyping((current) => ({ ...current, rush: undefined }))}
        />
      </div>

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          {!row.coded ? (
            <RetireButton
              name={row.name}
              onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id, kind: "alteration" } })}
            />
          ) : null}
          {row.undoable && !pending ? <UndoLink kind="alteration" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One session already on the list: its Tarifa. Only one Daysi added carries
 * Retirar — the ones the site shipped with only change price.
 */
export function AppointmentPriceSheet({ row }: { row: ManagedAppointment }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const key = appointmentKey(row.id);
  const pending = draft.pending(key);
  const wire = pending?.change.wire;
  const retiring = wire?.type === "retire";
  const fee = wire?.type === "appointment" ? wire.fee : row.fee;
  const [typing, setTyping] = useState<string>();
  const shown = typing ?? inBox(fee);

  function change(text: string) {
    setTyping(text);
    const cents = centsFromInput(text);
    if (cents === null || cents > MAX_CENTS) return;
    if (cents === row.fee) draft.unstage(key);
    else draft.stage(key, { wire: { type: "appointment", key, id: row.id, fee: cents } });
  }

  return (
    <div className={`flex flex-col gap-8 ${retiring ? "opacity-50" : ""}`}>
      {pending ? <PendingRow pending={pending} onDrop={() => draft.unstage(key)} /> : null}

      <MoneyBox label={t("pricesFee")} value={shown} disabled={retiring} onChange={change} onBlur={() => setTyping(undefined)} />

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          {!row.coded ? (
            <RetireButton
              name={row.name}
              onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id, kind: "appointment-type" } })}
            />
          ) : null}
          {row.undoable && !pending ? <UndoLink kind="appointment" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}
