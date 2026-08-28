"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonClass } from "./ui";

export type ManagedEntry = {
  readonly id: string;
  readonly garment: string;
  readonly fabric: string;
  readonly fixedPrice: number;
  readonly customizationExtra: number;
};

export type ManagedAlteration = {
  readonly id: string;
  readonly name: string;
  readonly fixedPrice: number;
  readonly rushSurcharge: number;
};

export type ManagedAppointment = {
  readonly id: string;
  readonly name: string;
  readonly fee: number;
};

/**
 * The price list with the numbers editable. Each row saves on its own — the
 * moment a save lands, the public price pages, the estimate builder and the
 * checkout all quote the new figure, because they all read the same live list.
 */
export function PriceManager({
  entries,
  alterations,
  appointments,
}: {
  entries: readonly ManagedEntry[];
  alterations: readonly ManagedAlteration[];
  appointments: readonly ManagedAppointment[];
}) {
  const t = useTranslations("office");

  return (
    <div className="flex flex-col gap-10">
      <PriceTable
        caption={t("pricesGarments")}
        columns={[t("pricesPrice"), t("pricesExtra")]}
        rows={entries.map((entry) => ({
          id: entry.id,
          label: entry.garment,
          sublabel: entry.fabric,
          amounts: [entry.fixedPrice, entry.customizationExtra],
        }))}
        toBody={(id, amounts) => ({
          kind: "entry",
          id,
          fixedPrice: amounts[0],
          customizationExtra: amounts[1],
        })}
      />
      <PriceTable
        caption={t("pricesAlterations")}
        columns={[t("pricesPrice"), t("pricesRush")]}
        rows={alterations.map((alteration) => ({
          id: alteration.id,
          label: alteration.name,
          sublabel: "",
          amounts: [alteration.fixedPrice, alteration.rushSurcharge],
        }))}
        toBody={(id, amounts) => ({
          kind: "alteration",
          id,
          fixedPrice: amounts[0],
          rushSurcharge: amounts[1],
        })}
      />
      <PriceTable
        caption={t("pricesSessions")}
        columns={[t("pricesFee")]}
        rows={appointments.map((appointment) => ({
          id: appointment.id,
          label: appointment.name,
          sublabel: "",
          amounts: [appointment.fee],
        }))}
        toBody={(id, amounts) => ({ kind: "appointment", id, fee: amounts[0] })}
      />
    </div>
  );
}

type Row = {
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
  readonly amounts: readonly number[];
};

function PriceTable({
  caption,
  columns,
  rows,
  toBody,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly Row[];
  toBody: (id: string, amounts: number[]) => Record<string, unknown>;
}) {
  const t = useTranslations("office");
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [state, setState] = useState<Record<string, "saving" | "saved" | "failed">>({});

  const draftFor = (row: Row): string[] =>
    drafts[row.id] ?? row.amounts.map((amount) => (amount / 100).toFixed(2));

  const isDirty = (row: Row): boolean =>
    draftFor(row).some(
      (value, index) => Math.round(parseFloat(value || "0") * 100) !== row.amounts[index],
    );

  async function save(row: Row) {
    const cents = draftFor(row).map((value) => Math.round(parseFloat(value || "0") * 100));
    if (cents.some((value) => !Number.isFinite(value) || value < 0)) return;
    setState((current) => ({ ...current, [row.id]: "saving" }));
    try {
      const response = await fetch("/api/office/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(row.id, cents)),
      });
      if (!response.ok) throw new Error("save-failed");
      setState((current) => ({ ...current, [row.id]: "saved" }));
      router.refresh();
    } catch {
      setState((current) => ({ ...current, [row.id]: "failed" }));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[0.9375rem] font-medium">{caption}</h3>
      <div className="flex flex-col border-t border-line">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3"
          >
            <div className="min-w-48 flex-1">
              <p className="text-[0.875rem]">{row.label}</p>
              {row.sublabel ? (
                <p className="text-[0.75rem] text-ink-faint">{row.sublabel}</p>
              ) : null}
            </div>
            {draftFor(row).map((value, index) => (
              <label key={columns[index]} className="flex items-center gap-2 text-[0.75rem] text-ink-faint">
                {columns[index]}
                <span className="flex items-center border border-line bg-paper px-2">
                  <span className="text-[0.8125rem] text-ink-faint">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={value}
                    onChange={(event) => {
                      const next = [...draftFor(row)];
                      next[index] = event.target.value;
                      setDrafts((current) => ({ ...current, [row.id]: next }));
                      setState((current) => {
                        const { [row.id]: _dropped, ...rest } = current;
                        return rest;
                      });
                    }}
                    className="w-24 bg-transparent py-1.5 pl-1 text-right text-[0.875rem] tabular-nums focus:outline-none"
                  />
                </span>
              </label>
            ))}
            <div className="flex w-24 items-center justify-end">
              {isDirty(row) ? (
                <button
                  type="button"
                  onClick={() => save(row)}
                  disabled={state[row.id] === "saving"}
                  className={buttonClass({ size: "small", tone: "solid" })}
                >
                  {state[row.id] === "saving" ? t("saving") : t("savePrice")}
                </button>
              ) : state[row.id] === "saved" ? (
                <span className="text-[0.75rem] text-marigold-deep">{t("saved")}</span>
              ) : state[row.id] === "failed" ? (
                <span className="text-[0.75rem] text-ink">{t("updateFailed")}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
