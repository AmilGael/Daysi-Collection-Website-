import { alterationServices, appointmentTypes, priceList, styles } from "@/content";
import type { OfficeChange, UndoKind } from "./office-validation";
import {
  addedStyles,
  assembleStyles,
  type SiteNotice,
  type SizeStock,
  type StyleOverride,
} from "./live-catalog";
import { manageableGallery, type GalleryVisibility } from "./live-gallery";
import {
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

type Stream<R> = {
  readonly all: () => R[];
  readonly key: (record: R) => string;
  readonly versions: (id: string) => R[];
  readonly baseline: (id: string) => OfficeChange | undefined;
  readonly toChange: (record: R, id: string) => OfficeChange;
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
  toChange: (record: R, id: string) => OfficeChange,
): Stream<R> {
  return {
    all: () => readRecords<R>(collection),
    key,
    versions: (id) => versionsOf(collection, key, id),
    baseline,
    toChange,
  };
}

/** Photos are only ever added from the office, so an undo never takes them away. */
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
    const photos = newestPhotos(id) ?? record.addedPhotos;
    return {
      type: "style-override",
      key: `style:${id}`,
      styleId: id,
      isPublished: record.isPublished,
      stock: record.stock,
      ...(photos === undefined ? {} : { addedPhotos: [...photos] }),
      ...(record.coverSrc === undefined ? {} : { coverSrc: record.coverSrc }),
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
    const item = alterationServices.find((candidate) => candidate.id === id);
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
    const item = appointmentTypes.find((candidate) => candidate.id === id);
    return item ? { type: "appointment", key: `appointment:${id}`, id, fee: item.fee } : undefined;
  },
  (record, id) => ({ type: "appointment", key: `appointment:${id}`, id, fee: record.fee }),
);

const notice = recordStream<SiteNotice>(
  "site-notice",
  () => "site",
  () => ({ type: "notice", key: "notice:site", message: "", visible: false }),
  (record) => ({
    type: "notice",
    key: "notice:site",
    message: record.message,
    visible: record.visible,
  }),
);

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
    case "notice": return erased(notice);
    case "request-status": return erased(requestStatus);
    case "style-text": return erased(styleText);
    case "work-text": return erased(workText);
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
