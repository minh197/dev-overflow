type TopSearchProps = {
  placeholder?: string;
};

export function TopSearch({
  placeholder = "Search anything globally",
}: TopSearchProps) {
  return (
    <header className="mb-6 flex items-center gap-3">
      <label
        htmlFor="global-search"
        className="flex h-11 flex-1 items-center rounded-xl border border-white/10 bg-[var(--surface-muted)] px-4"
      >
        <span className="mr-2 text-xs text-[var(--text-soft)]">⌕</span>
        <input
          id="global-search"
          type="text"
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-[var(--text-strong)] placeholder:text-[var(--text-soft)] focus:outline-none"
        />
      </label>

      <button
        type="button"
        aria-label="Toggle theme"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[var(--surface)] text-sm text-[var(--text-muted)]"
      >
        ◐
      </button>
      <button
        type="button"
        aria-label="User profile"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700"
      >
        JS
      </button>
    </header>
  );
}
