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
import { readRecords, versionsOf } from "./records";
import { REQUEST_KINDS, listRequests, requestVersions, type StoredRequest } from "./request-store";
import { retiredKey, type RetiredKind, type RetiredRecord } from "./retired";

type Stream<R> = {
  readonly all: () => R[];
  readonly key: (record: R) => string;
  readonly versions: (id: string) => R[];
  readonly baseline: (id: string) => OfficeChange | undefined;
  readonly toChange: (record: R, id: string) => OfficeChange;
};

function erased<R>(source: Stream<R>): Stream<unknown> {
  return {
    all: source.all,
    key: (record) => source.key(record as R),
    versions: source.versions,
    baseline: source.baseline,
    toChange: (record, id) => source.toChange(record as R, id),
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

const styleOverride = recordStream<StyleOverride>(
  "style-overrides",
  (record) => record.styleId,
  (id) => {
    const style = assembleStyles(styles, addedStyles(), []).find((candidate) => candidate.id === id);
    if (!style) return undefined;
    return {
      type: "style-override",
      key: `style:${id}`,
      styleId: id,
      isPublished: style.isPublished,
      stock: Object.fromEntries(
        style.sizes.map((size) => [size.sizeId, size.inStock]),
      ) as SizeStock,
    };
  },
  (record, id) => ({
    type: "style-override",
    key: `style:${id}`,
    styleId: id,
    isPublished: record.isPublished,
    stock: record.stock,
    ...(record.addedPhotos === undefined ? {} : { addedPhotos: [...record.addedPhotos] }),
    ...(record.coverSrc === undefined ? {} : { coverSrc: record.coverSrc }),
  }),
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
  toChange: (record, id) => ({
    type: "request-status",
    key: `request:${id}`,
    kind: record.kind,
    reference: id,
    status: record.status,
  }),
};

const retiredPrefix: Record<RetiredKind, string> = {
  style: "style:",
  gallery: "gallery:",
  fabric: "fabric:",
  "price-entry": "entry:",
  request: "request:",
};

function retiredStream(kind: RetiredKind): Stream<RetiredRecord> {
  const key = (record: RetiredRecord) => retiredKey(record.kind, record.id);
  return {
    all: () => readRecords<RetiredRecord>("retired").filter((record) => record.kind === kind),
    key,
    versions: (id) => versionsOf("retired", key, retiredKey(kind, id)),
    baseline: (id) => ({ type: "restore", key: `${retiredPrefix[kind]}${id}`, id }),
    toChange: (record, id) => ({
      type: record.retired ? "retire" : "restore",
      key: `${retiredPrefix[kind]}${id}`,
      id,
    }),
  };
}

function streamFor(kind: UndoKind): Stream<unknown> {
  switch (kind) {
    case "style-override": return erased(styleOverride);
    case "work-visibility": return erased(workVisibility);
    case "price-entry": return erased(priceEntry);
    case "alteration": return erased(alteration);
    case "appointment": return erased(appointment);
    case "notice": return erased(notice);
    case "request-status": return erased(requestStatus);
    case "retired:style": return erased(retiredStream("style"));
    case "retired:gallery": return erased(retiredStream("gallery"));
    case "retired:fabric": return erased(retiredStream("fabric"));
    case "retired:price-entry": return erased(retiredStream("price-entry"));
    case "retired:request": return erased(retiredStream("request"));
  }
}

export function previousChangeFor(kind: UndoKind, id: string): OfficeChange | undefined {
  const stream = streamFor(kind);
  const versions = stream.versions(id);
  if (versions.length >= 2) return stream.toChange(versions[versions.length - 2], id);
  return versions.length === 1 ? stream.baseline(id) : undefined;
}

export function undoableIds(kind: UndoKind): Set<string> {
  const stream = streamFor(kind);
  const counts = new Map<string, number>();
  for (const record of stream.all()) {
    const id = stream.key(record);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set(
    [...counts].filter(([id, count]) => count >= 2 || stream.baseline(id) !== undefined)
      .map(([id]) => id),
  );
}
