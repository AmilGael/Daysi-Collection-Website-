"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { GallerySectionOption, ManagedWork } from "@/components/gallery-cards";
import { buttonClass, Tag } from "@/components/ui";
import type { GalleryChange } from "@/lib/office-validation";
import { sectionId } from "@/lib/slugify";
import { ErrorText, Pending } from "./confirm-bar";
import { readImageSize } from "./image-reads";
import { RetireButton } from "./retired-group";
import { Switch } from "./switch";
import { TextFields } from "./text-fields";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

/** Selected in "Dónde va" to reveal the text box for a section Daysi names herself. */
const OTHER = "__other";
const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

/**
 * One photo already in the gallery: its picture, its caption in both
 * languages, the section it was filed under (read here, not changed — she
 * names a section only when she adds a photo), whether it shows on the
 * site, and Retirar. Every control stages into the one `gallery:<id>`
 * change (or a text change), read back from the draft, so closing and
 * reopening the sheet shows exactly what is pending.
 */
export function GalleryWorkSheet({
  row,
  sectionLabel,
  undoableTexts,
}: {
  row: ManagedWork;
  sectionLabel: string;
  undoableTexts: ReadonlySet<string>;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<GalleryChange>();
  const key = `gallery:${row.id}`;
  const entry = draft.pending(key);
  const retiring = entry?.change.wire.type === "retire";
  const hidden = entry?.change.wire.type === "work-visibility" ? entry.change.wire.hidden : row.hidden;

  function stageVisibility(nextHidden: boolean) {
    if (nextHidden === row.hidden) draft.unstage(key);
    else draft.stage(key, { wire: { type: "work-visibility", key, id: row.id, hidden: nextHidden } });
  }

  return (
    <div className={`flex flex-col gap-8 ${retiring ? "opacity-50" : ""}`}>
      {entry ? (
        <span className="flex items-center gap-3">
          <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
          <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
            {t("dropChanges")}
          </button>
        </span>
      ) : null}

      <span className={`relative block aspect-3/4 w-full overflow-hidden border border-line transition-opacity ${hidden ? "opacity-30" : ""}`}>
        <Image src={row.src} alt="" fill sizes="(min-width: 640px) 26rem, 90vw" className="object-cover" />
      </span>

      <TextFields
        subject="gallery"
        id={row.id}
        undoable={undoableTexts}
        fields={[{
          field: "caption",
          label: t("textsCaption"),
          es: row.texts.caption.es,
          en: row.texts.caption.en,
          codedEs: row.codedTexts.caption.es,
          codedEn: row.codedTexts.caption.en,
          multiline: true,
        }]}
      />

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("galleryCategory")}
          <span><Tag>{sectionLabel}</Tag></span>
        </div>
        <Switch label={t("workShownOnSite")} checked={!hidden} disabled={retiring} onChange={(on) => stageVisibility(!on)} />
      </section>

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton name={row.caption || row.id} onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })} />
          {row.undoable && !entry ? <UndoLink kind="work-visibility" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A photo that does not exist yet: pick it, choose where it goes (or name a
 * new section through "Otra…") and write one line about it. Agregarla a
 * los cambios stages one work-add with its file and closes; the grid shows
 * it as pending until she confirms.
 */
export function NewWorkSheet({
  categories,
  onDone,
}: {
  categories: readonly GallerySectionOption[];
  onDone(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<GalleryChange>();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const staged = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [captionEs, setCaptionEs] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [captionTouched, setCaptionTouched] = useState(false);
  const [category, setCategory] = useState<string>(categories[0]?.id ?? OTHER);
  const [sectionName, setSectionName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // The preview belongs to this sheet until it stages; once staged, it lives
  // on in the draft entry's `meta`, so unmounting on close must not revoke it.
  useEffect(
    () => () => {
      if (!staged.current && previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

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

  // The picker followed a section she just named into "Otra…" (see `submit`
  // below); if that pending section then drops out from under it — its one
  // photo removed, or the whole draft discarded — the picker is left
  // pointing at an id no option carries any more. Back to the first live
  // section, same as the picker starts on.
  useEffect(() => {
    if (category === OTHER) return;
    if (options.some((option) => option.id === category)) return;
    setCategory(categories[0]?.id ?? OTHER);
  }, [options, categories, category]);

  async function submit(event: FormEvent<HTMLFormElement>) {
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
    staged.current = true;
    draft.stage(key, { wire, files: [file], withUploads: ([src]) => ({ ...wire, src: src ?? "" }), meta: preview ?? undefined });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("galleryPhoto")}</h3>
        <span className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(event) => {
              if (previewRef.current) URL.revokeObjectURL(previewRef.current);
              const file = event.target.files?.[0];
              const next = file ? URL.createObjectURL(file) : null;
              previewRef.current = next;
              setPreview(next);
            }}
            className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]"
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-12 w-12 border border-line object-cover" />
          ) : null}
        </span>
      </section>

      <section className="flex flex-col gap-4">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("galleryCategory")}
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={field}>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            <option value={OTHER}>{t("galleryOtherSection")}</option>
          </select>
        </label>
        {category === OTHER ? (
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("gallerySectionName")}
            <input
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              maxLength={40}
              placeholder={t("gallerySectionNamePlaceholder")}
              className={field}
            />
          </label>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[0.9375rem] font-medium">{t("galleryCaption")}</h3>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("textsSpanish")}
          <input value={captionEs} onChange={(event) => changeCaptionEs(event.target.value)} maxLength={200} placeholder={t("galleryCaptionPlaceholder")} className={field} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("textsEnglish")}
          <input value={captionEn} onChange={(event) => { setCaptionTouched(true); setCaptionEn(event.target.value); }} maxLength={200} placeholder={t("galleryCaptionPlaceholder")} className={field} />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>{t("gallerySave")}</button>
        {formError ? <span role="alert" className="text-[0.8125rem] text-ink"><ErrorText code={formError} /></span> : null}
      </div>
    </form>
  );
}
