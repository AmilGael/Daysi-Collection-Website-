"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { MEASUREMENTS } from "@/content/measurements";
import type { Locale } from "@/i18n/routing";
import type { ClientChange } from "@/lib/office-validation";
import {
  archiveKey,
  cardKey,
  filterRows,
  newClientKey,
  sheetMetaOf,
  shortDate,
  type OfficeBookRow,
  type SheetMeta,
} from "./office/client-draft";
import { ClientSheet } from "./office/client-sheet";
import { Pending } from "./office/confirm-bar";
import { RetiredGroup } from "./office/retired-group";
import { SearchField } from "./office/search-field";
import { Sheet } from "./office/sheet";
import { useOfficeDraft } from "./office/use-office-draft";

/**
 * Clientes: the book as one list, newest visit first, with a search that
 * folds accents away and reads a phone by its digits. One row per client,
 * one tap target per row: the name, how to reach them and when they last
 * came; how many of the measurements are on file and how many orders.
 * Tapping a row opens their sheet (`office/client-sheet.tsx`), which stages
 * into the tab's draft as she edits, like every sheet in the office.
 *
 * "Añadir cliente" opens an empty sheet; a client added that way waits at
 * the top of the list, marked pending, until Confirmar. Archived clients
 * sit under Archivados, each with Restaurar.
 */

/** A client who is only a staged change so far: the sheet treats them as a row with no card. */
function newRow(key: string, name = "", phone = ""): OfficeBookRow {
  return {
    key,
    name,
    ...(phone ? { phone } : {}),
    hasAccount: false,
    measuredCount: 0,
    orderCount: 0,
    paidTotal: 0,
    archived: false,
    orders: [],
  };
}

const isNewKey = (key: string) => key.startsWith("client:new-");

export function ClientBookView({
  rows,
  undoable,
  locale,
}: {
  rows: readonly OfficeBookRow[];
  /** Cards whose newest line is Daysi's own, with an earlier one to go back to. */
  undoable: readonly string[];
  locale: Locale;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<ClientChange>();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  // Listo asks the open sheet first: it may stay open once to mark what it is leaving out.
  const doneGuard = useRef<(() => boolean) | null>(null);
  const done = useCallback(() => {
    if (doneGuard.current && !doneGuard.current()) return;
    close();
  }, [close]);

  const active = rows.filter((row) => !row.archived);
  const archived = rows.filter((row) => row.archived && row.cardId);
  const shown = filterRows(active, query);
  const shownArchived = filterRows(archived, query);
  const found = shown.length + shownArchived.length;

  // A sheet on a row with no card stages under its own client:new-… key, so
  // each staged change says which row it came from.
  const stagedByRow = new Map<string, { key: string; meta: SheetMeta }>();
  for (const entry of draft.entries) {
    const meta = sheetMetaOf(entry.change.meta);
    if (meta) stagedByRow.set(meta.rowKey, { key: entry.key, meta });
  }
  const pendingNew = [...stagedByRow.entries()]
    .filter(([rowKey]) => isNewKey(rowKey))
    .map(([rowKey, staged]) => ({
      row: newRow(rowKey, staged.meta.form.name.trim(), staged.meta.form.phone.trim()),
      key: staged.key,
    }));

  const openedRow = useMemo(() => {
    if (open === null) return undefined;
    return rows.find((row) => row.key === open) ?? (isNewKey(open) ? newRow(open) : undefined);
  }, [open, rows]);

  // A row with no card becomes a new one once confirmed, under the card's
  // own key: its old sheet has nothing left to show.
  useEffect(() => {
    if (open !== null && !openedRow) close();
  }, [open, openedRow, close]);

  function entryFor(row: OfficeBookRow) {
    if (row.cardId) return draft.pending(cardKey(row.cardId)) ?? draft.pending(archiveKey(row.cardId));
    const staged = stagedByRow.get(row.key);
    return staged ? draft.pending(staged.key) : undefined;
  }

  const status = query.trim() ? (found === 0 ? t("clientsNoMatch") : t("clientsFound", { count: found })) : "";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t("clientsSearch")}
          label={t("clientsSearchLabel")}
          clearLabel={t("clientsSearchClear")}
          status={status}
        />
        <button
          type="button"
          onClick={() => setOpen(newClientKey())}
          className="flex min-h-14 w-full items-center justify-center gap-3 border border-dashed border-line-strong px-5 py-3 text-center text-[0.8125rem] text-ink-soft transition-colors hover:border-ink hover:text-ink sm:min-h-24 sm:flex-col sm:gap-2"
        >
          <span className="text-xl leading-none sm:text-2xl">+</span>
          {t("clientAdd")}
        </button>
      </div>

      {rows.length === 0 && pendingNew.length === 0 ? (
        <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
          {t("clientsNone")}
        </p>
      ) : shown.length > 0 || pendingNew.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {pendingNew.map(({ row, key }) => (
            <ClientRow key={key} row={row} entry={draft.pending(key)} locale={locale} onOpen={() => setOpen(row.key)} />
          ))}
          {shown.map((row) => (
            <ClientRow
              key={row.key}
              row={row}
              entry={entryFor(row)}
              archiving={row.cardId ? draft.pending(archiveKey(row.cardId)) !== undefined : false}
              locale={locale}
              onOpen={() => setOpen(row.key)}
            />
          ))}
        </ul>
      ) : null}

      {shownArchived.length > 0 ? (
        <RetiredGroup
          label={t("clientArchived", { count: shownArchived.length })}
          restoreLabel={t("clientRestore")}
          items={shownArchived.map((row) => ({ id: row.cardId!, name: row.name }))}
          restoreKey={archiveKey}
          onRestore={(id) => {
            const key = archiveKey(id);
            draft.stage(key, { wire: { type: "client-archive", key, id, archived: false } });
          }}
        />
      ) : null}

      <Sheet
        open={openedRow !== undefined}
        title={openedRow?.name || (open !== null ? stagedByRow.get(open)?.meta.form.name.trim() : "") || t("clientAdd")}
        onClose={close}
        onDone={done}
        // Only Añadir cliente starts in the Name box: a client already in
        // the book is opened to be read, and a focused box would raise the
        // phone's keyboard over half the sheet.
        focusContent={openedRow !== undefined && isNewKey(openedRow.key)}
      >
        {openedRow ? (
          <ClientSheet
            // A confirmed save is a new card line: start again from what is on file now.
            key={`${openedRow.key}:${openedRow.card?.updatedAt ?? ""}`}
            row={openedRow}
            staged={
              openedRow.cardId
                ? sheetMetaOf(draft.pending(cardKey(openedRow.cardId))?.change.meta)
                : stagedByRow.get(openedRow.key)?.meta
            }
            undoable={openedRow.cardId !== undefined && undoable.includes(openedRow.cardId)}
            locale={locale}
            onClose={close}
            doneGuard={doneGuard}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

function ClientRow({
  row,
  entry,
  archiving = false,
  locale,
  onOpen,
}: {
  row: OfficeBookRow;
  entry?: { readonly confirming: boolean; readonly error?: string; readonly count?: number };
  archiving?: boolean;
  locale: Locale;
  onOpen(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const reach = row.phone ?? row.email;
  const secondary = [reach, row.lastVisit ? t("clientLastVisit", { date: shortDate(row.lastVisit, locale) }) : null]
    .filter(Boolean)
    .join(" · ");
  const total = MEASUREMENTS.length;
  const full = row.measuredCount === total;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-4 px-2 py-3 text-left transition-colors hover:bg-paper-warm/60 ${archiving ? "opacity-50" : ""}`}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[1rem] text-ink">{row.name}</span>
          {secondary ? <span className="truncate text-[0.8125rem] text-ink-faint">{secondary}</span> : null}
          {entry ? <Pending confirming={entry.confirming} error={entry.error} count={entry.count} /> : null}
        </span>
        <span className="flex flex-col items-end gap-1.5">
          <span
            className={`border px-2 py-0.5 text-[0.75rem] tabular-nums ${full ? "border-ink text-ink" : "border-line text-ink-faint"}`}
          >
            <span aria-hidden="true">
              {row.measuredCount}/{total}
            </span>
            <span className="sr-only">{t("clientMeasuredBadge", { count: row.measuredCount, total })}</span>
          </span>
          <span className="text-[0.75rem] tabular-nums text-ink-faint">{t("clientOrders", { count: row.orderCount })}</span>
        </span>
      </button>
    </li>
  );
}
