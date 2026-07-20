const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (typeof body.message === "string") message = body.message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    const retryAfterHeader = res.headers.get("Retry-After");
    throw new ApiError(res.status, message, retryAfterHeader ? Number(retryAfterHeader) : undefined);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function login(payload: LoginPayload) {
  return apiFetch<{ email: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export interface ProductListItem {
  id: number;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  isSponsored: boolean;
}

export interface ProductListResponse {
  items: ProductListItem[];
  nextCursor: string | null;
}

export interface GetProductsParams {
  cursor?: string | null;
  limit?: number;
  category?: string;
  q?: string;
}

export function getProducts(params: GetProductsParams): Promise<ProductListResponse> {
  const search = new URLSearchParams();
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.category) search.set("category", params.category);
  if (params.q) search.set("q", params.q);

  return apiFetch<ProductListResponse>(`/products?${search.toString()}`);
}
