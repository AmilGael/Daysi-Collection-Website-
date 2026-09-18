import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * A client who arrives with `?kind=alteration` (or `?kind=commission`) is
 * set on that kind already: the form shows a heading, not the two-option
 * chooser, and a "Cambiar"/"Change" link back to a bare /request undoes the
 * lock. With no `?kind` (or an unknown one) the chooser still shows both
 * remaining kinds, as before Task 6. No DOM here, so this reads the source,
 * the way the collection tab's test does.
 */
const at = (relative: string) => path.join(process.cwd(), relative);
const read = (relative: string) => readFileSync(at(relative), "utf8");

const form = read("src/components/request-form.tsx");
const page = read("src/app/[locale]/request/page.tsx");
const request = (bundle: { request: object }) =>
  bundle.request as Record<string, string>;

describe("the request form's locked kind", () => {
  it("branches the heading vs. the chooser on lockedKind", () => {
    expect(form).toContain("lockedKind ?");
    expect(form).toContain("lockedKind: Kind | null;");
  });

  it("shows a Change link back to a bare /request, not a query", () => {
    expect(form).toContain('import { TextLink } from "@/components/ui";');
    expect(form).toContain(
      '<TextLink href="/request">{t("changeKind")}</TextLink>',
    );
  });

  it("reuses the ChoiceGroup's own labels for the locked heading, duplicating no copy", () => {
    expect(form).toContain(
      't(kind === "alteration" ? "kindAlteration" : "kindCommission")',
    );
  });

  it("pre-ticks initialAlterationId only when it names a live alteration", () => {
    expect(form).toContain("initialAlterationId?: string");
    expect(form).toContain(
      "alterations.some((alteration) => alteration.id === initialAlterationId)",
    );
  });

  it("has changeKind in both message bundles, and nowhere else duplicated", () => {
    for (const bundle of [es, en]) {
      expect(request(bundle).changeKind, "changeKind").toBeTruthy();
    }
    expect(request(es).changeKind).toBe("Cambiar");
    expect(request(en).changeKind).toBe("Change");
  });
});

describe("the request page's ?kind and ?alteration", () => {
  it("locks only on a kind the form still offers", () => {
    expect(page).toContain("const locked = KINDS.includes(requested as Kind);");
    expect(page).toContain("lockedKind={locked ? kind : null}");
  });

  it("reads ?alteration and hands it to the form, without validating it itself", () => {
    expect(page).toContain(
      "const initialAlterationId = first(query.alteration);",
    );
    expect(page).toContain("initialAlterationId={initialAlterationId}");
  });
});
