"use client";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "reputation.token";
const USER_KEY  = "reputation.user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail =
      (body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : res.statusText) || "Request failed";
    throw new ApiError(res.status, body, detail);
  }
  return body as T;
}

// ----- Types mirroring the backend schemas -----

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string;
  is_admin: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  domain: string | null;
  category: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  aliases: string[] | null;
  created_at: string;
  run_schedule: "none" | "weekly" | "monthly" | null;
  alert_email: string | null;
}

export async function patchBrand(
  id: string,
  data: { run_schedule?: string; alert_email?: string }
): Promise<Brand> {
  return apiFetch<Brand>(`/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export interface Competitor {
  id: string;
  brand_id: string;
  name: string;
  domain: string | null;
  aliases: string[] | null;
}

export interface Prompt {
  id: string;
  brand_id: string;
  text: string;
  language: string | null;
  intent: string | null;
  importance: number;
  enabled: boolean;
  use_web_search: boolean;
  created_at: string;
}

export interface Mention {
  entity_name: string;
  is_target_brand: boolean;
  is_known_competitor: boolean;
  rank_position: number | null;
  sentiment: string | null;
  mention_type: string | null;
  context_excerpt: string | null;
}

export interface Citation {
  url: string | null;
  domain: string | null;
  title: string | null;
  citation_type: string | null;
  refers_to_target: boolean;
}

export interface PromptRun {
  id: string;
  prompt_id: string;
  brand_id: string;
  provider: string;
  model: string;
  status: "pending" | "running" | "done" | "failed";
  raw_response: string | null;
  analysis: Record<string, unknown> | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error: string | null;
  executed_at: string | null;
  created_at: string;
  mentions: Mention[];
  citations: Citation[];
  prompt?: Prompt;
}

export interface Alert {
  id: string;
  kind: "failed" | "absent" | "negative" | "new_citation";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  created_at: string;
}

export interface Scores {
  period_days: number;
  runs_count: number;
  visibility_score: number;
  share_of_voice: number;
  sentiment_score: number;
  citation_score: number;
  top_competitors: { name: string; mentions: number }[];
}

export interface ProviderStatus {
  name: string;
  enabled: boolean;
  default_model: string;
}

export interface BillingSubscription {
  plan: string;
  plan_label: string;
  effective_plan: string;
  effective_plan_label: string;
  is_trial: boolean;
  trial_days_remaining: number | null;
  stripe_enabled: boolean;
  has_active_subscription: boolean;
  limits: {
    max_brands: number;
    pdf_export: boolean;
    recommendations: boolean;
    scheduled_runs: boolean;
    auto_generate_prompts: boolean;
    max_runs_per_week: number;
  };
  quota?: {
    runs_this_week: number;
    runs_remaining: number | null;  // null = illimité
    can_run: boolean;
    block_reason: string | null;
  };
}

// ----- Editorial content types -----

export interface ArticleListItem {
  id: string;
  organization_id: string;
  brand_id: string | null;
  status: "idea" | "drafting" | "draft" | "review" | "approved" | "published" | "failed";
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleReview {
  quality_score: number;
  seo_score: number;
  factual_risk: "low" | "medium" | "high";
  duplicate_risk: "low" | "medium" | "high";
  needs_human_review: boolean;
  review_notes: string;
  suggested_edits: string[];
}

export interface ArticleLinkedIn {
  post: string;
  short_variant: string;
  hook: string;
  hashtags: string[];
  cta: string;
}

export interface Article extends ArticleListItem {
  content_markdown: string | null;
  seo_title: string | null;
  seo_description: string | null;
  brief: Record<string, unknown> | null;
  review: ArticleReview | null;
  linkedin_variants: ArticleLinkedIn | null;
  linkedin_post_url: string | null;
  error: string | null;
}

export interface BlogPost {
  title: string;
  slug: string;
  excerpt: string;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface BlogPostFull extends BlogPost {
  content_markdown: string;
}
