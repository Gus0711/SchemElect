import { error } from '@sveltejs/kit';
import { requireProject } from '$lib/server/access';
import { getProject } from '$lib/server/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = await requireProject(locals, params.id, 'read');
	const project = await getProject(params.id);
	if (!project) error(404, 'Projet introuvable');
	return {
		user: { id: user.id, name: user.name, role: user.role },
		project: { id: project.id, data: project.data, updatedAt: project.updatedAt }
	};
};
