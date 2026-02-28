import type { HotNetworkItem, PopularTag } from "@/lib/homepage-types";

type RightRailProps = {
  hotNetwork: HotNetworkItem[];
  popularTags: PopularTag[];
};

export function RightRail({ hotNetwork, popularTags }: RightRailProps) {
  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <section className="mb-5 rounded-2xl border border-white/10 bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-strong)]">
          Hot Network
        </h2>
        <ul className="space-y-2">
          {hotNetwork.map((item) => (
            <li key={item.id}>
              <a
                href="#"
                className="text-xs leading-5 text-[var(--text-soft)] transition-colors hover:text-[var(--text-muted)]"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-strong)]">
          Popular Tags
        </h2>
        <ul className="space-y-2">
          {popularTags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--text-soft)]">{tag.name}</span>
              <span className="text-[11px] text-[var(--text-subtle)]">
                {tag.countLabel}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
