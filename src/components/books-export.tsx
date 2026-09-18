"use client";

import { useState, type JSX } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { buttonClass } from "./ui";

type DownloadState = "idle" | "working" | "failed" | "empty";

/**
 * The download goes through fetch rather than a plain link so the request
 * carries an Origin header and meets the same check every other office call
 * does; a bare <a href> is sent without one and would be refused.
 */
async function downloadRange(from: string, to: string, locale: Locale): Promise<DownloadState> {
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
    if ((await file.text()).trim().split("\r\n").length <= 1) return "empty";

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daysi-collection-sales-${from}-to-${to}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return "idle";
  } catch {
    return "failed";
  }
}

function formatRange(from: string, to: string, locale: Locale): string {
  const day = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day.format(new Date(`${from}T12:00:00Z`))} – ${day.format(new Date(`${to}T12:00:00Z`))}`;
}

function DownloadFeedback({ state }: { state: DownloadState }): JSX.Element | null {
  const t = useTranslations("office");
  if (state === "empty") return <p className="text-[0.8125rem] text-ink-soft">{t("booksEmpty")}</p>;
  if (state === "failed") return <p className="text-[0.8125rem] text-ink">{t("updateFailed")}</p>;
  return null;
}

/** One preset range: its dates, and the download button right on the card. */
function BookCard({ label, from, to }: { label: string; from: string; to: string }): JSX.Element {
  const t = useTranslations("office");
  const locale = useLocale() as Locale;
  const [state, setState] = useState<DownloadState>("idle");

  async function run() {
    setState("working");
    setState(await downloadRange(from, to, locale));
  }

  return (
    <li className="flex h-full flex-col gap-2 border border-line p-5">
      <span className="font-display text-[1.0625rem] leading-tight">{label}</span>
      <span className="text-[0.75rem] text-ink-faint">{formatRange(from, to, locale)}</span>
      <button
        type="button"
        onClick={run}
        disabled={state === "working"}
        className={buttonClass({ size: "small", tone: "solid", className: "mt-auto w-fit disabled:opacity-50" })}
      >
        {state === "working" ? t("booksWorking") : t("booksDownload")}
      </button>
      <DownloadFeedback state={state} />
    </li>
  );
}

/** Her own range: Desde and Hasta right on the card, the download button under them. */
function CustomBookCard({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }): JSX.Element {
  const t = useTranslations("office");
  const locale = useLocale() as Locale;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [state, setState] = useState<DownloadState>("idle");

  async function run() {
    setState("working");
    setState(await downloadRange(from, to, locale));
  }

  return (
    <li className="flex h-full flex-col gap-3 border border-line p-5 sm:col-span-2">
      <span className="font-display text-[1.0625rem] leading-tight">{t("booksCustomRange")}</span>
      <div className="flex flex-wrap gap-4">
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
      </div>
      <button
        type="button"
        onClick={run}
        disabled={state === "working" || from > to}
        className={buttonClass({ size: "small", tone: "solid", className: "mt-auto w-fit disabled:opacity-50" })}
      >
        {state === "working" ? t("booksWorking") : t("booksDownload")}
      </button>
      <DownloadFeedback state={state} />
    </li>
  );
}

/**
 * The bookkeeping hand-off, as a card per range: three presets, plus her own
 * Desde/Hasta, each with its own download button so tapping one asks
 * nothing else of her.
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
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {presets.map((preset) => (
        <BookCard key={preset.label} label={preset.label} from={preset.from} to={preset.to} />
      ))}
      <CustomBookCard initialFrom={initialFrom} initialTo={initialTo} />
    </ul>
  );
}
