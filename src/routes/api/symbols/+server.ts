import { json } from '@sveltejs/kit';
import { requireEditor, requireUser } from '$lib/server/guards';
import { listCustomSymbols, upsertCustomSymbol, validateSymbolDef } from '$lib/server/symbols';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	return json(await listCustomSymbols(user.organizationId));
};

/** Crée ou met à jour un symbole maison (corps : la `SymbolDef`). */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireEditor(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const def = validateSymbolDef(body);
	if (!def) return json({ error: 'Définition de symbole invalide' }, { status: 400 });
	const saved = await upsertCustomSymbol(def, user.id, user.organizationId);
	if (!saved) return json({ error: 'Identifiant de symbole déjà utilisé' }, { status: 409 });
	return json(saved, { status: 201 });
};
