import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "./env";

/**
 * HMAC-SHA256 under AUTH_SECRET, shared by everything that has to be
 * tamper-evident: the cart cookie, which travels in the client's hands, and
 * the session and sign-in-link records on the volume, which sit on a disk an
 * intruder with code execution could append to. The key lives only in the
 * process environment, so neither a cookie nor a line on disk can be minted
 * without it.
 */
export function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
