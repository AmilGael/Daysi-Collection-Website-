import { describe, expect, it } from "vitest";
import config from "../../next.config";

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
});
