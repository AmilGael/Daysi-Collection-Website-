import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { SignInForm } from "@/components/sign-in-form";

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
    <>
      <PageHeader title={t("signInTitle")} lead={t("signInLead")} />
      <div className="shell flex flex-col gap-8 pb-28">
        {error ? (
          <p
            role="alert"
            className="max-w-lg border-l-2 border-marigold bg-paper-warm px-5 py-4 text-[0.9375rem] leading-relaxed"
          >
            {error === "rate" ? t("signInRateError") : t("signInLinkError")}
          </p>
        ) : null}
        <SignInForm />
      </div>
    </>
  );
}
