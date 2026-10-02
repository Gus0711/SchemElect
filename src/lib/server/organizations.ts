/** Sociétés : liste, création (avec son premier administrateur), renommage, accès. */
import { asc, count, eq } from 'drizzle-orm';
import { effectiveOrganization } from '$lib/model/access';
import { newId } from '$lib/model/ids';
import { getDb } from './db';
import { organizations, projects, users } from './db/schema';
import { createUser } from './users';

/** Cookie de la société choisie par le super-administrateur. */
export const ORG_COOKIE = 'org';

export interface OrganizationSummary {
	id: string;
	name: string;
	createdAt: string;
	users: number;
	projects: number;
}

export async function listOrganizations(): Promise<OrganizationSummary[]> {
	const db = await getDb();
	const orgs = await db.select().from(organizations).orderBy(asc(organizations.name));
	const userCounts = await db
		.select({ id: users.organizationId, n: count() })
		.from(users)
		.groupBy(users.organizationId);
	const projectCounts = await db
		.select({ id: projects.organizationId, n: count() })
		.from(projects)
		.groupBy(projects.organizationId);
	const u = new Map(userCounts.map((r) => [r.id, r.n]));
	const p = new Map(projectCounts.map((r) => [r.id, r.n]));
	return orgs.map((o) => ({ ...o, users: u.get(o.id) ?? 0, projects: p.get(o.id) ?? 0 }));
}

export async function getOrganization(id: string): Promise<{ id: string; name: string } | null> {
	const db = await getDb();
	const [row] = await db
		.select({ id: organizations.id, name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, id));
	return row ?? null;
}

/** Société active de la session (bascule du super-administrateur par cookie). */
export async function resolveOrganization(
	user: App.SessionUser,
	requested: string | undefined
): Promise<{ id: string; name: string }> {
	const target =
		requested && requested !== user.homeOrganizationId ? await getOrganization(requested) : null;
	const id = effectiveOrganization(
		{ role: user.role, organizationId: user.homeOrganizationId },
		requested,
		(x) => x === target?.id
	);
	return (await getOrganization(id)) ?? { id, name: '' };
}

export async function insertOrganization(name: string, id = newId('org')): Promise<string> {
	const db = await getDb();
	await db
		.insert(organizations)
		.values({ id, name: name.trim(), createdAt: new Date().toISOString() })
		.onConflictDoNothing();
	return id;
}

/** Nouvelle société avec son premier administrateur. */
export async function createOrganization(input: {
	name: string;
	admin: { login: string; name: string; password: string };
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
	const name = input.name.trim();
	if (!name) return { ok: false, error: 'Le nom de la société est requis' };
	const id = newId('org');
	// Le compte est vérifié avant de créer la société (identifiant déjà pris…).
	const db = await getDb();
	await db.insert(organizations).values({ id, name, createdAt: new Date().toISOString() });
	const res = await createUser({ ...input.admin, role: 'admin', organizationId: id });
	if (!res.ok) {
		await db.delete(organizations).where(eq(organizations.id, id));
		return res;
	}
	return { ok: true, id };
}

export async function renameOrganization(id: string, name: string): Promise<string | null> {
	if (!name.trim()) return 'Le nom de la société est requis';
	const db = await getDb();
	await db.update(organizations).set({ name: name.trim() }).where(eq(organizations.id, id));
	return null;
}
