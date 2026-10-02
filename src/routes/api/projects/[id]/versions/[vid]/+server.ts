import { json } from '@sveltejs/kit';
import { requireProject } from '$lib/server/access';
import { getVersion } from '$lib/server/versions';
import type { RequestHandler } from './$types';

/** Document d'une version (consultation, export PDF). */
export const GET: RequestHandler = async ({ params, locals }) => {
	await requireProject(locals, params.id, 'read');
	const version = await getVersion(params.id, params.vid);
	if (!version) return json({ error: 'Version introuvable' }, { status: 404 });
	return json(version);
};
