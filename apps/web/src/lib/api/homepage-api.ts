import { apiClient } from "@/lib/api/api-client";
import type {
  FeedFilterKey,
  HotNetworkItem,
  PopularTag,
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
  title: string | null;
  createdAt: string;
  upVoteCount: number;
  answerCount: number;
  viewCount: number;
  user: ApiUser;
  question: {
    id: number;
    questionTags?: ApiQuestionTag[];
  } | null;
};

type ApiHotQuestion = {
  id: number;
  title: string | null;
  question: {
    id: number;
  } | null;
};

type ApiPopularTag = {
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
    title: item.title ?? "Untitled question",
    authorName: item.user.fullName ?? item.user.username,
    authorHandle: `@${item.user.username}`,
    avatarText: initialsFromUser(item.user),
    createdAtLabel: formatRelativeFromNow(item.createdAt),
    votes: item.upVoteCount,
    answers: item.answerCount,
    views: compactViews(item.viewCount),
    tags:
      item.question?.questionTags?.map((qt) => ({
        id: String(qt.tag.id),
        displayName: qt.tag.displayName,
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
