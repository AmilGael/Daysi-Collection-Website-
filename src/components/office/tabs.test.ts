import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { OFFICE_TABS } from "./tabs";

/**
 * The office is eight tabs, and everything that has to agree about them,
 * the routes, the smoke script, the two languages, the guard, is checked
 * here against one list rather than trusted to stay in step by hand.
 */

const officeMessages = (bundle: { office: Record<string, string> }) => bundle.office;

describe("the office tabs", () => {
  it("are eight, in the agreed order, each under /office", () => {
    expect(OFFICE_TABS.map((tab) => tab.id)).toEqual([
      "today",
      "work",
      "collection",
      "gallery",
      "fabrics",
      "prices",
      "shopfront",
      "books",
    ]);
    for (const tab of OFFICE_TABS) {
      expect(tab.href === "/office" || tab.href.startsWith("/office/")).toBe(true);
    }
    expect(new Set(OFFICE_TABS.map((tab) => tab.href)).size).toBe(OFFICE_TABS.length);
  });

  it("are named in both languages, and the strip has a name too", () => {
    for (const bundle of [es, en]) {
      const office = officeMessages(bundle);
      expect(office.tabsLabel).toBeTruthy();
      expect(office.tabsLabel).not.toContain("—");
      for (const tab of OFFICE_TABS) {
        expect(office[tab.labelKey], `${tab.id} label`).toBeTruthy();
        expect(office[tab.labelKey]).not.toContain("—");
      }
    }
  });
});

const officeDir = path.join(process.cwd(), "src/app/[locale]/office");

function read(relative: string): string {
  return fs.readFileSync(path.join(officeDir, relative), "utf8");
}

/** A page is guarded when it awaits the shared helper and nothing else. */
function expectGuarded(relative: string) {
  const source = read(relative);
  expect(source, `${relative} awaits officeViewer`).toContain("await officeViewer(");
  expect(source, `${relative} does not call currentViewer itself`).not.toContain("currentViewer(");
  expect(source, `${relative} does not compare roles itself`).not.toMatch(/role !== "owner"/);
}

describe("the office layout", () => {
  it("checks the owner once, through the helper", () => {
    expectGuarded("layout.tsx");
  });

  it("has a helper that redirects the signed-out and hides from the rest", () => {
    const source = read("_lib/viewer.ts");
    expect(source).toContain("redirect(`/${locale}/sign-in`)");
    expect(source).toContain("notFound()");
  });
});

describe("the today tab", () => {
  it("is guarded", () => {
    expectGuarded("page.tsx");
  });
});

describe("the work tab", () => {
  it("is guarded", () => {
    expectGuarded("work/page.tsx");
  });
});

describe("the collection tab", () => {
  it("is guarded", () => {
    expectGuarded("collection/page.tsx");
  });
});

describe("the gallery tab", () => {
  it("is guarded", () => {
    expectGuarded("gallery/page.tsx");
  });
});

describe("the fabrics tab", () => {
  it("is guarded", () => {
    expectGuarded("fabrics/page.tsx");
  });
});

describe("the prices tab", () => {
  it("is guarded", () => {
    expectGuarded("prices/page.tsx");
  });
});

describe("the shopfront tab", () => {
  it("is guarded", () => {
    expectGuarded("shopfront/page.tsx");
  });
});

describe("the books tab", () => {
  it("is guarded", () => {
    expectGuarded("books/page.tsx");
  });
});

describe("every tab in the list", () => {
  it("matches the pages on disk exactly, and every one of them is guarded", () => {
    const onDisk = fs
      .readdirSync(officeDir, { recursive: true })
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith("page.tsx"))
      .map((entry) => entry.split(path.sep).join("/"))
      .sort();

    const listed = OFFICE_TABS.map((tab) =>
      tab.href === "/office" ? "page.tsx" : `${tab.href.slice("/office/".length)}/page.tsx`,
    ).sort();

    expect(onDisk, "an unlisted page.tsx under office/ would show up here").toEqual(listed);

    for (const relative of listed) {
      expectGuarded(relative);
    }
  });
});

describe("the smoke script", () => {
  it("checks that every tab is private", () => {
    const smoke = fs.readFileSync(path.join(process.cwd(), "scripts/smoke.mjs"), "utf8");
    for (const tab of OFFICE_TABS) {
      expect(smoke, `${tab.href} in PRIVATE`).toContain(`"${tab.href}"`);
    }
  });
});

describe("where the office tabs live", () => {
  it("is the site header, which swaps the store links for them inside the office", () => {
    const header = fs.readFileSync(path.join(process.cwd(), "src/components/site-header.tsx"), "utf8");
    expect(header).toContain("OFFICE_TABS");
    expect(header).toContain("<OfficeTabs");
  });

  it("is not the office layout, so there is one row of tabs and not two", () => {
    expect(read("layout.tsx")).not.toContain("OfficeTabs");
  });
});
