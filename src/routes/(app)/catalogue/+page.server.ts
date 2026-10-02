import { listCatalog } from '$lib/server/catalog';
import { requireUser } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { items: await listCatalog(user.organizationId) };
};
