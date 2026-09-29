/**
 * Pagination et césure des tableaux générés (borniers, sommaire…).
 * Fonctions pures, sans DOM : testées avec Vitest.
 */

export interface Group<T> {
	key: string;
	items: T[];
}

/** Morceau d'un groupe posé sur une page. `continued` = suite d'un groupe commencé avant. */
export interface Block<T> {
	key: string;
	items: T[];
	continued: boolean;
}

export type Page<T> = Block<T>[];

export interface PaginateOptions<T> {
	/** Hauteur utile d'une page, en lignes. */
	capacity: number;
	/** Hauteur de l'en-tête d'un bloc (titre + en-têtes de colonnes), en lignes. */
	header: number;
	/** Espace entre deux blocs d'une même page, en lignes. */
	gap?: number;
	/** Hauteur d'un élément, en lignes (1 par défaut). */
	weight?: (item: T) => number;
}

/**
 * Répartit des groupes (un bornier = un groupe) sur des pages.
 * - un groupe trop long est coupé et repris sur la page suivante (`continued`) ;
 * - un en-tête n'est jamais laissé seul en bas de page ;
 * - un élément plus haut qu'une page est posé seul (débordement accepté).
 */
export function paginateGroups<T>(groups: Group<T>[], opts: PaginateOptions<T>): Page<T>[] {
	const { capacity, header } = opts;
	const gap = opts.gap ?? 0;
	const weight = opts.weight ?? (() => 1);
	const pages: Page<T>[] = [];
	let page: Page<T> = [];
	let used = 0;
	const flush = () => {
		if (page.length) pages.push(page);
		page = [];
		used = 0;
	};

	for (const group of groups) {
		let i = 0;
		let continued = false;
		while (i < group.items.length) {
			const lead = page.length ? gap : 0;
			if (page.length && used + lead + header + weight(group.items[i]) > capacity) {
				flush();
				continue;
			}
			used += lead + header;
			const block: Block<T> = { key: group.key, items: [], continued };
			page.push(block);
			while (i < group.items.length) {
				const w = weight(group.items[i]);
				if (block.items.length && used + w > capacity) break;
				block.items.push(group.items[i]);
				used += w;
				i++;
			}
			if (i < group.items.length) {
				flush();
				continued = true;
			}
		}
	}
	flush();
	return pages;
}

/**
 * Césure d'un texte sur une largeur donnée (mm), à partir d'une largeur moyenne
 * de caractère (`charWidth` × taille). Les mots trop longs sont coupés.
 */
export function wrapText(
	text: string,
	maxWidth: number,
	size: number,
	charWidth: number
): string[] {
	const maxChars = Math.max(1, Math.floor(maxWidth / (size * charWidth)));
	const lines: string[] = [];
	let cur = '';
	for (const raw of text.trim().split(/\s+/)) {
		if (!raw) continue;
		let word = raw;
		while (word.length > maxChars) {
			if (cur) {
				lines.push(cur);
				cur = '';
			}
			lines.push(word.slice(0, maxChars));
			word = word.slice(maxChars);
		}
		if (!word) continue;
		const next = cur ? `${cur} ${word}` : word;
		if (next.length > maxChars) {
			lines.push(cur);
			cur = word;
		} else cur = next;
	}
	if (cur) lines.push(cur);
	return lines;
}

/** Tronque un texte sur une seule ligne (« … » si coupé). */
export function ellipsize(text: string, maxWidth: number, size: number, charWidth: number): string {
	const maxChars = Math.max(1, Math.floor(maxWidth / (size * charWidth)));
	const t = text.trim();
	return t.length <= maxChars ? t : `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}
