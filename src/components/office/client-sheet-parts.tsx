"use client";

import { useId, type InputHTMLAttributes, type JSX, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Unit } from "@/lib/measurements";
import { Pending } from "./confirm-bar";

/**
 * The pieces a client's sheet is drawn from (`client-sheet.tsx`): a section
 * under a Fraunces heading, a labelled box, a quiet text button, the pending
 * line, and one measurement's row. Presentational only: every one of them
 * is told what to show and says what was done.
 */

export const field =
  "min-h-12 w-full border border-line-strong bg-paper px-3 py-2 text-[1rem] text-ink placeholder:text-ink-faint focus:border-ink";

export function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }): JSX.Element {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 py-6 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={id} className="font-display text-[1.1875rem] leading-tight text-ink">
          {title}
        </h3>
        {aside ? <span className="text-[0.8125rem] text-ink-faint">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function TextField({
  label,
  error,
  invalid = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Marked without a line of its own: the address's one problem is said under all of its boxes. */
  invalid?: boolean;
}): JSX.Element {
  const marked = invalid || error !== undefined;
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] text-ink-faint">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={marked ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={marked ? field.replace("border-line-strong", "border-alert") : field}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function QuietButton({ onClick, children }: { onClick(): void; children: ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 w-fit items-center text-[0.8125rem] font-medium text-ink"
    >
      <span className="link-underline">{children}</span>
    </button>
  );
}

export function PendingLine({
  entry,
  label,
  onDrop,
}: {
  entry: { readonly confirming: boolean; readonly error?: string; readonly count?: number };
  label?: string;
  onDrop(): void;
}): JSX.Element {
  const t = useTranslations("office");
  return (
    <span className="flex flex-wrap items-center gap-3">
      <Pending confirming={entry.confirming} error={entry.error} count={entry.count} label={label} />
      <button type="button" onClick={onDrop} className="text-xs underline underline-offset-4">
        {t("dropChanges")}
      </button>
    </span>
  );
}

/**
 * One measurement: its name, what is on file and whose it is, a box for a
 * new reading in the unit on show, and Quitar for one on file. A removed
 * one is struck through until Confirmar, with Dejarla to keep it after all.
 */
export function MeasureRow({
  label,
  unit,
  unitName,
  onFile,
  text,
  removed,
  removable,
  problem,
  invalid,
  onType,
  onBlur,
  onRemove,
}: {
  label: string;
  unit: Unit;
  unitName: string;
  onFile: string;
  text: string;
  removed: boolean;
  removable: boolean;
  /** What to say when the number is marked; always given, so its line is measured whether shown or not. */
  problem: string;
  invalid: boolean;
  onType(text: string): void;
  onBlur(): void;
  onRemove(gone: boolean): void;
}): JSX.Element {
  const t = useTranslations("office");
  const id = useId();
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3">
      <label htmlFor={id} className="text-[1rem] text-ink">
        {label}
        <span className="sr-only">, {unitName}</span>
      </label>
      <span
        className={`flex w-[7.5rem] items-center border bg-paper transition-colors focus-within:border-ink ${
          invalid ? "border-alert" : "border-line-strong"
        } ${removed ? "opacity-40" : ""}`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={removed}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => onType(event.target.value)}
          onBlur={onBlur}
          className="min-h-12 w-full min-w-0 bg-transparent py-2 pl-3 text-right text-[1rem] tabular-nums text-ink placeholder:text-ink-faint"
        />
        <span aria-hidden className="shrink-0 pl-2 pr-3 text-[0.875rem] text-ink-faint">
          {unit}
        </span>
      </span>
      {/* The line on file and the problem share one cell, the hidden one
          still taking its room, so marking a number never moves the list. */}
      <span className="grid text-[0.8125rem]">
        <span className={`col-start-1 row-start-1 tabular-nums text-ink-faint ${invalid ? "invisible" : ""}`}>
          {removed ? (
            <>
              <s>{onFile}</s> · {t("clientRemoving")}
            </>
          ) : (
            onFile
          )}
        </span>
        <span id={`${id}-error`} className={`col-start-1 row-start-1 text-alert ${invalid ? "" : "invisible"}`}>
          {problem}
        </span>
      </span>
      {removable ? (
        <button
          type="button"
          onClick={() => onRemove(!removed)}
          className="inline-flex min-h-9 items-center justify-self-end text-[0.8125rem] font-medium text-ink underline underline-offset-4"
        >
          {removed ? t("clientKeep") : t("clientRemove")}
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}
