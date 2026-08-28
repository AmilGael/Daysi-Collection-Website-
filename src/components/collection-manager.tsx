"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";

/** What the office needs to know about a style to manage it — nothing more. */
export type ManagedStyle = {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly photo: string;
  readonly photoCount: number;
  readonly isPublished: boolean;
  readonly sizes: readonly { readonly sizeId: "s" | "m" | "l"; readonly inStock: boolean }[];
  readonly addedPhotos: readonly string[];
  readonly coverSrc?: string;
};

/**
 * Daysi's rack, as a table: one row per piece, a switch for whether it shows
 * on the site at all, and a box per size for what is in stock today. Every
 * change saves itself; there is no separate publish step to forget.
 */
export function CollectionManager({
  styles,
  locale,
}: {
  styles: readonly ManagedStyle[];
  locale: Locale;
}) {
  const t = useTranslations("office");
  const router = useRouter();
  const [rows, setRows] = useState(styles);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  async function addPhoto(row: ManagedStyle, file: File, asCover: boolean) {
    setFailedId(null);
    try {
      const upload = new FormData();
      upload.append("file", file);
      const uploaded = await fetch("/api/office/uploads", { method: "POST", body: upload });
      if (!uploaded.ok) throw new Error("upload-failed");
      const { src } = (await uploaded.json()) as { src: string };
      await save({
        ...row,
        photoCount: row.photoCount + 1,
        addedPhotos: [...row.addedPhotos, src],
        ...(asCover ? { coverSrc: src, photo: src } : {}),
      });
    } catch {
      setFailedId(row.id);
    }
  }

  async function save(next: ManagedStyle) {
    setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
    setFailedId(null);
    try {
      const response = await fetch("/api/office/styles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: next.id,
          isPublished: next.isPublished,
          stock: Object.fromEntries(next.sizes.map((size) => [size.sizeId, size.inStock])),
          addedPhotos: next.addedPhotos,
          ...(next.coverSrc ? { coverSrc: next.coverSrc } : {}),
        }),
      });
      if (!response.ok) throw new Error("save-failed");
      setSavedId(next.id);
      setTimeout(() => setSavedId((id) => (id === next.id ? null : id)), 2000);
      router.refresh();
    } catch {
      setFailedId(next.id);
      setRows((current) =>
        current.map((row) =>
          row.id === next.id ? styles.find((style) => style.id === next.id) ?? row : row,
        ),
      );
    }
  }

  return (
    <div className="flex flex-col border-t border-line">
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[3rem_1fr] items-center gap-4 border-b border-line py-4 sm:grid-cols-[3rem_1fr_auto_auto] sm:gap-6"
        >
          <div className="relative aspect-3/4 overflow-hidden bg-paper-warm">
            <Image src={row.photo} alt="" fill sizes="3rem" className="object-cover" />
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[0.9375rem]">{row.name}</p>
            <p className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
              {row.category}
              <span className="ml-3 normal-case tracking-normal">
                {t("photoCount", { count: row.photoCount })}
              </span>
              {savedId === row.id ? (
                <span className="ml-3 normal-case tracking-normal text-marigold-deep">
                  {t("saved")}
                </span>
              ) : null}
              {failedId === row.id ? (
                <span className="ml-3 normal-case tracking-normal text-ink">
                  {t("updateFailed")}
                </span>
              ) : null}
            </p>
            <label className="mt-1 w-fit cursor-pointer text-[0.75rem] underline underline-offset-4 hover:text-marigold-deep">
              {t("addPhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void addPhoto(
                      row,
                      file,
                      window.confirm(t("photoCoverAsk")),
                    );
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <fieldset className="col-start-2 flex items-center gap-4 sm:col-start-3">
            <legend className="sr-only">{t("stockLegend", { name: row.name })}</legend>
            {row.sizes.map((size) => (
              <label
                key={size.sizeId}
                className="flex cursor-pointer items-center gap-1.5 text-[0.8125rem] uppercase"
              >
                <input
                  type="checkbox"
                  checked={size.inStock}
                  onChange={(event) =>
                    save({
                      ...row,
                      sizes: row.sizes.map((candidate) =>
                        candidate.sizeId === size.sizeId
                          ? { ...candidate, inStock: event.target.checked }
                          : candidate,
                      ),
                    })
                  }
                  className="h-4 w-4 accent-ink"
                />
                {size.sizeId}
              </label>
            ))}
          </fieldset>

          <label className="col-start-2 flex w-fit cursor-pointer items-center gap-2 text-[0.8125rem] sm:col-start-4">
            <input
              type="checkbox"
              checked={row.isPublished}
              onChange={(event) => save({ ...row, isPublished: event.target.checked })}
              className="h-4 w-4 accent-ink"
            />
            {row.isPublished ? t("shown") : t("hidden")}
          </label>
        </div>
      ))}
      <p className="pt-4 text-[0.8125rem] leading-relaxed text-ink-faint">
        {t("collectionNote", { count: rows.filter((row) => row.isPublished).length })}
      </p>
    </div>
  );
}
