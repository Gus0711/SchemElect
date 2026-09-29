import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { deleteTemplate } from '$lib/server/templates';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireUser(locals);
	if (!(await deleteTemplate(params.id)))
		return json({ error: 'Modèle introuvable' }, { status: 404 });
	return new Response(null, { status: 204 });
};
