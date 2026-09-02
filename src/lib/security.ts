import { env } from "./env";

/**
 * Confirms a state-changing request came from this site rather than from a page
 * somewhere else that happens to have the client logged in. Combined with the
 * fact that nothing here uses ambient cookie authentication, this closes cross
 * site request forgery without a token round trip.
 *
 * The claimed origin is compared against the host the request itself arrived
 * on, with `SITE_URL` accepted as well. Comparing against `SITE_URL` alone
 * would mean one unset environment variable on a fresh deployment quietly
 * refuses every form on the site with a 403 — and browsers are the audience of
 * this check, so the request's own Host header is the honest reference point.
 */
export type HeaderReader = { get(name: string): string | null };

export function isSameOriginHeaders(headers: HeaderReader): boolean {
  // Same-origin form posts from older browsers omit Origin but send Referer.
  const claimed = headers.get("origin") ?? headers.get("referer");
  if (!claimed) return false;

  let claimedHost: string;
  try {
    claimedHost = new URL(claimed).host;
  } catch {
    return false;
  }

  const ownHost =
    headers.get("x-forwarded-host") ?? headers.get("host");

  let configuredHost: string | null = null;
  try {
    configuredHost = new URL(env.siteUrl).host;
  } catch {
    // An unparseable SITE_URL just removes the override, not the check.
  }

  return claimedHost === ownHost || claimedHost === configuredHost;
}

export function isSameOrigin(request: Request): boolean {
  return isSameOriginHeaders(request.headers);
}

/**
 * The only image types a client can attach to a request. Each check names the
 * offset its bytes sit at: WebP needs two, because "RIFF" alone is the generic
 * container header shared by WAV audio and AVI video — the "WEBP" tag at byte
 * eight is what makes it an image.
 */
const ALLOWED_IMAGES = [
  { mime: "image/jpeg", checks: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  { mime: "image/png", checks: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }] },
  {
    mime: "image/webp",
    checks: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
] as const;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadedImage = {
  readonly mime: string;
  readonly bytes: Uint8Array;
};

/**
 * Decodes a data URL from the request form and checks that the bytes really are
 * the image type they claim to be. The declared MIME type is never trusted on
 * its own — the first bytes of the file have to agree with it.
 */
export function parseImageDataUrl(dataUrl: string): UploadedImage | null {
  const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  const [, declaredMime, encoded] = match;
  const allowed = ALLOWED_IMAGES.find((image) => image.mime === declaredMime);
  if (!allowed) return null;

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(encoded ?? "", "base64"));
  } catch {
    return null;
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) return null;
  const matches = allowed.checks.every((check) =>
    check.bytes.every((byte, index) => bytes[check.offset + index] === byte),
  );
  if (!matches) return null;

  return { mime: allowed.mime, bytes };
}

/**
 * Trims a value to something safe to drop into a plain-text notification. Angle
 * brackets go so nothing a client types can become markup in an email client.
 */
export function forNotification(value: string): string {
  return value.replace(/[<>]/g, "").trim().slice(0, 2000);
}

/**
 * A short, unguessable reference a client can quote back. Twelve random
 * characters, no ambiguous glyphs.
 */
export function newReference(prefix: string): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY34679";
  const random = crypto.getRandomValues(new Uint8Array(8));
  const body = Array.from(random, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${prefix}-${body}`;
}
