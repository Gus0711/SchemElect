import type { Prim, SymbolDef } from '../types';
import { circle, defineSymbol, leads, line, POLE, rect, term, text, vTerminals } from '../helpers';

const CAT = 'Mesure et comptage';

const rightLabels = (x: number, y: number): SymbolDef['labels'] => ({
	tag: { x, y },
	value: { x, y: y + 2.8 },
	designation: { x, y: y + 5.6 }
});

/** Appareil de mesure indicateur (cercle + grandeur mesurée), bornes 1 / 2. */
const meter = (
	id: string,
	name: string,
	unit: string,
	keywords: string[],
	defaults?: SymbolDef['defaults']
): SymbolDef =>
	defineSymbol({
		id,
		name,
		category: CAT,
		keywords: ['mesure', 'indicateur', 'p', ...keywords],
		prefix: 'P',
		role: 'standalone',
		graphics: [
			...leads(3.5, 11.5),
			circle(0, 7.5, 4, { fill: 'paper' }),
			text(0, 8.6, unit, { size: unit.length > 1 ? 2.2 : 3, anchor: 'middle' })
		],
		terminals: vTerminals('1', '2'),
		labels: rightLabels(5, 6),
		defaults
	});

/**
 * Compteur d'énergie (intégrateur) : conducteurs traversants, arrivée en haut,
 * départ en bas (bornes primées), cadre « kWh ».
 */
function energyMeter(id: string, name: string, lines: string[], keywords: string[]): SymbolDef {
	const lastX = (lines.length - 1) * POLE;
	const g: Prim[] = [
		...lines.flatMap((_, i) => [line(i * POLE, 0, i * POLE, 5), line(i * POLE, 15, i * POLE, 20)]),
		rect(-2.5, 5, lastX + 5, 10, { fill: 'paper' }),
		rect(-2.5, 5, lastX + 5, 2.5),
		text(lastX / 2, 12.5, 'kWh', { size: 2.5, anchor: 'middle' })
	];
	return defineSymbol({
		id,
		name,
		category: CAT,
		keywords: ['compteur', 'énergie', 'kwh', 'comptage', 'sous-comptage', 'p', ...keywords],
		prefix: 'P',
		role: 'standalone',
		graphics: g,
		terminals: lines.flatMap((l, i) => [
			term(l, i * POLE, 0, 'n'),
			term(`${l}'`, i * POLE, 20, 's')
		]),
		labels: rightLabels(lastX + 4, 8)
	});
}

export const symbols: SymbolDef[] = [
	meter('amperemetre', 'Ampèremètre', 'A', ['ampèremètre', 'courant', 'intensité']),
	meter('voltmetre', 'Voltmètre', 'V', ['voltmètre', 'tension']),
	meter('wattmetre', 'Wattmètre', 'W', ['wattmètre', 'puissance']),
	meter('frequencemetre', 'Fréquencemètre', 'Hz', ['fréquencemètre', 'fréquence']),
	meter('compteur-horaire', 'Compteur horaire', 'h', ['compteur', 'horaire', 'heures', 'marche'], {
		value: '230V'
	}),
	energyMeter('compteur-energie-mono', "Compteur d'énergie monophasé", ['L', 'N'], ['monophasé']),
	energyMeter(
		'compteur-energie-tri',
		"Compteur d'énergie triphasé",
		['L1', 'L2', 'L3', 'N'],
		['triphasé']
	),
	defineSymbol({
		id: 'transformateur-courant',
		name: 'Transformateur de courant (TC)',
		category: CAT,
		keywords: ['transformateur', 'courant', 'intensité', 'tc', 'tore', 'mesure'],
		prefix: 'TC',
		role: 'standalone',
		graphics: [
			line(0, 0, 0, 15),
			circle(0, 7.5, 2.5),
			line(1.77, 5.73, 2.5, 5),
			line(2.5, 5, 5, 5),
			line(1.77, 9.27, 2.5, 10),
			line(2.5, 10, 5, 10)
		],
		terminals: [
			term('P1', 0, 0, 'n'),
			term('P2', 0, 15, 's'),
			term('S1', 5, 5, 'e'),
			term('S2', 5, 10, 'e')
		],
		labels: rightLabels(9, 6),
		defaults: { value: '100/5A' }
	})
];
