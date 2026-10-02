/**
 * Historique des versions des dossiers (stockage). Règles : `model/versions.ts`.
 * Une version = copie complète du document, compressée (gzip + base64).
 */
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { newId } from '$lib/model/ids';
import { migrateProject } from '$lib/model/project';
import type { Project } from '$lib/model/types';
import {
	shouldAutoVersion,
	versionContent,
	versionsToPrune,
	versionSummary,
	type VersionInfo,
	type VersionKind
} from '$lib/model/versions';
import { getDb } from './db';
import { projects, projectVersions, users } from './db/schema';

export const packDocument = (doc: Project) =>
	gzipSync(Buffer.from(JSON.stringify(doc), 'utf8')).toString('base64');

export const unpackDocument = (data: string): Project =>
	migrateProject(JSON.parse(gunzipSync(Buffer.from(data, 'base64')).toString('utf8')));

export const contentHash = (doc: Project) =>
	createHash('sha256').update(versionContent(doc)).digest('hex');

/** Dernière version du dossier (date et empreinte). */
async function lastVersion(projectId: string) {
	const db = await getDb();
	const [row] = await db
		.select({ createdAt: projectVersions.createdAt, hash: projectVersions.hash })
		.from(projectVersions)
		.where(eq(projectVersions.projectId, projectId))
		.orderBy(desc(projectVersions.createdAt))
		.limit(1);
	return row;
}

/** Enregistre une version (puis applique la règle de conservation). */
export async function recordVersion(
	projectId: string,
	doc: Project,
	userId: string | null,
	kind: VersionKind,
	label = '',
	now = new Date()
): Promise<string> {
	const db = await getDb();
	const id = newId('v');
	await db.insert(projectVersions).values({
		id,
		projectId,
		createdAt: now.toISOString(),
		createdBy: userId,
		kind,
		label: label.slice(0, 200),
		summary: JSON.stringify(versionSummary(doc)),
		hash: contentHash(doc),
		data: packDocument(doc)
	});
	await pruneVersions(projectId, now.getTime());
	return id;
}

/** Version automatique si la dernière date de plus de 15 min et que le contenu a changé. */
export async function maybeAutoVersion(
	projectId: string,
	doc: Project,
	userId: string,
	label = '',
	now = new Date(),
	interval?: number
): Promise<boolean> {
	const last = await lastVersion(projectId);
	if (!shouldAutoVersion(last, contentHash(doc), now.getTime(), interval)) return false;
	await recordVersion(projectId, doc, userId, 'auto', label, now);
	return true;
}

export async function pruneVersions(projectId: string, now = Date.now()): Promise<void> {
	const db = await getDb();
	const rows = await db
		.select({
			id: projectVersions.id,
			kind: projectVersions.kind,
			createdAt: projectVersions.createdAt
		})
		.from(projectVersions)
		.where(eq(projectVersions.projectId, projectId));
	const ids = versionsToPrune(rows, now);
	if (ids.length) await db.delete(projectVersions).where(inArray(projectVersions.id, ids));
}

export async function listVersions(projectId: string): Promise<VersionInfo[]> {
	const db = await getDb();
	const rows = await db
		.select({
			id: projectVersions.id,
			createdAt: projectVersions.createdAt,
			createdBy: projectVersions.createdBy,
			createdByName: users.name,
			kind: projectVersions.kind,
			label: projectVersions.label,
			summary: projectVersions.summary
		})
		.from(projectVersions)
		.leftJoin(users, eq(users.id, projectVersions.createdBy))
		.where(eq(projectVersions.projectId, projectId))
		.orderBy(desc(projectVersions.createdAt));
	return rows.map((r) => ({ ...r, summary: JSON.parse(r.summary) }));
}

export async function getVersion(
	projectId: string,
	versionId: string
): Promise<{ info: VersionInfo; data: Project } | null> {
	const db = await getDb();
	const [row] = await db
		.select({
			id: projectVersions.id,
			createdAt: projectVersions.createdAt,
			createdBy: projectVersions.createdBy,
			createdByName: users.name,
			kind: projectVersions.kind,
			label: projectVersions.label,
			summary: projectVersions.summary,
			data: projectVersions.data
		})
		.from(projectVersions)
		.leftJoin(users, eq(users.id, projectVersions.createdBy))
		.where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.id, versionId)));
	if (!row) return null;
	const { data, summary, ...info } = row;
	return { info: { ...info, summary: JSON.parse(summary) }, data: unpackDocument(data) };
}

/** Utilisateurs intervenus sur le dossier (auteurs de versions, dernier modificateur). */
export async function projectContributors(projectId: string): Promise<Set<string>> {
	const db = await getDb();
	const rows = await db
		.selectDistinct({ id: projectVersions.createdBy })
		.from(projectVersions)
		.where(eq(projectVersions.projectId, projectId));
	const [p] = await db
		.select({ updatedBy: projects.updatedBy })
		.from(projects)
		.where(eq(projects.id, projectId));
	const out = new Set(rows.map((r) => r.id).filter((x): x is string => !!x));
	if (p?.updatedBy) out.add(p.updatedBy);
	return out;
}

export async function deleteVersionsOf(projectId: string): Promise<void> {
	const db = await getDb();
	await db.delete(projectVersions).where(eq(projectVersions.projectId, projectId));
}
