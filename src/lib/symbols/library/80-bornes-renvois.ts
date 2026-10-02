import type { SymbolDef } from '../types';
import type { Prim } from '../types';
import { circle, line, path, rect, term } from '../helpers';

const CAT = 'Bornes et renvois';

/** Borne à vis : cercle barré. */
const screw: Prim[] = [
	line(0, 0, 0, 1.3),
	line(0, 3.7, 0, 5),
	circle(0, 2.5, 1.2, { fill: 'paper' }),
	line(-0.85, 3.35, 0.85, 1.65)
];

/** Borne de bornier : haut = côté armoire, bas = côté extérieur, reliées en interne. */
const borne = (
	id: string,
	name: string,
	prefix: string,
	graphics: Prim[] = screw,
	keywords: string[] = []
): SymbolDef => ({
	id,
	name,
	category: CAT,
	keywords: ['borne', 'bornier', prefix.toLowerCase(), ...keywords],
	prefix,
	role: 'terminal',
	graphics,
	terminals: [term('1', 0, 0, 'n', true), term('2', 0, 5, 's', true)],
	bridges: [['1', '2']],
	labels: { tag: { x: 1.8, y: 3.4 } },
	bounds: { x: -1.5, y: 0, w: 3, h: 5 }
});

export const symbols: SymbolDef[] = [
	borne('borne-x', 'Borne de bornier (X)', 'X'),
	borne('borne-p', 'Borne puissance (P)', 'P'),
	borne('borne-c', 'Borne commande (C)', 'C'),
	borne(
		'borne-pe',
		'Borne de terre (PE)',
		'X',
		[
			line(0, 0, 0, 1.3),
			line(0, 3.7, 0, 5),
			circle(0, 2.5, 1.2, { fill: 'paper' }),
			line(-0.7, 2, 0.7, 2),
			line(-0.45, 2.6, 0.45, 2.6),
			line(-0.2, 3.2, 0.2, 3.2)
		],
		['terre', 'pe', 'protection', 'vert-jaune']
	),
	borne(
		'borne-sectionnable',
		'Borne sectionnable',
		'X',
		[line(0, 0, 0, 1.3), circle(0, 2.5, 1.2, { fill: 'paper' }), line(0, 3.7, 1, 5)],
		['sectionnable', 'couteau', 'test', 'coupure']
	),
	borne(
		'borne-fusible',
		'Borne fusible',
		'X',
		[line(0, 0, 0, 5), rect(-0.8, 1, 1.6, 3, { fill: 'paper' }), line(0, 1, 0, 4)],
		['fusible', 'porte-fusible', 'protection']
	),
	{
		id: 'renvoi-sortie',
		name: 'Renvoi de fil (sortie)',
		category: CAT,
		keywords: ['renvoi', 'flèche', 'folio', 'report'],
		prefix: 'R',
		role: 'link',
		graphics: [
			line(0, 0, 0, 2, 'normal', 'accent'),
			path('M -1.8 2 L 1.8 2 L 0 5 Z', { fill: 'ink', tone: 'accent', stroke: 'none' })
		],
		terminals: [term('1', 0, 0, 'n', true)],
		labels: { xref: { x: 0, y: 8, anchor: 'middle' } },
		bounds: { x: -2, y: 0, w: 4, h: 5 }
	},
	{
		id: 'renvoi-entree',
		name: 'Renvoi de fil (arrivée)',
		category: CAT,
		keywords: ['renvoi', 'flèche', 'folio', 'report'],
		prefix: 'R',
		role: 'link',
		graphics: [
			path('M -1.8 -5 L 1.8 -5 L 0 -2 Z', { fill: 'ink', tone: 'accent', stroke: 'none' }),
			line(0, -2, 0, 0, 'normal', 'accent')
		],
		terminals: [term('1', 0, 0, 's', true)],
		labels: { xref: { x: 0, y: -6.5, anchor: 'middle' } },
		bounds: { x: -2, y: -5, w: 4, h: 5 }
	}
];
