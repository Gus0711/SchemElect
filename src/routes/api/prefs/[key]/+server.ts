import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { getPref, PREFS, setPref, validatePref } from '$lib/server/prefs';
import type { RequestHandler } from './$types';

/** Préférence de l'utilisateur connecté (`{ value }`, null si jamais réglée). */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	if (!PREFS[params.key]) return json({ error: 'Préférence inconnue' }, { status: 404 });
	return json({ value: await getPref(user.id, params.key) });
};

/** Enregistre une préférence (corps : `{ value }`). */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const value = validatePref(params.key, (body as { value?: unknown })?.value);
	if (value === null) return json({ error: 'Préférence invalide' }, { status: 400 });
	await setPref(user.id, params.key, value);
	return json({ value });
};
