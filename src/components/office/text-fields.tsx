"use client";

import { useState, type FocusEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import { TEXT_LIMITS, type OfficeChange } from "@/lib/office-validation";
import { Pending } from "./confirm-bar";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

type Field = {
  readonly field: "name" | "color" | "description" | "detail" | "caption";
  readonly label: string;
  readonly es: string;
  readonly en: string;
  readonly codedEs: string;
  readonly codedEn: string;
  readonly multiline?: boolean;
};

/**
 * The words of one row, in both languages.
 *
 * Every box is pre-filled with what the site shows now, and only a box she
 * actually changes is staged, so correcting the Spanish leaves a good English
 * translation alone. Clearing a box stages the empty value, which the merge
 * reads as a return to the coded words.
 */
export function TextFields({
  subject,
  id,
  fields,
  undoable,
}: {
  subject: "style" | "gallery";
  id: string;
  fields: readonly Field[];
  undoable: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<OfficeChange>();
  const [open, setOpen] = useState(false);
  const textPrefix = `text:${subject}:${id}:`;
  const stagedTexts = draft.entries.filter((entry) => entry.key.startsWith(textPrefix));
  const stagedStatuses = stagedTexts
    .map((entry) => draft.pending(entry.key))
    .filter((entry) => entry !== undefined);
  const stagedError = stagedStatuses.find((entry) => entry.error)?.error;

  return (
    <div className="mt-2">
      <span className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs underline underline-offset-4"
          aria-expanded={open}
        >
          {open ? t("textsHide") : t("textsEdit")}
        </button>
        {stagedTexts.length > 0 ? (
          <Pending
            confirming={stagedStatuses.some((entry) => entry.confirming)}
            error={stagedError}
            label={t("textsStaged", { count: stagedTexts.length })}
          />
        ) : null}
      </span>
      {open ? (
        <div className="mt-3 grid gap-3">
          {fields.map((entry) => (
            <fieldset key={entry.field} className="grid gap-2 sm:grid-cols-2">
              <legend className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
                {entry.label}
              </legend>
              {(["es", "en"] as const).map((locale) => {
                const key = `text:${subject}:${id}:${entry.field}:${locale}`;
                const pending = draft.pending(key);
                const staged = pending?.change.wire;
                const current = staged && "value" in staged
                  ? staged.value
                  : locale === "es" ? entry.es : entry.en;
                const common = {
                  defaultValue: current,
                  maxLength: TEXT_LIMITS[entry.field],
                  "aria-label": `${entry.label}, ${locale === "es" ? t("textsSpanish") : t("textsEnglish")}`,
                  className: "w-full border border-line bg-paper px-3 py-2 text-[0.875rem] text-ink focus:border-ink",
                  onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    const value = event.target.value.trim();
                    const merged = locale === "es" ? entry.es : entry.en;
                    const coded = locale === "es" ? entry.codedEs : entry.codedEn;
                    if (value === merged || (value === "" && merged === coded)) {
                      draft.unstage(key);
                      return;
                    }
                    draft.stage(key, {
                      wire: {
                        type: subject === "style" ? "style-text" : "work-text",
                        key,
                        id,
                        field: entry.field,
                        locale,
                        value,
                      } as OfficeChange,
                    });
                  },
                };
                return (
                  <label key={locale} className="grid gap-1 text-[0.8125rem] text-ink-faint">
                    <span className="flex items-center gap-2">
                      {locale === "es" ? t("textsSpanish") : t("textsEnglish")}
                      {pending ? (
                        <Pending
                          confirming={pending.confirming}
                          error={pending.error}
                          count={pending.count}
                        />
                      ) : null}
                    </span>
                    {entry.multiline ? (
                      <textarea key={`${key}:${current}`} rows={3} {...common} />
                    ) : (
                      <input key={`${key}:${current}`} type="text" {...common} />
                    )}
                    {pending ? (
                      <button
                        type="button"
                        onClick={() => draft.unstage(key)}
                        className="w-fit text-xs underline underline-offset-4"
                      >
                        {t("textsUndoBox")}
                      </button>
                    ) : null}
                    {undoable.has(`${id}:${entry.field}:${locale}`) && !pending ? (
                      <UndoLink
                        kind={subject === "style" ? "style-text" : "work-text"}
                        id={`${id}:${entry.field}:${locale}`}
                      />
                    ) : null}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      ) : null}
    </div>
  );
}
