import {
  alterationServices,
  appointmentTypes,
  premieres,
  priceList,
  styles,
  type Premiere,
  type Promotion,
} from "@/content";
import { CLIENT_CARDS, type ClientCard } from "./client-cards";
import type { OfficeChange, UndoKind } from "./office-validation";
import {
  addedStyles,
  assembleStyles,
  type SizeStock,
  type StyleOverride,
} from "./live-catalog";
import { manageableGallery, type GalleryVisibility } from "./live-gallery";
import { addedPremieres, assemblePremieres, type PremiereOverride } from "./live-premieres";
import {
  addedAlterations,
  addedAppointmentTypes,
  assemblePriceList,
  customEntries,
  customFabrics,
  entriesFromCustom,
  type AlterationOverride,
  type AppointmentOverride,
  type PriceEntryOverride,
} from "./live-pricing";
import { textKey, type TextField, type TextOverride, type TextSubject } from "./live-text";
import { readRecords, versionsOf } from "./records";
import { REQUEST_KINDS, listRequests, requestVersions, type StoredRequest } from "./request-store";
import type { HelperVisibility } from "./site-helper";
import type { Announcement } from "./announcements";

type Stream<R> = {
  readonly all: () => R[];
  readonly key: (record: R) => string;
  readonly versions: (id: string) => R[];
  readonly baseline: (id: string) => OfficeChange | undefined;
  readonly toChange: (record: R, id: string) => OfficeChange | undefined;
  readonly undoable?: (latest: R) => boolean;
};

function erased<R>(source: Stream<R>): Stream<unknown> {
  return {
    all: source.all,
    key: (record) => source.key(record as R),
    versions: source.versions,
    baseline: source.baseline,
    toChange: (record, id) => source.toChange(record as R, id),
    undoable: source.undoable ? (record) => source.undoable!(record as R) : undefined,
  };
}

function recordStream<R>(
  collection: string,
  key: (record: R) => string,
  baseline: (id: string) => OfficeChange | undefined,
  toChange: (record: R, id: string) => OfficeChange | undefined,
): Stream<R> {
  return {
    all: () => readRecords<R>(collection),
    key,
    versions: (id) => versionsOf(collection, key, id),
    baseline,
    toChange,
  };
}

/**
 * Records written before the photo list existed only ever added photos, so
 * an undo of one of those never takes a photo away. A record with a `photos`
 * list is the whole truth and is restored as it was.
 */
function newestPhotos(id: string): readonly string[] | undefined {
  return versionsOf<StyleOverride>("style-overrides", (record) => record.styleId, id).at(-1)?.addedPhotos;
}

const styleOverride = recordStream<StyleOverride>(
  "style-overrides",
  (record) => record.styleId,
  (id) => {
    const style = assembleStyles(styles, addedStyles(), []).find((candidate) => candidate.id === id);
    if (!style) return undefined;
    const photos = newestPhotos(id);
    return {
      type: "style-override",
      key: `style:${id}`,
      styleId: id,
      isPublished: style.isPublished,
      stock: Object.fromEntries(
        style.sizes.map((size) => [size.sizeId, size.inStock]),
      ) as SizeStock,
      ...(photos && photos.length > 0 ? { addedPhotos: [...photos] } : {}),
    };
  },
  (record, id) => {
    const legacy = record.photos ? undefined : (newestPhotos(id) ?? record.addedPhotos);
    return {
      type: "style-override",
      key: `style:${id}`,
      styleId: id,
      isPublished: record.isPublished,
      stock: record.stock,
      // A count comes back with the moment it was taken, so every sale since
      // is still taken off it.
      ...(record.countedAt ? { countedAt: { ...record.countedAt } } : {}),
      ...(record.photos ? { photos: [...record.photos] } : {}),
      ...(legacy === undefined ? {} : { addedPhotos: [...legacy] }),
      ...(record.coverSrc === undefined || record.photos ? {} : { coverSrc: record.coverSrc }),
      ...(record.inStudio === undefined ? {} : { inStudio: record.inStudio }),
      // The line is the whole truth about an own price, so a line without
      // one comes back without one, which the merge reads as the list price.
      ...(record.fixedPrice === undefined ? {} : { fixedPrice: record.fixedPrice }),
      ...(record.fixedPrice === undefined || record.customizationExtra === undefined
        ? {}
        : { customizationExtra: record.customizationExtra }),
    };
  },
);

const workVisibility = recordStream<GalleryVisibility>(
  "gallery-visibility",
  (record) => record.id,
  (id) => manageableGallery().some((work) => work.id === id)
    ? { type: "work-visibility", key: `gallery:${id}`, id, hidden: false }
    : undefined,
  (record, id) => ({
    type: "work-visibility",
    key: `gallery:${id}`,
    id,
    hidden: record.hidden,
  }),
);

const priceEntry = recordStream<PriceEntryOverride>(
  "price-overrides",
  (record) => record.entryId,
  (id) => {
    const entry = assemblePriceList(
      priceList,
      customFabrics().flatMap(entriesFromCustom),
      customEntries(),
      [],
    ).find((candidate) => candidate.id === id);
    return entry ? {
      type: "entry",
      key: `entry:${id}`,
      id,
      fixedPrice: entry.fixedPrice,
      customizationExtra: entry.customizationExtra,
    } : undefined;
  },
  (record, id) => ({
    type: "entry",
    key: `entry:${id}`,
    id,
    fixedPrice: record.fixedPrice,
    customizationExtra: record.customizationExtra,
  }),
);

const alteration = recordStream<AlterationOverride>(
  "alteration-overrides",
  (record) => record.alterationId,
  (id) => {
    // An alteration she added comes back to the price she added it at.
    const item = [...alterationServices, ...addedAlterations()].find((candidate) => candidate.id === id);
    return item ? {
      type: "alteration",
      key: `alteration:${id}`,
      id,
      fixedPrice: item.fixedPrice,
      rushSurcharge: item.rushSurcharge,
    } : undefined;
  },
  (record, id) => ({
    type: "alteration",
    key: `alteration:${id}`,
    id,
    fixedPrice: record.fixedPrice,
    rushSurcharge: record.rushSurcharge,
  }),
);

const appointment = recordStream<AppointmentOverride>(
  "appointment-overrides",
  (record) => record.typeId,
  (id) => {
    const item = [...appointmentTypes, ...addedAppointmentTypes()].find((candidate) => candidate.id === id);
    return item ? { type: "appointment", key: `appointment:${id}`, id, fee: item.fee } : undefined;
  },
  (record, id) => ({ type: "appointment", key: `appointment:${id}`, id, fee: record.fee }),
);

/**
 * No baseline: an announcement did not exist before its first save, and a
 * new one is taken back by retiring it. The old single notice read as "site"
 * (see announcements.ts) has no line here until Daysi saves it, so there is
 * nothing to undo on it before then either.
 */
const announcement = recordStream<Announcement>(
  "announcements",
  (record) => record.id,
  () => undefined,
  (record, id) => ({
    type: "announcement",
    key: `announcement:${id}`,
    id,
    message: record.message.es,
    pages: record.pages === "all" ? "all" : [...record.pages],
    visible: record.visible,
  }),
);

/** Never set at all means shown, so that is the baseline an undo returns to. */
const helperSwitch = recordStream<HelperVisibility>(
  "helper-visibility",
  () => "site",
  () => ({ type: "helper", key: "helper:site", visible: true }),
  (record) => ({ type: "helper", key: "helper:site", visible: record.visible }),
);

/**
 * No baseline: a promotion did not exist before its first line, and a new
 * one is taken back by retiring it. Each line after that (a switch turned
 * off, then on) is undone to the one before it, in Spanish as she typed it;
 * the action keeps that line's English.
 */
const promotion = recordStream<Promotion>(
  "promotions",
  (record) => record.id,
  () => undefined,
  (record, id) => ({
    type: "promotion",
    key: `promotion:${id}`,
    id,
    label: record.label.es,
    kind: record.kind,
    value: record.value,
    scope: record.scope,
    ...(record.startsAt === undefined ? {} : { startsAt: record.startsAt }),
    ...(record.endsAt === undefined ? {} : { endsAt: record.endsAt }),
    active: record.active,
  }),
);

/**
 * A premiere's own words, dates, numbers, cover and style checklist,
 * together. Because the office action forward-merges every save onto the
 * season's current override (`previousOverrideFields`), each saved record
 * is a *running total*: it carries every field any earlier save on this
 * premiere ever touched, not merely the field that one save changed. What
 * a record can still be missing is a field no save had touched *yet* at
 * that point in the premiere's history — one a later save is the first to
 * introduce. So `toChange`/`baseline` cannot return a record as-is: each
 * rebuilds the *whole* snapshot instead, taking the season as seeded or
 * added and overlaying only the fields that one particular record (or, for
 * `baseline`, no record at all) itself carries. Undoing to that snapshot
 * then correctly puts back a field a later save was the first to touch
 * (the checklist, say, when an earlier record predates it) as the seed,
 * rather than leaving it at whatever the newest save happens to carry
 * forward.
 */
function premiereSnapshot(
  id: string,
  seeded: Premiere,
  override: Partial<Omit<PremiereOverride, "premiereId" | "updatedAt">>,
): OfficeChange {
  return {
    type: "premiere-update",
    key: `premiere:${id}`,
    premiereId: id,
    season: (override.season ?? seeded.season).es,
    title: (override.title ?? seeded.title).es,
    story: (override.story ?? seeded.story).es,
    inspiration: (override.inspiration ?? seeded.inspiration).es,
    revealDate: override.revealDate ?? seeded.revealDate,
    releaseDate: override.releaseDate ?? seeded.releaseDate,
    piecesPlanned: override.piecesPlanned ?? seeded.piecesPlanned,
    editionSize: override.editionSize ?? seeded.editionSize,
    coverImage: override.coverImage ?? seeded.coverImage,
    styleIds: [...(override.styleIds ?? seeded.styleIds)],
  };
}

function seededPremiere(id: string): Premiere | undefined {
  return assemblePremieres(premieres, addedPremieres(), []).find((candidate) => candidate.id === id);
}

const premiere = recordStream<PremiereOverride>(
  "premiere-overrides",
  (record) => record.premiereId,
  (id) => {
    const seeded = seededPremiere(id);
    return seeded ? premiereSnapshot(id, seeded, {}) : undefined;
  },
  (record, id) => {
    // A saved override normally means the premiere still exists — but a
    // season that was never added (an office undo can still reach a
    // record for one that existed only briefly, in principle) has nothing
    // to rebuild a snapshot from, so there is nothing to undo to either.
    const seeded = seededPremiere(id);
    return seeded ? premiereSnapshot(id, seeded, record) : undefined;
  },
);

/**
 * No baseline: a card did not exist before its first line, and a card
 * Daysi added by mistake is archived, not undone. Only her own lines can be
 * undone; a client's save is theirs. The change re-appends the earlier
 * version as it was (see `officeRevertCard`).
 */
const clientCard: Stream<ClientCard> = {
  all: () => readRecords<ClientCard>(CLIENT_CARDS),
  key: (record) => record.id,
  versions: (id) => versionsOf<ClientCard>(CLIENT_CARDS, (record) => record.id, id),
  baseline: () => undefined,
  toChange: (record, id) => ({ type: "client-revert", key: `client:${id}`, id, to: record.updatedAt }),
  undoable: (latest) => latest.updatedBy === "office",
};

const requestStatus: Stream<StoredRequest> = {
  all: () => REQUEST_KINDS.flatMap(listRequests),
  key: (record) => record.reference,
  versions: requestVersions,
  baseline: () => undefined,
  undoable: (record) => record.source === "office",
  toChange: (record, id) => ({
    type: "request-status",
    key: `request:${id}`,
    kind: record.kind,
    reference: id,
    status: record.status,
  }),
};

/**
 * Text is keyed by the item, the field and the language together, so each box
 * has its own history. The baseline is the empty value, which the merge reads
 * as a return to the coded words, so a first edit is undoable like any other.
 */
function textStream(subject: TextSubject, type: "style-text" | "work-text"): Stream<TextOverride> {
  const composite = (record: TextOverride) => `${record.id}:${record.field}:${record.locale}`;
  const split = (id: string) => {
    const parts = id.split(":");
    const locale = parts.pop() ?? "es";
    const field = parts.pop() ?? "";
    return { itemId: parts.join(":"), field: field as TextField, locale: locale as "es" | "en" };
  };
  const toChange = (record: TextOverride, _id: string): OfficeChange => {
    return {
      type,
      key: `text:${textKey(subject, record.id, record.field, record.locale)}`,
      id: record.id,
      field: record.field,
      locale: record.locale,
      value: record.value,
    } as OfficeChange;
  };
  return {
    all: () => readRecords<TextOverride>("text-overrides").filter((r) => r.subject === subject),
    key: composite,
    versions: (id) =>
      readRecords<TextOverride>("text-overrides").filter(
        (record) => record.subject === subject && composite(record) === id,
      ),
    baseline: (id) => {
      const { itemId, field, locale } = split(id);
      if (itemId.length === 0 || field.length === 0) return undefined;
      return {
        type,
        key: `text:${textKey(subject, itemId, field, locale)}`,
        id: itemId,
        field,
        locale,
        value: "",
      } as OfficeChange;
    },
    toChange,
  };
}

const styleText = textStream("style", "style-text");
const workText = textStream("gallery", "work-text");

function streamFor(kind: UndoKind): Stream<unknown> {
  switch (kind) {
    case "style-override": return erased(styleOverride);
    case "work-visibility": return erased(workVisibility);
    case "price-entry": return erased(priceEntry);
    case "alteration": return erased(alteration);
    case "appointment": return erased(appointment);
    case "announcement": return erased(announcement);
    case "helper": return erased(helperSwitch);
    case "request-status": return erased(requestStatus);
    case "style-text": return erased(styleText);
    case "work-text": return erased(workText);
    case "promotion": return erased(promotion);
    case "premiere": return erased(premiere);
    case "client-card": return erased(clientCard);
  }
}

export function previousChangeFor(kind: UndoKind, id: string): OfficeChange | undefined {
  const stream = streamFor(kind);
  const versions = stream.versions(id);
  const latest = versions.at(-1);
  if (latest === undefined || (stream.undoable && !stream.undoable(latest))) return undefined;
  if (versions.length >= 2) return stream.toChange(versions[versions.length - 2], id);
  return versions.length === 1 ? stream.baseline(id) : undefined;
}

export function undoableIds(kind: UndoKind): Set<string> {
  const stream = streamFor(kind);
  const counts = new Map<string, number>();
  const latest = new Map<string, unknown>();
  for (const record of stream.all()) {
    const id = stream.key(record);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    latest.set(id, record);
  }
  return new Set(
    [...counts].filter(([id, count]) =>
      (count >= 2 || stream.baseline(id) !== undefined) &&
      (stream.undoable?.(latest.get(id)) ?? true))
      .map(([id]) => id),
  );
}
