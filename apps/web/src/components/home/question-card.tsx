import type { QuestionSummary } from "@/lib/homepage-types";
import Link from "next/link";
import { useState } from "react";

type QuestionCardProps = {
  question: QuestionSummary;
  isDeleting?: boolean;
  onDeleteQuestion?: (questionId: string) => void;
};

export function QuestionCard({
  question,
  isDeleting = false,
  onDeleteQuestion,
}: QuestionCardProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  return (
    <>
      <article className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Link
            href={`/questions/${question.postId}`}
            className="text-lg font-semibold leading-6 text-[var(--text-strong)] hover:underline"
          >
            {question.title}
          </Link>
          {(question.canEdit || question.canDelete) && (
            <div className="relative">
              <button
                type="button"
                aria-label="Question actions"
                onClick={() => setIsActionsOpen((open) => !open)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-sm text-[var(--text-soft)] transition-colors hover:bg-white/10"
              >
                ⋯
              </button>
              {isActionsOpen && (
                <div className="absolute right-0 top-9 z-10 min-w-28 rounded-lg border border-white/10 bg-[var(--panel-bg)] p-1">
                  {question.canEdit && (
                    <Link
                      href={`/questions/${question.postId}/edit`}
                      onClick={() => setIsActionsOpen(false)}
                      className="block rounded-md px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-white/10"
                    >
                      Edit
                    </Link>
                  )}
                  {question.canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsOpen(false);
                        setIsDeleteModalOpen(true);
                      }}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-red-200 transition-colors hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {question.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-md bg-[var(--chip-bg)] px-2 py-1 text-[11px] text-[var(--text-soft)]"
            >
              {tag.displayName}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-soft)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold text-indigo-200">
              {question.avatarText}
            </span>
            <span>
              <span className="text-[var(--text-muted)]">{question.authorName}</span>
              <span className="mx-1">•</span>
              <span>{question.createdAtLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>{question.votes} Votes</span>
            <span>{question.answers} Answers</span>
            <span>{question.views} Views</span>
          </div>
        </div>
      </article>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[var(--panel-bg)] p-6">
            <h4 className="mb-2 text-lg font-semibold text-[var(--text-strong)]">
              Delete this question?
            </h4>
            <p className="mb-6 text-sm text-[var(--text-soft)]">
              This action permanently removes this question and related records.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  onDeleteQuestion?.(question.postId);
                  setIsDeleteModalOpen(false);
                }}
                className="rounded-lg border border-red-400/30 bg-red-500/20 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? "Deleting..." : "Delete question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
