/**
 * Clients et affaires d'une société (classement des dossiers). Toutes les fonctions sont
 * cloisonnées par société. Les fiches venues de l'ERP (`source = 'erp'`) ne se modifient
 * pas ici (connecteur, plus tard).
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
	applyAffaire,
	detachAffaire,
	nameKey,
	planClassification,
	type Affaire,
	type Client
} from '$lib/model/affaires';
import { newId } from '$lib/model/ids';
import type { Project } from '$lib/model/types';
import { getDb } from './db';
import { affaires, clients, projects } from './db/schema';
import { getLock } from './locks';

export interface ClientRow extends Client {
	affaires: number;
}

export interface AffaireRow extends Affaire {
	clientName: string;
	/** Nombre de schémas rattachés. */
	projects: number;
	createdAt: string;
}

type ClientRecord = typeof clients.$inferSelect;
type AffaireRecord = typeof affaires.$inferSelect;

const toClient = (r: ClientRecord): Client => ({
	id: r.id,
	name: r.name,
	code: r.code,
	city: r.city,
	source: r.source
});

const toAffaire = (r: AffaireRecord): Affaire => ({
	id: r.id,
	clientId: r.clientId,
	whysoft: r.whysoft,
	number: r.number,
	label: r.label,
	year: r.year,
	status: r.status,
	source: r.source
});

export async function listClients(organizationId: string): Promise<ClientRow[]> {
	const db = await getDb();
	const rows = await db
		.select({
			client: clients,
			affaires: sql<number>`(SELECT COUNT(*) FROM affaires a WHERE a.client_id = ${clients.id})`
		})
		.from(clients)
		.where(eq(clients.organizationId, organizationId))
		.orderBy(asc(clients.nameKey));
	return rows.map((r) => ({ ...toClient(r.client), affaires: Number(r.affaires) }));
}

export async function listAffaires(organizationId: string): Promise<AffaireRow[]> {
	const db = await getDb();
	const rows = await db
		.select({
			affaire: affaires,
			clientName: clients.name,
			projects: sql<number>`(SELECT COUNT(*) FROM projects p WHERE p.affaire_id = ${affaires.id})`
		})
		.from(affaires)
		.innerJoin(clients, eq(clients.id, affaires.clientId))
		.where(eq(affaires.organizationId, organizationId))
		.orderBy(asc(clients.nameKey), asc(affaires.year), asc(affaires.whysoft));
	return rows.map((r) => ({
		...toAffaire(r.affaire),
		clientName: r.clientName,
		projects: Number(r.projects),
		createdAt: r.affaire.createdAt
	}));
}

/** Affaire et son client (null si absente ou d'une autre société). */
export async function getAffaire(
	organizationId: string,
	id: string
): Promise<{ affaire: Affaire; client: Client } | null> {
	const db = await getDb();
	const [row] = await db
		.select({ affaire: affaires, client: clients })
		.from(affaires)
		.innerJoin(clients, eq(clients.id, affaires.clientId))
		.where(and(eq(affaires.id, id), eq(affaires.organizationId, organizationId)));
	return row ? { affaire: toAffaire(row.affaire), client: toClient(row.client) } : null;
}

export type SaveResult<T> =
	| { status: 'ok'; item: T }
	| { status: 'not-found' }
	| { status: 'conflict'; error: string }
	| { status: 'readonly'; error: string };

const ERP_READONLY = 'Fiche reprise de l’ERP : elle se modifie dans l’ERP.';

/** Client de ce nom (accents et casse ignorés), créé s'il n'existe pas. */
export async function findOrCreateClient(organizationId: string, name: string): Promise<string> {
	const db = await getDb();
	const [same] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.organizationId, organizationId), eq(clients.nameKey, nameKey(name))));
	if (same) return same.id;
	const res = await saveClient(organizationId, { name: name.trim(), code: '', city: '' });
	if (res.status !== 'ok') throw new Error('Création du client impossible');
	return res.item.id;
}

/** Crée (`id` absent) ou modifie un client ; un seul client par nom dans la société. */
export async function saveClient(
	organizationId: string,
	input: Omit<Client, 'id' | 'source'>,
	id?: string
): Promise<SaveResult<Client>> {
	const db = await getDb();
	const key = nameKey(input.name);
	const [same] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.organizationId, organizationId), eq(clients.nameKey, key)));
	if (same && same.id !== id)
		return { status: 'conflict', error: `Le client « ${input.name} » existe déjà.` };
	const now = new Date().toISOString();
	if (id) {
		const [current] = await db
			.select()
			.from(clients)
			.where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
		if (!current) return { status: 'not-found' };
		if (current.source === 'erp') return { status: 'readonly', error: ERP_READONLY };
		await db
			.update(clients)
			.set({ ...input, nameKey: key, updatedAt: now })
			.where(eq(clients.id, id));
		// Le nom du client est repris dans le cartouche des schémas rattachés.
		return { status: 'ok', item: { ...input, id, source: current.source } };
	}
	const row = {
		id: newId('cli'),
		organizationId,
		...input,
		nameKey: key,
		source: 'manual' as const,
		createdAt: now,
		updatedAt: now
	};
	await db.insert(clients).values(row);
	return { status: 'ok', item: toClient(row as ClientRecord) };
}

/** Supprime un client sans affaire. */
export async function deleteClient(
	organizationId: string,
	id: string
): Promise<'ok' | 'not-found' | 'used' | 'readonly'> {
	const db = await getDb();
	const [current] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
	if (!current) return 'not-found';
	if (current.source === 'erp') return 'readonly';
	const [used] = await db
		.select({ id: affaires.id })
		.from(affaires)
		.where(eq(affaires.clientId, id));
	if (used) return 'used';
	await db.delete(clients).where(eq(clients.id, id));
	return 'ok';
}

/** Crée ou modifie une affaire ; n° WhySoft unique dans la société (s'il est renseigné). */
export async function saveAffaire(
	organizationId: string,
	input: Omit<Affaire, 'id' | 'source'>,
	id?: string
): Promise<SaveResult<Affaire>> {
	const db = await getDb();
	const [client] = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, input.clientId), eq(clients.organizationId, organizationId)));
	if (!client) return { status: 'conflict', error: 'Client introuvable.' };
	if (input.whysoft) {
		const same = await db
			.select({ id: affaires.id })
			.from(affaires)
			.where(and(eq(affaires.organizationId, organizationId), eq(affaires.whysoft, input.whysoft)));
		if (same.some((a) => a.id !== id))
			return {
				status: 'conflict',
				error: `Le n° WhySoft ${input.whysoft} est déjà celui d’une autre affaire.`
			};
	}
	const now = new Date().toISOString();
	if (id) {
		const [current] = await db
			.select()
			.from(affaires)
			.where(and(eq(affaires.id, id), eq(affaires.organizationId, organizationId)));
		if (!current) return { status: 'not-found' };
		// Affaire de l'ERP : seul le statut se change ici.
		const values =
			current.source === 'erp' ? { status: input.status } : { ...input, updatedAt: now };
		await db.update(affaires).set(values).where(eq(affaires.id, id));
		return { status: 'ok', item: { ...toAffaire(current), ...values, id } };
	}
	const row = {
		id: newId('aff'),
		organizationId,
		...input,
		source: 'manual' as const,
		createdAt: now,
		updatedAt: now
	};
	await db.insert(affaires).values(row);
	return { status: 'ok', item: toAffaire(row as AffaireRecord) };
}

/** Supprime une affaire sans schéma rattaché. */
export async function deleteAffaire(
	organizationId: string,
	id: string
): Promise<'ok' | 'not-found' | 'used' | 'readonly'> {
	const db = await getDb();
	const [current] = await db
		.select()
		.from(affaires)
		.where(and(eq(affaires.id, id), eq(affaires.organizationId, organizationId)));
	if (!current) return 'not-found';
	if (current.source === 'erp') return 'readonly';
	const [used] = await db
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.affaireId, id));
	if (used) return 'used';
	await db.delete(affaires).where(eq(affaires.id, id));
	return 'ok';
}

/**
 * Rattachement d'un document à son affaire (`meta.affaireId`) : le cartouche reprend le
 * client et le n° WhySoft ; une affaire inconnue ou d'une autre société est détachée.
 * Renvoie l'id d'affaire à écrire dans `projects.affaire_id`.
 */
export async function resolveAffaire(doc: Project, organizationId: string): Promise<string | null> {
	const id = doc.meta.affaireId;
	if (!id) {
		detachAffaire(doc.meta);
		return null;
	}
	const found = await getAffaire(organizationId, id);
	if (!found) {
		detachAffaire(doc.meta);
		return null;
	}
	applyAffaire(doc.meta, found.affaire, found.client);
	return id;
}

/**
 * Reprise de l'existant : classe les dossiers non rattachés d'après le client et le n°
 * d'affaire de leur cartouche (voir `planClassification`). Les dossiers ouverts en édition
 * sont laissés de côté (leur prochain enregistrement effacerait le rattachement).
 */
export async function classifyExisting(
	organizationId: string
): Promise<{ classified: number; clients: number; affaires: number; skipped: number }> {
	const db = await getDb();
	const rows = await db
		.select({ id: projects.id, data: projects.data, createdAt: projects.createdAt })
		.from(projects)
		.where(and(eq(projects.organizationId, organizationId), isNull(projects.affaireId)));
	const docs = new Map<string, Project>();
	let busy = 0;
	for (const r of rows) {
		if (await getLock(r.id)) {
			busy++;
			continue;
		}
		try {
			docs.set(r.id, JSON.parse(r.data) as Project);
		} catch {
			busy++;
		}
	}
	const legacy = [...docs].map(([id, d]) => ({
		id,
		client: String(d.meta?.client ?? ''),
		affaireNumber: String(d.meta?.affaireNumber ?? ''),
		whysoft: String(d.meta?.whysoft ?? ''),
		createdAt: rows.find((r) => r.id === id)?.createdAt ?? ''
	}));
	const existingClients = await listClients(organizationId);
	const existingAffaires = await listAffaires(organizationId);
	const plan = planClassification(legacy, existingClients, existingAffaires);

	const ids = new Map<string, string>();
	const now = new Date().toISOString();
	for (const c of plan.clients) {
		const id = newId('cli');
		ids.set(c.key, id);
		await db.insert(clients).values({
			id,
			organizationId,
			name: c.name,
			nameKey: nameKey(c.name),
			createdAt: now,
			updatedAt: now
		});
	}
	const usedWhysoft = new Set(existingAffaires.map((a) => a.whysoft).filter(Boolean));
	for (const a of plan.affaires) {
		const id = newId('aff');
		ids.set(a.key, id);
		// N° WhySoft déjà pris : l'affaire est créée sans (à corriger à la main).
		const whysoft = a.whysoft && !usedWhysoft.has(a.whysoft) ? a.whysoft : '';
		if (whysoft) usedWhysoft.add(whysoft);
		await db.insert(affaires).values({
			id,
			organizationId,
			clientId: ids.get(a.client) ?? a.client,
			whysoft,
			number: a.number,
			label: '',
			year: a.year,
			createdAt: now,
			updatedAt: now
		});
	}
	for (const { projectId, affaire } of plan.assign) {
		const affaireId = ids.get(affaire) ?? affaire;
		const doc = docs.get(projectId);
		if (!doc) continue;
		doc.meta.affaireId = affaireId;
		await resolveAffaire(doc, organizationId);
		await db
			.update(projects)
			.set({ affaireId, data: JSON.stringify(doc) })
			.where(eq(projects.id, projectId));
	}
	return {
		classified: plan.assign.length,
		clients: plan.clients.length,
		affaires: plan.affaires.length,
		skipped: plan.skipped.length + busy
	};
}
