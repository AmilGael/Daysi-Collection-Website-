"use client";

import Image from "next/image";
import type { JSX } from "react";
import { useTranslations } from "next-intl";
import {
  MAX_PHOTOS,
  addFiles,
  coverSlot,
  moveSlot,
  removeSlot,
  slotKey,
  type PhotoSlot,
} from "@/lib/photo-order";

/**
 * Every photo of the garment, in the order the site will show them, the
 * first marked as the cover. Each has Hacer portada, Mover antes, Mover
 * después and Quitar; a "+" tile adds files, which show as pending until
 * confirm uploads them. Arrows rather than drag: a drag that works under a
 * mouse and a thumb needs a library or a pointer engine, and a garment has
 * two to four photos.
 */
export function GarmentPhotos({
  slots,
  onChange,
  max = MAX_PHOTOS,
  disabled,
}: {
  slots: readonly PhotoSlot[];
  onChange(next: PhotoSlot[]): void;
  max?: number;
  disabled?: boolean;
}): JSX.Element {
  const t = useTranslations("office");
  const link = "min-h-8 text-[0.6875rem] underline underline-offset-4 disabled:opacity-60";

  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {slots.map((slot, index) => (
        <li key={slotKey(slot)} className="flex flex-col gap-1.5">
          <span
            className={`relative block aspect-3/4 overflow-hidden border ${
              index === 0 ? "border-2 border-marigold" : "border-line"
            }`}
          >
            {slot.kind === "src" ? (
              <Image src={slot.src} alt="" fill sizes="(min-width: 640px) 6rem, 30vw" className="object-cover" />
            ) : (
              <Image src={slot.preview} alt="" fill unoptimized sizes="6rem" className="object-cover" />
            )}
            {index === 0 ? (
              <span className="absolute left-1 top-1 bg-marigold px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink">
                {t("photoCoverMark")}
              </span>
            ) : null}
          </span>
          {slot.kind === "file" ? (
            <span className="text-[0.6875rem] text-marigold-deep">{t("photoUploadsOnConfirm")}</span>
          ) : null}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0">
            {index > 0 ? (
              <button type="button" disabled={disabled} onClick={() => onChange(coverSlot(slots, index))} className={link}>
                {t("photoMakeCover")}
              </button>
            ) : null}
            {index > 0 ? (
              <button type="button" disabled={disabled} aria-label={t("photoEarlier")} onClick={() => onChange(moveSlot(slots, index, index - 1))} className={link}>
                ◀
              </button>
            ) : null}
            {index < slots.length - 1 ? (
              <button type="button" disabled={disabled} aria-label={t("photoLater")} onClick={() => onChange(moveSlot(slots, index, index + 1))} className={link}>
                ▶
              </button>
            ) : null}
            {slots.length > 1 ? (
              <button type="button" disabled={disabled} onClick={() => onChange(removeSlot(slots, index))} className={link}>
                {t("photoRemove")}
              </button>
            ) : null}
          </span>
        </li>
      ))}
      {slots.length < max ? (
        <li>
          <label className="flex aspect-3/4 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-line-strong text-center text-[0.75rem] text-ink-faint hover:border-ink">
            <span className="text-2xl leading-none">+</span>
            {t("photoAdd")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={disabled}
              className="sr-only"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length > 0) {
                  onChange(addFiles(slots, files, (file) => URL.createObjectURL(file)).slice(0, max));
                }
                event.target.value = "";
              }}
            />
          </label>
        </li>
      ) : null}
    </ul>
  );
}
