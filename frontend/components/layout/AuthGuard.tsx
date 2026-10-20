"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useMe } from "@/hooks/useAuth";
import { ApiError } from "@/services/api";
import { ErrorState } from "@/components/common/ErrorState";

function AuthSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <span className="size-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    </div>
  );
}

/**
 * Wraps every signed-in page: shows a loading state, sends anonymous visitors
 * to /login, and surfaces a retryable error when the check fails.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isPending, isError, error, refetch } = useMe();

  useEffect(() => {
    if (isError) {
      const status = error instanceof ApiError ? error.status : 500;
      if (status === 401) router.replace("/login");
    }
  }, [error, isError, router]);

  if (isPending) return <AuthSkeleton />;

  if (isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorState
          title="We couldn't verify your session"
          message={
            error instanceof ApiError && error.status === 401
              ? "Your session has expired. Please sign in again."
              : "We couldn't reach the server. Check that the API is running and try again."
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}