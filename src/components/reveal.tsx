"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/routing";

/**
 * Adds `.is-visible` to every `.reveal` as it scrolls into view, which is what
 * the fade-up in globals.css keys off. Mounted once in the layout rather than
 * per section, so sections stay server-rendered.
 *
 * With scripting off, nothing here runs at all — that case is handled in CSS,
 * by the `scripting: none` block beside the `.reveal` rule. The guard below is
 * a different failure: a browser that runs scripts but has no
 * IntersectionObserver, where this reveals everything immediately.
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)");

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
