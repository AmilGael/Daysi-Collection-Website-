import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A piece from the collection is priced and bought on its own page, so the
 * estimate builder on /prices sends that choice straight to the collection
 * instead of rebuilding a garment picker of its own.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/estimate-builder.tsx"), "utf8");

describe("the estimate builder's collection choice", () => {
  it("takes the visitor to the collection rather than estimating a garment here", () => {
    expect(source).toContain('next === "ready-made" ? router.push("/collection") : setKind(next)');
    expect(source).not.toContain('kind === "ready-made" ?');
  });

  it("opens on something it can estimate", () => {
    expect(source).toContain('useState<Kind>("commission")');
  });
});

describe("the estimate builder's send button", () => {
  it("carries what was chosen, not only the kind", () => {
    expect(source).toContain("href={handoffHref(");
    expect(source).toContain("{ kind, appointmentTypeId }");
    expect(source).toContain("{ kind, alterationIds, rush }");
    expect(source).toContain("{ kind, categoryId, fabricId }");
    expect(source).not.toContain('"/request?kind=');
    expect(source).not.toContain('? "/appointments"');
  });
});
