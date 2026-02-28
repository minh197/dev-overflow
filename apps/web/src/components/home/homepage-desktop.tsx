"use client";

import { useMemo, useState } from "react";

import { FeedFilters } from "@/components/home/feed-filters";
import { LeftSidebar } from "@/components/home/left-sidebar";
import { QuestionCard } from "@/components/home/question-card";
import { RightRail } from "@/components/home/right-rail";
import { TopSearch } from "@/components/home/top-search";
import { homepageData } from "@/lib/homepage-mock-data";
import type { FeedFilterKey } from "@/lib/homepage-types";

export function HomepageDesktop() {
  const [activeFilter, setActiveFilter] = useState<FeedFilterKey>("newest");

  const questions = useMemo(
    () => homepageData.questionsByFilter[activeFilter],
    [activeFilter],
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-muted)]">
      <div className="mx-auto flex max-w-[1400px]">
        <LeftSidebar navItems={homepageData.navItems} />

        <main className="flex min-h-screen flex-1 gap-6 px-6 py-5">
          <section className="min-w-0 flex-1">
            <TopSearch />

            <div className="mb-6 flex items-center justify-between gap-3">
              <h1 className="text-3xl font-semibold text-[var(--text-strong)]">
                All Questions
              </h1>
              <button
                type="button"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                Ask a Question
              </button>
            </div>

            <FeedFilters
              items={homepageData.filters}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            <div className="space-y-4">
              {questions.map((question) => (
                <QuestionCard key={question.postId} question={question} />
              ))}
            </div>
          </section>

          <RightRail
            hotNetwork={homepageData.hotNetwork}
            popularTags={homepageData.popularTags}
          />
        </main>
      </div>
    </div>
  );
}
