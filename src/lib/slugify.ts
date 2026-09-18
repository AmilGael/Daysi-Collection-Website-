export function slugify(name: string, max: number): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/**
 * The id a gallery section Daysi names herself gets: `sec-` plus her Spanish
 * name, slugged. Pure, with nothing this file doesn't already import, so the
 * picker (a client component) can compute the identical id in the browser \u2014
 * `lib/live-gallery.ts` re-exports it for the server side, rather than
 * defining it itself, because that file reaches into `records.ts` and
 * `node:fs`, which a client bundle cannot resolve.
 */
export function sectionId(nameEs: string): string {
  return `sec-${slugify(nameEs, 40)}`;
}
