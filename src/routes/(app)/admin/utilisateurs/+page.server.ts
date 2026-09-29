import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { createUser, deleteUser, listUsers, resetPassword, type Role } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return { users: await listUsers() };
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '');

export const actions: Actions = {
	create: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const role: Role = str(form, 'role') === 'admin' ? 'admin' : 'user';
		const res = await createUser({
			login: str(form, 'login'),
			name: str(form, 'name'),
			password: str(form, 'password'),
			role
		});
		if (!res.ok) return fail(400, { action: 'create', error: res.error });
		return { action: 'create', ok: true };
	},

	reset: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const err = await resetPassword(str(form, 'id'), str(form, 'password'));
		if (err) return fail(400, { action: 'reset', error: err });
		return { action: 'reset', ok: true };
	},

	delete: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const err = await deleteUser(str(form, 'id'), admin.id);
		if (err) return fail(400, { action: 'delete', error: err });
		return { action: 'delete', ok: true };
	}
};
