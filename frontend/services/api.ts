import type { ApiEnvelope } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/** Error thrown for every non-2xx response, carrying the backend message. */
export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/** The single react-query instance, registered by <Providers>. */
let queryClientRef: { clear: () => void } | null = null;

export function registerQueryClient(client: { clear: () => void }): void {
  queryClientRef = client;
}

function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  queryClientRef?.clear();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.replace("/login");
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Send a FormData body untouched (file uploads). */
  formData?: FormData;
  /** Skip the global 401 redirect (used by the login/register screens). */
  skipAuthRedirect?: boolean;
}

/**
 * Single entry point for talking to the backend.
 * Always sends the httpOnly auth cookie and unwraps the `{ success, data }`
 * envelope so callers work with plain data.
 */
export async function api<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, formData, headers, skipAuthRedirect, ...rest } = options;

  const requestHeaders = new Headers(headers);
  let payload: BodyInit | undefined;

  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: "include",
    headers: requestHeaders,
    body: payload,
  });

  if (response.status === 204) return undefined as T;

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (response.status === 401 && !skipAuthRedirect) {
    handleUnauthorized();
  }

  if (!response.ok || !envelope || envelope.success === false) {
    const message =
      envelope?.message ||
      (response.status === 401
        ? "Your session has expired. Please sign in again."
        : "Something went wrong. Please try again.");
    throw new ApiError(response.status, message, envelope?.errors);
  }

  return envelope.data;
}

/** Best-effort human readable message for any thrown value. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}