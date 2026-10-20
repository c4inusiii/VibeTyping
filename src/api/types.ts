export type Mode = 'words' | 'sentences' | 'code' | 'symbols' | 'drill';
export type Language = 'ru' | 'en';

export interface LevelInfo {
  level: number;
  current: number;
  needed: number;
  nextLevel: number;
  xp: number;
}

export interface User {
  id: number;
  email: string;
  nickname: string;
  avatar: string;
  xp: number;
  level: number;
  created_at: string;
  levelInfo: LevelInfo;
  streak: number;
}

export interface AchievementSpec {
  achievement_id: string;
  title: string;
  description: string;
  category: string;
  metric: string;
  metric_target: number;
  reward_xp: number;
  icon_asset: string;
  icon_tone: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface ErrorLogEntry {
  expected: string;
  pressed: string;
  delayMs: number;
}

export interface SessionResult {
  xpEarned: number;
  bonusFromAchievements: number;
  totalXp: number;
  level: number;
  levelInfo: LevelInfo;
  streak: number;
  unlockedAchievements: AchievementSpec[];
  user: User;
}

export interface ProfileSummary {
  totalSessions: number;
  totalChars: number;
  totalErrors: number;
  totalXp: number;
  avgWpm: number;
  bestWpm: number;
  accuracy: number;
  avgAccuracy: number;
  streak: number;
}

export interface DayStat {
  day: string;
  sessions: number;
  best_wpm: number;
  xp: number;
}

export interface ModeStat {
  mode: string;
  sessions: number;
  avg_wpm: number;
  best_wpm: number;
}

export interface KeyErrorStat {
  key_char: string;
  count: number;
}

export interface Recommendation {
  id: string;
  chars: string[];
  count: number;
  text: string;
  drillChars: string;
}

export interface RecentSession {
  id: number;
  mode: string;
  language: string;
  duration_s: number;
  wpm: number;
  raw_wpm: number;
  cpm: number;
  accuracy: number;
  chars: number;
  errors: number;
  max_combo: number;
  xp_earned: number;
  finished_at: string;
}

export interface ProfileData {
  user: User;
  summary: ProfileSummary;
  byDay: DayStat[];
  byMode: ModeStat[];
  keyErrors: KeyErrorStat[];
  recent: RecentSession[];
  achievements: AchievementSpec[];
  recommendations: Recommendation[];
}

export interface LeaderRow {
  id: number;
  nickname: string;
  avatar: string;
  xp: number;
  bestWpm: number;
  avgWpm: number;
  accuracy: number;
  totalXp: number;
  sessions: number;
  value: number;
  rank: number;
  isMe: boolean;
}

export interface LeaderboardData {
  sort: 'wpm' | 'accuracy' | 'xp';
  period: 'today' | 'week' | 'all';
  rows: LeaderRow[];
  me: LeaderRow | null;
}
