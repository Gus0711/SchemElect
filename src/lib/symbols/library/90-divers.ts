import type { Prim, SymbolDef } from '../types';
import { circle, defineSymbol, line, rect, term, text } from '../helpers';

const CAT = 'Divers';

/** Graphique sans appareil raccordé par une seule borne en haut. */
const decor = (id: string, name: string, keywords: string[], graphics: Prim[]): SymbolDef =>
	defineSymbol({
		id,
		name,
		category: CAT,
		keywords,
		prefix: '',
		role: 'decor',
		graphics,
		terminals: [term('PE', 0, 0, 'n', true)],
		labels: {}
	});

/** Voie d'automate TOR (1 borne en haut), libellé inscrit dans le cadre. */
const plcIo = (id: string, name: string, label: string, keywords: string[]): SymbolDef =>
	defineSymbol({
		id,
		name,
		category: CAT,
		keywords: ['automate', 'e/s', 'régulateur', 'a', ...keywords],
		prefix: 'A',
		role: 'standalone',
		graphics: [
			line(0, 0, 0, 5),
			rect(-4, 5, 8, 5, { fill: 'paper' }),
			text(0, 8.4, label, { size: 2, anchor: 'middle' })
		],
		terminals: [term('1', 0, 0, 'n')],
		labels: {
			tag: { x: 5, y: 7.2 },
			designation: { x: 5, y: 9.8 }
		}
	});

export const symbols: SymbolDef[] = [
	decor(
		'terre',
		'Terre',
		['terre', 'pe', 'masse', 'protection'],
		[line(0, 0, 0, 5), line(-2.5, 5, 2.5, 5), line(-1.7, 6, 1.7, 6), line(-0.9, 7, 0.9, 7)]
	),
	decor(
		'masse',
		'Masse',
		['masse', 'châssis', '0V'],
		[
			line(0, 0, 0, 5),
			line(-2.5, 5, 2.5, 5),
			line(-2.5, 5, -3.5, 6.5),
			line(0, 5, -1, 6.5),
			line(2.5, 5, 1.5, 6.5)
		]
	),
	defineSymbol({
		id: 'borne-appareil',
		name: "Borne d'appareil",
		category: CAT,
		keywords: ['borne', 'appareil', 'équipement', 'chaudière', 'raccordement', 'xe'],
		prefix: 'XE',
		role: 'standalone',
		graphics: [line(0, 0, 0, 1.5), rect(-1, 1.5, 2, 2, { fill: 'paper' }), line(0, 3.5, 0, 5)],
		terminals: [term('1', 0, 0, 'n', true), term('2', 0, 5, 's', true)],
		bridges: [['1', '2']],
		labels: { tag: { x: 1.8, y: 3.4 } }
	}),
	decor(
		'terre-protection',
		'Terre de protection',
		['terre', 'pe', 'protection', 'liaison équipotentielle'],
		[
			line(0, 0, 0, 3),
			circle(0, 6, 3),
			line(0, 3, 0, 5),
			line(-1.8, 5, 1.8, 5),
			line(-1.2, 6, 1.2, 6),
			line(-0.6, 7, 0.6, 7)
		]
	),
	plcIo('entree-tor', 'Entrée TOR (automate)', 'DI', ['entrée', 'tor', 'di']),
	plcIo('sortie-tor', 'Sortie TOR (automate)', 'DO', ['sortie', 'tor', 'do']),
	plcIo('entree-analogique', 'Entrée analogique (automate)', 'AI', [
		'entrée',
		'analogique',
		'0-10V',
		'4-20mA',
		'ai'
	]),
	plcIo('sortie-analogique', 'Sortie analogique (automate)', 'AO', [
		'sortie',
		'analogique',
		'0-10V',
		'ao'
	])
];
