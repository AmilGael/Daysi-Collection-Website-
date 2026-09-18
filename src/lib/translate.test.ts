import { describe, expect, it, vi } from "vitest";
import {
  translateToEnglish,
  withEnglish,
  type TranslationCall,
  type TranslationRequest,
} from "./translate";

const spanish = {
  name: "Conjunto Frutera",
  color: "Esmeralda sobre una escena de mercado pintada",
  description: "Blusa esmeralda con lazo sobre una falda de fruteras con canastas.",
  detail: "",
};

describe("translateToEnglish", () => {
  it("returns what the call hands back, by field", async () => {
    const call: TranslationCall = vi.fn(async () => ({
      name: "Frutera two-piece",
      color: "Emerald over a painted market scene",
      description: "An emerald bow blouse over a skirt of market women carrying fruit.",
    }));
    const english = await translateToEnglish(spanish, "garment", call);
    expect(english).toEqual({
      name: "Frutera two-piece",
      color: "Emerald over a painted market scene",
      description: "An emerald bow blouse over a skirt of market women carrying fruit.",
    });
  });

  it("asks only for the fields that have words in them", async () => {
    const requests: TranslationRequest[] = [];
    const call: TranslationCall = async (request) => {
      requests.push(request);
      return Object.fromEntries(request.keys.map((key) => [key, `en ${key}`]));
    };
    await translateToEnglish(spanish, "garment", call);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.keys).toEqual(["name", "color", "description"]);
    expect(requests[0]!.prompt).toContain("Conjunto Frutera");
    expect(requests[0]!.system).toContain("Garífuna");
  });

  it("tells the model an added alteration or session is a line on the price list", async () => {
    const requests: TranslationRequest[] = [];
    const call: TranslationCall = async (request) => {
      requests.push(request);
      return Object.fromEntries(request.keys.map((key) => [key, `en ${key}`]));
    };
    await translateToEnglish({ name: "Poner puños", turnaround: "4–6 días" }, "alteration", call);
    expect(requests[0]!.prompt).toContain("Context: a service on the atelier's price list");
    expect(requests[0]!.prompt).not.toContain("a garment for sale");
  });

  it("returns null, and makes no call, when there is nothing to translate or no service", async () => {
    const call = vi.fn(async () => ({}));
    expect(await translateToEnglish({ detail: "  " }, "garment", call)).toBeNull();
    expect(call).not.toHaveBeenCalled();
    expect(await translateToEnglish(spanish, "garment", null)).toBeNull();
  });

  it("returns null when the reply is malformed, missing a field, or the call throws", async () => {
    expect(await translateToEnglish(spanish, "garment", async () => ({ name: 5 }))).toBeNull();
    expect(await translateToEnglish(spanish, "garment", async () => ({ name: "Frutera" }))).toBeNull();
    expect(
      await translateToEnglish(spanish, "garment", async () => {
        throw new Error("timeout");
      }),
    ).toBeNull();
  });
});

describe("withEnglish", () => {
  it("pairs each Spanish field with its English", () => {
    expect(withEnglish({ name: "Conjunto", detail: "" }, { name: "Two-piece" })).toEqual({
      name: { es: "Conjunto", en: "Two-piece" },
      detail: { es: "", en: "" },
    });
  });

  it("copies the Spanish where there is no English, which the office reads as pending", () => {
    expect(withEnglish({ name: "Conjunto", color: "Verde" }, null)).toEqual({
      name: { es: "Conjunto", en: "Conjunto" },
      color: { es: "Verde", en: "Verde" },
    });
    expect(withEnglish({ name: "Conjunto", color: "Verde" }, { name: "Two-piece" })).toEqual({
      name: { es: "Conjunto", en: "Two-piece" },
      color: { es: "Verde", en: "Verde" },
    });
  });
});
