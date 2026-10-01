import { describe, expect, it } from 'vitest';
import { analyzeProject } from '$lib/model/analysis';
import { assignReference } from '$lib/model/catalog';
import { computeNomenclature, type BomLine } from '$lib/model/nomenclature';
import { BOM, nomenclatureCsv } from './csv';
import { paginateBom } from './bomTable';
import { planDossier } from './dossier';
import { buildSampleProject } from './sample';

const lines = (csv: string) => csv.slice(BOM.length).trimEnd().split('\r\n');

describe('nomenclature : export', () => {
	const project = buildSampleProject();
	const firstDevice = Object.values(project.devices).find((d) => d.tag.startsWith('KM'))!;
	assignReference(project, firstDevice.id, 'LC1D09B7', [
		{
			id: 'c',
			reference: 'LC1D09B7',
			manufacturer: 'Schneider Electric',
			designation: 'Contacteur 9 A'
		}
	]);

	it('CSV : en-tête, références puis « À compléter »', () => {
		const l = lines(nomenclatureCsv(project));
		expect(l[0]).toBe('Quantité;Référence;Fabricant;Désignation;Catégorie;Repères');
		expect(l.find((x) => x.includes('LC1D09B7'))).toMatch(
			/^1;LC1D09B7;Schneider Electric;Contacteur 9 A;/
		);
		// Les appareils sans référence sont en fin de liste.
		const firstMissing = l.findIndex((x) => x.includes('À compléter'));
		expect(firstMissing).toBeGreaterThan(1);
		expect(l.slice(firstMissing).every((x) => x.includes('À compléter'))).toBe(true);
	});

	it('pages en fin de dossier, numérotées après les borniers', () => {
		const analysis = analyzeProject(project);
		const plan = planDossier(project, analysis, { cover: true, strips: true, nomenclature: true });
		expect(plan.bomPages).toHaveLength(1);
		expect(plan.entries.at(-1)).toEqual({ number: '04', title: 'NOMENCLATURE' });
		expect(plan.totalPages).toBe(5);
		expect(planDossier(project, analysis, {}).bomPages).toHaveLength(0);
	});

	it('pagination : une longue nomenclature continue sur la page suivante', () => {
		const many: BomLine[] = Array.from({ length: 200 }, (_, i) => ({
			key: `k${i}`,
			reference: `REF${i}`,
			manufacturer: 'X',
			designation: 'Article',
			category: '',
			quantity: 1,
			tags: [`Q${i}`],
			accessoryOf: [],
			referenced: true
		}));
		const pages = paginateBom(many);
		expect(pages.length).toBeGreaterThan(1);
		expect(pages[1][0].continued).toBe(true);
		expect(pages.flatMap((p) => p[0].items)).toHaveLength(200);
		expect(paginateBom(computeNomenclature({ ...project, folios: [] }))).toEqual([]);
	});
});
