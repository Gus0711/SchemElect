/**
 * Historique des versions d'un dossier : règles pures (quand créer une version, lesquelles
 * conserver, qui peut restaurer, duplication). Le stockage est dans `server/versions.ts`.
 *
 * - Version **automatique** : à l'enregistrement si la précédente a plus de 15 min, à la
 *   fermeture du dossier, à la création ; jamais si le contenu n'a pas changé.
 * - Version **nommée** : créée à la main (« Envoyé au client »), à chaque nouvel indice de
 *   révision, avant une restauration. Jamais supprimée automatiquement.
 * - Conservation des automatiques : tout sur 48 h, puis la dernière de chaque jour pendant
 *   30 jours, au-delà rien.
 */
import { canEdit, isAdmin, type Role } from './access';
import { listDevices } from './inventory';
import type { Project } from './types';

export type VersionKind = 'auto' | 'named';

export interface VersionSummary {
	folios: number;
	devices: number;
}

export interface VersionInfo {
	id: string;
	createdAt: string;
	createdBy: string | null;
	createdByName: string | null;
	kind: VersionKind;
	/** Commentaire (nommée) ou motif (« Création », « Fermeture du dossier »). */
	label: string;
	summary: VersionSummary;
}

export const AUTO_INTERVAL_MS = 15 * 60 * 1000;
export const KEEP_ALL_MS = 48 * 3600 * 1000;
export const KEEP_DAILY_MS = 30 * 24 * 3600 * 1000;

export function versionSummary(project: Project): VersionSummary {
	return {
		folios: project.folios.length,
		devices: listDevices(project).filter((d) => !d.terminal).length
	};
}

/**
 * Contenu comparé pour savoir si le dossier a changé : le document sans sa date de
 * modification (elle change à chaque geste, même annulé).
 */
export function versionContent(project: Project): string {
	return JSON.stringify({ ...project, meta: { ...project.meta, modifiedAt: '' } });
}

/** Faut-il une version automatique à cet enregistrement ? */
export function shouldAutoVersion(
	last: { createdAt: string; hash: string } | undefined,
	hash: string,
	now: number,
	interval = AUTO_INTERVAL_MS
): boolean {
	if (!last) return true;
	if (last.hash === hash) return false;
	return now - Date.parse(last.createdAt) >= interval;
}

/** Indices de révision ajoutés entre deux états du dossier. */
export function addedRevisions(before: Project | null, after: Project): Project['revisions'] {
	const known = new Set((before?.revisions ?? []).map((r) => r.indice.trim()));
	return after.revisions.filter((r) => r.indice.trim() && !known.has(r.indice.trim()));
}

/** Clé de jour local (AAAA-MM-JJ) d'une date ISO. */
const dayKey = (iso: string) => {
	const d = new Date(iso);
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Versions automatiques à supprimer (les nommées sont toujours conservées). */
export function versionsToPrune(
	versions: { id: string; kind: VersionKind; createdAt: string }[],
	now: number
): string[] {
	const out: string[] = [];
	const keptDays = new Set<string>();
	// Du plus récent au plus ancien : la première rencontrée d'un jour est la dernière du jour.
	const autos = versions
		.filter((v) => v.kind === 'auto')
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	for (const v of autos) {
		const age = now - Date.parse(v.createdAt);
		if (age <= KEEP_ALL_MS) continue;
		const day = dayKey(v.createdAt);
		if (age <= KEEP_DAILY_MS && !keptDays.has(day)) {
			keptDays.add(day);
			continue;
		}
		out.push(v.id);
	}
	return out;
}

/** Restauration : administrateur, ou utilisateur intervenu sur le dossier (jamais un lecteur). */
export function canRestore(
	user: { id: string; role: Role },
	contributors: Iterable<string>
): boolean {
	if (canEdit(user.role) === false) return false;
	if (isAdmin(user.role)) return true;
	for (const id of contributors) if (id === user.id) return true;
	return false;
}

export interface DuplicateOptions {
	name: string;
	affaireNumber?: string;
	planNumber?: string;
	client?: string;
	/**
	 * Affaire de la copie : absente = celle de la source, '' = aucune (non classé). Une
	 * affaire impose ensuite client et n° WhySoft (voir `applyAffaire`).
	 */
	affaireId?: string;
	/** Vider les indices de révision (nouveau dossier à l'indice initial). */
	resetRevisions?: boolean;
	author?: string;
}

/** Copie d'un dossier pour une nouvelle affaire (document seul : l'historique ne suit pas). */
export function duplicateDocument(
	source: Project,
	opts: DuplicateOptions,
	now = new Date()
): Project {
	const doc = JSON.parse(JSON.stringify(source)) as Project;
	const iso = now.toISOString();
	doc.meta.name = opts.name.trim() || `${source.meta.name} (copie)`;
	if (opts.affaireNumber !== undefined) doc.meta.affaireNumber = opts.affaireNumber.trim();
	if (opts.planNumber !== undefined) doc.meta.planNumber = opts.planNumber.trim();
	if (opts.client !== undefined) doc.meta.client = opts.client.trim();
	if (opts.author) doc.meta.author = opts.author;
	if (opts.affaireId !== undefined) {
		if (opts.affaireId) doc.meta.affaireId = opts.affaireId;
		else delete doc.meta.affaireId;
	}
	doc.meta.createdAt = iso;
	doc.meta.modifiedAt = iso;
	if (opts.resetRevisions) doc.revisions = [];
	return doc;
}
