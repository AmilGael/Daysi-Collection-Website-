import { describe, expect, it } from "vitest";
import { tokenizeAnswer } from "./answer-links";

describe("tokenizeAnswer", () => {
  it("returns one text segment when there is no link", () => {
    expect(tokenizeAnswer("El ruedo de pantalón cuesta $28.")).toEqual([
      { type: "text", value: "El ruedo de pantalón cuesta $28." },
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(tokenizeAnswer("")).toEqual([]);
  });

  it("turns a bare page path into a link, with a locale-agnostic href", () => {
    expect(tokenizeAnswer("Vea /es/alterations para más.")).toEqual([
      { type: "text", value: "Vea " },
      { type: "link", label: "/es/alterations", href: "/alterations" },
      { type: "text", value: " para más." },
    ]);
  });

  it("handles a garment path with nothing before or after it", () => {
    expect(tokenizeAnswer("/en/collection/frutera")).toEqual([
      { type: "link", label: "/en/collection/frutera", href: "/collection/frutera" },
    ]);
  });

  it("handles several links in one answer", () => {
    expect(tokenizeAnswer("Vea /es/appointments o /es/request.")).toEqual([
      { type: "text", value: "Vea " },
      { type: "link", label: "/es/appointments", href: "/appointments" },
      { type: "text", value: " o " },
      { type: "link", label: "/es/request", href: "/request" },
      { type: "text", value: "." },
    ]);
  });

  it("leaves a path that only resembles one of the allowed ones alone", () => {
    const text = "Visite /es/office/prices si trabaja aquí.";
    expect(tokenizeAnswer(text)).toEqual([{ type: "text", value: text }]);
  });

  it("does not match an unlisted locale or an unlisted page", () => {
    expect(tokenizeAnswer("Vea /fr/alterations o /es/office.")).toEqual([
      { type: "text", value: "Vea /fr/alterations o /es/office." },
    ]);
  });
});
