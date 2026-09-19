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
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }): JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] text-ink-faint">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={error ? field.replace("border-line-strong", "border-alert") : field}
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
  error,
  onType,
  onRemove,
}: {
  label: string;
  unit: Unit;
  unitName: string;
  onFile: string;
  text: string;
  removed: boolean;
  removable: boolean;
  error?: string;
  onType(text: string): void;
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
          error ? "border-alert" : "border-line-strong"
        } ${removed ? "opacity-40" : ""}`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={removed}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onType(event.target.value)}
          className="min-h-12 w-full min-w-0 bg-transparent py-2 pl-3 text-right text-[1rem] tabular-nums text-ink placeholder:text-ink-faint"
        />
        <span aria-hidden className="shrink-0 pl-2 pr-3 text-[0.875rem] text-ink-faint">
          {unit}
        </span>
      </span>
      <span className="text-[0.8125rem] tabular-nums text-ink-faint">
        {removed ? (
          <>
            <s>{onFile}</s> · {t("clientRemoving")}
          </>
        ) : (
          onFile
        )}
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
      {error ? (
        <p id={`${id}-error`} className="col-span-2 text-[0.8125rem] text-alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
