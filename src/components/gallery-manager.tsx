"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { GalleryCategoryId } from "@/content/types";
import { buttonClass } from "./ui";

export type ManagedWork = {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly category: GalleryCategoryId;
  readonly caption: string;
  readonly hidden: boolean;
};

/**
 * The portfolio, from Daysi's side. Everything she has made is a thumbnail
 * with one switch under it, and adding a new piece is a photograph, a place to
 * file it and a line about it — the three things she would say anyway when
 * showing someone the picture on her phone.
 */
export function GalleryManager({
  works,
  categories,
}: {
  works: readonly ManagedWork[];
  categories: readonly { readonly id: GalleryCategoryId; readonly label: string }[];
}) {
  const t = useTranslations("office");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState(works);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<GalleryCategoryId>(categories[0]?.id ?? "commissions");
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function toggle(work: ManagedWork) {
    const hidden = !work.hidden;
    setRows((current) =>
      current.map((row) => (row.id === work.id ? { ...row, hidden } : row)),
    );
    try {
      const response = await fetch("/api/office/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: work.id, hidden }),
      });
      if (!response.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setRows((current) =>
        current.map((row) => (row.id === work.id ? { ...row, hidden: work.hidden } : row)),
      );
      setState("failed");
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setState("saving");
    try {
      const bitmap = await createImageBitmap(file);
      const form = new FormData();
      form.append("file", file);
      const uploaded = await fetch("/api/office/uploads", { method: "POST", body: form });
      if (!uploaded.ok) throw new Error("upload-failed");
      const { src } = (await uploaded.json()) as { src: string };

      const saved = await fetch("/api/office/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src,
          width: bitmap.width,
          height: bitmap.height,
          category,
          caption: caption.trim(),
        }),
      });
      if (!saved.ok) throw new Error("save-failed");

      setState("saved");
      setCaption("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
        {rows.map((work) => (
          <li key={work.id} className="flex flex-col gap-1.5">
            <span
              className={`relative block aspect-3/4 overflow-hidden border border-line transition-opacity ${
                work.hidden ? "opacity-30" : ""
              }`}
            >
              <Image src={work.src} alt="" fill sizes="10rem" className="object-cover" />
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-[0.6875rem] text-ink-faint">
              <input
                type="checkbox"
                checked={!work.hidden}
                onChange={() => toggle(work)}
                className="h-3.5 w-3.5 accent-ink"
              />
              {work.hidden ? t("hidden") : t("shown")}
            </label>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex max-w-xl flex-col gap-5 border-t border-line pt-6">
        <p className="text-[0.9375rem] font-medium">{t("galleryAdd")}</p>

        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
            {t("galleryPhoto")}
            <span className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                  setState("idle");
                }}
                className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]"
              />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-12 w-12 border border-line object-cover" />
              ) : null}
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
            {t("galleryCategory")}
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as GalleryCategoryId)}
              className="border border-line bg-paper px-3 py-2 text-[0.875rem] text-ink focus:border-ink"
            >
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
          {t("galleryCaption")}
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={200}
            placeholder={t("galleryCaptionPlaceholder")}
            className="border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink"
          />
        </label>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={state === "saving"}
            className={buttonClass({ size: "small", tone: "solid" })}
          >
            {state === "saving" ? t("saving") : t("gallerySave")}
          </button>
          {state === "saved" ? (
            <span className="text-[0.8125rem] text-marigold-deep">{t("gallerySaved")}</span>
          ) : null}
          {state === "failed" ? (
            <span className="text-[0.8125rem] text-ink">{t("updateFailed")}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
