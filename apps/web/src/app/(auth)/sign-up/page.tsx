import { Suspense } from "react";

import { SignUpPage } from "@/components/auth/sign-up-page";

type SignUpRouteProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SignUpRoute({ searchParams }: SignUpRouteProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={null}>
      <SignUpPage nextPath={resolvedSearchParams.next ?? "/"} />
    </Suspense>
  );
}
