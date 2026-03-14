import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthShell>{children}</AuthShell>;
}
