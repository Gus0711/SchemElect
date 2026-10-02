/** Gestion des comptes d'une société (création, rôle, mot de passe, suppression). */
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { canManageUser, type Role } from '$lib/model/access';
import { newId } from '$lib/model/ids';
import { getDb } from './db';
import { users } from './db/schema';
import { MIN_PASSWORD_LENGTH, hashPassword, invalidateUserSessions, normalizeLogin } from './auth';

export type { Role } from '$lib/model/access';

export interface UserSummary {
	id: string;
	login: string;
	name: string;
	role: Role;
	createdAt: string;
}

export async function listUsers(organizationId: string): Promise<UserSummary[]> {
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
		.where(eq(users.organizationId, organizationId))
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
	organizationId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	const invalid = validateUserInput(input);
	if (invalid) return { ok: false, error: invalid };
	const db = await getDb();
	const login = normalizeLogin(input.login);
	// Identifiant unique sur toute la plateforme (connexion sans choix de société).
	const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.login, login));
	if (existing) return { ok: false, error: `L'identifiant « ${login} » existe déjà` };
	const id = newId('u');
	await db.insert(users).values({
		id,
		login,
		name: input.name.trim(),
		passwordHash: await hashPassword(input.password),
		role: input.role,
		organizationId: input.organizationId,
		createdAt: new Date().toISOString()
	});
	return { ok: true, id };
}

/** Compte de la société, que l'acteur a le droit de gérer ; sinon message d'erreur. */
async function managedTarget(
	actor: App.SessionUser,
	userId: string
): Promise<{ role: Role } | string> {
	const db = await getDb();
	const [target] = await db
		.select({ role: users.role })
		.from(users)
		.where(and(eq(users.id, userId), eq(users.organizationId, actor.organizationId)));
	if (!target) return 'Utilisateur introuvable';
	if (!canManageUser(actor.role, target.role)) return 'Vous ne pouvez pas modifier ce compte';
	return target;
}

/** Nombre d'administrateurs (administrateurs et super-administrateurs) de la société. */
async function adminCount(organizationId: string): Promise<number> {
	const db = await getDb();
	const [{ n }] = await db
		.select({ n: count() })
		.from(users)
		.where(
			and(eq(users.organizationId, organizationId), inArray(users.role, ['admin', 'superadmin']))
		);
	return n;
}

export async function resetPassword(
	actor: App.SessionUser,
	userId: string,
	password: string
): Promise<string | null> {
	if (password.length < MIN_PASSWORD_LENGTH)
		return `Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum`;
	const target = await managedTarget(actor, userId);
	if (typeof target === 'string') return target;
	const db = await getDb();
	await db
		.update(users)
		.set({ passwordHash: await hashPassword(password) })
		.where(eq(users.id, userId));
	await invalidateUserSessions(userId);
	return null;
}

export async function setUserRole(
	actor: App.SessionUser,
	userId: string,
	role: Role
): Promise<string | null> {
	if (userId === actor.id) return 'Impossible de changer son propre rôle';
	if (!canManageUser(actor.role, role)) return 'Vous ne pouvez pas attribuer ce rôle';
	const target = await managedTarget(actor, userId);
	if (typeof target === 'string') return target;
	const wasAdmin = target.role === 'admin' || target.role === 'superadmin';
	if (
		wasAdmin &&
		role !== 'admin' &&
		role !== 'superadmin' &&
		(await adminCount(actor.organizationId)) <= 1
	)
		return 'Impossible de retirer le dernier administrateur de la société';
	const db = await getDb();
	await db.update(users).set({ role }).where(eq(users.id, userId));
	await invalidateUserSessions(userId);
	return null;
}

export async function deleteUser(actor: App.SessionUser, userId: string): Promise<string | null> {
	if (userId === actor.id) return 'Impossible de supprimer son propre compte';
	const target = await managedTarget(actor, userId);
	if (typeof target === 'string') return target;
	if (
		(target.role === 'admin' || target.role === 'superadmin') &&
		(await adminCount(actor.organizationId)) <= 1
	)
		return 'Impossible de supprimer le dernier administrateur de la société';
	const db = await getDb();
	await invalidateUserSessions(userId);
	await db.delete(users).where(eq(users.id, userId));
	return null;
}
