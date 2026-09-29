/**
 * Mise en page des folios « BORNIERS » : colonnes, césure des cellules, pagination.
 * Pur (sans DOM) : partagé par StripsPage.svelte (rendu) et l'export PDF (nombre de pages).
 */
import { AREA } from '$lib/model/layout';
import type { StripRow, TerminalStrip } from '$lib/model/strips';
import { schematic } from '$lib/theme/schematic';
import { paginateGroups, wrapText, type Page } from './paginate';

export const STRIP_COLUMNS = [
	{ key: 'tag', label: 'Repère', width: 20 },
	{ key: 'wire', label: 'N° fil / potentiel', width: 32 },
	{ key: 'inside', label: 'Intérieur', width: 50 },
	{ key: 'outside', label: 'Extérieur', width: 50 },
	{ key: 'cable', label: 'Câble', width: 24 },
	{ key: 'position', label: 'Position', width: 22 },
	{ key: 'designation', label: 'Désignation', width: 73 }
] as const;

/** Marge entre la zone de dessin et le tableau (mm). */
export const STRIP_MARGIN = 3;
/** Hauteur d'une ligne de texte (mm). */
export const STRIP_LINE = 3.4;
/** Retrait du texte dans une cellule (mm). */
export const STRIP_PAD = 1;
/** En-tête d'un bornier : titre + ligne d'en-têtes de colonnes. */
export const STRIP_HEADER_LINES = 2;
export const STRIP_GAP_LINES = 1;
export const STRIP_CAPACITY = Math.floor((AREA.h - 2 * STRIP_MARGIN) / STRIP_LINE);

export function stripCellTexts(row: StripRow): string[] {
	return [
		row.tag,
		row.wire,
		row.inside.join(', '),
		row.outside.join(', '),
		row.cable.join(', '),
		row.position,
		row.designation
	];
}

/** Lignes de texte de chaque cellule d'une ligne de bornier. */
export function stripRowLines(row: StripRow): string[][] {
	const size = schematic.text.table.cell;
	return stripCellTexts(row).map((t, i) =>
		wrapText(t, STRIP_COLUMNS[i].width - 2 * STRIP_PAD, size, schematic.charWidth)
	);
}

export function stripRowHeight(row: StripRow): number {
	return Math.max(1, ...stripRowLines(row).map((l) => l.length));
}

export type StripPage = Page<StripRow>;

export function paginateStrips(strips: TerminalStrip[]): StripPage[] {
	return paginateGroups(
		strips.filter((s) => s.rows.length).map((s) => ({ key: s.prefix, items: s.rows })),
		{
			capacity: STRIP_CAPACITY,
			header: STRIP_HEADER_LINES,
			gap: STRIP_GAP_LINES,
			weight: stripRowHeight
		}
	);
}
