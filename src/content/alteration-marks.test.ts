import { describe, expect, it } from "vitest";
import { alterationServices } from "./price-list";
import { alterationMarks, markFor, needleMark } from "./alteration-marks";

/**
 * The alterations page is cards now, and a card with nothing to look at is
 * the table it replaced. Every alteration the site ships with has its own
 * drawing; the needle is only for one Daysi adds without a photo.
 */
describe("the alteration drawings", () => {
  it.each(alterationServices.map((alteration) => alteration.id))("draws %s", (id) => {
    const mark = alterationMarks[id];
    expect(mark, id).toBeDefined();
    expect(markFor(id)).not.toBe(needleMark);
    expect(mark!.lines.length).toBeGreaterThan(0);
  });

  it("gives an alteration it has no drawing for the needle", () => {
    expect(markFor("alt-3kx7q9pd")).toBe(needleMark);
  });

  it("draws only path data, inside the 48 × 48 box", () => {
    for (const mark of [...Object.values(alterationMarks), needleMark]) {
      for (const d of [...mark.lines, ...mark.marks]) {
        expect(d).toMatch(/^M[-\d. ACLMQSZ]+$/);
        const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
        expect(Math.min(...numbers), d).toBeGreaterThanOrEqual(0);
        expect(Math.max(...numbers), d).toBeLessThanOrEqual(48);
      }
    }
  });
});
