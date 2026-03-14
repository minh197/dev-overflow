export type AuthUser = {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type AuthResponse = {
  user: AuthUser;
};

export type ForgotPasswordResponse = {
  success: boolean;
  email: string;
  resetUrl?: string;
};

export type ResolveAccountLinkResponse = {
  user: AuthUser;
  nextPath: string;
};
