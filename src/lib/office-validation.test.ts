import { describe, expect, it } from "vitest";
import {
  UNDO_KINDS,
  changesOf,
  collectionChangeSchema,
  fabricChangeSchema,
  galleryChangeSchema,
  normalizePhone,
  premiereChangeSchema,
  priceChangeSchema,
  shopfrontChangeSchema,
  styleCreateSchema,
  styleOverrideSchema,
  undoQuerySchema,
  workChangeSchema,
} from "./office-validation";

const override = {
  isPublished: false,
  stock: { s: true, m: true, l: false },
};

describe("what the office accepts for a style override", () => {
  it("accepts a garment Daysi added herself, which carries a generated id", () => {
    // Regression: the id used to be an enum of the coded styles, so she could
    // add a garment and then never take it off the rack.
    const result = styleOverrideSchema.safeParse({ styleId: "sty-nm9pfhxu", ...override });
    expect(result.success).toBe(true);
  });

  it("still accepts a garment that shipped with the site", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override }).success).toBe(true);
  });

  it("refuses an empty id", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "", ...override }).success).toBe(false);
  });

  it("refuses a photo path outside the uploads folder", () => {
    const result = styleOverrideSchema.safeParse({
      styleId: "frutera",
      ...override,
      addedPhotos: ["/etc/passwd"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a count of pieces per size beside the older switches", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, stock: { s: 2, m: 0, l: true } }).success).toBe(true);
  });

  it("refuses a count that is not a whole number of pieces", () => {
    for (const count of [-1, 1.5, 100]) {
      expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, stock: { s: count } }).success).toBe(false);
    }
  });

  it("accepts a garment's own price and extra, from $1 to $5,000", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, fixedPrice: 12000 }).success).toBe(true);
    expect(
      styleOverrideSchema.safeParse({ styleId: "frutera", ...override, fixedPrice: 12000, customizationExtra: 0 }).success,
    ).toBe(true);
    for (const fixedPrice of [50, 500_001, 120.5]) {
      expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, fixedPrice }).success, String(fixedPrice)).toBe(false);
    }
    expect(
      styleOverrideSchema.safeParse({ styleId: "frutera", ...override, fixedPrice: 12000, customizationExtra: -1 }).success,
    ).toBe(false);
  });

  it("carries when a count was taken, as an undo restores it", () => {
    const result = styleOverrideSchema.safeParse({
      styleId: "frutera",
      ...override,
      stock: { s: 2 },
      countedAt: { s: "2026-09-20T12:00:00.000Z" },
    });
    expect(result.success).toBe(true);
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, countedAt: { s: "yesterday" } }).success).toBe(false);
  });
});

describe("what the office accepts for a new garment", () => {
  const draft = {
    name: "Cumbia maxi",
    description: "Un maxi de cintura fruncida en un estampado dorado.",
    detail: "",
    color: "",
    categoryId: "dresses",
    fabricId: "medallon-print",
    sizes: { s: true, m: true, l: false },
    photos: ["/uploads/img-abc123.jpg"],
  };

  it("accepts a garment with a name, a cloth, a size and a photograph", () => {
    expect(styleCreateSchema.safeParse(draft).success).toBe(true);
  });

  it("refuses one with no photograph at all", () => {
    expect(styleCreateSchema.safeParse({ ...draft, photos: [] }).success).toBe(false);
  });

  it("refuses a garment filed under a category that does not exist", () => {
    expect(styleCreateSchema.safeParse({ ...draft, categoryId: "hats" }).success).toBe(false);
  });

  it("refuses a price nobody could have meant", () => {
    expect(styleCreateSchema.safeParse({ ...draft, fixedPrice: 900_000_00 }).success).toBe(false);
  });

  it("accepts a made-to-measure extra beside the price", () => {
    const parsed = styleCreateSchema.safeParse({ ...draft, fixedPrice: 18000, customizationExtra: 7000 });
    expect(parsed.success && parsed.data.customizationExtra).toBe(7000);
    expect(styleCreateSchema.safeParse({ ...draft, customizationExtra: 900_000_00 }).success).toBe(false);
  });

  it("accepts how many pieces of each size she has", () => {
    expect(styleCreateSchema.safeParse({ ...draft, sizes: { s: 1, m: 0, l: 2 } }).success).toBe(true);
    expect(styleCreateSchema.safeParse({ ...draft, sizes: { s: -1, m: 0, l: 2 } }).success).toBe(false);
  });
});

const styleOverrideChange = {
  type: "style-override",
  key: "style:frutera",
  styleId: "frutera",
  ...override,
};
const styleCreateChange = {
  type: "style-create",
  key: "style-create:one",
  name: "Cumbia maxi",
  description: "Un maxi de cintura fruncida en un estampado dorado.",
  detail: "",
  color: "",
  categoryId: "dresses",
  fabricId: "medallon-print",
  sizes: { s: true, m: true, l: false },
  photos: ["/uploads/img-abc123.jpg"],
};
const workAdd = {
  type: "work-add",
  key: "work-add:one",
  src: "/uploads/gallery-one.webp",
  width: 1200,
  height: 1600,
  category: "runway",
  caption: { es: "Golden dress", en: "Golden dress" },
};
const fabricAdd = {
  type: "fabric-add",
  key: "fabric-add:one",
  name: "Golden cotton",
  swatchImage: "/uploads/swatch-one.png",
  averageColor: "#aabbcc",
  prices: { dresses: 12000 },
};
const premiereCreateChange = {
  type: "premiere-create",
  key: "premiere-create:one",
  season: "Invierno 2027",
  title: "Nieve",
  story: "Seis piezas alrededor del primer invierno en el Bronx.",
  inspiration: "El frío que nunca conoció en la isla.",
  revealDate: "2027-01-05",
  releaseDate: "2027-02-01",
  piecesPlanned: 6,
  editionSize: 12,
  coverImage: "/uploads/cover-one.jpg",
  styleIds: ["sirena"],
};

describe.each([
  ["collection style override", collectionChangeSchema, styleOverrideChange],
  ["collection style create", collectionChangeSchema, styleCreateChange],
  ["collection retire", collectionChangeSchema, { type: "retire", key: "style:x", id: "x" }],
  ["collection restore", collectionChangeSchema, { type: "restore", key: "style:x", id: "x" }],
  ["gallery work add", galleryChangeSchema, workAdd],
  ["gallery visibility", galleryChangeSchema, { type: "work-visibility", key: "gallery:x", id: "x", hidden: true }],
  ["gallery retire", galleryChangeSchema, { type: "retire", key: "gallery:x", id: "x" }],
  ["gallery restore", galleryChangeSchema, { type: "restore", key: "gallery:x", id: "x" }],
  ["gallery section add", galleryChangeSchema, { type: "section-add", key: "section-add:one", name: "Quinceañeras" }],
  ["gallery section retire", galleryChangeSchema, { type: "section-retire", key: "section:sec-otra", id: "sec-otra" }],
  ["gallery section restore", galleryChangeSchema, { type: "section-restore", key: "section:sec-otra", id: "sec-otra" }],
  ["fabric add", fabricChangeSchema, fabricAdd],
  ["fabric retire", fabricChangeSchema, { type: "retire", key: "fabric:x", id: "x" }],
  ["fabric restore", fabricChangeSchema, { type: "restore", key: "fabric:x", id: "x" }],
  ["price entry", priceChangeSchema, { type: "entry", key: "entry:x", id: "x", fixedPrice: 100, customizationExtra: 0 }],
  ["price alteration", priceChangeSchema, { type: "alteration", key: "alteration:x", id: "x", fixedPrice: 100, rushSurcharge: 0 }],
  ["price appointment", priceChangeSchema, { type: "appointment", key: "appointment:x", id: "x", fee: 100 }],
  ["price retire", priceChangeSchema, { type: "retire", key: "entry:x", id: "x" }],
  ["price restore", priceChangeSchema, { type: "restore", key: "entry:x", id: "x" }],
  [
    "shopfront announcement on chosen pages",
    shopfrontChangeSchema,
    { type: "announcement", key: "announcement:new-1", message: "Cerrado el lunes", pages: ["home", "appointments"], visible: true },
  ],
  [
    "shopfront announcement on every page",
    shopfrontChangeSchema,
    { type: "announcement", key: "announcement:ann-aaaaaaaa", id: "ann-aaaaaaaa", message: "Rebajas", pages: "all", visible: false },
  ],
  ["shopfront announcement retire", shopfrontChangeSchema, { type: "retire", key: "announcement:site", id: "site", kind: "announcement" }],
  [
    "shopfront promotion",
    shopfrontChangeSchema,
    { type: "promotion", key: "promotion:new", label: "Venta de otoño", kind: "percent", value: 15, scope: { type: "all" }, active: true },
  ],
  ["shopfront helper", shopfrontChangeSchema, { type: "helper", key: "helper:site", visible: false }],
  ["shopfront retire", shopfrontChangeSchema, { type: "retire", key: "promotion:prm-aaaaaaaa", id: "prm-aaaaaaaa" }],
  ["shopfront restore", shopfrontChangeSchema, { type: "restore", key: "promotion:prm-aaaaaaaa", id: "prm-aaaaaaaa" }],
  ["premiere create", premiereChangeSchema, premiereCreateChange],
  [
    "premiere update",
    premiereChangeSchema,
    { type: "premiere-update", key: "premiere:otono-2026", premiereId: "otono-2026", piecesPlanned: 5 },
  ],
  [
    "premiere styles",
    premiereChangeSchema,
    { type: "premiere-styles", key: "premiere-styles:otono-2026", premiereId: "otono-2026", styleIds: ["sirena"] },
  ],
  ["premiere retire", premiereChangeSchema, { type: "retire", key: "premiere:otono-2026", id: "otono-2026" }],
  ["premiere restore", premiereChangeSchema, { type: "restore", key: "premiere:otono-2026", id: "otono-2026" }],
  ["work request status", workChangeSchema, { type: "request-status", key: "request:ALT-1", kind: "alteration", reference: "ALT-1", status: "answered" }],
  [
    "work order note",
    workChangeSchema,
    {
      type: "order-note",
      key: "order-note:one",
      kind: "order",
      clientName: "Rosa Martínez",
      description: "Vestido azul, talla M",
      amount: 15000,
      paid: true,
    },
  ],
  ["work retire", workChangeSchema, { type: "retire", key: "request:CIT-1", id: "CIT-1" }],
  ["work restore", workChangeSchema, { type: "restore", key: "request:CIT-1", id: "CIT-1" }],
] as const)("%s change", (_name, schema, valid) => {
  it("accepts its member", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("refuses an invalid member", () => {
    expect(schema.safeParse({ ...valid, key: "missing-colon" }).success).toBe(false);
  });
});

describe("undo query", () => {
  it("accepts a named stream and non-empty id", () => {
    expect([...UNDO_KINDS]).toEqual(["style-override", "work-visibility", "price-entry", "alteration", "appointment", "announcement", "helper", "request-status", "style-text", "work-text", "promotion", "premiere", "client-card"]);
    expect(undoQuerySchema.safeParse({ kind: "announcement", id: "site" }).success).toBe(true);
    expect(undoQuerySchema.safeParse({ kind: "retired:style", id: "x" }).success).toBe(false);
  });

  it("refuses an unknown stream and an empty id", () => {
    expect(undoQuerySchema.safeParse({ kind: "everything", id: "site" }).success).toBe(false);
    expect(undoQuerySchema.safeParse({ kind: "announcement", id: "" }).success).toBe(false);
  });
});

describe("change batch boundaries", () => {
  const batch = changesOf(collectionChangeSchema);

  it("refuses an empty batch and a batch of 51", () => {
    expect(batch.safeParse([]).success).toBe(false);
    expect(batch.safeParse(Array.from({ length: 51 }, () => styleOverrideChange)).success).toBe(false);
  });

  it("refuses an unknown type and a key without a colon", () => {
    expect(collectionChangeSchema.safeParse({ ...styleOverrideChange, type: "publish" }).success).toBe(false);
    expect(collectionChangeSchema.safeParse({ ...styleOverrideChange, key: "style" }).success).toBe(false);
  });

  it("enforces member-specific numeric and enum limits", () => {
    expect(galleryChangeSchema.safeParse({ ...workAdd, width: 0 }).success).toBe(false);
    expect(fabricChangeSchema.safeParse({ ...fabricAdd, prices: {} }).success).toBe(false);
    expect(fabricChangeSchema.safeParse({ ...fabricAdd, prices: { dresses: 99 } }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ type: "entry", key: "entry:x", id: "x", fixedPrice: 5_000_01, customizationExtra: 0 }).success).toBe(false);
    expect(workChangeSchema.safeParse({ type: "request-status", key: "request:x", kind: "order", reference: "x", status: "done" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ type: "request-status", key: "request:x", kind: "order", reference: "x", status: "refunded" }).success).toBe(true);
  });
});

describe("office price boundaries", () => {
  const entry = { type: "entry", key: "entry:x", id: "x", customizationExtra: 0 };

  it("accepts a price of exactly 5000 dollars", () => {
    expect(priceChangeSchema.safeParse({ ...entry, fixedPrice: 500_000 }).success).toBe(true);
  });

  it("refuses a price one cent above 5000 dollars", () => {
    expect(priceChangeSchema.safeParse({ ...entry, fixedPrice: 500_001 }).success).toBe(false);
  });
});

describe("text changes", () => {
  const base = {
    type: "style-text" as const,
    key: "text:style:s1:description:es",
    id: "s1",
    field: "description" as const,
    locale: "es" as const,
    value: "Palabras nuevas",
  };

  it("accepts a staged style text change", () => {
    expect(collectionChangeSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an empty value, which clears the override", () => {
    expect(collectionChangeSchema.safeParse({ ...base, value: "" }).success).toBe(true);
  });

  it("refuses a field the garment does not have", () => {
    expect(collectionChangeSchema.safeParse({ ...base, field: "caption" }).success).toBe(false);
  });

  it("refuses a locale the site does not serve", () => {
    expect(collectionChangeSchema.safeParse({ ...base, locale: "fr" }).success).toBe(false);
  });

  it("refuses a value past the longest field's limit", () => {
    expect(
      collectionChangeSchema.safeParse({ ...base, value: "x".repeat(401) }).success,
    ).toBe(false);
  });

  it("accepts a long name at the schema, which the action then refuses", () => {
    // TEXT_LIMITS.name is 60; the schema's outer bound is the longest field.
    expect(
      collectionChangeSchema.safeParse({ ...base, field: "name", value: "x".repeat(100) }).success,
    ).toBe(true);
  });

  it("accepts a staged caption change on the gallery tab", () => {
    expect(
      galleryChangeSchema.safeParse({
        type: "work-text",
        key: "text:gallery:g1:caption:en",
        id: "g1",
        field: "caption",
        locale: "en",
        value: "A June wedding dress.",
      }).success,
    ).toBe(true);
  });

  it("refuses a garment field on the gallery tab", () => {
    expect(
      galleryChangeSchema.safeParse({
        type: "work-text",
        key: "text:gallery:g1:name:en",
        id: "g1",
        field: "name",
        locale: "en",
        value: "x",
      }).success,
    ).toBe(false);
  });
});

describe("UNDO_KINDS", () => {
  it("carries the two text streams", () => {
    expect(UNDO_KINDS).toContain("style-text");
    expect(UNDO_KINDS).toContain("work-text");
  });
});

describe("bilingual gallery captions", () => {
  // A garment's own name, color, description and detail are Spanish-only at
  // creation (see "a new garment is typed in Spanish only" below); the
  // gallery's caption is still typed in both languages.
  it("accepts a gallery photo with both captions", () => {
    expect(
      galleryChangeSchema.safeParse({
        type: "work-add",
        key: "add:1",
        src: "/uploads/g.jpg",
        width: 10,
        height: 10,
        category: "runway",
        caption: { es: "Un vestido marfil.", en: "An ivory dress." },
      }).success,
    ).toBe(true);
  });
});

describe("a gallery photo's section is a string, not a fixed enum", () => {
  it("accepts a section she named herself, and refuses one past 60 characters", () => {
    expect(galleryChangeSchema.safeParse({ ...workAdd, category: "sec-otra" }).success).toBe(true);
    expect(galleryChangeSchema.safeParse({ ...workAdd, category: "x".repeat(61) }).success).toBe(false);
  });

  it("refuses an empty section", () => {
    expect(galleryChangeSchema.safeParse({ ...workAdd, category: "" }).success).toBe(false);
  });
});

describe("naming a new gallery section, or retiring one she added", () => {
  const sectionAdd = { type: "section-add", key: "section-add:one", name: "Quinceañeras" };

  it("accepts a name from 2 to 40 characters", () => {
    expect(galleryChangeSchema.safeParse(sectionAdd).success).toBe(true);
    expect(galleryChangeSchema.safeParse({ ...sectionAdd, name: "Q" }).success).toBe(false);
    expect(galleryChangeSchema.safeParse({ ...sectionAdd, name: "x".repeat(41) }).success).toBe(false);
  });

  it("accepts a retire or a restore by the section's id, refusing an empty one", () => {
    const retire = { type: "section-retire", key: "section:sec-otra", id: "sec-otra" };
    const restore = { type: "section-restore", key: "section:sec-otra", id: "sec-otra" };
    expect(galleryChangeSchema.safeParse(retire).success).toBe(true);
    expect(galleryChangeSchema.safeParse(restore).success).toBe(true);
    expect(galleryChangeSchema.safeParse({ ...retire, id: "" }).success).toBe(false);
  });
});

describe("the photo list and the studio switch on an override", () => {
  it("accepts a list of coded and uploaded photos, and the studio flag", () => {
    const result = styleOverrideSchema.safeParse({
      styleId: "frutera",
      ...override,
      photos: ["/images/real/frutera-capri.jpg", "/uploads/img-abc12345.jpg"],
      inStudio: true,
    });
    expect(result.success).toBe(true);
  });

  it("refuses an empty list and a list of more than twelve", () => {
    expect(styleOverrideSchema.safeParse({ styleId: "frutera", ...override, photos: [] }).success).toBe(false);
    expect(
      styleOverrideSchema.safeParse({
        styleId: "frutera",
        ...override,
        photos: Array.from({ length: 13 }, (_, index) => `/uploads/img-${index}.jpg`),
      }).success,
    ).toBe(false);
  });

  it("refuses a photo entry that is not a path to an image, and accepts a real one", () => {
    expect(
      styleOverrideSchema.safeParse({ styleId: "frutera", ...override, photos: ["/etc/passwd"] }).success,
    ).toBe(false);
    expect(
      styleOverrideSchema.safeParse({ styleId: "frutera", ...override, photos: ["/images/real/frutera-capri.jpg"] })
        .success,
    ).toBe(true);
  });
});

describe("a new garment is typed in Spanish only", () => {
  it("takes one string per field and defaults the studio switch to off", () => {
    const result = styleCreateSchema.safeParse({
      name: "Cumbia maxi",
      description: "Un maxi de cintura fruncida en un estampado dorado.",
      detail: "",
      color: "",
      categoryId: "dresses",
      fabricId: "medallon-print",
      sizes: { s: true, m: true, l: false },
      photos: ["/uploads/img-abc123.jpg"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inStudio).toBe(false);
  });

  it("refuses the old two-language shape", () => {
    const result = styleCreateSchema.safeParse({
      name: { es: "Cumbia maxi", en: "Cumbia maxi" },
      description: "Un maxi de cintura fruncida en un estampado dorado.",
      detail: "",
      color: "",
      categoryId: "dresses",
      fabricId: "medallon-print",
      sizes: { s: true, m: true, l: false },
      photos: ["/uploads/img-abc123.jpg"],
    });
    expect(result.success).toBe(false);
  });
});

describe("asking for a translation", () => {
  it("names the garment and the fields", () => {
    const result = collectionChangeSchema.safeParse({
      type: "translate",
      key: "translate:style:frutera",
      id: "frutera",
      fields: ["name", "description"],
    });
    expect(result.success).toBe(true);
  });

  it("refuses an unknown field and an empty list", () => {
    expect(
      collectionChangeSchema.safeParse({ type: "translate", key: "translate:style:frutera", id: "frutera", fields: ["slug"] }).success,
    ).toBe(false);
    expect(
      collectionChangeSchema.safeParse({ type: "translate", key: "translate:style:frutera", id: "frutera", fields: [] }).success,
    ).toBe(false);
  });
});

describe("adding an alteration or a session from Precios", () => {
  const alterationAdd = {
    type: "alteration-add",
    key: "alteration-add:one",
    name: "Poner puños",
    description: "Puños nuevos en una manga sencilla.",
    fixedPrice: 3200,
    rushSurcharge: 2000,
    turnaround: "4–6 días",
  };
  const appointmentAdd = {
    type: "appointment-add",
    key: "appointment-add:one",
    name: "Prueba de novia",
    minutes: 45,
    fee: 9000,
    suitedFor: "Una novia a dos semanas de la boda",
  };

  it("accepts an alteration typed in Spanish, with or without its own photo", () => {
    expect(priceChangeSchema.safeParse(alterationAdd).success).toBe(true);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, photo: "/uploads/cuff-one.jpg" }).success).toBe(true);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, description: "", turnaround: "" }).success).toBe(true);
  });

  it("refuses an alteration with no name, words past their limits, a bad price or a photo from outside uploads", () => {
    expect(priceChangeSchema.safeParse({ ...alterationAdd, name: "P" }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, name: "x".repeat(61) }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, description: "x".repeat(161) }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, turnaround: "x".repeat(31) }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, fixedPrice: 5_000_01 }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, rushSurcharge: -1 }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...alterationAdd, photo: "/images/real/craft-detail.jpg" }).success).toBe(false);
  });

  it("accepts a session of 15 to 180 minutes, and refuses one outside that", () => {
    expect(priceChangeSchema.safeParse(appointmentAdd).success).toBe(true);
    expect(priceChangeSchema.safeParse({ ...appointmentAdd, minutes: 15 }).success).toBe(true);
    expect(priceChangeSchema.safeParse({ ...appointmentAdd, minutes: 180 }).success).toBe(true);
    for (const minutes of [14, 181, 30.5]) {
      expect(priceChangeSchema.safeParse({ ...appointmentAdd, minutes }).success, String(minutes)).toBe(false);
    }
    expect(priceChangeSchema.safeParse({ ...appointmentAdd, suitedFor: "x".repeat(121) }).success).toBe(false);
    expect(priceChangeSchema.safeParse({ ...appointmentAdd, name: "" }).success).toBe(false);
  });

  it("retires and restores a price, an alteration or a session, and nothing else", () => {
    for (const kind of ["price-entry", "alteration", "appointment-type"]) {
      expect(priceChangeSchema.safeParse({ type: "retire", key: "alteration:x", id: "x", kind }).success, kind).toBe(true);
      expect(priceChangeSchema.safeParse({ type: "restore", key: "alteration:x", id: "x", kind }).success, kind).toBe(true);
    }
    expect(priceChangeSchema.safeParse({ type: "retire", key: "style:x", id: "x", kind: "style" }).success).toBe(false);
  });
});

describe("noting an order that never came through the site", () => {
  const orderNote = {
    type: "order-note",
    key: "order-note:one",
    kind: "order",
    clientName: "Rosa Martínez",
    description: "Vestido azul, talla M",
    amount: 15000,
    paid: true,
  };

  it("accepts the bare minimum, and with a phone, an email and notes besides", () => {
    expect(workChangeSchema.safeParse(orderNote).success).toBe(true);
    expect(
      workChangeSchema.safeParse({
        ...orderNote,
        phone: "917-555-0100",
        email: "rosa@example.com",
        notes: "Pidió que se lo entreguen envuelto.",
      }).success,
    ).toBe(true);
  });

  it("refuses a name too short, an amount past the cap, and a kind outside the three", () => {
    expect(workChangeSchema.safeParse({ ...orderNote, clientName: "R" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, amount: 5_000_01 }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, kind: "appointment" }).success).toBe(false);
  });

  it("refuses a phone or an email that is not one, but accepts leaving both out", () => {
    expect(workChangeSchema.safeParse({ ...orderNote, phone: "abc" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, email: "not-an-email" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, phone: undefined, email: undefined }).success).toBe(true);
  });

  it("cleans a phone pasted from WhatsApp: a non-breaking hyphen and a stray direction mark", () => {
    // U+200E (left-to-right mark) before it, U+2011 (non-breaking hyphen) in
    // place of both dashes: what a phone looks like copied out of a chat.
    const messy = "\u200E917\u2011555\u20110100";
    expect(normalizePhone(messy)).toBe("917-555-0100");

    const parsed = workChangeSchema.safeParse({ ...orderNote, phone: messy });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.type === "order-note" ? parsed.data.phone : null).toBe("917-555-0100");
  });

  it("still refuses a phone that has nothing left once the marks are stripped", () => {
    expect(workChangeSchema.safeParse({ ...orderNote, phone: "12" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, phone: "\u200E\u200E" }).success).toBe(false);
  });

  it("accepts a date she gives it, from 2020 up to today", () => {
    expect(workChangeSchema.safeParse({ ...orderNote, date: "2026-08-20" }).success).toBe(true);
  });

  it("refuses a date before 2020, a date in the future, and one not shaped YYYY-MM-DD", () => {
    expect(workChangeSchema.safeParse({ ...orderNote, date: "2019-12-31" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, date: "2999-01-01" }).success).toBe(false);
    expect(workChangeSchema.safeParse({ ...orderNote, date: "08/20/2026" }).success).toBe(false);
  });
});

describe("a promotion from the shop window", () => {
  const promotion = {
    type: "promotion",
    key: "promotion:new",
    label: "Venta de otoño",
    kind: "percent",
    value: 15,
    scope: { type: "all" },
    active: true,
  };
  const accepts = (over: Record<string, unknown>) => shopfrontChangeSchema.safeParse({ ...promotion, ...over }).success;

  it("accepts everything, a category or one garment, with or without dates, new or by its id", () => {
    expect(accepts({ scope: { type: "category", categoryId: "heritage" } })).toBe(true);
    expect(accepts({ scope: { type: "style", styleId: "sty-nm9pfhxu" } })).toBe(true);
    expect(accepts({ kind: "amount", value: 2000, startsAt: "2026-09-20", endsAt: "2026-09-27" })).toBe(true);
    expect(accepts({ id: "prm-a3c4d6e7", active: false })).toBe(true);
  });

  it("refuses a kind that is neither, a date not shaped YYYY-MM-DD, and a category that does not exist", () => {
    expect(accepts({ kind: "half" })).toBe(false);
    expect(accepts({ startsAt: "2026-9-1" })).toBe(false);
    expect(accepts({ endsAt: "2026-13-01" })).toBe(false);
    expect(accepts({ scope: { type: "category", categoryId: "hats" } })).toBe(false);
    expect(accepts({ scope: { type: "style", styleId: "" } })).toBe(false);
    expect(accepts({ scope: { type: "everything" } })).toBe(false);
  });

  it("refuses a label shorter than 2 or longer than 60, a value outside 1 to $5,000, and an id that is not one", () => {
    expect(accepts({ label: "V" })).toBe(false);
    expect(accepts({ label: "x".repeat(61) })).toBe(false);
    expect(accepts({ value: 0 })).toBe(false);
    expect(accepts({ value: 15.5 })).toBe(false);
    expect(accepts({ kind: "amount", value: 5_000_01 })).toBe(false);
    expect(accepts({ id: "PRM-A3C4D6E7" })).toBe(false);
  });
});

describe("a premiere announced from the office", () => {
  const accepts = (over: Record<string, unknown>) =>
    premiereChangeSchema.safeParse({ ...premiereCreateChange, ...over }).success;

  it("accepts a season with a cover, dates and a full checklist of garments", () => {
    expect(accepts({})).toBe(true);
    expect(accepts({ styleIds: [] })).toBe(true);
  });

  it("refuses no pieces planned, an edition past 500, more than 40 garments, and a cover outside uploads", () => {
    expect(accepts({ piecesPlanned: 0 })).toBe(false);
    expect(accepts({ editionSize: 501 })).toBe(false);
    expect(accepts({ styleIds: Array.from({ length: 41 }, (_, index) => `sty-${index}`) })).toBe(false);
    expect(accepts({ coverImage: "/images/real/premiere-otono.jpg" })).toBe(false);
  });

  it("refuses a season, a title, or a story outside their lengths, and a date not shaped YYYY-MM-DD", () => {
    expect(accepts({ season: "x" })).toBe(false);
    expect(accepts({ title: "x" })).toBe(false);
    expect(accepts({ story: "too short" })).toBe(false);
    expect(accepts({ revealDate: "2027-1-5" })).toBe(false);
  });

  it("accepts an update naming only the fields she is changing", () => {
    const update = {
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
    };
    expect(premiereChangeSchema.safeParse(update).success).toBe(true);
    expect(premiereChangeSchema.safeParse({ ...update, piecesPlanned: 5 }).success).toBe(true);
    expect(premiereChangeSchema.safeParse({ ...update, season: "Otoño 2026, corregido" }).success).toBe(true);
    expect(premiereChangeSchema.safeParse({ ...update, piecesPlanned: 0 }).success).toBe(false);
    expect(premiereChangeSchema.safeParse({ ...update, editionSize: 501 }).success).toBe(false);
  });

  it("accepts an update that also carries the checklist, so an undo can restore it, up to the same bound", () => {
    const update = { type: "premiere-update", key: "premiere:otono-2026", premiereId: "otono-2026" };
    expect(premiereChangeSchema.safeParse({ ...update, styleIds: ["sirena", "frutera"] }).success).toBe(true);
    expect(premiereChangeSchema.safeParse({ ...update, styleIds: [] }).success).toBe(true);
    expect(
      premiereChangeSchema.safeParse({ ...update, styleIds: Array.from({ length: 41 }, (_, index) => `sty-${index}`) })
        .success,
    ).toBe(false);
  });

  it("accepts the styles change naming the whole checklist", () => {
    const styles = { type: "premiere-styles", key: "premiere-styles:otono-2026", premiereId: "otono-2026" };
    expect(premiereChangeSchema.safeParse({ ...styles, styleIds: ["sirena", "frutera"] }).success).toBe(true);
    expect(
      premiereChangeSchema.safeParse({ ...styles, styleIds: Array.from({ length: 41 }, (_, index) => `sty-${index}`) })
        .success,
    ).toBe(false);
  });
});

describe("an announcement from Vitrina", () => {
  const base = { type: "announcement", key: "announcement:new-1", message: "Cerrado el lunes", pages: ["home"], visible: true };

  it("needs something to say, and at most two hundred characters of it", () => {
    expect(shopfrontChangeSchema.safeParse({ ...base, message: "   " }).success).toBe(false);
    expect(shopfrontChangeSchema.safeParse({ ...base, message: "a".repeat(201) }).success).toBe(false);
  });

  it("needs at least one page, and only pages of the shop", () => {
    expect(shopfrontChangeSchema.safeParse({ ...base, pages: [] }).success).toBe(false);
    expect(shopfrontChangeSchema.safeParse({ ...base, pages: ["office"] }).success).toBe(false);
    expect(shopfrontChangeSchema.safeParse({ ...base, pages: "everywhere" }).success).toBe(false);
  });

  it("still reads a retire with no kind as a promotion's", () => {
    const parsed = shopfrontChangeSchema.safeParse({ type: "retire", key: "promotion:prm-a", id: "prm-a" });
    expect(parsed.success && parsed.data.type === "retire" ? parsed.data.kind : "failed").toBeUndefined();
  });
});
