import { describe, expect, it } from 'vitest';
import { analyzeProject } from '$lib/model/analysis';
import { addSymbol, addWire } from '$lib/model/edit';
import { extractFragment, insertFragment } from '$lib/model/fragments';
import { createProject } from '$lib/model/project';
import { symbolTerminals } from '$lib/model/symbolGeometry';
import {
	buildCustomSymbol,
	expandNames,
	nearestSide,
	nextTerminalName,
	specOf,
	spreadTerminals
} from './custom';
import { registerCustomSymbols } from './index';

const spec = {
	name: 'Automate',
	category: 'Modules',
	prefix: 'A',
	w: 40,
	h: 30,
	title: 'AUTOMATE',
	terminals: [
		{ id: '24V', x: 3.7, y: 4.2, dir: 'n' as const },
		{ id: '0V', x: 8.1, y: 4.2, dir: 'n' as const },
		{ id: '0V', x: 12.4, y: 4.2, dir: 'n' as const },
		...spreadTerminals(['NO', 'C'], 's', 40, 30)
	],
	snapToGrid: false
};

describe('symboles maison', () => {
	it('garde la position exacte des bornes (sans magnétisme)', () => {
		const def = buildCustomSymbol(spec);
		expect(def.id).toMatch(/^custom-/);
		expect(def.terminals.map((t) => t.id)).toEqual(['24V', '0V', '0V#2', 'NO', 'C']);
		expect(def.terminals[2].label).toBe('0V');
		expect(def.terminals[0]).toMatchObject({ x: 3.7, y: 4.2, dir: 'n' });
		expect(def.terminals[3]).toMatchObject({ x: 10, y: 30, dir: 's' });
		expect(specOf(def)?.terminals).toEqual(spec.terminals);
	});

	it('magnétise sur la grille si demandé', () => {
		const def = buildCustomSymbol({ ...spec, snapToGrid: true });
		expect(def.terminals[0]).toMatchObject({ x: 2.5, y: 5 });
	});

	it('noms de bornes : listes, plages, suivante', () => {
		expect(expandNames('24V, 0V; IP1..IP3\n 1..2 , ')).toEqual([
			'24V',
			'0V',
			'IP1',
			'IP2',
			'IP3',
			'1',
			'2'
		]);
		expect(expandNames('DO3..1')).toEqual(['DO3', 'DO2', 'DO1']);
		expect(expandNames('UI08..UI10')).toEqual(['UI08', 'UI09', 'UI10']);
		expect(expandNames('A..B')).toEqual(['A..B']);
		expect(nextTerminalName([])).toBe('1');
		expect(nextTerminalName(['24V', 'IP3'])).toBe('IP4');
		expect(nextTerminalName(['09'])).toBe('10');
		expect(nextTerminalName(['COM'])).toBe('2');
	});

	it('déduit la sortie du fil du bord le plus proche', () => {
		expect(nearestSide(40, 30, 20, 2)).toBe('n');
		expect(nearestSide(40, 30, 39, 15)).toBe('e');
	});

	it('relit les symboles de l’ancien format (côté + position)', () => {
		const def = buildCustomSymbol(spec);
		def.source!.terminals = [{ id: 'A', side: 's', at: 12 }];
		expect(specOf(def)?.terminals).toEqual([{ id: 'A', x: 12, y: 32.5, dir: 's' }]);
	});

	it('se raccorde comme un symbole intégré et voyage avec le projet', () => {
		const def = buildCustomSymbol(spec);
		registerCustomSymbols([def]);
		const project = createProject('P');
		const folio = project.folios[0];
		const s = addSymbol(project, folio, def.id, { x: 100, y: 50 });
		expect(project.customSymbols[def.id]).toBeDefined();
		expect(project.devices[s.deviceId].tag).toBe('A1');
		const [t24] = symbolTerminals(s);
		expect(t24).toMatchObject({ x: 103.7, y: 54.2 });
		const w = addWire(folio, [{ x: t24.x, y: 20 }, t24])!;
		const a = analyzeProject(project);
		expect(a.nets.netOfTerminal.get(`${s.id}:24V`)).toBe(a.nets.netOfWire.get(w.id));

		const other = createProject('Q');
		insertFragment(
			other,
			other.folios[0],
			extractFragment(project, folio, [{ kind: 'symbol', id: s.id }]),
			{ devices: 'renumber' }
		);
		expect(other.customSymbols[def.id]).toBeDefined();
	});

	it('se redimensionne sur le folio, les fils suivent', async () => {
		const { scaleSymbol, isScalable } = await import('$lib/model/edit');
		const def = buildCustomSymbol(spec);
		registerCustomSymbols([def]);
		const project = createProject('P');
		const folio = project.folios[0];
		const s = addSymbol(project, folio, def.id, { x: 100, y: 50 });
		expect(isScalable(s)).toBe(true);
		const [t24] = symbolTerminals(s);
		const w = addWire(folio, [{ x: t24.x, y: 20 }, t24])!;
		scaleSymbol(folio, s.id, 2);
		expect(s.scale).toBe(2);
		const [t24b] = symbolTerminals(s);
		expect(t24b).toMatchObject({ x: 107.4, y: 58.4 });
		expect(w.points[w.points.length - 1]).toEqual({ x: 107.4, y: 58.4 });
		scaleSymbol(folio, s.id, 1);
		expect(s.scale).toBeUndefined();
		// Les symboles normalisés ne se redimensionnent pas.
		expect(isScalable(addSymbol(project, folio, 'voyant', { x: 20, y: 20 }))).toBe(false);
	});
});
