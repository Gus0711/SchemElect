import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { backupPath } from '$lib/server/backup';
import type { RequestHandler } from './$types';

/** Téléchargement d'une sauvegarde (administrateurs). */
export const GET: RequestHandler = async ({ locals, params }) => {
	requireAdmin(locals);
	const path = backupPath(params.name);
	if (!path) error(404, 'Sauvegarde introuvable');
	let data: Buffer;
	try {
		data = await readFile(path);
	} catch {
		error(404, 'Sauvegarde introuvable');
	}
	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': 'application/vnd.sqlite3',
			'content-disposition': `attachment; filename="${params.name}"`,
			'cache-control': 'no-store'
		}
	});
};
