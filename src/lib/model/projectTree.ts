/**
 * Page Projets : regroupement Client › Affaire › Schémas et filtres (année, client, statut,
 * recherche). Pur et testé ; la page n'a qu'à afficher l'arbre.
 */
import { nameKey, type Affaire, type AffaireStatus } from './affaires';

export interface TreeProject {
	id: string;
	name: string;
	affaireNumber: string;
	affaireId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TreeAffaire extends Affaire {
	clientName: string;
}

/** Statut filtré : statut d'affaire, ou schémas non classés. */
export type StatusFilter = AffaireStatus | 'non_classe' | '';

export interface ProjectFilters {
	query?: string;
	clientId?: string;
	year?: number | null;
	status?: StatusFilter;
}

export interface AffaireNode<P extends TreeProject = TreeProject> {
	affaire: TreeAffaire;
	projects: P[];
	/** Dernière modification d'un de ses schémas (ou création de l'affaire si vide). */
	updatedAt: string;
}

export interface ClientNode<P extends TreeProject = TreeProject> {
	clientId: string;
	clientName: string;
	affaires: AffaireNode<P>[];
}

export interface ProjectTree<P extends TreeProject = TreeProject> {
	clients: ClientNode<P>[];
	/** Schémas sans affaire (« Non classé »). */
	unclassified: P[];
	/** Nombre de schémas affichés. */
	count: number;
}

/** Année d'un schéma : celle de son affaire, sinon de sa création. */
export function projectYear(p: TreeProject, affaire?: Pick<Affaire, 'year'> | null): number {
	return affaire?.year ?? new Date(p.createdAt).getFullYear();
}

const byRecent = (a: { updatedAt: string }, b: { updatedAt: string }) =>
	b.updatedAt.localeCompare(a.updatedAt);

/**
 * Arbre filtré. Recherche : nom du schéma, n° d'affaire, n° WhySoft, client, désignation
 * (sans accents ni casse) ; une affaire qui correspond garde tous ses schémas. Les affaires
 * sans schéma ne sont montrées que si un filtre les vise (client, recherche) ou si
 * `withEmpty` est vrai.
 */
export function buildProjectTree<P extends TreeProject>(
	projects: P[],
	affaires: TreeAffaire[],
	filters: ProjectFilters = {},
	withEmpty = true
): ProjectTree<P> {
	const q = nameKey(filters.query ?? '');
	const hit = (...texts: string[]) => !q || texts.some((t) => nameKey(t).includes(q));
	const status = filters.status ?? '';
	const year = filters.year ?? null;

	const byAffaire = new Map<string, P[]>();
	const unclassified: P[] = [];
	const known = new Set(affaires.map((a) => a.id));
	for (const p of projects) {
		if (p.affaireId && known.has(p.affaireId)) {
			const list = byAffaire.get(p.affaireId) ?? [];
			list.push(p);
			byAffaire.set(p.affaireId, list);
		} else unclassified.push(p);
	}

	const clients = new Map<string, ClientNode<P>>();
	let count = 0;
	if (status !== 'non_classe')
		for (const a of affaires) {
			if (status && a.status !== status) continue;
			if (filters.clientId && a.clientId !== filters.clientId) continue;
			if (year !== null && a.year !== year) continue;
			const all = byAffaire.get(a.id) ?? [];
			const affaireHit = hit(a.whysoft, a.number, a.label, a.clientName);
			const shown = affaireHit ? all : all.filter((p) => hit(p.name, p.affaireNumber));
			if (!shown.length && (!affaireHit || (!withEmpty && !q))) continue;
			shown.sort(byRecent);
			const node: AffaireNode<P> = {
				affaire: a,
				projects: shown,
				updatedAt: shown[0]?.updatedAt ?? ''
			};
			const c = clients.get(a.clientId) ?? {
				clientId: a.clientId,
				clientName: a.clientName,
				affaires: []
			};
			c.affaires.push(node);
			clients.set(a.clientId, c);
			count += shown.length;
		}

	const loose =
		!status || status === 'non_classe'
			? filters.clientId
				? []
				: unclassified.filter(
						(p) => (year === null || projectYear(p) === year) && hit(p.name, p.affaireNumber)
					)
			: [];
	loose.sort(byRecent);
	count += loose.length;

	const sorted = [...clients.values()].sort((a, b) =>
		nameKey(a.clientName).localeCompare(nameKey(b.clientName))
	);
	// Affaires d'un client : la plus récente d'abord (année, puis activité).
	for (const c of sorted)
		c.affaires.sort(
			(a, b) => b.affaire.year - a.affaire.year || b.updatedAt.localeCompare(a.updatedAt)
		);
	return { clients: sorted, unclassified: loose, count };
}

/** Années proposées dans le filtre (affaires et schémas non classés), la plus récente d'abord. */
export function treeYears(projects: TreeProject[], affaires: Pick<Affaire, 'year'>[]): number[] {
	const years = new Set<number>(affaires.map((a) => a.year));
	for (const p of projects) if (!p.affaireId) years.add(projectYear(p));
	return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}
