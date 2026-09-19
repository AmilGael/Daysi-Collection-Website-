import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HERO_IMAGE } from "@/content/photographs";

/**
 * The preview WhatsApp and Facebook draw for a shared link.
 *
 * Next writes og:image as an absolute address, resolved against
 * `metadataBase`. With none set it falls back to http://localhost:3000, and
 * that is what the live site handed every link preview until September 2026:
 * an image address no phone can reach, so the preview came up with no picture.
 */

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const copy = { title: "Daysi Collection", description: "Hecho en el Bronx" };

async function metadataWithSiteUrl(siteUrl: string) {
  vi.stubEnv("SITE_URL", siteUrl);
  const { siteMetadata } = await import("./site-metadata");
  return siteMetadata(copy);
}

describe("the site's shared metadata", () => {
  it("resolves the preview image against the site's own address", async () => {
    const metadata = await metadataWithSiteUrl("https://daysiscollectioninc.com");

    expect(String(metadata.metadataBase)).toBe("https://daysiscollectioninc.com/");
    // What Next does with the relative path it is given.
    expect(new URL(HERO_IMAGE, metadata.metadataBase ?? undefined).href).toBe(
      "https://daysiscollectioninc.com/images/real/hero-cover.jpg",
    );
  });

  it("still renders when SITE_URL is not an address", async () => {
    // A mistyped secret costs the preview its picture, not every page a 500.
    const metadata = await metadataWithSiteUrl("daysiscollectioninc.com");

    expect(metadata.metadataBase).toBeUndefined();
    expect(metadata.title).toBe(copy.title);
  });
});
