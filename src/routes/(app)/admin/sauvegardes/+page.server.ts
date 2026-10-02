import { fail } from '@sveltejs/kit';
import { requireSuperAdmin } from '$lib/server/guards';
import { currentBackupConfig, listBackups, runBackup } from '$lib/server/backup';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireSuperAdmin(locals);
	const config = currentBackupConfig();
	return {
		config: config
			? { dir: config.dir, intervalHours: config.intervalMs / 3_600_000, keep: config.keep }
			: null,
		backups: listBackups(config).map((b) => ({
			name: b.name,
			date: b.date.toISOString(),
			size: b.size
		}))
	};
};

export const actions: Actions = {
	backup: async ({ locals }) => {
		requireSuperAdmin(locals);
		try {
			const b = await runBackup();
			return { ok: true, name: b.name };
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : String(e) });
		}
	}
};
