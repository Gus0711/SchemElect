import { describe, expect, it } from 'vitest';
import { GRID } from '$lib/model/geometry';
import { graphicsBounds } from './helpers';
import { SYMBOLS } from './index';

const onGrid = (v: number) => Math.abs(v / GRID - Math.round(v / GRID)) < 1e-6;
/** Tolérance pour l'épaisseur de trait / arrondis. */
const TOL = 0.3;

describe('bibliothèque de symboles', () => {
	it('contient des symboles', () => {
		expect(SYMBOLS.length).toBeGreaterThan(110);
	});

	it('ids uniques en kebab-case', () => {
		const ids = SYMBOLS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});

	describe.each(SYMBOLS.map((s) => [s.id, s] as const))('%s', (_id, s) => {
		it('bornes sur la grille 2,5 mm', () => {
			for (const t of s.terminals) {
				expect(onGrid(t.x), `${t.id} x=${t.x}`).toBe(true);
				expect(onGrid(t.y), `${t.id} y=${t.y}`).toBe(true);
			}
		});

		it('ids de bornes uniques', () => {
			const ids = s.terminals.map((t) => t.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it('bornes et graphisme inclus dans bounds', () => {
			const b = s.bounds;
			for (const t of s.terminals) {
				expect(t.x >= b.x - 1e-6 && t.x <= b.x + b.w + 1e-6, `${t.id} x`).toBe(true);
				expect(t.y >= b.y - 1e-6 && t.y <= b.y + b.h + 1e-6, `${t.id} y`).toBe(true);
			}
			const g = graphicsBounds(s.graphics);
			if (g.w || g.h) {
				expect(g.x).toBeGreaterThanOrEqual(b.x - TOL);
				expect(g.y).toBeGreaterThanOrEqual(b.y - TOL);
				expect(g.x + g.w).toBeLessThanOrEqual(b.x + b.w + TOL);
				expect(g.y + g.h).toBeLessThanOrEqual(b.y + b.h + TOL);
			}
		});

		it('rôle et préfixe cohérents', () => {
			if (s.role === 'slave') expect(s.contactKind).toBeDefined();
			if (s.role !== 'decor') expect(s.prefix.trim()).not.toBe('');
			expect(s.name.trim()).not.toBe('');
			expect(s.category.trim()).not.toBe('');
		});

		it('ponts entre bornes existantes', () => {
			const ids = new Set(s.terminals.map((t) => t.id));
			const missing = (s.bridges ?? []).flat().filter((id) => !ids.has(id));
			expect(missing).toEqual([]);
		});
	});
});
