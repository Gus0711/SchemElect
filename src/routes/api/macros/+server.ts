import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import { insertMacro, listMacros } from '$lib/server/projects';
import type { Fragment } from '$lib/model/fragments';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	requireUser(locals);
	return json(await listMacros());
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	let body: { name?: unknown; category?: unknown; data?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'JSON invalide' }, { status: 400 });
	}
	const name = typeof body?.name === 'string' ? body.name.trim() : '';
	const category = typeof body?.category === 'string' ? body.category.trim() : '';
	const data = body?.data as Fragment | undefined;
	if (!name) return json({ error: 'Nom de macro requis' }, { status: 400 });
	if (
		!data ||
		typeof data !== 'object' ||
		!Array.isArray(data.symbols) ||
		!Array.isArray(data.wires)
	) {
		return json({ error: 'Fragment invalide' }, { status: 400 });
	}
	const macro = await insertMacro({ name, category, data }, user.id);
	return json(macro, { status: 201 });
};
