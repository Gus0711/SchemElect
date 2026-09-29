import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { acquireLock, releaseLock } from '$lib/server/locks';
import type { RequestHandler } from './$types';

/** Acquiert / rafraîchit le verrou ; `?release=1` le libère (navigator.sendBeacon). */
export const POST: RequestHandler = async ({ params, locals, url }) => {
	const user = requireUser(locals);
	if (url.searchParams.has('release')) {
		await releaseLock(params.id, user.id);
		return new Response(null, { status: 204 });
	}
	const result = await acquireLock(params.id, user.id);
	if (!result) return json({ error: 'Projet introuvable' }, { status: 404 });
	return json(result);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	await releaseLock(params.id, user.id);
	return new Response(null, { status: 204 });
};
