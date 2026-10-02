import { fail, redirect } from '@sveltejs/kit';
import { buildSampleProject } from '$lib/export/sample';
import { buildSampleArmoire } from '$lib/export/sampleArmoire';
import { createProject } from '$lib/model/project';
import { applyTemplate } from '$lib/model/template';
import { requireProject } from '$lib/server/access';
import { normalizeAffaire } from '$lib/model/affaires';
import { findOrCreateClient, listAffaires, listClients, saveAffaire } from '$lib/server/affaires';
import { requireEditor, requireUser } from '$lib/server/guards';
import { getTemplate, listTemplates } from '$lib/server/templates';
import { getLock } from '$lib/server/locks';
import { deleteProject, insertProject, listProjects, renameProject } from '$lib/server/projects';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const [projects, templates, affaires, clients] = await Promise.all([
		listProjects(user.organizationId),
		listTemplates(user.organizationId),
		listAffaires(user.organizationId),
		listClients(user.organizationId)
	]);
	return {
		projects,
		templates: templates.map((t) => ({ id: t.id, name: t.name })),
		affaires,
		clients: clients.map((c) => ({ id: c.id, name: c.name }))
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** Valeur des listes « Affaire » et « Client » : en créer une nouvelle. */
const NEW = '__new';

/** Création guidée : nouvelle affaire (et au besoin nouveau client) saisie avec le schéma. */
async function createAffaireFromForm(
	form: FormData,
	organizationId: string
): Promise<{ id: string } | { error: string }> {
	let clientId = str(form, 'clientId');
	if (clientId === NEW) {
		const name = str(form, 'clientName');
		if (!name) return { error: 'Le nom du nouveau client est requis.' };
		clientId = await findOrCreateClient(organizationId, name);
	}
	const input = normalizeAffaire({
		clientId,
		whysoft: str(form, 'whysoft'),
		label: str(form, 'affaireLabel'),
		year: str(form, 'year')
	});
	if (!input) return { error: 'Nouvelle affaire : client et n° WhySoft (ou désignation) requis.' };
	const res = await saveAffaire(organizationId, input);
	if (res.status !== 'ok')
		return { error: 'error' in res ? res.error : 'Création de l’affaire impossible.' };
	return { id: res.item.id };
}

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
		// Affaire choisie (ou créée ici) : client, n° WhySoft (et n° d'affaire) viennent d'elle.
		let affaireId = str(form, 'affaire');
		if (affaireId === NEW) {
			const created = await createAffaireFromForm(form, user.organizationId);
			if ('error' in created) return fail(400, { action: 'create', error: created.error });
			affaireId = created.id;
		}
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
