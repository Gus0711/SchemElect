import { describe, expect, it } from 'vitest';
import { resolveUpsert, validateCatalogItem } from './catalog';

describe('catalogue partagé', () => {
	it('refuse une fiche sans référence', () => {
		expect(validateCatalogItem({ manufacturer: 'Schneider' })).toBeNull();
		expect(validateCatalogItem({ reference: 'LC1D09B7' })?.reference).toBe('LC1D09B7');
	});

	it('même référence = même fiche ; renommer vers une référence prise = conflit', () => {
		expect(resolveUpsert('a', undefined, undefined)).toEqual({ action: 'insert' });
		expect(resolveUpsert('a', { id: 'a' }, undefined)).toEqual({ action: 'update', id: 'a' });
		expect(resolveUpsert('a', { id: 'a' }, { id: 'a' })).toEqual({ action: 'update', id: 'a' });
		// Import (fiche inconnue) d'une référence existante : mise à jour de celle-ci.
		expect(resolveUpsert('', undefined, { id: 'b' })).toEqual({ action: 'update', id: 'b' });
		expect(resolveUpsert('a', { id: 'a' }, { id: 'b' })).toEqual({ action: 'conflict' });
	});
});
