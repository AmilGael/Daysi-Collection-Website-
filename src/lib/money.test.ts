import { describe, expect, it } from "vitest";
import { centsFromInput } from "./money";

describe("centsFromInput", () => {
  it("reads a price typed with a point", () => {
    expect(centsFromInput("195.00")).toBe(19500);
    expect(centsFromInput("195")).toBe(19500);
    expect(centsFromInput("76.5")).toBe(7650);
    expect(centsFromInput("0")).toBe(0);
  });

  it("reads a price typed with a comma, which is what a Spanish keypad offers", () => {
    expect(centsFromInput("195,50")).toBe(19550);
    expect(centsFromInput(" 44,00 ")).toBe(4400);
  });

  it("returns null for anything that is not an amount", () => {
    for (const text of ["", "   ", "abc", "-1", "1.2.3", "1,000.00", "12.345", "$5"]) {
      expect(centsFromInput(text), JSON.stringify(text)).toBeNull();
    }
  });
});
