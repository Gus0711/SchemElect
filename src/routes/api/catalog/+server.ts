import { json } from '@sveltejs/kit';
import { normalizeCatalogItem, type CatalogItem } from '$lib/model/catalog';
import {
	importCatalog,
	listCatalog,
	MAX_IMPORT,
	upsertCatalogItem,
	validateCatalogItem
} from '$lib/server/catalog';
import { requireEditor, requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	return json(await listCatalog(user.organizationId));
};

/**
 * Crée ou met à jour une fiche (corps : la `CatalogItem`), ou importe une liste
 * (corps : `{ items: CatalogItem[] }`, fiches de même référence mises à jour).
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireEditor(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
		const raw = (body as { items: unknown[] }).items;
		if (raw.length > MAX_IMPORT)
			return json({ error: `Import limité à ${MAX_IMPORT} fiches` }, { status: 400 });
		const items = raw.map(normalizeCatalogItem).filter((x): x is CatalogItem => !!x);
		return json(await importCatalog(items, user.id, user.organizationId));
	}
	const item = validateCatalogItem(body);
	if (!item) return json({ error: 'Fiche invalide (référence obligatoire)' }, { status: 400 });
	const res = await upsertCatalogItem(item, user.id, user.organizationId);
	if (res.status === 'conflict')
		return json({ error: 'Cette référence existe déjà dans le catalogue' }, { status: 409 });
	return json(res.item, { status: res.status === 'created' ? 201 : 200 });
};
