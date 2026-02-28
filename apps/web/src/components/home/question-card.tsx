import type { QuestionSummary } from "@/lib/homepage-types";

type QuestionCardProps = {
  question: QuestionSummary;
};

export function QuestionCard({ question }: QuestionCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
      <h3 className="mb-3 text-lg font-semibold leading-6 text-[var(--text-strong)]">
        {question.title}
      </h3>

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
  );
}
