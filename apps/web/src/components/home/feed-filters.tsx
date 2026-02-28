import type { FeedFilter, FeedFilterKey } from "@/lib/homepage-types";

type FeedFiltersProps = {
  items: FeedFilter[];
  activeFilter: FeedFilterKey;
  onFilterChange: (nextFilter: FeedFilterKey) => void;
};

export function FeedFilters({
  items,
  activeFilter,
  onFilterChange,
}: FeedFiltersProps) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.key === activeFilter;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilterChange(item.key)}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              active
                ? "bg-[var(--chip-active-bg)] text-[var(--text-strong)]"
                : "bg-[var(--chip-bg)] text-[var(--text-soft)] hover:text-[var(--text-muted)]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
