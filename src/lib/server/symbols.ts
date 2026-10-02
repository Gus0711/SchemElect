/** Bibliothèque partagée des symboles maison. */
import { and, eq } from 'drizzle-orm';
import type { SymbolDef } from '$lib/symbols/types';
import { getDb } from './db';
import { customSymbols } from './db/schema';

/** Contrôle minimal d'une définition reçue du client. */
export function validateSymbolDef(def: unknown): SymbolDef | null {
	const d = def as SymbolDef;
	if (!d || typeof d !== 'object') return null;
	if (typeof d.id !== 'string' || !d.id.startsWith('custom-')) return null;
	if (typeof d.name !== 'string' || !d.name.trim()) return null;
	if (!Array.isArray(d.graphics) || !Array.isArray(d.terminals)) return null;
	if (!d.bounds || typeof d.bounds.w !== 'number') return null;
	return { ...d, custom: true };
}

export async function listCustomSymbols(organizationId: string): Promise<SymbolDef[]> {
	const db = await getDb();
	const rows = await db
		.select()
		.from(customSymbols)
		.where(eq(customSymbols.organizationId, organizationId))
		.orderBy(customSymbols.category, customSymbols.name);
	return rows.map((r) => JSON.parse(r.def) as SymbolDef);
}

/** Crée ou remplace un symbole (l'id est choisi par le client : `custom-…`). */
export async function upsertCustomSymbol(
	def: SymbolDef,
	userId: string,
	organizationId: string
): Promise<SymbolDef | null> {
	const db = await getDb();
	// Un identifiant déjà pris par une autre société n'est pas écrasé.
	const [other] = await db
		.select({ org: customSymbols.organizationId })
		.from(customSymbols)
		.where(eq(customSymbols.id, def.id));
	if (other && other.org !== organizationId) return null;
	const now = new Date().toISOString();
	const values = {
		id: def.id,
		organizationId,
		name: def.name,
		category: def.category ?? '',
		def: JSON.stringify(def),
		createdBy: userId,
		createdAt: now,
		updatedAt: now
	};
	await db
		.insert(customSymbols)
		.values(values)
		.onConflictDoUpdate({
			target: customSymbols.id,
			set: { name: values.name, category: values.category, def: values.def, updatedAt: now }
		});
	return def;
}

export async function deleteCustomSymbol(id: string, organizationId: string): Promise<boolean> {
	const db = await getDb();
	const res = await db
		.delete(customSymbols)
		.where(and(eq(customSymbols.id, id), eq(customSymbols.organizationId, organizationId)));
	return res.rowsAffected > 0;
}
