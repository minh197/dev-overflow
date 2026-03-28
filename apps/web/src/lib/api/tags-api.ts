import { apiClient } from "@/lib/api/api-client";

export type TagsDirectorySort = "popular" | "name";

export type TagListItem = {
  id: number;
  displayName: string;
  slug: string;
  description: string | null;
  questionCount: number;
  iconUrl: string | null;
};

export type TagsDirectoryResponse = {
  tags: TagListItem[];
};

export async function fetchTagsDirectory(params: {
  sort?: TagsDirectorySort;
  q?: string;
  limit?: number;
}): Promise<TagsDirectoryResponse> {
  const { data } = await apiClient.get<TagsDirectoryResponse>("/tags", {
    params: {
      sort: params.sort,
      limit: params.limit,
      ...(params.q && params.q.length > 0 ? { q: params.q } : {}),
    },
  });
  return data;
}
