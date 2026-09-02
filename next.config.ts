import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Headers that never vary per request. The Content-Security-Policy is set in
 * middleware instead, because it carries a per-request nonce.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Builds a self-contained server that carries only the dependencies it
   * actually imports, so the deployed image is small enough to rebuild and
   * redeploy quickly. Required by the Dockerfile, which copies `server.js`.
   */
  output: "standalone",
  /**
   * The photographs are the merchandise, and they are resized on demand by
   * the smallest machine Fly sells: one shared CPU, half a gigabyte. That
   * machine decides these numbers, not taste. Measured on the live site on
   * 2026-09-02 against a 2000px hero: a cold AVIF encode took 3 to 5 seconds,
   * a cold WebP 0.7 seconds, a warm hit 70 milliseconds. The default cache
   * expires after sixty seconds and the encoded files sit on the container's
   * own disk, so every deploy and every minute started the clock again.
   *
   * WebP only: AVIF would save roughly half the bytes and cost seven times
   * the wait, and the wait is what a visitor notices. A month of cache, on
   * the server and in the browser; a photograph that changes should be given
   * a new file name, which is how the uploads already work. And no output
   * width past 1920: the largest source is 2000px wide, so the 2048 and
   * 3840 rungs produced the same bytes as 1920 and were encoded separately.
   * The cache directory itself is moved onto the volume by the entrypoint.
   */
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 30 * 24 * 60 * 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(config);
