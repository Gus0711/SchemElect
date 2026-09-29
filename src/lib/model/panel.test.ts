import { describe, expect, it } from 'vitest';
import { addFolio, addPanelFolio, addSymbol, deleteItems, itemBounds, moveItems } from './edit';
import { deviceFootprint, stripWidth } from './footprints';
import { duplicateFolio } from './fragments';
import {
	addMount,
	addRailAt,
	autoPlace,
	autoScale,
	generateLayout,
	itemsOutside,
	overlappingItems,
	packRail,
	panelCandidates,
	panelIssues,
	panelTransform,
	railFill,
	railOf,
	settleOnRails,
	syncPanels
} from './panel';
import { createProject, migrateProject } from './project';

function setup() {
	const project = createProject('Armoire');
	const schema = project.folios[0];
	return { project, schema };
}

function withDevices() {
	const { project, schema } = setup();
	const q1 = addSymbol(project, schema, 'disjoncteur-2p', { x: 50, y: 40 });
	const km1 = addSymbol(project, schema, 'bobine-contacteur', { x: 80, y: 40 });
	// Pôles de KM1 : même appareil, pas de doublon à placer.
	const poles = addSymbol(project, schema, 'poles-contacteur-3p', { x: 100, y: 40 });
	poles.deviceId = km1.deviceId;
	const h1 = addSymbol(project, schema, 'voyant', { x: 120, y: 40 });
	const s1 = addSymbol(project, schema, 'commutateur-a-m', { x: 140, y: 40 });
	const m1 = addSymbol(project, schema, 'moteur-mono', { x: 160, y: 40 });
	addSymbol(project, schema, 'borne-c', { x: 170, y: 40 });
	addSymbol(project, schema, 'borne-c', { x: 175, y: 40 });
	addSymbol(project, schema, 'borne-c', { x: 180, y: 40 });
	return { project, schema, q1, km1, h1, s1, m1 };
}

describe('implantation : création et échelle', () => {
	it('crée un folio d’implantation avec rails et goulottes', () => {
		const { project } = setup();
		const f = addPanelFolio(project, 0, 'implantation');
		expect(f.panel?.kind).toBe('implantation');
		expect(f.panel?.enclosure).toEqual({ w: 600, h: 1000, d: 250 });
		// 1000 mm de haut → 4 rails ; 2 goulottes verticales + 5 horizontales.
		expect(f.panel?.rails).toHaveLength(4);
		expect(f.panel?.ducts).toHaveLength(7);
		expect(f.symbols).toHaveLength(0);
	});

	it('répartit les rails au milieu des bandes entre goulottes', () => {
		const { project } = setup();
		const f = addPanelFolio(project, 0, 'implantation');
		generateLayout(f.panel!, { rails: 2, ductW: 40, sideW: 60, depth: 80 });
		// bande = (1000 - 3×40) / 2 = 440 → axes à 40 + 220 et 520 + 220.
		expect(f.panel!.rails.map((r) => r.y)).toEqual([260, 740]);
		expect(f.panel!.rails[0]).toMatchObject({ x: 60, length: 480 });
	});

	it('choisit une échelle normalisée qui tient sur la page', () => {
		expect(autoScale({ w: 600, h: 1000, d: 250 })).toBe(6);
		expect(autoScale({ w: 400, h: 500, d: 200 })).toBe(4);
		expect(autoScale({ w: 800, h: 2000, d: 400 })).toBe(12.5);
	});

	it('la façade reprend les dimensions de l’armoire existante', () => {
		const { project } = setup();
		const impl = addPanelFolio(project, 0, 'implantation');
		impl.panel!.enclosure = { w: 800, h: 1200, d: 300 };
		const fac = addPanelFolio(project, 1, 'facade');
		expect(fac.panel?.enclosure).toEqual({ w: 800, h: 1200, d: 300 });
		expect(fac.panel?.rails).toHaveLength(0);
	});

	it('un folio de schéma ajouté après une armoire reprend les barres du dernier schéma', () => {
		const { project, schema } = setup();
		schema.bars.push({ id: 'b1', potentialId: 'N', y: 30, x1: 20, x2: 280 });
		addPanelFolio(project, 0, 'implantation');
		const f = addFolio(project, 1);
		expect(f.bars).toHaveLength(1);
	});
});

describe('implantation : appareils', () => {
	it('déduit encombrement et montage du symbole', () => {
		const { project, q1, km1, h1, m1 } = withDevices();
		expect(deviceFootprint(project, q1.deviceId)).toMatchObject({ mounting: 'rail', w: 36 });
		expect(deviceFootprint(project, km1.deviceId)).toMatchObject({ mounting: 'rail', w: 45 });
		expect(deviceFootprint(project, h1.deviceId).mounting).toBe('porte');
		expect(deviceFootprint(project, m1.deviceId).mounting).toBe('externe');
		project.devices[m1.deviceId].mounting = 'rail';
		expect(deviceFootprint(project, m1.deviceId).mounting).toBe('rail');
	});

	it('liste les appareils et borniers à placer, sans doublon', () => {
		const { project } = withDevices();
		const c = panelCandidates(project, 'implantation');
		const rail = c.filter((x) => x.mounting === 'rail').map((x) => x.tag);
		expect(rail).toEqual(expect.arrayContaining(['Q1', 'KM1', 'Bornier C']));
		expect(rail).toHaveLength(3);
		const strip = c.find((x) => x.strip === 'C')!;
		expect(strip.w).toBe(stripWidth(3));
		expect(
			c
				.filter((x) => x.mounting === 'porte')
				.map((x) => x.tag)
				.sort()
		).toEqual(['H1', 'S1']);
	});

	it('accroche un appareil au rail proche et calcule le remplissage', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		const panel = f.panel!;
		const rail = panel.rails[0];
		const q1 = panelCandidates(project, 'implantation').find((c) => c.tag === 'Q1')!;
		const item = addMount(panel, q1, { x: rail.x + 30, y: rail.y + 12 });
		expect(item.y).toBe(rail.y);
		expect(railOf(panel, item)).toBe(rail);
		const fill = railFill(panel)[0];
		expect(fill.used).toBe(36);
		expect(fill.overflow).toBe(false);
		// Posé loin d'un rail : reste libre.
		const km = panelCandidates(project, 'implantation').find((c) => c.tag === 'KM1')!;
		const free = addMount(panel, km, { x: 300, y: rail.y + 80 });
		expect(railOf(panel, free)).toBeUndefined();
	});

	it('range automatiquement par type, rail après rail', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		const res = autoPlace(project, f);
		expect(res).toEqual({ placed: 3, remaining: [] });
		const panel = f.panel!;
		// 4 rails pour 3 familles : protection, commande, borniers — un rail chacune.
		const tags = railFill(panel).map((r) =>
			r.items.map((it) => project.devices[it.deviceId ?? '']?.tag ?? it.strip)
		);
		expect(tags).toEqual([['Q1'], ['KM1'], ['C'], []]);
		for (const r of railFill(panel).slice(0, 3))
			expect(r.items[0].x - r.items[0].w / 2).toBe(r.rail.x);
		// Relancer ne repose rien.
		expect(autoPlace(project, f).placed).toBe(0);
	});

	it('à la suite sur le même rail quand il n’y a pas assez de rails', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		generateLayout(f.panel!, { rails: 2, ductW: 40, sideW: 40, depth: 80 });
		autoPlace(project, f);
		const panel = f.panel!;
		const [a, b, c] = railFill(panel)[0].items;
		expect(c).toBeDefined();
		expect(a.x - a.w / 2).toBe(panel.rails[0].x);
		expect(b.x - b.w / 2).toBeCloseTo(a.x + a.w / 2);
		expect(overlappingItems(panel).size).toBe(0);
	});

	it('signale les rails trop pleins et les appareils qui ne trouvent pas de place', () => {
		const { project, schema } = setup();
		for (let i = 0; i < 20; i++) addSymbol(project, schema, 'disjoncteur-4p', { x: 20 + i, y: 40 });
		const f = addPanelFolio(project, 1, 'implantation');
		generateLayout(f.panel!, { rails: 1, ductW: 40, sideW: 40, depth: 80 });
		const res = autoPlace(project, f);
		// Rail de 520 mm : 7 disjoncteurs 4P de 72 mm.
		expect(res.placed).toBe(7);
		expect(res.remaining).toHaveLength(13);
		const panel = f.panel!;
		panel.items[6].x += 30;
		expect(railFill(panel)[0].overflow).toBe(true);
		expect(overlappingItems(panel).size).toBe(0);
		panel.items[1].x = panel.items[0].x + 10;
		expect(overlappingItems(panel).has(panel.items[0].id)).toBe(true);
		panel.items[2].x = -100;
		settleOnRails(panel, [panel.items[2].id]);
		expect(itemsOutside(panel).has(panel.items[2].id)).toBe(true);
	});

	it('déplacer un rail déplace les appareils posés dessus', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		autoPlace(project, f);
		const panel = f.panel!;
		const rail = panel.rails[0];
		const t = panelTransform(panel);
		const onRail = railFill(panel)[0].items;
		const others = panel.items.filter((it) => !onRail.includes(it));
		const before = onRail.map((it) => it.y);
		const othersBefore = others.map((it) => it.y);
		expect(onRail.length).toBeGreaterThan(0);
		// 10 mm réels = 10 × k mm de page.
		moveItems(f, [{ kind: 'rail', id: rail.id }], 0, 10 * t.k);
		expect(onRail.map((it) => it.y)).toEqual(before.map((y) => y + 10));
		expect(others.map((it) => it.y)).toEqual(othersBefore);
		const b = itemBounds(f, { kind: 'rail', id: rail.id })!;
		expect(b.w).toBeCloseTo(rail.length * t.k);
	});

	it('pose un rail entre les goulottes verticales', () => {
		const { project } = setup();
		const f = addPanelFolio(project, 0, 'implantation');
		const r = addRailAt(f.panel!, 300, 500);
		expect(r).toMatchObject({ x: 40, length: 520, y: 500 });
		const r2 = addRailAt(f.panel!, 100, 520, 250);
		expect(r2).toMatchObject({ x: 100, length: 150 });
	});

	it('la largeur d’un bornier suit le nombre de bornes', () => {
		const { project, schema } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		autoPlace(project, f);
		const strip = f.panel!.items.find((it) => it.strip === 'C')!;
		expect(strip.w).toBe(stripWidth(3));
		addSymbol(project, schema, 'borne-c', { x: 185, y: 40 });
		syncPanels(project);
		expect(strip.w).toBe(stripWidth(4));
	});

	it('supprimer le symbole retire l’appareil de l’implantation', () => {
		const { project, schema, q1 } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		autoPlace(project, f);
		expect(f.panel!.items.some((it) => it.deviceId === q1.deviceId)).toBe(true);
		deleteItems(project, schema, [{ kind: 'symbol', id: q1.id }]);
		expect(f.panel!.items.some((it) => it.deviceId === q1.deviceId)).toBe(false);
	});

	it('dupliquer un folio d’armoire garde la disposition, pas les appareils', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		autoPlace(project, f);
		const copy = duplicateFolio(project, f.id)!;
		expect(copy.panel?.rails).toHaveLength(f.panel!.rails.length);
		expect(copy.panel?.rails[0].id).not.toBe(f.panel!.rails[0].id);
		expect(copy.panel?.items).toHaveLength(0);
	});

	it('relit un projet avec folio d’armoire', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'facade');
		autoPlace(project, f);
		const back = migrateProject(JSON.parse(JSON.stringify(project)));
		expect(back.folios[1].panel?.items).toHaveLength(2);
	});
});

describe('façade', () => {
	it('place voyants puis commutateurs, une rangée par folio du schéma, titrée', () => {
		const { project, schema, h1, s1 } = withDevices();
		schema.title = 'CHAUDIÈRE 1';
		const f = addPanelFolio(project, 1, 'facade');
		const res = autoPlace(project, f);
		expect(res.placed).toBe(2);
		const [a, b] = f.panel!.items;
		expect(a.deviceId).toBe(h1.deviceId);
		expect(b.deviceId).toBe(s1.deviceId);
		expect(a.y).toBe(b.y);
		expect(b.x).toBeGreaterThan(a.x);
		expect(f.texts.map((t) => t.text)).toEqual(['CHAUDIÈRE 1']);
	});
});

describe('rails : serrer', () => {
	it('serre les appareils d’un rail à gauche dans leur ordre', () => {
		const { project } = withDevices();
		const f = addPanelFolio(project, 1, 'implantation');
		generateLayout(f.panel!, { rails: 1, ductW: 40, sideW: 40, depth: 80 });
		autoPlace(project, f);
		const panel = f.panel!;
		const [a, b] = railFill(panel)[0].items;
		a.x += 100;
		packRail(panel, panel.rails[0].id);
		const items = railFill(panel)[0].items.sort((x, y) => x.x - y.x);
		expect(items[0]).toBe(b);
		expect(items[0].x - items[0].w / 2).toBe(panel.rails[0].x);
		expect(overlappingItems(panel).size).toBe(0);
	});
});

describe('contrôles des folios d’armoire', () => {
	it('signale les appareils à placer puis les rails pleins', () => {
		const { project } = withDevices();
		expect(panelIssues(project)).toEqual([]);
		const f = addPanelFolio(project, 1, 'implantation');
		expect(panelIssues(project).map((i) => i.text)).toEqual([
			expect.stringMatching(/^3 appareil\(s\) à placer en implantation/)
		]);
		autoPlace(project, f);
		expect(panelIssues(project)).toEqual([]);
		f.panel!.rails[1].length = 20;
		expect(panelIssues(project)[0].text).toMatch(/rail 2 trop plein/);
	});
});
