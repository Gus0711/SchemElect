import { fail } from '@sveltejs/kit';
import { assignableRoles, isRole, type Role } from '$lib/model/access';
import { requireAdmin } from '$lib/server/guards';
import { createUser, deleteUser, listUsers, resetPassword, setUserRole } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requireAdmin(locals);
	return {
		users: await listUsers(admin.organizationId),
		roles: assignableRoles(admin.role),
		organizationName: admin.organizationName
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '');

/** Rôle demandé, s'il est permis à cet administrateur (sinon : utilisateur). */
function roleOf(form: FormData, admin: App.SessionUser): Role {
	const r = str(form, 'role');
	return isRole(r) && assignableRoles(admin.role).includes(r) ? r : 'user';
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const res = await createUser({
			login: str(form, 'login'),
			name: str(form, 'name'),
			password: str(form, 'password'),
			role: roleOf(form, admin),
			organizationId: admin.organizationId
		});
		if (!res.ok) return fail(400, { action: 'create', error: res.error });
		return { action: 'create', ok: true };
	},

	role: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const err = await setUserRole(admin, str(form, 'id'), roleOf(form, admin));
		if (err) return fail(400, { action: 'role', error: err });
		return { action: 'role', ok: true };
	},

	reset: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const err = await resetPassword(admin, str(form, 'id'), str(form, 'password'));
		if (err) return fail(400, { action: 'reset', error: err });
		return { action: 'reset', ok: true };
	},

	delete: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const err = await deleteUser(admin, str(form, 'id'));
		if (err) return fail(400, { action: 'delete', error: err });
		return { action: 'delete', ok: true };
	}
};
