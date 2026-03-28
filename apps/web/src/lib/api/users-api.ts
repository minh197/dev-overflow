import { apiClient } from "@/lib/api/api-client";

export type UserDirectorySort = "popular" | "reputation" | "moderators";

export type UserListItem = {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  reputation: number;
};

export type UsersDirectoryResponse = {
  users: UserListItem[];
};

export async function fetchUsersDirectory(params: {
  sort?: UserDirectorySort;
  q?: string;
}): Promise<UsersDirectoryResponse> {
  const { data } = await apiClient.get<UsersDirectoryResponse>("/users", {
    params: {
      sort: params.sort,
      ...(params.q && params.q.length > 0 ? { q: params.q } : {}),
    },
  });
  return data;
}
