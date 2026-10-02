import { fail } from '@sveltejs/kit';
import { normalizeAffaire, normalizeClient } from '$lib/model/affaires';
import {
	classifyExisting,
	deleteAffaire,
	deleteClient,
	listAffaires,
	listClients,
	saveAffaire,
	saveClient
} from '$lib/server/affaires';
import { requireAdmin, requireEditor, requireUser } from '$lib/server/guards';
import { listProjects } from '$lib/server/projects';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const [clients, affaires, projects] = await Promise.all([
		listClients(user.organizationId),
		listAffaires(user.organizationId),
		listProjects(user.organizationId)
	]);
	return {
		clients,
		affaires,
		/** Schémas (pour la fiche d'une affaire et le compte des non classés). */
		projects: projects.map((p) => ({
			id: p.id,
			name: p.name,
			affaireId: p.affaire?.id ?? null,
			updatedAt: p.updatedAt
		}))
	};
};

const fields = (form: FormData) => Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));

const USED = {
	client: 'Ce client a des affaires : supprimez-les ou rattachez-les d’abord.',
	affaire: 'Des schémas sont rattachés à cette affaire : rattachez-les ailleurs d’abord.'
};
const READONLY = 'Fiche reprise de l’ERP : elle se modifie dans l’ERP.';

export const actions: Actions = {
	saveClient: async ({ request, locals }) => {
		const user = requireEditor(locals);
		const raw = fields(await request.formData());
		const input = normalizeClient(raw);
		if (!input) return fail(400, { action: 'saveClient', error: 'Le nom du client est requis.' });
		const res = await saveClient(user.organizationId, input, raw.id || undefined);
		if (res.status === 'not-found')
			return fail(404, { action: 'saveClient', error: 'Client introuvable.' });
		if (res.status !== 'ok') return fail(409, { action: 'saveClient', error: res.error });
		return { action: 'saveClient', ok: true, id: res.item.id };
	},

	deleteClient: async ({ request, locals }) => {
		const user = requireEditor(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const res = await deleteClient(user.organizationId, id);
		if (res === 'ok') return { action: 'deleteClient', ok: true };
		return fail(res === 'not-found' ? 404 : 409, {
			action: 'deleteClient',
			error: res === 'used' ? USED.client : res === 'readonly' ? READONLY : 'Client introuvable.'
		});
	},

	saveAffaire: async ({ request, locals }) => {
		const user = requireEditor(locals);
		const raw = fields(await request.formData());
		const input = normalizeAffaire(raw);
		if (!input)
			return fail(400, {
				action: 'saveAffaire',
				error: 'Client et n° WhySoft (ou désignation) requis.'
			});
		const res = await saveAffaire(user.organizationId, input, raw.id || undefined);
		if (res.status === 'not-found')
			return fail(404, { action: 'saveAffaire', error: 'Affaire introuvable.' });
		if (res.status !== 'ok') return fail(409, { action: 'saveAffaire', error: res.error });
		return { action: 'saveAffaire', ok: true, id: res.item.id };
	},

	deleteAffaire: async ({ request, locals }) => {
		const user = requireEditor(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const res = await deleteAffaire(user.organizationId, id);
		if (res === 'ok') return { action: 'deleteAffaire', ok: true };
		return fail(res === 'not-found' ? 404 : 409, {
			action: 'deleteAffaire',
			error: res === 'used' ? USED.affaire : res === 'readonly' ? READONLY : 'Affaire introuvable.'
		});
	},

	/** Reprise de l'existant : classe les schémas d'après leur cartouche (administrateur). */
	classify: async ({ locals }) => {
		const user = requireAdmin(locals);
		const res = await classifyExisting(user.organizationId);
		return { action: 'classify', ok: true, ...res };
	}
};
