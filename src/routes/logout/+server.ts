import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSessionCookie, invalidateSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/** Déconnexion : `<form method="POST" action="/logout">`. */
export const POST: RequestHandler = async ({ cookies, url }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(token);
	deleteSessionCookie(cookies, url);
	redirect(303, '/login');
};
