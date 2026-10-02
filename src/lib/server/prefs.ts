/** Préférences par utilisateur (clé → valeur JSON), limitées à des clés connues. */
import { and, eq } from 'drizzle-orm';
import { FAVORITES_PREF, normalizeFavorites } from '$lib/editor/favorites';
import { getDb } from './db';
import { userPrefs } from './db/schema';

/** Clés autorisées et validation de la valeur (null = refusée). */
export const PREFS: Record<string, (raw: unknown) => unknown | null> = {
	[FAVORITES_PREF]: normalizeFavorites
};

export function validatePref(key: string, raw: unknown): unknown | null {
	const check = PREFS[key];
	return check ? check(raw) : null;
}

export async function getPref(userId: string, key: string): Promise<unknown | null> {
	const db = await getDb();
	const [row] = await db
		.select({ value: userPrefs.value })
		.from(userPrefs)
		.where(and(eq(userPrefs.userId, userId), eq(userPrefs.key, key)));
	return row ? JSON.parse(row.value) : null;
}

export async function setPref(userId: string, key: string, value: unknown): Promise<void> {
	const db = await getDb();
	const now = new Date().toISOString();
	const json = JSON.stringify(value);
	await db
		.insert(userPrefs)
		.values({ userId, key, value: json, updatedAt: now })
		.onConflictDoUpdate({
			target: [userPrefs.userId, userPrefs.key],
			set: { value: json, updatedAt: now }
		});
}
