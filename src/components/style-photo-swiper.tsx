"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { PHOTO_QUALITY } from "@/lib/images";

/**
 * The photographs of one piece, swipeable in place.
 *
 * A garment with a second photograph should not need a page turn to show it,
 * so the card itself pans: touch drags the strip, the arrows do the same for
 * a pointer, and a tap anywhere on the picture still opens the piece. Each
 * slide is its own link rather than the strip sitting inside one anchor —
 * buttons nested in an anchor are the kind of markup that works until a
 * screen reader meets it.
 *
 * Scroll-snap does the panning, so there is nothing here to animate by hand
 * and a swipe behaves exactly like a swipe everywhere else on a phone.
 */
export function StylePhotoSwiper({
  href,
  photos,
  priority = false,
  nextLabel,
  previousLabel,
}: {
  href: string;
  photos: readonly { src: string; alt: string }[];
  priority?: boolean;
  nextLabel: string;
  previousLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function goTo(target: number) {
    const element = scroller.current;
    if (!element) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, target));
    element.scrollTo({ left: clamped * element.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    setIndex(Math.round(element.scrollLeft / element.clientWidth));
  }

  return (
    <div className="group/swiper relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo) => (
          <Link
            key={photo.src}
            href={href}
            tabIndex={-1}
            className="relative aspect-3/4 w-full shrink-0 snap-start overflow-hidden bg-paper-warm"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority={priority}
              quality={PHOTO_QUALITY}
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </Link>
        ))}
      </div>

      <SwipeArrow
        label={previousLabel}
        side="left"
        hidden={index === 0}
        onClick={() => goTo(index - 1)}
      />
      <SwipeArrow
        label={nextLabel}
        side="right"
        hidden={index === photos.length - 1}
        onClick={() => goTo(index + 1)}
      />

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {photos.map((photo, dot) => (
          <span
            key={photo.src}
            className={`h-1 w-4 rounded-[2px] transition-colors ${
              dot === index ? "bg-paper" : "bg-paper/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SwipeArrow({
  label,
  side,
  hidden,
  onClick,
}: {
  label: string;
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[2px] bg-ink/45 text-paper backdrop-blur-sm transition-opacity hover:bg-ink/65 ${
        side === "left" ? "left-2" : "right-2"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-0 focus-visible:opacity-100 group-hover/swiper:opacity-100 max-lg:opacity-100"}`}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        {side === "left" ? <path d="M10 3 5 8l5 5" /> : <path d="M6 3l5 5-5 5" />}
      </svg>
    </button>
  );
}
