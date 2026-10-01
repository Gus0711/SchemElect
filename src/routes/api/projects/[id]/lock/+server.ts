import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { acquireLock, getLock, releaseLock } from '$lib/server/locks';
import { versionOnClose } from '$lib/server/projects';
import type { RequestHandler } from './$types';

/** Fermeture du dossier : version de l'historique si besoin, puis libération du verrou. */
async function close(projectId: string, userId: string) {
	const lock = await getLock(projectId);
	if (lock?.userId === userId) await versionOnClose(projectId, userId);
	await releaseLock(projectId, userId);
}

/** Acquiert / rafraîchit le verrou ; `?release=1` le libère (navigator.sendBeacon). */
export const POST: RequestHandler = async ({ params, locals, url }) => {
	const user = requireUser(locals);
	if (url.searchParams.has('release')) {
		await close(params.id, user.id);
		return new Response(null, { status: 204 });
	}
	const result = await acquireLock(params.id, user.id);
	if (!result) return json({ error: 'Projet introuvable' }, { status: 404 });
	return json(result);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	await close(params.id, user.id);
	return new Response(null, { status: 204 });
};
