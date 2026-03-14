"use client";

import type { QuestionFormValues } from "@/lib/homepage-types";
import { useMemo, useState } from "react";

type TagOption = {
  id: number;
  label: string;
};

type QuestionFormProps = {
  heading: string;
  submitLabel: string;
  initialValues?: QuestionFormValues;
  tagOptions: TagOption[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: QuestionFormValues) => void;
};

export function QuestionForm({
  heading,
  submitLabel,
  initialValues,
  tagOptions,
  isSubmitting = false,
  errorMessage,
  onSubmit,
}: QuestionFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [bodyMdx, setBodyMdx] = useState(initialValues?.bodyMdx ?? "");
  const [tagIds, setTagIds] = useState<number[]>(initialValues?.tagIds ?? []);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tagsById = useMemo(
    () => new Map(tagOptions.map((tag) => [tag.id, tag.label])),
    [tagOptions],
  );

  const selectedTagLabels = tagIds
    .map((id) => tagsById.get(id))
    .filter((label): label is string => Boolean(label));

  const canSubmit =
    title.trim().length > 0 &&
    bodyMdx.trim().length > 0 &&
    tagIds.length > 0 &&
    tagIds.length <= 5 &&
    !isSubmitting;

  function toggleTag(tagId: number) {
    setTagIds((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, tagId];
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setValidationError(
        "Please fill title, details, and choose between 1 and 5 tags.",
      );
      return;
    }

    setValidationError(null);
    onSubmit({
      title: title.trim(),
      bodyMdx: bodyMdx.trim(),
      tagIds,
    });
  }

  return (
    <div className="rounded-2xl border border-[#2275bf] bg-black/30 p-8">
      <h1 className="mb-8 text-4xl font-semibold text-[var(--text-strong)]">
        {heading}
      </h1>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="question-title"
            className="mb-2 block text-sm font-medium text-[var(--text-strong)]"
          >
            Question Title <span className="text-[var(--accent)]">*</span>
          </label>
          <input
            id="question-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter your question title"
            className="w-full rounded-lg border border-white/10 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="question-body"
            className="mb-2 block text-sm font-medium text-[var(--text-strong)]"
          >
            Detailed explanation of your problem?{" "}
            <span className="text-[var(--accent)]">*</span>
          </label>
          <textarea
            id="question-body"
            value={bodyMdx}
            onChange={(event) => setBodyMdx(event.target.value)}
            rows={10}
            placeholder="Introduce the problem and expand on what you put in the title."
            className="w-full rounded-lg border border-white/10 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-[var(--text-strong)]">
            Tags <span className="text-[var(--accent)]">*</span>
          </span>
          <div className="mb-3 flex flex-wrap gap-2">
            {tagOptions.map((tag) => {
              const isSelected = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--text-strong)]"
                      : "border-white/10 bg-[var(--surface-muted)] text-[var(--text-soft)] hover:border-white/30"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[var(--text-subtle)]">
            Add up to 5 tags to describe your question.
          </p>
          {selectedTagLabels.length > 0 && (
            <p className="mt-2 text-xs text-[var(--text-soft)]">
              Selected: {selectedTagLabels.join(", ")}
            </p>
          )}
        </div>

        {(validationError || errorMessage) && (
          <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {validationError ?? errorMessage}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
