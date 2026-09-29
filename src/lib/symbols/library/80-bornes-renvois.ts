import type { SymbolDef } from '../types';
import { circle, line, path, term } from '../helpers';

const CAT = 'Bornes et renvois';

/** Borne de bornier : haut = côté armoire, bas = côté extérieur, reliées en interne. */
const borne = (id: string, name: string, prefix: string): SymbolDef => ({
	id,
	name,
	category: CAT,
	keywords: ['borne', 'bornier', prefix.toLowerCase()],
	prefix,
	role: 'terminal',
	graphics: [
		line(0, 0, 0, 1.3),
		line(0, 3.7, 0, 5),
		circle(0, 2.5, 1.2, { fill: 'paper' }),
		line(-0.85, 3.35, 0.85, 1.65)
	],
	terminals: [term('1', 0, 0, 'n', true), term('2', 0, 5, 's', true)],
	bridges: [['1', '2']],
	labels: { tag: { x: 1.8, y: 3.4 } },
	bounds: { x: -1.5, y: 0, w: 3, h: 5 }
});

export const symbols: SymbolDef[] = [
	borne('borne-x', 'Borne de bornier (X)', 'X'),
	borne('borne-p', 'Borne puissance (P)', 'P'),
	borne('borne-c', 'Borne commande (C)', 'C'),
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
