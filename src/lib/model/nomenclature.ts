/**
 * Nomenclature par référence : une ligne par référence constructeur (quantité, repères,
 * fabricant, désignation commerciale), puis les appareils sans référence regroupés par
 * préfixe. Pure : partagée par l'export CSV, le PDF et l'éditeur.
 */
import { referenceKey } from './catalog';
import { listDevices, type DeviceEntry } from './inventory';
import { compareTags, parseTag } from './tags';
import type { Project } from './types';

export interface BomLine {
	key: string;
	reference: string;
	manufacturer: string;
	/** Désignation commerciale (fiche catalogue), sinon nom du symbole. */
	designation: string;
	category: string;
	quantity: number;
	tags: string[];
	/** Faux pour les appareils sans référence (à compléter). */
	referenced: boolean;
}

/**
 * Repères compactés : « KA1 à KA4, KA7 » (une suite d'au moins 3 numéros consécutifs
 * de même préfixe est abrégée).
 */
export function compressTags(tags: string[]): string {
	const sorted = [...new Set(tags)].sort(compareTags);
	const parts: string[] = [];
	let i = 0;
	while (i < sorted.length) {
		const a = parseTag(sorted[i]);
		let j = i;
		while (j + 1 < sorted.length) {
			const b = parseTag(sorted[j + 1]);
			const c = parseTag(sorted[j]);
			if (b.prefix !== a.prefix || a.num === null || b.num === null || b.num !== (c.num ?? 0) + 1)
				break;
			j++;
		}
		if (j - i >= 2) parts.push(`${sorted[i]} à ${sorted[j]}`);
		else for (let k = i; k <= j; k++) parts.push(sorted[k]);
		i = j + 1;
	}
	return parts.join(', ');
}

/** Nomenclature du dossier (bornes comprises : elles se commandent aussi). */
export function computeNomenclature(project: Project): BomLine[] {
	const entries = listDevices(project);
	const referenced = new Map<string, DeviceEntry[]>();
	const missing = new Map<string, DeviceEntry[]>();
	for (const e of entries) {
		const ref = e.reference.trim();
		const map = ref ? referenced : missing;
		const key = ref ? referenceKey(ref) : `${e.terminal ? 'X' : 'A'}:${e.prefix}`;
		const list = map.get(key) ?? [];
		list.push(e);
		map.set(key, list);
	}

	const lines: BomLine[] = [];
	for (const [key, list] of referenced) {
		const first = list[0];
		const cat = first.catalog;
		const manufacturers = [...new Set(list.map((e) => e.manufacturer).filter(Boolean))];
		lines.push({
			key,
			reference: cat?.reference ?? first.reference.trim(),
			manufacturer: cat?.manufacturer || manufacturers.join(' / '),
			designation: cat?.designation || first.symbolName,
			category: cat?.category ?? first.family,
			quantity: list.length,
			tags: list.map((e) => e.tag),
			referenced: true
		});
	}
	const byFirstTag = (a: BomLine, b: BomLine) => compareTags(a.tags[0] ?? '', b.tags[0] ?? '');
	lines.sort(byFirstTag);

	const rest: BomLine[] = [];
	for (const [key, list] of missing) {
		const names = [...new Set(list.map((e) => e.symbolName))];
		rest.push({
			key,
			reference: '',
			manufacturer: '',
			designation: list[0].terminal ? `Bornes ${list[0].prefix}` : names.join(' / '),
			category: list[0].family,
			quantity: list.length,
			tags: list.map((e) => e.tag),
			referenced: false
		});
	}
	rest.sort(byFirstTag);
	return [...lines, ...rest];
}
