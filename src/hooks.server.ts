import { json, redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	hasUsers,
	setSessionCookie,
	validateSessionToken
} from '$lib/server/auth';

const PUBLIC_PATHS = new Set(['/login', '/setup']);

function isAsset(path: string): boolean {
	return (
		path.startsWith('/_app/') ||
		path === '/favicon.ico' ||
		path === '/favicon.svg' ||
		path === '/robots.txt'
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	const path = event.url.pathname;
	if (isAsset(path)) return resolve(event);

	const isApi = path === '/api' || path.startsWith('/api/');

	// Premier lancement : aucun compte → création de l'administrateur.
	if (!(await hasUsers())) {
		if (path === '/setup') return resolve(event);
		if (isApi) return json({ error: 'Aucun compte configuré' }, { status: 401 });
		redirect(303, '/setup');
	}

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = await validateSessionToken(token);
		if (session) {
			event.locals.user = session.user;
			if (session.renewed) setSessionCookie(event.cookies, event.url, token, session.expiresAt);
		} else {
			deleteSessionCookie(event.cookies, event.url);
		}
	}

	if (!event.locals.user && !PUBLIC_PATHS.has(path)) {
		if (isApi) return json({ error: 'Non authentifié' }, { status: 401 });
		const target = path + event.url.search;
		redirect(303, target === '/' ? '/login' : `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	return resolve(event);
};
