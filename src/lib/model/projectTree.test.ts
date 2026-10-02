import { describe, expect, it } from 'vitest';
import { buildProjectTree, treeYears, type TreeAffaire, type TreeProject } from './projectTree';

const aff = (id: string, clientId: string, clientName: string, extra: Partial<TreeAffaire> = {}) =>
	({
		id,
		clientId,
		clientName,
		whysoft: `WS-${id}`,
		number: '',
		label: '',
		year: 2026,
		status: 'en_cours',
		source: 'manual',
		...extra
	}) as TreeAffaire;

const proj = (id: string, affaireId: string | null, updatedAt: string, name = id): TreeProject => ({
	id,
	name,
	affaireNumber: '',
	affaireId,
	createdAt: updatedAt,
	updatedAt
});

const affaires = [
	aff('a1', 'c2', 'Hôpital', { label: 'Chaufferie', year: 2025 }),
	aff('a2', 'c1', 'Collège', { year: 2026 }),
	aff('a3', 'c1', 'Collège', { year: 2024, status: 'archivee' }),
	aff('a4', 'c1', 'Collège', { year: 2026, label: 'Vide' })
];
const projects = [
	proj('p1', 'a1', '2026-03-01', 'Armoire TGBT'),
	proj('p2', 'a2', '2026-05-01', 'Armoire CTA'),
	proj('p3', 'a2', '2026-06-01', 'Armoire chaufferie'),
	proj('p4', 'a3', '2024-01-01'),
	proj('p5', null, '2023-01-01', 'Ancien dossier'),
	proj('p6', 'inconnue', '2026-01-01')
];

describe('page Projets : arbre Client › Affaire › Schémas', () => {
	it('regroupe par client (alphabétique), affaire (récente) et schéma (récent)', () => {
		const t = buildProjectTree(projects, affaires);
		expect(t.clients.map((c) => c.clientName)).toEqual(['Collège', 'Hôpital']);
		expect(t.clients[0].affaires.map((a) => a.affaire.id)).toEqual(['a2', 'a4', 'a3']);
		expect(t.clients[0].affaires[0].projects.map((p) => p.id)).toEqual(['p3', 'p2']);
		// Affaire inconnue : non classé.
		expect(t.unclassified.map((p) => p.id)).toEqual(['p6', 'p5']);
		expect(t.count).toBe(6);
	});

	it('filtres statut, client, année', () => {
		const archived = buildProjectTree(projects, affaires, { status: 'archivee' });
		expect(archived.clients.flatMap((c) => c.affaires.map((a) => a.affaire.id))).toEqual(['a3']);
		expect(archived.unclassified).toEqual([]);
		const loose = buildProjectTree(projects, affaires, { status: 'non_classe' });
		expect(loose.clients).toEqual([]);
		expect(loose.count).toBe(2);
		const college = buildProjectTree(projects, affaires, { clientId: 'c1' });
		expect(college.clients.map((c) => c.clientId)).toEqual(['c1']);
		expect(college.unclassified).toEqual([]);
		const y2023 = buildProjectTree(projects, affaires, { year: 2023 });
		expect(y2023.clients).toEqual([]);
		expect(y2023.unclassified.map((p) => p.id)).toEqual(['p5']);
	});

	it('recherche : n° WhySoft, client, nom du schéma', () => {
		const ws = buildProjectTree(projects, affaires, { query: 'ws-a1' });
		expect(ws.count).toBe(1);
		expect(ws.clients[0].affaires[0].projects[0].id).toBe('p1');
		const client = buildProjectTree(projects, affaires, { query: 'hopital' });
		expect(client.clients.map((c) => c.clientName)).toEqual(['Hôpital']);
		const name = buildProjectTree(projects, affaires, { query: 'cta' });
		expect(name.clients[0].affaires.map((a) => a.projects.map((p) => p.id))).toEqual([['p2']]);
		const old = buildProjectTree(projects, affaires, { query: 'ancien' });
		expect(old.unclassified.map((p) => p.id)).toEqual(['p5']);
		// Affaire vide trouvée par sa désignation.
		expect(
			buildProjectTree(projects, affaires, { query: 'vide' }).clients[0].affaires
		).toHaveLength(1);
	});

	it('affaires vides masquées sur demande', () => {
		const t = buildProjectTree(projects, affaires, {}, false);
		expect(t.clients[0].affaires.map((a) => a.affaire.id)).toEqual(['a2', 'a3']);
	});

	it('années du filtre', () => {
		expect(treeYears(projects, affaires)).toEqual([2026, 2025, 2024, 2023]);
	});
});
