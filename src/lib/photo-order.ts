/**
 * The photo list as the sheet edits it, before anything is uploaded.
 *
 * A slot is a photo the garment already has (a src) or a file she has just
 * chosen (with an object URL to draw it). Every operation returns a new
 * list; nothing here touches the draft, the network or the DOM, so the
 * sheet's buttons are one call each and the rules are tested on their own.
 */

export type PhotoSlot =
  | { readonly kind: "src"; readonly src: string }
  | { readonly kind: "file"; readonly file: File; readonly preview: string };

export const MAX_PHOTOS = 12;

export function slotKey(slot: PhotoSlot): string {
  return slot.kind === "src" ? slot.src : slot.preview;
}

export function moveSlot(slots: readonly PhotoSlot[], from: number, to: number): PhotoSlot[] {
  if (to < 0 || to >= slots.length || from < 0 || from >= slots.length) return [...slots];
  const next = [...slots];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export function coverSlot(slots: readonly PhotoSlot[], index: number): PhotoSlot[] {
  return moveSlot(slots, index, 0);
}

/** The last photo stays: a garment with no photo cannot be shown. */
export function removeSlot(slots: readonly PhotoSlot[], index: number): PhotoSlot[] {
  if (slots.length <= 1) return [...slots];
  return slots.filter((_, current) => current !== index);
}

export function addFiles(
  slots: readonly PhotoSlot[],
  files: readonly File[],
  preview: (file: File) => string,
  max: number = MAX_PHOTOS,
): PhotoSlot[] {
  const room = Math.max(0, max - slots.length);
  return [
    ...slots,
    ...files.slice(0, room).map((file): PhotoSlot => ({ kind: "file", file, preview: preview(file) })),
  ];
}
