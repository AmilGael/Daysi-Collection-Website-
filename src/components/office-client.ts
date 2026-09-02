"use client";

/**
 * The client-side seam for office photo uploads. Structured edits use one
 * server action per tab; files still travel through the upload route first.
 */

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
