/** Gestion des comptes (création, réinitialisation, suppression). */
import { asc, count, eq } from 'drizzle-orm';
import { newId } from '$lib/model/ids';
import { getDb } from './db';
import { users } from './db/schema';
import { MIN_PASSWORD_LENGTH, hashPassword, invalidateUserSessions, normalizeLogin } from './auth';

export type Role = 'admin' | 'user';

export interface UserSummary {
	id: string;
	login: string;
	name: string;
	role: Role;
	createdAt: string;
}

export async function listUsers(): Promise<UserSummary[]> {
	const db = await getDb();
	return db
		.select({
			id: users.id,
			login: users.login,
			name: users.name,
			role: users.role,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(asc(users.name));
}

/** Valide les champs ; renvoie un message d'erreur ou null. */
export function validateUserInput(input: {
	login: string;
	name: string;
	password: string;
}): string | null {
	if (!/^[a-z0-9._-]{2,40}$/.test(normalizeLogin(input.login)))
		return 'Identifiant : 2 à 40 caractères (lettres, chiffres, . _ -)';
	if (!input.name.trim()) return 'Le nom est requis';
	if (input.password.length < MIN_PASSWORD_LENGTH)
		return `Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum`;
	return null;
}

export async function createUser(input: {
	login: string;
	name: string;
	password: string;
	role: Role;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	const invalid = validateUserInput(input);
	if (invalid) return { ok: false, error: invalid };
	const db = await getDb();
	const login = normalizeLogin(input.login);
	const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.login, login));
	if (existing) return { ok: false, error: `L'identifiant « ${login} » existe déjà` };
	const id = newId('u');
	await db.insert(users).values({
		id,
		login,
		name: input.name.trim(),
		passwordHash: await hashPassword(input.password),
		role: input.role,
		createdAt: new Date().toISOString()
	});
	return { ok: true, id };
}

export async function resetPassword(userId: string, password: string): Promise<string | null> {
	if (password.length < MIN_PASSWORD_LENGTH)
		return `Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum`;
	const db = await getDb();
	await db
		.update(users)
		.set({ passwordHash: await hashPassword(password) })
		.where(eq(users.id, userId));
	await invalidateUserSessions(userId);
	return null;
}

export async function deleteUser(userId: string, currentUserId: string): Promise<string | null> {
	if (userId === currentUserId) return 'Impossible de supprimer son propre compte';
	const db = await getDb();
	const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
	if (!target) return 'Utilisateur introuvable';
	if (target.role === 'admin') {
		const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, 'admin'));
		if (n <= 1) return 'Impossible de supprimer le dernier administrateur';
	}
	await invalidateUserSessions(userId);
	await db.delete(users).where(eq(users.id, userId));
	return null;
}
