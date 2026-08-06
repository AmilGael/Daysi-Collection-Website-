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

  // The nonce travels on the request so the server components that render
  // <script> tags can read it back out of headers().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = handleLocale(
    new Request(request, { headers: requestHeaders }) as NextRequest,
  );
  response.headers.set("content-security-policy", contentSecurityPolicy(nonce));
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = {
  // Everything except Next.js internals, the Stripe webhook, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
