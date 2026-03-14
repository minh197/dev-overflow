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
  authorId: number;
  title: string;
  bodyMdx?: string;
  authorName: string;
  authorHandle: string;
  avatarText: string;
  createdAtLabel: string;
  votes: number;
  answers: number;
  views: string;
  canEdit?: boolean;
  canDelete?: boolean;
  tags: QuestionTag[];
};

export type HotNetworkItem = {
  id: string;
  title: string;
};

export type PopularTag = {
  id: string;
  tagId?: number;
  name: string;
  countLabel: string;
};

export type QuestionFormValues = {
  title: string;
  bodyMdx: string;
  tagIds: number[];
};
