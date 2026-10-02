import { fail } from '@sveltejs/kit';
import { requireSuperAdmin } from '$lib/server/guards';
import {
	createOrganization,
	listOrganizations,
	renameOrganization
} from '$lib/server/organizations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireSuperAdmin(locals);
	return { organizations: await listOrganizations() };
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '');

export const actions: Actions = {
	/** Nouvelle société et son premier administrateur. */
	create: async ({ request, locals }) => {
		requireSuperAdmin(locals);
		const form = await request.formData();
		const res = await createOrganization({
			name: str(form, 'organization'),
			admin: { login: str(form, 'login'), name: str(form, 'name'), password: str(form, 'password') }
		});
		if (!res.ok) return fail(400, { action: 'create', error: res.error });
		return { action: 'create', ok: true };
	},

	rename: async ({ request, locals }) => {
		requireSuperAdmin(locals);
		const form = await request.formData();
		const err = await renameOrganization(str(form, 'id'), str(form, 'name'));
		if (err) return fail(400, { action: 'rename', error: err });
		return { action: 'rename', ok: true };
	}
};
