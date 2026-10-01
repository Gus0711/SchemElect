import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { duplicateProject } from '$lib/server/projects';
import type { RequestHandler } from './$types';

/**
 * Duplique le dossier (ou une de ses versions : `versionId`) pour une nouvelle affaire.
 * Corps : `{ name, affaireNumber?, planNumber?, client?, resetRevisions?, versionId? }`.
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals);
	let body: Record<string, unknown> = {};
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const s = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : undefined);
	const id = await duplicateProject(
		params.id,
		user.id,
		{
			name: s('name') ?? '',
			affaireNumber: s('affaireNumber'),
			planNumber: s('planNumber'),
			client: s('client'),
			resetRevisions: body.resetRevisions === true,
			author: user.name
		},
		s('versionId')
	);
	if (!id) return json({ error: 'Projet ou version introuvable' }, { status: 404 });
	return json({ id }, { status: 201 });
};
