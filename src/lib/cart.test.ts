import { describe, expect, it } from "vitest";
import { addLine, cartCount, emptyCart, removeLine, setQuantity, type Cart } from "./cart";
import { estimateCart } from "./pricing";
import { liveFindPriceEntry as findPriceEntry } from "./live-pricing";

const line = (over: Partial<Cart["lines"][number]> = {}) => ({
  styleSlug: "frutera",
  sizeId: "m" as const,
  customize: false,
  quantity: 1,
  ...over,
});

describe("the cart", () => {
  it("merges the same garment, size and finish into one line", () => {
    const cart = addLine(addLine(emptyCart, line()), line());
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(2);
  });

  it("keeps a made-to-measure piece separate from an off-the-rack one", () => {
    const cart = addLine(addLine(emptyCart, line()), line({ customize: true }));
    expect(cart.lines).toHaveLength(2);
  });

  it("caps a line rather than letting a number grow without bound", () => {
    const cart = setQuantity(addLine(emptyCart, line()), 0, 9999);
    expect(cart.lines[0]!.quantity).toBe(5);
  });

  it("treats a quantity of zero as removing the line", () => {
    expect(setQuantity(addLine(emptyCart, line()), 0, 0).lines).toHaveLength(0);
    expect(removeLine(addLine(emptyCart, line()), 0).lines).toHaveLength(0);
  });

  it("counts pieces, not lines", () => {
    const cart = addLine(addLine(emptyCart, line()), line({ sizeId: "s" }));
    expect(cartCount(setQuantity(cart, 0, 3))).toBe(4);
  });
});

describe("pricing a cart", () => {
  it("multiplies the published price by the quantity", () => {
    const published = findPriceEntry("heritage--frutera-print")!;
    const estimate = estimateCart([line({ quantity: 3 })]);
    expect(estimate?.subtotal).toBe(published.fixedPrice * 3);
  });

  it("ignores a line naming a garment that does not exist", () => {
    // A tampered cookie can shrink the basket; it can never discount it.
    const published = findPriceEntry("heritage--frutera-print")!;
    const estimate = estimateCart([line(), line({ styleSlug: "free-dress-please" })]);
    expect(estimate?.subtotal).toBe(published.fixedPrice);
  });

  it("ignores a size the garment is not offered in", () => {
    expect(estimateCart([line({ sizeId: "xxl" as never })])).toBeNull();
  });

  it("puts the whole basket on deposit terms if any piece is made to measure", () => {
    const offRack = estimateCart([line()])!;
    const mixed = estimateCart([line(), line({ sizeId: "s", customize: true })])!;

    expect(offRack.dueNow).toBe(offRack.total);
    expect(mixed.dueNow).toBe(Math.round(mixed.total / 2));
    expect(mixed.dueNow + mixed.dueOnCollection).toBe(mixed.total);
  });

  it("has nothing to price when the cart is empty", () => {
    expect(estimateCart([])).toBeNull();
  });
});
