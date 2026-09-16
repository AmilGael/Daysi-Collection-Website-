"use client";

import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui";

/**
 * A place to edit one thing, not a place that saves.
 *
 * Under 640 px it fills the screen; above, it is a panel on the right.
 * Either way it sits above the page and below the confirm bar, and leaves
 * the bar's height free at its foot, so Confirmar cambios is always there
 * (design, Amendment 4 §2). Every control inside stages into the tab's
 * draft, so closing loses nothing: Listo, Escape, the backdrop and the
 * phone's back gesture all just close.
 *
 * The back gesture works through one pushed history entry per open sheet.
 * The entry keeps Next's own state (spread first) so the router still
 * recognises it; closing by any other route pops that entry again. The
 * effect runs on `open` and `onClose`, so `onClose` must be stable
 * (`useCallback`): a fresh function on every render would pop the entry
 * while the sheet is still open.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}): JSX.Element | null {
  const t = useTranslations("office");
  const panel = useRef<HTMLDivElement>(null);
  const closing = useRef<"pop" | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const pop = () => {
      closing.current = "pop";
      onClose();
    };
    window.history.pushState({ ...window.history.state, sheet: true }, "");
    window.addEventListener("popstate", pop);
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", key);
      window.removeEventListener("popstate", pop);
      document.body.style.overflow = overflow;
      if (closing.current !== "pop" && window.history.state?.sheet) window.history.back();
      closing.current = null;
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 bg-ink/40" aria-hidden onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 top-0 bottom-16 flex flex-col bg-paper shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[28rem] sm:border-l sm:border-line"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 className="min-w-0 truncate font-display text-[1.25rem]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sheetClose")}
            className={buttonClass({ size: "small", tone: "solid" })}
          >
            {t("sheetDone")}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
