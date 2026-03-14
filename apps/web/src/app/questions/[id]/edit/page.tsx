"use client";

import { QuestionForm } from "@/components/questions/question-form";
import { QuestionsLayout } from "@/components/questions/questions-layout";
import { getApiErrorMessage, isUnauthorizedError } from "@/lib/api/api-errors";
import {
  fetchPopularTags,
  fetchQuestionById,
  updateQuestion,
} from "@/lib/api/homepage-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  const questionId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const { data: popularTags = [] } = useQuery({
    queryKey: ["homepage-popular-tags"],
    queryFn: fetchPopularTags,
  });

  const tagOptions = useMemo(
    () =>
      popularTags
        .filter((tag) => typeof tag.tagId === "number")
        .map((tag) => ({
          id: tag.tagId as number,
          label: tag.name,
        })),
    [popularTags],
  );

  const updateMutation = useMutation({
    mutationFn: (values: { title: string; bodyMdx: string; tagIds: number[] }) =>
      updateQuestion(questionId, values),
    onSuccess: (updatedQuestion) => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["question-detail", questionId] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "homepage-questions",
      });
      router.push(`/questions/${updatedQuestion.postId}`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        router.push(`/sign-in?next=/questions/${questionId}/edit`);
        return;
      }

      setErrorMessage(
        getApiErrorMessage(error, "Unable to update question. Please try again."),
      );
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
        <QuestionForm
          heading="Edit a question"
          submitLabel="Save Changes"
          initialValues={{
            title: question.title,
            bodyMdx: question.bodyMdx ?? "",
            tagIds: question.tags.map((tag) => Number(tag.id)),
          }}
          tagOptions={tagOptions}
          isSubmitting={updateMutation.isPending}
          errorMessage={errorMessage}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      )}
    </QuestionsLayout>
  );
}
