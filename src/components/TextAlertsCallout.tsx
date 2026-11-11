import Link from "next/link";
import { BellAlertIcon } from "@heroicons/react/24/outline";

export function TextAlertsCallout({ variant, href = "/settings#text-alerts" }: { variant: "hero" | "banner"; href?: string }) {
  if (variant === "banner") {
    return (
      <Link
        href={href}
        className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-muted)] px-4 py-3 text-sm transition hover:border-[var(--accent)]"
      >
        <BellAlertIcon aria-hidden className="h-5 w-5 shrink-0 text-[var(--accent-strong)]" />
        <span className="min-w-0 flex-1">Get a text when the next study drops.</span>
        <span className="shrink-0 font-semibold text-[var(--accent-strong)]">Sign up</span>
      </Link>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-base text-[var(--muted)]">
        Sign up for text notifications when the next one is out!
      </p>
      <Link
        href={href}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-contrast)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] sm:w-auto"
      >
        <BellAlertIcon aria-hidden className="h-5 w-5" />
        Text me when it&apos;s out
      </Link>
      <p className="text-xs text-[var(--soft)]">
        Takes about a minute: add your number, enter the code, and turn on text alerts.
      </p>
    </div>
  );
}
