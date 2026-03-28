"use client";

import type { QuestionUserVote } from "@/lib/homepage-types";

type VoteClusterProps = {
  upVoteCount: number;
  /** Stored positive count of downvotes; displayed with a minus when &gt; 0 */
  downVoteCount: number;
  currentUserVote: QuestionUserVote;
  disabled?: boolean;
  busy?: boolean;
  onVote: (value: 1 | -1 | 0) => void;
};

export function VoteCluster({
  upVoteCount,
  downVoteCount,
  currentUserVote,
  disabled = false,
  busy = false,
  onVote,
}: VoteClusterProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || busy}
        aria-label={currentUserVote === 1 ? "Remove upvote" : "Upvote"}
        onClick={() => onVote(currentUserVote === 1 ? 0 : 1)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          currentUserVote === 1
            ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
            : "border-white/10 text-[var(--text-soft)] hover:bg-white/5"
        }`}
      >
        <span aria-hidden>▲</span>
        <span className="font-medium tabular-nums">{upVoteCount}</span>
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        aria-label={currentUserVote === -1 ? "Remove downvote" : "Downvote"}
        onClick={() => onVote(currentUserVote === -1 ? 0 : -1)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          currentUserVote === -1
            ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
            : "border-white/10 text-[var(--text-soft)] hover:bg-white/5"
        }`}
      >
        <span aria-hidden>▼</span>
        <span className="font-medium tabular-nums">
          {downVoteCount > 0 ? `-${downVoteCount}` : "0"}
        </span>
      </button>
    </div>
  );
}
