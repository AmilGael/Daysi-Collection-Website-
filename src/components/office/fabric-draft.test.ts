import { describe, expect, it } from "vitest";
import { fabricAddWire, pricesFromEntries, representativePrice } from "./fabric-draft";

describe("representativePrice", () => {
  it("is null for a fabric with no priced pair", () => {
    expect(representativePrice({})).toBeNull();
  });

  it("shows the one price plainly when every priced pair agrees", () => {
    expect(representativePrice({ dresses: 19500, pants: 19500 })).toEqual({
      cents: 19500,
      varies: false,
    });
  });

  it("is a single priced pair, not varying", () => {
    expect(representativePrice({ pants: 17500 })).toEqual({ cents: 17500, varies: false });
  });

  it("is the lowest priced pair, flagged as varying, when the pairs disagree", () => {
    // wax-print: shirts 12000, heritage 29500 (content/price-list.ts).
    expect(representativePrice({ shirts: 12000, heritage: 29500 })).toEqual({
      cents: 12000,
      varies: true,
    });
  });
});

describe("fabricAddWire", () => {
  it("writes the one figure into every category pair", () => {
    const wire = fabricAddWire("fabric-add:1", "Popelina cereza", "/uploads/swatch.jpg", "#a1a1a1", 22500);
    expect(wire).toEqual({
      type: "fabric-add",
      key: "fabric-add:1",
      name: "Popelina cereza",
      swatchImage: "/uploads/swatch.jpg",
      averageColor: "#a1a1a1",
      prices: { dresses: 22500, pants: 22500, shirts: 22500, heritage: 22500 },
    });
  });

  it("agrees with itself, so the price it writes never varies", () => {
    const wire = fabricAddWire("fabric-add:2", "Lino azul", "", "#000000", 15000);
    expect(representativePrice(wire.type === "fabric-add" ? wire.prices : {})).toEqual({
      cents: 15000,
      varies: false,
    });
  });
});

describe("pricesFromEntries", () => {
  const entries = [
    { fabricId: "wax-print", categoryId: "shirts", fixedPrice: 12000 },
    { fabricId: "wax-print", categoryId: "heritage", fixedPrice: 29500 },
    { fabricId: "daisy-cotton", categoryId: "dresses", fixedPrice: 19500 },
  ];

  it("keeps only the entries for the named fabric, by category", () => {
    expect(pricesFromEntries("wax-print", entries)).toEqual({ shirts: 12000, heritage: 29500 });
  });

  it("is empty for a fabric with no priced pair", () => {
    expect(pricesFromEntries("frutera-print", entries)).toEqual({});
  });

  it("drops an entry whose category is not one of the four", () => {
    expect(
      pricesFromEntries("wax-print", [...entries, { fabricId: "wax-print", categoryId: "capes", fixedPrice: 500 }]),
    ).toEqual({ shirts: 12000, heritage: 29500 });
  });
});
