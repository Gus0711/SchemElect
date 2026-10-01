import { json } from '@sveltejs/kit';
import { canRestore } from '$lib/model/versions';
import { requireUser } from '$lib/server/guards';
import { getProject } from '$lib/server/projects';
import { listVersions, projectContributors, recordVersion } from '$lib/server/versions';
import type { RequestHandler } from './$types';

/** Historique du dossier (plus récent d'abord) et droit de restaurer de l'utilisateur. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const [versions, contributors] = await Promise.all([
		listVersions(params.id),
		projectContributors(params.id)
	]);
	return json({ versions, canRestore: canRestore(user, contributors) });
};

/** Version nommée de l'état enregistré du dossier (corps : `{ label }`). */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals);
	let label = '';
	try {
		label = String(((await request.json()) as { label?: unknown }).label ?? '').trim();
	} catch {
		/* corps vide : libellé par défaut */
	}
	const project = await getProject(params.id);
	if (!project) return json({ error: 'Projet introuvable' }, { status: 404 });
	const id = await recordVersion(
		params.id,
		project.data,
		user.id,
		'named',
		label || 'Version enregistrée'
	);
	return json({ id }, { status: 201 });
};
