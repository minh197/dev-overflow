"use client";

import { QuestionsLayout } from "@/components/questions/questions-layout";
import { deleteQuestion, fetchQuestionById } from "@/lib/api/homepage-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function QuestionDetailPage() {
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: question,
    isLoading: isQuestionLoading,
    isError: isQuestionError,
  } = useQuery({
    queryKey: ["question-detail", questionId],
    queryFn: () => fetchQuestionById(questionId),
    enabled: Boolean(questionId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuestion(questionId),
    onSuccess: () => {
      setErrorMessage(null);
      setIsDeleteModalOpen(false);
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "homepage-questions",
      });
      queryClient.invalidateQueries({ queryKey: ["homepage-hot-network"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-popular-tags"] });
      router.push("/");
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setErrorMessage("You do not have permission to delete this question.");
      } else if (status === 404) {
        setErrorMessage("Question not found. It may already be removed.");
      } else {
        setErrorMessage("Delete failed. Please try again.");
      }
    },
  });

  return (
    <QuestionsLayout activeNavId="home">
      {isQuestionLoading && (
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
          Loading question...
        </div>
      )}
      {isQuestionError && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load question.
        </div>
      )}
      {question && (
        <div className="space-y-6">
          <article className="rounded-2xl border border-white/10 bg-black/40 p-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="text-3xl font-semibold text-[var(--text-strong)]">
                {question.title}
              </h1>

              {(question.canEdit || question.canDelete) && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Question actions"
                    onClick={() => setIsActionsOpen((open) => !open)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-sm text-[var(--text-soft)] transition-colors hover:bg-white/10"
                  >
                    ⋯
                  </button>
                  {isActionsOpen && (
                    <div className="absolute right-0 top-10 z-10 min-w-32 rounded-lg border border-white/10 bg-[var(--panel-bg)] p-1">
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

            <p className="mb-8 text-sm leading-7 text-[var(--text-muted)]">
              {question.bodyMdx}
            </p>

            <div className="flex items-center gap-4 text-xs text-[var(--text-soft)]">
              <span>{question.votes} Votes</span>
              <span>{question.answers} Answers</span>
              <span>{question.views} Views</span>
              <span>{question.createdAtLabel}</span>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
          </article>

          {question.answerItems && question.answerItems.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[var(--text-strong)]">
                  Answers
                </h2>
                <span className="text-xs text-[var(--text-soft)]">
                  {question.answerItems.length} result
                  {question.answerItems.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-4">
                {question.answerItems.map((answer) => (
                  <article
                    key={answer.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <div className="mb-3 flex items-center gap-3 text-xs text-[var(--text-soft)]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold text-indigo-200">
                        {answer.avatarText}
                      </span>
                      <span className="text-[var(--text-muted)]">{answer.authorName}</span>
                      <span>·</span>
                      <span>{answer.createdAtLabel}</span>
                      <span>·</span>
                      <span>{answer.votes} Votes</span>
                    </div>
                    <p className="text-sm leading-7 text-[var(--text-muted)]">
                      {answer.bodyMdx}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[var(--panel-bg)] p-6">
            <h2 className="mb-2 text-lg font-semibold text-[var(--text-strong)]">
              Delete this question?
            </h2>
            <p className="mb-6 text-sm text-[var(--text-soft)]">
              This action permanently removes the question and related content.
              This cannot be undone.
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
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-red-400/30 bg-red-500/20 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </QuestionsLayout>
  );
}
