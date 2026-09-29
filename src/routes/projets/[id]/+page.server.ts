import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { getProject } from '$lib/server/projects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const project = await getProject(params.id);
	if (!project) error(404, 'Projet introuvable');
	return {
		user: { id: user.id, name: user.name, role: user.role },
		project: { id: project.id, data: project.data, updatedAt: project.updatedAt }
	};
};
