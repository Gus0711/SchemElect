import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { listTemplates, upsertTemplate, validateTemplate } from '$lib/server/templates';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	requireUser(locals);
	return json(await listTemplates());
};

/** Crée ou met à jour un modèle de cartouche / page de garde (corps : le `DocTemplate`). */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const t = validateTemplate(body);
	if (!t) return json({ error: 'Modèle invalide (ou logo trop lourd)' }, { status: 400 });
	return json(await upsertTemplate(t, user.id), { status: 201 });
};
