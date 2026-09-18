import { describe, expect, it } from "vitest";
import { sizeState } from "./index";

describe("what a size says beside it", () => {
  it("is ready while counted pieces are left, or the switch is on", () => {
    expect(sizeState({ sizeId: "s", inStock: true, count: 2 })).toBe("inStock");
    expect(sizeState({ sizeId: "s", inStock: true })).toBe("inStock");
  });

  it("is sold out once a counted size has none left", () => {
    expect(sizeState({ sizeId: "s", inStock: false, count: 0 })).toBe("soldOut");
  });

  it("is made to order for a size never counted and switched off", () => {
    expect(sizeState({ sizeId: "s", inStock: false })).toBe("madeToOrder");
  });
});
