import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/auth/session";
import { googleAuthEnabled } from "@/lib/env";
import { SignInForm } from "@/components/sign-in-form";
import { DaisyMark } from "@/components/logo";
import { HERO_BACKDROP } from "@/content/photographs";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in: there is nothing to do here.
  const viewer = await currentViewer();
  if (viewer) {
    redirect(`/${locale}/${viewer.role === "owner" ? "office" : "account"}`);
  }

  const { error } = await searchParams;
  const t = await getTranslations("account");

  return (
    <section className="on-ink relative -mt-20 flex min-h-[100svh] items-center justify-center overflow-hidden bg-ink px-4 pb-16 pt-24 text-paper">
      {/* The same woven ground as the homepage hero, asked for by the owner
          so the sign-in page reads as this site rather than a bare form. */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src={HERO_BACKDROP}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={70}
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/15 to-ink/85" />
      </div>

      <div className="relative w-full max-w-md rounded-[2px] bg-paper p-8 text-ink shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] [--color-focus:var(--color-marigold-deep)] sm:p-10">
        <DaisyMark className="mx-auto mb-6 h-14 w-auto" />
        <h1 className="text-center text-heading">{t("signInTitle")}</h1>
        <p className="mt-3 text-center text-[0.9375rem] leading-relaxed text-ink-soft">
          {t("signInLead")}
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-6 border-l-2 border-marigold bg-paper-warm px-5 py-4 text-[0.9375rem] leading-relaxed"
          >
            {error === "rate" ? t("signInRateError") : t("signInLinkError")}
          </p>
        ) : null}
        <SignInForm googleAuthEnabled={googleAuthEnabled} />
      </div>
    </section>
  );
}
