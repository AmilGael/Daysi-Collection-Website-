import { env } from "./env";

/**
 * Confirms a state-changing request came from this site rather than from a page
 * somewhere else that happens to have the client logged in. Combined with the
 * fact that nothing here uses ambient cookie authentication, this closes cross
 * site request forgery without a token round trip.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Same-origin form posts from older browsers omit Origin but send Referer.
    const referer = request.headers.get("referer");
    if (!referer) return false;
    return sameHost(referer);
  }
  return sameHost(origin);
}

function sameHost(candidate: string): boolean {
  try {
    return new URL(candidate).origin === new URL(env.siteUrl).origin;
  } catch {
    return false;
  }
}

/** The only image types a client can attach to a request. */
const ALLOWED_IMAGES = [
  { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] },
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
  if (!allowed.magic.every((byte, index) => bytes[index] === byte)) return null;

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
