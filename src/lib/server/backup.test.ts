import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	backupConfig,
	backupFileName,
	backupsToDelete,
	databaseFilePath,
	isBackupDue,
	parseBackupName
} from './backup';

const H = 3_600_000;

describe('sauvegarde de la base', () => {
	it('nom horodaté réversible', () => {
		const d = new Date('2026-09-29T14:05:09.123Z');
		const name = backupFileName(d);
		expect(name).toBe('schemelect-2026-09-29T14-05-09Z.db');
		expect(parseBackupName(name)?.toISOString()).toBe('2026-09-29T14:05:09.000Z');
	});

	it('ignore les fichiers qui ne sont pas des sauvegardes', () => {
		expect(parseBackupName('local.db')).toBeNull();
		expect(parseBackupName('../schemelect-2026-09-29T14-05-09Z.db')).toBeNull();
		expect(parseBackupName('schemelect-2026-09-29T14-05-09Z.db-journal')).toBeNull();
	});

	it('rotation : garde les plus récentes', () => {
		const names = [
			'schemelect-2026-09-27T10-00-00Z.db',
			'autre.txt',
			'schemelect-2026-09-29T10-00-00Z.db',
			'schemelect-2026-09-28T10-00-00Z.db'
		];
		expect(backupsToDelete(names, 2)).toEqual(['schemelect-2026-09-27T10-00-00Z.db']);
		expect(backupsToDelete(names, 5)).toEqual([]);
		// Toujours au moins une sauvegarde conservée.
		expect(backupsToDelete(names, 0)).toHaveLength(2);
	});

	it('échéance', () => {
		const now = Date.parse('2026-09-29T12:00:00Z');
		expect(isBackupDue(null, 24 * H, now)).toBe(true);
		expect(isBackupDue(new Date(now - 23 * H), 24 * H, now)).toBe(false);
		expect(isBackupDue(new Date(now - 24 * H), 24 * H, now)).toBe(true);
		expect(isBackupDue(null, 0, now)).toBe(false);
	});

	it('chemin de la base', () => {
		expect(databaseFilePath('file:local.db')).toBe(resolve('local.db'));
		expect(databaseFilePath('file:/app/data/schemelect.db')).toBe(
			resolve('/app/data/schemelect.db')
		);
		expect(databaseFilePath('libsql://x.turso.io')).toBeNull();
		expect(databaseFilePath('file::memory:')).toBeNull();
	});

	it('configuration', () => {
		expect(backupConfig({ DATABASE_URL: 'file:/app/data/schemelect.db' })).toEqual({
			dir: resolve('/app/data/backups'),
			intervalMs: 24 * H,
			keep: 30
		});
		expect(
			backupConfig({
				DATABASE_URL: 'file:local.db',
				BACKUP_DIR: '/sauvegardes',
				BACKUP_INTERVAL_HOURS: '6',
				BACKUP_KEEP: '10'
			})
		).toEqual({ dir: resolve('/sauvegardes'), intervalMs: 6 * H, keep: 10 });
		expect(backupConfig({ BACKUP_INTERVAL_HOURS: '0' })?.intervalMs).toBe(0);
		expect(backupConfig({ BACKUP_KEEP: 'n/a' })?.keep).toBe(30);
		expect(backupConfig({})?.dir).toBe(join(resolve('.'), 'backups'));
		expect(backupConfig({ DATABASE_URL: 'libsql://x.turso.io' })).toBeNull();
	});
});
