import Link from "next/link";

import { TextAlertsCallout } from "@/components/TextAlertsCallout";

export const metadata = { title: "Humor Study home demo" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DemoHomePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedParams = (await searchParams) ?? {};
  const viewRaw = resolvedParams.view;
  const isClassicView = (Array.isArray(viewRaw) ? viewRaw[0] : viewRaw) === "classic";

  return (
    <div className="relative flex h-[100svh] min-h-[100svh] flex-col overflow-hidden px-4 pt-8 pb-24 text-[var(--foreground)] sm:px-6 sm:pt-12">
      <main className="relative mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain p-1">
        <div className="glass-panel rounded-2xl p-6 text-center sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">No active studies</h1>
          {isClassicView ? null : (
            <TextAlertsCallout variant="hero" href="/demo/home?signup=1" />
          )}
        </div>
        {isClassicView ? null : (
          <p className="mt-6 text-center text-xs text-[var(--soft)]">
            Demo of the empty home page. In the real app the button opens the phone and text alert section of Settings.{" "}
            <Link href="/demo" className="font-semibold text-[var(--accent-strong)]">Back to the feed demo</Link>
          </p>
        )}
      </main>
    </div>
  );
}
