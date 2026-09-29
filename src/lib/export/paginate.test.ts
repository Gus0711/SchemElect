import { describe, expect, it } from 'vitest';
import type { StripRow, TerminalStrip } from '$lib/model/strips';
import { ellipsize, paginateGroups, wrapText } from './paginate';
import {
	paginateStrips,
	STRIP_CAPACITY,
	STRIP_GAP_LINES,
	STRIP_HEADER_LINES,
	stripRowHeight
} from './stripsTable';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('paginateGroups', () => {
	it('rien à paginer → aucune page', () => {
		expect(paginateGroups([], { capacity: 10, header: 2 })).toEqual([]);
		expect(paginateGroups([{ key: 'A', items: [] }], { capacity: 10, header: 2 })).toEqual([]);
	});

	it('plusieurs petits groupes sur une page, avec espace entre blocs', () => {
		const pages = paginateGroups(
			[
				{ key: 'A', items: range(3) },
				{ key: 'B', items: range(2) }
			],
			{ capacity: 20, header: 2, gap: 1 }
		);
		expect(pages).toHaveLength(1);
		expect(pages[0].map((b) => [b.key, b.items.length, b.continued])).toEqual([
			['A', 3, false],
			['B', 2, false]
		]);
	});

	it('coupe un groupe trop long et marque la suite', () => {
		const pages = paginateGroups([{ key: 'P', items: range(25) }], { capacity: 12, header: 2 });
		expect(pages.map((p) => p[0].items.length)).toEqual([10, 10, 5]);
		expect(pages.map((p) => p[0].continued)).toEqual([false, true, true]);
		expect(pages.flatMap((p) => p[0].items)).toEqual(range(25));
	});

	it('ne laisse pas un en-tête seul en bas de page', () => {
		const pages = paginateGroups(
			[
				{ key: 'A', items: range(7) },
				{ key: 'B', items: range(3) }
			],
			{ capacity: 10, header: 2, gap: 1 }
		);
		// A : 2 + 7 = 9 ; B demanderait 1 + 2 + 1 = 4 → page suivante
		expect(pages.map((p) => p.map((b) => b.key))).toEqual([['A'], ['B']]);
		expect(pages[1][0].continued).toBe(false);
	});

	it('respecte le poids des éléments ; un élément trop haut est posé seul', () => {
		const pages = paginateGroups([{ key: 'A', items: [3, 3, 20, 1] }], {
			capacity: 10,
			header: 2,
			weight: (n) => n
		});
		expect(pages.map((p) => p[0].items)).toEqual([[3, 3], [20], [1]]);
	});

	it('toutes les pages tiennent dans la capacité', () => {
		const groups = range(6).map((g) => ({ key: `G${g}`, items: range(3 + g * 7) }));
		const opts = { capacity: 30, header: 2, gap: 1 };
		for (const page of paginateGroups(groups, opts)) {
			const used = page.reduce(
				(a, b, i) => a + (i ? opts.gap : 0) + opts.header + b.items.length,
				0
			);
			expect(used).toBeLessThanOrEqual(opts.capacity);
		}
	});
});

describe('wrapText / ellipsize', () => {
	it('coupe aux espaces', () => {
		// 10 caractères par ligne
		expect(wrapText('KM1:A1, KM2:A1, H1:X1', 10, 1, 1)).toEqual(['KM1:A1,', 'KM2:A1,', 'H1:X1']);
		expect(wrapText('', 10, 1, 1)).toEqual([]);
	});
	it('coupe les mots trop longs', () => {
		expect(wrapText('ABCDEFGHIJKL', 5, 1, 1)).toEqual(['ABCDE', 'FGHIJ', 'KL']);
	});
	it('tronque avec points de suspension', () => {
		expect(ellipsize('COURT', 10, 1, 1)).toBe('COURT');
		expect(ellipsize('PUISSANCE POMPES', 10, 1, 1)).toBe('PUISSANCE…');
	});
});

describe('paginateStrips', () => {
	const row = (i: number, inside: string[] = []): StripRow => ({
		symbolId: `s${i}`,
		tag: `P${i}`,
		wire: String(i).padStart(2, '0'),
		inside,
		outside: [],
		cable: [],
		position: '01 - B',
		designation: ''
	});

	it('une ligne par borne, plusieurs lignes si les raccordements débordent', () => {
		expect(stripRowHeight(row(1, ['KM1:1']))).toBe(1);
		const many = Array.from({ length: 20 }, (_, i) => `KM${i + 1}:A1`);
		expect(stripRowHeight(row(1, many))).toBeGreaterThan(1);
	});

	it('pagine les borniers', () => {
		const strips: TerminalStrip[] = [
			{ prefix: 'C', rows: range(5).map((i) => row(i + 1)) },
			{ prefix: 'P', rows: range(STRIP_CAPACITY * 2).map((i) => row(i + 1)) },
			{ prefix: 'X', rows: [] }
		];
		const pages = paginateStrips(strips);
		expect(pages.length).toBe(3);
		expect(pages[0].map((b) => b.key)).toEqual(['C', 'P']);
		expect(pages[0][1].items.length).toBe(
			STRIP_CAPACITY - 2 * STRIP_HEADER_LINES - STRIP_GAP_LINES - 5
		);
		expect(pages[1][0].continued).toBe(true);
		expect(
			pages
				.flat()
				.filter((b) => b.key === 'P')
				.flatMap((b) => b.items)
		).toHaveLength(STRIP_CAPACITY * 2);
	});
});
