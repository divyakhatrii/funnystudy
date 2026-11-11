"use client";

import { ArrowLeftIcon, ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartOutlineIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadMoreCaptionVoteCaptions,
  removeCaptionVote,
  saveCaptionNavigationEvent,
  saveCaptionVote,
} from "@/app/actions";
import { endStudy, startStudy } from "@/app/study/actions";
import { CompletedStudy } from "@/components/CompletedStudy";
import {
  createClientUuid,
  getCaptionVoteKey,
  summarizeCompletionStats,
  type CaptionForVote,
  type SessionStudyStatsState,
} from "@/components/CaptionVoteFlow";
import { HEART_VOTE_VALUE } from "@/lib/caption-votes";
import { STUDY_CAPTION_BATCH_SIZE } from "@/lib/study-caption-order";
import type { StudyParticipation } from "@/lib/study-participation";
import { buildThumbnailVariants } from "@/lib/thumbnails";

// A post counts as "seen" once most of it has been on screen for a moment, so
// fast flicks past a caption don't inflate the viewed count.
const VIEW_VISIBLE_RATIO = 0.6;
const VIEW_DWELL_MS = 450;
const LOAD_MORE_ROOT_MARGIN = "1600px 0px";
const DOUBLE_TAP_WINDOW_MS = 320;
const VOTE_SESSION_STORAGE_KEY = "captionVoteSessionId";

type VoteStatus = "removing" | "saving" | "saved";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function initialVoteStatuses(captions: readonly CaptionForVote[]) {
  const lookup: Record<string, VoteStatus> = {};
  for (const caption of captions) {
    const key = getCaptionVoteKey(caption);
    if (key && caption.isLiked) lookup[key] = "saved";
  }
  return lookup;
}

export function CaptionFeed({
  captionOrder,
  captions,
  includePrivateStudies,
  initialNextOffset,
  initialParticipation,
  initialTotalCaptionCount,
  loadError,
  participationLoadError,
  studyId,
}: {
  captionOrder: string[];
  captions: CaptionForVote[];
  includePrivateStudies?: boolean;
  initialNextOffset: number | null;
  initialParticipation: StudyParticipation | null;
  initialTotalCaptionCount: number;
  loadError: boolean;
  participationLoadError: boolean;
  studyId: number;
}) {
  // Server-action revalidation must not reset an active run.
  const [entry] = useState({ captions, initialNextOffset, initialParticipation });
  const [queue, setQueue] = useState(entry.captions);
  const [nextOffset, setNextOffset] = useState(entry.initialNextOffset);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [participation, setParticipation] = useState(entry.initialParticipation);
  const [participationPending, setParticipationPending] = useState(false);
  const [voteStatuses, setVoteStatuses] = useState(() => initialVoteStatuses(entry.captions));
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(loadError && entry.captions.length ? "We couldn't load every caption. Please refresh and try again." : null);
  const [stats, setStats] = useState<SessionStudyStatsState>({
    likedCaptionTimeMsByKey: {},
    navigationTimeMsByKey: {},
    viewedCaptionKeys: {},
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const firstVisibleAtRef = useRef<Record<string, number>>({});
  const navigationSavedRef = useRef<Set<string>>(new Set());
  const requestedOffsetsRef = useRef<Set<number>>(new Set());

  const hasStarted = Boolean(participation?.started_at);
  const isEnded = Boolean(participation?.ended_at);
  const totalCount = Math.max(initialTotalCaptionCount, queue.length);
  const viewedCount = Object.keys(stats.viewedCaptionKeys).length;
  const likedCount = Object.keys(stats.likedCaptionTimeMsByKey).length;
  const reachedEnd = nextOffset === null;

  const getSessionId = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current;
    let id = createClientUuid();
    try {
      const existing = window.sessionStorage.getItem(VOTE_SESSION_STORAGE_KEY);
      if (existing) id = existing;
      else window.sessionStorage.setItem(VOTE_SESSION_STORAGE_KEY, id);
    } catch {
      // Restricted storage: keep the in-memory id.
    }
    sessionIdRef.current = id;
    return id;
  }, []);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || isLoadingMore || requestedOffsetsRef.current.has(nextOffset)) return;
    const offset = nextOffset;
    requestedOffsetsRef.current.add(offset);
    setIsLoadingMore(true);
    try {
      const captionIds = captionOrder.slice(offset, offset + STUDY_CAPTION_BATCH_SIZE);
      const result = await loadMoreCaptionVoteCaptions({ captionIds, includePrivateStudies, studyId });
      if (!result.success) {
        requestedOffsetsRef.current.delete(offset);
        setError(result.error ?? "We couldn't load more captions. Please try again.");
        return;
      }
      setQueue((previous) => {
        const seen = new Set(previous.map((caption) => getCaptionVoteKey(caption)));
        return [...previous, ...result.captions.filter((caption) => !seen.has(getCaptionVoteKey(caption)))];
      });
      setVoteStatuses((previous) => ({ ...initialVoteStatuses(result.captions), ...previous }));
      const consumed = offset + captionIds.length;
      setNextOffset(consumed < captionOrder.length ? consumed : null);
    } catch (err) {
      console.error("[CaptionFeed] load more failed", err);
      requestedOffsetsRef.current.delete(offset);
      setError("We couldn't load more captions. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [captionOrder, includePrivateStudies, isLoadingMore, nextOffset, studyId]);

  const markViewed = useCallback((key: string) => {
    if (firstVisibleAtRef.current[key] === undefined) {
      firstVisibleAtRef.current[key] = nowMs();
    }
    setStats((previous) =>
      previous.viewedCaptionKeys[key]
        ? previous
        : { ...previous, viewedCaptionKeys: { ...previous.viewedCaptionKeys, [key]: true } }
    );
  }, []);

  // Fired once per caption when it scrolls up past the top of the feed: the
  // continuous-scroll equivalent of "moved on to the next caption".
  const markScrolledPast = useCallback((caption: CaptionForVote) => {
    const key = getCaptionVoteKey(caption);
    if (!key || navigationSavedRef.current.has(key)) return;
    const firstVisibleAt = firstVisibleAtRef.current[key];
    if (firstVisibleAt === undefined) return;
    navigationSavedRef.current.add(key);
    const timeToNextCaptionMs = Math.round(nowMs() - firstVisibleAt);
    setStats((previous) => ({
      ...previous,
      navigationTimeMsByKey: { ...previous.navigationTimeMsByKey, [key]: timeToNextCaptionMs },
    }));
    void saveCaptionNavigationEvent({
      captionId: caption.id,
      clientEventId: createClientUuid(),
      inputMethod: "swipe",
      sessionId: getSessionId(),
      studyCaptionMappingId: caption.studyCaptionMappingId,
      timeToNextCaptionMs,
    }).catch((err) => console.error("[CaptionFeed] navigation telemetry failed", err));
  }, [getSessionId]);

  const toggleHeart = useCallback((caption: CaptionForVote, inputMethod: "button" | "swipe") => {
    const key = getCaptionVoteKey(caption);
    if (!key || isEnded) return;
    const status = voteStatuses[key];
    if (status === "saving" || status === "removing") return;
    setError(null);
    setPendingCount((count) => count + 1);

    if (status === "saved") {
      setVoteStatuses((previous) => ({ ...previous, [key]: "removing" }));
      removeCaptionVote({ captionId: caption.id, studyCaptionMappingId: caption.studyCaptionMappingId })
        .then((result) => {
          if (!result?.success) {
            setVoteStatuses((previous) => ({ ...previous, [key]: "saved" }));
            setError(result?.error ?? "We couldn't remove your like. Please try again.");
            return;
          }
          setVoteStatuses((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
          });
          setStats((previous) => {
            const liked = { ...previous.likedCaptionTimeMsByKey };
            delete liked[key];
            return { ...previous, likedCaptionTimeMsByKey: liked };
          });
        })
        .catch(() => {
          setVoteStatuses((previous) => ({ ...previous, [key]: "saved" }));
          setError("We couldn't remove your like. Please try again.");
        })
        .finally(() => setPendingCount((count) => Math.max(0, count - 1)));
      return;
    }

    const firstVisibleAt = firstVisibleAtRef.current[key] ?? nowMs();
    const timeToVoteMs = Math.round(nowMs() - firstVisibleAt);
    setVoteStatuses((previous) => ({ ...previous, [key]: "saving" }));
    saveCaptionVote({
      captionId: caption.id,
      clientEventId: createClientUuid(),
      inputMethod,
      sessionId: getSessionId(),
      studyCaptionMappingId: caption.studyCaptionMappingId,
      timeToVoteMs,
      value: HEART_VOTE_VALUE,
    })
      .then((result) => {
        if (!result?.success) {
          setVoteStatuses((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
          });
          setError(result?.error ?? "We couldn't save your like. Please try again.");
          return;
        }
        setVoteStatuses((previous) => ({ ...previous, [key]: "saved" }));
        setStats((previous) => ({
          ...previous,
          likedCaptionTimeMsByKey: { ...previous.likedCaptionTimeMsByKey, [key]: timeToVoteMs },
          viewedCaptionKeys: { ...previous.viewedCaptionKeys, [key]: true },
        }));
      })
      .catch(() => {
        setVoteStatuses((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
        setError("We couldn't save your like. Please try again.");
      })
      .finally(() => setPendingCount((count) => Math.max(0, count - 1)));
  }, [getSessionId, isEnded, voteStatuses]);

  const handleStart = useCallback(async () => {
    if (participationPending) return;
    if (participation?.started_at && !participation.ended_at) return;
    setParticipationPending(true);
    setError(null);
    try {
      const result = await startStudy(studyId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setParticipation(result.participation);
    } catch {
      setError("We couldn't start this study. Please try again.");
    } finally {
      setParticipationPending(false);
    }
  }, [participation, participationPending, studyId]);

  const handleEnd = useCallback(async () => {
    if (participationPending || pendingCount > 0 || isEnded) return;
    setParticipationPending(true);
    setError(null);
    try {
      const result = await endStudy(studyId, summarizeCompletionStats(stats));
      if (!result.success) {
        setError(result.error);
        return;
      }
      setParticipation(result.participation);
      scrollRef.current?.scrollTo({ top: 0 });
    } catch {
      setError("We couldn't end this study. Please try again.");
    } finally {
      setParticipationPending(false);
    }
  }, [isEnded, participationPending, pendingCount, stats, studyId]);

  // One observer for all posts: tracks "seen" dwell and scrolled-past events.
  const postObserverRef = useRef<IntersectionObserver | null>(null);
  const captionByKeyRef = useRef<Map<string, CaptionForVote>>(new Map());
  const dwellTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    captionByKeyRef.current = new Map(
      queue.map((caption) => [getCaptionVoteKey(caption) ?? caption.id, caption])
    );
  }, [queue]);

  useEffect(() => {
    if (!hasStarted || isEnded) return;
    const root = scrollRef.current;
    const timers = dwellTimersRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const item of entries) {
          const key = (item.target as HTMLElement).dataset.voteKey;
          if (!key) continue;
          if (item.intersectionRatio >= VIEW_VISIBLE_RATIO || (item.isIntersecting && item.intersectionRect.height >= (item.rootBounds?.height ?? 0) * 0.5)) {
            if (!timers.has(key)) {
              timers.set(key, window.setTimeout(() => {
                timers.delete(key);
                markViewed(key);
              }, VIEW_DWELL_MS));
            }
          } else {
            const timer = timers.get(key);
            if (timer !== undefined) {
              window.clearTimeout(timer);
              timers.delete(key);
            }
            const scrolledAbove = item.rootBounds && item.boundingClientRect.bottom <= item.rootBounds.top + 4;
            const caption = captionByKeyRef.current.get(key);
            if (scrolledAbove && caption) markScrolledPast(caption);
          }
        }
      },
      { root, threshold: [0, 0.25, 0.5, VIEW_VISIBLE_RATIO, 0.9] }
    );
    postObserverRef.current = observer;
    root?.querySelectorAll<HTMLElement>("[data-vote-key]").forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      postObserverRef.current = null;
    };
  }, [hasStarted, isEnded, markScrolledPast, markViewed]);

  const observePost = useCallback((node: HTMLElement | null) => {
    if (node) postObserverRef.current?.observe(node);
  }, []);

  // Infinite scroll: fetch the next batch well before the reader hits the end.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasStarted || isEnded || reachedEnd) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((item) => item.isIntersecting)) void loadMore();
      },
      { root: scrollRef.current, rootMargin: LOAD_MORE_ROOT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasStarted, isEnded, loadMore, reachedEnd]);

  return (
    <div id="caption-feed-root" className="feed-shell flex h-[100svh] min-h-[100svh] flex-col overflow-hidden text-[var(--foreground)]">
      <header className="feed-topbar z-30 shrink-0 border-b border-[var(--feed-divider)] bg-[var(--feed-bar)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-2 px-2">
          <Link
            href="/"
            aria-label="Back to studies"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-strong)]"
          >
            <ArrowLeftIcon aria-hidden className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight">Humor Study</p>
            <p className="truncate text-xs text-[var(--soft)]">Study {studyId} · heart what made you laugh</p>
          </div>
          {hasStarted && !isEnded ? (
            <p className="shrink-0 rounded-full bg-[var(--feed-chip)] px-3 py-1 text-xs font-semibold tabular-nums" aria-live="polite">
              {viewedCount.toLocaleString("en-US")}/{totalCount.toLocaleString("en-US")} seen
            </p>
          ) : null}
        </div>
        {hasStarted && !isEnded && totalCount > 0 ? (
          <div className="h-0.5 w-full bg-[var(--feed-divider)]" aria-hidden>
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: `${Math.min(100, (viewedCount / totalCount) * 100)}%` }}
            />
          </div>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        id="caption-feed-scroll"
        data-native-scroll-region="true"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-0 pb-28 sm:gap-3 sm:px-3 sm:pt-3">
          {error ? (
            <p role="alert" className="mx-3 mt-3 rounded-xl bg-[var(--error-bg)] px-4 py-3 text-sm font-semibold text-[var(--error-text)] ring-1 ring-[var(--error-border)]">
              {error}
            </p>
          ) : null}

          {participationLoadError ? (
            <FeedNotice title="We couldn't load your study progress" body="Please refresh and try again." />
          ) : isEnded && participation ? (
            <div className="flex min-h-[70svh] px-3 pt-3">
              <CompletedStudy participation={participation} />
            </div>
          ) : loadError && queue.length === 0 ? (
            <FeedNotice title="We couldn't load captions" body="Refresh and try again." />
          ) : queue.length === 0 ? (
            <FeedNotice title="No captions in this study yet" body="Check back later." />
          ) : !hasStarted ? (
            <WelcomeCard onStart={handleStart} pending={participationPending} />
          ) : (
            <>
              {queue.map((caption, index) => {
                const key = getCaptionVoteKey(caption) ?? caption.id;
                return (
                  <FeedPost
                    key={key}
                    caption={caption}
                    index={index}
                    observeRef={observePost}
                    onToggleHeart={toggleHeart}
                    status={voteStatuses[key] ?? null}
                    voteKey={key}
                  />
                );
              })}
              <div ref={sentinelRef} aria-hidden className="h-px" />
              {!reachedEnd ? (
                <div className="flex justify-center py-8" role="status">
                  <span className="text-sm text-[var(--soft)]">{isLoadingMore ? "Loading more captions…" : " "}</span>
                </div>
              ) : (
                <EndCard
                  ending={participationPending}
                  likedCount={likedCount}
                  onEnd={handleEnd}
                  pendingCount={pendingCount}
                  viewedCount={viewedCount}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const FeedPost = memo(function FeedPost({
  caption,
  index,
  observeRef,
  onToggleHeart,
  status,
  voteKey,
}: {
  caption: CaptionForVote;
  index: number;
  observeRef: (node: HTMLElement | null) => void;
  onToggleHeart: (caption: CaptionForVote, inputMethod: "button" | "swipe") => void;
  status: VoteStatus | null;
  voteKey: string;
}) {
  const liked = status === "saved" || status === "saving";
  const pending = status === "saving" || status === "removing";
  const lastTapRef = useRef(0);
  const [burst, setBurst] = useState(0);

  const handleMediaTap = () => {
    const now = nowMs();
    if (now - lastTapRef.current <= DOUBLE_TAP_WINDOW_MS) {
      lastTapRef.current = 0;
      setBurst((value) => value + 1);
      if (!liked) onToggleHeart(caption, "swipe");
      return;
    }
    lastTapRef.current = now;
  };

  const handleHeart = () => {
    if (!liked) setBurst((value) => value + 1);
    onToggleHeart(caption, "button");
  };

  return (
    <article
      ref={observeRef}
      data-vote-key={voteKey}
      aria-label={`Caption ${index + 1}`}
      className="feed-post border-b border-[var(--feed-divider)] bg-[var(--feed-card)] px-4 pt-4 pb-2 sm:rounded-2xl sm:border sm:shadow-[var(--feed-card-shadow)]"
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-[var(--soft)]">
        <span className="feed-avatar flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" aria-hidden>
          {((index % 26) + 10).toString(36).toUpperCase()}
        </span>
        <span className="font-semibold text-[var(--muted)]">Anonymous</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">#{index + 1}</span>
      </div>

      <div onClick={handleMediaTap} className="relative select-none">
        {caption.content ? (
          <p className="whitespace-pre-wrap break-words text-[17px] leading-snug text-[var(--foreground)]">
            {caption.content}
          </p>
        ) : null}
        {caption.imageSrc ? <FeedImage src={caption.imageSrc} /> : null}
        {burst > 0 ? (
          <span key={burst} className="feed-heart-pop pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <HeartSolidIcon className="h-24 w-24 text-[var(--heart-active)] drop-shadow-lg" />
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          data-heart-vote-control
          onClick={handleHeart}
          disabled={pending}
          aria-pressed={liked}
          aria-label={liked ? "Remove like" : "Like this caption"}
          className={`-ml-2 flex h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold transition active:scale-95 disabled:cursor-wait ${
            liked ? "text-[var(--heart-active)]" : "text-[var(--soft)] hover:text-[var(--heart-hover)]"
          }`}
        >
          {liked ? <HeartSolidIcon className="h-6 w-6" aria-hidden /> : <HeartOutlineIcon className="h-6 w-6" aria-hidden />}
          <span>{liked ? "Funny" : "Funny?"}</span>
        </button>
        {index === 0 ? (
          <span className="flex items-center gap-1 text-xs text-[var(--soft)]" aria-hidden>
            <ChatBubbleOvalLeftIcon className="h-4 w-4" />
            Tip: double-tap a post to like it
          </span>
        ) : null}
      </div>
    </article>
  );
});

function FeedImage({ src }: { src: string }) {
  const variants = useMemo(() => buildThumbnailVariants(src), [src]);
  const [failedThumb, setFailedThumb] = useState(false);
  const useThumb = variants && !failedThumb;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={useThumb ? variants.src : src}
      srcSet={useThumb ? variants.srcSet : undefined}
      sizes={useThumb ? "(min-width: 640px) 576px, 100vw" : undefined}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        if (useThumb) setFailedThumb(true);
      }}
      className="mt-3 block h-auto max-h-[70svh] w-full rounded-xl bg-[var(--surface-muted)] object-contain"
    />
  );
}

function WelcomeCard({ onStart, pending }: { onStart: () => void; pending: boolean }) {
  return (
    <div className="mx-3 mt-4 rounded-2xl border border-[var(--feed-divider)] bg-[var(--feed-card)] p-6 shadow-[var(--feed-card-shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--soft)]">The Humor Study</p>
      <h1 className="mt-2 text-2xl font-black leading-tight">Scroll. Laugh. Heart it.</h1>
      <ul className="mt-4 space-y-2 text-[15px] leading-6 text-[var(--muted)]">
        <li>Scroll through captions like any feed.</li>
        <li>Tap the heart (or double-tap the post) on the ones you find funny.</li>
        <li>Hit End Study at the bottom to save your completion and see your stats.</li>
      </ul>
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-contrast)] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start scrolling"}
      </button>
    </div>
  );
}

function EndCard({ ending, likedCount, onEnd, pendingCount, viewedCount }: {
  ending: boolean;
  likedCount: number;
  onEnd: () => void;
  pendingCount: number;
  viewedCount: number;
}) {
  return (
    <div className="mx-3 my-6 rounded-2xl border border-[var(--feed-divider)] bg-[var(--feed-card)] p-6 text-center shadow-[var(--feed-card-shadow)]">
      <h2 className="text-xl font-bold">You&apos;re all caught up</h2>
      <p className="mt-2 text-sm text-[var(--soft)]">
        You liked {likedCount.toLocaleString("en-US")} of {viewedCount.toLocaleString("en-US")} captions you saw. End the study to save your completion and see your humor stats.
      </p>
      {pendingCount > 0 ? <p role="status" className="mt-3 text-sm text-[var(--soft)]">Saving your last like…</p> : null}
      <button
        type="button"
        onClick={onEnd}
        disabled={ending || pendingCount > 0}
        className="mt-5 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)] disabled:cursor-wait disabled:opacity-60"
      >
        {ending ? "Ending…" : "End Study"}
      </button>
    </div>
  );
}

function FeedNotice({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert" className="mx-3 mt-6 rounded-2xl border border-[var(--feed-divider)] bg-[var(--feed-card)] p-6 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-[var(--soft)]">{body}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[var(--accent-strong)]">Back to studies</Link>
    </div>
  );
}
