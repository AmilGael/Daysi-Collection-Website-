/**
 * Every secret the site can use, read in one place and never re-read from
 * `process.env` elsewhere. Each one is optional: the site runs completely
 * without them, with the feature that needs the key clearly switched off rather
 * than half working.
 */

function optional(name: string): string | null {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

export const env = {
  siteUrl: optional("SITE_URL") ?? "http://localhost:3000",

  stripeSecretKey: optional("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),

  resendApiKey: optional("RESEND_API_KEY"),
  /**
   * Where alteration and order requests are sent — and the one address that
   * gets the owner's office. Daysi's account is recognised by her email
   * matching this, so there is no role to grant and nothing a client can flip
   * on their own record to promote themselves.
   */
  ownerEmail: optional("OWNER_EMAIL"),
  notificationFrom: optional("NOTIFICATION_FROM"),

  /**
   * Signs the cart cookie. Sessions do not need it — those are random tokens
   * checked against a stored hash — but the cart travels entirely in the
   * client's cookie, so it has to be tamper-evident.
   */
  authSecret: optional("AUTH_SECRET"),
} as const;

/** Card payments are only offered when Stripe is actually configured. */
export const paymentsEnabled = env.stripeSecretKey !== null;

/** Email notifications are only attempted when there is somewhere to send them. */
export const emailEnabled = env.resendApiKey !== null && env.ownerEmail !== null;

export const isProduction = process.env.NODE_ENV === "production";

/**
 * A development fallback so the site runs with no configuration at all. In
 * production an unset AUTH_SECRET is a hard failure rather than a quiet
 * downgrade to a guessable key — a signing key everyone can read is not a
 * signing key.
 */
export function signingSecret(): string {
  if (env.authSecret) return env.authSecret;
  if (isProduction) {
    throw new Error("AUTH_SECRET must be set in production; refusing to sign with a known key.");
  }
  return "daysi-collection-development-only-signing-key";
}
