/**
 * Verrou d'édition par projet : un seul utilisateur édite, les autres ouvrent en lecture
 * seule. Le verrou expire après LOCK_TTL_MS sans rafraîchissement (heartbeat client
 * toutes les 30 s). Stocké dans `projects.locked_by` / `projects.locked_at` (ISO).
 */
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type { LockInfo } from '$lib/api/types';
import { getDb } from './db';
import { projects, users } from './db/schema';

export const LOCK_TTL_MS = 2 * 60 * 1000;
export const LOCK_HEARTBEAT_MS = 30 * 1000;

// --- Règles pures ---------------------------------------------------------------

export interface LockState {
	lockedBy: string | null;
	lockedAt: string | null;
}

/** Le verrou est-il encore valide à l'instant `now` ? */
export function isLockActive(state: LockState, now = Date.now()): boolean {
	if (!state.lockedBy || !state.lockedAt) return false;
	const at = Date.parse(state.lockedAt);
	if (Number.isNaN(at)) return false;
	return now - at < LOCK_TTL_MS;
}

/** L'utilisateur peut-il prendre (ou rafraîchir) le verrou ? */
export function canAcquireLock(state: LockState, userId: string, now = Date.now()): boolean {
	return !isLockActive(state, now) || state.lockedBy === userId;
}

/** Date ISO en deçà de laquelle un verrou est expiré. */
export function lockCutoff(now = Date.now()): string {
	return new Date(now - LOCK_TTL_MS).toISOString();
}

// --- Accès base -----------------------------------------------------------------

/** Verrou actif d'un projet (null si libre ou expiré). `undefined` si le projet n'existe pas. */
export async function getLock(
	projectId: string,
	now = Date.now()
): Promise<LockInfo | null | undefined> {
	const db = await getDb();
	const [row] = await db
		.select({ lockedBy: projects.lockedBy, lockedAt: projects.lockedAt, userName: users.name })
		.from(projects)
		.leftJoin(users, eq(users.id, projects.lockedBy))
		.where(eq(projects.id, projectId));
	if (!row) return undefined;
	return toLockInfo(row, now);
}

export function toLockInfo(
	row: LockState & { userName: string | null },
	now = Date.now()
): LockInfo | null {
	if (!isLockActive(row, now)) return null;
	return { userId: row.lockedBy!, userName: row.userName ?? '?', at: row.lockedAt! };
}

/**
 * Acquiert ou rafraîchit le verrou (mise à jour atomique conditionnelle).
 * Renvoie `undefined` si le projet n'existe pas.
 */
export async function acquireLock(
	projectId: string,
	userId: string,
	now = Date.now()
): Promise<{ owned: boolean; lock: LockInfo | null } | undefined> {
	const db = await getDb();
	await db
		.update(projects)
		.set({ lockedBy: userId, lockedAt: new Date(now).toISOString() })
		.where(
			and(
				eq(projects.id, projectId),
				or(
					isNull(projects.lockedBy),
					isNull(projects.lockedAt),
					eq(projects.lockedBy, userId),
					lt(projects.lockedAt, lockCutoff(now))
				)
			)
		);
	const lock = await getLock(projectId, now);
	if (lock === undefined) return undefined;
	return { owned: lock?.userId === userId, lock };
}

/** Libère le verrou s'il appartient à l'utilisateur. */
export async function releaseLock(projectId: string, userId: string): Promise<void> {
	const db = await getDb();
	await db
		.update(projects)
		.set({ lockedBy: null, lockedAt: null })
		.where(and(eq(projects.id, projectId), eq(projects.lockedBy, userId)));
}
