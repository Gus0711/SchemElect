import { json } from '@sveltejs/kit';
import { deleteCatalogItem } from '$lib/server/catalog';
import { requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireUser(locals);
	if (!(await deleteCatalogItem(params.id)))
		return json({ error: 'Fiche introuvable' }, { status: 404 });
	return new Response(null, { status: 204 });
};
