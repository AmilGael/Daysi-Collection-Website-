"use client";

/**
 * What the office's editors all do to talk to the server.
 *
 * Six components manage six things — the collection, the gallery, the fabric
 * wall, the price list, the notice, a new garment — and every one of them had
 * written out the same three lines: build a JSON request by hand, remember to
 * set the content type, check `response.ok` and throw a string nobody reads.
 * Four of them also had the same file-upload dance, right down to casting the
 * response to `{ src: string }`.
 *
 * The point of collecting it is not the line count. Setting the content type
 * is not optional — a JSON body without it is a request the origin check
 * treats differently — and "one of the six forgot" is not a failure anyone
 * notices until Daysi cannot save something on a Sunday.
 */

/** The four states a save is ever in, and the same four words in each editor. */
export type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * Sends a body to one of the office routes. Throws rather than returns a flag,
 * because every caller is already inside a try/catch that turns any failure
 * into the same "failed" state: there is nothing useful to do differently.
 */
export async function postOffice(
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): Promise<Response> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}`);
  return response;
}

/**
 * Puts a photograph on the server and hands back the path to reference it by.
 * The name is the server's; see api/office/uploads for why the browser's is
 * never used.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/office/uploads", { method: "POST", body: form });
  if (!response.ok) throw new Error(`upload ${response.status}`);

  const { src } = (await response.json()) as { src: string };
  return src;
}
