import { json } from '@sveltejs/kit';
import { deleteCatalogItem } from '$lib/server/catalog';
import { requireEditor } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireEditor(locals);
	if (!(await deleteCatalogItem(params.id, user.organizationId)))
		return json({ error: 'Fiche introuvable' }, { status: 404 });
	return new Response(null, { status: 204 });
};
