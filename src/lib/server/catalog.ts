/** Catalogue matériel partagé : une fiche par référence (unicité sur `referenceKey`). */
import { asc, eq } from 'drizzle-orm';
import { normalizeCatalogItem, referenceKey, type CatalogItem } from '$lib/model/catalog';
import { newId } from '$lib/model/ids';
import { getDb } from './db';
import { catalog } from './db/schema';

/** Nombre maximal de fiches par import. */
export const MAX_IMPORT = 5000;

export function validateCatalogItem(raw: unknown): CatalogItem | null {
	return normalizeCatalogItem(raw);
}

/**
 * Ligne à écrire pour une fiche reçue, d'après les lignes existantes de même id et de
 * même référence :
 * - `insert` : nouvelle fiche ;
 * - `update` (id de la ligne existante) : même fiche, ou même référence (import) ;
 * - `conflict` : la fiche `id` prendrait la référence d'une autre fiche.
 */
export function resolveUpsert(
	itemId: string,
	byId: { id: string } | undefined,
	byKey: { id: string } | undefined
): { action: 'insert' } | { action: 'update'; id: string } | { action: 'conflict' } {
	if (byKey && byKey.id !== itemId && byId) return { action: 'conflict' };
	if (byKey) return { action: 'update', id: byKey.id };
	if (byId) return { action: 'update', id: byId.id };
	return { action: 'insert' };
}

function fromRow(row: { id: string; data: string; updatedAt: string }): CatalogItem | null {
	try {
		return normalizeCatalogItem({ ...JSON.parse(row.data), id: row.id, updatedAt: row.updatedAt });
	} catch {
		return null;
	}
}

export async function listCatalog(): Promise<CatalogItem[]> {
	const db = await getDb();
	const rows = await db.select().from(catalog).orderBy(asc(catalog.reference));
	return rows.map(fromRow).filter((t): t is CatalogItem => !!t);
}

export type UpsertResult =
	{ status: 'created' | 'updated'; item: CatalogItem } | { status: 'conflict' };

/** Crée ou met à jour une fiche (même référence = même fiche). */
export async function upsertCatalogItem(item: CatalogItem, userId: string): Promise<UpsertResult> {
	const db = await getDb();
	const key = referenceKey(item.reference);
	const [byId] = item.id ? await db.select().from(catalog).where(eq(catalog.id, item.id)) : [];
	const [byKey] = await db.select().from(catalog).where(eq(catalog.refKey, key));
	const plan = resolveUpsert(item.id, byId, byKey);
	if (plan.action === 'conflict') return { status: 'conflict' };
	const now = new Date().toISOString();
	const id = plan.action === 'update' ? plan.id : item.id || newId('cat');
	const saved: CatalogItem = { ...item, id, updatedAt: now };
	const data = JSON.stringify({ ...saved, updatedAt: undefined });
	const values = { refKey: key, reference: item.reference, manufacturer: item.manufacturer, data };
	if (plan.action === 'update') {
		await db
			.update(catalog)
			.set({ ...values, updatedAt: now })
			.where(eq(catalog.id, id));
		return { status: 'updated', item: saved };
	}
	await db
		.insert(catalog)
		.values({ id, ...values, createdBy: userId, createdAt: now, updatedAt: now });
	return { status: 'created', item: saved };
}

/** Import en masse : chaque fiche est créée, ou met à jour la fiche de même référence. */
export async function importCatalog(
	items: CatalogItem[],
	userId: string
): Promise<{ created: number; updated: number }> {
	let created = 0;
	let updated = 0;
	for (const raw of items) {
		// Import : l'id du fichier ne compte pas, seule la référence identifie la fiche.
		const res = await upsertCatalogItem({ ...raw, id: '' }, userId);
		if (res.status === 'created') created++;
		else if (res.status === 'updated') updated++;
	}
	return { created, updated };
}

export async function deleteCatalogItem(id: string): Promise<boolean> {
	const db = await getDb();
	const res = await db.delete(catalog).where(eq(catalog.id, id));
	return res.rowsAffected > 0;
}
