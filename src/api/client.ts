import type {
  Language,
  LeaderboardData,
  Mode,
  ProfileData,
  SessionResult,
  User,
  AchievementSpec,
} from './types';

const TOKEN_KEY = 'pth.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(status: number, payload: any) {
    super(payload?.error ?? `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const api = {
  register: (email: string, password: string, nickname?: string) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  social: (provider: string, email: string, nickname?: string) =>
    request<{ token: string; user: User }>('/api/auth/social', {
      method: 'POST',
      body: JSON.stringify({ provider, email, nickname }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  text: (mode: Mode, language: Language, opts: { level?: number; count?: number; variant?: string; chars?: string } = {}) => {
    const p = new URLSearchParams({ mode, language });
    if (opts.level) p.set('level', String(opts.level));
    if (opts.count) p.set('count', String(opts.count));
    if (opts.variant) p.set('variant', opts.variant);
    if (opts.chars) p.set('chars', opts.chars);
    return request<{ mode: Mode; language: Language; text: string; variant?: string }>(`/api/train/text?${p}`);
  },

  saveSession: (payload: Record<string, unknown>) =>
    request<SessionResult>('/api/train/session', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  profile: () => request<ProfileData>('/api/profile'),

  drill: (chars: string, language: Language) =>
    request<{ text: string }>(`/api/profile/drill?chars=${encodeURIComponent(chars)}&language=${language}`),

  leaderboard: (sort: string, period: string) =>
    request<LeaderboardData>(`/api/leaderboard?sort=${sort}&period=${period}`),

  achievements: () => request<{ achievements: AchievementSpec[] }>('/api/achievements'),
};
