import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Headers that never vary per request. The Content-Security-Policy is set in
 * the proxy (`src/proxy.ts`) instead, because it carries a per-request nonce.
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
   * The office upload route writes to a directory read from the environment
   * (the Fly volume in production), which Turbopack cannot resolve while it
   * traces. Faced with a path it cannot see, Next.js 16 copies the whole
   * project into the server bundle: `public/` a second time, `src/`, even
   * `docs/`. That doubled the standalone output from 70 MB to 136 MB, and
   * the image is rebuilt on every deploy onto one small machine. None of
   * these directories is read at runtime by the server itself — the
   * Dockerfile copies `public/` where the server expects it.
   */
  outputFileTracingExcludes: {
    "**": [
      "./public/**",
      "./src/**",
      "./docs/**",
      "./scripts/**",
      "./.git/**",
      "./.github/**",
      "./.data/**",
      "./.claude/**",
      "./*.tsbuildinfo",
    ],
  },
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
    /**
     * Next.js 16 refuses any quality not listed here. 85 is PHOTO_QUALITY
     * (src/lib/images.ts); 75 is the next/image default, still used by the
     * brand marks and the office thumbnails, and it stops being implicitly
     * allowed the moment this list exists.
     */
    qualities: [75, 85],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * Trabajo folded into Hub on 14 September 2026. The address lived in
   * bookmarks and in the manual, so it keeps working. 308 rather than 301
   * for the same reason as the www redirect in the proxy: the method and
   * body survive, so nothing posted here turns into a GET.
   */
  async redirects() {
    return [
      {
        source: "/:locale(es|en)/office/work",
        destination: "/:locale/office",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(config);
