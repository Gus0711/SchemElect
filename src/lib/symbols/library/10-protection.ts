import type { SymbolDef, SymbolRole } from '../types';
import {
	auxContact,
	breakerPole,
	contactNO,
	defineSymbol,
	disconnectorPole,
	fuse,
	fuseDisconnectorPole,
	leads,
	line,
	mechLink,
	multipole,
	path,
	POLE_N,
	POLES_L,
	rect,
	sideLabels,
	text,
	thermalMark,
	vTerminals,
	BLADE_MID
} from '../helpers';
import type { Prim } from '../types';

const CAT = 'Protection';

type Poles = [string, string][];
const isNeutral = (p: [string, string]) => p[0] === POLE_N[0];

/** Jeux de pôles : n phases (+ neutre à droite). */
const phases = (n: number, neutral = false): Poles => [
	...POLES_L.slice(0, n),
	...(neutral ? [POLE_N] : [])
];

/**
 * Appareil de protection / coupure multipolaire générique.
 * `draw(x, neutral)` dessine un pôle ; `extra(lastX)` ajoute le graphisme commun.
 */
function device(o: {
	id: string;
	name: string;
	prefix: string;
	role: SymbolRole;
	poles: Poles;
	keywords: string[];
	draw: (x: number, neutral: boolean) => Prim[];
	extra?: (lastX: number) => Prim[];
	link?: boolean;
	defaults?: SymbolDef['defaults'];
}): SymbolDef {
	const mp = multipole(o.poles, (x, i) => o.draw(x, isNeutral(o.poles[i])), { link: o.link });
	return defineSymbol({
		id: o.id,
		name: o.name,
		category: CAT,
		keywords: o.keywords,
		prefix: o.prefix,
		role: o.role,
		graphics: [...mp.graphics, ...(o.extra?.(mp.lastX) ?? [])],
		terminals: mp.terminals,
		labels: sideLabels(mp.lastX),
		defaults: o.defaults
	});
}

/** Pôle de disjoncteur : pôle de neutre non protégé (simple coupure). */
const breakerDraw = (x: number, neutral: boolean) => (neutral ? contactNO(x) : breakerPole(x));

const breaker = (suffix: string, label: string, poles: Poles) =>
	device({
		id: `disjoncteur-${suffix}`,
		name: `Disjoncteur ${label}`,
		prefix: 'Q',
		role: 'master',
		poles,
		keywords: ['disjoncteur', 'protection', 'magnétothermique', label.toLowerCase(), 'q'],
		draw: breakerDraw,
		defaults: { value: '10A', designation: 'Courbe C' }
	});

/** Tore + relais différentiel (IΔ) à gauche, relié mécaniquement aux lames. */
const rcd = (lastX: number): Prim[] => [
	rect(-1.5, 11.25, lastX + 3, 1.5, { r: 0.75 }),
	rect(-10, 10, 5, 4, { fill: 'paper' }),
	text(-7.5, 12.7, 'IΔ', { size: 1.8, anchor: 'middle' }),
	line(-5, 12, -1.5, 12),
	line(-7.5, 10, -7.5, BLADE_MID.y, 'dashed'),
	mechLink(-7.5, lastX + BLADE_MID.dx, BLADE_MID.y)
];

const differential = (n: number, label: string) =>
	device({
		id: `interrupteur-differentiel-${n}p`,
		name: `Interrupteur différentiel ${label}`,
		prefix: 'ID',
		role: 'standalone',
		poles: phases(n - 1, true),
		keywords: ['interrupteur', 'différentiel', 'id', 'protection', '30mA', label.toLowerCase()],
		draw: (x) => contactNO(x),
		extra: rcd,
		link: false,
		defaults: { value: '40A 30mA', designation: 'Type AC' }
	});

const isolator = (n: number, label: string) =>
	device({
		id: `interrupteur-sectionneur-${n}p`,
		name: `Interrupteur-sectionneur ${label}`,
		prefix: 'QS',
		role: 'standalone',
		poles: phases(n - 1, true),
		keywords: ['interrupteur', 'sectionneur', 'coupure', 'qs', label.toLowerCase()],
		draw: (x) => disconnectorPole(x),
		defaults: { value: '40A' }
	});

export const symbols: SymbolDef[] = [
	breaker('1p', '1P', phases(1)),
	breaker('1p-n', '1P+N', phases(1, true)),
	breaker('2p', '2P', phases(2)),
	breaker('3p', '3P', phases(3)),
	breaker('3p-n', '3P+N', phases(3, true)),
	breaker('4p', '4P', phases(4)),
	differential(2, '2P'),
	differential(4, '4P'),
	isolator(2, '2P'),
	isolator(4, '4P'),
	device({
		id: 'porte-fusible-1p-n',
		name: 'Porte-fusible sectionneur 1P+N',
		prefix: 'FU',
		role: 'standalone',
		poles: phases(1, true),
		keywords: ['fusible', 'porte-fusible', 'sectionneur', 'fu', 'protection'],
		draw: (x, neutral) => (neutral ? disconnectorPole(x) : fuseDisconnectorPole(x)),
		defaults: { value: '2A' }
	}),
	device({
		id: 'disjoncteur-moteur-3p',
		name: 'Disjoncteur moteur 3P',
		prefix: 'QM',
		role: 'master',
		poles: phases(3),
		keywords: ['disjoncteur', 'moteur', 'magnétothermique', 'thermique', 'gv2', 'qm'],
		draw: (x) => [...breakerPole(x), ...thermalMark(x)],
		defaults: { value: '1-1,6A' }
	}),
	auxContact(
		'contact-aux-disjoncteur-no',
		'Contact auxiliaire de disjoncteur (NO)',
		CAT,
		'Q',
		'no',
		['13', '14'],
		['contact', 'auxiliaire', 'disjoncteur', 'position', 'no']
	),
	auxContact(
		'contact-aux-disjoncteur-nc',
		'Contact auxiliaire de disjoncteur (NC)',
		CAT,
		'Q',
		'nc',
		['21', '22'],
		['contact', 'auxiliaire', 'disjoncteur', 'défaut', 'nc']
	),
	defineSymbol({
		id: 'fusible',
		name: 'Fusible',
		category: CAT,
		keywords: ['fusible', 'cartouche', 'protection', 'fu'],
		prefix: 'FU',
		role: 'standalone',
		graphics: [...leads(4, 11), ...fuse(0, 4, 11)],
		terminals: vTerminals('1', '2'),
		labels: sideLabels(0),
		defaults: { value: '1A' }
	}),
	defineSymbol({
		id: 'parafoudre',
		name: 'Parafoudre',
		category: CAT,
		keywords: ['parafoudre', 'surtension', 'foudre', 'protection', 'f'],
		prefix: 'F',
		role: 'standalone',
		graphics: [
			...leads(4, 11),
			rect(-1.5, 4, 3, 7, { fill: 'paper' }),
			path('M 0 4.8 L 0 6.5 L -0.8 7.4 L 0.8 8 L 0 8.9 L 0 10.2'),
			path('M -0.6 9.4 L 0 10.2 L 0.6 9.4')
		],
		terminals: vTerminals('1', '2'),
		labels: sideLabels(0)
	})
];
