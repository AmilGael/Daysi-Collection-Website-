import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../next.config";
import { PHOTO_QUALITY } from "./images";

/**
 * The photographs are the merchandise, and they are resized on demand by a
 * shared single CPU with half a gigabyte of memory. Measured on the live
 * site on 2026-09-02: a cold AVIF encode of one hero took 3 to 5 seconds,
 * a cold WebP 0.7 seconds, a warm hit 70 milliseconds. Twelve photographs
 * on the home page, one CPU, and a cache that starts empty after every
 * deploy and expires every sixty seconds by default: that is the minute of
 * grey boxes Daysi saw. These settings are the fix, and this test keeps
 * anyone from quietly putting AVIF or the sixty seconds back.
 */

const images = config.images ?? {};

describe("image delivery", () => {
  it("encodes WebP only, because AVIF costs five seconds a picture on this machine", () => {
    expect(images.formats).toEqual(["image/webp"]);
  });

  it("keeps an encoded picture for a month, not a minute", () => {
    expect(images.minimumCacheTTL).toBeGreaterThanOrEqual(30 * 24 * 60 * 60);
  });

  it("never asks for a width no source photograph has", () => {
    expect(Math.max(...(images.deviceSizes ?? [Infinity]))).toBeLessThanOrEqual(1920);
  });

  /**
   * Since Next.js 16 a quality missing from this list is not refused but
   * rounded to the nearest one listed, with only a dev warning to say so.
   * The hero's 70 went out as 75 that way from the move to Next.js 16 on
   * 17 September 2026 until the list learned it.
   */
  it("lists every quality a picture asks for, so none is quietly rounded", () => {
    const src = path.join(process.cwd(), "src");
    const asked = new Set([PHOTO_QUALITY]);
    for (const file of readdirSync(src, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".tsx")) continue;
      for (const [, quality] of readFileSync(path.join(src, file), "utf8").matchAll(/quality=\{(\d+)\}/g)) {
        asked.add(Number(quality));
      }
    }
    expect([...asked].filter((quality) => !images.qualities?.includes(quality))).toEqual([]);
  });
});
