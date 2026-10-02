import { json } from '@sveltejs/kit';
import { listAffaires } from '$lib/server/affaires';
import { requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/** Affaires de la société (rattachement d'un schéma, duplication). */
export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	return json(await listAffaires(user.organizationId));
};
