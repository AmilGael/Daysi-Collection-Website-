"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { centsFromInput } from "@/lib/money";
import type { PriceChange, UndoKind } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { RetireButton, RetiredGroup } from "./office/retired-group";
import { NewAlterationSheet, NewSessionSheet } from "./office/service-sheet";
import { Sheet } from "./office/sheet";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";

/** Which list a retire or restore on this tab names. */
type RetireKind = "price-entry" | "alteration" | "appointment-type";

export type ManagedEntry = {
  readonly id: string;
  readonly garment: string;
  readonly fabric: string;
  readonly fixedPrice: number;
  readonly customizationExtra: number;
  /** Garments on this entry that carry their own price instead of it. */
  readonly ownPriced: number;
  readonly retired: boolean;
  readonly undoable: boolean;
};
/** `coded` ones shipped with the site and can only be repriced; the rest she added. */
export type ManagedAlteration = { readonly id: string; readonly name: string; readonly fixedPrice: number; readonly rushSurcharge: number; readonly coded: boolean; readonly undoable: boolean };
export type ManagedAppointment = { readonly id: string; readonly name: string; readonly fee: number; readonly coded: boolean; readonly undoable: boolean };
export type RetiredService = { readonly id: string; readonly name: string };

export function PriceManager({ entries, retiredEntries, alterations, retiredAlterations, appointments, retiredAppointments }: {
  entries: readonly ManagedEntry[];
  retiredEntries: readonly ManagedEntry[];
  alterations: readonly ManagedAlteration[];
  retiredAlterations: readonly RetiredService[];
  appointments: readonly ManagedAppointment[];
  retiredAppointments: readonly RetiredService[];
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const [adding, setAdding] = useState<"alteration" | "session" | null>(null);
  const close = useCallback(() => setAdding(null), []);

  // Added but not yet confirmed: shown in their table until Confirmar.
  const pendingAlterations: PendingAdd[] = [];
  const pendingSessions: PendingAdd[] = [];
  for (const entry of draft.entries) {
    const wire = entry.change.wire;
    if (wire.type === "alteration-add") pendingAlterations.push({ key: entry.key, label: wire.name, amounts: [wire.fixedPrice, wire.rushSurcharge] });
    if (wire.type === "appointment-add") pendingSessions.push({ key: entry.key, label: wire.name, amounts: [wire.fee] });
  }

  // One Retirados for the tab, each row keyed by the change that restores it.
  const restores = new Map<string, { readonly name: string; readonly wire: PriceChange }>();
  const restorable = (prefix: string, kind: RetireKind, id: string, name: string) => {
    const key = `${prefix}:${id}`;
    restores.set(key, { name, wire: { type: "restore", key, id, kind } });
  };
  for (const entry of retiredEntries) restorable("entry", "price-entry", entry.id, `${entry.garment} · ${entry.fabric}`);
  for (const alteration of retiredAlterations) restorable("alteration", "alteration", alteration.id, alteration.name);
  for (const appointment of retiredAppointments) restorable("appointment", "appointment-type", appointment.id, appointment.name);

  return <div className="flex flex-col gap-10">
    <PriceTable
      caption={t("pricesGarments")}
      columns={[t("pricesPrice"), t("pricesExtra")]}
      rows={entries.map((entry) => ({
        id: entry.id,
        label: entry.garment,
        sublabel: entry.fabric,
        ...(entry.ownPriced > 0 ? { note: t("entryOwnPriced", { count: entry.ownPriced }) } : {}),
        amounts: [entry.fixedPrice, entry.customizationExtra],
        retirable: true,
        undoable: entry.undoable,
      }))}
      undoKind="price-entry"
      retireKind="price-entry"
      toChange={(id, amounts) => ({ type: "entry", key: `entry:${id}`, id, fixedPrice: amounts[0] ?? 0, customizationExtra: amounts[1] ?? 0 })}
    />
    <PriceTable
      caption={t("pricesAlterations")}
      columns={[t("pricesPrice"), t("pricesRush")]}
      rows={alterations.map((alteration) => ({ id: alteration.id, label: alteration.name, sublabel: "", amounts: [alteration.fixedPrice, alteration.rushSurcharge], retirable: !alteration.coded, undoable: alteration.undoable }))}
      undoKind="alteration"
      retireKind="alteration"
      toChange={(id, amounts) => ({ type: "alteration", key: `alteration:${id}`, id, fixedPrice: amounts[0] ?? 0, rushSurcharge: amounts[1] ?? 0 })}
      pendingAdds={pendingAlterations}
      addLabel={t("pricesAddAlteration")}
      onAdd={() => setAdding("alteration")}
    />
    <PriceTable
      caption={t("pricesSessions")}
      columns={[t("pricesFee")]}
      rows={appointments.map((appointment) => ({ id: appointment.id, label: appointment.name, sublabel: "", amounts: [appointment.fee], retirable: !appointment.coded, undoable: appointment.undoable }))}
      undoKind="appointment"
      retireKind="appointment-type"
      toChange={(id, amounts) => ({ type: "appointment", key: `appointment:${id}`, id, fee: amounts[0] ?? 0 })}
      pendingAdds={pendingSessions}
      addLabel={t("pricesAddSession")}
      onAdd={() => setAdding("session")}
    />
    <RetiredGroup
      items={[...restores].map(([key, { name }]) => ({ id: key, name }))}
      restoreKey={(key) => key}
      onRestore={(key) => {
        const restore = restores.get(key);
        if (restore) draft.stage(key, { wire: restore.wire });
      }}
    />
    <Sheet open={adding !== null} title={adding === "session" ? t("newSessionTitle") : t("newAlterationTitle")} onClose={close}>
      {adding === "alteration" ? <NewAlterationSheet onDone={close} /> : adding === "session" ? <NewSessionSheet onDone={close} /> : null}
    </Sheet>
  </div>;
}

type Row = {
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
  /** Shown after the sublabel; not part of the row's name. */
  readonly note?: string;
  readonly amounts: readonly number[];
  readonly retirable: boolean;
  readonly undoable: boolean;
};

/** Something added in this draft, not on the list until she confirms. */
type PendingAdd = { readonly key: string; readonly label: string; readonly amounts: readonly number[] };

function amountsFrom(change: PriceChange, row: Row): readonly number[] {
  switch (change.type) {
    case "entry": return [change.fixedPrice, change.customizationExtra];
    case "alteration": return [change.fixedPrice, change.rushSurcharge];
    case "appointment": return [change.fee];
    case "alteration-add":
    case "appointment-add":
    case "retire":
    case "restore": return row.amounts;
  }
}

function displayAmounts(amounts: readonly number[]): string[] {
  return amounts.map((amount) => (amount / 100).toFixed(2));
}

function PriceTable({ caption, columns, rows, toChange, undoKind, retireKind, pendingAdds = [], addLabel, onAdd }: {
  caption: string;
  columns: readonly string[];
  rows: readonly Row[];
  toChange(id: string, cents: number[]): PriceChange;
  undoKind: UndoKind;
  retireKind: RetireKind;
  pendingAdds?: readonly PendingAdd[];
  /** With onAdd, a "+" row at the foot of the table that opens the add sheet. */
  addLabel?: string;
  onAdd?(): void;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const [typing, setTyping] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (draft.count === 0) setTyping({});
  }, [draft.count]);

  return <div className="flex flex-col gap-3">
    <h3 className="text-[0.9375rem] font-medium">{caption}</h3>
    <div className="flex flex-col border-t border-line">
      {rows.map((row) => {
        const probe = toChange(row.id, [...row.amounts]);
        const key = probe.key;
        const pending = draft.pending(key);
        const pendingAmounts = pending ? amountsFrom(pending.change.wire, row) : row.amounts;
        const shown = typing[row.id] ?? displayAmounts(pendingAmounts);
        const retiring = pending?.change.wire.type === "retire";
        return <div key={row.id} className={`flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3 ${retiring ? "opacity-50" : ""}`}>
          <div className="min-w-48 flex-1">
            <p className="text-[0.875rem]">{row.label}</p>
            {row.sublabel || row.note ? (
              <p className="text-[0.75rem] text-ink-faint">{[row.sublabel, row.note].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>
          {shown.map((value, index) => <label key={columns[index]} className="flex items-center gap-2 text-[0.75rem] text-ink-faint">
            {columns[index]}
            <span className="flex items-center border border-line bg-paper px-2 focus-within:border-ink">
              <span className="text-[0.8125rem] text-ink-faint">$</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={value}
                disabled={retiring}
                onFocus={(event) => {
                  // Deferred a frame: on iOS the tap that focused the box
                  // places the caret after focus fires, and would undo an
                  // immediate select().
                  const box = event.currentTarget;
                  requestAnimationFrame(() => box.select());
                }}
                onChange={(event) => {
                  const next = [...shown];
                  next[index] = event.target.value;
                  setTyping((current) => ({ ...current, [row.id]: next }));
                  const cents = next.map(centsFromInput);
                  if (cents.some((amount) => amount === null || amount > 500_000)) return;
                  // The guard above returned on any null; the ?? 0 only satisfies the type.
                  const amounts = cents.map((amount) => amount ?? 0);
                  if (amounts.every((amount, amountIndex) => amount === row.amounts[amountIndex])) draft.unstage(key);
                  else draft.stage(key, { wire: toChange(row.id, amounts) });
                }}
                onBlur={() => setTyping((current) => {
                  const { [row.id]: _removed, ...rest } = current;
                  return rest;
                })}
                className="min-h-11 w-24 bg-transparent py-1.5 pl-1 text-right text-[0.875rem] tabular-nums"
              />
            </span>
          </label>)}
          <div className="flex min-w-24 items-center justify-end gap-3">
            {pending ? (
              <>
                <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                  {t("removePending")}
                </button>
              </>
            ) : (
              <>
                {row.retirable ? (
                  <RetireButton
                    name={[row.label, row.sublabel].filter(Boolean).join(" · ")}
                    onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id, kind: retireKind } })}
                  />
                ) : null}
                {row.undoable ? <UndoLink kind={undoKind} id={row.id} /> : null}
              </>
            )}
          </div>
        </div>;
      })}
      {pendingAdds.map((add) => {
        const pending = draft.pending(add.key);
        return <div key={add.key} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3">
          <p className="min-w-48 flex-1 text-[0.875rem]">{add.label}</p>
          {displayAmounts(add.amounts).map((value, index) => <span key={columns[index]} className="flex items-center gap-2 text-[0.75rem] text-ink-faint">
            {columns[index]}
            <span className="w-24 text-right text-[0.875rem] tabular-nums text-ink">${value}</span>
          </span>)}
          <div className="flex min-w-24 items-center justify-end gap-3">
            <Pending confirming={pending?.confirming} error={pending?.error} count={pending?.count} />
            <button type="button" onClick={() => draft.unstage(add.key)} className="text-xs underline underline-offset-4">
              {t("removePending")}
            </button>
          </div>
        </div>;
      })}
      {onAdd && addLabel ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-12 items-center gap-3 border-b border-dashed border-line-strong py-3 text-left text-[0.875rem] text-ink-soft hover:text-ink"
        >
          <span aria-hidden className="text-xl leading-none">+</span>
          {addLabel}
        </button>
      ) : null}
    </div>
  </div>;
}
