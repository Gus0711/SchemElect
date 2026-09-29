import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { listCustomSymbols, upsertCustomSymbol, validateSymbolDef } from '$lib/server/symbols';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	requireUser(locals);
	return json(await listCustomSymbols());
};

/** Crée ou met à jour un symbole maison (corps : la `SymbolDef`). */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const def = validateSymbolDef(body);
	if (!def) return json({ error: 'Définition de symbole invalide' }, { status: 400 });
	return json(await upsertCustomSymbol(def, user.id), { status: 201 });
};
