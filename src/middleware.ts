import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleLocale = createMiddleware(routing);

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Origins the browser is allowed to reach. Stripe hosts the card form, so its
 * script and frame origins are required; nothing else third-party is loaded.
 */
function contentSecurityPolicy(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    // 'strict-dynamic' lets the nonced Next.js bootstrap load its own chunks
    // without whitelisting paths. Dev needs eval for React Fast Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    // Next.js injects the critical stylesheet inline; hashing it per build is
    // not possible here, so styles stay on 'unsafe-inline'. Styles cannot
    // exfiltrate data on their own, and connect-src below is locked down.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://api.stripe.com${isDevelopment ? " ws:" : ""}`,
    `frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com`,
    `form-action 'self' https://checkout.stripe.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join("; ");
}

export default function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = contentSecurityPolicy(nonce);

  // Next.js reads the nonce back out of the request's own Content-Security-Policy
  // header when it renders its <script> tags, and next-intl copies the request
  // headers onto the rewrite it performs — so setting them here is what carries
  // the nonce through to the page.
  //
  // The real NextRequest has to be handed to next-intl untouched: it reads
  // `nextUrl` on its very first line inside a try/catch that falls back to
  // "do nothing". Passing a rebuilt Request makes every redirect silently
  // vanish, which leaves the bare "/" with nowhere to go.
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", policy);

  const response = handleLocale(request);
  response.headers.set("content-security-policy", policy);
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = {
  // Everything except Next.js internals, the API routes, the photographs
  // Daysi has uploaded, and static files. `uploads` is named rather than left
  // to the "has a dot" rule: those are binary assets on a single URL, and a
  // locale prefix in front of one would be a 404 dressed as a redirect.
  matcher: ["/((?!api|uploads|_next|_vercel|.*\\..*).*)"],
};
