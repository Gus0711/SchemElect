import { fail, redirect } from '@sveltejs/kit';
import { createSession, hasUsers, setSessionCookie } from '$lib/server/auth';
import { createUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (await hasUsers()) redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (await hasUsers()) redirect(303, '/login');
		const form = await request.formData();
		const login = String(form.get('login') ?? '');
		const name = String(form.get('name') ?? '');
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (password !== confirm)
			return fail(400, { login, name, error: 'Les mots de passe ne correspondent pas' });
		const res = await createUser({ login, name, password, role: 'admin' });
		if (!res.ok) return fail(400, { login, name, error: res.error });
		const { token, expiresAt } = await createSession(res.id);
		setSessionCookie(cookies, url, token, expiresAt);
		redirect(303, '/');
	}
};
