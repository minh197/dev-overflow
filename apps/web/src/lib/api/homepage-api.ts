import { apiClient } from "@/lib/api/api-client";
import type {
  FeedFilterKey,
  GlobalSearchResponse,
  HotNetworkItem,
  PopularTag,
  QuestionFormValues,
  QuestionSummary,
} from "@/lib/homepage-types";

type ApiUser = {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type ApiQuestionTag = {
  tag: {
    id: number;
    displayName: string;
  };
};

type ApiQuestion = {
  id: number;
  userId?: number;
  title: string | null;
  bodyMdx?: string;
  createdAt: string;
  upVoteCount: number;
  answerCount: number;
  viewCount: number;
  canEdit?: boolean;
  canDelete?: boolean;
  user: ApiUser;
  question: {
    id: number;
    questionTags?: ApiQuestionTag[];
  } | null;
  answers?: ApiAnswer[];
};

type ApiAnswer = {
  id: number;
  bodyMdx: string;
  createdAt: string;
  upVoteCount: number;
  user: ApiUser;
};

type ApiHotQuestion = {
  id: number;
  title: string | null;
  question: {
    id: number;
  } | null;
};

type ApiPopularTag = {
  id: number;
  displayName: string;
  slug: string;
  iconUrl: string | null;
  questionCount: number;
};

type ApiAuthMe = {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type ApiGlobalSearchQuestion = {
  id: string;
  title: string;
  href: string;
  authorName: string;
  createdAtLabel: string;
  tags: string[];
};

type ApiGlobalSearchAnswer = {
  id: string;
  excerpt: string;
  href: string;
  authorName: string;
  questionTitle: string;
  createdAtLabel: string;
};

type ApiGlobalSearchUser = {
  id: string;
  username: string;
  displayName: string;
  href: string;
  reputationLabel: string;
};

type ApiGlobalSearchTag = {
  id: string;
  slug: string;
  displayName: string;
  href: string;
  countLabel: string;
};

type ApiGlobalSearchResponse = {
  query: string;
  questions: ApiGlobalSearchQuestion[];
  answers: ApiGlobalSearchAnswer[];
  users: ApiGlobalSearchUser[];
  tags: ApiGlobalSearchTag[];
};

const feedSortMap: Record<FeedFilterKey, string> = {
  newest: "newest",
  recommended: "recommended",
  frequent: "frequent",
  unanswered: "unanswered",
};

function formatRelativeFromNow(isoDate: string) {
  const target = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - target);
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "asked just now";
  if (minutes < 60) return `asked ${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `asked ${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `asked ${days} day${days > 1 ? "s" : ""} ago`;
}

function compactViews(views: number) {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}m`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
  return String(views);
}

function initialsFromUser(user: ApiUser) {
  const source = user.fullName?.trim() || user.username;
  const chunks = source.split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return "U";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
}

function mapQuestion(item: ApiQuestion): QuestionSummary {
  return {
    postId: String(item.id),
    authorId: item.userId ?? item.user.id,
    title: item.title ?? "Untitled question",
    bodyMdx: item.bodyMdx,
    authorName: item.user.fullName ?? item.user.username,
    authorHandle: `@${item.user.username}`,
    avatarText: initialsFromUser(item.user),
    createdAtLabel: formatRelativeFromNow(item.createdAt),
    votes: item.upVoteCount,
    answers: item.answerCount,
    views: compactViews(item.viewCount),
    canEdit: item.canEdit ?? false,
    canDelete: item.canDelete ?? false,
    tags:
      item.question?.questionTags?.map((qt) => ({
        id: String(qt.tag.id),
        displayName: qt.tag.displayName,
      })) ?? [],
    answerItems:
      item.answers?.map((answer) => ({
        id: String(answer.id),
        bodyMdx: answer.bodyMdx,
        authorName: answer.user.fullName ?? answer.user.username,
        authorHandle: `@${answer.user.username}`,
        avatarText: initialsFromUser(answer.user),
        createdAtLabel: formatRelativeFromNow(answer.createdAt),
        votes: answer.upVoteCount,
      })) ?? [],
  };
}

function mapHotQuestion(item: ApiHotQuestion): HotNetworkItem {
  return {
    id: String(item.question?.id ?? item.id),
    title: item.title ?? "Untitled question",
  };
}

function mapPopularTag(item: ApiPopularTag): PopularTag {
  return {
    id: item.slug,
    tagId: item.id,
    name: item.displayName,
    countLabel: `${item.questionCount}+`,
  };
}

export async function fetchHomepageQuestions(filter: FeedFilterKey) {
  const { data } = await apiClient.get<ApiQuestion[]>("/questions", {
    params: {
      sort: feedSortMap[filter],
      limit: 20,
    },
  });
  return data.map(mapQuestion);
}

export async function fetchQuestionById(id: string) {
  const { data } = await apiClient.get<ApiQuestion>(`/questions/${id}`);
  return mapQuestion(data);
}

export async function createQuestion(payload: QuestionFormValues) {
  const { data } = await apiClient.post<ApiQuestion>("/questions", payload);
  return mapQuestion(data);
}

export async function updateQuestion(id: string, payload: QuestionFormValues) {
  const { data } = await apiClient.patch<ApiQuestion>(`/questions/${id}`, payload);
  return mapQuestion(data);
}

export async function deleteQuestion(id: string) {
  await apiClient.delete(`/questions/${id}`);
}

export async function fetchHotNetwork() {
  const { data } = await apiClient.get<ApiHotQuestion[]>("/questions/hot", {
    params: { limit: 5, windowDays: 7 },
  });
  return data.map(mapHotQuestion);
}

export async function fetchPopularTags() {
  const { data } = await apiClient.get<ApiPopularTag[]>("/tags/popular", {
    params: { limit: 8 },
  });
  return data.map(mapPopularTag);
}

export async function fetchAuthMe() {
  const { data } = await apiClient.get<ApiAuthMe>("/auth/me");
  return data;
}

export async function fetchGlobalSearch(query: string): Promise<GlobalSearchResponse> {
  const { data } = await apiClient.get<ApiGlobalSearchResponse>("/search/global", {
    params: {
      q: query,
      limitPerType: 5,
    },
  });

  return data;
}
