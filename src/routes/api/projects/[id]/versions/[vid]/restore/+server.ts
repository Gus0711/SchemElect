import { json } from '@sveltejs/kit';
import { canRestore } from '$lib/model/versions';
import { requireProject } from '$lib/server/access';
import { restoreVersion } from '$lib/server/projects';
import { projectContributors } from '$lib/server/versions';
import type { RequestHandler } from './$types';

/** Restaure une version (administrateur ou intervenant ; verrou d'édition requis). */
export const POST: RequestHandler = async ({ params, locals }) => {
	const user = await requireProject(locals, params.id, 'write');
	if (!canRestore(user, await projectContributors(params.id)))
		return json(
			{ error: 'Restauration réservée à l’administrateur et aux intervenants du dossier' },
			{ status: 403 }
		);
	const res = await restoreVersion(params.id, params.vid, user.id);
	if (res.status === 'not-found')
		return json({ error: 'Projet ou version introuvable' }, { status: 404 });
	if (res.status === 'locked')
		return json(
			{ error: `Dossier en cours d’édition par ${res.lock?.userName ?? 'un autre utilisateur'}` },
			{ status: 409 }
		);
	return json({ ok: true });
};
