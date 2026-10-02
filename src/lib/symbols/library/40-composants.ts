import type { Prim, SymbolDef } from '../types';
import {
	defineSymbol,
	leads,
	line,
	path,
	resistorSymbol,
	term,
	text,
	vTerminals
} from '../helpers';

const CAT = 'Composants';

const sideLabels = (x: number): SymbolDef['labels'] => ({
	tag: { x, y: 6 },
	value: { x, y: 8.8 },
	designation: { x, y: 11.4 }
});

/** Composant vertical à deux bornes. */
const twoPole = (o: {
	id: string;
	name: string;
	prefix: string;
	terms: [string, string];
	graphics: Prim[];
	keywords: string[];
	labelX?: number;
	defaults?: SymbolDef['defaults'];
}): SymbolDef =>
	defineSymbol({
		id: o.id,
		name: o.name,
		category: CAT,
		keywords: o.keywords,
		prefix: o.prefix,
		role: 'standalone',
		graphics: o.graphics,
		terminals: vTerminals(...o.terms),
		labels: sideLabels(o.labelX ?? 4),
		defaults: o.defaults
	});

/** Diode (anode en haut, cathode en bas) : triangle pointe en bas + barre. */
const diodeBody: Prim[] = [
	...leads(5, 10),
	path('M -2.5 5 L 2.5 5 L 0 10 Z', { fill: 'paper' }),
	line(-2.5, 10, 2.5, 10)
];

/** Flèche (rayonnement) de (x1, y1) vers (x2, y2), pointe en (x2, y2). */
const ray = (x1: number, y1: number, x2: number, y2: number): Prim[] => {
	const d = Math.hypot(x2 - x1, y2 - y1);
	const ux = (x2 - x1) / d,
		uy = (y2 - y1) / d;
	const r = (v: number) => +v.toFixed(3);
	const bx = x2 - ux * 0.9,
		by = y2 - uy * 0.9;
	return [
		line(x1, y1, x2, y2),
		path(
			`M ${r(x2)} ${r(y2)} L ${r(bx - uy * 0.5)} ${r(by + ux * 0.5)} L ${r(bx + uy * 0.5)} ${r(by - ux * 0.5)} Z`,
			{ fill: 'ink' }
		)
	];
};

export const symbols: SymbolDef[] = [
	resistorSymbol('resistance', 'Résistance', CAT, 'R', ['résistance', 'résistor', 'r']),
	defineSymbol({
		id: 'potentiometre',
		name: 'Potentiomètre',
		category: CAT,
		keywords: ['potentiomètre', 'résistance variable', 'consigne', 'curseur', 'r'],
		prefix: 'R',
		role: 'standalone',
		graphics: [
			...leads(4, 11),
			path('M -1.5 4 H 1.5 V 11 H -1.5 Z', { fill: 'paper' }),
			line(5, 7.5, 2.4, 7.5),
			path('M 1.5 7.5 L 2.6 6.9 L 2.6 8.1 Z', { fill: 'ink' })
		],
		terminals: [term('1', 0, 0, 'n'), term('3', 0, 15, 's'), term('2', 5, 7.5, 'e')],
		labels: { tag: { x: -3, y: 6, anchor: 'end' }, value: { x: -3, y: 8.8, anchor: 'end' } },
		defaults: { value: '10kΩ' }
	}),
	resistorSymbol(
		'thermistance',
		'Thermistance (CTN / CTP)',
		CAT,
		'R',
		['thermistance', 'ctn', 'ctp', 'ntc', 'ptc', 'sonde', 'température', 'r'],
		[path('M -2.5 11.5 L -1.5 11.5 L 2.5 3.5'), text(2.2, 12.3, 'θ', { size: 1.8 })]
	),
	resistorSymbol(
		'varistance',
		'Varistance',
		CAT,
		'RV',
		['varistance', 'vdr', 'mov', 'surtension', 'antiparasite', 'rv'],
		[path('M -2.5 11.5 L -1.5 11.5 L 2.5 3.5'), text(2.2, 12.3, 'U', { size: 1.8 })]
	),
	twoPole({
		id: 'condensateur',
		name: 'Condensateur',
		prefix: 'C',
		terms: ['1', '2'],
		graphics: [...leads(6.5, 8.5), line(-3, 6.5, 3, 6.5), line(-3, 8.5, 3, 8.5)],
		keywords: ['condensateur', 'capacité', 'déphasage', 'moteur', 'c']
	}),
	twoPole({
		id: 'condensateur-polarise',
		name: 'Condensateur polarisé',
		prefix: 'C',
		terms: ['+', '-'],
		graphics: [
			...leads(6.5, 8.5),
			line(-3, 6.5, 3, 6.5),
			path('M -3 8.5 H 3 V 9.2 H -3 Z', { fill: 'ink' }),
			text(-2.6, 5.6, '+', { size: 1.8, anchor: 'middle' })
		],
		keywords: ['condensateur', 'polarisé', 'électrolytique', 'chimique', 'c']
	}),
	twoPole({
		id: 'diode',
		name: 'Diode',
		prefix: 'V',
		terms: ['A', 'K'],
		graphics: diodeBody,
		keywords: ['diode', 'roue libre', 'redresseur', 'semi-conducteur', 'v']
	}),
	twoPole({
		id: 'diode-zener',
		name: 'Diode Zener',
		prefix: 'V',
		terms: ['A', 'K'],
		graphics: [
			...leads(5, 10),
			path('M -2.5 5 L 2.5 5 L 0 10 Z', { fill: 'paper' }),
			path('M -3.2 10.7 L -2.5 10 L 2.5 10 L 3.2 9.3')
		],
		keywords: ['diode', 'zener', 'écrêteur', 'v']
	}),
	twoPole({
		id: 'led',
		name: 'Diode électroluminescente (LED)',
		prefix: 'V',
		terms: ['A', 'K'],
		graphics: [...diodeBody, ...ray(2.2, 7, 4.4, 5.6), ...ray(2.2, 9, 4.4, 7.6)],
		labelX: 5.5,
		keywords: ['led', 'diode', 'électroluminescente', 'témoin', 'v']
	}),
	twoPole({
		id: 'batterie',
		name: 'Batterie / pile',
		prefix: 'GB',
		terms: ['+', '-'],
		graphics: [
			...leads(6.5, 8.5),
			line(-3.5, 6.5, 3.5, 6.5),
			line(-1.75, 8.5, 1.75, 8.5, 'thick'),
			text(-3, 5.6, '+', { size: 1.8, anchor: 'middle' })
		],
		keywords: ['batterie', 'pile', 'accumulateur', 'secours', 'gb']
	})
];
