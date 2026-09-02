import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { z, ZodTypeAny } from "zod";
import { currentViewer } from "./auth/session";
import { officeDenial, type OfficeDenial } from "./api-guard";
import { isSameOriginHeaders } from "./security";

export type ActionError = OfficeDenial["error"] | "failed";
export type ActionResult<T extends object> =
  | ({ ok: true } & T)
  | { ok: false; error: ActionError };
export type Revalidation = string | readonly [path: string, type: "page" | "layout"];
export type ChangeResult = {
  readonly key: string;
  readonly ok: boolean;
  readonly error?: string;
};

export function ownerAction<Schema extends ZodTypeAny, T extends object>(
  schema: Schema,
  handle: (data: z.infer<Schema>) => Promise<T>,
  options: { readonly revalidate: readonly Revalidation[] },
): (input: unknown) => Promise<ActionResult<T>> {
  return async (input: unknown) => {
    const requestHeaders = await headers();
    const sameOrigin = isSameOriginHeaders(requestHeaders);
    const viewer = sameOrigin ? await currentViewer() : null;
    const parsed = schema.safeParse(input);
    const denial = officeDenial({
      sameOrigin,
      role: viewer?.role ?? null,
      bodyValid: parsed.success,
    });
    if (denial) return { ok: false, error: denial.error };

    let data: T;
    try {
      data = await handle(parsed.data);
    } catch {
      return { ok: false, error: "failed" };
    }

    for (const pattern of options.revalidate) {
      if (typeof pattern === "string") revalidatePath(pattern, "page");
      else revalidatePath(pattern[0], pattern[1]);
    }
    return { ok: true, ...data };
  };
}

/** Thrown inside a per-change handler to refuse one change with a code the row can show. */
export class ChangeRefused extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Runs `apply` over the changes in order; one failure never stops the rest. */
export async function applyEach<C extends { readonly key: string }>(
  changes: readonly C[],
  apply: (change: C) => Promise<void>,
): Promise<{ results: ChangeResult[] }> {
  const results: ChangeResult[] = [];
  for (const change of changes) {
    try {
      await apply(change);
      results.push({ key: change.key, ok: true });
    } catch (error) {
      results.push({
        key: change.key,
        ok: false,
        error: error instanceof ChangeRefused ? error.code : "failed",
      });
    }
  }
  return { results };
}
