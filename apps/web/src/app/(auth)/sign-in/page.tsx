import { Suspense } from "react";

import { SignInPage } from "@/components/auth/sign-in-page";

type SignInRouteProps = {
  searchParams: Promise<{
    next?: string;
    email?: string;
    signup?: string;
  }>;
};

export default async function SignInRoute({ searchParams }: SignInRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={null}>
      <SignInPage
        nextPath={resolvedSearchParams.next ?? "/"}
        initialEmail={resolvedSearchParams.email}
        showSignupSuccess={resolvedSearchParams.signup === "success"}
      />
    </Suspense>
  );
}
