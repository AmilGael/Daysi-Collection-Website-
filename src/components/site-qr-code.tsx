import QRCode from "qrcode";
import { env } from "@/lib/env";

/**
 * A QR code for the site, drawn as a real SVG element on the server so it
 * prints sharp at any size. Daysi asked for one she can put on the wall of the
 * workroom, so a client can open the site, see the work and pay from a phone
 * without typing an address.
 *
 * The module grid is read out of the encoder and turned into one path here,
 * rather than injecting the library's SVG string as markup.
 */
export async function SiteQrCode({ size = 200 }: { size?: number }) {
  const { modules } = QRCode.create(env.siteUrl, { errorCorrectionLevel: "M" });
  const quietZone = 2;
  const extent = modules.size + quietZone * 2;

  const segments: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (!modules.data[row * modules.size + column]) continue;
      segments.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      width={size}
      height={size}
      role="img"
      aria-label={env.siteUrl}
      shapeRendering="crispEdges"
    >
      <path d={segments.join("")} fill="currentColor" />
    </svg>
  );
}
