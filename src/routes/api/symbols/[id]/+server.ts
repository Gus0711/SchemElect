import { json } from '@sveltejs/kit';
import { requireEditor } from '$lib/server/guards';
import { deleteCustomSymbol } from '$lib/server/symbols';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireEditor(locals);
	if (!(await deleteCustomSymbol(params.id, user.organizationId)))
		return json({ error: 'Symbole introuvable' }, { status: 404 });
	return new Response(null, { status: 204 });
};
