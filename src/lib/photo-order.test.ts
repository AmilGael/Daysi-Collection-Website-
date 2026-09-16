import { describe, expect, it } from "vitest";
import { addFiles, coverSlot, moveSlot, removeSlot, slotKey, type PhotoSlot } from "./photo-order";

const src = (name: string): PhotoSlot => ({ kind: "src", src: `/images/real/${name}.jpg` });
const file = (name: string): PhotoSlot => ({
  kind: "file",
  file: new File(["x"], `${name}.jpg`, { type: "image/jpeg" }),
  preview: `blob:${name}`,
});
const keys = (slots: readonly PhotoSlot[]) => slots.map(slotKey);

describe("the photo list", () => {
  it("moves a photo earlier or later and stays put at the edges", () => {
    const list = [src("a"), src("b"), src("c")];
    expect(keys(moveSlot(list, 2, 1))).toEqual(keys([src("a"), src("c"), src("b")]));
    expect(keys(moveSlot(list, 0, -1))).toEqual(keys(list));
    expect(keys(moveSlot(list, 2, 3))).toEqual(keys(list));
  });

  it("makes any photo the cover by moving it first", () => {
    expect(keys(coverSlot([src("a"), src("b"), src("c")], 2))).toEqual(keys([src("c"), src("a"), src("b")]));
  });

  it("removes a photo, but never the last one", () => {
    expect(keys(removeSlot([src("a"), src("b")], 0))).toEqual(keys([src("b")]));
    expect(keys(removeSlot([src("a")], 0))).toEqual(keys([src("a")]));
  });

  it("appends files as pending slots with a preview each, up to twelve in all", () => {
    const list = [src("a")];
    const chosen = new File(["x"], "p.jpg", { type: "image/jpeg" });
    const next = addFiles(list, [chosen], (f) => `blob:${f.name}`);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ kind: "file", preview: "blob:p.jpg" });
    const full = Array.from({ length: 12 }, (_, index) => src(`s${index}`));
    expect(addFiles(full, [new File([], "extra.jpg")], () => "blob:extra")).toHaveLength(12);
    const eight = Array.from({ length: 8 }, (_, index) => src(`e${index}`));
    expect(addFiles(eight, [new File([], "extra.jpg")], () => "blob:extra", 8)).toHaveLength(8);
  });

  it("keys a slot by its src or its preview, so React can tell them apart", () => {
    expect(slotKey(src("a"))).toBe("/images/real/a.jpg");
    expect(slotKey(file("p"))).toBe("blob:p");
  });
});
