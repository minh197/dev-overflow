import {
  BriefcaseBusinessIcon,
  CircleHelpIcon,
  FolderOpenIcon,
  HouseIcon,
  TagIcon,
  UsersIcon,
} from "@/lib/icons";

import type { NavItem, NavItemId } from "@/lib/homepage-types";

const baseNavItems: Omit<NavItem, "active">[] = [
  { id: "home", label: "Home", href: "/", icon: HouseIcon },
  { id: "collections", label: "Collections", href: "#", icon: FolderOpenIcon },
  { id: "jobs", label: "Find Jobs", href: "#", icon: BriefcaseBusinessIcon },
  { id: "tags", label: "Tags", href: "#", icon: TagIcon },
  { id: "communities", label: "Communities", href: "#", icon: UsersIcon },
  { id: "ask", label: "Ask a Question", href: "/questions/ask", icon: CircleHelpIcon },
];

export function getNavItems(activeNavId: NavItemId): NavItem[] {
  return baseNavItems.map((item) => ({
    ...item,
    active: item.id === activeNavId,
  }));
}

export function getInitials(nameOrUsername: string) {
  const chunks = nameOrUsername.split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "U";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}
