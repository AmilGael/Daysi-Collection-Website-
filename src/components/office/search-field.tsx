"use client";

import type { JSX } from "react";

/**
 * The office's one search box: a magnifier, a 48 px box with 16 px text (a
 * phone zooms into anything smaller), its own ink clear button in place of
 * the browser's, and a label a screen reader hears but nobody sees. The
 * manual's search is drawn the same way.
 *
 * It holds no state and knows no language: the caller owns what was typed
 * and passes every word, so a Spanish-only page and a bilingual one can
 * both use it. `status`, when given, is read out politely as the results
 * change ("3 clientes").
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  clearLabel,
  status,
}: {
  value: string;
  onChange(value: string): void;
  placeholder: string;
  label: string;
  clearLabel: string;
  status?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-ink-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8.5" cy="8.5" r="5.75" />
          <path d="m13 13 4.25 4.25" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full appearance-none border border-line bg-paper pl-11 pr-12 text-[1rem] text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={clearLabel}
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-soft hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </label>
      {status !== undefined ? (
        <p aria-live="polite" className="min-h-[1.25rem] text-[0.8125rem] text-ink-faint">
          {status}
        </p>
      ) : null}
    </div>
  );
}
