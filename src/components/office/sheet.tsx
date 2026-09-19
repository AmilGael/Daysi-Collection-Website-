"use client";

import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui";

/**
 * A place to edit one thing, not a place that saves.
 *
 * Under 640 px it fills the screen; above, it is a panel on the right.
 * Either way it sits at z-50: above the page and the sticky site header
 * (z-40), and below the confirm bar (z-[60]), and leaves the bar's height
 * free at its foot via the shared `--office-bar` custom property (see
 * `globals.css`), so Confirmar cambios is always there and always
 * tappable (design, Amendment 4 §2). Every control inside stages into the
 * tab's draft, so closing loses nothing: Listo, Escape, the backdrop and
 * the phone's back gesture all just close.
 *
 * The back gesture works through one pushed history entry per open sheet.
 * The entry keeps Next's own state (spread first) so the router still
 * recognises it; closing by any other route pops that entry again. The
 * effect runs on `open` and `onClose`, so `onClose` must be stable
 * (`useCallback`): a fresh function on every render would pop the entry
 * while the sheet is still open.
 *
 * Rendered through a portal onto `document.body`, so a sheet opened from
 * inside an element with its own stacking or filter context — the office
 * header's `backdrop-blur-md`, which makes it the containing block for any
 * `fixed` descendant — still covers the whole viewport rather than
 * collapsing into that ancestor's box. Safe wherever this is placed: it
 * returns null until `open`, and `open` only ever turns true from a click,
 * which cannot happen before the browser exists to click in.
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
  const content = useRef<HTMLDivElement>(null);
  const closing = useRef<"pop" | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = content.current?.querySelector<HTMLElement>('input:not([type="file"]), textarea, select, button');
    (first ?? panel.current?.querySelector<HTMLElement>("button"))?.focus();

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

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t("sheetClose")}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 top-0 bottom-[var(--office-bar)] flex flex-col bg-paper shadow-xl sm:top-0 sm:left-auto sm:right-0 sm:w-[28rem] sm:border-l sm:border-line"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 className="min-w-0 truncate font-display text-[1.25rem]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass({ size: "small", tone: "solid" })}
          >
            {t("sheetDone")}
          </button>
        </header>
        <div ref={content} className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
