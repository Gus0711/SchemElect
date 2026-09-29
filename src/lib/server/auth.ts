/**
 * Authentification maison : mots de passe Argon2id, sessions en base.
 * Le cookie `session` contient un jeton aléatoire (32 octets, base64url) ; la base ne
 * stocke que son SHA-256 (hex). Expiration glissante de 30 jours.
 */
import { createHash, randomBytes } from 'node:crypto';
import { hash, verify, type Algorithm } from '@node-rs/argon2';
import type { Cookies } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getDb } from './db';
import { sessions, users } from './db/schema';

export const SESSION_COOKIE = 'session';
const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY_MS;
/** On ne prolonge la session en base qu'une fois par jour au plus. */
const SESSION_RENEW_AFTER_MS = DAY_MS;

export type SessionUser = App.SessionUser;

// --- Mots de passe --------------------------------------------------------------

/** Algorithm.Argon2id (= 2) : const enum inutilisable en valeur avec isolatedModules. */
const ARGON2ID = 2 as Algorithm;
const ARGON2_OPTS = {
	algorithm: ARGON2ID,
	memoryCost: 19456,
	timeCost: 2,
	parallelism: 1,
	outputLen: 32
};

export function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}

export const MIN_PASSWORD_LENGTH = 6;

// --- Jetons de session ----------------------------------------------------------

export function generateSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** Règle pure : faut-il repousser l'expiration (glissante) ? */
export function shouldRenewSession(expiresAt: number, now = Date.now()): boolean {
	return expiresAt - now < SESSION_TTL_MS - SESSION_RENEW_AFTER_MS;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
	const db = await getDb();
	const token = generateSessionToken();
	const expiresAt = Date.now() + SESSION_TTL_MS;
	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
	return { token, expiresAt: new Date(expiresAt) };
}

/** Résout un jeton en utilisateur ; prolonge la session si nécessaire. */
export async function validateSessionToken(
	token: string
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
	const db = await getDb();
	const id = hashToken(token);
	const [row] = await db
		.select({
			expiresAt: sessions.expiresAt,
			id: users.id,
			login: users.login,
			name: users.name,
			role: users.role
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id));
	if (!row) return null;
	const now = Date.now();
	if (row.expiresAt <= now) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return null;
	}
	let expiresAt = row.expiresAt;
	let renewed = false;
	if (shouldRenewSession(expiresAt, now)) {
		expiresAt = now + SESSION_TTL_MS;
		renewed = true;
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}
	return {
		user: { id: row.id, login: row.login, name: row.name, role: row.role },
		expiresAt: new Date(expiresAt),
		renewed
	};
}

export async function invalidateSession(token: string): Promise<void> {
	const db = await getDb();
	await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
	const db = await getDb();
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

// --- Cookie ---------------------------------------------------------------------

/**
 * Cookie `secure` quand l'application est servie en HTTPS (déduit de ORIGIN / de la requête).
 * `COOKIE_SECURE=true|false` force le comportement. En HTTP simple (serveur interne sans
 * TLS), un cookie `secure` ne serait jamais renvoyé par le navigateur.
 */
export function isCookieSecure(url: URL): boolean {
	const forced = env.COOKIE_SECURE?.toLowerCase();
	if (forced === 'true') return true;
	if (forced === 'false') return false;
	return url.protocol === 'https:';
}

export function setSessionCookie(cookies: Cookies, url: URL, token: string, expiresAt: Date): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isCookieSecure(url),
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies, url: URL): void {
	cookies.delete(SESSION_COOKIE, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isCookieSecure(url)
	});
}

// --- Utilisateurs ---------------------------------------------------------------

let knownHasUsers = false;

/** Vrai dès qu'un compte existe (mis en cache une fois vrai). */
export async function hasUsers(): Promise<boolean> {
	if (knownHasUsers) return true;
	const db = await getDb();
	const [{ n }] = await db.select({ n: count() }).from(users);
	knownHasUsers = n > 0;
	return knownHasUsers;
}

export function normalizeLogin(login: string): string {
	return login.trim().toLowerCase();
}

/** Vérifie login + mot de passe ; renvoie l'utilisateur ou null. */
export async function authenticate(login: string, password: string): Promise<SessionUser | null> {
	const db = await getDb();
	const [u] = await db
		.select()
		.from(users)
		.where(eq(users.login, normalizeLogin(login)));
	if (!u) {
		// Temps constant approximatif pour ne pas révéler l'existence du compte.
		await hashPassword(password);
		return null;
	}
	if (!(await verifyPassword(u.passwordHash, password))) return null;
	return { id: u.id, login: u.login, name: u.name, role: u.role };
}
