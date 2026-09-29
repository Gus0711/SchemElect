import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { getLock } from '$lib/server/locks';
import { getProject, saveProjectData } from '$lib/server/projects';
import type { ProjectResponse } from '$lib/api/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	requireUser(locals);
	const project = await getProject(params.id);
	if (!project) return json({ error: 'Projet introuvable' }, { status: 404 });
	const lock = (await getLock(params.id)) ?? null;
	return json({ ...project, lock } satisfies ProjectResponse);
};

export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const user = requireUser(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const data = body && typeof body === 'object' ? (body as { data?: unknown }).data : undefined;
	if (!data || typeof data !== 'object')
		return json({ error: 'Champ « data » manquant' }, { status: 400 });

	let result;
	try {
		result = await saveProjectData(params.id, data, user.id);
	} catch (e) {
		return json({ error: `Document projet invalide : ${(e as Error).message}` }, { status: 400 });
	}
	if (result.status === 'not-found') return json({ error: 'Projet introuvable' }, { status: 404 });
	if (result.status === 'locked') {
		const who = result.lock?.userName ?? 'un autre utilisateur';
		return json({ error: `Projet verrouillé par ${who}`, lock: result.lock }, { status: 409 });
	}
	return json({ updatedAt: result.updatedAt });
};
