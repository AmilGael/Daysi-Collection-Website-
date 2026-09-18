import { describe, expect, it } from "vitest";
import type { PhotoSlot } from "@/lib/photo-order";
import { overrideChange, unchanged, viewOf, withCount, type ManagedStyle, type OverrideView } from "./garment-draft";

const row: ManagedStyle = {
  id: "frutera",
  slug: "frutera",
  name: "Conjunto Frutera",
  category: "Herencia",
  price: 29500,
  photos: ["/images/real/frutera-capri.jpg", "/images/real/frutera-campaign.jpg"],
  isPublished: true,
  inStudio: false,
  sizes: [
    { sizeId: "s", inStock: true },
    { sizeId: "m", inStock: true },
    { sizeId: "l", inStock: false },
  ],
  retired: false,
  undoable: false,
  texts: {
    name: { es: "Conjunto Frutera", en: "Frutera two-piece" },
    color: { es: "Esmeralda", en: "Emerald" },
    description: { es: "Blusa esmeralda.", en: "An emerald blouse." },
    detail: { es: "", en: "" },
  },
  codedTexts: {
    name: { es: "Conjunto Frutera", en: "Frutera two-piece" },
    color: { es: "Esmeralda", en: "Emerald" },
    description: { es: "Blusa esmeralda.", en: "An emerald blouse." },
    detail: { es: "", en: "" },
  },
};

const fileSlot = (name: string): PhotoSlot => ({
  kind: "file",
  file: new File(["x"], `${name}.jpg`, { type: "image/jpeg" }),
  preview: `blob:${name}`,
});

describe("viewOf", () => {
  it("mirrors the saved row when nothing is pending", () => {
    const view = viewOf(row, undefined);
    expect(view.isPublished).toBe(true);
    expect(view.inStudio).toBe(false);
    expect(view.stock).toEqual({ s: true, m: true, l: false });
    expect(view.slots).toEqual(row.photos.map((src) => ({ kind: "src", src })));
  });

  it("redraws a pending change from its meta", () => {
    const pending = overrideChange(row, { ...viewOf(row, undefined), inStudio: true });
    expect(viewOf(row, pending).inStudio).toBe(true);
  });

  it("redraws a change that carries photos but no meta, as an undo does", () => {
    const [first, second] = row.photos;
    const undo = overrideChange(row, viewOf(row, undefined));
    const override = undo.wire.type === "style-override" ? undo.wire : undefined;
    const withoutMeta = { wire: { ...override!, photos: [second!, first!] } };
    expect(viewOf(row, withoutMeta).slots).toEqual([
      { kind: "src", src: second },
      { kind: "src", src: first },
    ]);
  });
});

describe("overrideChange", () => {
  it("lists only srcs on the wire and carries no files when there are none", () => {
    const change = overrideChange(row, viewOf(row, undefined));
    expect(change.wire).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: {},
      photos: row.photos,
      inStudio: false,
    });
    expect(change.files).toBeUndefined();
    expect(change.withUploads).toBeUndefined();
    expect(change.meta).toEqual(viewOf(row, undefined).slots);
  });

  it("carries chosen files and puts their uploaded srcs back in slot order", () => {
    const view: OverrideView = {
      ...viewOf(row, undefined),
      slots: [fileSlot("new"), { kind: "src", src: row.photos[0]! }, { kind: "src", src: row.photos[1]! }],
    };
    const change = overrideChange(row, view);
    expect(change.files?.map((file) => file.name)).toEqual(["new.jpg"]);
    expect(change.wire.type === "style-override" && change.wire.photos).toEqual(row.photos);
    const uploaded = change.withUploads!(["/uploads/img-new12345.jpg"]);
    expect(uploaded.type === "style-override" && uploaded.photos).toEqual([
      "/uploads/img-new12345.jpg",
      row.photos[0],
      row.photos[1],
    ]);
  });
});

describe("counted pieces on the sheet", () => {
  const counted: ManagedStyle = {
    ...row,
    sizes: [
      { sizeId: "s", inStock: true, count: 2 },
      { sizeId: "m", inStock: false, count: 0 },
      { sizeId: "l", inStock: false },
    ],
  };

  it("shows the pieces left, and the switch for a size never counted", () => {
    expect(viewOf(counted, undefined).stock).toEqual({ s: 2, m: 0, l: false });
  });

  it("sends only the sizes she changed, so an untouched size keeps its count", () => {
    const view = viewOf(counted, undefined);
    const change = overrideChange(counted, { ...view, stock: { ...view.stock, m: 3 } });
    expect(change.wire.type === "style-override" && change.wire.stock).toEqual({ m: 3 });
  });

  it("keeps the moment an undo brings back until she types over that size", () => {
    const undo = {
      wire: {
        type: "style-override" as const,
        key: "style:frutera",
        styleId: "frutera",
        isPublished: true,
        stock: { s: 4, m: 0, l: false },
        countedAt: { s: "2026-09-01T12:00:00.000Z", m: "2026-09-01T12:00:00.000Z" },
      },
    };
    const view = viewOf(counted, undo);
    const kept = overrideChange(counted, { ...view, inStudio: true });
    expect(kept.wire.type === "style-override" && kept.wire.countedAt).toEqual({
      s: "2026-09-01T12:00:00.000Z",
      m: "2026-09-01T12:00:00.000Z",
    });
    expect(kept.wire.type === "style-override" && kept.wire.stock).toEqual({ s: 4, m: 0 });
  });
});

describe("typing a count", () => {
  it("counts that size now, dropping the moment an undo had brought back for it only", () => {
    const view: OverrideView = {
      ...viewOf(row, undefined),
      stock: { s: 4, m: 1, l: false },
      countedAt: { s: "2026-09-01T12:00:00.000Z", m: "2026-09-01T12:00:00.000Z" },
    };
    const typed = withCount(view, "s", 6);
    expect(typed.stock.s).toBe(6);
    expect(typed.countedAt).toEqual({ m: "2026-09-01T12:00:00.000Z" });
  });
});

describe("unchanged", () => {
  it("is true when the view matches the saved row and false for any edit", () => {
    const view = viewOf(row, undefined);
    expect(unchanged(view, row)).toBe(true);
    expect(unchanged({ ...view, stock: { ...view.stock, l: true } }, row)).toBe(false);
    expect(unchanged({ ...view, isPublished: false }, row)).toBe(false);
    expect(unchanged({ ...view, inStudio: true }, row)).toBe(false);
    expect(unchanged({ ...view, slots: [view.slots[1]!, view.slots[0]!] }, row)).toBe(false);
    expect(unchanged({ ...view, slots: [...view.slots, fileSlot("new")] }, row)).toBe(false);
  });
});
