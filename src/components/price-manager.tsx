"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type JSX, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import type { PriceChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import {
  alterationKey,
  appointmentKey,
  entryKey,
  type ManagedAlteration,
  type ManagedAppointment,
  type ManagedEntry,
  type PriceCategoryGroup,
  type RetiredService,
} from "./office/price-draft";
import { AlterationPriceSheet, AppointmentPriceSheet, EntryPriceSheet } from "./office/price-sheet";
import { RetiredGroup } from "./office/retired-group";
import { NewAlterationSheet, NewSessionSheet } from "./office/service-sheet";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";

/** Which list a retire or restore on this tab names. */
type RetireKind = "price-entry" | "alteration" | "appointment-type";

type OpenState =
  | { readonly kind: "entry"; readonly id: string }
  | { readonly kind: "alteration"; readonly id: string }
  | { readonly kind: "appointment"; readonly id: string }
  | "add-alteration"
  | "add-session"
  | null;

/**
 * Precios: garment prices grouped by category (a collapsible header per
 * category, its fabrics as rows below), then Arreglos and Sesiones as rows
 * of their own. Tapping a row opens its sheet — one row's values at a time,
 * which fixes the phone bug where tapping into the old table of thirty
 * inputs dropped the cursor mid-number. Retirados sits at the bottom, as
 * before.
 */
export function PriceManager({
  groups,
  retiredEntries,
  alterations,
  retiredAlterations,
  appointments,
  retiredAppointments,
  locale,
}: {
  groups: readonly PriceCategoryGroup[];
  retiredEntries: readonly ManagedEntry[];
  alterations: readonly ManagedAlteration[];
  retiredAlterations: readonly RetiredService[];
  appointments: readonly ManagedAppointment[];
  retiredAppointments: readonly RetiredService[];
  locale: Locale;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const [open, setOpen] = useState<OpenState>(null);
  const close = useCallback(() => setOpen(null), []);

  const entries = groups.flatMap((group) => group.entries);
  const openedEntry = open !== null && typeof open === "object" && open.kind === "entry" ? entries.find((row) => row.id === open.id) ?? null : null;
  const openedAlteration =
    open !== null && typeof open === "object" && open.kind === "alteration" ? alterations.find((row) => row.id === open.id) ?? null : null;
  const openedAppointment =
    open !== null && typeof open === "object" && open.kind === "appointment" ? appointments.find((row) => row.id === open.id) ?? null : null;

  useEffect(() => {
    if (open === null || open === "add-alteration" || open === "add-session") return;
    if (open.kind === "entry" && !openedEntry) close();
    else if (open.kind === "alteration" && !openedAlteration) close();
    else if (open.kind === "appointment" && !openedAppointment) close();
  }, [open, openedEntry, openedAlteration, openedAppointment, close]);

  // Added but not yet confirmed: shown in their list until Confirmar.
  const pendingAlterations: PendingAdd[] = [];
  const pendingSessions: PendingAdd[] = [];
  for (const draftEntry of draft.entries) {
    const wire = draftEntry.change.wire;
    if (wire.type === "alteration-add") {
      pendingAlterations.push({
        key: draftEntry.key,
        label: wire.name,
        lines: [`${t("pricesPrice")} ${formatMoney(wire.fixedPrice, locale)}`, `${t("pricesRush")} ${formatMoney(wire.rushSurcharge, locale)}`],
      });
    }
    if (wire.type === "appointment-add") {
      pendingSessions.push({ key: draftEntry.key, label: wire.name, lines: [`${t("pricesFee")} ${formatMoney(wire.fee, locale)}`] });
    }
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

  const title =
    open === "add-alteration"
      ? t("newAlterationTitle")
      : open === "add-session"
        ? t("newSessionTitle")
        : openedEntry
          ? `${openedEntry.garment} · ${openedEntry.fabric}`
          : openedAlteration
            ? openedAlteration.name
            : openedAppointment
              ? openedAppointment.name
              : "";

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("pricesGarments")}</h3>
        <div className="flex flex-col">
          {groups.map((group) => (
            <CategoryGroup key={group.id} label={group.label} count={group.entries.length}>
              {group.entries.map((entry) => (
                <PriceRow
                  key={entry.id}
                  swatch={entry.fabricSwatch}
                  title={entry.fabric}
                  note={entry.ownPriced > 0 ? t("entryOwnPriced", { count: entry.ownPriced }) : undefined}
                  lines={[
                    `${t("pricesPrice")} ${formatMoney(entry.fixedPrice, locale)}`,
                    `${t("pricesExtra")} ${formatMoney(entry.customizationExtra, locale)}`,
                  ]}
                  pendingKey={entryKey(entry.id)}
                  onOpen={() => setOpen({ kind: "entry", id: entry.id })}
                />
              ))}
            </CategoryGroup>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("pricesAlterations")}</h3>
        <ul className="flex flex-col border-t border-line">
          {alterations.map((alteration) => (
            <PriceRow
              key={alteration.id}
              title={alteration.name}
              lines={[
                `${t("pricesPrice")} ${formatMoney(alteration.fixedPrice, locale)}`,
                `${t("pricesRush")} ${formatMoney(alteration.rushSurcharge, locale)}`,
              ]}
              pendingKey={alterationKey(alteration.id)}
              onOpen={() => setOpen({ kind: "alteration", id: alteration.id })}
            />
          ))}
          {pendingAlterations.map((add) => (
            <PendingAddRow key={add.key} label={add.label} lines={add.lines} pendingKey={add.key} />
          ))}
          <AddRow label={t("pricesAddAlteration")} onAdd={() => setOpen("add-alteration")} />
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("pricesSessions")}</h3>
        <ul className="flex flex-col border-t border-line">
          {appointments.map((appointment) => (
            <PriceRow
              key={appointment.id}
              title={appointment.name}
              lines={[`${t("pricesFee")} ${formatMoney(appointment.fee, locale)}`]}
              pendingKey={appointmentKey(appointment.id)}
              onOpen={() => setOpen({ kind: "appointment", id: appointment.id })}
            />
          ))}
          {pendingSessions.map((add) => (
            <PendingAddRow key={add.key} label={add.label} lines={add.lines} pendingKey={add.key} />
          ))}
          <AddRow label={t("pricesAddSession")} onAdd={() => setOpen("add-session")} />
        </ul>
      </section>

      <RetiredGroup
        items={[...restores].map(([key, { name }]) => ({ id: key, name }))}
        restoreKey={(key) => key}
        onRestore={(key) => {
          const restore = restores.get(key);
          if (restore) draft.stage(key, { wire: restore.wire });
        }}
      />

      <Sheet open={open !== null} title={title} onClose={close}>
        {open === "add-alteration" ? (
          <NewAlterationSheet onDone={close} />
        ) : open === "add-session" ? (
          <NewSessionSheet onDone={close} />
        ) : openedEntry ? (
          <EntryPriceSheet row={openedEntry} />
        ) : openedAlteration ? (
          <AlterationPriceSheet row={openedAlteration} />
        ) : openedAppointment ? (
          <AppointmentPriceSheet row={openedAppointment} />
        ) : null}
      </Sheet>
    </div>
  );
}

/** Something added in this draft, not on the list until she confirms. */
type PendingAdd = { readonly key: string; readonly label: string; readonly lines: readonly string[] };

/**
 * One category's fabrics, collapsed or open on its own — "open state
 * local" — behind a button header that names the category and how many
 * fabrics are priced under it.
 */
function CategoryGroup({ label, count, children }: { label: string; count: number; children: ReactNode }): JSX.Element {
  return (
    <details className="group border-t border-line" open>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[0.9375rem] font-medium">{label}</span>
        <span className="flex items-center gap-2 text-[0.75rem] text-ink-faint">
          <span className="tabular-nums">{count}</span>
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4.5 6 8l4-3.5" />
          </svg>
        </span>
      </summary>
      <ul>{children}</ul>
    </details>
  );
}

/**
 * One garment price, one alteration or one session: a swatch when there is
 * one, its name, up to two money lines and the pending marker. Tapping it
 * opens its sheet.
 */
function PriceRow({
  swatch,
  title,
  note,
  lines,
  pendingKey,
  onOpen,
}: {
  swatch?: string;
  title: string;
  note?: string;
  lines: readonly string[];
  pendingKey: string;
  onOpen(): void;
}): JSX.Element {
  const draft = useOfficeDraft<PriceChange>();
  const pending = draft.pending(pendingKey);
  const retiring = pending?.change.wire.type === "retire";

  return (
    <li className={`flex flex-col gap-1 border-b border-line py-3 ${retiring ? "opacity-50" : ""}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        {swatch !== undefined ? (
          <span className="relative block h-12 w-12 shrink-0 overflow-hidden bg-paper-warm">
            {swatch ? <Image src={swatch} alt="" fill sizes="3rem" className="object-cover" /> : null}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.875rem]">{title}</span>
          {note ? <span className="block text-[0.75rem] text-ink-faint">{note}</span> : null}
        </span>
        <MoneyLines lines={lines} />
      </button>
      {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
    </li>
  );
}

/** A staged alteration-add or appointment-add: static until she confirms, but she can still drop it. */
function PendingAddRow({ label, lines, pendingKey }: { label: string; lines: readonly string[]; pendingKey: string }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const pending = draft.pending(pendingKey);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3">
      <p className="min-w-48 flex-1 text-[0.875rem]">{label}</p>
      <MoneyLines lines={lines} />
      <span className="flex items-center gap-3">
        {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
        <button type="button" onClick={() => draft.unstage(pendingKey)} className="text-xs underline underline-offset-4">
          {t("dropChanges")}
        </button>
      </span>
    </li>
  );
}

/** The "+" row at the foot of Arreglos or Sesiones that opens the add sheet. */
function AddRow({ label, onAdd }: { label: string; onAdd(): void }): JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onAdd}
        className="flex min-h-12 w-full items-center gap-3 border-b border-dashed border-line-strong py-3 text-left text-[0.875rem] text-ink-soft hover:text-ink"
      >
        <span aria-hidden className="text-xl leading-none">+</span>
        {label}
      </button>
    </li>
  );
}

/** Up to two money lines, right-aligned: the first the price, the second smaller. */
function MoneyLines({ lines }: { lines: readonly string[] }): JSX.Element {
  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      {lines.map((line, index) => (
        <span key={line} className={`tabular-nums ${index === 0 ? "text-[0.875rem]" : "text-[0.6875rem] text-ink-faint"}`}>
          {line}
        </span>
      ))}
    </span>
  );
}
