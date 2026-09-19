import fs from "node:fs";
import { describe, expect, it } from "vitest";

const pages = ["request", "appointments", "contact", "design-studio", "cart"];

describe("forms a signed-in client opens", () => {
  it("start from what their card knows", () => {
    for (const page of pages) {
      const source = fs.readFileSync(`src/app/[locale]/${page}/page.tsx`, "utf8");
      expect(source, page).toContain("knownContact(");
    }
  });
});
