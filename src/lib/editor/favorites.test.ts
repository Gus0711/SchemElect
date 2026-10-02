import { describe, expect, it } from 'vitest';
import { getSymbolDef, hasSymbolDef } from '$lib/symbols';
import {
	DEFAULT_FAVORITES,
	MAX_FAVORITES,
	moveFavorite,
	normalizeFavorites,
	toggleFavorite
} from './favorites';

describe('symboles favoris', () => {
	it('les favoris par défaut existent dans la bibliothèque', () => {
		for (const id of DEFAULT_FAVORITES) expect(hasSymbolDef(id), id).toBe(true);
		expect(getSymbolDef('contact-no').name).toBeTruthy();
	});

	it('ajoute, retire, déplace', () => {
		expect(toggleFavorite(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
		expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
		expect(moveFavorite(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
		expect(moveFavorite(['a', 'b', 'c'], 'x', 0)).toEqual(['a', 'b', 'c']);
	});

	it('normalise ce qui vient du serveur', () => {
		expect(normalizeFavorites(null)).toBeNull();
		expect(normalizeFavorites(['a', 'a', 3, '', 'b'])).toEqual(['a', 'b']);
		const many = Array.from({ length: 40 }, (_, i) => `s${i}`);
		expect(normalizeFavorites(many)).toHaveLength(MAX_FAVORITES);
	});
});
