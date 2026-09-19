import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Dónde va" can follow a section she just named through "Otra…" into a
 * normal option (see the comment on `pendingSections`), so a second photo
 * can join it without typing the name again. If that pending section then
 * drops out — its one photo removed, or the whole draft discarded — the
 * picker used to keep pointing at an id no option carried any more. No DOM
 * in these tests, so the agreement is checked in the source.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/gallery-manager.tsx"), "utf8");

describe("the category picker after a pending section drops out", () => {
  it("resets to the first live section once its own option is gone", () => {
    expect(source).toContain("if (category === OTHER) return;");
    expect(source).toContain("if (options.some((option) => option.id === category)) return;");
    expect(source).toContain("setCategory(categories[0]?.id ?? OTHER);");
    expect(source).toContain("}, [options, categories, category]);");
    // Runs on the same options a stale selection has to be checked against.
    const effectAt = source.indexOf("useEffect(() => {\n    if (category === OTHER) return;");
    const optionsAt = source.indexOf("const options = [...categories, ...pendingSections];");
    expect(effectAt).toBeGreaterThan(optionsAt);
  });
});
