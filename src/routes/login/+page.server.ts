import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSession, setSessionCookie } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

function safeRedirect(target: string | null): string {
	return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const login = String(form.get('login') ?? '');
		const password = String(form.get('password') ?? '');
		if (!login || !password)
			return fail(400, { login, error: 'Identifiant et mot de passe requis' });
		const user = await authenticate(login, password);
		if (!user) return fail(400, { login, error: 'Identifiant ou mot de passe incorrect' });
		const { token, expiresAt } = await createSession(user.id);
		setSessionCookie(cookies, url, token, expiresAt);
		redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	}
};
