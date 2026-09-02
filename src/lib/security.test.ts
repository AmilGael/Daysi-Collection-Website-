import { describe, expect, it } from "vitest";
import { isSameOriginHeaders, newReference, parseImageDataUrl } from "./security";
import { isLikelyBot } from "./validation";
import { checkRateLimit } from "./rate-limit";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function dataUrl(mime: string, bytes: number[]): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("same-origin, from headers alone", () => {
  it("accepts an origin with the request host", () => {
    expect(
      isSameOriginHeaders(new Headers({ origin: "http://shop.test", host: "shop.test" })),
    ).toBe(true);
  });

  it("refuses an origin with a different host", () => {
    expect(
      isSameOriginHeaders(new Headers({ origin: "http://evil.test", host: "shop.test" })),
    ).toBe(false);
  });

  it("refuses headers with neither origin nor referer", () => {
    expect(isSameOriginHeaders(new Headers({ host: "shop.test" }))).toBe(false);
  });

  it("accepts a referer with the request host", () => {
    expect(
      isSameOriginHeaders(
        new Headers({ referer: "http://shop.test/office", host: "shop.test" }),
      ),
    ).toBe(true);
  });

  it("prefers the forwarded host over the host", () => {
    expect(
      isSameOriginHeaders(
        new Headers({
          origin: "https://shop.test",
          host: "internal.test",
          "x-forwarded-host": "shop.test",
        }),
      ),
    ).toBe(true);
  });
});

describe("client photo uploads", () => {
  it("accepts a real PNG", () => {
    const image = parseImageDataUrl(dataUrl("image/png", PNG_HEADER));
    expect(image?.mime).toBe("image/png");
  });

  it("rejects a file whose bytes do not match the type it claims", () => {
    // A script or executable renamed to look like an image.
    const disguised = dataUrl("image/png", [0x4d, 0x5a, 0x90, 0x00]);
    expect(parseImageDataUrl(disguised)).toBeNull();
  });

  it("accepts a real WebP", () => {
    // RIFF <size> WEBP — both tags have to be present.
    const webp = dataUrl("image/webp", [
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(parseImageDataUrl(webp)?.mime).toBe("image/webp");
  });

  it("rejects a RIFF container that is not WebP", () => {
    // A WAV file: same RIFF header, "WAVE" where "WEBP" belongs. Checking the
    // first four bytes alone would wave this through as an image.
    const wav = dataUrl("image/webp", [
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(parseImageDataUrl(wav)).toBeNull();
  });

  it("rejects a type that is not an image at all", () => {
    expect(parseImageDataUrl(dataUrl("text/html", PNG_HEADER))).toBeNull();
  });

  it("rejects anything that is not a base64 data URL", () => {
    expect(parseImageDataUrl("https://example.com/photo.png")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64,")).toBeNull();
  });

  it("rejects a file over the upload limit", () => {
    const oversized = `data:image/png;base64,${"A".repeat(8 * 1024 * 1024)}`;
    expect(parseImageDataUrl(oversized)).toBeNull();
  });
});

describe("bot detection", () => {
  it("flags a submission that filled in the hidden field", () => {
    expect(isLikelyBot({ website: "https://spam.example", renderedAt: Date.now() - 60_000 })).toBe(
      true,
    );
  });

  it("flags a form submitted faster than a person could type it", () => {
    expect(isLikelyBot({ renderedAt: Date.now() })).toBe(true);
  });

  it("lets a real submission through", () => {
    expect(isLikelyBot({ website: "", renderedAt: Date.now() - 30_000 })).toBe(false);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit and then refuses", () => {
    const key = `test-${Math.random()}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(checkRateLimit(key, 3, 60).allowed).toBe(true);
    }
    const refused = checkRateLimit(key, 3, 60);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each caller separately", () => {
    const first = `test-${Math.random()}`;
    const second = `test-${Math.random()}`;
    checkRateLimit(first, 1, 60);
    expect(checkRateLimit(first, 1, 60).allowed).toBe(false);
    expect(checkRateLimit(second, 1, 60).allowed).toBe(true);
  });
});

describe("reference numbers", () => {
  it("carries the prefix and no ambiguous characters", () => {
    const reference = newReference("ALT");
    expect(reference.startsWith("ALT-")).toBe(true);
    expect(reference).not.toMatch(/[OIS01258BZ]/);
  });

  it("does not repeat", () => {
    const references = new Set(Array.from({ length: 500 }, () => newReference("ALT")));
    expect(references.size).toBe(500);
  });
});
