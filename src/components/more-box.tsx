"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * An optional notes field folded behind one line, "+ Algo más (opcional)",
 * since most clients leave it empty and a blank box on every form reads as one
 * more thing to fill in. The field stays mounted while folded, only hidden,
 * so whatever was typed is still there when it opens again; and a box that
 * already holds text starts open, so nothing written is ever out of sight.
 */
export function MoreBox({ value, children }: { value: string; children: ReactNode }) {
  const t = useTranslations("common");
  const regionId = useId();
  const region = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(() => value.trim() !== "");
  // Where focus goes after a toggle the person made, never on first render:
  // into the field when it opens, back to the opener when it folds.
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (open) region.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    else opener.current?.focus();
  }, [open]);

  function toggle(next: boolean) {
    moved.current = true;
    setOpen(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={opener}
        type="button"
        hidden={open}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => toggle(true)}
        className="self-start text-[0.875rem] text-ink-soft transition-colors hover:text-ink"
      >
        <span aria-hidden>+ </span>
        <span className="link-underline">{t("moreOpen")}</span>
      </button>
      <div ref={region} id={regionId} hidden={!open} className="flex flex-col gap-2">
        {children}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => toggle(false)}
          className="link-underline self-start text-[0.8125rem] text-ink-soft"
        >
          {t("moreClose")}
        </button>
      </div>
    </div>
  );
}
