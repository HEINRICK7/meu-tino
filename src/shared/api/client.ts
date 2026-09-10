import type {
  ActivityItem,
  ActivityPage,
  ApiErrorPayload,
  MeResponse,
  PushConfig,
} from "./types";

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);

type PushConfigPayload = {
  enabled: boolean;
  vapid_public_key?: string | null;
  vapidPublicKey?: string | null;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.ok)
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);

  let payload: ApiErrorPayload = {};
  try {
    const candidate: unknown = await response.json();
    if (candidate && typeof candidate === "object") {
      payload = candidate as ApiErrorPayload;
    }
  } catch {
    /* Preserve the HTTP status for non-JSON errors. */
  }
  throw new ApiError(
    response.status,
    payload.code || "UNKNOWN",
    payload.message || "Não foi possível concluir a operação.",
    payload.correlationId,
  );
}

export function createIdempotencyKey() {
  return crypto.randomUUID();
}

type ActivationOptions = { idempotencyKey?: string };

export const api = {
  getMe: () =>
    request<MeResponse>("/v1/me", {
      cache: "no-store",
    }),
  activate: (token: string, options: ActivationOptions = {}) =>
    request<{ status: string }>("/v1/customer-channel/activation", {
      method: "POST",
      headers: {
        "Idempotency-Key": options.idempotencyKey ?? createIdempotencyKey(),
      },
      body: JSON.stringify({ token }),
    }),
  listActivity: (options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
    if (options.cursor) params.set("cursor", options.cursor);
    return request<ActivityPage>(`/v1/me/activity?${params.toString()}`, {
      cache: "no-store",
    });
  },
  getActivity: (activityId: string) =>
    request<ActivityItem>(`/v1/me/activity/${encodeURIComponent(activityId)}`, {
      cache: "no-store",
    }),
  logout: () => request<void>("/v1/me/logout", { method: "POST" }),
  getPushConfig: async (): Promise<PushConfig> => {
    const payload = await request<PushConfigPayload>("/v1/me/push-config", {
      cache: "no-store",
    });
    return {
      enabled: payload.enabled,
      vapidPublicKey:
        payload.vapidPublicKey ?? payload.vapid_public_key ?? null,
    };
  },
  registerPushSubscription: (subscription: PushSubscriptionJSON) =>
    request<{ id: string; status: string }>("/v1/me/push-subscriptions", {
      method: "POST",
      headers: { "Idempotency-Key": createIdempotencyKey() },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    }),
  removePushSubscription: (endpoint: string) =>
    request<void>("/v1/me/push-subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    }),
};

export function getApiBaseUrl() {
  return baseUrl;
}
