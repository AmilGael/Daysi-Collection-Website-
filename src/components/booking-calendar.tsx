"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DaySlots } from "@/lib/availability";
import type { Locale } from "@/i18n/routing";

/**
 * The month grid on the booking page.
 *
 * Availability arrives as a flat list of open days; this lays them onto a real
 * calendar table — weeks as rows, Monday first, one month in view — because
 * "next Tuesday" is how a person holds a date in their head, and the strip of
 * day-cards it replaces made them scroll sideways through what a table shows
 * at a glance. The table is sized to sit whole on a phone screen.
 *
 * Days are calendar dates, not instants: cells are built with the
 * parts-constructor (`new Date(year, month, day)`), which is pure date
 * arithmetic and cannot shift under the visitor's time zone. Which days are
 * open was already decided by the server in the atelier's own zone.
 */

type Cell = {
  readonly day: number;
  readonly date: string;
  readonly open: boolean;
} | null;

/** "2026-08-14" → "2026-08". */
function monthOf(date: string): string {
  return date.slice(0, 7);
}

function chunkIntoWeeks(cells: Cell[]): Cell[][] {
  const weeks: Cell[][] = [];
  for (let at = 0; at < cells.length; at += 7) weeks.push(cells.slice(at, at + 7));
  return weeks;
}

export function BookingCalendar({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: readonly DaySlots[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale() as Locale;
  const language = locale === "es" ? "es-US" : "en-US";

  const openDates = useMemo(() => new Set(days.map((day) => day.date)), [days]);
  const months = useMemo(
    () => [...new Set(days.map((day) => monthOf(day.date)))],
    [days],
  );

  const [monthIndex, setMonthIndex] = useState(0);

  // Switching the session length refetches availability; the view goes back to
  // the first month that has anything in it rather than pointing past the end.
  useEffect(() => setMonthIndex(0), [days]);

  const activeMonth = months[Math.min(monthIndex, Math.max(months.length - 1, 0))];

  const weekdayLabels = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: "short" });
    // January 1st 2024 was a Monday; the week here starts on Monday.
    return Array.from({ length: 7 }, (_, offset) =>
      format.format(new Date(2024, 0, 1 + offset)),
    );
  }, [language]);

  if (!activeMonth) return null;

  const [year, month] = activeMonth.split("-").map(Number) as [number, number];
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const cells: Cell[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${activeMonth}-${String(day).padStart(2, "0")}`;
    cells.push({ day, date, open: openDates.has(date) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  // Spanish month names arrive lowercase ("agosto de 2026"); only the first
  // letter takes a capital — CSS `capitalize` would wrongly uppercase the "de".
  const formatted = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(firstOfMonth);
  const monthLabel = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <div className="w-full max-w-[22rem]">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <p className="font-display text-[1.0625rem]">{monthLabel}</p>
        <div className="flex gap-1.5">
          <PagerButton
            label={t("previousMonth")}
            disabled={monthIndex === 0}
            onClick={() => setMonthIndex((index) => index - 1)}
          >
            ‹
          </PagerButton>
          <PagerButton
            label={t("nextMonth")}
            disabled={monthIndex >= months.length - 1}
            onClick={() => setMonthIndex((index) => index + 1)}
          >
            ›
          </PagerButton>
        </div>
      </div>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{monthLabel}</caption>
        <thead>
          <tr>
            {weekdayLabels.map((label) => (
              <th
                key={label}
                scope="col"
                className="py-2.5 text-center text-[0.625rem] font-medium uppercase tracking-[0.12em] text-ink-faint"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chunkIntoWeeks(cells).map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((cell, cellIndex) => (
                <td key={cell?.date ?? `blank-${cellIndex}`} className="p-0.5 text-center">
                  {cell ? (
                    cell.open ? (
                      <button
                        type="button"
                        aria-pressed={cell.date === selectedDate}
                        onClick={() => onSelectDate(cell.date)}
                        className={`h-10 w-full rounded-[2px] text-[0.875rem] tabular-nums transition-colors ${
                          cell.date === selectedDate
                            ? "bg-ink text-paper"
                            : "border border-line hover:border-ink/50 hover:bg-paper-warm"
                        }`}
                      >
                        {cell.day}
                      </button>
                    ) : (
                      /* A closed or full day stays visible — a month with holes
                         in it reads as broken — but offers nothing to press. */
                      <span
                        aria-hidden
                        className="flex h-10 w-full items-center justify-center text-[0.875rem] tabular-nums text-ink-faint/45"
                      >
                        {cell.day}
                      </span>
                    )
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-line text-[1rem] leading-none transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
