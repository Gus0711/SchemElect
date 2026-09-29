import { fail, redirect } from '@sveltejs/kit';
import { buildSampleProject } from '$lib/export/sample';
import { createProject } from '$lib/model/project';
import { requireUser } from '$lib/server/guards';
import { getLock } from '$lib/server/locks';
import {
	deleteProject,
	duplicateProject,
	insertProject,
	listProjects,
	renameProject
} from '$lib/server/projects';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { projects: await listProjects() };
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** Refuse l'opération si un autre utilisateur édite le projet. */
async function lockedByOther(id: string, userId: string): Promise<string | null> {
	const lock = await getLock(id);
	return lock && lock.userId !== userId ? lock.userName : null;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const name = str(form, 'name');
		if (!name) return fail(400, { action: 'create', error: 'Le nom du projet est requis' });
		const project = createProject(name, user.name);
		project.meta.affaireNumber = str(form, 'affaireNumber');
		project.meta.planNumber = str(form, 'planNumber');
		project.meta.client = str(form, 'client');
		const id = await insertProject(project, user.id);
		redirect(303, `/projets/${id}`);
	},

	/** Projet de démonstration (dossier chaufferie inspiré de l'exemple WinRelais). */
	demo: async ({ locals }) => {
		const user = requireUser(locals);
		const id = await insertProject(buildSampleProject(), user.id);
		redirect(303, `/projets/${id}`);
	},

	duplicate: async ({ request, locals }) => {
		const user = requireUser(locals);
		const id = str(await request.formData(), 'id');
		const copy = await duplicateProject(id, user.id);
		if (!copy) return fail(404, { action: 'duplicate', error: 'Projet introuvable' });
		return { action: 'duplicate', ok: true };
	},

	rename: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const id = str(form, 'id');
		const name = str(form, 'name');
		if (!name) return fail(400, { action: 'rename', error: 'Le nom est requis' });
		const other = await lockedByOther(id, user.id);
		if (other)
			return fail(409, { action: 'rename', error: `Projet en cours d'édition par ${other}` });
		if (!(await renameProject(id, name, user.id)))
			return fail(404, { action: 'rename', error: 'Projet introuvable' });
		return { action: 'rename', ok: true };
	},

	delete: async ({ request, locals }) => {
		const user = requireUser(locals);
		const id = str(await request.formData(), 'id');
		const other = await lockedByOther(id, user.id);
		if (other)
			return fail(409, { action: 'delete', error: `Projet en cours d'édition par ${other}` });
		await deleteProject(id);
		return { action: 'delete', ok: true };
	}
};
