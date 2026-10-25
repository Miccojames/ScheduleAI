"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import {
  authApi,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
} from "@/services/auth.api";
import type { User } from "@/types";
import { clearSessionHint, hasSessionHint } from "@/lib/session";

export const authKeys = {
  me: ["auth", "me"] as const,
};

/**
 * The signed-in user.
 *
 * The probe is SKIPPED entirely when the server says there is no session
 * (the readable `scheduleai_hint` cookie is absent) — anonymous visitors
 * never fire a request, so the console stays free of 401 noise.
 */
export function useMe() {
  const enabled = hasSessionHint();
  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: async () => (await authApi.me()).user,
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  return {
    ...query,
    /** No session (the probe wasn't even made). */
    isLoggedOut: !enabled,
    /** The probe is in flight — only possible when a session may exist. */
    isCheckingSession: enabled && query.isPending,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: async () => {
      // The server set the session cookie + the readable hint; the query is
      // now enabled and refetches the fresh user.
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast.success("Signed in.");
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: async () => {
      // No redirect here — the register screen switches to its "check your
      // email" state (which owns the hand-off to the login screen once the
      // address is verified).
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast.success("Account created — check your email to verify it.");
    },
  });
}

/**
 * Consumes the token from the mailed verification link. The page renders its
 * own success/error states, so this hook only redirects on success (to the
 * login screen, with the address pre-filled).
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (token: string) => authApi.verifyEmail({ token }),
    onSuccess: async (data) => {
      try {
        window.sessionStorage.setItem("scheduleai:registeredEmail", data.user.email);
      } catch {
        // Storage unavailable — the login form just starts empty.
      }
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast.success("Email verified — sign in to continue.");
      router.push("/login");
    },
  });
}

/** Deliberately toast-free: the caller renders its own sent/error state. */
export function useResendVerification() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.resendVerification(input),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Drop the local hint too, so the app stops probing for a session.
      clearSessionHint();
      queryClient.clear();
      toast.success("Signed out.");
      router.push("/login");
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => authApi.updateMe(input),
    onSuccess: async (data) => {
      queryClient.setQueryData<User>(authKeys.me, data.user);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't update your profile."));
    },
  });
}

/** Deliberately toast-free: the forgot-password screen renders its own state. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => authApi.forgotPassword(input),
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input),
    onSuccess: () => {
      toast.success("Password updated. You can sign in now.");
      router.push("/login");
    },
  });
}

/** Errors (including the 401 "wrong current password") stay at the call site. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input),
  });
}