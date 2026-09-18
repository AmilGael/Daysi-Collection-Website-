import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GalleryWork } from "@/content/types";
import {
  assembleGallery,
  assembleSections,
  galleryByCategory,
  sectionId,
  sectionLabel,
  type GallerySection,
  type GalleryVisibility,
} from "./live-gallery";

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

describe("the office gallery page's coded captions", () => {
  it("does not filter the coded works by visibility", () => {
    // assembleGallery drops hidden works. If the page built its coded map with
    // the real visibility records, a hidden photo would have no coded entry and
    // fall back to its merged caption, and clearing its caption box would then
    // look like a no-op edit and never stage. Found in review, 2026-09-03.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/app/[locale]/office/gallery/page.tsx"),
      "utf8",
    );
    const coded = source.slice(source.indexOf("codedWorks"), source.indexOf("manageableGallery()"));
    expect(coded).toContain("assembleGallery(");
    expect(coded).not.toContain("galleryVisibility");
  });

  it("keeps a hidden work out of the assembled gallery", () => {
    const seed = [
      { id: "g1", src: "/g.jpg", width: 10, height: 10, category: "runway", caption: { es: "A", en: "A" } },
    ] as const;
    expect(assembleGallery(seed, [], [{ id: "g1", hidden: true }])).toHaveLength(0);
    expect(assembleGallery(seed, [], [])).toHaveLength(1);
  });
});

const section = (id: string, over: Partial<GallerySection> = {}): GallerySection => ({
  id,
  name: { es: id, en: id },
  addedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("assembling gallery sections", () => {
  it("lists the six coded ids first, then added sections by addedAt", () => {
    const sections = assembleSections(
      [
        section("sec-b", { addedAt: "2026-09-02T00:00:00.000Z" }),
        section("sec-a", { addedAt: "2026-09-01T00:00:00.000Z" }),
      ],
      new Set(),
    );
    expect(sections.map((s) => s.id)).toEqual([
      "runway", "commissions", "bridal", "accessories", "workroom", "press", "sec-a", "sec-b",
    ]);
    expect(sections.slice(0, 6).every((s) => s.coded)).toBe(true);
    expect(sections.slice(6).every((s) => !s.coded)).toBe(true);
  });

  it("drops a retired added section, and never a coded one even if named in `retired`", () => {
    const sections = assembleSections([section("sec-a")], new Set(["sec-a", "runway"]));
    expect(sections.map((s) => s.id)).toEqual([
      "runway", "commissions", "bridal", "accessories", "workroom", "press",
    ]);
  });

  it("keeps the newest of two records for the same added section id", () => {
    const sections = assembleSections(
      [section("sec-a", { name: { es: "first", en: "first" } }), section("sec-a", { name: { es: "second", en: "second" } })],
      new Set(),
    );
    expect(sections.find((s) => s.id === "sec-a")?.name).toEqual({ es: "second", en: "second" });
  });

  it("slugs an accented Spanish name to sec-…", () => {
    expect(sectionId("Quinceañeras")).toBe("sec-quinceaneras");
    expect(sectionId("Otra")).toBe("sec-otra");
  });
});

describe("sectionLabel", () => {
  it("reads a coded section's label from the caller's translator", () => {
    const t = (key: string) => (key === "category.runway" ? "Pasarela" : `missing:${key}`);
    expect(sectionLabel({ id: "runway", coded: true }, t, "es")).toBe("Pasarela");
  });

  it("reads an added section's own name, in the given locale", () => {
    const added = section("sec-a", { name: { es: "Especial", en: "Special" } });
    const view = assembleSections([added], new Set()).find((s) => s.id === "sec-a")!;
    const t = () => "unused";
    expect(sectionLabel(view, t, "es")).toBe("Especial");
    expect(sectionLabel(view, t, "en")).toBe("Special");
  });
});

describe("galleryByCategory", () => {
  it("groups works under an added section, in the sections' order, and skips empty ones", () => {
    const sections = assembleSections([section("sec-a", { name: { es: "Especial", en: "Special" } })], new Set());
    const works = [work("g1", { category: "sec-a" }), work("g2", { category: "runway" })];
    const grouped = galleryByCategory(works, sections);
    expect(grouped.map((group) => group.section.id)).toEqual(["runway", "sec-a"]);
    expect(grouped.find((group) => group.section.id === "sec-a")?.works.map((w) => w.id)).toEqual(["g1"]);
  });
});
