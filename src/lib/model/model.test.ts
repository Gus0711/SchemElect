import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analysis';
import {
	addBar,
	addSymbol,
	addWire,
	deleteItems,
	dragWireEnd,
	moveItems,
	moveWireSegment,
	setSymbolTag
} from './edit';
import { duplicateFolio, extractFragment, insertFragment } from './fragments';
import { folioRef } from './layout';
import { createProject } from './project';
import { symbolTerminals } from './symbolGeometry';
import { nextFreeTag, parseTag } from './tags';

function setup() {
	const project = createProject('Test');
	const folio = project.folios[0];
	return { project, folio };
}

describe('tags', () => {
	it('parse et incrémente', () => {
		expect(parseTag('KM12')).toEqual({ prefix: 'KM', num: 12 });
		expect(nextFreeTag('KM', ['KM1', 'KM3', 'Q1'])).toBe('KM4');
		expect(nextFreeTag('H', [])).toBe('H1');
	});
});

describe('appareils et renvois croisés', () => {
	it('crée un repère automatique par préfixe', () => {
		const { project, folio } = setup();
		const a = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		const b = addSymbol(project, folio, 'bobine-contacteur', { x: 150, y: 50 });
		expect(project.devices[a.deviceId].tag).toBe('KM1');
		expect(project.devices[b.deviceId].tag).toBe('KM2');
	});

	it('rattache un contact à une bobine en tapant son repère', () => {
		const { project, folio } = setup();
		const coil = addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 100 });
		const contact = addSymbol(project, folio, 'contact-no', { x: 50, y: 50 });
		expect(setSymbolTag(project, contact, 'KM1')).toBe('linked');
		expect(contact.deviceId).toBe(coil.deviceId);
		// l'appareil orphelin du contact a disparu
		expect(Object.keys(project.devices)).toHaveLength(1);

		const refs = analyzeProject(project).crossRefs;
		expect(refs.get(contact.id)?.refs).toEqual([folioRef(0, 200)]);
		expect(refs.get(coil.id)?.table?.no).toEqual([folioRef(0, 50)]);
	});

	it('renomme un appareil entier', () => {
		const { project, folio } = setup();
		const coil = addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 100 });
		expect(setSymbolTag(project, coil, 'KM9')).toBe('renamed');
		expect(project.devices[coil.deviceId].tag).toBe('KM9');
	});
});

describe('connectivité et numérotation', () => {
	it('numérote les fils hors potentiel et colore ceux reliés à une barre', () => {
		const { project, folio } = setup();
		addBar(folio, 'L1', 30);
		const h = addSymbol(project, folio, 'voyant', { x: 100, y: 60 });
		const [x1, x2] = symbolTerminals(h);
		const w1 = addWire(folio, [{ x: 100, y: 30 }, x1])!;
		const w2 = addWire(folio, [x2, { x: 100, y: 100 }])!;
		const a = analyzeProject(project);
		expect(a.wireStyle.get(w1.id)?.stroke).toBe(
			project.potentials.find((p) => p.id === 'L1')!.stroke
		);
		expect(a.wireStyle.get(w1.id)?.number).toBeUndefined();
		expect(a.wireStyle.get(w2.id)?.number).toBe('01');
		// Jonction dessinée au départ sur la barre
		expect(a.nets.junctions.get(folio.id)).toContainEqual({ x: 100, y: 30 });
	});

	it('une dérivation en T relie deux fils', () => {
		const { project, folio } = setup();
		const w1 = addWire(folio, [
			{ x: 50, y: 50 },
			{ x: 150, y: 50 }
		])!;
		const w2 = addWire(folio, [
			{ x: 100, y: 50 },
			{ x: 100, y: 80 }
		])!;
		const a = analyzeProject(project);
		expect(a.nets.netOfWire.get(w1.id)).toBe(a.nets.netOfWire.get(w2.id));
		expect(a.nets.junctions.get(folio.id)).toContainEqual({ x: 100, y: 50 });
	});

	it('les renvois de même repère relient deux folios', () => {
		const { project } = setup();
		const f1 = project.folios[0];
		project.folios.push({
			...f1,
			id: 'f2',
			symbols: [],
			wires: [],
			bars: [],
			texts: [],
			rects: []
		});
		const f2 = project.folios[1];
		const out = addSymbol(project, f1, 'renvoi-sortie', { x: 100, y: 100 });
		const inn = addSymbol(project, f2, 'renvoi-entree', { x: 60, y: 40 });
		setSymbolTag(project, inn, project.devices[out.deviceId].tag);
		const wa = addWire(f1, [
			{ x: 100, y: 60 },
			{ x: 100, y: 100 }
		])!;
		const wb = addWire(f2, [
			{ x: 60, y: 40 },
			{ x: 60, y: 90 }
		])!;
		const a = analyzeProject(project);
		expect(a.wireStyle.get(wa.id)?.number).toBe(a.wireStyle.get(wb.id)?.number);
		expect(a.crossRefs.get(out.id)?.refs).toEqual([folioRef(1, 60)]);
	});
});

describe('édition', () => {
	it('le fil suit la borne en restant orthogonal', () => {
		const pts = dragWireEnd(
			[
				{ x: 0, y: 0 },
				{ x: 0, y: 20 }
			],
			1,
			{ x: 10, y: 20 }
		);
		for (let i = 0; i < pts.length - 1; i++)
			expect(pts[i].x === pts[i + 1].x || pts[i].y === pts[i + 1].y).toBe(true);
		expect(pts[pts.length - 1]).toEqual({ x: 10, y: 20 });
	});

	it('déplacer un symbole entraîne les fils raccordés', () => {
		const { project, folio } = setup();
		const h = addSymbol(project, folio, 'voyant', { x: 100, y: 60 });
		const [x1] = symbolTerminals(h);
		const w = addWire(folio, [{ x: 100, y: 30 }, x1])!;
		moveItems(folio, [{ kind: 'symbol', id: h.id }], 5, 0);
		expect(w.points[w.points.length - 1]).toEqual({ x: 105, y: 60 });
		expect(w.points[0]).toEqual({ x: 100, y: 30 });
	});

	it('déplacer un segment garde les extrémités', () => {
		const pts = moveWireSegment(
			[
				{ x: 0, y: 0 },
				{ x: 0, y: 20 }
			],
			0,
			5,
			0
		);
		expect(pts[0]).toEqual({ x: 0, y: 0 });
		expect(pts[pts.length - 1]).toEqual({ x: 0, y: 20 });
		expect(pts).toContainEqual({ x: 5, y: 0 });
	});

	it('supprimer le dernier symbole supprime l’appareil', () => {
		const { project, folio } = setup();
		const h = addSymbol(project, folio, 'voyant', { x: 100, y: 60 });
		deleteItems(project, folio, [{ kind: 'symbol', id: h.id }]);
		expect(Object.keys(project.devices)).toHaveLength(0);
	});
});

describe('fragments', () => {
	it('copier/coller renumérote en gardant les liens', () => {
		const { project, folio } = setup();
		const coil = addSymbol(project, folio, 'bobine-contacteur', { x: 100, y: 50 });
		const c = addSymbol(project, folio, 'contact-no', { x: 60, y: 50 });
		setSymbolTag(project, c, 'KM1');
		const frag = extractFragment(project, folio, [
			{ kind: 'symbol', id: coil.id },
			{ kind: 'symbol', id: c.id }
		]);
		const refs = insertFragment(project, folio, frag, { devices: 'renumber' });
		const pasted = folio.symbols.filter((s) => refs.some((r) => r.id === s.id));
		expect(new Set(pasted.map((s) => project.devices[s.deviceId].tag))).toEqual(new Set(['KM2']));
	});

	it('duplique un folio', () => {
		const { project, folio } = setup();
		addSymbol(project, folio, 'voyant', { x: 100, y: 50 });
		const copy = duplicateFolio(project, folio.id)!;
		expect(project.folios[1]).toBe(copy);
		expect(project.devices[copy.symbols[0].deviceId].tag).toBe('H2');
	});
});

describe('alignement et contrôle des contacts', () => {
	it('aligne des symboles sur l’axe du premier, fils compris', async () => {
		const { alignItems, distributeItems } = await import('./edit');
		const { project, folio } = setup();
		const a = addSymbol(project, folio, 'voyant', { x: 50, y: 50 });
		const b = addSymbol(project, folio, 'voyant', { x: 62.5, y: 100 });
		const [, bx2] = symbolTerminals(b);
		const w = addWire(folio, [bx2, { x: 62.5, y: 150 }])!;
		alignItems(
			folio,
			[
				{ kind: 'symbol', id: a.id },
				{ kind: 'symbol', id: b.id }
			],
			'axis'
		);
		expect(b.x).toBe(50);
		expect(w.points[0]).toEqual({ x: 50, y: 115 });

		const c = addSymbol(project, folio, 'voyant', { x: 90, y: 50 });
		const d = addSymbol(project, folio, 'voyant', { x: 150, y: 50 });
		distributeItems(
			folio,
			[a, c, d].map((s) => ({ kind: 'symbol' as const, id: s.id })),
			'horizontal'
		);
		expect(c.x).toBe(100);
	});

	it('signale un contact de trop sur une bobine', async () => {
		const { contactOverflows } = await import('./crossrefs');
		const { project, folio } = setup();
		const coil = addSymbol(project, folio, 'bobine-contacteur', { x: 200, y: 100 });
		project.devices[coil.deviceId].contacts = { no: 1, nc: 0 };
		for (const x of [50, 70])
			setSymbolTag(project, addSymbol(project, folio, 'contact-no', { x, y: 50 }), 'KM1');
		const a = analyzeProject(project);
		expect(a.crossRefs.get(coil.id)?.usage).toMatchObject({
			no: 2,
			overflowNo: true,
			overflowNc: false
		});
		expect(contactOverflows(project, a.crossRefs)).toHaveLength(1);
	});
});

describe('navigation entre renvois', () => {
	it('renvoi → renvoi jumeau, contact → bobine, bobine → contacts', async () => {
		const { crossTargets } = await import('./crossrefs');
		const { addFolio } = await import('./edit');
		const { project, folio } = setup();
		const f2 = addFolio(project, 0, 'F2');
		const out = addSymbol(project, folio, 'renvoi-sortie', { x: 100, y: 100 });
		const inn = addSymbol(project, f2, 'renvoi-entree', { x: 60, y: 40 });
		setSymbolTag(project, inn, project.devices[out.deviceId].tag);
		expect(crossTargets(project, out.id)).toEqual([
			{ symbolId: inn.id, ref: folioRef(1, 60), kind: 'renvoi' }
		]);

		const coil = addSymbol(project, f2, 'bobine-contacteur', { x: 150, y: 80 });
		const c = addSymbol(project, folio, 'contact-no', { x: 40, y: 60 });
		setSymbolTag(project, c, project.devices[coil.deviceId].tag);
		expect(crossTargets(project, c.id).map((t) => t.symbolId)).toEqual([coil.id]);
		expect(crossTargets(project, coil.id).map((t) => t.kind)).toEqual(['contact']);
	});
});

describe('sections des fils', () => {
	it('fil imposé > potentiel > défaut du dossier ; affichage réglable', () => {
		const project = createProject('Sections');
		const folio = project.folios[0];
		addBar(folio, 'L1', 30);
		const h = addSymbol(project, folio, 'voyant', { x: 100, y: 60 });
		const [x1, x2] = symbolTerminals(h);
		const pw = addWire(folio, [{ x: 100, y: 30 }, x1])!;
		const cw = addWire(folio, [x2, { x: 100, y: 100 }])!;

		// Rien de réglé : pas de section.
		let a = analyzeProject(project);
		expect(a.wireStyle.get(cw.id)?.section).toBeUndefined();

		project.settings.wireSection = '0.75';
		project.potentials.find((p) => p.id === 'L1')!.section = '2,5';
		a = analyzeProject(project);
		expect(a.nets.netOfWire.get(pw.id)?.section).toBe('2,5');
		expect(a.wireStyle.get(pw.id)?.section).toBe('2,5²');
		expect(a.wireStyle.get(cw.id)?.section).toBe('0,75²');
		expect(a.nets.netOfWire.get(cw.id)?.sectionImposed).toBe(false);

		// Section imposée sur un fil : toute l'équipotentielle.
		cw.section = '1,5';
		project.settings.sectionDisplay = 'imposed';
		a = analyzeProject(project);
		expect(a.wireStyle.get(cw.id)?.section).toBe('1,5²');
		expect(a.wireStyle.get(pw.id)?.section).toBeUndefined();

		project.settings.sectionDisplay = 'none';
		expect(analyzeProject(project).wireStyle.get(cw.id)?.section).toBeUndefined();
		// Texte libre conservé tel quel.
		cw.section = '2x1,5';
		project.settings.sectionDisplay = 'all';
		expect(analyzeProject(project).wireStyle.get(cw.id)?.section).toBe('2x1,5');
	});
});
