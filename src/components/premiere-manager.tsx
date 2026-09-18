"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { PremiereChange } from "@/lib/office-validation";
import type { PhotoSlot } from "@/lib/photo-order";
import { Pending } from "./office/confirm-bar";
import { GarmentPhotos } from "./office/garment-photos";
import { RetireButton, RetiredGroup } from "./office/retired-group";
import { Sheet } from "./office/sheet";
import { Switch } from "./office/switch";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft, type DraftChange } from "./office/use-office-draft";
import { Tag, buttonClass } from "./ui";

export type ManagedPremiere = {
  readonly id: string;
  readonly slug: string;
  /** For the card, in the office viewer's own language. */
  readonly season: string;
  readonly title: string;
  /** What the sheet edits: always Spanish, whatever language the office is in. */
  readonly words: {
    readonly season: string;
    readonly title: string;
    readonly story: string;
    readonly inspiration: string;
  };
  readonly revealDate: string;
  readonly releaseDate: string;
  readonly piecesPlanned: number;
  readonly editionSize: number;
  readonly coverImage: string;
  readonly styleIds: readonly string[];
  /** People on this season's list right now. */
  readonly signups: number;
  readonly retired: boolean;
  readonly undoable: boolean;
};

export type StylePicker = { readonly id: string; readonly label: string; readonly photo?: string };

const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";
const updateKey = (id: string) => `premiere:${id}`;
const stylesKey = (id: string) => `premiere-styles:${id}`;

type UpdateWire = Extract<PremiereChange, { type: "premiere-update" }>;
type StylesWire = Extract<PremiereChange, { type: "premiere-styles" }>;

function formatDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

/** The sheet's editable state: the pending change if there is one, else the saved row. */
type PremiereView = {
  readonly season: string;
  readonly title: string;
  readonly story: string;
  readonly inspiration: string;
  readonly revealDate: string;
  readonly releaseDate: string;
  readonly piecesPlanned: number;
  readonly editionSize: number;
  readonly cover: PhotoSlot;
};

function viewOf(row: ManagedPremiere, pending: DraftChange<PremiereChange> | undefined): PremiereView {
  const wire = pending?.wire.type === "premiere-update" ? pending.wire : undefined;
  const coverSlot = Array.isArray(pending?.meta) ? (pending!.meta as readonly PhotoSlot[])[0] : undefined;
  return {
    season: wire?.season ?? row.words.season,
    title: wire?.title ?? row.words.title,
    story: wire?.story ?? row.words.story,
    inspiration: wire?.inspiration ?? row.words.inspiration,
    revealDate: wire?.revealDate ?? row.revealDate,
    releaseDate: wire?.releaseDate ?? row.releaseDate,
    piecesPlanned: wire?.piecesPlanned ?? row.piecesPlanned,
    editionSize: wire?.editionSize ?? row.editionSize,
    cover: coverSlot ?? { kind: "src", src: wire?.coverImage ?? row.coverImage },
  };
}

/** True when confirming would change nothing, so the entry can leave the draft. */
function unchanged(view: PremiereView, row: ManagedPremiere): boolean {
  return (
    view.season === row.words.season &&
    view.title === row.words.title &&
    view.story === row.words.story &&
    view.inspiration === row.words.inspiration &&
    view.revealDate === row.revealDate &&
    view.releaseDate === row.releaseDate &&
    view.piecesPlanned === row.piecesPlanned &&
    view.editionSize === row.editionSize &&
    view.cover.kind === "src" &&
    view.cover.src === row.coverImage
  );
}

/** One draft change carrying only the fields that changed; the cover, when it did, uploads at confirm. */
function updateChange(row: ManagedPremiere, view: PremiereView): DraftChange<PremiereChange> {
  const key = updateKey(row.id);
  const wire: UpdateWire = {
    type: "premiere-update",
    key,
    premiereId: row.id,
    ...(view.season !== row.words.season ? { season: view.season } : {}),
    ...(view.title !== row.words.title ? { title: view.title } : {}),
    ...(view.story !== row.words.story ? { story: view.story } : {}),
    ...(view.inspiration !== row.words.inspiration ? { inspiration: view.inspiration } : {}),
    ...(view.revealDate !== row.revealDate ? { revealDate: view.revealDate } : {}),
    ...(view.releaseDate !== row.releaseDate ? { releaseDate: view.releaseDate } : {}),
    ...(view.piecesPlanned !== row.piecesPlanned ? { piecesPlanned: view.piecesPlanned } : {}),
    ...(view.editionSize !== row.editionSize ? { editionSize: view.editionSize } : {}),
  };
  if (view.cover.kind === "file") {
    return {
      wire,
      files: [view.cover.file],
      meta: [view.cover],
      withUploads: (srcs) => ({ ...wire, coverImage: srcs[0] ?? "" }),
    };
  }
  return {
    wire: view.cover.src !== row.coverImage ? { ...wire, coverImage: view.cover.src } : wire,
    meta: [view.cover],
  };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** One garment on the checklist: a small thumbnail, its name, the office's own Switch. */
function StyleRow({
  style,
  checked,
  disabled,
  onToggle,
}: {
  style: StylePicker;
  checked: boolean;
  disabled?: boolean;
  onToggle(): void;
}): JSX.Element {
  return (
    <li className="flex items-center gap-3 border-b border-line">
      {style.photo ? (
        <Image src={style.photo} alt="" width={36} height={36} sizes="2.25rem" className="h-9 w-9 shrink-0 object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <Switch label={style.label} checked={checked} disabled={disabled} onChange={onToggle} />
      </div>
    </li>
  );
}

/**
 * One season, everything about it: the cover, the words, the two dates, the
 * two counts, which garments belong to it, retire and undo. The words,
 * dates and counts stage as one premiere-update; the checklist stages its
 * own premiere-styles, since the two are confirmed and undone separately.
 */
function PremiereSheet({
  row,
  styles,
}: {
  row: ManagedPremiere;
  styles: readonly StylePicker[];
}): JSX.Element {
  const t = useTranslations("office");
  const tp = useTranslations("premieres");
  const draft = useOfficeDraft<PremiereChange>();
  const key = updateKey(row.id);
  const entry = draft.pending(key);
  const retiring = entry?.change.wire.type === "retire";
  const view = viewOf(row, entry?.change);

  const styleKey = stylesKey(row.id);
  const stylesEntry = draft.pending(styleKey);
  const styleIds =
    stylesEntry?.change.wire.type === "premiere-styles" ? stylesEntry.change.wire.styleIds : row.styleIds;

  function update(next: PremiereView) {
    if (unchanged(next, row)) draft.unstage(key);
    else draft.stage(key, updateChange(row, next));
  }

  function toggleStyle(id: string) {
    const next = styleIds.includes(id) ? styleIds.filter((candidate) => candidate !== id) : [...styleIds, id];
    if (sameIds(next, row.styleIds)) {
      draft.unstage(styleKey);
    } else {
      const wire: StylesWire = { type: "premiere-styles", key: styleKey, premiereId: row.id, styleIds: next };
      draft.stage(styleKey, { wire });
    }
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

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("premiereCoverTitle")}</h3>
        <GarmentPhotos
          slots={[view.cover]}
          max={1}
          disabled={retiring}
          onChange={(slots) => update({ ...view, cover: slots[0] ?? view.cover })}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[0.9375rem] font-medium">{t("wordsTitle")}</h3>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereSeason")}
          <input
            value={view.season}
            disabled={retiring}
            minLength={2}
            maxLength={40}
            onChange={(event) => update({ ...view, season: event.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereName")}
          <input
            value={view.title}
            disabled={retiring}
            minLength={2}
            maxLength={60}
            onChange={(event) => update({ ...view, title: event.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereStory")}
          <textarea
            value={view.story}
            disabled={retiring}
            minLength={10}
            maxLength={600}
            rows={4}
            onChange={(event) => update({ ...view, story: event.target.value })}
            className={`${field} resize-none`}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereInspiration")}
          <textarea
            value={view.inspiration}
            disabled={retiring}
            maxLength={400}
            rows={3}
            onChange={(event) => update({ ...view, inspiration: event.target.value })}
            className={`${field} resize-none`}
          />
        </label>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("premiereNote")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {tp("revealOn")}
          <input
            type="date"
            value={view.revealDate}
            disabled={retiring}
            onChange={(event) => update({ ...view, revealDate: event.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {tp("releaseOn")}
          <input
            type="date"
            value={view.releaseDate}
            min={view.revealDate}
            disabled={retiring}
            onChange={(event) => update({ ...view, releaseDate: event.target.value })}
            className={field}
          />
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premierePiecesPlanned")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={view.piecesPlanned}
            disabled={retiring}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(parsed)) update({ ...view, piecesPlanned: Math.min(200, Math.max(1, parsed)) });
            }}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereEditionSize")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={view.editionSize}
            disabled={retiring}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(parsed)) update({ ...view, editionSize: Math.min(500, Math.max(1, parsed)) });
            }}
            className={field}
          />
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-medium">{t("premiereGarmentsTitle")}</h3>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("premiereGarmentsNote")}</p>
        <ul className="flex flex-col">
          {styles.map((style) => (
            <StyleRow
              key={style.id}
              style={style}
              checked={styleIds.includes(style.id)}
              disabled={retiring}
              onToggle={() => toggleStyle(style.id)}
            />
          ))}
        </ul>
        {stylesEntry ? (
          <Pending confirming={stylesEntry.confirming} error={stylesEntry.error} count={stylesEntry.count} />
        ) : null}
      </section>

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton
            name={row.title}
            onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })}
          />
          {row.undoable && !entry ? <UndoLink kind="premiere" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A season that does not exist yet: the same fields, empty, in Spanish
 * only. Agregar a los cambios stages one premiere-create with its cover
 * photo and closes; the card list shows it as pending until confirmed.
 */
function NewPremiereSheet({
  styles,
  onDone,
}: {
  styles: readonly StylePicker[];
  onDone(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const tp = useTranslations("premieres");
  const draft = useOfficeDraft<PremiereChange>();
  const [season, setSeason] = useState("");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [inspiration, setInspiration] = useState("");
  const [revealDate, setRevealDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [piecesPlanned, setPiecesPlanned] = useState(6);
  const [editionSize, setEditionSize] = useState(12);
  const [styleIds, setStyleIds] = useState<string[]>([]);
  const [slots, setSlots] = useState<readonly PhotoSlot[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // A cover chosen and then abandoned (the sheet closed without adding) is
  // released here; a staged one belongs to the draft's entry.
  const staged = useRef(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(
    () => () => {
      if (staged.current) return;
      for (const slot of slotsRef.current) if (slot.kind === "file") URL.revokeObjectURL(slot.preview);
    },
    [],
  );

  function updateSlots(next: readonly PhotoSlot[]) {
    const kept = new Set(next.flatMap((slot) => (slot.kind === "file" ? [slot.preview] : [])));
    for (const slot of slots) {
      if (slot.kind === "file" && !kept.has(slot.preview)) URL.revokeObjectURL(slot.preview);
    }
    setSlots(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    const files = slots.flatMap((slot) => (slot.kind === "file" ? [slot.file] : []));
    if (files.length === 0) return setProblem(t("premiereCoverRequired"));
    if (!revealDate || !releaseDate) return setProblem(t("premiereDatesOrder"));
    if (releaseDate < revealDate) return setProblem(t("premiereDatesOrder"));

    const key = `premiere-create:${crypto.randomUUID()}`;
    const wire: PremiereChange = {
      type: "premiere-create",
      key,
      season: season.trim(),
      title: title.trim(),
      story: story.trim(),
      inspiration: inspiration.trim(),
      revealDate,
      releaseDate,
      piecesPlanned,
      editionSize,
      coverImage: "",
      styleIds,
    };
    staged.current = true;
    draft.stage(key, {
      wire,
      files,
      withUploads: (srcs) => ({ ...wire, coverImage: srcs[0] ?? "" }),
      meta: slots,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("premiereAddLead")}</p>

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("premiereCoverTitle")}</h3>
        <GarmentPhotos slots={slots} max={1} onChange={updateSlots} />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[0.9375rem] font-medium">{t("wordsTitle")}</h3>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereSeason")}
          <input
            value={season}
            onChange={(event) => setSeason(event.target.value)}
            minLength={2}
            maxLength={40}
            required
            placeholder={t("premiereSeasonPlaceholder")}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereName")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            placeholder={t("premiereNamePlaceholder")}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereStory")}
          <textarea
            value={story}
            onChange={(event) => setStory(event.target.value)}
            minLength={10}
            maxLength={600}
            required
            rows={4}
            placeholder={t("premiereStoryPlaceholder")}
            className={`${field} resize-none`}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereInspiration")}
          <textarea
            value={inspiration}
            onChange={(event) => setInspiration(event.target.value)}
            maxLength={400}
            rows={3}
            placeholder={t("premiereInspirationPlaceholder")}
            className={`${field} resize-none`}
          />
        </label>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("premiereNote")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {tp("revealOn")}
          <input
            type="date"
            value={revealDate}
            onChange={(event) => setRevealDate(event.target.value)}
            required
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {tp("releaseOn")}
          <input
            type="date"
            value={releaseDate}
            min={revealDate || undefined}
            onChange={(event) => setReleaseDate(event.target.value)}
            required
            className={field}
          />
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premierePiecesPlanned")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={piecesPlanned}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(parsed)) setPiecesPlanned(Math.min(200, Math.max(1, parsed)));
            }}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("premiereEditionSize")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={editionSize}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(parsed)) setEditionSize(Math.min(500, Math.max(1, parsed)));
            }}
            className={field}
          />
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-medium">{t("premiereGarmentsTitle")}</h3>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("premiereGarmentsNote")}</p>
        <ul className="flex flex-col">
          {styles.map((style) => (
            <StyleRow
              key={style.id}
              style={style}
              checked={styleIds.includes(style.id)}
              onToggle={() =>
                setStyleIds(
                  styleIds.includes(style.id)
                    ? styleIds.filter((candidate) => candidate !== style.id)
                    : [...styleIds, style.id],
                )
              }
            />
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("premiereSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}

/** An object URL for a chosen cover lives as long as some pending change still names it. */
function usePreviewCleanup(entries: readonly { readonly change: { readonly meta?: unknown } }[]): void {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const live = new Set<string>();
    for (const entry of entries) {
      if (!Array.isArray(entry.change.meta)) continue;
      for (const slot of entry.change.meta as readonly PhotoSlot[]) {
        if (slot.kind === "file") live.add(slot.preview);
      }
    }
    for (const url of seen.current) if (!live.has(url)) URL.revokeObjectURL(url);
    seen.current = live;
  }, [entries]);
  useEffect(
    () => () => {
      for (const url of seen.current) URL.revokeObjectURL(url);
    },
    [],
  );
}

/**
 * The seasons as cards: cover, title, season, release date, how many pieces
 * and how big the edition, who is on the list. Tap a card for its sheet;
 * the "+" card opens an empty one. Pending seasons sit in the grid until
 * confirm; retired ones move under Retirados.
 */
export function PremiereManager({
  premieres,
  retired,
  styles,
}: {
  premieres: readonly ManagedPremiere[];
  retired: readonly ManagedPremiere[];
  styles: readonly StylePicker[];
}): JSX.Element {
  const t = useTranslations("office");
  const tp = useTranslations("premieres");
  const locale = useLocale() as Locale;
  const draft = useOfficeDraft<PremiereChange>();
  const [open, setOpen] = useState<string | "new" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  usePreviewCleanup(draft.entries);

  const opened = open !== null && open !== "new" ? (premieres.find((row) => row.id === open) ?? null) : null;
  useEffect(() => {
    if (open !== null && open !== "new" && !opened) close();
  }, [open, opened, close]);
  const pendingCreates = draft.entries.filter((entry) => entry.change.wire.type === "premiere-create");

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <button
            type="button"
            onClick={() => setOpen("new")}
            className="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-[0.8125rem] text-ink-soft hover:border-ink"
          >
            <span className="text-3xl leading-none">+</span>
            {t("premiereAdd")}
          </button>
        </li>

        {premieres.length === 0 && pendingCreates.length === 0 ? (
          <li className="col-span-full text-[0.875rem] text-ink-faint">{t("premieresEmpty")}</li>
        ) : null}

        {premieres.map((row) => {
          const key = updateKey(row.id);
          const entry = draft.pending(key);
          const stylesEntry = draft.pending(stylesKey(row.id));
          const retiring = entry?.change.wire.type === "retire";
          const view = viewOf(row, entry?.change);
          const cover = view.cover;
          return (
            <li key={row.id} className={`flex flex-col gap-2 ${retiring ? "opacity-50" : ""}`}>
              <button type="button" onClick={() => setOpen(row.id)} className="flex flex-col gap-2 text-left">
                <span className="relative block aspect-3/4 w-full overflow-hidden bg-paper-warm">
                  {cover.kind === "src" ? (
                    <Image src={cover.src} alt="" fill sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                  ) : (
                    <Image src={cover.preview} alt="" fill unoptimized sizes="14rem" className="object-cover" />
                  )}
                </span>
                <span className="font-display text-[1.0625rem] leading-tight">{row.title}</span>
                <span className="text-[0.75rem] uppercase tracking-[0.14em] text-ink-faint">
                  {row.season} · {formatDay(view.releaseDate, locale)}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Tag>{tp("pieces", { count: view.piecesPlanned })}</Tag>
                  <Tag tone="outline">{tp("edition", { count: view.editionSize })}</Tag>
                </span>
                <span className="text-[0.75rem] text-ink-faint">{t("premiereSignups", { count: row.signups })}</span>
              </button>
              {entry ? <Pending confirming={entry.confirming} error={entry.error} count={entry.count} /> : null}
              {stylesEntry ? (
                <Pending confirming={stylesEntry.confirming} error={stylesEntry.error} count={stylesEntry.count} />
              ) : null}
            </li>
          );
        })}

        {pendingCreates.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "premiere-create") return null;
          const first = Array.isArray(entry.change.meta) ? (entry.change.meta as readonly PhotoSlot[])[0] : undefined;
          return (
            <li key={entry.key} className="flex flex-col gap-2">
              <span className="relative block aspect-3/4 w-full overflow-hidden bg-paper-warm">
                {first?.kind === "file" ? <Image src={first.preview} alt="" fill unoptimized sizes="14rem" className="object-cover" /> : null}
              </span>
              <span className="font-display text-[1.0625rem] leading-tight">{wire.title}</span>
              <span className="flex items-center gap-3">
                <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />
                <button type="button" onClick={() => draft.unstage(entry.key)} className="text-xs underline underline-offset-4">
                  {t("dropChanges")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <RetiredGroup
        items={retired.map((row) => ({ id: row.id, name: row.title, photo: row.coverImage }))}
        restoreKey={updateKey}
        onRestore={(id) => {
          const key = updateKey(id);
          draft.stage(key, { wire: { type: "restore", key, id } });
        }}
      />

      <Sheet open={open !== null} title={open === "new" ? t("newPremiereTitle") : (opened?.title ?? "")} onClose={close}>
        {open === "new" ? (
          <NewPremiereSheet styles={styles} onDone={close} />
        ) : opened ? (
          <PremiereSheet row={opened} styles={styles} />
        ) : null}
      </Sheet>
    </div>
  );
}
