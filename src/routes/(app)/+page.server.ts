import { fail, redirect } from '@sveltejs/kit';
import { buildSampleProject } from '$lib/export/sample';
import { buildSampleArmoire } from '$lib/export/sampleArmoire';
import { createProject } from '$lib/model/project';
import { applyTemplate } from '$lib/model/template';
import { requireProject } from '$lib/server/access';
import { listAffaires } from '$lib/server/affaires';
import { requireEditor, requireUser } from '$lib/server/guards';
import { getTemplate, listTemplates } from '$lib/server/templates';
import { getLock } from '$lib/server/locks';
import { deleteProject, insertProject, listProjects, renameProject } from '$lib/server/projects';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const [projects, templates, affaires] = await Promise.all([
		listProjects(user.organizationId),
		listTemplates(user.organizationId),
		listAffaires(user.organizationId)
	]);
	return {
		projects,
		templates: templates.map((t) => ({ id: t.id, name: t.name })),
		affaires
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** Refuse l'opération si un autre utilisateur édite le projet. */
async function lockedByOther(id: string, userId: string): Promise<string | null> {
	const lock = await getLock(id);
	return lock && lock.userId !== userId ? lock.userName : null;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = requireEditor(locals);
		const form = await request.formData();
		const name = str(form, 'name');
		if (!name) return fail(400, { action: 'create', error: 'Le nom du projet est requis' });
		const project = createProject(name, user.name);
		project.meta.affaireNumber = str(form, 'affaireNumber');
		project.meta.planNumber = str(form, 'planNumber');
		project.meta.client = str(form, 'client');
		// Affaire choisie : client, n° WhySoft (et n° d'affaire) viennent d'elle.
		const affaireId = str(form, 'affaire');
		if (affaireId) project.meta.affaireId = affaireId;
		// Modèle de cartouche / page de garde choisi (copie dans le projet).
		const templateId = str(form, 'template');
		const template = templateId ? await getTemplate(templateId, user.organizationId) : null;
		if (template) applyTemplate(project, template);
		const id = await insertProject(project, user.id, user.organizationId);
		redirect(303, `/projets/${id}`);
	},

	/** Projet de démonstration (dossier chaufferie inspiré de l'exemple WinRelais). */
	demo: async ({ locals }) => {
		const user = requireEditor(locals);
		const id = await insertProject(buildSampleProject(), user.id, user.organizationId);
		redirect(303, `/projets/${id}`);
	},

	/** Exemple complet : distribution, chaudière, pompe, implantation et façade. */
	demoArmoire: async ({ locals }) => {
		const user = requireEditor(locals);
		const id = await insertProject(buildSampleArmoire(), user.id, user.organizationId);
		redirect(303, `/projets/${id}`);
	},

	rename: async ({ request, locals }) => {
		const form = await request.formData();
		const id = str(form, 'id');
		const user = await requireProject(locals, id, 'write');
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
		const id = str(await request.formData(), 'id');
		const user = await requireProject(locals, id, 'write');
		const other = await lockedByOther(id, user.id);
		if (other)
			return fail(409, { action: 'delete', error: `Projet en cours d'édition par ${other}` });
		await deleteProject(id);
		return { action: 'delete', ok: true };
	}
};
