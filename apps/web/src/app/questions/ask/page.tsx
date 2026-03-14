"use client";

import { QuestionForm } from "@/components/questions/question-form";
import { QuestionsLayout } from "@/components/questions/questions-layout";
import { getApiErrorMessage, isUnauthorizedError } from "@/lib/api/api-errors";
import { createQuestion, fetchPopularTags } from "@/lib/api/homepage-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function AskQuestionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: createQuestion,
    onSuccess: (question) => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["homepage-hot-network"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-popular-tags"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "homepage-questions",
      });
      router.push(`/questions/${question.postId}`);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        router.push("/sign-in?next=/questions/ask");
        return;
      }

      setErrorMessage(
        getApiErrorMessage(error, "Unable to create question. Please try again."),
      );
    },
  });

  return (
    <QuestionsLayout activeNavId="ask">
      <QuestionForm
        heading="Ask a public question"
        submitLabel="Ask a Question"
        tagOptions={tagOptions}
        isSubmitting={createMutation.isPending}
        errorMessage={errorMessage}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </QuestionsLayout>
  );
}
