/**
 * `site-helper.ts`'s data block only ever hands the model bare, locale-typed
 * paths (`/es/collection/{slug}`, `/es/alterations`, and so on) as the "next
 * step" its rules require. This turns such a path, found anywhere in a plain
 * text answer, into a segment `site-helper.tsx` can render as a next-intl
 * `<Link>` — never `dangerouslySetInnerHTML`, since the model's own words are
 * never trusted as markup, and the rules tell it not to write Markdown
 * either. Everything else in the answer stays a plain text segment.
 *
 * `href` is locale-agnostic, the way every `Link` in this codebase is
 * written (see `style-card.tsx`'s `/collection/${slug}`), so the component
 * can hand it straight to `Link` without doubling the locale segment; `label`
 * keeps the path as the model actually wrote it, for what the reader sees.
 */

export type AnswerSegment =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "link"; readonly label: string; readonly href: string };

const LINK_PATTERN = /\/(?:es|en)\/(collection\/[a-z0-9-]+|alterations|appointments|request|prices)/g;

export function tokenizeAnswer(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ type: "text", value: text.slice(cursor, start) });
    segments.push({ type: "link", label: match[0], href: `/${match[1]}` });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments;
}
