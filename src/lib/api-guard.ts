import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { z, ZodTypeAny } from "zod";
import { isSameOrigin } from "./security";
import { currentViewer } from "./auth/session";

/**
 * The door to /api/office.
 *
 * Every route behind it needs the same three things settled before it does any
 * work: the request came from this site, the person is Daysi, and the body is
 * the shape the route expects. Each route used to settle them itself, which
 * meant nineteen copies of the origin check and ten of the owner check across
 * six files. That is not a style problem. Six copies of a rule is six chances
 * to write the seventh one slightly differently, and the rule here is what
 * stands between the open internet and every client's name and address.
 *
 * The policy is `officeDenial`, which is pure and knows nothing about Next, so
 * it can be tested as the decision it is rather than through a request object.
 * `ownerRoute` is the wiring.
 */

export type OfficeDenial = {
  readonly error: "bad-origin" | "not-found" | "invalid";
  readonly status: 403 | 404 | 400;
};

/**
 * The answer, or null to let the request through.
 *
 * The order is the policy and it is deliberate in both places it matters.
 *
 * Origin comes first so that a page on another site cannot learn whether
 * anyone is signed in here by posting twice and comparing the two errors.
 *
 * The account comes before the body so that a malformed payload is only ever
 * described back to the owner. Telling a stranger their JSON was rejected
 * tells them there is a schema to satisfy and invites them to find it.
 *
 * And a stranger is answered 404 rather than 403. A 403 says "there is
 * something here you are not allowed to see", which is exactly the sentence
 * this route should not say.
 */
export function officeDenial(request: {
  sameOrigin: boolean;
  role: string | null;
  bodyValid: boolean;
}): OfficeDenial | null {
  if (!request.sameOrigin) return { error: "bad-origin", status: 403 };
  if (request.role !== "owner") return { error: "not-found", status: 404 };
  if (!request.bodyValid) return { error: "invalid", status: 400 };
  return null;
}

function refuse(denial: OfficeDenial): NextResponse {
  return NextResponse.json({ error: denial.error }, { status: denial.status });
}

/**
 * Wraps a handler that needs a validated JSON body from the owner. The handler
 * only ever sees data that has been through the schema, so it never has to ask
 * whether a field is there.
 *
 * Every write from the office changes something a visitor can see, so the
 * layout cache is dropped on the way out. A route that needs to keep a cache
 * or return something other than `{ ok: true }` returns its own response.
 */
export function ownerRoute<Schema extends ZodTypeAny>(
  schema: Schema,
  // Inferred from the schema rather than declared, so a handler reads the
  // field a `.default()` guarantees rather than an optional the caller
  // could have omitted.
  handle: (data: z.infer<Schema>, request: Request) => Promise<Response | void>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const sameOrigin = isSameOrigin(request);
    const viewer = sameOrigin ? await currentViewer() : null;
    const parsed = schema.safeParse(await request.json().catch(() => null));

    const denial = officeDenial({
      sameOrigin,
      role: viewer?.role ?? null,
      bodyValid: parsed.success,
    });
    if (denial) return refuse(denial);

    const response = await handle(parsed.data, request);
    if (response) return response;

    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  };
}

/**
 * The same door for a route with no JSON body to validate — a download, or
 * anything reading its arguments off the query string. It hands back the
 * request so the handler can do its own parsing and answer with whatever it
 * likes, including a file.
 */
export function ownerRequest(
  handle: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const sameOrigin = isSameOrigin(request);
    const viewer = sameOrigin ? await currentViewer() : null;

    const denial = officeDenial({
      sameOrigin,
      role: viewer?.role ?? null,
      bodyValid: true,
    });
    if (denial) return refuse(denial);

    return handle(request);
  };
}

/** What a handler returns to refuse a request the schema could not catch. */
export function invalid(): NextResponse {
  return refuse({ error: "invalid", status: 400 });
}
