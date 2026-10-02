/** Accès aux projets et macros stockés en base. */
import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { newId } from '$lib/model/ids';
import { migrateProject } from '$lib/model/project';
import type { Fragment } from '$lib/model/fragments';
import type { Project } from '$lib/model/types';
import type { LockInfo, Macro } from '$lib/api/types';
import { getDb } from './db';
import { affaires, clients, macros, projects, users, type MacroRow } from './db/schema';
import { resolveAffaire } from './affaires';
import { acquireLock, toLockInfo } from './locks';
import { addedRevisions, duplicateDocument, type DuplicateOptions } from '$lib/model/versions';
import { deleteVersionsOf, getVersion, maybeAutoVersion, recordVersion } from './versions';

export interface ProjectSummary {
	id: string;
	name: string;
	affaireNumber: string;
	/** Affaire de rattachement (null = non classé). */
	affaire: { id: string; whysoft: string; number: string; label: string; client: string } | null;
	createdAt: string;
	updatedAt: string;
	updatedByName: string | null;
	lock: LockInfo | null;
}

export async function listProjects(organizationId: string): Promise<ProjectSummary[]> {
	const db = await getDb();
	const editor = alias(users, 'editor');
	const locker = alias(users, 'locker');
	const rows = await db
		.select({
			id: projects.id,
			name: projects.name,
			affaireNumber: projects.affaireNumber,
			affaireId: affaires.id,
			whysoft: affaires.whysoft,
			affaireNo: affaires.number,
			affaireLabel: affaires.label,
			clientName: clients.name,
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
		.leftJoin(affaires, eq(affaires.id, projects.affaireId))
		.leftJoin(clients, eq(clients.id, affaires.clientId))
		.where(eq(projects.organizationId, organizationId))
		.orderBy(desc(projects.updatedAt));
	const now = Date.now();
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		affaireNumber: r.affaireNo || r.affaireNumber,
		affaire: r.affaireId
			? {
					id: r.affaireId,
					whysoft: r.whysoft ?? '',
					number: r.affaireNo ?? '',
					label: r.affaireLabel ?? '',
					client: r.clientName ?? ''
				}
			: null,
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
		.select({
			id: projects.id,
			data: projects.data,
			updatedAt: projects.updatedAt,
			org: projects.organizationId
		})
		.from(projects)
		.where(eq(projects.id, id));
	if (!row) return null;
	const data = migrateProject(JSON.parse(row.data));
	// Cartouche à jour de l'affaire (client renommé, n° WhySoft corrigé depuis).
	await resolveAffaire(data, row.org);
	return { id: row.id, data, updatedAt: row.updatedAt };
}

/** Société propriétaire d'un dossier (null s'il n'existe pas). */
export async function projectOrganization(id: string): Promise<string | null> {
	const db = await getDb();
	const [row] = await db
		.select({ org: projects.organizationId })
		.from(projects)
		.where(eq(projects.id, id));
	return row?.org ?? null;
}

/** Insère un nouveau projet (avec sa 1re version) dans la société ; renvoie son id. */
export async function insertProject(
	data: Project,
	userId: string,
	organizationId: string,
	versionLabel = 'Création'
): Promise<string> {
	const db = await getDb();
	const id = newId('p');
	const now = new Date().toISOString();
	const doc = migrateProject(data);
	const affaireId = await resolveAffaire(doc, organizationId);
	await db.insert(projects).values({
		id,
		organizationId,
		name: doc.meta.name,
		affaireNumber: doc.meta.affaireNumber,
		affaireId,
		data: JSON.stringify(doc),
		createdAt: now,
		updatedAt: now,
		updatedBy: userId
	});
	await recordVersion(id, doc, userId, 'auto', versionLabel);
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
	const [previous] = await db
		.select({ data: projects.data, org: projects.organizationId })
		.from(projects)
		.where(eq(projects.id, id));
	const affaireId = previous ? await resolveAffaire(doc, previous.org) : null;
	await db
		.update(projects)
		.set({
			data: JSON.stringify(doc),
			name: doc.meta.name,
			affaireNumber: doc.meta.affaireNumber,
			affaireId,
			updatedAt,
			updatedBy: userId
		})
		.where(eq(projects.id, id));
	await versionAfterSave(id, previous ? JSON.parse(previous.data) : null, doc, userId);
	return { status: 'ok', updatedAt };
}

/**
 * Historique : version nommée à chaque nouvel indice de révision, sinon version
 * automatique si la précédente a plus de 15 min.
 */
async function versionAfterSave(id: string, before: Project | null, doc: Project, userId: string) {
	const added = addedRevisions(before, doc);
	if (added.length) {
		const r = added[added.length - 1];
		const label = `Indice ${r.indice.trim()}${r.description.trim() ? ` — ${r.description.trim()}` : ''}`;
		await recordVersion(id, doc, userId, 'named', label);
		return;
	}
	await maybeAutoVersion(id, doc, userId);
}

/** À la fermeture du dossier (libération du verrou) : version si le contenu a changé. */
export async function versionOnClose(id: string, userId: string): Promise<void> {
	const current = await getProject(id);
	if (current)
		await maybeAutoVersion(id, current.data, userId, 'Fermeture du dossier', new Date(), 0);
}

const versionDate = (iso: string) =>
	new Intl.DateTimeFormat('fr-FR', {
		dateStyle: 'short',
		timeStyle: 'short',
		timeZone: 'Europe/Paris'
	}).format(new Date(iso));

export type RestoreResult =
	{ status: 'ok' } | { status: 'not-found' } | { status: 'locked'; lock: LockInfo | null };

/**
 * Remet le dossier dans l'état d'une version. L'état actuel est d'abord enregistré comme
 * version nommée (« Avant restauration… ») : la restauration s'annule en restaurant
 * celle-ci. Exige le verrou d'édition.
 */
export async function restoreVersion(
	id: string,
	versionId: string,
	userId: string
): Promise<RestoreResult> {
	const lock = await acquireLock(id, userId);
	if (!lock) return { status: 'not-found' };
	if (!lock.owned) return { status: 'locked', lock: lock.lock };
	const [current, version] = await Promise.all([getProject(id), getVersion(id, versionId)]);
	if (!current || !version) return { status: 'not-found' };
	const when = versionDate(version.info.createdAt);
	await recordVersion(
		id,
		current.data,
		userId,
		'named',
		`Avant restauration de la version du ${when}`
	);
	const doc = version.data;
	const updatedAt = new Date().toISOString();
	doc.meta.modifiedAt = updatedAt;
	// Le classement n'est pas un état du schéma : la restauration garde l'affaire actuelle.
	if (current.data.meta.affaireId) doc.meta.affaireId = current.data.meta.affaireId;
	else delete doc.meta.affaireId;
	const affaireId = await resolveAffaire(doc, (await projectOrganization(id)) ?? '');
	const db = await getDb();
	await db
		.update(projects)
		.set({
			data: JSON.stringify(doc),
			name: doc.meta.name,
			affaireNumber: doc.meta.affaireNumber,
			affaireId,
			updatedAt,
			updatedBy: userId
		})
		.where(eq(projects.id, id));
	await recordVersion(
		id,
		doc,
		userId,
		'auto',
		`Restauration de la version du ${when}${version.info.label ? ` (${version.info.label})` : ''}`
	);
	return { status: 'ok' };
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

/**
 * Duplique un dossier (état actuel, ou une version de son historique) pour une nouvelle
 * affaire. L'historique ne suit pas : la copie démarre le sien.
 */
export async function duplicateProject(
	id: string,
	userId: string,
	organizationId: string,
	opts: Partial<DuplicateOptions> = {},
	versionId?: string
): Promise<string | null> {
	const version = versionId ? await getVersion(id, versionId) : null;
	if (versionId && !version) return null;
	const source = version?.data ?? (await getProject(id))?.data;
	if (!source) return null;
	const doc = duplicateDocument(source, { name: '', ...opts });
	const from = version ? ` (version du ${versionDate(version.info.createdAt)})` : '';
	return insertProject(doc, userId, organizationId, `Copie de « ${source.meta.name} »${from}`);
}

export async function deleteProject(id: string): Promise<void> {
	await deleteVersionsOf(id);
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

export async function listMacros(organizationId: string): Promise<Macro[]> {
	const db = await getDb();
	const rows = await db
		.select()
		.from(macros)
		.where(eq(macros.organizationId, organizationId))
		.orderBy(macros.category, macros.name);
	return rows.map(toMacro);
}

export async function insertMacro(
	input: { name: string; category: string; data: Fragment },
	userId: string,
	organizationId: string
): Promise<Macro> {
	const db = await getDb();
	const row: MacroRow = {
		id: newId('m'),
		organizationId,
		name: input.name,
		category: input.category,
		data: JSON.stringify(input.data),
		createdBy: userId,
		createdAt: new Date().toISOString()
	};
	await db.insert(macros).values(row);
	return toMacro(row);
}

export async function deleteMacro(id: string, organizationId: string): Promise<boolean> {
	const db = await getDb();
	const res = await db
		.delete(macros)
		.where(and(eq(macros.id, id), eq(macros.organizationId, organizationId)));
	return res.rowsAffected > 0;
}
