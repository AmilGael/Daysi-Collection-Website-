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
  /** Where alteration and order requests are sent. */
  ownerEmail: optional("OWNER_EMAIL"),
  notificationFrom: optional("NOTIFICATION_FROM"),
} as const;

/** Card payments are only offered when Stripe is actually configured. */
export const paymentsEnabled = env.stripeSecretKey !== null;

/** Email notifications are only attempted when there is somewhere to send them. */
export const emailEnabled = env.resendApiKey !== null && env.ownerEmail !== null;
