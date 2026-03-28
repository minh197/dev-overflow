"use client";

import { VoteCluster } from "@/components/questions/vote-cluster";
import { QuestionsLayout } from "@/components/questions/questions-layout";
import {
  castVote,
  createAnswer,
  deleteQuestion,
  fetchQuestionById,
  type AnswerSortParam,
} from "@/lib/api/homepage-api";
import { fetchAuthMe } from "@/lib/api/auth-api";
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
  const [answerSort, setAnswerSort] = useState<AnswerSortParam>("upvotes");
  const [answerDraft, setAnswerDraft] = useState("");
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteBusyId, setVoteBusyId] = useState<number | null>(null);

  const { data: authUser } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthMe,
    staleTime: 30_000,
  });

  const {
    data: question,
    isLoading: isQuestionLoading,
    isError: isQuestionError,
  } = useQuery({
    queryKey: ["question-detail", questionId, answerSort],
    queryFn: () => fetchQuestionById(questionId, answerSort),
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

  const answerMutation = useMutation({
    mutationFn: () => createAnswer(questionId, answerDraft.trim()),
    onSuccess: (data) => {
      setAnswerDraft("");
      setErrorMessage(null);
      queryClient.setQueryData(["question-detail", questionId, answerSort], data);
      queryClient.invalidateQueries({
        queryKey: ["question-detail", questionId],
      });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "homepage-questions",
      });
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setErrorMessage("Sign in to post an answer.");
      } else {
        setErrorMessage("Could not post your answer. Please try again.");
      }
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({
      postId,
      value,
    }: {
      postId: number;
      value: 1 | -1 | 0;
    }) => castVote(postId, value),
    onMutate: ({ postId }) => {
      setVoteBusyId(postId);
      setVoteError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["question-detail", questionId],
      });
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setVoteError("You cannot vote on your own post.");
      } else if (status === 401) {
        setVoteError("Sign in to vote.");
      } else {
        setVoteError("Vote could not be saved.");
      }
    },
    onSettled: () => {
      setVoteBusyId(null);
    },
  });

  const answers = question?.answerItems ?? [];
  const questionPostId = question ? Number(question.postId) : 0;
  const canVoteQuestion =
    Boolean(authUser) && question && authUser!.id !== question.authorId;

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

            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-soft)]">
              {authUser ? (
                <VoteCluster
                  upVoteCount={question.votes}
                  downVoteCount={question.downVoteCount ?? 0}
                  currentUserVote={question.currentUserVote ?? null}
                  disabled={!canVoteQuestion}
                  busy={voteBusyId === questionPostId}
                  onVote={(value) => {
                    if (!canVoteQuestion) return;
                    voteMutation.mutate({ postId: questionPostId, value });
                  }}
                />
              ) : (
                <>
                  <span>
                    {question.votes} up · {question.downVoteCount ?? 0} down
                  </span>
                  <Link
                    href={`/sign-in?next=/questions/${questionId}`}
                    className="text-amber-300/90 underline-offset-2 hover:underline"
                  >
                    Sign in to vote
                  </Link>
                </>
              )}
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

          <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-amber-400">
                {question.answers} Answers
              </h2>
              <label className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
                <span className="hidden sm:inline">Sort</span>
                <select
                  value={answerSort}
                  onChange={(e) =>
                    setAnswerSort(e.target.value as AnswerSortParam)
                  }
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[var(--text-muted)]"
                >
                  <option value="upvotes">Highest upvotes</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>

            {voteError && (
              <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                {voteError}
              </div>
            )}

            {answers.length === 0 ? (
              <p className="text-sm text-[var(--text-soft)]">
                No answers yet. Be the first to answer.
              </p>
            ) : (
              <div className="space-y-4">
                {answers.map((answer) => {
                  const postId = Number(answer.id);
                  const canVoteAnswer =
                    Boolean(authUser) && authUser!.id !== answer.authorId;
                  return (
                    <article
                      key={answer.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-soft)]">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold text-indigo-200">
                          {answer.avatarText}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {answer.authorName}
                        </span>
                        <span>·</span>
                        <span>{answer.createdAtLabel}</span>
                        {authUser ? (
                          <VoteCluster
                            upVoteCount={answer.upVoteCount}
                            downVoteCount={answer.downVoteCount}
                            currentUserVote={answer.currentUserVote}
                            disabled={!canVoteAnswer}
                            busy={voteBusyId === postId}
                            onVote={(value) => {
                              if (!canVoteAnswer) return;
                              voteMutation.mutate({ postId, value });
                            }}
                          />
                        ) : (
                          <span>
                            {answer.upVoteCount} up · {answer.downVoteCount}{" "}
                            down
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
                        {answer.bodyMdx}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-strong)]">
                Your answer
              </h3>
              {authUser ? (
                <>
                  <textarea
                    value={answerDraft}
                    onChange={(e) => setAnswerDraft(e.target.value)}
                    rows={6}
                    maxLength={20000}
                    placeholder="Write your answer (Markdown supported by the server)…"
                    className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-[var(--text-muted)] placeholder:text-[var(--text-soft)]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={
                        answerMutation.isPending ||
                        answerDraft.trim().length === 0
                      }
                      onClick={() => answerMutation.mutate()}
                      className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {answerMutation.isPending ? "Posting…" : "Post answer"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--text-soft)]">
                  <Link
                    href={`/sign-in?next=/questions/${questionId}`}
                    className="text-amber-300/90 underline-offset-2 hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to post an answer.
                </p>
              )}
            </div>
          </section>
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
