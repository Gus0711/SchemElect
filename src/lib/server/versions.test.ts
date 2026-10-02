import { describe, expect, it } from 'vitest';
import { addSymbol } from '$lib/model/edit';
import { createProject } from '$lib/model/project';
import { contentHash, packDocument, unpackDocument } from './versions';

describe('versions : stockage', () => {
	it('compresse et relit le document à l’identique', () => {
		const p = createProject('Chaufferie');
		for (let i = 0; i < 40; i++)
			addSymbol(p, p.folios[0], 'bobine-contacteur', { x: 20 + i * 5, y: 50 });
		const packed = packDocument(p);
		expect(packed.length).toBeLessThan(JSON.stringify(p).length / 3);
		expect(unpackDocument(packed)).toEqual(p);
	});

	it('empreinte : identique sans changement réel, différente sinon', () => {
		const p = createProject('A');
		const h = contentHash(p);
		p.meta.modifiedAt = '2030-01-01T00:00:00Z';
		expect(contentHash(p)).toBe(h);
		p.meta.client = 'Client';
		expect(contentHash(p)).not.toBe(h);
	});
});
