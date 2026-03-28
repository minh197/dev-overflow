"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import {
  ChevronDownIcon,
  ListFilterIcon,
  SearchIcon,
} from "@/lib/icons";
import {
  fetchTagsDirectory,
  type TagListItem,
  type TagsDirectorySort,
} from "@/lib/api/tags-api";

const SORT_OPTIONS: { value: TagsDirectorySort; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "name", label: "Name" },
];

const sortToolbarLabels: Record<TagsDirectorySort, string> = {
  popular: "Most popular",
  name: "Name",
};

function TagCard({ tag }: { tag: TagListItem }) {
  const body =
    tag.description?.trim().length ? tag.description.trim() : "No description yet.";

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-[var(--surface)] p-4 shadow-sm">
      <span className="inline-flex w-fit rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-[var(--text-strong)]">
        {tag.displayName}
      </span>
      <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">
        {body}
      </p>
      <p className="mt-4 text-sm">
        <span className="font-semibold tabular-nums text-[var(--accent)]">
          {tag.questionCount}
        </span>
        <span className="text-[var(--text-muted)]">+ Questions</span>
      </p>
    </article>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: TagsDirectorySort;
  onChange: (next: TagsDirectorySort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 min-w-[12rem] items-center gap-2 rounded-xl border border-white/10 bg-[var(--surface)] px-3 text-sm text-[var(--text-strong)] transition-colors hover:border-white/20"
      >
        <ListFilterIcon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <span className="min-w-0 flex-1 truncate text-left">
          {sortToolbarLabels[value]}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          className="absolute right-0 z-20 mt-1 min-w-full rounded-xl border border-white/10 bg-[var(--surface)] py-1 shadow-lg"
          role="listbox"
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent)] font-medium text-black"
                      : "text-[var(--text-soft)] hover:bg-white/5 hover:text-[var(--text-strong)]"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TagsDesktop() {
  const [sort, setSort] = useState<TagsDirectorySort>("popular");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tags-directory", sort, debouncedQ],
    queryFn: () =>
      fetchTagsDirectory({
        sort,
        q: debouncedQ.length > 0 ? debouncedQ : undefined,
      }),
  });

  const tags = data?.tags ?? [];

  return (
    <AppShell activeNavId="tags">
      <h1 className="mb-6 text-3xl font-semibold text-[var(--text-strong)]">
        Tags
      </h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search by tag name</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by tag name..."
            className="h-11 w-full rounded-xl border border-white/10 bg-[var(--surface)] py-2 pl-10 pr-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]/50"
            autoComplete="off"
          />
        </label>
        <SortDropdown value={sort} onChange={setSort} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {isLoading && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
            Loading tags...
          </div>
        )}
        {isError && (
          <div className="col-span-full rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
            Failed to load tags. Please refresh and try again.
          </div>
        )}
        {!isLoading && !isError && tags.length === 0 && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-soft)]">
            No tags match your search.
          </div>
        )}
        {!isLoading &&
          !isError &&
          tags.map((tag) => <TagCard key={tag.id} tag={tag} />)}
      </div>
    </AppShell>
  );
}
