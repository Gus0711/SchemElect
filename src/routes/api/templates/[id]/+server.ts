import { json } from '@sveltejs/kit';
import { requireEditor } from '$lib/server/guards';
import { deleteTemplate } from '$lib/server/templates';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireEditor(locals);
	if (!(await deleteTemplate(params.id, user.organizationId)))
		return json({ error: 'Modèle introuvable' }, { status: 404 });
	return new Response(null, { status: 204 });
};
