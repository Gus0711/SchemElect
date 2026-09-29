import { describe, expect, it } from 'vitest';
import { analyzeProject, projectStrips } from './analysis';
import {
	cableIssues,
	cableLabels,
	cableName,
	colorsToLines,
	conductorLabel,
	defaultCableColors,
	linesToColors
} from './cables';
import {
	addCable,
	addSymbol,
	addWire,
	deleteItems,
	hitTest,
	itemBounds,
	moveItems,
	rotateItems
} from './edit';
import { duplicateFolio, extractFragment, insertFragment } from './fragments';
import { createProject, migrateProject } from './project';
import { symbolTerminals } from './symbolGeometry';
import type { Point } from './types';

const p = (x: number, y: number): Point => ({ x, y });

/** Six fils verticaux (x = 60…110) coupés par un câble horizontal à y = 140. */
function setup() {
	const project = createProject('Test');
	const folio = project.folios[0];
	const wires = [60, 70, 80, 90, 100, 110].map((x) => addWire(folio, [p(x, 120), p(x, 160)])!);
	return { project, folio, wires };
}

describe('câbles : type et couleurs', () => {
	it('SYT1 : paires du dossier de référence', () => {
		const colors = defaultCableColors('SYT1', true, 6);
		expect(colorsToLines(colors, true)).toEqual(['Ciel / Jaune', 'Ciel / Blanc', 'Ciel / Bleu']);
	});

	it('nombre impair de fils → paire complète', () => {
		expect(defaultCableColors('SYT1', true, 5)).toHaveLength(6);
	});

	it('énergie : code couleur normalisé', () => {
		expect(defaultCableColors('U1000 R2V', false, 3)).toEqual(['Vert/Jaune', 'Bleu', 'Marron']);
		expect(defaultCableColors('U1000 R2V', false, 7)[0]).toBe('Vert/Jaune');
		expect(defaultCableColors('Inconnu', false, 3)).toEqual(['1', '2', '3']);
	});

	it('lignes éditables ↔ couleurs', () => {
		expect(linesToColors(['Ciel / Jaune', ' Ciel/Blanc ', ''], true)).toEqual([
			'Ciel',
			'Jaune',
			'Ciel',
			'Blanc'
		]);
		expect(linesToColors(['Rouge'], true)).toEqual(['Rouge', '2']);
		expect(linesToColors(['Bleu', 'Marron'], false)).toEqual(['Bleu', 'Marron']);
	});
});

describe('câbles : pose et conducteurs', () => {
	it('le câble prend les fils coupés comme conducteurs, dans l’ordre', () => {
		const { project, folio, wires } = setup();
		const c = addCable(project, folio, p(55, 140), p(115, 140));
		expect(c.tag).toBe('W1');
		expect(c.pairs).toBe(true);
		expect(c.colors).toHaveLength(6);
		expect(cableName(c)).toBe('CABLE SYT1 3 PAIRES');

		const a = analyzeProject(project);
		const info = a.cables.cables[0];
		expect(info.crossings.map((k) => k.wireId)).toEqual(wires.map((w) => w.id));
		expect(info.overflow).toBe(0);
		expect(conductorLabel(c, 2)).toBe('P2 Ciel');
		expect(conductorLabel(c, 3)).toBe('P2 Blanc');
	});

	it('libellés : nom + une étiquette par paire, sur son premier fil', () => {
		const { project, folio } = setup();
		const c = addCable(project, folio, p(55, 140), p(115, 140));
		const info = analyzeProject(project).cables.cables[0];
		const labels = cableLabels(c, info.crossings);
		expect(labels.map((l) => l.text)).toEqual([
			'CABLE SYT1 3 PAIRES',
			'Paire Ciel / Jaune',
			'Paire Ciel / Blanc',
			'Paire Ciel / Bleu'
		]);
		expect(labels.every((l) => l.vertical)).toBe(true);
		// Étiquette le long du fil, à sa gauche
		expect(labels[2].x).toBeLessThan(80);
		expect(labels[2].x).toBeGreaterThan(78);

		c.showColors = false;
		expect(cableLabels(c, info.crossings)).toHaveLength(1);
	});

	it('câble d’énergie sans paires : une couleur par conducteur, nom 3G1,5', () => {
		const { project, folio } = setup();
		const c = addCable(project, folio, p(55, 140), p(85, 140), 'U1000 R2V');
		c.section = '1,5';
		expect(c.pairs).toBe(false);
		expect(cableName(c)).toBe('CABLE U1000 R2V 3G1,5');
		const info = analyzeProject(project).cables.cables[0];
		expect(cableLabels(c, info.crossings).map((l) => l.text)).toEqual([
			'CABLE U1000 R2V 3G1,5',
			'Vert/Jaune',
			'Bleu',
			'Marron'
		]);
		c.name = 'ALIM POMPE';
		expect(cableName(c)).toBe('ALIM POMPE');
	});

	it('câble vertical : coupe les fils horizontaux', () => {
		const project = createProject('Test');
		const folio = project.folios[0];
		const w1 = addWire(folio, [p(40, 50), p(120, 50)])!;
		const w2 = addWire(folio, [p(40, 60), p(120, 60)])!;
		addWire(folio, [p(80, 20), p(80, 45)]); // vertical : ignoré
		addCable(project, folio, p(80, 45), p(80, 65), 'Numéroté');
		const info = analyzeProject(project).cables.cables[0];
		expect(info.cable.vertical).toBe(true);
		expect(info.crossings.map((k) => k.wireId)).toEqual([w1.id, w2.id]);
		expect(info.cable.colors).toEqual(['1', '2']);
	});

	it('contrôles : câble plein, câble vide', () => {
		const { project, folio } = setup();
		const c = addCable(project, folio, p(55, 140), p(115, 140));
		c.colors = c.colors.slice(0, 4);
		addCable(project, folio, p(150, 140), p(180, 140));
		const issues = cableIssues(analyzeProject(project).cables).map((i) => i.text);
		expect(issues).toEqual([
			'Câble W1 : 6 fils pour 4 conducteurs',
			'Câble W2 : ne coupe aucun fil'
		]);
	});
});

describe('câbles : borniers', () => {
	it('colonne « Câble » : conducteur porté par la borne', () => {
		const project = createProject('Test');
		const folio = project.folios[0];
		const c3 = addSymbol(project, folio, 'borne-c', p(60, 100));
		const c4 = addSymbol(project, folio, 'borne-c', p(70, 100));
		for (const b of [c3, c4]) {
			const [, bottom] = symbolTerminals(b);
			addWire(folio, [bottom, p(bottom.x, bottom.y + 20)]);
		}
		const bottomY = symbolTerminals(c3)[1].y;
		addCable(project, folio, p(55, bottomY + 10), p(75, bottomY + 10));
		const strip = projectStrips(project, analyzeProject(project)).find((s) => s.prefix === 'C')!;
		expect(strip.rows.map((r) => r.cable)).toEqual([['W1 P1 Ciel'], ['W1 P1 Jaune']]);
	});
});

describe('câbles : édition', () => {
	it('sélection, déplacement, rotation, suppression', () => {
		const { project, folio } = setup();
		const c = addCable(project, folio, p(55, 140), p(115, 140));
		const ref = { kind: 'cable' as const, id: c.id };
		// Clic sur l'ellipse entre deux fils, ou sur le nom
		expect(hitTest(folio, p(65, 140.5), 1)).toEqual(ref);
		expect(hitTest(folio, p(53.5, 130), 1)).toEqual(ref);
		// Clic sur un fil dans l'ellipse : c'est le fil
		expect(hitTest(folio, p(70, 140), 1)?.kind).toBe('wire');
		expect(itemBounds(folio, ref)!.w).toBeGreaterThan(60);

		moveItems(folio, [ref], 0, 5);
		expect(c.y).toBe(145);
		rotateItems(folio, [ref]);
		expect(c.vertical).toBe(true);
		expect(c.x).toBe(85);
		rotateItems(folio, [ref]);
		expect([c.x, c.y, c.vertical]).toEqual([55, 145, undefined]);

		deleteItems(project, folio, [ref]);
		expect(folio.cables).toHaveLength(0);
	});

	it('copier/coller et duplication : nouveau repère', () => {
		const { project, folio } = setup();
		const c = addCable(project, folio, p(55, 140), p(115, 140));
		const frag = extractFragment(project, folio, [{ kind: 'cable', id: c.id }]);
		insertFragment(project, folio, frag, { devices: 'renumber' });
		expect(folio.cables.map((x) => x.tag)).toEqual(['W1', 'W2']);
		const copy = duplicateFolio(project, folio.id)!;
		expect(copy.cables.map((x) => x.tag)).toEqual(['W3', 'W4']);
	});

	it('anciens projets et macros sans câbles', () => {
		const { project } = setup();
		const raw = JSON.parse(JSON.stringify(project));
		delete raw.folios[0].cables;
		expect(migrateProject(raw).folios[0].cables).toEqual([]);
		const { folio } = setup();
		const refs = insertFragment(
			project,
			folio,
			{ symbols: [], wires: [], bars: [], texts: [], rects: [], devices: {} },
			{ devices: 'renumber' }
		);
		expect(refs).toEqual([]);
	});
});
