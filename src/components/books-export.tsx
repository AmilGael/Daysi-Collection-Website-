"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { buttonClass } from "./ui";

/**
 * The bookkeeping hand-off. Daysi picks a range — a quarter, a year — sees
 * what is in it, and downloads one file for her accountant.
 *
 * The download goes through fetch rather than a plain link so the request
 * carries an Origin header and meets the same check every other office call
 * does; a bare <a href> is sent without one and would be refused.
 */
export function BooksExport({
  presets,
  initialFrom,
  initialTo,
}: {
  presets: readonly { readonly label: string; readonly from: string; readonly to: string }[];
  initialFrom: string;
  initialTo: string;
}) {
  const t = useTranslations("office");
  const locale = useLocale() as Locale;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [state, setState] = useState<"idle" | "working" | "failed" | "empty">("idle");

  async function download() {
    setState("working");
    try {
      const query = new URLSearchParams({ from, to, locale });
      const response = await fetch(`/api/office/books?${query}`);
      if (!response.ok) throw new Error("export-failed");

      // Kept as a blob, never as text: reading the body with .text() strips
      // the leading BOM, and the BOM is the only reason Excel opens the file
      // with the accents in "Medallón" intact.
      const file = await response.blob();

      // Header row only means the range holds nothing; say so rather than
      // handing her an empty file and letting her wonder.
      if ((await file.text()).trim().split("\r\n").length <= 1) {
        setState("empty");
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `daysi-collection-sales-${from}-to-${to}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = preset.from === from && preset.to === to;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
                setState("idle");
              }}
              className={`border px-3 py-1.5 text-[0.75rem] uppercase tracking-[0.14em] transition-colors ${
                active ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-5">
        <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
          {t("booksFrom")}
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setState("idle");
            }}
            className="border border-line bg-paper px-3 py-2 text-[0.875rem] text-ink focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
          {t("booksTo")}
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setState("idle");
            }}
            className="border border-line bg-paper px-3 py-2 text-[0.875rem] text-ink focus:border-ink"
          />
        </label>
        <button
          type="button"
          onClick={download}
          disabled={state === "working" || from > to}
          className={buttonClass({ size: "small", tone: "solid", className: "disabled:opacity-50" })}
        >
          {state === "working" ? t("booksWorking") : t("booksDownload")}
        </button>
      </div>

      {state === "empty" ? (
        <p className="text-[0.8125rem] text-ink-soft">{t("booksEmpty")}</p>
      ) : null}
      {state === "failed" ? (
        <p className="text-[0.8125rem] text-ink">{t("updateFailed")}</p>
      ) : null}
    </div>
  );
}
