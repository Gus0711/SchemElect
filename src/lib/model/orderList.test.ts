import { describe, expect, it } from 'vitest';
import { assignReference, linkReference, type CatalogItem } from './catalog';
import { addPanelFolio, addSymbol } from './edit';
import {
	computeOrderList,
	ductSize,
	groupByManufacturer,
	NO_MANUFACTURER,
	TO_COMPLETE
} from './orderList';
import { createProject, migrateProject } from './project';
import type { CableItem } from './types';

const LIB: CatalogItem[] = [
	{
		id: 'r',
		reference: 'RXM4AB2B7',
		manufacturer: 'Schneider Electric',
		designation: 'Relais 4 OF',
		accessories: [{ reference: 'RXZE2S114M', quantity: 1 }]
	},
	{ id: 'e', reference: 'RXZE2S114M', manufacturer: 'Schneider Electric', designation: 'Embase' },
	{
		id: 'rail',
		reference: 'NSYSDR200',
		manufacturer: 'Schneider Electric',
		designation: 'Rail 2 m'
	},
	{ id: 'b', reference: '1201442', manufacturer: 'Phoenix Contact', designation: 'Butée E/UK' }
];

const cable = (tag: string, extra: Partial<CableItem> = {}): CableItem => ({
	id: tag,
	tag,
	x: 0,
	y: 0,
	length: 20,
	type: 'U1000 R2V',
	pairs: false,
	colors: ['Bleu', 'Marron', 'Vert/Jaune'],
	section: '1,5',
	...extra
});

function build() {
	const project = createProject('Commande');
	const folio = project.folios[0];
	const k1 = addSymbol(project, folio, 'bobine-relais', { x: 100, y: 50 });
	const k2 = addSymbol(project, folio, 'bobine-relais', { x: 150, y: 50 });
	assignReference(project, k1.deviceId, 'RXM4AB2B7', LIB);
	assignReference(project, k2.deviceId, 'RXM4AB2B7', LIB);
	addSymbol(project, folio, 'voyant', { x: 200, y: 50 });
	for (const x of [40, 50]) addSymbol(project, folio, 'borne-p', { x, y: 150 });
	addSymbol(project, folio, 'borne-c', { x: 60, y: 150 });
	folio.cables.push(cable('W1', { cableLength: 12 }), cable('W2', { cableLength: 3.5 }));
	folio.cables.push(
		cable('W3', { type: 'SYT1', pairs: true, colors: ['Ciel', 'Jaune'], section: '8/10' })
	);
	const impl = addPanelFolio(project, 0, 'implantation');
	project.materials = { rail: 'NSYSDR200' };
	linkReference(project, 'NSYSDR200', LIB);
	project.orderExtras = [
		{
			id: 'x1',
			reference: 'PE-M20',
			manufacturer: 'Legrand',
			designation: 'Presse-étoupe M20',
			quantity: 4
		}
	];
	return { project, impl };
}

describe('liste de commande', () => {
	it('appareils, accessoires, armoire, borniers, câbles, lignes libres', () => {
		const { project, impl } = build();
		const lines = computeOrderList(project);
		const by = (k: string) => lines.find((l) => l.key.startsWith(k) || l.reference === k);

		expect(by('RXM4AB2B7')).toMatchObject({ quantity: 2, unit: 'pce', source: 'appareil' });
		expect(by('RXZE2S114M')?.detail).toBe('accessoire de KA1, KA2');

		const e = impl.panel!.enclosure;
		expect(by('armoire:enveloppe')).toMatchObject({
			designation: `Armoire ${e.w} × ${e.h} × ${e.d} mm`,
			reference: '',
			quantity: 1
		});
		const railMm = impl.panel!.rails.reduce((a, r) => a + r.length, 0);
		expect(by('NSYSDR200')).toMatchObject({
			quantity: Math.ceil(railMm / 2000),
			unit: 'barre 2 m',
			manufacturer: 'Schneider Electric',
			designation: 'Rail 2 m'
		});
		const sizes = new Set(impl.panel!.ducts.map(ductSize));
		expect(lines.filter((l) => l.key.startsWith('armoire:goulotte:'))).toHaveLength(sizes.size);

		// 2 borniers (P, C) : 4 butées, 2 flasques.
		const clamp = lines.find((l) => l.designation.startsWith('Butée'))!;
		expect([clamp.quantity, clamp.detail]).toEqual([4, '2 par bornier (C, P)']);
		expect(lines.find((l) => l.designation.startsWith('Flasque'))?.quantity).toBe(2);

		// Câbles : même désignation regroupée, longueurs additionnées, manquantes signalées.
		const u1000 = lines.find((l) => l.designation === 'CABLE U1000 R2V 3G1,5')!;
		expect([u1000.quantity, u1000.unit, u1000.detail]).toEqual([15.5, 'm', 'W1, W2']);
		const syt = lines.find((l) => l.designation.startsWith('CABLE SYT1'))!;
		expect(syt.detail).toBe('W3 — longueur à saisir : W3');

		expect(by('PE-M20')).toMatchObject({ quantity: 4, manufacturer: 'Legrand', source: 'libre' });
	});

	it('groupe par fabricant, puis sans fabricant, puis à compléter', () => {
		const { project } = build();
		const groups = groupByManufacturer(computeOrderList(project));
		const names = groups.map((g) => g.manufacturer);
		expect(names[0]).toBe('Legrand');
		expect(names).toContain('Schneider Electric');
		expect(names.at(-1)).toBe(TO_COMPLETE);
		expect(names.indexOf(NO_MANUFACTURER)).toBe(-1);
		const se = groups.find((g) => g.manufacturer === 'Schneider Electric')!;
		// Appareils avant le matériel d'armoire.
		expect(se.lines.map((l) => l.source)).toEqual(['appareil', 'appareil', 'armoire']);
		// Voyant sans référence, armoire sans référence, câbles sans référence : à compléter.
		const todo = groups.at(-1)!.lines.map((l) => l.designation);
		expect(todo).toContain('Voyant lumineux');
		expect(todo.some((d) => d.startsWith('Armoire'))).toBe(true);
	});

	it('les fiches des références de commande restent dans le projet', () => {
		const { project } = build();
		expect(project.catalog?.NSYSDR200).toBeDefined();
		// Une autre opération de catalogue ne doit pas les retirer.
		const k = Object.values(project.devices).find((d) => d.tag === 'KA1')!;
		assignReference(project, k.id, '', LIB);
		expect(project.catalog?.NSYSDR200).toBeDefined();
		const again = migrateProject(JSON.parse(JSON.stringify(project)));
		expect(again.materials?.rail).toBe('NSYSDR200');
		expect(again.orderExtras).toHaveLength(1);
	});
});
