import type { AppIcon } from "@/lib/icons";

export type FeedFilterKey =
  | "newest"
  | "recommended"
  | "frequent"
  | "unanswered";

export type NavItemId =
  | "home"
  | "collections"
  | "jobs"
  | "tags"
  | "communities"
  | "ask";

export type NavItem = {
  id: NavItemId;
  label: string;
  href: string;
  icon: AppIcon;
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
  answerItems?: QuestionAnswer[];
};

export type QuestionAnswer = {
  id: string;
  bodyMdx: string;
  authorName: string;
  authorHandle: string;
  avatarText: string;
  createdAtLabel: string;
  votes: number;
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

export type GlobalSearchSection = "questions" | "answers" | "users" | "tags";

export type GlobalSearchQuestionResult = {
  id: string;
  title: string;
  href: string;
  authorName: string;
  createdAtLabel: string;
  tags: string[];
};

export type GlobalSearchAnswerResult = {
  id: string;
  excerpt: string;
  href: string;
  authorName: string;
  questionTitle: string;
  createdAtLabel: string;
};

export type GlobalSearchUserResult = {
  id: string;
  username: string;
  displayName: string;
  href: string;
  reputationLabel: string;
};

export type GlobalSearchTagResult = {
  id: string;
  slug: string;
  displayName: string;
  href: string;
  countLabel: string;
};

export type GlobalSearchResponse = {
  query: string;
  questions: GlobalSearchQuestionResult[];
  answers: GlobalSearchAnswerResult[];
  users: GlobalSearchUserResult[];
  tags: GlobalSearchTagResult[];
};

export type QuestionFormValues = {
  title: string;
  bodyMdx: string;
  tagIds: number[];
};
