import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { pool, isDbLive } from '../db';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const JWT_ISSUER = 'tatkal-booking-api';
const JWT_AUDIENCE = 'tatkal-web';
const TOKEN_TTL = '30m';

export type AuthUser = { id: number; displayName: string; loginIdentifier: string };
export type AuthSession = AuthUser & { token: string; expiresInSeconds: number };

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || (process.env.NODE_ENV === 'production' && value === 'local-development-secret-change-before-production-2026')) {
    throw new Error('JWT_SECRET must be a unique value of at least 32 characters.');
  }
  return value;
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function isValidIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^\d{10}$/.test(value);
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function issueSession(user: AuthUser): AuthSession {
  const token = jwt.sign(
    { sub: String(user.id), name: user.displayName, login: user.loginIdentifier },
    secret(),
    { algorithm: 'HS256', expiresIn: TOKEN_TTL, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  );
  return { ...user, token, expiresInSeconds: 30 * 60 };
}

function requireDatabase() {
  if (!isDbLive().pg) throw new Error('Authentication storage is unavailable. Configure DATABASE_URL and run PostgreSQL.');
}

export class AuthService {
  static async signUp(displayNameInput: string, loginIdentifierInput: string, password: string) {
    requireDatabase();
    const displayName = displayNameInput.trim();
    const loginIdentifier = normalizeIdentifier(loginIdentifierInput);
    if (!displayName || displayName.length > 120) throw new Error('Display name must be between 1 and 120 characters.');
    if (!isValidIdentifier(loginIdentifier)) throw new Error('Use a valid email address or 10-digit mobile number.');
    if (password.length < 10 || password.length > 256) throw new Error('Password must be between 10 and 256 characters.');

    const passwordHash = await hashPassword(password);
    try {
      const result = await pool.query<{ id: string; display_name: string; login_identifier: string }>(
        'INSERT INTO app_users (display_name, login_identifier, password_hash) VALUES ($1, $2, $3) RETURNING id, display_name, login_identifier',
        [displayName, loginIdentifier, passwordHash],
      );
      const row = result.rows[0];
      return issueSession({ id: Number(row.id), displayName: row.display_name, loginIdentifier: row.login_identifier });
    } catch (error: any) {
      if (error?.code === '23505') throw new Error('An account with this email address or mobile number already exists.');
      throw error;
    }
  }

  static async login(loginIdentifierInput: string, password: string) {
    requireDatabase();
    const loginIdentifier = normalizeIdentifier(loginIdentifierInput);
    const result = await pool.query<{ id: string; display_name: string; login_identifier: string; password_hash: string }>(
      'SELECT id, display_name, login_identifier, password_hash FROM app_users WHERE login_identifier = $1 LIMIT 1',
      [loginIdentifier],
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) throw new Error('Invalid login credentials.');
    return issueSession({ id: Number(row.id), displayName: row.display_name, loginIdentifier: row.login_identifier });
  }

  static verifyToken(token: string): AuthUser {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (typeof payload === 'string' || !payload.sub || !payload.name || !payload.login) throw new Error('Invalid session token.');
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id)) throw new Error('Invalid session token.');
    return { id, displayName: String(payload.name), loginIdentifier: String(payload.login) };
  }
}
