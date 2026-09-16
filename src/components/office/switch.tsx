"use client";

import type { JSX } from "react";

/** One on/off switch with its label, the size of a thumb. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-[0.9375rem]">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          checked ? "bg-ink" : "bg-paper-deep"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-1 h-5 w-5 rounded-full bg-paper transition-[left] ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  );
}
