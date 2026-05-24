import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, lt, sql as drizzleSql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from './db';
import { users, sessions, type User } from './db/schema';

const SESSION_COOKIE = 'riptag_session';
const SESSION_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: string): Promise<string> {
  const id = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function getCurrentUser(): Promise<User | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db.execute<{
    id: string;
    email: string;
    password_hash: string;
    role: 'owner' | 'supplier';
    display_name: string | null;
    created_at: Date;
    expires_at: Date;
  }>(drizzleSql`
    select u.id, u.email, u.password_hash, u.role::text as role, u.display_name, u.created_at, s.expires_at
    from sessions s join users u on u.id = s.user_id
    where s.id = ${token} and s.expires_at > now()
    limit 1
  `);
  const row = rows.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireOwner(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'owner') redirect('/dashboard');
  return u;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  const user = rows[0];
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

export async function cleanupExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
