"use client";

import { MarkdownBodyField } from "@/components/questions/markdown-body-field";
import type { QuestionFormValues } from "@/lib/homepage-types";
import { useMemo, useRef, useState } from "react";

type TagOption = {
  id: number;
  label: string;
};

type QuestionFormProps = {
  heading: string;
  submitLabel: string;
  initialValues?: QuestionFormValues;
  /** Tags from the API suggestion pool (e.g. popular). */
  tagOptions: TagOption[];
  /**
   * Extra tag definitions (e.g. current question tags not in the popular list).
   * Merged with `tagOptions` for labels and the suggestion picker.
   */
  initialTagOptions?: TagOption[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: QuestionFormValues) => void;
};

export function QuestionForm({
  heading,
  submitLabel,
  initialValues,
  tagOptions,
  initialTagOptions = [],
  isSubmitting = false,
  errorMessage,
  onSubmit,
}: QuestionFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [bodyMdx, setBodyMdx] = useState(initialValues?.bodyMdx ?? "");
  const [tagIds, setTagIds] = useState<number[]>(initialValues?.tagIds ?? []);
  const [tagQuery, setTagQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const mergedTagOptions = useMemo(() => {
    const byId = new Map<number, TagOption>();
    for (const t of tagOptions) {
      byId.set(t.id, t);
    }
    for (const t of initialTagOptions) {
      byId.set(t.id, t);
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [tagOptions, initialTagOptions]);

  const tagsById = useMemo(
    () => new Map(mergedTagOptions.map((tag) => [tag.id, tag.label])),
    [mergedTagOptions],
  );

  const filteredSuggestions = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    return mergedTagOptions.filter(
      (t) => !tagIds.includes(t.id) && (!q || t.label.toLowerCase().includes(q)),
    );
  }, [mergedTagOptions, tagIds, tagQuery]);

  const canSubmit =
    title.trim().length > 0 &&
    bodyMdx.trim().length > 0 &&
    tagIds.length > 0 &&
    tagIds.length <= 5 &&
    !isSubmitting;

  function addTag(tagId: number) {
    setTagIds((current) => {
      if (current.includes(tagId) || current.length >= 5) return current;
      return [...current, tagId];
    });
    setTagQuery("");
    setSuggestOpen(false);
    tagInputRef.current?.focus();
  }

  function removeTag(tagId: number) {
    setTagIds((current) => current.filter((id) => id !== tagId));
  }

  function pickFirstSuggestion() {
    const first = filteredSuggestions[0];
    if (first) addTag(first.id);
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

  const asterisk = <span className="text-[#FF0000]">*</span>;

  return (
    <div className="rounded-2xl border border-white/10 bg-black p-8">
      <h1 className="mb-8 text-4xl font-semibold tracking-tight text-white">
        {heading}
      </h1>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="question-title"
            className="mb-2 block text-sm font-medium text-white"
          >
            Question Title {asterisk}
          </label>
          <input
            id="question-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter your question title"
            className="w-full rounded-lg border border-white/10 bg-[#15171C] px-4 py-3 text-sm text-white placeholder:text-[#7f8797] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="question-body"
            className="mb-2 block text-sm font-medium text-white"
          >
            Detailed explanation of your problem? {asterisk}
          </label>
          <MarkdownBodyField
            id="question-body"
            value={bodyMdx}
            onChange={setBodyMdx}
            rows={10}
            placeholder="Introduce the problem and expand on what you put in the title."
          />
        </div>

        <div className="relative">
          <span className="mb-2 block text-sm font-medium text-white">
            Tags {asterisk}
          </span>

          {tagIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {tagIds.map((id) => {
                const label = tagsById.get(id) ?? `Tag ${id}`;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#212734] py-1.5 pl-3 pr-1 text-xs font-medium uppercase tracking-wide text-white"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => removeTag(id)}
                      className="rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label={`Remove ${label}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <input
            ref={tagInputRef}
            id="question-tags-input"
            type="text"
            value={tagQuery}
            disabled={tagIds.length >= 5}
            autoComplete="off"
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSuggestOpen(false), 150);
            }}
            onChange={(e) => {
              setTagQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSuggestOpen(false);
                setTagQuery("");
                e.preventDefault();
              }
              if (e.key === "Enter" && suggestOpen && filteredSuggestions.length > 0) {
                e.preventDefault();
                pickFirstSuggestion();
              }
            }}
            placeholder={
              tagIds.length >= 5
                ? "Maximum 5 tags"
                : "Add tags…"
            }
            className="w-full rounded-lg border border-white/10 bg-[#15171C] px-4 py-3 text-sm text-white placeholder:text-[#7f8797] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
          />

          {suggestOpen &&
            tagIds.length < 5 &&
            filteredSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/10 bg-[#15171C] py-1 shadow-lg">
                {filteredSuggestions.slice(0, 12).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTag(t.id)}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

          <p className="mt-2 text-xs text-[#7f8797]">
            Add up to 5 tags to describe what your question is about. Start
            typing to see suggestions.
          </p>
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
            className="rounded-xl bg-gradient-to-r from-[#ff7a18] to-[#ffc894] px-8 py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
