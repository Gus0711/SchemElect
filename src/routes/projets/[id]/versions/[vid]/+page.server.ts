import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { getVersion } from '$lib/server/versions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireUser(locals);
	const version = await getVersion(params.id, params.vid);
	if (!version) error(404, 'Version introuvable');
	return { projectId: params.id, version: version.info, data: version.data };
};
