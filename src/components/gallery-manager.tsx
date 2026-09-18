"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { GalleryChange } from "@/lib/office-validation";
import { sectionId } from "@/lib/slugify";
import { ErrorText, Pending } from "./office/confirm-bar";
import { readImageSize } from "./office/image-reads";
import { RetiredGroup, RetireButton } from "./office/retired-group";
import { TextFields } from "./office/text-fields";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";
import { buttonClass } from "./ui";

/** Selected in "Dónde va" to reveal the text box for a section Daysi names herself. */
const OTHER = "__other";

export type ManagedWork = {
  readonly id: string;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly category: string;
  readonly caption: string;
  readonly texts: {
    readonly caption: { readonly es: string; readonly en: string };
  };
  readonly codedTexts: ManagedWork["texts"];
  readonly hidden: boolean;
  readonly retired: boolean;
  readonly undoable: boolean;
};

/** One option in "Dónde va": the six coded sections, plus whatever Daysi has added. */
export type GallerySectionOption = { readonly id: string; readonly label: string; readonly coded: boolean };
export type RetiredSection = { readonly id: string; readonly name: string };

export function GalleryManager({ works, retired, categories, retiredSections, undoableTexts }: {
  works: readonly ManagedWork[];
  retired: readonly ManagedWork[];
  categories: readonly GallerySectionOption[];
  retiredSections: readonly RetiredSection[];
  undoableTexts: ReadonlySet<string>;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<GalleryChange>();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<Record<string, string>>({});
  const selectedPreviewRef = useRef<string | null>(null);
  const [captionEs, setCaptionEs] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [captionTouched, setCaptionTouched] = useState(false);
  const [category, setCategory] = useState<string>(categories[0]?.id ?? OTHER);
  const [sectionName, setSectionName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

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

  function changeCaptionEs(value: string) {
    setCaptionEs(value);
    if (!captionTouched) setCaptionEn(value);
  }

  // A section she is naming in this same draft, staged but not yet confirmed:
  // shown as a normal option so a second photo can join it without typing
  // "Otra…" again, which would only stage a second, redundant section-add
  // the server refuses as section-exists.
  const pendingSections = draft.entries.flatMap((entry) => {
    const wire = entry.change.wire;
    return wire.type === "section-add" ? [{ id: sectionId(wire.name), label: wire.name }] : [];
  });
  const options = [...categories, ...pendingSections];
  const addedSections = categories.filter((section) => !section.coded);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (category === OTHER && sectionName.trim().length < 2) {
      setFormError("section-name-required");
      return;
    }
    const size = await readImageSize(file);
    if (!size) {
      setFormError("upload-failed");
      return;
    }
    setFormError(null);

    let categoryId = category;
    if (category === OTHER) {
      const name = sectionName.trim();
      categoryId = sectionId(name);
      const sectionKey = `section-add:${categoryId}`;
      if (!draft.pending(sectionKey)) {
        draft.stage(sectionKey, { wire: { type: "section-add", key: sectionKey, name } });
      }
    }

    const key = `work-add:${crypto.randomUUID()}`;
    const wire: GalleryChange = {
      type: "work-add", key, src: "", width: size.width, height: size.height,
      category: categoryId, caption: { es: captionEs.trim(), en: captionEn.trim() },
    };
    const objectUrl = preview ?? URL.createObjectURL(file);
    selectedPreviewRef.current = null;
    setPendingPreviews((current) => ({ ...current, [key]: objectUrl }));
    draft.stage(key, { wire, files: [file], withUploads: ([src]) => ({ ...wire, src: src ?? "" }) });
    setCaptionEs("");
    setCaptionEn("");
    setCaptionTouched(false);
    setPreview(null);
    setSectionName("");
    // Stay on the section she just used: it is now a normal option (either
    // already in `categories`, or offered through `pendingSections` above),
    // ready for another photo without typing "Otra…" a second time.
    setCategory(categoryId);
    if (fileRef.current) fileRef.current.value = "";
  }

  const pendingAdds = draft.entries.filter((entry) => entry.change.wire.type === "work-add");

  // Removing the photo that named a new section should take the section
  // with it, unless another pending photo still carries the same category —
  // otherwise confirming would leave behind a section with nothing filed
  // under it.
  function removePendingWork(entryKey: string, category: string) {
    draft.unstage(entryKey);
    const stillNamed = pendingAdds.some(
      (other) => other.key !== entryKey && other.change.wire.type === "work-add" && other.change.wire.category === category,
    );
    if (stillNamed) return;
    const section = draft.entries.find(
      (candidate) => candidate.change.wire.type === "section-add" && sectionId(candidate.change.wire.name) === category,
    );
    if (section) draft.unstage(section.key);
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-4">
        {works.map((work) => {
          const key = `gallery:${work.id}`;
          const entry = draft.pending(key);
          const hidden = entry?.change.wire.type === "work-visibility" ? entry.change.wire.hidden : work.hidden;
          const retiring = entry?.change.wire.type === "retire";
          return (
            <li key={work.id} className={`grid gap-4 border-b border-line pb-4 sm:grid-cols-[10rem_minmax(0,1fr)] ${retiring ? "opacity-50" : ""}`}>
              <div className="flex flex-col gap-1.5">
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
                {!retiring ? <span className="flex items-center gap-2">
                  <RetireButton name={work.caption || work.id} onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: work.id } })} />
                  {work.undoable && !entry ? <UndoLink kind="work-visibility" id={work.id} /> : null}
                </span> : null}
              </div>
              <TextFields
                subject="gallery"
                id={work.id}
                undoable={undoableTexts}
                fields={[{
                  field: "caption",
                  label: t("textsCaption"),
                  es: work.texts.caption.es,
                  en: work.texts.caption.en,
                  codedEs: work.codedTexts.caption.es,
                  codedEn: work.codedTexts.caption.en,
                  multiline: true,
                }]}
              />
            </li>
          );
        })}
        {pendingAdds.length > 0 ? (
          <li>
            {/* Their own grid: the list is a column of full-width rows now, and
                a not-yet-confirmed photo is a thumbnail, not a row. */}
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
              {pendingAdds.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "work-add") return null;
          const src = pendingPreviews[entry.key];
          return <li key={entry.key} className="flex flex-col gap-1.5">
            <span className="relative block aspect-3/4 overflow-hidden border border-line">
              {src ? <Image src={src} alt="" fill unoptimized sizes="10rem" className="object-cover" /> : null}
            </span>
            <p className="truncate text-[0.6875rem] text-ink-faint">{wire.caption.es}</p>
            <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
            <button type="button" onClick={() => removePendingWork(entry.key, wire.category)} className="text-left text-xs underline underline-offset-4">{t("removePending")}</button>
          </li>;
              })}
            </ul>
          </li>
        ) : null}
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
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="border border-line bg-paper px-3 py-2 text-[0.875rem] text-ink focus:border-ink">
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              <option value={OTHER}>{t("galleryOtherSection")}</option>
            </select>
          </label>
          {category === OTHER ? (
            <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
              {t("gallerySectionName")}
              <input
                value={sectionName}
                onChange={(event) => setSectionName(event.target.value)}
                maxLength={40}
                placeholder={t("gallerySectionNamePlaceholder")}
                className="border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink"
              />
            </label>
          ) : null}
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-[0.75rem] text-ink-faint">{t("galleryCaption")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[0.75rem] text-ink-faint">
              {t("textsSpanish")}
              <input value={captionEs} onChange={(event) => changeCaptionEs(event.target.value)} maxLength={200} placeholder={t("galleryCaptionPlaceholder")} className="border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink" />
            </label>
            <label className="grid gap-1 text-[0.75rem] text-ink-faint">
              {t("textsEnglish")}
              <input value={captionEn} onChange={(event) => { setCaptionTouched(true); setCaptionEn(event.target.value); }} maxLength={200} placeholder={t("galleryCaptionPlaceholder")} className="border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink" />
            </label>
          </div>
        </fieldset>
        <div><button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>{t("gallerySave")}</button></div>
        {formError ? <p role="alert" className="text-[0.8125rem] text-ink"><ErrorText code={formError} /></p> : null}
      </form>

      {addedSections.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <p className="text-[0.9375rem] font-medium">{t("gallerySections")}</p>
          <ul className="divide-y divide-line">
            {addedSections.map((section) => {
              const key = `section:${section.id}`;
              const entry = draft.pending(key);
              const retiring = entry?.change.wire.type === "section-retire";
              return (
                <li key={section.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className={`text-sm ${retiring ? "opacity-50" : ""}`}>{section.label}</span>
                  {entry ? (
                    <span className="flex items-center gap-2">
                      <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
                      <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">{t("removePending")}</button>
                    </span>
                  ) : (
                    <RetireButton
                      name={section.label}
                      onConfirm={() => draft.stage(key, { wire: { type: "section-retire", key, id: section.id } })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <RetiredGroup
        items={retiredSections.map((section) => ({ id: section.id, name: section.name }))}
        restoreKey={(id) => `section:${id}`}
        onRestore={(id) => { const key = `section:${id}`; draft.stage(key, { wire: { type: "section-restore", key, id } }); }}
      />
    </div>
  );
}
