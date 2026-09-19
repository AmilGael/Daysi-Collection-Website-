import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Parte del estreno" has to come from the live checklist, not the coded
 * `style.premiereId`: ticking a garment onto a season from Estrenos stages
 * a `premiere-styles` change (`office/premieres/actions.ts`), which never
 * touches the garment's own record — so a style added to a season after it
 * shipped would otherwise never show the tag. No DOM here, so the fix is
 * checked in the source, the way the checkout and sign-in pages' are.
 */
const source = readFileSync(
  path.join(process.cwd(), "src/app/[locale]/collection/[slug]/page.tsx"),
  "utf8",
);

describe("the garment page's premiere tag", () => {
  it("finds the premiere from the live checklist, not the coded premiereId", () => {
    expect(source).toContain('import { livePremieres } from "@/lib/live-premieres";');
    expect(source).toContain(
      "const premiere = livePremieres().find((candidate) => candidate.styleIds.includes(style.id));",
    );
    expect(source).not.toContain("style.premiereId");
    expect(source).not.toContain("liveFindPremiere");
  });
});
