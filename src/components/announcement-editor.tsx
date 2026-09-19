"use client";

import { useCallback, useState, type FormEvent, type JSX } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate } from "@/content";
import type { Locale } from "@/i18n/routing";
import type { Announcement } from "@/lib/announcements";
import { ANNOUNCEMENT_PAGES, type AnnouncementPageId, type AnnouncementReach } from "@/lib/announcement-pages";
import type { ShopfrontChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { RetireButton, RetiredGroup } from "./office/retired-group";
import { announcementKeyFor, announcementWireOf, type ManagedAnnouncement } from "./office/shopfront-draft";
import { Switch } from "./office/switch";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";
import { buttonClass } from "./ui";

const MOST_CHARACTERS = 200;
const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

type AnnouncementWire = Extract<ShopfrontChange, { type: "announcement" }>;
type Editing = { readonly mode: "new" } | { readonly mode: "edit"; readonly announcement: ManagedAnnouncement };

/**
 * Vitrina's announcements, as a list like the promotions: each one's words,
 * the pages it shows on, its switch, and Editar / Retirar. "+ Agregar un
 * anuncio" and Editar open the same form in place of the list. Everything
 * stages into the tab's draft; nothing is on the site until Confirmar.
 */
export function AnnouncementEditor({
  announcements,
  retired,
}: {
  announcements: readonly ManagedAnnouncement[];
  retired: readonly Announcement[];
}): JSX.Element {
  const t = useTranslations("office");
  const locale = useLocale() as Locale;
  const draft = useOfficeDraft<ShopfrontChange>();
  const [editing, setEditing] = useState<Editing | null>(null);
  const backToList = useCallback(() => setEditing(null), []);

  const pagesLabel = (pages: AnnouncementReach): string =>
    pages === "all" ? t("annAllPages") : pages.map((page) => t(`annPage.${page}`)).join(", ");

  // Added in this draft, not on the list until she confirms.
  const pendingAdds = draft.entries.flatMap((entry) =>
    entry.change.wire.type === "announcement" && entry.change.wire.id === undefined
      ? [{ key: entry.key, wire: entry.change.wire }]
      : [],
  );

  if (editing) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <button type="button" onClick={backToList} className="w-fit text-[0.8125rem] underline underline-offset-4">
          {t("annBack")}
        </button>
        <AnnouncementForm
          announcement={editing.mode === "edit" ? editing.announcement : null}
          staged={
            editing.mode === "edit"
              ? (() => {
                  const wire = draft.pending(announcementKeyFor(editing.announcement.id))?.change.wire;
                  return wire?.type === "announcement" ? wire : null;
                })()
              : null
          }
          onDone={backToList}
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("annLead")}</p>
      <ul className="flex flex-col border-t border-line">
        {announcements.length === 0 && pendingAdds.length === 0 ? (
          <li className="border-b border-line py-4 text-[0.875rem] text-ink-faint">{t("annEmpty")}</li>
        ) : null}
        {announcements.map((announcement) => {
          const key = announcementKeyFor(announcement.id);
          const pending = draft.pending(key);
          const wire = pending?.change.wire;
          const retiring = wire?.type === "retire";
          const staged = wire?.type === "announcement" ? wire : null;
          const visible = staged ? staged.visible : announcement.visible;
          return (
            <li key={announcement.id} className={`flex flex-col gap-3 border-b border-line py-4 ${retiring ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-[0.9375rem] leading-relaxed">{staged ? staged.message : translate(announcement.message, locale)}</p>
                  <p className="text-[0.75rem] text-ink-faint">{pagesLabel(staged ? staged.pages : announcement.pages)}</p>
                </div>
                <div className="w-28 shrink-0">
                  <Switch
                    checked={visible}
                    disabled={retiring}
                    label={t("annVisible")}
                    onChange={(next) => {
                      const nextWire = announcementWireOf(announcement, { ...(staged ?? {}), visible: next });
                      if (sameAsSaved(nextWire, announcement)) draft.unstage(key);
                      else draft.stage(key, { wire: nextWire });
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {pending ? (
                  <>
                    <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                    <button type="button" onClick={() => draft.unstage(key)} className="underline underline-offset-4">
                      {t("removePending")}
                    </button>
                  </>
                ) : null}
                {!retiring ? (
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", announcement })}
                    className="underline underline-offset-4"
                  >
                    {t("annEdit")}
                  </button>
                ) : null}
                {!pending ? (
                  <>
                    <RetireButton
                      name={translate(announcement.message, locale)}
                      onConfirm={() =>
                        draft.stage(key, { wire: { type: "retire", key, id: announcement.id, kind: "announcement" } })
                      }
                    />
                    {announcement.undoable ? <UndoLink kind="announcement" id={announcement.id} /> : null}
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
        {pendingAdds.map(({ key, wire }) => {
          const pending = draft.pending(key);
          return (
            <li key={key} className="flex flex-col gap-2 border-b border-line py-4">
              <p className="text-[0.9375rem] leading-relaxed">{wire.message}</p>
              <p className="text-[0.75rem] text-ink-faint">{pagesLabel(wire.pages)}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <Pending confirming={pending?.confirming} error={pending?.error} count={pending?.count} />
                <button type="button" onClick={() => draft.unstage(key)} className="underline underline-offset-4">
                  {t("removePending")}
                </button>
              </div>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setEditing({ mode: "new" })}
            className="flex min-h-12 w-full items-center gap-3 border-b border-dashed border-line-strong py-3 text-left text-[0.875rem] text-ink-soft hover:text-ink"
          >
            <span aria-hidden className="text-xl leading-none">+</span>
            {t("annAdd")}
          </button>
        </li>
      </ul>

      <RetiredGroup
        items={retired.map((announcement) => ({ id: announcement.id, name: translate(announcement.message, locale) }))}
        restoreKey={announcementKeyFor}
        onRestore={(id) =>
          draft.stage(announcementKeyFor(id), {
            wire: { type: "restore", key: announcementKeyFor(id), id, kind: "announcement" },
          })
        }
      />
    </div>
  );
}

function sameAsSaved(wire: AnnouncementWire, saved: Announcement): boolean {
  const pages = (reach: AnnouncementReach) => (reach === "all" ? "all" : [...reach].sort().join(","));
  return wire.message === saved.message.es && wire.visible === saved.visible && pages(wire.pages) === pages(saved.pages);
}

/**
 * One announcement's words, its pages and its switch. New ones start on,
 * on every page, since that is what "put up an announcement" usually means;
 * turning "Todas las páginas" off shows the pages to pick from.
 */
function AnnouncementForm({
  announcement,
  staged,
  onDone,
}: {
  announcement: Announcement | null;
  /** Her unconfirmed edit of this one, which the form opens on rather than the saved words. */
  staged: AnnouncementWire | null;
  onDone(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<ShopfrontChange>();
  const start = staged ?? (announcement ? announcementWireOf(announcement) : null);
  const [message, setMessage] = useState(start?.message ?? "");
  const [everyPage, setEveryPage] = useState(start ? start.pages === "all" : true);
  const [pages, setPages] = useState<readonly AnnouncementPageId[]>(
    start && start.pages !== "all" ? start.pages : [],
  );
  const [visible, setVisible] = useState(start?.visible ?? true);
  const [problem, setProblem] = useState<string | null>(null);

  function toggle(page: AnnouncementPageId) {
    setPages((current) => (current.includes(page) ? current.filter((id) => id !== page) : [...current, page]));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    const words = message.trim();
    if (words.length === 0) return setProblem(t("annMessageRequired"));
    if (!everyPage && pages.length === 0) return setProblem(t("annPagesRequired"));

    // Kept in the list's own order, whatever order she ticked them in.
    const reach: AnnouncementReach = everyPage
      ? "all"
      : ANNOUNCEMENT_PAGES.map((page) => page.id).filter((id) => pages.includes(id));

    if (announcement) {
      const key = announcementKeyFor(announcement.id);
      const wire = announcementWireOf(announcement, { message: words, pages: reach, visible });
      if (sameAsSaved(wire, announcement)) draft.unstage(key);
      else draft.stage(key, { wire });
    } else {
      const key = announcementKeyFor(`new-${crypto.randomUUID()}`);
      draft.stage(key, {
        wire: { type: "announcement", key, message: words, pages: reach === "all" ? "all" : [...reach], visible },
      });
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("annFormLead")}</p>

      <label className="grid gap-1 text-[0.75rem] text-ink-faint">
        {t("annMessage")}
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          maxLength={MOST_CHARACTERS}
          placeholder={t("annPlaceholder")}
          className={`${field} resize-none leading-relaxed`}
        />
        <span className="justify-self-end tabular-nums">
          {message.length}/{MOST_CHARACTERS}
        </span>
      </label>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-[0.75rem] text-ink-faint">{t("annWhere")}</legend>
        <Switch checked={everyPage} onChange={setEveryPage} label={t("annAllPages")} />
        {everyPage ? null : (
          <div className="flex flex-wrap gap-2">
            {ANNOUNCEMENT_PAGES.map((page) => {
              const on = pages.includes(page.id);
              return (
                <button
                  key={page.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(page.id)}
                  className={`min-h-11 rounded-[2px] border px-4 text-[0.875rem] transition-colors ${
                    on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"
                  }`}
                >
                  {t(`annPage.${page.id}`)}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <Switch checked={visible} onChange={setVisible} label={t("annVisible")} />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("serviceSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}
