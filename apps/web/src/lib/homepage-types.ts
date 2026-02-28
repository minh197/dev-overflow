export type FeedFilterKey =
  | "newest"
  | "recommended"
  | "frequent"
  | "unanswered";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

export type FeedFilter = {
  key: FeedFilterKey;
  label: string;
};

export type QuestionTag = {
  id: string;
  displayName: string;
};

export type QuestionSummary = {
  postId: string;
  title: string;
  authorName: string;
  authorHandle: string;
  avatarText: string;
  createdAtLabel: string;
  votes: number;
  answers: number;
  views: string;
  tags: QuestionTag[];
};

export type HotNetworkItem = {
  id: string;
  title: string;
};

export type PopularTag = {
  id: string;
  name: string;
  countLabel: string;
};
