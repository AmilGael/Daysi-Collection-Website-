"use client";

import { useState, type FocusEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import { TEXT_LIMITS, type CollectionChange } from "@/lib/office-validation";
import { Pending } from "./confirm-bar";
import type { ManagedStyle } from "./garment-draft";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

type Field = "name" | "color" | "description" | "detail";
type LabelKey = "styleName" | "styleColor" | "styleDescription" | "styleDetail";
const FIELDS: readonly { readonly field: Field; readonly labelKey: LabelKey; readonly multiline: boolean }[] = [
  { field: "name", labelKey: "styleName", multiline: false },
  { field: "color", labelKey: "styleColor", multiline: false },
  { field: "description", labelKey: "styleDescription", multiline: true },
  { field: "detail", labelKey: "styleDetail", multiline: true },
];

const box = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink focus:border-ink";

/**
 * The words of one garment, typed in Spanish. The English is written at
 * confirm; Ver inglés shows it read-only, marks a line whose English still
 * equals its Spanish as pending with a Traducir link, and Corregir opens a
 * box for the rare English she wants to write herself. Every box stages
 * the same style-text change the old editor did, keyed per field and
 * language, so undo and history are unchanged.
 */
export function GarmentWords({
  row,
  undoable,
}: {
  row: ManagedStyle;
  undoable: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const [english, setEnglish] = useState(false);
  const [correcting, setCorrecting] = useState<readonly Field[]>([]);

  const textKey = (field: Field, locale: "es" | "en") => `text:style:${row.id}:${field}:${locale}`;
  const staged = (field: Field, locale: "es" | "en"): string | undefined => {
    const wire = draft.pending(textKey(field, locale))?.change.wire;
    return wire?.type === "style-text" ? wire.value : undefined;
  };
  const current = (field: Field, locale: "es" | "en") => staged(field, locale) ?? row.texts[field][locale];
  const pendingEnglish = FIELDS.map(({ field }) => field).filter(
    (field) => current(field, "es") !== "" && current(field, "en") === current(field, "es"),
  );
  const translateKey = `translate:style:${row.id}`;
  const translating = draft.pending(translateKey);

  function blur(field: Field, locale: "es" | "en", event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const value = event.target.value.trim();
    const merged = row.texts[field][locale];
    const coded = row.codedTexts[field][locale];
    const key = textKey(field, locale);
    if (value === merged || (value === "" && merged === coded)) {
      draft.unstage(key);
      return;
    }
    draft.stage(key, { wire: { type: "style-text", key, id: row.id, field, locale, value } });
  }

  function control(field: Field, locale: "es" | "en", multiline: boolean, label: string): JSX.Element {
    const value = current(field, locale);
    const common = {
      defaultValue: value,
      maxLength: TEXT_LIMITS[field],
      "aria-label": label,
      className: box,
      onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => blur(field, locale, event),
    };
    return multiline ? (
      <textarea key={`${field}:${locale}:${value}`} rows={3} {...common} />
    ) : (
      <input key={`${field}:${locale}:${value}`} type="text" {...common} />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-[0.9375rem] font-medium">{t("wordsTitle")}</h3>
      {FIELDS.map(({ field, labelKey, multiline }) => {
        const pending = draft.pending(textKey(field, "es"));
        return (
          <label key={field} className="grid gap-1 text-[0.75rem] text-ink-faint">
            <span className="flex items-center gap-2">
              {t(labelKey)}
              {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
            </span>
            {control(field, "es", multiline, t(labelKey))}
            {undoable.has(`${row.id}:${field}:es`) && !pending ? (
              <UndoLink kind="style-text" id={`${row.id}:${field}:es`} />
            ) : null}
          </label>
        );
      })}
      <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("styleNote")}</p>

      <button
        type="button"
        onClick={() => setEnglish(!english)}
        aria-expanded={english}
        className="w-fit text-xs underline underline-offset-4"
      >
        {english ? t("hideEnglish") : t("seeEnglish")}
      </button>

      {english ? (
        <div className="grid gap-3 border-l border-line pl-4">
          {pendingEnglish.length > 0 ? (
            <span className="flex flex-wrap items-center gap-3 text-[0.8125rem]">
              <span className="font-semibold text-marigold-deep">{t("englishPending")}</span>
              {translating ? (
                <Pending confirming={translating.confirming} error={translating.error} />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    draft.stage(translateKey, {
                      wire: { type: "translate", key: translateKey, id: row.id, fields: pendingEnglish },
                    })
                  }
                  className="underline underline-offset-4"
                >
                  {t("translateNow")}
                </button>
              )}
            </span>
          ) : null}
          {FIELDS.map(({ field, labelKey, multiline }) => {
            const pending = draft.pending(textKey(field, "en"));
            const open = correcting.includes(field) || pending !== undefined;
            const label = `${t(labelKey)}, ${t("textsEnglish")}`;
            return (
              <div key={field} className="grid gap-1 text-[0.75rem] text-ink-faint">
                <span className="flex items-center gap-2">
                  {label}
                  {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
                  {!pending && pendingEnglish.includes(field) ? (
                    <span className="text-marigold-deep">{t("englishPending")}</span>
                  ) : null}
                </span>
                {open ? (
                  control(field, "en", multiline, label)
                ) : (
                  <span className="flex items-start justify-between gap-3 text-[0.9375rem] text-ink">
                    <span className="min-w-0 whitespace-pre-wrap">{current(field, "en")}</span>
                    <button
                      type="button"
                      onClick={() => setCorrecting([...correcting, field])}
                      className="shrink-0 text-xs underline underline-offset-4"
                    >
                      {t("correctEnglish")}
                    </button>
                  </span>
                )}
                {undoable.has(`${row.id}:${field}:en`) && !pending ? (
                  <UndoLink kind="style-text" id={`${row.id}:${field}:en`} />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
