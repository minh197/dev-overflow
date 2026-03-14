"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { FeedFilters } from "@/components/home/feed-filters";
import { QuestionCard } from "@/components/home/question-card";
import {
  deleteQuestion,
  fetchHomepageQuestions,
} from "@/lib/api/homepage-api";
import type { FeedFilter, FeedFilterKey, QuestionSummary } from "@/lib/homepage-types";

const filters: FeedFilter[] = [
  { key: "newest", label: "Newest" },
  { key: "recommended", label: "Recommended Questions" },
  { key: "frequent", label: "Frequent" },
  { key: "unanswered", label: "Unanswered" },
];

export function HomepageDesktop() {
  const [activeFilter, setActiveFilter] = useState<FeedFilterKey>("newest");
  const queryClient = useQueryClient();
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const {
    data: questions = [],
    isLoading: isQuestionsLoading,
    isError: isQuestionsError,
  } = useQuery<QuestionSummary[]>({
    queryKey: ["homepage-questions", activeFilter],
    queryFn: () => fetchHomepageQuestions(activeFilter),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuestion,
    onSuccess: () => {
      setDeleteErrorMessage(null);
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "homepage-questions",
      });
      queryClient.invalidateQueries({ queryKey: ["homepage-hot-network"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-popular-tags"] });
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setDeleteErrorMessage("You do not have permission to delete this question.");
      } else if (status === 404) {
        setDeleteErrorMessage("Question not found. It may already be removed.");
      } else {
        setDeleteErrorMessage("Failed to delete the question. Please retry.");
      }
    },
  });

  return (
    <AppShell activeNavId="home">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[var(--text-strong)]">
          All Questions
        </h1>
        <Link
          href="/questions/ask"
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Ask a Question
        </Link>
      </div>

      <FeedFilters
        items={filters}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="space-y-4">
        {isQuestionsLoading && (
          <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
            Loading questions...
          </div>
        )}
        {isQuestionsError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            Failed to load questions. Please refresh and try again.
          </div>
        )}
        {!isQuestionsLoading && !isQuestionsError && questions.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
            No questions found for this filter.
          </div>
        )}
        {deleteErrorMessage && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            {deleteErrorMessage}
          </div>
        )}
        {questions.map((question) => (
          <QuestionCard
            key={question.postId}
            question={question}
            isDeleting={deleteMutation.isPending}
            onDeleteQuestion={(questionId) => deleteMutation.mutate(questionId)}
          />
        ))}
      </div>
    </AppShell>
  );
}
