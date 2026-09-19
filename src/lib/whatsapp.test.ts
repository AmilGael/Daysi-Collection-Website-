import { describe, expect, it } from "vitest";
import { whatsappLink } from "./whatsapp";

/**
 * A client's phone is typed as she gave it, not dialled in E.164 —
 * "(718) 555-1234" — and stripping it to bare digits alone reads as +7,
 * the wrong country. `whatsappLink` has to tell a US number missing its
 * "1" from one that already has it, and leave anything else (a typed "+")
 * alone. Daysi's own number, used when no client phone is given, already
 * carries a "+" and must come through unchanged.
 */

describe("whatsappLink", () => {
  it("prefixes a bare 10-digit US number with 1", () => {
    expect(whatsappLink("hola", "(718) 555-1234")).toBe(
      "https://wa.me/17185551234?text=hola",
    );
  });

  it("keeps an 11-digit number that already starts with 1", () => {
    expect(whatsappLink("hola", "1 (718) 555-1234")).toBe(
      "https://wa.me/17185551234?text=hola",
    );
  });

  it("keeps every digit of a typed country code, marked with a +", () => {
    expect(whatsappLink("hola", "+52 55 1234 5678")).toBe(
      "https://wa.me/525512345678?text=hola",
    );
  });

  it("reaches Daysi's own number, unchanged, when no phone is given", () => {
    expect(whatsappLink("hola")).toBe("https://wa.me/19176887260?text=hola");
  });
});
