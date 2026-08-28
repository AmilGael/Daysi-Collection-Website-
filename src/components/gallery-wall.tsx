"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { GalleryCategoryId } from "@/content/types";
import { PHOTO_QUALITY } from "@/lib/images";

export type WallWork = {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly category: GalleryCategoryId;
  readonly caption: string;
};

/**
 * Eighteen years of work as a wall of photographs.
 *
 * The pieces here are not for sale, so there is no price, no size and nothing
 * to add to a basket — the only thing to do with them is look, which is why a
 * click opens the photograph rather than a product page.
 *
 * Laid out in columns rather than a strict grid: these are phone photographs,
 * runway captures and studio work in every proportion, and forcing them into
 * one aspect would crop the garment out of half of them.
 */
export function GalleryWall({
  works,
  categories,
}: {
  works: readonly WallWork[];
  categories: readonly { readonly id: GalleryCategoryId; readonly label: string }[];
}) {
  const t = useTranslations("gallery");
  const [filter, setFilter] = useState<GalleryCategoryId | "all">("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const shown = filter === "all" ? works : works.filter((work) => work.category === filter);
  const open = openIndex === null ? null : shown[openIndex] ?? null;

  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + shown.length) % shown.length,
      ),
    [shown.length],
  );

  // The lightbox is a dialog: escape leaves, arrows move, and the page behind
  // it does not scroll while it is up.
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, step]);

  return (
    <>
      <div className="shell flex flex-wrap items-baseline gap-x-6 gap-y-3 border-b border-line pb-5">
        <FilterButton
          active={filter === "all"}
          onClick={() => {
            setFilter("all");
            setOpenIndex(null);
          }}
        >
          {t("all")}
        </FilterButton>
        {categories.map((category) => (
          <FilterButton
            key={category.id}
            active={filter === category.id}
            onClick={() => {
              setFilter(category.id);
              setOpenIndex(null);
            }}
          >
            {category.label}
          </FilterButton>
        ))}
        <span className="ml-auto text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          {t("count", { count: shown.length })}
        </span>
      </div>

      <div className="shell columns-2 gap-4 py-10 md:columns-3 md:gap-5 xl:columns-4">
        {shown.map((work, index) => (
          <button
            key={work.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={work.caption}
            className="group mb-4 block w-full break-inside-avoid overflow-hidden bg-paper-warm md:mb-5"
          >
            <span className="relative block">
              <Image
                src={work.src}
                alt={work.caption}
                width={work.width}
                height={work.height}
                quality={PHOTO_QUALITY}
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw"
                className="h-auto w-full transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.03]"
              />
              <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <span className="image-veil absolute inset-0" />
                <span className="absolute inset-x-0 bottom-0 p-4 text-left text-[0.8125rem] leading-snug text-paper">
                  {work.caption}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption}
          className="on-ink fixed inset-0 z-50 flex flex-col bg-ink/97"
          onClick={() => setOpenIndex(null)}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-paper/50">
              {(openIndex ?? 0) + 1} / {shown.length}
            </p>
            <CloseButton onClose={() => setOpenIndex(null)} label={t("close")} />
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={open.src}
              alt={open.caption}
              width={open.width}
              height={open.height}
              quality={PHOTO_QUALITY}
              sizes="92vw"
              className="max-h-full w-auto max-w-full object-contain"
              priority
            />
          </div>

          <div
            className="flex items-center justify-between gap-6 px-5 pb-6 pt-3"
            onClick={(event) => event.stopPropagation()}
          >
            <StepButton onClick={() => step(-1)} label={t("previous")}>
              ‹
            </StepButton>
            <p className="max-w-xl text-center text-[0.875rem] leading-relaxed text-paper/80">
              {open.caption}
            </p>
            <StepButton onClick={() => step(1)} label={t("next")}>
              ›
            </StepButton>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`relative text-[0.8125rem] transition-colors ${
        active ? "text-ink" : "text-ink-faint hover:text-ink"
      }`}
    >
      {children}
      <span
        aria-hidden
        className={`absolute -bottom-1.5 left-0 h-px bg-marigold transition-all duration-300 ${
          active ? "w-full" : "w-0"
        }`}
      />
    </button>
  );
}

/** Takes focus when the lightbox opens, so escape and tab behave. */
function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClose}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-paper/30 text-paper transition-colors hover:border-paper/70"
    >
      <span className="relative block h-3.5 w-3.5">
        <span className="absolute left-0 top-1.5 h-px w-full rotate-45 bg-current" />
        <span className="absolute left-0 top-1.5 h-px w-full -rotate-45 bg-current" />
      </span>
    </button>
  );
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-paper/30 font-display text-[1.5rem] leading-none text-paper transition-colors hover:border-paper/70"
    >
      {children}
    </button>
  );
}
