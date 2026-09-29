import { describe, expect, it } from 'vitest';
import { validateTemplate } from './templates';

describe('bibliothèque des modèles', () => {
	it('refuse le modèle standard, les modèles trop lourds ; accepte un modèle partiel', () => {
		expect(validateTemplate({ id: 'defaut', name: 'Standard' })).toBeNull();
		expect(
			validateTemplate({ id: 't', name: 'Lourd', logo: `data:image/png;base64,${'A'.repeat(3e6)}` })
		).toBeNull();
		expect(validateTemplate({ id: 't', name: 'OK' })?.name).toBe('OK');
	});
});
