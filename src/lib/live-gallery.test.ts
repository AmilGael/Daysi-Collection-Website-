import { describe, expect, it } from "vitest";
import type { GalleryWork } from "@/content/types";
import { assembleGallery, type GalleryVisibility } from "./live-gallery";

const work = (id: string, over: Partial<GalleryWork> = {}): GalleryWork => ({
  id,
  src: `/images/gallery/${id}.jpg`,
  width: 1000,
  height: 1500,
  category: "commissions",
  caption: { en: id, es: id },
  ...over,
});

const hide = (id: string, hidden = true): GalleryVisibility => ({ id, hidden });

describe("assembling the gallery", () => {
  it("shows the seeded works when Daysi has changed nothing", () => {
    const seed = [work("a"), work("b")];
    expect(assembleGallery(seed, [], []).map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("puts a work she added after the ones that shipped with the site", () => {
    const result = assembleGallery([work("a")], [work("new")], []);
    expect(result.map((w) => w.id)).toEqual(["a", "new"]);
  });

  it("takes down a seeded work she has hidden", () => {
    const result = assembleGallery([work("a"), work("b")], [], [hide("a")]);
    expect(result.map((w) => w.id)).toEqual(["b"]);
  });

  it("takes down a work she added and then hid", () => {
    const result = assembleGallery([], [work("new")], [hide("new")]);
    expect(result).toEqual([]);
  });

  it("puts a work back when a later record un-hides it", () => {
    const result = assembleGallery([work("a")], [], [hide("a"), hide("a", false)]);
    expect(result.map((w) => w.id)).toEqual(["a"]);
  });

  it("lets a re-added id replace the seeded work rather than duplicate it", () => {
    const seed = [work("a", { caption: { en: "old", es: "old" } })];
    const added = [work("a", { caption: { en: "new", es: "new" } })];
    const result = assembleGallery(seed, added, []);
    expect(result).toHaveLength(1);
    expect(result[0]?.caption.en).toBe("new");
  });

  it("keeps the newest of two records for the same added id", () => {
    const added = [work("x", { caption: { en: "first", es: "first" } }),
                   work("x", { caption: { en: "second", es: "second" } })];
    const result = assembleGallery([], added, []);
    expect(result).toHaveLength(1);
    expect(result[0]?.caption.en).toBe("second");
  });

  it("drops a retired seeded work", () => {
    expect(assembleGallery([work("a"), work("b")], [], [], new Set(["a"])).map((w) => w.id)).toEqual(["b"]);
  });

  it("drops a retired added work", () => {
    expect(assembleGallery([], [work("new")], [], new Set(["new"]))).toEqual([]);
  });

  it("drops a hidden and retired work once without crashing", () => {
    expect(assembleGallery([work("a")], [], [hide("a")], new Set(["a"]))).toEqual([]);
  });
});

describe("assembleGallery with text overrides", () => {
  it("applies a caption override", () => {
    const seed = [
      {
        id: "g1",
        src: "/g.jpg",
        width: 10,
        height: 10,
        category: "runway",
        caption: { es: "Viejo", en: "Old" },
      },
    ] as const;
    const merged = assembleGallery(seed, [], [], new Set(), [
      {
        subject: "gallery",
        id: "g1",
        field: "caption",
        locale: "en",
        value: "New caption",
        updatedAt: "2026-09-03T00:00:00.000Z",
      },
    ]);
    expect(merged[0]!.caption).toEqual({ es: "Viejo", en: "New caption" });
  });
});
