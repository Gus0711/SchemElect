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
	/** Appareils qui appellent cette référence comme accessoire (embase de KA1…). */
	accessoryOf: string[];
	/** Faux pour les appareils sans référence (à compléter). */
	referenced: boolean;
}

/** Colonne « Repères » : « KA1 à KA4 », « accessoire de KA1 à KA4 », ou les deux. */
export function bomTagsText(line: BomLine): string {
	const own = compressTags(line.tags);
	const acc = line.accessoryOf.length ? `accessoire de ${compressTags(line.accessoryOf)}` : '';
	return [own, acc].filter(Boolean).join(' + ');
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

/**
 * Nomenclature du dossier (bornes comprises : elles se commandent aussi). Les accessoires
 * des fiches catalogue (embases, blocs additifs…) sont ajoutés : quantité × nombre
 * d'appareils, regroupés avec la même référence si elle est aussi dessinée.
 */
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
			accessoryOf: [],
			referenced: true
		});
	}

	// Accessoires appelés par les fiches des appareils.
	const byKey = new Map(lines.map((l) => [l.key, l]));
	for (const list of referenced.values())
		for (const e of list)
			for (const a of e.catalog?.accessories ?? []) {
				const key = referenceKey(a.reference);
				let line = byKey.get(key);
				if (!line) {
					const fiche = project.catalog?.[key];
					line = {
						key,
						reference: fiche?.reference ?? a.reference,
						manufacturer: fiche?.manufacturer ?? '',
						designation: fiche?.designation || 'Accessoire',
						category: fiche?.category ?? '',
						quantity: 0,
						tags: [],
						accessoryOf: [],
						referenced: true
					};
					byKey.set(key, line);
					lines.push(line);
				}
				line.quantity += a.quantity;
				if (!line.accessoryOf.includes(e.tag)) line.accessoryOf.push(e.tag);
			}

	const firstTag = (l: BomLine) => l.tags[0] ?? l.accessoryOf[0] ?? '';
	// Un accessoire seul se range juste après son appareil.
	lines.sort(
		(a, b) =>
			compareTags(firstTag(a), firstTag(b)) || Number(!a.tags.length) - Number(!b.tags.length)
	);

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
			accessoryOf: [],
			referenced: false
		});
	}
	rest.sort((a, b) => compareTags(firstTag(a), firstTag(b)));
	return [...lines, ...rest];
}
