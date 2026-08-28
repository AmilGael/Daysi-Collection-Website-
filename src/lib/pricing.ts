import { commissionDepositRate, findCategory, findStyle, type Cents, type Localized } from "@/content";
import {
  liveFindAlteration as findAlteration,
  liveFindAppointmentType as findAppointmentType,
  liveFindFabric as findFabric,
  liveFindPriceEntry as findPriceEntry,
} from "./live-pricing";
import { applyRate, sum } from "./money";

/**
 * Every amount a client is ever asked to pay is produced here, on the server,
 * from the published price list. Nothing that arrives from a browser is treated
 * as a price — a request names *what* it wants, and this module decides what
 * that costs. That is the whole reason the checkout can be trusted.
 */

/**
 * How a line is treated for sales tax.
 *
 * `clothing` — a garment, or work done to a garment. New York exempts these
 * under $110 per item and taxes them in full at or above it.
 * `service` — Daysi's time rather than a garment. Not taxed here; see the note
 * on `SALES_TAX_RATE` below.
 */
export type TaxBasis = "clothing" | "service";

export type EstimateLine = {
  readonly label: Localized;
  readonly note?: Localized;
  readonly amount: Cents;
  readonly taxBasis: TaxBasis;
};

export type Estimate = {
  readonly lines: readonly EstimateLine[];
  readonly subtotal: Cents;
  readonly salesTax: Cents;
  readonly total: Cents;
  /** What Stripe is asked to charge now. */
  readonly dueNow: Cents;
  /** The remainder, settled when the work is collected. */
  readonly dueOnCollection: Cents;
  readonly dueNowReason: Localized;
};

/**
 * New York exempts clothing and footwear priced under $110 per item from sales
 * tax, and taxes it in full at or above that line. Alterations to exempt
 * clothing follow the garment they are done to.
 *
 * Consultation fees are `service` lines and are left untaxed here, because how
 * Daysi's design time is treated is a question for her accountant, not one to
 * guess at on an invoice. When that is settled, it is this function that
 * changes — nothing else does arithmetic on money.
 *
 * Confirm the rate, the threshold, and the treatment of service lines before
 * launch. All three live here.
 */
const SALES_TAX_RATE = 0.08875;
const CLOTHING_EXEMPTION_THRESHOLD: Cents = 11000;

/**
 * Whether the sales tax actually lands on this line. Exported because the
 * bookkeeping export has to stamp a tax code on every line it writes, and a
 * second copy of the threshold in another file is how an invoice and a tax
 * return start disagreeing.
 */
export function isTaxable(line: EstimateLine): boolean {
  return line.taxBasis === "clothing" && line.amount >= CLOTHING_EXEMPTION_THRESHOLD;
}

function taxFor(lines: readonly EstimateLine[]): Cents {
  return applyRate(sum(lines.filter(isTaxable).map((line) => line.amount)), SALES_TAX_RATE);
}

function build(
  lines: readonly EstimateLine[],
  dueNow: (total: Cents) => Cents,
  dueNowReason: Localized,
): Estimate {
  const subtotal = sum(lines.map((line) => line.amount));
  const salesTax = taxFor(lines);
  const total = subtotal + salesTax;
  const now = Math.min(dueNow(total), total);
  return {
    lines,
    subtotal,
    salesTax,
    total,
    dueNow: now,
    dueOnCollection: total - now,
    dueNowReason,
  };
}

// ── Ready-made pieces ──────────────────────────────────────────────────────

export type ReadyMadeOrder = {
  readonly styleSlug: string;
  readonly sizeId: string;
  readonly customize: boolean;
};

export function estimateReadyMade(order: ReadyMadeOrder): Estimate | null {
  const style = findStyle(order.styleSlug);
  if (!style) return null;
  if (!style.sizes.some((size) => size.sizeId === order.sizeId)) return null;

  const price = findPriceEntry(style.priceEntryId);
  if (!price) return null;

  const lines: EstimateLine[] = [
    {
      label: style.name,
      note: {
        en: `Size ${order.sizeId.toUpperCase()}`,
        es: `Talla ${order.sizeId.toUpperCase()}`,
      },
      amount: price.fixedPrice,
      taxBasis: "clothing",
    },
  ];

  if (order.customize && style.customizationAvailable) {
    lines.push({
      label: { en: "Made to your measurements", es: "Hecho a su medida" },
      note: price.customizationNote,
      amount: price.customizationExtra,
      taxBasis: "clothing",
    });
  }

  return build(lines, (total) => (order.customize ? applyRate(total, commissionDepositRate) : total), {
    en: order.customize
      ? "Half now to reserve the cloth, half when the piece is ready."
      : "Paid in full. The piece ships or is collected once payment clears.",
    es: order.customize
      ? "La mitad ahora para reservar la tela, la mitad cuando la pieza esté lista."
      : "Pagado por completo. La pieza se envía o se recoge al confirmarse el pago.",
  });
}

/**
 * A whole cart, priced. Each line is looked up in the price list by what it
 * names — the browser sends a garment, a size and a quantity, never a number.
 * A line naming something unpriceable is dropped rather than guessed at, so a
 * tampered cookie shrinks the basket instead of discounting it.
 */
export function estimateCart(
  cart: readonly (ReadyMadeOrder & { quantity: number })[],
): Estimate | null {
  const lines: EstimateLine[] = [];
  let anyCustomised = false;

  for (const item of cart) {
    const style = findStyle(item.styleSlug);
    if (!style) continue;
    if (!style.sizes.some((size) => size.sizeId === item.sizeId)) continue;

    const price = findPriceEntry(style.priceEntryId);
    if (!price) continue;

    const quantity = Math.max(1, Math.floor(item.quantity));
    const customised = item.customize && style.customizationAvailable;
    if (customised) anyCustomised = true;

    lines.push({
      label: style.name,
      note: {
        en: `Size ${item.sizeId.toUpperCase()}${quantity > 1 ? ` · ${quantity} pieces` : ""}`,
        es: `Talla ${item.sizeId.toUpperCase()}${quantity > 1 ? ` · ${quantity} piezas` : ""}`,
      },
      amount: price.fixedPrice * quantity,
      taxBasis: "clothing",
    });

    if (customised) {
      lines.push({
        label: { en: "Made to your measurements", es: "Hecho a su medida" },
        note: price.customizationNote,
        amount: price.customizationExtra * quantity,
        taxBasis: "clothing",
      });
    }
  }

  if (lines.length === 0) return null;

  // One made-to-measure piece puts the whole basket on the deposit terms:
  // Daysi cannot start cutting cloth for part of an order.
  return build(
    lines,
    (total) => (anyCustomised ? applyRate(total, commissionDepositRate) : total),
    {
      en: anyCustomised
        ? "Half now to reserve the cloth, half when the pieces are ready."
        : "Paid in full. Your pieces are collected or sent once payment clears.",
      es: anyCustomised
        ? "La mitad ahora para reservar la tela, la mitad cuando las piezas estén listas."
        : "Pagado por completo. Sus piezas se recogen o se envían al confirmarse el pago.",
    },
  );
}

// ── Alterations ────────────────────────────────────────────────────────────

export type AlterationOrder = {
  readonly alterationIds: readonly string[];
  readonly rush: boolean;
};

export function estimateAlteration(order: AlterationOrder): Estimate | null {
  if (order.alterationIds.length === 0) return null;

  const lines: EstimateLine[] = [];
  for (const id of order.alterationIds) {
    const alteration = findAlteration(id);
    if (!alteration) return null;
    lines.push({
      label: alteration.name,
      note: alteration.turnaround,
      amount: alteration.fixedPrice,
      taxBasis: "clothing",
    });
    if (order.rush) {
      lines.push({
        label: { en: "Rush service", es: "Servicio urgente" },
        note: {
          en: `Applied to ${alteration.name.en.toLowerCase()}`,
          es: `Aplicado a ${alteration.name.es.toLowerCase()}`,
        },
        amount: alteration.rushSurcharge,
        taxBasis: "clothing",
      });
    }
  }

  // Alterations are settled on collection, once the fit has been checked.
  return build(lines, () => 0, {
    en: "Nothing due now. Alterations are paid when you collect the garment and it fits.",
    es: "No hay nada que pagar ahora. Los arreglos se pagan al recoger la prenda y comprobar que le queda.",
  });
}

// ── Appointments ───────────────────────────────────────────────────────────

export function estimateAppointment(appointmentTypeId: string): Estimate | null {
  const type = findAppointmentType(appointmentTypeId);
  if (!type) return null;

  const lines: EstimateLine[] = [
    {
      label: type.name,
      note: {
        en: `${type.minutes} minutes. Time past this is billed at $${
          type.overtimeRatePerHalfHour / 100
        } per additional half hour.`,
        es: `${type.minutes} minutos. El tiempo adicional se cobra a $${
          type.overtimeRatePerHalfHour / 100
        } por cada media hora extra.`,
      },
      amount: type.fee,
      taxBasis: "service",
    },
  ];

  return build(lines, () => type.depositDue, {
    en: "Paid now to hold the time. It comes off your order if you place one within thirty days.",
    es: "Se paga ahora para reservar la hora. Se descuenta de su pedido si lo hace dentro de treinta días.",
  });
}

// ── Custom commissions ─────────────────────────────────────────────────────

export type CommissionEstimate = {
  readonly categoryId: string;
  readonly fabricId: string;
  readonly customize: boolean;
};

export function estimateCommission(request: CommissionEstimate): Estimate | null {
  const category = findCategory(request.categoryId);
  const fabric = findFabric(request.fabricId);
  if (!category || !fabric) return null;

  const price = findPriceEntry(`${request.categoryId}--${request.fabricId}`);
  if (!price) return null;

  const lines: EstimateLine[] = [
    {
      label: {
        en: `${category.name.en} in ${fabric.name.en.toLowerCase()}`,
        es: `${category.name.es} en ${fabric.name.es.toLowerCase()}`,
      },
      note: {
        en: "The published fixed price for this garment and cloth.",
        es: "El precio fijo publicado para esta prenda y esta tela.",
      },
      amount: price.fixedPrice,
      taxBasis: "clothing",
    },
  ];

  if (request.customize) {
    lines.push({
      label: { en: "Made to your measurements", es: "Hecho a su medida" },
      note: price.customizationNote,
      amount: price.customizationExtra,
      taxBasis: "clothing",
    });
  }

  return build(lines, (total) => applyRate(total, commissionDepositRate), {
    en: "Half now to reserve the cloth and the calendar, half when the piece is ready.",
    es: "La mitad ahora para reservar la tela y la fecha, la mitad cuando la pieza esté lista.",
  });
}
