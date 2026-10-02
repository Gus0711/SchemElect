/** Bibliothèque partagée des modèles de cartouche et de page de garde. */
import { and, asc, eq } from 'drizzle-orm';
import { normalizeTemplate, type DocTemplate } from '$lib/model/template';
import { getDb } from './db';
import { templates } from './db/schema';

/** Taille maximale d'un modèle (logo compris). */
const MAX_BYTES = 2_000_000;

/** Contrôle d'un modèle reçu du client (forme, taille, logo en data URL). */
export function validateTemplate(raw: unknown): DocTemplate | null {
	const t = normalizeTemplate(raw);
	if (!t || t.id === 'defaut' || JSON.stringify(t).length > MAX_BYTES) return null;
	return t;
}

export async function listTemplates(organizationId: string): Promise<DocTemplate[]> {
	const db = await getDb();
	const rows = await db
		.select()
		.from(templates)
		.where(eq(templates.organizationId, organizationId))
		.orderBy(asc(templates.name));
	return rows
		.map((r) => normalizeTemplate({ ...JSON.parse(r.data), updatedAt: r.updatedAt }))
		.filter((t): t is DocTemplate => !!t);
}

export async function getTemplate(id: string, organizationId: string): Promise<DocTemplate | null> {
	const db = await getDb();
	const [row] = await db
		.select()
		.from(templates)
		.where(and(eq(templates.id, id), eq(templates.organizationId, organizationId)));
	return row ? normalizeTemplate({ ...JSON.parse(row.data), updatedAt: row.updatedAt }) : null;
}

/** Crée ou remplace un modèle (l'id est choisi par le client). */
export async function upsertTemplate(
	t: DocTemplate,
	userId: string,
	organizationId: string
): Promise<DocTemplate | null> {
	const db = await getDb();
	// Un identifiant déjà pris par une autre société n'est pas écrasé.
	const [other] = await db
		.select({ org: templates.organizationId })
		.from(templates)
		.where(eq(templates.id, t.id));
	if (other && other.org !== organizationId) return null;
	const now = new Date().toISOString();
	const saved = { ...t, updatedAt: now };
	const data = JSON.stringify(saved);
	await db
		.insert(templates)
		.values({
			id: t.id,
			organizationId,
			name: t.name,
			data,
			createdBy: userId,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({ target: templates.id, set: { name: t.name, data, updatedAt: now } });
	return saved;
}

export async function deleteTemplate(id: string, organizationId: string): Promise<boolean> {
	const db = await getDb();
	const res = await db
		.delete(templates)
		.where(and(eq(templates.id, id), eq(templates.organizationId, organizationId)));
	return res.rowsAffected > 0;
}
