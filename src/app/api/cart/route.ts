import { NextResponse } from "next/server";
import { findStyle } from "@/content";
import {
  addLine,
  cartCount,
  cartRequestSchema,
  emptyCart,
  readCart,
  removeLine,
  setQuantity,
  writeCart,
} from "@/lib/cart";
import { estimateCart } from "@/lib/pricing";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";

/**
 * The cart. Every response carries the cart re-priced from the published list,
 * so the browser never has to add anything up and never gets the chance to.
 */

const CHANGES_PER_MINUTE = 60;

function priced(cart: Awaited<ReturnType<typeof readCart>>) {
  const estimate = estimateCart(
    cart.lines.map((line) => ({
      styleSlug: line.styleSlug,
      sizeId: line.sizeId,
      customize: line.customize,
      quantity: line.quantity,
    })),
  );
  return { cart, estimate, count: cartCount(cart) };
}

export async function GET() {
  return NextResponse.json(priced(await readCart()));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "cart"), CHANGES_PER_MINUTE, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const parsed = cartRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const change = parsed.data;
  let cart = await readCart();

  switch (change.action) {
    case "add": {
      // The garment and size have to exist and be offered together; a cart is
      // not a place to invent products.
      const style = findStyle(change.styleSlug);
      if (!style || !style.sizes.some((size) => size.sizeId === change.sizeId)) {
        return NextResponse.json({ error: "unknown-style" }, { status: 400 });
      }
      cart = addLine(cart, {
        styleSlug: change.styleSlug,
        sizeId: change.sizeId,
        customize: change.customize && style.customizationAvailable,
        quantity: 1,
      });
      break;
    }
    case "setQuantity":
      cart = setQuantity(cart, change.index, change.quantity);
      break;
    case "remove":
      cart = removeLine(cart, change.index);
      break;
    case "clear":
      cart = emptyCart;
      break;
  }

  await writeCart(cart);
  return NextResponse.json(priced(cart));
}
