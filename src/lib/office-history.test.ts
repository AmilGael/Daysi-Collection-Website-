import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredRequest } from "./request-store";

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-office-history-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const request = (status: StoredRequest["status"], source?: StoredRequest["source"]): StoredRequest => ({
  reference: "MSG-TEST",
  kind: "contact",
  submittedAt: "2026-09-03T12:00:00.000Z",
  locale: "es",
  client: { name: "Ana", email: "ana@example.com" },
  details: { message: "Hola" },
  status,
  ...(source === undefined ? {} : { source }),
});

describe("office undo history", () => {
  it("returns the coded style baseline after one override and the first override after two", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");

    expect(previousChangeFor("style-override", "frutera")).toBeUndefined();
    await saveStyleOverride({ styleId: "frutera", isPublished: false, stock: { m: false } });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: { s: true, m: true, l: true },
    });
    expect(undoableIds("style-override")).toContain("frutera");

    await saveStyleOverride({
      styleId: "frutera",
      isPublished: true,
      stock: { s: false, m: false, l: false },
    });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: false,
      stock: { m: false },
    });
  });

  it("brings back a count with the moment it was counted", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: { s: 2 }, countedAt: { s: "2026-09-01T12:00:00.000Z" } });
    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: { s: 5 }, countedAt: { s: "2026-09-10T12:00:00.000Z" } });

    expect(previousChangeFor("style-override", "frutera")).toMatchObject({
      stock: { s: 2 },
      countedAt: { s: "2026-09-01T12:00:00.000Z" },
    });
  });

  it("returns the line before the own price, so undo clears it, and brings an own price back", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");

    // The coded baseline never carries one: undoing the first line is the list price.
    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, fixedPrice: 27000 });
    expect(previousChangeFor("style-override", "frutera")).not.toHaveProperty("fixedPrice");

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, fixedPrice: 25000, customizationExtra: 8000 });
    expect(previousChangeFor("style-override", "frutera")).toMatchObject({ fixedPrice: 27000 });
    expect(previousChangeFor("style-override", "frutera")).not.toHaveProperty("customizationExtra");

    await saveStyleOverride({ styleId: "frutera", isPublished: false, stock: {} });
    expect(previousChangeFor("style-override", "frutera")).toMatchObject({ fixedPrice: 25000, customizationExtra: 8000 });

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {} });
    const previous = previousChangeFor("style-override", "frutera");
    expect(previous).toMatchObject({ isPublished: false });
    expect(previous).not.toHaveProperty("fixedPrice");
  });

  it("keeps the newest photos when undoing to the baseline and to the earlier line", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");

    await saveStyleOverride({
      styleId: "frutera", isPublished: true, stock: { m: false },
      addedPhotos: ["/uploads/a.jpg"], coverSrc: "/uploads/a.jpg",
    });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override", key: "style:frutera", styleId: "frutera",
      isPublished: true, stock: { s: true, m: true, l: true },
      addedPhotos: ["/uploads/a.jpg"],
    });

    await saveStyleOverride({
      styleId: "frutera", isPublished: false, stock: { m: false },
      addedPhotos: ["/uploads/a.jpg", "/uploads/b.jpg"], coverSrc: "/uploads/b.jpg",
    });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override", key: "style:frutera", styleId: "frutera",
      isPublished: true, stock: { m: false },
      addedPhotos: ["/uploads/a.jpg", "/uploads/b.jpg"], coverSrc: "/uploads/a.jpg",
    });
  });

  it("returns the coded price baseline after one entry override", async () => {
    const { priceList } = await import("@/content");
    const { previousChangeFor } = await import("./office-history");
    const { saveEntryOverride } = await import("./live-pricing");
    const coded = priceList[0]!;

    await saveEntryOverride({
      entryId: coded.id,
      fixedPrice: coded.fixedPrice + 100,
      customizationExtra: coded.customizationExtra + 100,
    });
    expect(previousChangeFor("price-entry", coded.id)).toEqual({
      type: "entry",
      key: `entry:${coded.id}`,
      id: coded.id,
      fixedPrice: coded.fixedPrice,
      customizationExtra: coded.customizationExtra,
    });
  });

  it("returns an added alteration's and an added session's own price as the baseline for their first edit", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const {
      saveAddedAlteration,
      saveAddedAppointmentType,
      saveAlterationOverride,
      saveAppointmentOverride,
    } = await import("./live-pricing");
    await saveAddedAlteration({
      id: "alt-cuffs",
      name: { es: "Poner puños", en: "Add cuffs" },
      description: { es: "", en: "" },
      fixedPrice: 3200,
      rushSurcharge: 2000,
      turnaround: { es: "", en: "" },
    });
    await saveAddedAppointmentType({
      id: "ses-fitting",
      minutes: 45,
      name: { es: "Prueba", en: "Fitting" },
      description: { es: "", en: "" },
      fee: 9000,
      depositDue: 9000,
      overtimeRatePerHalfHour: 4000,
      suitedFor: [],
    });

    await saveAlterationOverride({ alterationId: "alt-cuffs", fixedPrice: 3600, rushSurcharge: 2400 });
    await saveAppointmentOverride({ typeId: "ses-fitting", fee: 11000 });
    expect(previousChangeFor("alteration", "alt-cuffs")).toEqual({
      type: "alteration",
      key: "alteration:alt-cuffs",
      id: "alt-cuffs",
      fixedPrice: 3200,
      rushSurcharge: 2000,
    });
    expect(previousChangeFor("appointment", "ses-fitting")).toEqual({
      type: "appointment",
      key: "appointment:ses-fitting",
      id: "ses-fitting",
      fee: 9000,
    });
    expect(undoableIds("alteration")).toContain("alt-cuffs");
    expect(undoableIds("appointment")).toContain("ses-fitting");
  });

  it("uses the empty notice floor and then the prior notice", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveNotice } = await import("./live-catalog");

    await saveNotice({ message: "First", visible: true });
    expect(previousChangeFor("notice", "site")).toEqual({
      type: "notice",
      key: "notice:site",
      message: "",
      visible: false,
    });
    await saveNotice({ message: "Second", visible: true });
    expect(previousChangeFor("notice", "site")).toEqual({
      type: "notice",
      key: "notice:site",
      message: "First",
      visible: true,
    });
  });

  it("uses the shown-by-default floor and then the prior switch, for the visitor helper", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { saveHelperVisibility } = await import("./site-helper");

    await saveHelperVisibility(false);
    expect(previousChangeFor("helper", "site")).toEqual({
      type: "helper",
      key: "helper:site",
      visible: true,
    });
    expect(undoableIds("helper")).toContain("site");

    await saveHelperVisibility(true);
    expect(previousChangeFor("helper", "site")).toEqual({
      type: "helper",
      key: "helper:site",
      visible: false,
    });
  });

  it("returns the earlier promotion after two saves, and nothing after one", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { savePromotion } = await import("./live-promotions");
    const promotion = {
      id: "prm-a3c4d6e7",
      label: { es: "Venta de otoño", en: "Autumn sale" },
      kind: "percent" as const,
      value: 15,
      scope: { type: "category" as const, categoryId: "heritage" },
      endsAt: "2026-09-30",
      active: true,
    };

    // A new promotion is taken back by retiring it, not by an undo.
    await savePromotion(promotion);
    expect(previousChangeFor("promotion", "prm-a3c4d6e7")).toBeUndefined();
    expect(undoableIds("promotion")).not.toContain("prm-a3c4d6e7");

    await savePromotion({ ...promotion, active: false });
    expect(previousChangeFor("promotion", "prm-a3c4d6e7")).toEqual({
      type: "promotion",
      key: "promotion:prm-a3c4d6e7",
      id: "prm-a3c4d6e7",
      label: "Venta de otoño",
      kind: "percent",
      value: 15,
      scope: { type: "category", categoryId: "heritage" },
      endsAt: "2026-09-30",
      active: true,
    });
    expect(undoableIds("promotion")).toContain("prm-a3c4d6e7");
  });

  it("premiere undo returns the seeded words after one override and the first override after two", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { savePremiereOverride } = await import("./live-premieres");
    const { premieres } = await import("@/content");
    const autumn = premieres.find((premiere) => premiere.id === "otono-2026")!;

    expect(previousChangeFor("premiere", "otono-2026")).toBeUndefined();
    expect(undoableIds("premiere")).not.toContain("otono-2026");

    await savePremiereOverride({ premiereId: "otono-2026", piecesPlanned: 5 });
    expect(previousChangeFor("premiere", "otono-2026")).toEqual({
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
      season: autumn.season.es,
      title: autumn.title.es,
      story: autumn.story.es,
      inspiration: autumn.inspiration.es,
      revealDate: autumn.revealDate,
      releaseDate: autumn.releaseDate,
      piecesPlanned: autumn.piecesPlanned,
      editionSize: autumn.editionSize,
      coverImage: autumn.coverImage,
      styleIds: [...autumn.styleIds],
    });
    expect(undoableIds("premiere")).toContain("otono-2026");

    // Whatever record comes back, `previousChangeFor` returns the *whole*
    // snapshot — the seeded words, dates, numbers, cover and checklist —
    // with only piecesPlanned actually overridden by this one record, not
    // a bare `{ piecesPlanned: 5 }`: a record earlier in the history can
    // predate a field a later save introduced (see the checklist test
    // below), so it is never trusted to carry the whole truth on its own.
    await savePremiereOverride({ premiereId: "otono-2026", piecesPlanned: 4 });
    expect(previousChangeFor("premiere", "otono-2026")).toEqual({
      type: "premiere-update",
      key: "premiere:otono-2026",
      premiereId: "otono-2026",
      season: autumn.season.es,
      title: autumn.title.es,
      story: autumn.story.es,
      inspiration: autumn.inspiration.es,
      revealDate: autumn.revealDate,
      releaseDate: autumn.releaseDate,
      piecesPlanned: 5,
      editionSize: autumn.editionSize,
      coverImage: autumn.coverImage,
      styleIds: [...autumn.styleIds],
    });
  });

  it("premiere undo rebuilds the whole snapshot, so a field a record never touched comes back to the seed rather than to whatever a later save carried forward", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { savePremiereOverride } = await import("./live-premieres");
    const { premieres } = await import("@/content");
    const autumn = premieres.find((premiere) => premiere.id === "otono-2026")!;

    // A checklist save alone: undo goes back to the seeded checklist, which
    // the baseline now carries alongside the seeded words.
    await savePremiereOverride({ premiereId: "otono-2026", styleIds: ["frutera"] });
    expect(previousChangeFor("premiere", "otono-2026")).toMatchObject({ styleIds: [...autumn.styleIds] });

    // The action merges every save's own fields forward over the last
    // (see `previousOverrideFields`), so this second record carries the
    // checklist too, even though only pieces was named here. The record
    // *before* this one (the checklist-only save) never named pieces at
    // all — undoing to it must still read pieces as the seed's 6, not
    // silently keep whatever this newer record now carries for it.
    await savePremiereOverride({ premiereId: "otono-2026", styleIds: ["frutera"], piecesPlanned: 5 });
    const previous = previousChangeFor("premiere", "otono-2026");
    expect(previous).toMatchObject({ styleIds: ["frutera"], piecesPlanned: autumn.piecesPlanned });
  });

  it("only makes request status undoable after a second line", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { saveRequest } = await import("./request-store");

    await saveRequest(request("new"));
    expect(previousChangeFor("request-status", "MSG-TEST")).toBeUndefined();
    expect(undoableIds("request-status")).not.toContain("MSG-TEST");

    await saveRequest(request("answered", "office"));
    expect(previousChangeFor("request-status", "MSG-TEST")).toEqual({
      type: "request-status",
      key: "request:MSG-TEST",
      kind: "contact",
      reference: "MSG-TEST",
      status: "new",
    });
  });

  it("does not offer a Stripe line or an unmarked line for undo", async () => {
    const { previousChangeFor, undoableIds } = await import("./office-history");
    const { saveRequest } = await import("./request-store");

    await saveRequest(request("new"));
    await saveRequest(request("answered"));            // unmarked: written before this shipped
    expect(previousChangeFor("request-status", "MSG-TEST")).toBeUndefined();
    expect(undoableIds("request-status")).not.toContain("MSG-TEST");

    await saveRequest(request("paid", "stripe"));
    expect(previousChangeFor("request-status", "MSG-TEST")).toBeUndefined();
    expect(undoableIds("request-status")).not.toContain("MSG-TEST");

    await saveRequest(request("closed", "office"));
    expect(previousChangeFor("request-status", "MSG-TEST")).toMatchObject({ status: "paid" });
    expect(undoableIds("request-status")).toContain("MSG-TEST");
  });

  it("restores the photo order and the studio switch a previous override carried", async () => {
    const { previousChangeFor } = await import("./office-history");
    const { saveStyleOverride } = await import("./live-catalog");
    const a = "/images/real/frutera-capri.jpg";
    const b = "/images/real/frutera-campaign.jpg";

    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, photos: [b, a], inStudio: true });
    await saveStyleOverride({ styleId: "frutera", isPublished: true, stock: {}, photos: [a, b], inStudio: false });
    expect(previousChangeFor("style-override", "frutera")).toEqual({
      type: "style-override",
      key: "style:frutera",
      styleId: "frutera",
      isPublished: true,
      stock: {},
      photos: [b, a],
      inStudio: true,
    });
  });

});

describe("text undo", () => {
  it("stages the previous words", async () => {
    const { saveTextOverride } = await import("./live-text");
    const { previousChangeFor } = await import("./office-history");
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Primera",
    });
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Segunda",
    });

    const change = previousChangeFor("style-text", "s1:description:es");
    expect(change).toMatchObject({
      type: "style-text",
      id: "s1",
      field: "description",
      locale: "es",
      value: "Primera",
    });
  });

  it("stages a return to the coded words when there is only one version", async () => {
    const { saveTextOverride } = await import("./live-text");
    const { previousChangeFor } = await import("./office-history");
    await saveTextOverride({
      subject: "gallery",
      id: "g1",
      field: "caption",
      locale: "en",
      value: "Only",
    });

    expect(previousChangeFor("work-text", "g1:caption:en")).toMatchObject({
      type: "work-text",
      id: "g1",
      field: "caption",
      locale: "en",
      value: "",
    });
  });

  it("offers undo on a field that has been edited once", async () => {
    const { saveTextOverride } = await import("./live-text");
    const { undoableIds } = await import("./office-history");
    await saveTextOverride({
      subject: "style",
      id: "s1",
      field: "name",
      locale: "es",
      value: "Nombre",
    });
    expect(undoableIds("style-text").has("s1:name:es")).toBe(true);
  });
});
