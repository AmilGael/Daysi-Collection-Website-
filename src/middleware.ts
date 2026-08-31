import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
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

/**
 * One host, so there is one cookie jar.
 *
 * Both `daysiscollectioninc.com` and `www.daysiscollectioninc.com` resolve to
 * this app, and a cookie set on one is not sent to the other. Left alone that
 * is not a cosmetic split: a client who signs in on www and then follows the
 * link from her email — which is built from SITE_URL, the bare domain — arrives
 * signed out, and Google sign-in cannot work at all, because the state cookie
 * is written on the host the flow started from and the callback always lands on
 * the bare one.
 *
 * 308 rather than 301: it is the redirect that promises the method and body
 * survive, so a form posted to www is not quietly turned into a GET.
 */
function bareHostRedirect(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host");
  if (!host?.startsWith("www.")) return null;

  const url = request.nextUrl.clone();
  url.host = host.slice(4);
  return NextResponse.redirect(url, 308);
}

export default function middleware(request: NextRequest) {
  const canonical = bareHostRedirect(request);
  if (canonical) return canonical;

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
