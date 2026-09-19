"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** How close the popover may come to the edge of the screen, in px. */
const EDGE = 12;
/** The gap between the icon and the popover, in px. */
const GAP = 6;

/**
 * A small "?" beside a label, holding an aside the field does not need to
 * show all the time. It opens on hover for a mouse, on focus for a keyboard,
 * and on a tap for a finger, where a second tap folds it again. The text stays
 * in the page when it is closed, only hidden, so the button (and the field,
 * through `id`) can be described by it for a screen reader either way.
 */
export function InfoTip({ text, id }: { text: string; id?: string }) {
  const t = useTranslations("common");
  const ownId = useId();
  const tipId = id ?? `${ownId}-tip`;
  const wrapper = useRef<HTMLSpanElement>(null);
  const popover = useRef<HTMLSpanElement>(null);

  // Three reasons to be open, kept apart so one ending does not close the
  // others: a mouse resting on it, keyboard focus, and a tap that pinned it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  const [place, setPlace] = useState<{ left: number; above: boolean }>({ left: 0, above: false });

  // A tap anywhere else folds it, which is how a phone closes it; a phone
  // does not always move focus off a button, so blur alone is not enough.
  // Escape is heard on the whole page, so it also folds one a mouse opened
  // while the keyboard's focus sat somewhere else.
  useEffect(() => {
    if (!open) return;
    function close() {
      setHovered(false);
      setFocused(false);
      setPinned(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Measured once it is showing and before it paints: centred on the icon
  // when there is room, slid sideways when that would cross the screen's
  // edge, and flipped above the icon when there is no room below. Measured
  // again if the screen changes size while it is open, as a turned phone does.
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      if (!wrapper.current || !popover.current) return;
      const icon = wrapper.current.getBoundingClientRect();
      const width = popover.current.offsetWidth;
      const height = popover.current.offsetHeight;
      const centred = icon.left + icon.width / 2 - width / 2;
      const left = Math.min(Math.max(centred, EDGE), window.innerWidth - EDGE - width);
      const above =
        icon.bottom + GAP + height > window.innerHeight - EDGE && icon.top - GAP - height > EDGE;
      setPlace({ left: left - icon.left, above });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, text]);

  return (
    <span
      ref={wrapper}
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
    >
      <button
        type="button"
        aria-label={t("moreInfo")}
        aria-describedby={tipId}
        onClick={() => setPinned((current) => !current)}
        // Only focus from the keyboard opens it: a click focuses the button
        // too, and would otherwise open it just before the click toggled it.
        onFocus={(event) => setFocused(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-line-strong text-[0.6875rem] font-medium leading-none text-ink-soft transition-colors hover:border-ink hover:text-ink"
      >
        ?
      </button>
      <span
        ref={popover}
        id={tipId}
        role="tooltip"
        hidden={!open}
        style={{ left: place.left }}
        className={`absolute z-20 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-[2px] border border-line bg-paper px-3.5 py-2.5 text-[0.8125rem] font-normal leading-relaxed text-ink-soft shadow-[0_6px_20px_-8px_rgb(0_0_0/0.25)] ${
          place.above ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
