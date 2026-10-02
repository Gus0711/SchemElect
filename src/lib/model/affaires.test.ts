import { describe, expect, it } from 'vitest';
import {
	affaireTitle,
	applyAffaire,
	detachAffaire,
	nameKey,
	normalizeAffaire,
	normalizeClient,
	planClassification,
	type Affaire,
	type Client
} from './affaires';
import { createProject } from './project';
import { fieldValue } from './template';

const client: Client = {
	id: 'c1',
	name: 'Collège Jean Moulin',
	code: '',
	city: '',
	source: 'manual'
};
const affaire: Affaire = {
	id: 'a1',
	clientId: 'c1',
	whysoft: 'WS-2026-0042',
	number: '',
	label: 'Chaufferie',
	year: 2026,
	status: 'en_cours',
	source: 'manual'
};

describe('affaires', () => {
	it('nameKey ignore accents, casse et espaces', () => {
		expect(nameKey('  Collège   JEAN moulin ')).toBe('college jean moulin');
	});

	it('valide clients et affaires', () => {
		expect(normalizeClient({ name: '  ' })).toBeNull();
		expect(normalizeClient({ name: ' ACME ', city: 'Laon' })).toEqual({
			name: 'ACME',
			code: '',
			city: 'Laon'
		});
		expect(normalizeAffaire({ clientId: 'c1' })).toBeNull();
		expect(normalizeAffaire({ whysoft: 'WS1' })).toBeNull();
		const a = normalizeAffaire(
			{ clientId: 'c1', whysoft: 'WS1', year: 'x', status: 'bad' },
			new Date('2025-05-01')
		);
		expect(a).toMatchObject({ whysoft: 'WS1', year: 2025, status: 'en_cours', label: '' });
		expect(
			normalizeAffaire({ clientId: 'c1', label: 'L', status: 'archivee', year: 2020 })
		).toMatchObject({
			status: 'archivee',
			year: 2020
		});
	});

	it('affaireTitle', () => {
		expect(affaireTitle(affaire)).toBe('WS-2026-0042 · Chaufferie');
		expect(affaireTitle({ whysoft: '', number: '', label: '' })).toBe('Affaire sans titre');
	});

	it('rattacher impose client et n° WhySoft au cartouche', () => {
		const p = createProject('Armoire');
		p.meta.client = 'ancien';
		p.meta.affaireNumber = 'A12';
		expect(applyAffaire(p.meta, affaire, client)).toBe(true);
		expect(p.meta).toMatchObject({
			affaireId: 'a1',
			client: client.name,
			whysoft: 'WS-2026-0042',
			affaireNumber: 'A12'
		});
		expect(fieldValue(p, 'whysoft', { folioIndex: 0 })).toBe('WS-2026-0042');
		expect(applyAffaire(p.meta, affaire, client)).toBe(false);
		applyAffaire(p.meta, { ...affaire, number: 'B7' }, client);
		expect(p.meta.affaireNumber).toBe('B7');
		detachAffaire(p.meta);
		expect(p.meta.affaireId).toBeUndefined();
		expect(p.meta.client).toBe(client.name);
	});

	it('reprise de l’existant : un client par nom, une affaire par numéro', () => {
		const plan = planClassification(
			[
				{
					id: 'p1',
					client: 'Collège Jean Moulin',
					affaireNumber: 'WS-2026-0042',
					createdAt: '2026-01-01'
				},
				{ id: 'p2', client: 'COLLEGE JEAN MOULIN', affaireNumber: 'A99', createdAt: '2026-02-01' },
				{ id: 'p3', client: 'Hôpital', affaireNumber: 'H1', createdAt: '2024-03-01' },
				{ id: 'p4', client: 'hopital', affaireNumber: 'h1', createdAt: '2024-04-01' },
				{ id: 'p5', client: '', affaireNumber: 'X', createdAt: '2024-04-01' },
				{ id: 'p6', client: 'Y', affaireNumber: ' ', createdAt: '2024-04-01' }
			],
			[client],
			[affaire]
		);
		expect(plan.skipped).toEqual(['p5', 'p6']);
		expect(plan.clients).toEqual([{ key: 'new:hopital', name: 'Hôpital' }]);
		expect(plan.affaires.map((a) => [a.client, a.number, a.year])).toEqual([
			['c1', 'A99', 2026],
			['new:hopital', 'H1', 2024]
		]);
		expect(plan.assign).toEqual([
			{ projectId: 'p1', affaire: 'a1' },
			{ projectId: 'p2', affaire: 'new:c1|a99' },
			{ projectId: 'p3', affaire: 'new:new:hopital|h1' },
			{ projectId: 'p4', affaire: 'new:new:hopital|h1' }
		]);
	});
});
