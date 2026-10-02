/**
 * Mise en page des folios « LISTE DE COMMANDE » : un bloc par fabricant, colonnes, césure,
 * pagination. Pur (sans DOM) : partagé par OrderPage.svelte et l'export PDF.
 */
import {
	formatQuantity,
	SOURCE_LABEL,
	type OrderGroup,
	type OrderLine
} from '$lib/model/orderList';
import { schematic } from '$lib/theme/schematic';
import { paginateGroups, wrapText, type Page } from './paginate';
import { STRIP_CAPACITY, STRIP_GAP_LINES, STRIP_HEADER_LINES, STRIP_PAD } from './stripsTable';

export const ORDER_TITLE = 'LISTE DE COMMANDE';

export const ORDER_COLUMNS = [
	{ key: 'reference', label: 'Référence', width: 40 },
	{ key: 'designation', label: 'Désignation', width: 100 },
	{ key: 'quantity', label: 'Qté', width: 14 },
	{ key: 'unit', label: 'Unité', width: 18 },
	{ key: 'source', label: 'Origine', width: 19 },
	{ key: 'detail', label: 'Précision', width: 80 }
] as const;

export function orderCellTexts(line: OrderLine): string[] {
	return [
		line.reference || 'À compléter',
		line.designation,
		formatQuantity(line.quantity),
		line.unit,
		SOURCE_LABEL[line.source],
		line.detail
	];
}

export function orderRowLines(line: OrderLine): string[][] {
	const size = schematic.text.table.cell;
	return orderCellTexts(line).map((t, i) =>
		wrapText(t, ORDER_COLUMNS[i].width - 2 * STRIP_PAD, size, schematic.charWidth)
	);
}

export function orderRowHeight(line: OrderLine): number {
	return Math.max(1, ...orderRowLines(line).map((l) => l.length));
}

export type OrderPage = Page<OrderLine>;

export function paginateOrder(groups: OrderGroup[]): OrderPage[] {
	return paginateGroups(
		groups.filter((g) => g.lines.length).map((g) => ({ key: g.manufacturer, items: g.lines })),
		{
			capacity: STRIP_CAPACITY,
			header: STRIP_HEADER_LINES,
			gap: STRIP_GAP_LINES,
			weight: orderRowHeight
		}
	);
}
