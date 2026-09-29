/**
 * Sauvegarde automatique de la base SQLite : copie cohérente (`VACUUM INTO`, sûre même
 * pendant l'utilisation) dans un dossier dédié, à intervalle régulier, avec rotation.
 *
 * Réglages (variables d'environnement) :
 * - `BACKUP_DIR` : dossier des sauvegardes (défaut : `backups/` à côté de la base) ;
 * - `BACKUP_INTERVAL_HOURS` : intervalle entre deux sauvegardes (défaut 24 ; 0 = désactivé) ;
 * - `BACKUP_KEEP` : nombre de sauvegardes conservées (défaut 30).
 *
 * Seules les bases locales (`file:`) sont sauvegardées ; une base libSQL distante a ses
 * propres mécanismes.
 */
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { getClient } from './db';

const PREFIX = 'schemelect-';
const SUFFIX = '.db';
const NAME_RE = /^schemelect-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.db$/;
/** Fréquence de vérification de l'échéance (la sauvegarde elle-même suit l'intervalle). */
const CHECK_EVERY_MS = 15 * 60_000;

export interface BackupConfig {
	dir: string;
	intervalMs: number;
	keep: number;
}

export interface BackupInfo {
	name: string;
	date: Date;
	size: number;
}

// --- Règles pures (testées) ---------------------------------------------------------

/** Nom de fichier horodaté (UTC), triable par ordre alphabétique = chronologique. */
export function backupFileName(date: Date): string {
	const iso = date.toISOString().slice(0, 19).replace(/:/g, '-');
	return `${PREFIX}${iso}Z${SUFFIX}`;
}

/** Date d'une sauvegarde d'après son nom, `null` si ce n'est pas une sauvegarde. */
export function parseBackupName(name: string): Date | null {
	const m = NAME_RE.exec(name);
	if (!m) return null;
	const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Sauvegardes à supprimer pour n'en garder que les `keep` plus récentes. */
export function backupsToDelete(names: string[], keep: number): string[] {
	const sorted = names.filter((n) => parseBackupName(n)).sort();
	return sorted.slice(0, Math.max(0, sorted.length - Math.max(1, keep)));
}

/** Une sauvegarde est-elle due (aucune, ou la dernière plus vieille que l'intervalle) ? */
export function isBackupDue(last: Date | null, intervalMs: number, now: number): boolean {
	if (intervalMs <= 0) return false;
	return !last || now - last.getTime() >= intervalMs;
}

/** Chemin du fichier de base d'une URL libSQL `file:`, `null` pour une base distante. */
export function databaseFilePath(url: string): string | null {
	if (!url.startsWith('file:')) return null;
	const path = url.slice('file:'.length).replace(/^\/\/\//, '/');
	return path && path !== ':memory:' ? resolve(path) : null;
}

function numberOr(value: string | undefined, fallback: number): number {
	const n = Number(value);
	return value !== undefined && value.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Configuration effective, `null` si la sauvegarde ne s'applique pas. */
export function backupConfig(vars: Record<string, string | undefined>): BackupConfig | null {
	const dbFile = databaseFilePath(vars.DATABASE_URL || 'file:local.db');
	if (!dbFile) return null;
	return {
		dir: resolve(vars.BACKUP_DIR || join(dirname(dbFile), 'backups')),
		intervalMs: numberOr(vars.BACKUP_INTERVAL_HOURS, 24) * 3_600_000,
		keep: Math.max(1, Math.floor(numberOr(vars.BACKUP_KEEP, 30)))
	};
}

// --- Fichiers -----------------------------------------------------------------------

export function currentBackupConfig(): BackupConfig | null {
	return backupConfig(env);
}

/** Sauvegardes présentes, la plus récente en premier. */
export function listBackups(config = currentBackupConfig()): BackupInfo[] {
	if (!config) return [];
	let names: string[];
	try {
		names = readdirSync(config.dir);
	} catch {
		return [];
	}
	const out: BackupInfo[] = [];
	for (const name of names) {
		const date = parseBackupName(name);
		if (!date) continue;
		try {
			out.push({ name, date, size: statSync(join(config.dir, name)).size });
		} catch {
			// Fichier supprimé entre-temps.
		}
	}
	return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Chemin d'une sauvegarde existante (nom validé : pas de traversée de dossier). */
export function backupPath(name: string, config = currentBackupConfig()): string | null {
	if (!config || !parseBackupName(name)) return null;
	return join(config.dir, name);
}

/** Crée une sauvegarde maintenant, puis applique la rotation. */
export async function runBackup(config = currentBackupConfig()): Promise<BackupInfo> {
	if (!config) throw new Error('Sauvegarde indisponible : la base n’est pas un fichier local');
	mkdirSync(config.dir, { recursive: true });
	const date = new Date();
	const name = backupFileName(date);
	const path = join(config.dir, name);
	const client = await getClient();
	await client.execute({ sql: 'VACUUM INTO ?', args: [path] });
	for (const old of backupsToDelete(readdirSync(config.dir), config.keep)) {
		try {
			unlinkSync(join(config.dir, old));
		} catch (e) {
			console.warn(`[sauvegarde] suppression de ${old} impossible :`, e);
		}
	}
	return { name, date, size: statSync(path).size };
}

// --- Planification ------------------------------------------------------------------

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(config: BackupConfig) {
	if (running) return;
	running = true;
	try {
		const last = listBackups(config)[0]?.date ?? null;
		if (isBackupDue(last, config.intervalMs, Date.now())) {
			const b = await runBackup(config);
			console.log(`[sauvegarde] ${b.name} (${Math.round(b.size / 1024)} Ko)`);
		}
	} catch (e) {
		console.error('[sauvegarde] échec :', e);
	} finally {
		running = false;
	}
}

/** Démarre la sauvegarde périodique (une seule fois par processus). */
export function startBackupSchedule(): void {
	const config = currentBackupConfig();
	if (timer || !config || config.intervalMs <= 0) return;
	void tick(config);
	timer = setInterval(() => void tick(config), Math.min(CHECK_EVERY_MS, config.intervalMs));
	timer.unref?.();
}
