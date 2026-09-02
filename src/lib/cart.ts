import { cookies } from "next/headers";
import { sign, verify } from "./signing";
import { z } from "zod";
import { isProduction } from "./env";

/**
 * The cart.
 *
 * It lives in the client's own cookie, which means a guest can fill one
 * without an account and keep it after signing in — but it carries only what
 * was chosen, never what it costs. Prices come from the published list on
 * every read, so a tampered cookie can at worst ask for a different garment,
 * never for a cheaper one.
 *
 * The cookie is HMAC-signed anyway. Not because a price could be forged, but
 * because a cart is the one piece of state a client can hand to the server,
 * and a signature turns "unexpected shape" into "rejected outright".
 */

const COOKIE_NAME = "daysi_cart";
const MAX_LINES = 12;
const MAX_QUANTITY = 5;

const cartSchema = z.object({
  lines: z
    .array(
      z.object({
        styleSlug: z.string().max(80),
        sizeId: z.enum(["s", "m", "l"]),
        customize: z.boolean(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
      }),
    )
    .max(MAX_LINES),
});

export type Cart = z.infer<typeof cartSchema>;
export type CartLine = Cart["lines"][number];

export const emptyCart: Cart = { lines: [] };

function encode(cart: Cart): string {
  const payload = Buffer.from(JSON.stringify(cart)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value: string): Cart {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !verify(payload, signature)) return emptyCart;

  try {
    const parsed = cartSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : emptyCart;
  } catch {
    return emptyCart;
  }
}

export async function readCart(): Promise<Cart> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  return value ? decode(value) : emptyCart;
}

export async function writeCart(cart: Cart): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(cart), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

/** Same garment, same size, same customisation — one line, more of it. */
function isSameLine(a: CartLine, b: CartLine): boolean {
  return a.styleSlug === b.styleSlug && a.sizeId === b.sizeId && a.customize === b.customize;
}

export function addLine(cart: Cart, line: CartLine): Cart {
  const existing = cart.lines.find((candidate) => isSameLine(candidate, line));
  if (existing) {
    return {
      lines: cart.lines.map((candidate) =>
        isSameLine(candidate, line)
          ? { ...candidate, quantity: Math.min(candidate.quantity + line.quantity, MAX_QUANTITY) }
          : candidate,
      ),
    };
  }
  if (cart.lines.length >= MAX_LINES) return cart;
  return { lines: [...cart.lines, line] };
}

export function setQuantity(cart: Cart, index: number, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, index);
  return {
    lines: cart.lines.map((line, at) =>
      at === index ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY) } : line,
    ),
  };
}

export function removeLine(cart: Cart, index: number): Cart {
  return { lines: cart.lines.filter((_, at) => at !== index) };
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((total, line) => total + line.quantity, 0);
}

export const cartRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    styleSlug: z.string().max(80),
    sizeId: z.enum(["s", "m", "l"]),
    customize: z.boolean(),
  }),
  z.object({ action: z.literal("setQuantity"), index: z.number().int().min(0), quantity: z.number().int().min(0).max(MAX_QUANTITY) }),
  z.object({ action: z.literal("remove"), index: z.number().int().min(0) }),
  z.object({ action: z.literal("clear") }),
]);
