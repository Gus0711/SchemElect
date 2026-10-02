import { describe, expect, it } from 'vitest';
import { validatePref } from './prefs';

describe('préférences utilisateur', () => {
	it('refuse les clés inconnues, normalise les favoris', () => {
		expect(validatePref('inconnue', ['a'])).toBeNull();
		expect(validatePref('favoriteSymbols', 'pas une liste')).toBeNull();
		expect(validatePref('favoriteSymbols', ['a', 'a', 'b'])).toEqual(['a', 'b']);
	});
});
