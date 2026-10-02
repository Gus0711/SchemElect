import { describe, expect, it } from 'vitest';
import { addSymbol } from './edit';
import { routeWire } from './geometry';
import { createProject } from './project';
import { snapTarget, TERMINAL_SNAP_MAX } from './snap';
import { symbolTerminals } from './symbolGeometry';

const O = { x: 0, y: 0 };

describe('tracé des fils (routeWire)', () => {
	it('sans borne : un coude, horizontal d’abord si l’écart est surtout horizontal', () => {
		expect(routeWire(O, { x: 20, y: 10 }).points).toEqual([O, { x: 20, y: 0 }, { x: 20, y: 10 }]);
		expect(routeWire(O, { x: 5, y: 10 }).points).toEqual([O, { x: 0, y: 10 }, { x: 5, y: 10 }]);
	});

	it('part dans le sens de la borne', () => {
		// Borne vers le bas, cible en bas à gauche : descend puis part à gauche.
		expect(routeWire(O, { x: -30, y: 20 }, { fromDir: 's' }).points).toEqual([
			O,
			{ x: 0, y: 20 },
			{ x: -30, y: 20 }
		]);
		// Cible au-dessus : sort quand même vers le bas, puis contourne.
		expect(routeWire(O, { x: -30, y: -20 }, { fromDir: 's' }).points).toEqual([
			O,
			{ x: 0, y: 5 },
			{ x: -30, y: 5 },
			{ x: -30, y: -20 }
		]);
	});

	it('arrive dans le sens de la borne visée', () => {
		expect(routeWire(O, { x: 40, y: 30 }, { toDir: 'n' }).points).toEqual([
			O,
			{ x: 40, y: 0 },
			{ x: 40, y: 30 }
		]);
		expect(routeWire(O, { x: 40, y: 30 }, { toDir: 'w' }).points).toEqual([
			O,
			{ x: 0, y: 30 },
			{ x: 40, y: 30 }
		]);
	});

	it('d’une borne à l’autre, face à face : droit', () => {
		expect(routeWire(O, { x: 0, y: 40 }, { fromDir: 's', toDir: 'n' }).points).toEqual([
			O,
			{ x: 0, y: 40 }
		]);
	});

	it('Espace impose l’autre coude', () => {
		const auto = routeWire(O, { x: -30, y: 20 }, { fromDir: 's' });
		expect(auto.horizontalFirst).toBe(false);
		const other = routeWire(O, { x: -30, y: 20 }, { fromDir: 's', horizontalFirst: true });
		expect(other.points[1]).toEqual({ x: 0, y: 5 });
	});
});

describe('accroche des bornes', () => {
	it('limitée à 1,5 mm même dézoomé : la grille reste accessible à côté d’une borne', () => {
		const p = createProject('P');
		const f = p.folios[0];
		const sym = addSymbol(p, f, 'bobine-contacteur', { x: 100, y: 50 });
		const t = symbolTerminals(sym)[0];
		expect(snapTarget(f, { x: t.x + 1, y: t.y }, 10).kind).toBe('terminal');
		const r = snapTarget(f, { x: t.x + TERMINAL_SNAP_MAX + 1, y: t.y }, 10);
		expect(r.kind).not.toBe('terminal');
	});
});
