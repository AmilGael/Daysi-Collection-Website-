import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";

/**
 * The small set of shapes the whole site is built from.
 *
 * Buttons are rectangles, not pills, and their labels are small letterspaced
 * capitals. That is the house on Stella Jean's side of the reference wall
 * rather than the soft-pill convention every template ships with, and it is
 * what makes a $325 dress and a $35 hem sit on the same page without either
 * looking mispriced.
 */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-[2px] text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

const buttonSizes = {
  medium: "px-8 py-4",
  small: "px-5 py-3 text-[0.625rem] tracking-[0.14em]",
} as const;

const buttonTones = {
  solid: "bg-ink text-paper hover:bg-ink-soft",
  marigold: "bg-marigold text-ink hover:bg-marigold-deep hover:text-paper",
  outline: "border border-ink/30 text-ink hover:border-ink hover:bg-ink hover:text-paper",
  ghost: "border border-paper/45 text-paper hover:bg-paper hover:text-ink",
} as const;

type ButtonProps = {
  tone?: keyof typeof buttonTones;
  size?: keyof typeof buttonSizes;
  className?: string;
  children: ReactNode;
};

export function buttonClass({
  tone = "solid",
  size = "medium",
  className = "",
}: Omit<ButtonProps, "children">) {
  return `${buttonBase} ${buttonSizes[size]} ${buttonTones[tone]} ${className}`;
}

export function ButtonLink({
  href,
  tone,
  size,
  className,
  children,
}: ButtonProps & { href: string }) {
  return (
    <Link href={href} className={buttonClass({ tone, size, className })}>
      {children}
    </Link>
  );
}

export function ExternalButtonLink({
  href,
  tone,
  size,
  className,
  children,
}: ButtonProps & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={buttonClass({ tone, size, className })}
    >
      {children}
    </a>
  );
}

/**
 * A quiet text link. No arrow: the underline that draws itself in on hover is
 * the affordance, and an arrow on every link is a tic rather than a signpost.
 */
export function TextLink({
  href,
  children,
  tone = "ink",
}: {
  href: string;
  children: ReactNode;
  tone?: "ink" | "paper";
}) {
  return (
    <Link
      href={href}
      className={`link-underline w-fit text-[0.8125rem] font-medium ${
        tone === "paper" ? "text-paper" : "text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * A section title.
 *
 * `eyebrow` is deliberately optional and used rarely — a label above every
 * heading on a page is the surest sign nobody decided which section mattered.
 * `index` sets a section numeral instead, the way a lookbook numbers its
 * chapters.
 */
export function SectionHeading({
  eyebrow,
  index,
  title,
  lead,
  align = "left",
  tone = "ink",
}: {
  eyebrow?: string;
  index?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  tone?: "ink" | "paper";
}) {
  const alignment = align === "center" ? "text-center items-center mx-auto" : "items-start";
  const leadTone = tone === "paper" ? "text-paper-soft" : "text-ink-soft";
  const indexTone = tone === "paper" ? "text-paper-faint" : "text-ink-faint";

  return (
    <div className={`flex max-w-2xl flex-col gap-5 ${alignment}`}>
      {index ? (
        <span className={`font-display text-[0.9375rem] tabular-nums ${indexTone}`}>{index}</span>
      ) : null}
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="text-title text-balance">{title}</h2>
      {lead ? <p className={`text-lead ${leadTone} text-pretty`}>{lead}</p> : null}
    </div>
  );
}

/** A titled block of prose, used across the terms, privacy and atelier pages. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-2xl flex-col gap-5 text-[1.0625rem] leading-[1.75] text-ink-soft [&_strong]:font-medium [&_strong]:text-ink">
      {children}
    </div>
  );
}

/** A small rectangular label used for sizes, stock state and premiere runs. */
export function Tag({
  children,
  tone = "quiet",
}: {
  children: ReactNode;
  tone?: "quiet" | "marigold" | "outline";
}) {
  const tones = {
    quiet: "bg-paper-warm text-ink-faint",
    marigold: "bg-marigold text-ink",
    outline: "border border-current/30",
  } as const;

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 text-[0.625rem] font-medium uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
