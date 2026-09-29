import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { deleteMacro } from '$lib/server/projects';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireUser(locals);
	if (!(await deleteMacro(params.id))) return json({ error: 'Macro introuvable' }, { status: 404 });
	return new Response(null, { status: 204 });
};
