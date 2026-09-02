"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PriceChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { RetireButton, RetiredGroup } from "./office/retired-group";
import { useOfficeDraft } from "./office/use-office-draft";

export type ManagedEntry = { readonly id: string; readonly garment: string; readonly fabric: string; readonly fixedPrice: number; readonly customizationExtra: number; readonly retired: boolean };
export type ManagedAlteration = { readonly id: string; readonly name: string; readonly fixedPrice: number; readonly rushSurcharge: number };
export type ManagedAppointment = { readonly id: string; readonly name: string; readonly fee: number };

export function PriceManager({ entries, retiredEntries, alterations, appointments }: {
  entries: readonly ManagedEntry[];
  retiredEntries: readonly ManagedEntry[];
  alterations: readonly ManagedAlteration[];
  appointments: readonly ManagedAppointment[];
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  return <div className="flex flex-col gap-10">
    <PriceTable
      caption={t("pricesGarments")}
      columns={[t("pricesPrice"), t("pricesExtra")]}
      rows={entries.map((entry) => ({ id: entry.id, label: entry.garment, sublabel: entry.fabric, amounts: [entry.fixedPrice, entry.customizationExtra] }))}
      toChange={(id, amounts) => ({ type: "entry", key: `entry:${id}`, id, fixedPrice: amounts[0] ?? 0, customizationExtra: amounts[1] ?? 0 })}
      retire={{ kind: "price-entry" }}
    />
    <PriceTable
      caption={t("pricesAlterations")}
      columns={[t("pricesPrice"), t("pricesRush")]}
      rows={alterations.map((alteration) => ({ id: alteration.id, label: alteration.name, sublabel: "", amounts: [alteration.fixedPrice, alteration.rushSurcharge] }))}
      toChange={(id, amounts) => ({ type: "alteration", key: `alteration:${id}`, id, fixedPrice: amounts[0] ?? 0, rushSurcharge: amounts[1] ?? 0 })}
    />
    <PriceTable
      caption={t("pricesSessions")}
      columns={[t("pricesFee")]}
      rows={appointments.map((appointment) => ({ id: appointment.id, label: appointment.name, sublabel: "", amounts: [appointment.fee] }))}
      toChange={(id, amounts) => ({ type: "appointment", key: `appointment:${id}`, id, fee: amounts[0] ?? 0 })}
    />
    <RetiredGroup
      items={retiredEntries.map((entry) => ({ id: entry.id, name: `${entry.garment} · ${entry.fabric}` }))}
      restoreKey={(id) => `entry:${id}`}
      onRestore={(id) => {
        const key = `entry:${id}`;
        draft.stage(key, { wire: { type: "restore", key, id } });
      }}
    />
  </div>;
}

type Row = { readonly id: string; readonly label: string; readonly sublabel: string; readonly amounts: readonly number[] };

function amountsFrom(change: PriceChange, row: Row): readonly number[] {
  switch (change.type) {
    case "entry": return [change.fixedPrice, change.customizationExtra];
    case "alteration": return [change.fixedPrice, change.rushSurcharge];
    case "appointment": return [change.fee];
    case "retire":
    case "restore": return row.amounts;
  }
}

function displayAmounts(amounts: readonly number[]): string[] {
  return amounts.map((amount) => (amount / 100).toFixed(2));
}

function PriceTable({ caption, columns, rows, toChange, retire }: {
  caption: string;
  columns: readonly string[];
  rows: readonly Row[];
  toChange(id: string, cents: number[]): PriceChange;
  retire?: { kind: "price-entry" };
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
            {row.sublabel ? <p className="text-[0.75rem] text-ink-faint">{row.sublabel}</p> : null}
          </div>
          {shown.map((value, index) => <label key={columns[index]} className="flex items-center gap-2 text-[0.75rem] text-ink-faint">
            {columns[index]}
            <span className="flex items-center border border-line bg-paper px-2 focus-within:border-ink">
              <span className="text-[0.8125rem] text-ink-faint">$</span>
              <input
                type="number" min="0" max="5000" step="0.01" value={value}
                disabled={retiring}
                onChange={(event) => {
                  const next = [...shown];
                  next[index] = event.target.value;
                  setTyping((current) => ({ ...current, [row.id]: next }));
                  const cents = next.map((amount) => Math.round(parseFloat(amount) * 100));
                  if (cents.some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 500_000)) return;
                  if (cents.every((amount, amountIndex) => amount === row.amounts[amountIndex])) draft.unstage(key);
                  else draft.stage(key, { wire: toChange(row.id, cents) });
                }}
                onBlur={() => setTyping((current) => {
                  const { [row.id]: _removed, ...rest } = current;
                  return rest;
                })}
                className="w-24 bg-transparent py-1.5 pl-1 text-right text-[0.875rem] tabular-nums"
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
            ) : retire ? (
              <RetireButton
                name={`${row.label} · ${row.sublabel}`}
                onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })}
              />
            ) : null}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
