import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";

/**
 * The small set of shapes the whole site is built from. Anything that appears
 * more than twice lives here, so a change to how a button feels is one edit.
 */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium tracking-wide transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] disabled:cursor-not-allowed disabled:opacity-45";

const buttonSizes = {
  medium: "px-7 py-3.5",
  small: "px-5 py-2.5 text-[0.8125rem]",
} as const;

const buttonTones = {
  solid: "bg-ink text-paper hover:bg-ink-soft hover:shadow-[0_12px_28px_-14px_rgba(20,17,13,0.7)]",
  marigold: "bg-marigold text-ink hover:brightness-105 hover:shadow-[0_12px_28px_-14px_rgba(232,163,2,0.9)]",
  outline: "border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-paper",
  ghost: "border border-paper/40 text-paper hover:bg-paper hover:text-ink",
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

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  tone = "ink",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  tone?: "ink" | "paper";
}) {
  const alignment = align === "center" ? "text-center items-center mx-auto" : "items-start";
  const leadTone = tone === "paper" ? "text-paper/70" : "text-ink-soft";

  return (
    <div className={`flex max-w-2xl flex-col gap-5 ${alignment}`}>
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

/** A small pill used for sizes, stock state and premiere labels. */
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
    outline: "border border-line text-ink-faint",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
