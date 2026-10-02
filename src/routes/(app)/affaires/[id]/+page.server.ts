import { error, fail } from '@sveltejs/kit';
import { isStatus } from '$lib/model/affaires';
import { getAffaire, listAffaires, listClients, saveAffaire } from '$lib/server/affaires';
import { requireEditor, requireUser } from '$lib/server/guards';
import { listProjects } from '$lib/server/projects';
import { listTemplates } from '$lib/server/templates';
import type { Actions, PageServerLoad } from './$types';

/** Fiche d'une affaire : ses schémas (ouvrir, PDF, dupliquer), nouveau schéma, statut. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const found = await getAffaire(user.organizationId, params.id);
	if (!found) error(404, 'Affaire introuvable');
	const [projects, affaires, clients, templates] = await Promise.all([
		listProjects(user.organizationId),
		listAffaires(user.organizationId),
		listClients(user.organizationId),
		listTemplates(user.organizationId)
	]);
	return {
		affaire: found.affaire,
		client: found.client,
		projects: projects.filter((p) => p.affaire?.id === params.id),
		affaires,
		clients: clients.map((c) => ({ id: c.id, name: c.name })),
		templates: templates.map((t) => ({ id: t.id, name: t.name }))
	};
};

export const actions: Actions = {
	/** Changer le statut (en cours / terminée / archivée), y compris d'une affaire ERP. */
	status: async ({ request, locals, params }) => {
		const user = requireEditor(locals);
		const status = String((await request.formData()).get('status') ?? '');
		if (!isStatus(status)) return fail(400, { error: 'Statut inconnu.' });
		const found = await getAffaire(user.organizationId, params.id);
		if (!found) return fail(404, { error: 'Affaire introuvable.' });
		const { id, source, ...input } = found.affaire;
		void source;
		const res = await saveAffaire(user.organizationId, { ...input, status }, id);
		if (res.status !== 'ok') return fail(409, { error: 'Statut non modifié.' });
		return { ok: true };
	}
};
