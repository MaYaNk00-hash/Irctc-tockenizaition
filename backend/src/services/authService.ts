import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { pool, isDbLive } from '../db';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const JWT_ISSUER = 'tatkal-booking-api';
const JWT_AUDIENCE = 'tatkal-web';
const TOKEN_TTL = '8h';

export type AuthUser = { id: number; displayName: string; loginIdentifier: string; role?: 'USER' | 'ADMIN' };
export type AuthSession = AuthUser & { token: string; expiresInSeconds: number };

function secret() {
  return process.env.JWT_SECRET || 'tatkal-fair-booking-secure-jwt-secret-key-2026-production';
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

function issueSession(user: AuthUser | InMemUser): AuthSession {
  const role = user.role || 'USER';
  const token = jwt.sign(
    { sub: String(user.id), name: user.displayName, login: user.loginIdentifier, role },
    secret(),
    { algorithm: 'HS256', expiresIn: TOKEN_TTL, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  );
  return {
    id: user.id,
    displayName: user.displayName,
    loginIdentifier: user.loginIdentifier,
    role,
    token,
    expiresInSeconds: 8 * 60 * 60
  };
}

// In-Memory User Fallback Store
interface InMemUser {
  id: number;
  displayName: string;
  loginIdentifier: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN';
}

const memoryUsers: Map<string, InMemUser> = new Map();
let userIdCounter = 1001;

// Pre-seed demo users
(async () => {
  const demoHash = await hashPassword('password123');
  const adminHash = await hashPassword('adminpassword123');
  memoryUsers.set('demo@codex.dev', { id: 1001, displayName: 'Mayank Kumar (Demo)', loginIdentifier: 'demo@codex.dev', passwordHash: demoHash, role: 'USER' });
  memoryUsers.set('9876543210', { id: 1002, displayName: 'Mayank Kumar', loginIdentifier: '9876543210', passwordHash: demoHash, role: 'USER' });
  memoryUsers.set('admin@codex.dev', { id: 9999, displayName: 'IRCTC System Administrator', loginIdentifier: 'admin@codex.dev', passwordHash: adminHash, role: 'ADMIN' });
})();

export class AuthService {
  static async signUp(displayNameInput: string, loginIdentifierInput: string, password: string) {
    const displayName = displayNameInput.trim();
    const loginIdentifier = normalizeIdentifier(loginIdentifierInput);
    if (!displayName || displayName.length > 120) throw new Error('Display name must be between 1 and 120 characters.');
    if (!isValidIdentifier(loginIdentifier)) throw new Error('Use a valid email address or 10-digit mobile number.');
    if (password.length < 6 || password.length > 256) throw new Error('Password must be between 6 and 256 characters.');

    const passwordHash = await hashPassword(password);

    if (isDbLive().pg) {
      try {
        const result = await pool.query<{ id: string; display_name: string; login_identifier: string }>(
          'INSERT INTO app_users (display_name, login_identifier, password_hash) VALUES ($1, $2, $3) RETURNING id, display_name, login_identifier',
          [displayName, loginIdentifier, passwordHash],
        );
        const row = result.rows[0];
        return issueSession({ id: Number(row.id), displayName: row.display_name, loginIdentifier: row.login_identifier, role: 'USER' });
      } catch (error: any) {
        if (error?.code === '23505') throw new Error('An account with this email address or mobile number already exists.');
        throw error;
      }
    }

    // In-memory fallback
    if (memoryUsers.has(loginIdentifier)) {
      throw new Error('An account with this email address or mobile number already exists.');
    }
    const user: InMemUser = {
      id: ++userIdCounter,
      displayName,
      loginIdentifier,
      passwordHash,
      role: 'USER'
    };
    memoryUsers.set(loginIdentifier, user);
    return issueSession(user);
  }

  static async login(loginIdentifierInput: string, password: string) {
    const loginIdentifier = normalizeIdentifier(loginIdentifierInput);

    if (isDbLive().pg) {
      try {
        const result = await pool.query<{ id: string; display_name: string; login_identifier: string; password_hash: string }>(
          'SELECT id, display_name, login_identifier, password_hash FROM app_users WHERE login_identifier = $1 LIMIT 1',
          [loginIdentifier],
        );
        const row = result.rows[0];
        if (row && (await verifyPassword(password, row.password_hash))) {
          return issueSession({ id: Number(row.id), displayName: row.display_name, loginIdentifier: row.login_identifier, role: 'USER' });
        }
      } catch {
        // Fallback to memory
      }
    }

    // In-memory fallback
    const memUser = memoryUsers.get(loginIdentifier);
    if (!memUser || !(await verifyPassword(password, memUser.passwordHash))) {
      throw new Error('Invalid login credentials. Use demo@codex.dev / password123 or sign up.');
    }
    return issueSession(memUser);
  }

  static verifyToken(token: string): AuthUser {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (typeof payload === 'string' || !payload.sub || !payload.name || !payload.login) throw new Error('Invalid session token.');
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id)) throw new Error('Invalid session token.');
    return { id, displayName: String(payload.name), loginIdentifier: String(payload.login), role: (payload as any).role || 'USER' };
  }
}
