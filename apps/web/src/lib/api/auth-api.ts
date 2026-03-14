import axios from "axios";

import { apiClient } from "@/lib/api/api-client";
import type {
  AuthResponse,
  AuthUser,
  ForgotPasswordResponse,
  ResolveAccountLinkResponse,
} from "@/lib/auth-types";

type SignUpPayload = {
  username: string;
  email: string;
  password: string;
};

type SignInPayload = {
  email: string;
  password: string;
};

type ForgotPasswordPayload = {
  email: string;
};

type ResetPasswordPayload = {
  token: string;
  password: string;
  confirmPassword: string;
};

export async function fetchAuthMe(): Promise<AuthUser | null> {
  try {
    const { data } = await apiClient.get<AuthUser>("/auth/me");
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function signUp(payload: SignUpPayload) {
  const { data } = await apiClient.post<AuthResponse>("/auth/sign-up", payload);
  return data;
}

export async function signIn(payload: SignInPayload) {
  const { data } = await apiClient.post<AuthResponse>("/auth/sign-in", payload);
  return data;
}

export async function signOut() {
  const { data } = await apiClient.post<{ success: boolean }>("/auth/sign-out");
  return data;
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const { data } = await apiClient.post<ForgotPasswordResponse>(
    "/auth/forgot-password",
    payload,
  );
  return data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await apiClient.post<AuthResponse>("/auth/reset-password", payload);
  return data;
}

export async function resolveAccountLink(token: string) {
  const { data } = await apiClient.post<ResolveAccountLinkResponse>(
    "/auth/link/resolve",
    { token },
  );
  return data;
}

export async function unlinkProvider(provider: "github" | "google") {
  const { data } = await apiClient.post<{ success: boolean }>(
    `/auth/unlink/${provider}`,
  );
  return data;
}

export function getProviderAuthUrl(
  provider: "github" | "google",
  nextPath = "/",
) {
  const query = new URLSearchParams({ next: nextPath });
  const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return `${baseURL}/auth/${provider}?${query.toString()}`;
}
