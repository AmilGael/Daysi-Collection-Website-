/** Pixel size of an image file, or undefined when the browser cannot decode it. */
export async function readImageSize(
  file: File,
): Promise<{ width: number; height: number } | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/** Average colour of the swatch as #rrggbb; "#8e8471" without a 2d context; undefined when the browser cannot decode it. */
export async function readAverageColor(file: File): Promise<string | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return undefined;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 10;
  canvas.height = 10;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return "#8e8471";
  }
  context.drawImage(bitmap, 0, 0, 10, 10);
  bitmap.close();
  const { data } = context.getImageData(0, 0, 10, 10);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const pixels = data.length / 4;
  const hex = (value: number) =>
    Math.round(value / pixels)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
