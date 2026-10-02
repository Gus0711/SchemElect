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
	SPAN,
	text,
	thermalMark,
	vTerminals,
	BLADE_MID,
	coilBody,
	POLES_KM
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

const isolator = (suffix: string, label: string, poles: Poles) =>
	device({
		id: `interrupteur-sectionneur-${suffix}`,
		name: `Interrupteur-sectionneur ${label}`,
		prefix: 'QS',
		role: 'standalone',
		poles,
		keywords: ['interrupteur', 'sectionneur', 'coupure', 'qs', label.toLowerCase()],
		draw: (x) => disconnectorPole(x),
		defaults: { value: '40A' }
	});

/** Disjoncteur différentiel (DDR) : pôles de disjoncteur + tore différentiel. */
const rcbo = (suffix: string, label: string, poles: Poles) =>
	device({
		id: `disjoncteur-differentiel-${suffix}`,
		name: `Disjoncteur différentiel ${label}`,
		prefix: 'Q',
		role: 'master',
		poles,
		keywords: ['disjoncteur', 'différentiel', 'ddr', 'vigi', '30mA', label.toLowerCase(), 'q'],
		draw: breakerDraw,
		extra: rcd,
		link: false,
		defaults: { value: '10A 30mA', designation: 'Courbe C type AC' }
	});

/** Sectionneur porte-fusible : cartouche sur chaque phase, neutre sectionné. */
const fuseHolder = (suffix: string, label: string, poles: Poles) =>
	device({
		id: `porte-fusible-${suffix}`,
		name: `Porte-fusible sectionneur ${label}`,
		prefix: 'FU',
		role: 'standalone',
		poles,
		keywords: ['fusible', 'porte-fusible', 'sectionneur', 'fu', 'protection', label.toLowerCase()],
		draw: (x, neutral) => (neutral ? disconnectorPole(x) : fuseDisconnectorPole(x)),
		defaults: { value: '2A' }
	});

/** Bilame de relais thermique (créneau) sur un pôle, entre y = 5 et y = 10. */
const bimetal = (x: number): Prim[] => [
	line(x, 0, x, 5.5),
	path(`M ${x} 5.5 H ${x + 1.5} V 9.5 H ${x}`),
	line(x, 9.5, x, SPAN)
];

/** Organe thermique d'un contact de relais thermique (à gauche de la liaison). */
const thermalActuator = (bladeX: number): Prim[] => [
	mechLink(-6, bladeX, BLADE_MID.y),
	path('M -6 5.9 H -7.5 V 8.9 H -9')
];

/** Déclencheur à bobine (MN, MX) : rectangle + qualificatif, accroché à l'appareil. */
const trip = (id: string, name: string, mark: string, keywords: string[]): SymbolDef =>
	defineSymbol({
		id,
		name,
		category: CAT,
		keywords: ['déclencheur', 'bobine', 'disjoncteur', 'auxiliaire', 'q', ...keywords],
		prefix: 'Q',
		role: 'standalone',
		graphics: [
			...coilBody(),
			text(0, 8.4, mark, { size: 2, anchor: 'middle' }),
			mechLink(4.5, 8, 7.5)
		],
		terminals: vTerminals('C1', 'C2'),
		labels: { tag: { x: 9, y: 6 }, value: { x: 9, y: 8.8 }, designation: { x: 9, y: 11.4 } },
		defaults: { value: '230V' }
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
	rcbo('1p-n', '1P+N', phases(1, true)),
	rcbo('3p-n', '3P+N', phases(3, true)),
	rcbo('4p', '4P', phases(4)),
	isolator('2p', '2P', phases(1, true)),
	isolator('3p', '3P', phases(3)),
	isolator('4p', '4P', phases(3, true)),
	device({
		id: 'sectionneur-3p',
		name: 'Sectionneur 3P (sans pouvoir de coupure)',
		prefix: 'QS',
		role: 'standalone',
		poles: phases(3),
		keywords: ['sectionneur', 'isolement', 'consignation', 'qs', '3p'],
		draw: (x) => disconnectorPole(x),
		defaults: { value: '63A' }
	}),
	fuseHolder('1p', '1P', phases(1)),
	fuseHolder('1p-n', '1P+N', phases(1, true)),
	fuseHolder('3p', '3P', phases(3)),
	fuseHolder('3p-n', '3P+N', phases(3, true)),
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
	defineSymbol({
		id: 'relais-thermique-3p',
		name: 'Relais thermique 3P',
		category: CAT,
		keywords: ['relais', 'thermique', 'surcharge', 'bilame', 'lrd', 'f'],
		prefix: 'F',
		role: 'master',
		graphics: [
			...POLES_KM.flatMap((_, i) => bimetal(i * 7.5)),
			rect(-2, 4.5, 2 * 7.5 + 5, 6, { stroke: 'dashed' })
		],
		terminals: POLES_KM.flatMap(([a, b], i) => vTerminals(a, b, i * 7.5)),
		labels: sideLabels(2 * 7.5 + 1.5),
		defaults: { value: '1-1,6A' }
	}),
	auxContact(
		'contact-relais-thermique-nc',
		'Contact de relais thermique (NC 95-96)',
		CAT,
		'F',
		'nc',
		['95', '96'],
		['contact', 'relais', 'thermique', 'défaut', 'surcharge', '95', 'nc'],
		thermalActuator(1.5)
	),
	auxContact(
		'contact-relais-thermique-no',
		'Contact de relais thermique (NO 97-98)',
		CAT,
		'F',
		'no',
		['97', '98'],
		['contact', 'relais', 'thermique', 'signalisation', 'défaut', '97', 'no'],
		thermalActuator(BLADE_MID.dx)
	),
	trip('declencheur-mn', 'Déclencheur à manque de tension (MN)', 'U<', [
		'mn',
		'manque de tension',
		'arrêt d’urgence'
	]),
	trip('declencheur-mx', 'Déclencheur à émission de courant (MX)', 'MX', [
		'mx',
		'émission',
		'shunt'
	]),
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
