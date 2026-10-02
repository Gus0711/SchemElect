import { requireUser } from '$lib/server/guards';
import { listOrganizations } from '$lib/server/organizations';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return {
		user: {
			id: user.id,
			name: user.name,
			role: user.role,
			organizationId: user.organizationId,
			organizationName: user.organizationName,
			homeOrganizationId: user.homeOrganizationId
		},
		// Super-administrateur : sociétés où il peut entrer.
		organizations:
			user.role === 'superadmin'
				? (await listOrganizations()).map((o) => ({ id: o.id, name: o.name }))
				: []
	};
};
