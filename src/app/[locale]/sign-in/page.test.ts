import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The sign-in page moved off `PageHeader` and onto the homepage hero's own
 * recipe — the woven backdrop, the ink gradient, a centred paper card with
 * the mark on top — so the header goes light over it the way it does on the
 * homepage. No DOM in these tests, so the agreement is checked in the
 * source, the way the office confirm bar's is.
 */
const pageSource = readFileSync(
  path.join(process.cwd(), "src/app/[locale]/sign-in/page.tsx"),
  "utf8",
);
const formSource = readFileSync(
  path.join(process.cwd(), "src/components/sign-in-form.tsx"),
  "utf8",
);
const headerSource = readFileSync(
  path.join(process.cwd(), "src/components/site-header.tsx"),
  "utf8",
);

const accountMessages = (bundle: { account: object }) => bundle.account as Record<string, string>;

describe("the sign-in page", () => {
  it("reuses the homepage hero's exact backdrop, not a copy of its content", () => {
    expect(pageSource).toContain('import { HERO_BACKDROP } from "@/content/photographs"');
    expect(pageSource).toContain("HERO_BACKDROP");
    expect(pageSource).toContain('quality={70}');
    expect(pageSource).toContain("opacity-55");
    expect(pageSource).toContain("bg-gradient-to-b from-ink/70 via-ink/15 to-ink/85");
  });

  it("drops PageHeader for a centred paper card with the mark on top", () => {
    expect(pageSource).not.toContain("PageHeader");
    expect(pageSource).toContain('import { DaisyMark } from "@/components/logo"');
    expect(pageSource).toContain("DaisyMark");
    expect(pageSource).toContain("bg-paper");
  });

  it("keeps the rate/link error alert inside the card", () => {
    expect(pageSource).toContain('role="alert"');
    expect(pageSource).toContain("signInRateError");
    expect(pageSource).toContain("signInLinkError");
  });

  it("is a dark-hero route, so the header inverts over it like the homepage", () => {
    expect(headerSource).toContain('const DARK_HERO_ROUTES = ["/", "/premieres", "/atelier", "/sign-in"];');
  });
});

describe("the sign-in form", () => {
  it("uses the shared button styling, full width, for both ways in", () => {
    expect(formSource).toContain('import { buttonClass } from "./ui"');
    expect(formSource).toContain('buttonClass({ tone: "solid", className: "w-full" })');
    expect(formSource).toContain('tone: "outline"');
  });

  it("renders the sent state inside the same card, not a boxed block of its own", () => {
    expect(formSource).not.toContain("bg-paper-warm p-8");
  });

  it("names the divider between the two ways in, in both languages", () => {
    expect(formSource).toContain('t("orDivider")');
    expect(accountMessages(es).orDivider).toBe("o");
    expect(accountMessages(en).orDivider).toBe("or");
  });
});
