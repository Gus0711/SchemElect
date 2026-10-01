/**
 * Mise en page des folios « NOMENCLATURE » : colonnes, césure des cellules, pagination.
 * Pur (sans DOM) : partagé par BomPage.svelte (rendu) et l'export PDF (nombre de pages).
 */
import { compressTags, type BomLine } from '$lib/model/nomenclature';
import { schematic } from '$lib/theme/schematic';
import { paginateGroups, wrapText, type Page } from './paginate';
import { STRIP_CAPACITY, STRIP_HEADER_LINES, STRIP_PAD } from './stripsTable';

export const BOM_TITLE = 'NOMENCLATURE';

export const BOM_COLUMNS = [
	{ key: 'quantity', label: 'Qté', width: 12 },
	{ key: 'reference', label: 'Référence', width: 40 },
	{ key: 'manufacturer', label: 'Fabricant', width: 34 },
	{ key: 'designation', label: 'Désignation', width: 100 },
	{ key: 'tags', label: 'Repères', width: 85 }
] as const;

export function bomCellTexts(line: BomLine): string[] {
	return [
		String(line.quantity),
		line.reference || 'À compléter',
		line.manufacturer,
		line.designation,
		compressTags(line.tags)
	];
}

export function bomRowLines(line: BomLine): string[][] {
	const size = schematic.text.table.cell;
	return bomCellTexts(line).map((t, i) =>
		wrapText(t, BOM_COLUMNS[i].width - 2 * STRIP_PAD, size, schematic.charWidth)
	);
}

export function bomRowHeight(line: BomLine): number {
	return Math.max(1, ...bomRowLines(line).map((l) => l.length));
}

export type BomPage = Page<BomLine>;

export function paginateBom(lines: BomLine[]): BomPage[] {
	if (!lines.length) return [];
	return paginateGroups([{ key: 'Nomenclature', items: lines }], {
		capacity: STRIP_CAPACITY,
		header: STRIP_HEADER_LINES,
		weight: bomRowHeight
	});
}
