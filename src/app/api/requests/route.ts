import { NextResponse } from "next/server";
import { alterationServices, findStyle, translate } from "@/content";
import {
  estimateAlteration,
  estimateCommission,
  estimateReadyMade,
  type Estimate,
} from "@/lib/pricing";
import { isLikelyBot, requestSchema, type ClientRequest } from "@/lib/validation";
import { callerKey, checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { isSameOrigin, newReference, parseImageDataUrl } from "@/lib/security";
import { notifyOwner } from "@/lib/notify";
import { saveRequest, saveRequestPhoto, type StoredRequest } from "@/lib/request-store";

/**
 * Alteration, order and commission requests — the workflow the whole site
 * points at.
 *
 * The order of checks matters and is deliberate: reject anything not from this
 * site, then rate limit, then validate the shape, then drop obvious bots, and
 * only then do any work. Nothing touches disk or sends mail until a submission
 * has passed all four.
 */

const REQUESTS_PER_HOUR = 6;
const ONE_HOUR = 3600;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "bad-origin" }, { status: 403 });
  }

  pruneRateLimits();
  const limit = checkRateLimit(callerKey(request, "requests"), REQUESTS_PER_HOUR, ONE_HOUR);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const submission = parsed.data;

  // Silently accept and discard: a bot told it failed simply tries again.
  if (isLikelyBot(submission)) {
    return NextResponse.json({ reference: newReference("DC") });
  }

  const estimate = priceSubmission(submission);
  if (!estimate) {
    return NextResponse.json({ error: "unpriceable" }, { status: 400 });
  }

  const reference = newReference(referencePrefix(submission.kind));
  const photoFile = await storePhoto(submission, reference);

  const record: StoredRequest = {
    reference,
    kind: submission.kind,
    submittedAt: new Date().toISOString(),
    locale: submission.client.locale,
    client: {
      name: submission.client.name,
      email: submission.client.email,
      phone: submission.client.phone,
      preferredContact: submission.client.preferredContact,
    },
    details: describe(submission),
    estimate,
    ...(photoFile ? { photoFile } : {}),
    status: "new",
  };

  await saveRequest(record);
  await notifyOwner(record);

  return NextResponse.json({ reference, estimate });
}

function referencePrefix(kind: ClientRequest["kind"]): string {
  return { alteration: "ALT", order: "ORD", commission: "CUS" }[kind];
}

/**
 * Re-prices the submission from the published price list. The client sent what
 * it wants, never what it costs.
 */
function priceSubmission(submission: ClientRequest): Estimate | null {
  switch (submission.kind) {
    case "alteration":
      return estimateAlteration({
        alterationIds: submission.alterationIds,
        rush: submission.rush,
      });
    case "order":
      return estimateReadyMade({
        styleSlug: submission.styleSlug,
        sizeId: submission.sizeId,
        customize: submission.customize,
      });
    case "commission":
      return estimateCommission({
        categoryId: submission.categoryId,
        fabricId: submission.fabricId,
        customize: true,
      });
  }
}

/** Turns the submission into the plain fields Daysi reads in her notification. */
function describe(submission: ClientRequest): StoredRequest["details"] {
  switch (submission.kind) {
    case "alteration":
      return {
        Garment: submission.garmentDescription,
        Work: submission.alterationIds.map(
          (id) => alterationServices.find((item) => item.id === id)?.name.en ?? id,
        ),
        Rush: submission.rush,
        Timing: submission.preferredTiming,
        Notes: submission.notes,
      };
    case "order": {
      const style = findStyle(submission.styleSlug);
      return {
        Style: style ? translate(style.name, "en") : submission.styleSlug,
        Size: submission.sizeId.toUpperCase(),
        "Made to measure": submission.customize,
        Notes: submission.notes,
      };
    }
    case "commission":
      return {
        Garment: submission.categoryId,
        Cloth: submission.fabricId,
        Occasion: submission.occasion,
        "Needed by": submission.neededBy,
        Notes: submission.notes,
      };
  }
}

/**
 * Writes an attached photo to disk after checking it really is an image. A
 * photo that fails the check is dropped, and the request still goes through —
 * losing the request over a bad attachment would be the worse outcome.
 */
async function storePhoto(
  submission: ClientRequest,
  reference: string,
): Promise<string | undefined> {
  if (submission.kind !== "alteration" || !submission.photoDataUrl) return undefined;

  const image = parseImageDataUrl(submission.photoDataUrl);
  if (!image) return undefined;

  return saveRequestPhoto(reference, image.mime, image.bytes);
}
