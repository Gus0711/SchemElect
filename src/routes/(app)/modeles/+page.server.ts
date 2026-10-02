import { requireUser } from '$lib/server/guards';
import { listTemplates } from '$lib/server/templates';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return { templates: await listTemplates(user.organizationId) };
};
