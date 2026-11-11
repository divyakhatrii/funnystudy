import Link from "next/link";

import { CaptionFeed } from "@/components/CaptionFeed";
import type { CaptionForVote } from "@/components/CaptionVoteFlow";
import demoCaptions from "@/lib/demo/study-122-captions.json";

export const metadata = { title: "Humor Study feed demo" };

export default function DemoFeedPage() {
  const captions = demoCaptions as CaptionForVote[];
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pointer-events-none">
        <p className="pointer-events-auto rounded-full border border-[var(--panel-border)] bg-[var(--menu-surface)] px-4 py-2 text-xs text-[var(--muted)] shadow-lg backdrop-blur">
          Demo mode: likes stay on this device. <Link href="/demo/home" className="font-semibold text-[var(--accent-strong)]">See empty home page</Link>
        </p>
      </div>
      <CaptionFeed
        demo
        captionOrder={captions.map((caption) => caption.id)}
        captions={captions}
        initialNextOffset={null}
        initialParticipation={null}
        initialTotalCaptionCount={captions.length}
        loadError={false}
        participationLoadError={false}
        studyId={122}
      />
    </>
  );
}
