/** Accès aux projets et macros stockés en base. */
import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { newId } from '$lib/model/ids';
import { migrateProject } from '$lib/model/project';
import type { Fragment } from '$lib/model/fragments';
import type { Project } from '$lib/model/types';
import type { LockInfo, Macro } from '$lib/api/types';
import { getDb } from './db';
import { macros, projects, users, type MacroRow } from './db/schema';
import { acquireLock, toLockInfo } from './locks';

export interface ProjectSummary {
	id: string;
	name: string;
	affaireNumber: string;
	createdAt: string;
	updatedAt: string;
	updatedByName: string | null;
	lock: LockInfo | null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
	const db = await getDb();
	const editor = alias(users, 'editor');
	const locker = alias(users, 'locker');
	const rows = await db
		.select({
			id: projects.id,
			name: projects.name,
			affaireNumber: projects.affaireNumber,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
			updatedByName: editor.name,
			lockedBy: projects.lockedBy,
			lockedAt: projects.lockedAt,
			lockerName: locker.name
		})
		.from(projects)
		.leftJoin(editor, eq(editor.id, projects.updatedBy))
		.leftJoin(locker, eq(locker.id, projects.lockedBy))
		.orderBy(desc(projects.updatedAt));
	const now = Date.now();
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		affaireNumber: r.affaireNumber,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
		updatedByName: r.updatedByName,
		lock: toLockInfo({ lockedBy: r.lockedBy, lockedAt: r.lockedAt, userName: r.lockerName }, now)
	}));
}

export async function getProject(
	id: string
): Promise<{ id: string; data: Project; updatedAt: string } | null> {
	const db = await getDb();
	const [row] = await db
		.select({ id: projects.id, data: projects.data, updatedAt: projects.updatedAt })
		.from(projects)
		.where(eq(projects.id, id));
	if (!row) return null;
	return { id: row.id, data: migrateProject(JSON.parse(row.data)), updatedAt: row.updatedAt };
}

/** Insère un nouveau projet ; renvoie son id. */
export async function insertProject(data: Project, userId: string): Promise<string> {
	const db = await getDb();
	const id = newId('p');
	const now = new Date().toISOString();
	const doc = migrateProject(data);
	await db.insert(projects).values({
		id,
		name: doc.meta.name,
		affaireNumber: doc.meta.affaireNumber,
		data: JSON.stringify(doc),
		createdAt: now,
		updatedAt: now,
		updatedBy: userId
	});
	return id;
}

export type SaveResult =
	| { status: 'ok'; updatedAt: string }
	| { status: 'not-found' }
	| { status: 'locked'; lock: LockInfo | null };

/**
 * Enregistre le document. Exige le verrou : il est pris (ou rafraîchi) atomiquement
 * s'il est libre ou déjà détenu par l'utilisateur, sinon 'locked'.
 */
export async function saveProjectData(
	id: string,
	raw: unknown,
	userId: string
): Promise<SaveResult> {
	const lock = await acquireLock(id, userId);
	if (!lock) return { status: 'not-found' };
	if (!lock.owned) return { status: 'locked', lock: lock.lock };
	const doc = migrateProject(raw);
	const updatedAt = new Date().toISOString();
	const db = await getDb();
	await db
		.update(projects)
		.set({
			data: JSON.stringify(doc),
			name: doc.meta.name,
			affaireNumber: doc.meta.affaireNumber,
			updatedAt,
			updatedBy: userId
		})
		.where(eq(projects.id, id));
	return { status: 'ok', updatedAt };
}

/** Renomme (colonne + meta du document). */
export async function renameProject(id: string, name: string, userId: string): Promise<boolean> {
	const current = await getProject(id);
	if (!current) return false;
	current.data.meta.name = name;
	current.data.meta.modifiedAt = new Date().toISOString();
	const db = await getDb();
	await db
		.update(projects)
		.set({
			name,
			data: JSON.stringify(current.data),
			updatedAt: current.data.meta.modifiedAt,
			updatedBy: userId
		})
		.where(eq(projects.id, id));
	return true;
}

export async function duplicateProject(id: string, userId: string): Promise<string | null> {
	const current = await getProject(id);
	if (!current) return null;
	const now = new Date().toISOString();
	const data = structuredClone(current.data);
	data.meta.name = `${data.meta.name} (copie)`;
	data.meta.createdAt = now;
	data.meta.modifiedAt = now;
	return insertProject(data, userId);
}

export async function deleteProject(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(projects).where(eq(projects.id, id));
}

// --- Macros ---------------------------------------------------------------------

function toMacro(r: MacroRow): Macro {
	return {
		id: r.id,
		name: r.name,
		category: r.category,
		data: JSON.parse(r.data) as Fragment,
		createdBy: r.createdBy,
		createdAt: r.createdAt
	};
}

export async function listMacros(): Promise<Macro[]> {
	const db = await getDb();
	const rows = await db.select().from(macros).orderBy(macros.category, macros.name);
	return rows.map(toMacro);
}

export async function insertMacro(
	input: { name: string; category: string; data: Fragment },
	userId: string
): Promise<Macro> {
	const db = await getDb();
	const row: MacroRow = {
		id: newId('m'),
		name: input.name,
		category: input.category,
		data: JSON.stringify(input.data),
		createdBy: userId,
		createdAt: new Date().toISOString()
	};
	await db.insert(macros).values(row);
	return toMacro(row);
}

export async function deleteMacro(id: string): Promise<boolean> {
	const db = await getDb();
	const res = await db.delete(macros).where(eq(macros.id, id));
	return res.rowsAffected > 0;
}
