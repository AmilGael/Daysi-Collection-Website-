"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Estimate } from "@/lib/pricing";

/**
 * Form primitives. Every input on the site is one of these, so the label,
 * description, error text and focus ring behave identically everywhere and each
 * one is wired to its field for a screen reader without being re-thought.
 */

const controlClass =
  "w-full rounded-[2px] border border-line bg-paper px-4 py-3 text-[0.9375rem] text-ink transition-colors placeholder:text-ink-faint/60 focus:border-ink focus:outline-none";

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}) {
  const t = useTranslations();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink">
        {label}
        {optional ? (
          <span className="ml-2 font-normal lowercase text-ink-faint">({t("common.optional")})</span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-marigold-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={4}
      {...props}
      className={`${controlClass} resize-y ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${controlClass} appearance-none pr-10 ${props.className ?? ""}`} />
  );
}

/** A row of pill options. Used for size, contact method and request kind. */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = false,
}: {
  legend: string;
  options: readonly { value: T; label: string; description?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[0.8125rem] font-medium text-ink">{legend}</legend>
      <div className={columns ? "grid gap-3 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={`rounded-[2px] border px-4 py-3 text-left text-[0.875rem] transition-colors ${
                isSelected
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper text-ink hover:border-ink/50"
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              {option.description ? (
                <span
                  className={`mt-1 block text-[0.8125rem] leading-snug ${
                    isSelected ? "text-paper/65" : "text-ink-faint"
                  }`}
                >
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[0.875rem] leading-relaxed text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
      />
      <span>{children}</span>
    </label>
  );
}

/**
 * The two anti-spam signals, rendered together: a field kept out of the visual
 * and accessibility trees that only a script will fill in, and the time the
 * form appeared. Both are checked on the server.
 */
export function BotTrap({ renderedAt }: { renderedAt: number }) {
  return (
    <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      <input name="renderedAt" type="hidden" value={renderedAt} readOnly />
    </div>
  );
}

/** Stamped once when the form mounts, so it is stable across re-renders. */
export function useRenderedAt(): number {
  return useMemo(() => Date.now(), []);
}

/** What every route handler on this site returns when it accepts a submission. */
export type SubmitResult = {
  reference: string;
  estimate?: Estimate;
  checkoutUrl?: string;
};

export type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string }
  | { status: "done"; reference: string };

/**
 * Posts a form body as JSON and normalises what comes back, so every form on
 * the site reports success, validation failure and rate limiting the same way.
 */
export function useSubmit(endpoint: string) {
  const t = useTranslations();
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(body: unknown): Promise<SubmitResult | null> {
    setState({ status: "sending" });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        setState({ status: "error", message: t("errors.rateLimited") });
        return null;
      }
      if (!response.ok) {
        setState({ status: "error", message: t("errors.badRequest") });
        return null;
      }

      const result = (await response.json()) as SubmitResult;
      setState({ status: "done", reference: result.reference });
      return result;
    } catch {
      setState({ status: "error", message: t("common.somethingWentWrong") });
      return null;
    }
  }

  return { state, submit, reset: () => setState({ status: "idle" }) };
}

export function SubmitButton({
  state,
  children,
  disabled,
}: {
  state: SubmitState;
  children: ReactNode;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const isSending = state.status === "sending";

  return (
    <button
      type="submit"
      disabled={isSending || disabled}
      className="inline-flex items-center justify-center gap-2 rounded-[2px] bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-all duration-300 hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-45"
    >
      {isSending ? t("sending") : children}
    </button>
  );
}

export function FormError({ state }: { state: SubmitState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-[2px] bg-paper-warm px-4 py-3 text-[0.875rem] text-ink">
      {state.message}
    </p>
  );
}
