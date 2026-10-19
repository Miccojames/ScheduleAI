import { api } from "@/services/api";
import type { User } from "@/types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

export const authApi = {
  register(input: RegisterInput) {
    return api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  login(input: LoginInput) {
    return api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  logout() {
    return api<Record<string, never>>("/api/auth/logout", { method: "POST" });
  },

  me() {
    return api<{ user: User }>("/api/auth/me");
  },

  updateMe(input: UpdateProfileInput) {
    return api<{ user: User }>("/api/auth/me", { method: "PUT", body: input });
  },
};