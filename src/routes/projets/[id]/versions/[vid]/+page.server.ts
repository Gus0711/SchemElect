import { error } from '@sveltejs/kit';
import { requireProject } from '$lib/server/access';
import { getVersion } from '$lib/server/versions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = await requireProject(locals, params.id, 'read');
	const version = await getVersion(params.id, params.vid);
	if (!version) error(404, 'Version introuvable');
	return {
		projectId: params.id,
		version: version.info,
		data: version.data,
		viewer: user.role === 'viewer'
	};
};
