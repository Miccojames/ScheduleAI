"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { authApi, type LoginInput, type RegisterInput, type UpdateProfileInput } from "@/services/auth.api";
import type { User } from "@/types";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => (await authApi.me()).user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast.success("Signed in.");
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast.success("Welcome to ScheduleAI!");
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
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