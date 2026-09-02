"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { GalleryCategoryId } from "@/content/types";
import type { GalleryChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { RetiredGroup, RetireButton } from "./office/retired-group";
import { useOfficeDraft } from "./office/use-office-draft";
import { buttonClass } from "./ui";

export type ManagedWork = {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly category: GalleryCategoryId;
  readonly caption: string;
  readonly hidden: boolean;
  readonly retired: boolean;
};

export function GalleryManager({ works, retired, categories }: {
  works: readonly ManagedWork[];
  retired: readonly ManagedWork[];
  categories: readonly { readonly id: GalleryCategoryId; readonly label: string }[];
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<GalleryChange>();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<Record<string, string>>({});
  const selectedPreviewRef = useRef<string | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<GalleryCategoryId>(categories[0]?.id ?? "commissions");
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string>>({});

  useEffect(() => { previewsRef.current = pendingPreviews; }, [pendingPreviews]);
  useEffect(() => {
    const liveKeys = new Set(draft.entries.map((entry) => entry.key));
    setPendingPreviews((current) => {
      const next = { ...current };
      let changed = false;
      for (const [key, url] of Object.entries(current)) {
        if (!liveKeys.has(key)) {
          URL.revokeObjectURL(url);
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [draft.entries]);
  useEffect(() => () => {
    for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url);
    if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current);
  }, []);

  function stageVisibility(work: ManagedWork, hidden: boolean) {
    const key = `gallery:${work.id}`;
    if (hidden === work.hidden) draft.unstage(key);
    else draft.stage(key, { wire: { type: "work-visibility", key, id: work.id, hidden } });
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const key = `work-add:${crypto.randomUUID()}`;
    const wire: GalleryChange = {
      type: "work-add", key, src: "", width: bitmap.width, height: bitmap.height,
      category, caption: caption.trim(),
    };
    bitmap.close();
    const objectUrl = preview ?? URL.createObjectURL(file);
    selectedPreviewRef.current = null;
    setPendingPreviews((current) => ({ ...current, [key]: objectUrl }));
    draft.stage(key, { wire, files: [file], withUploads: ([src]) => ({ ...wire, src: src ?? "" }) });
    setCaption("");
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const pendingAdds = draft.entries.filter((entry) => entry.change.wire.type === "work-add");

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
        {works.map((work) => {
          const key = `gallery:${work.id}`;
          const entry = draft.pending(key);
          const hidden = entry?.change.wire.type === "work-visibility" ? entry.change.wire.hidden : work.hidden;
          const retiring = entry?.change.wire.type === "retire";
          return (
            <li key={work.id} className={`flex flex-col gap-1.5 ${retiring ? "opacity-50" : ""}`}>
              <span className={`relative block aspect-3/4 overflow-hidden border border-line transition-opacity ${hidden ? "opacity-30" : ""}`}>
                <Image src={work.src} alt="" fill sizes="10rem" className="object-cover" />
              </span>
              {entry ? <span className="flex flex-wrap items-center gap-2">
                <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
                {retiring ? <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">{t("removePending")}</button> : null}
              </span> : null}
              <label className="flex cursor-pointer items-center gap-1.5 text-[0.6875rem] text-ink-faint">
                <input type="checkbox" checked={!hidden} disabled={retiring} onChange={(event) => stageVisibility(work, !event.target.checked)} className="h-3.5 w-3.5 accent-ink" />
                {hidden ? t("hidden") : t("shown")}
              </label>
              {!retiring ? <RetireButton name={work.caption || work.id} onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: work.id } })} /> : null}
            </li>
          );
        })}
        {pendingAdds.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "work-add") return null;
          const src = pendingPreviews[entry.key];
          return <li key={entry.key} className="flex flex-col gap-1.5">
            <span className="relative block aspect-3/4 overflow-hidden border border-line">
              {src ? <Image src={src} alt="" fill unoptimized sizes="10rem" className="object-cover" /> : null}
            </span>
            <p className="truncate text-[0.6875rem] text-ink-faint">{wire.caption}</p>
            <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
            <button type="button" onClick={() => draft.unstage(entry.key)} className="text-left text-xs underline underline-offset-4">{t("removePending")}</button>
          </li>;
        })}
      </ul>

      <RetiredGroup
        items={retired.map((work) => ({ id: work.id, name: work.caption || work.id, photo: work.src }))}
        restoreKey={(id) => `gallery:${id}`}
        onRestore={(id) => { const key = `gallery:${id}`; draft.stage(key, { wire: { type: "restore", key, id } }); }}
      />

      <form onSubmit={add} className="flex max-w-xl flex-col gap-5 border-t border-line pt-6">
        <p className="text-[0.9375rem] font-medium">{t("galleryAdd")}</p>
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
            {t("galleryPhoto")}
            <span className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => {
                if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current);
                const file = event.target.files?.[0];
                const nextPreview = file ? URL.createObjectURL(file) : null;
                selectedPreviewRef.current = nextPreview;
                setPreview(nextPreview);
              }} className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]" />
              {preview ? <img src={preview} alt="" className="h-12 w-12 border border-line object-cover" /> : null}
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
            {t("galleryCategory")}
            <select value={category} onChange={(event) => setCategory(event.target.value as GalleryCategoryId)} className="border border-line bg-paper px-3 py-2 text-[0.875rem] text-ink focus:border-ink">
              {categories.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
          {t("galleryCaption")}
          <input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={200} placeholder={t("galleryCaptionPlaceholder")} className="border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink" />
        </label>
        <div><button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>{t("gallerySave")}</button></div>
      </form>
    </div>
  );
}
