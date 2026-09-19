import type { Metadata } from "next";
import { HERO_IMAGE } from "@/content/photographs";
import { env } from "./env";

/**
 * The metadata every page inherits from the locale layout: the tab title, the
 * search description, the other language, and the preview a shared link draws.
 *
 * `metadataBase` is what Next resolves the image and language paths against.
 * Without it, production wrote og:image as http://localhost:3000/..., so a link
 * shared on WhatsApp arrived with no picture. An unparseable SITE_URL leaves it
 * unset rather than throwing, since this runs for every page on the site.
 */
export function siteMetadata({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  return {
    metadataBase: URL.canParse(env.siteUrl) ? new URL(env.siteUrl) : undefined,
    title,
    description,
    alternates: {
      languages: { es: "/es", en: "/en" },
    },
    openGraph: {
      title,
      description,
      images: [HERO_IMAGE],
      type: "website",
    },
  };
}
