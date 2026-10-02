import { describe, expect, it } from 'vitest';
import { analyzeProject } from '$lib/model/analysis';
import { computeOrderList, groupByManufacturer } from '$lib/model/orderList';
import { BOM, orderCsv } from './csv';
import { planDossier } from './dossier';
import { paginateOrder } from './orderTable';
import { buildSampleArmoire } from './sampleArmoire';

const lines = (csv: string) => csv.slice(BOM.length).trimEnd().split('\r\n');

describe('liste de commande : export', () => {
	const project = buildSampleArmoire();
	project.orderExtras = [
		{
			id: 'x',
			reference: 'PE-M20',
			manufacturer: 'Legrand',
			designation: 'Presse-étoupe',
			quantity: 4
		}
	];

	it('CSV groupé par fabricant', () => {
		const l = lines(orderCsv(project));
		expect(l[0]).toBe('Fabricant;Référence;Désignation;Quantité;Unité;Origine;Précision');
		expect(l.some((x) => x.startsWith('Legrand;PE-M20;Presse-étoupe;4;pce;Divers'))).toBe(true);
		// L'exemple a un folio d'implantation : rails et goulottes calculés.
		expect(l.some((x) => x.includes('Rail oméga') && x.includes('barre 2 m'))).toBe(true);
		expect(l.some((x) => x.includes(';Goulotte '))).toBe(true);
		// Les lignes sans référence sont en fin de liste.
		const first = l.findIndex((x) => x.startsWith('À compléter'));
		expect(l.slice(first).every((x) => x.startsWith('À compléter'))).toBe(true);
	});

	it('pages en fin de dossier, après la nomenclature', () => {
		const analysis = analyzeProject(project);
		const plan = planDossier(project, analysis, {
			cover: true,
			strips: false,
			nomenclature: true,
			orderList: true
		});
		expect(plan.orderPages.length).toBeGreaterThan(0);
		const titles = plan.entries.map((e) => e.title);
		expect(titles.indexOf('LISTE DE COMMANDE')).toBeGreaterThan(titles.indexOf('NOMENCLATURE'));
		expect(planDossier(project, analysis, {}).orderPages).toHaveLength(0);
		const groups = groupByManufacturer(computeOrderList(project));
		expect(paginateOrder(groups).flatMap((p) => p.flatMap((b) => b.items))).toHaveLength(
			groups.reduce((n, g) => n + g.lines.length, 0)
		);
	});
});
