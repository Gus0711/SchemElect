import { json } from '@sveltejs/kit';
import { requireEditor, requireUser } from '$lib/server/guards';
import { listTemplates, upsertTemplate, validateTemplate } from '$lib/server/templates';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	return json(await listTemplates(user.organizationId));
};

/** Crée ou met à jour un modèle de cartouche / page de garde (corps : le `DocTemplate`). */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireEditor(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const t = validateTemplate(body);
	if (!t) return json({ error: 'Modèle invalide (ou logo trop lourd)' }, { status: 400 });
	const saved = await upsertTemplate(t, user.id, user.organizationId);
	if (!saved) return json({ error: 'Identifiant de modèle déjà utilisé' }, { status: 409 });
	return json(saved, { status: 201 });
};
