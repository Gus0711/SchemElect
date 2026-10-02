import { json } from '@sveltejs/kit';
import { isCookieSecure } from '$lib/server/auth';
import { requireSuperAdmin } from '$lib/server/guards';
import { getOrganization, ORG_COOKIE } from '$lib/server/organizations';
import type { RequestHandler } from './$types';

/**
 * Super-administrateur : entrer dans une société (corps : `{ id }`), ou revenir à la sienne
 * (`{ id: null }`). Mémorisé par un cookie de session.
 */
export const POST: RequestHandler = async ({ locals, request, cookies, url }) => {
	const user = requireSuperAdmin(locals);
	let id: unknown = null;
	try {
		id = ((await request.json()) as { id?: unknown }).id ?? null;
	} catch {
		/* corps vide : retour à sa société */
	}
	const opts = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: isCookieSecure(url) };
	if (typeof id !== 'string' || id === user.homeOrganizationId) {
		cookies.delete(ORG_COOKIE, opts);
		return json({ id: user.homeOrganizationId });
	}
	if (!(await getOrganization(id))) return json({ error: 'Société introuvable' }, { status: 404 });
	cookies.set(ORG_COOKIE, id, opts);
	return json({ id });
};
