import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, normalizeGrid } from './grid';

describe('réglages de la grille', () => {
	it('valeurs par défaut si rien n’est enregistré', () => {
		expect(normalizeGrid(null)).toEqual(DEFAULT_GRID);
		expect(normalizeGrid('abîmé')).toEqual(DEFAULT_GRID);
	});

	it('garde les réglages valides, corrige les autres', () => {
		expect(
			normalizeGrid({ show: false, kind: 'cases', step: 10, opacity: 0.3, print: true })
		).toEqual({ show: false, kind: 'cases', step: 10, opacity: 0.3, print: true });
		const g = normalizeGrid({ kind: 'hexagones', step: 7, opacity: 5 });
		expect(g.kind).toBe('points');
		expect(g.step).toBe(5);
		expect(g.opacity).toBe(1);
		expect(normalizeGrid({ opacity: 0 }).opacity).toBe(0.1);
	});
});
