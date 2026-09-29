import type { Prim, SymbolDef } from '../types';
import {
	circle,
	coilBody,
	defineSymbol,
	leads,
	leadToCircle,
	line,
	path,
	POLE,
	rect,
	resistorSymbol,
	term,
	text,
	vTerminals,
	valve
} from '../helpers';

const CAT = 'Récepteurs et alimentation';

/** Textes empilés à droite à partir de (x, y). */
const rightLabels = (x: number, y: number): SymbolDef['labels'] => ({
	tag: { x, y },
	value: { x, y: y + 2.8 },
	designation: { x, y: y + 5.6 }
});

/**
 * Machine tournante : bornes en haut tous les `POLE` (phases puis PE),
 * cercle centré sous les phases, `inner` = graphisme dans le cercle.
 */
function machine(o: {
	id: string;
	name: string;
	prefix: string;
	phases: string[];
	inner: (cx: number, cy: number) => Prim[];
	keywords: string[];
	defaults?: SymbolDef['defaults'];
}): SymbolDef {
	const r = 5,
		cy = 13.5;
	const cx = ((o.phases.length - 1) * POLE) / 2;
	const peX = o.phases.length * POLE;
	return defineSymbol({
		id: o.id,
		name: o.name,
		category: CAT,
		keywords: o.keywords,
		prefix: o.prefix,
		role: 'standalone',
		graphics: [
			...o.phases.flatMap((_, i) => leadToCircle(i * POLE, 5, cx, cy, r)),
			line(peX, 0, peX, cy),
			line(peX, cy, cx + r, cy),
			circle(cx, cy, r, { fill: 'paper' }),
			...o.inner(cx, cy)
		],
		terminals: [...o.phases.map((id, i) => term(id, i * POLE, 0, 'n')), term('PE', peX, 0, 'n')],
		labels: rightLabels(peX + 3, cy - 1),
		defaults: o.defaults
	});
}

const motorText =
	(kind: string) =>
	(cx: number, cy: number): Prim[] => [
		text(cx, cy - 0.2, 'M', { size: 3.2, anchor: 'middle' }),
		text(cx, cy + 2.8, kind, { size: 2, anchor: 'middle' })
	];

const propeller = (cx: number, cy: number): Prim[] => [
	path(`M ${cx} ${cy} Q ${cx + 1} ${cy - 3.2} ${cx + 3.2} ${cy - 1} Z`),
	path(`M ${cx} ${cy} Q ${cx - 1} ${cy + 3.2} ${cx - 3.2} ${cy + 1} Z`),
	circle(cx, cy, 0.5, { fill: 'ink' })
];

/* Transformateur : primaire 1/2 en haut, secondaire 3/4 en bas, deux cercles entrelacés. */
const TR = { cx: POLE / 2, r: 4, c1: 10.5, c2: 14.5, len: 25 };

export const symbols: SymbolDef[] = [
	machine({
		id: 'moteur-mono',
		name: 'Moteur monophasé',
		prefix: 'M',
		phases: ['L', 'N'],
		inner: motorText('1~'),
		keywords: ['moteur', 'monophasé', 'pompe', 'circulateur', 'm']
	}),
	machine({
		id: 'moteur-tri',
		name: 'Moteur triphasé',
		prefix: 'M',
		phases: ['U', 'V', 'W'],
		inner: motorText('3~'),
		keywords: ['moteur', 'triphasé', 'pompe', 'm', '400V']
	}),
	machine({
		id: 'ventilateur',
		name: 'Ventilateur',
		prefix: 'M',
		phases: ['L', 'N'],
		inner: propeller,
		keywords: ['ventilateur', 'extracteur', 'ventilation', 'moteur', 'm']
	}),
	defineSymbol({
		id: 'transformateur',
		name: 'Transformateur 230/24V',
		category: CAT,
		keywords: ['transformateur', 'transfo', '230/24V', 'tt', 'alimentation'],
		prefix: 'TT',
		role: 'standalone',
		graphics: [
			...leadToCircle(0, 4, TR.cx, TR.c1, TR.r),
			...leadToCircle(POLE, 4, TR.cx, TR.c1, TR.r),
			...leadToCircle(0, 21, TR.cx, TR.c2, TR.r, TR.len),
			...leadToCircle(POLE, 21, TR.cx, TR.c2, TR.r, TR.len),
			circle(TR.cx, TR.c1, TR.r),
			circle(TR.cx, TR.c2, TR.r)
		],
		terminals: [
			term('1', 0, 0, 'n'),
			term('2', POLE, 0, 'n'),
			term('3', 0, TR.len, 's'),
			term('4', POLE, TR.len, 's')
		],
		labels: rightLabels(POLE + 4, 11),
		defaults: { value: '230/24V 100VA' }
	}),
	defineSymbol({
		id: 'alimentation-24vdc',
		name: 'Alimentation 230VAC/24VDC',
		category: CAT,
		keywords: ['alimentation', 'redresseur', '24VDC', 'convertisseur', 'g'],
		prefix: 'G',
		role: 'standalone',
		graphics: [
			...leads(5, 20, 0, 25),
			...leads(5, 20, POLE, 25),
			rect(-2.5, 5, POLE + 5, 15, { fill: 'paper' }),
			line(-2.5, 20, POLE + 2.5, 5),
			text(0.5, 10, '~', { size: 3, anchor: 'middle' }),
			text(7, 17.8, '=', { size: 3, anchor: 'middle' })
		],
		terminals: [
			term('L', 0, 0, 'n'),
			term('N', POLE, 0, 'n'),
			term('+', 0, 25, 's'),
			term('-', POLE, 25, 's')
		],
		labels: rightLabels(POLE + 5, 11),
		defaults: { value: '230VAC/24VDC' }
	}),
	defineSymbol({
		id: 'prise-2p-t',
		name: 'Prise de courant 2P+T',
		category: CAT,
		keywords: ['prise', 'prise de courant', 'pc', '2p+t', '16A', 'xp'],
		prefix: 'XP',
		role: 'standalone',
		graphics: [
			line(0, 0, 0, 7.5),
			line(5, 0, 5, 7.5),
			line(10, 0, 10, 7.5),
			line(-1, 7.5, 11, 7.5),
			path('M -1 7.5 A 6 6 0 0 0 11 7.5', { fill: 'paper' })
		],
		terminals: [term('L', 0, 0, 'n'), term('N', 5, 0, 'n'), term('PE', 10, 0, 'n')],
		labels: rightLabels(13, 6),
		defaults: { value: '16A' }
	}),
	resistorSymbol(
		'resistance-chauffante',
		'Résistance chauffante',
		CAT,
		'EH',
		['résistance', 'chauffante', 'chauffage', 'thermoplongeur', 'eh'],
		[line(-1.5, 6, 1.5, 6), line(-1.5, 7.5, 1.5, 7.5), line(-1.5, 9, 1.5, 9)],
		{ value: '2kW' }
	),
	defineSymbol({
		id: 'electrovanne',
		name: 'Électrovanne',
		category: CAT,
		keywords: ['électrovanne', 'vanne', 'solénoïde', 'yv'],
		prefix: 'YV',
		role: 'standalone',
		graphics: [...coilBody(), line(4.5, 7.5, 7, 7.5), ...valve(11, 7.5, 4, 2)],
		terminals: vTerminals('A1', 'A2'),
		labels: rightLabels(16.5, 6),
		defaults: { value: '230V' }
	}),
	defineSymbol({
		id: 'vanne-3-points',
		name: 'Vanne motorisée 3 points',
		category: CAT,
		keywords: ['vanne', 'motorisée', '3 points', 'servomoteur', 'v3v', 'yv'],
		prefix: 'YV',
		role: 'standalone',
		graphics: [
			...leadToCircle(0, 4, POLE, 11, 4),
			...leadToCircle(POLE, 4, POLE, 11, 4),
			...leadToCircle(2 * POLE, 4, POLE, 11, 4),
			circle(POLE, 11, 4, { fill: 'paper' }),
			text(POLE, 12.1, 'M', { size: 3, anchor: 'middle' }),
			line(POLE, 15, POLE, 20),
			...valve(POLE, 20, 4, 2)
		],
		terminals: [term('N', 0, 0, 'n'), term('Y1', POLE, 0, 'n'), term('Y2', 2 * POLE, 0, 'n')],
		labels: rightLabels(2 * POLE + 3, 10),
		defaults: { value: '230V' }
	}),
	defineSymbol({
		id: 'buzzer',
		name: 'Buzzer / sirène',
		category: CAT,
		keywords: ['buzzer', 'sirène', 'klaxon', 'alarme', 'sonore', 'ha'],
		prefix: 'HA',
		role: 'standalone',
		graphics: [
			...leads(4.5, 10.5),
			path('M 0 4.5 A 3 3 0 0 1 0 10.5 Z', { fill: 'paper' }),
			path('M 4.2 5.5 A 2.8 2.8 0 0 1 4.2 9.5')
		],
		terminals: vTerminals('1', '2'),
		labels: rightLabels(6, 7)
	})
];
