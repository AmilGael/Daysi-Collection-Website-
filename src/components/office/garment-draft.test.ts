import { describe, expect, it } from "vitest";
import type { PhotoSlot } from "@/lib/photo-order";
import { overrideChange, unchanged, viewOf, type ManagedStyle, type OverrideView } from "./garment-draft";

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
    const pending = overrideChange(row.id, { ...viewOf(row, undefined), inStudio: true });
    expect(viewOf(row, pending).inStudio).toBe(true);
  });
});

describe("overrideChange", () => {
  it("lists only srcs on the wire and carries no files when there are none", () => {
    const change = overrideChange(row.id, viewOf(row, undefined));
    expect(change.wire).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: { s: true, m: true, l: false },
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
    const change = overrideChange(row.id, view);
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
