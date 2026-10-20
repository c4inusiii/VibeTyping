import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.mjs';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT.keylen, SCRYPT).toString('hex');
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createToken(userId, provider = 'email') {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_tokens (token, user_id, provider) VALUES (?, ?, ?)').run(token, userId, provider);
  return token;
}

export function userFromToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id
        WHERE t.token = ?`,
    )
    .get(token);
  return row ?? null;
}

export function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

/** Уровень рассчитывается по накопленному XP (порог растёт квадратично). */
export function levelFromXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

export function xpToNextLevel(xp) {
  const lvl = levelFromXp(xp);
  const cur = Math.pow(lvl - 1, 2) * 100;
  const next = Math.pow(lvl, 2) * 100;
  return { level: lvl, current: xp - cur, needed: next - cur, nextLevel: lvl + 1 };
}
