import type { Prim, SymbolDef } from '../types';
import {
	actuatorLink,
	circle,
	contactNC,
	contactNO,
	defineSymbol,
	line,
	multipole,
	path,
	rect,
	resistorSymbol,
	sideLabels,
	text,
	vTerminals
} from '../helpers';

const CAT = 'Commande manuelle et capteurs';

/** Abscisse de la lame d'un contact NC à la hauteur de la liaison mécanique. */
const NC_BLADE_X = 1.5;
/** Extrémité gauche de la liaison mécanique : l'organe de commande est dessiné à gauche de ce x. */
const ACT = -6;

/* Organes de commande (dessinés à gauche de x = ACT, centrés en y = 7.4). */
const push: Prim[] = [path(`M ${ACT} 5.9 H ${ACT - 1} V 8.9 H ${ACT}`)];
const mushroom: Prim[] = [line(ACT, 5, ACT, 9.8), path(`M ${ACT} 5 A 2.4 2.4 0 0 0 ${ACT} 9.8`)];
const rotary: Prim[] = [path(`M ${ACT - 3} 8.6 H ${ACT - 2} L ${ACT - 1} 6.2 H ${ACT}`)];
const box = (letter: string): Prim[] => [
	rect(ACT - 3, 5.9, 3, 3, { fill: 'paper' }),
	text(ACT - 1.5, 8.1, letter, { size: 2, anchor: 'middle' })
];
const float: Prim[] = [line(ACT, 7.4, ACT, 9), circle(ACT, 10.3, 1.3)];
const positions = (labels: string[]): Prim[] =>
	labels.map((l, i) =>
		text(ACT - 3 + (3 * i) / Math.max(1, labels.length - 1), 3.6, l, {
			size: 1.8,
			anchor: 'middle'
		})
	);

/** Contact à 2 bornes actionné par un organe de commande (appareil autonome). */
function operated(o: {
	id: string;
	name: string;
	prefix: string;
	kind: 'no' | 'nc';
	terms: [string, string];
	actuator: Prim[];
	keywords: string[];
}): SymbolDef {
	const no = o.kind === 'no';
	return defineSymbol({
		id: o.id,
		name: o.name,
		category: CAT,
		keywords: o.keywords,
		prefix: o.prefix,
		role: 'standalone',
		graphics: [
			...(no ? contactNO() : contactNC()),
			actuatorLink(ACT, no ? undefined : NC_BLADE_X),
			...o.actuator
		],
		terminals: vTerminals(...o.terms),
		labels: sideLabels(no ? 0 : 1.5)
	});
}

const selector3 = multipole(
	[
		['3', '4'],
		['13', '14']
	],
	(x) => contactNO(x)
);

export const symbols: SymbolDef[] = [
	operated({
		id: 'commutateur-a-m',
		name: 'Commutateur 2 positions A/M',
		prefix: 'S',
		kind: 'no',
		terms: ['3', '4'],
		actuator: [...rotary, ...positions(['A', 'M'])],
		keywords: ['commutateur', 'sélecteur', 'auto', 'manu', 'a/m', 'marche', 's']
	}),
	defineSymbol({
		id: 'commutateur-0-1-2',
		name: 'Commutateur 3 positions 0-1-2 (2 contacts)',
		category: CAT,
		keywords: ['commutateur', 'sélecteur', '3 positions', '0-1-2', 'auto', 'manu', 's'],
		prefix: 'S',
		role: 'standalone',
		graphics: [...selector3.graphics, actuatorLink(ACT), ...rotary, ...positions(['1', '0', '2'])],
		terminals: selector3.terminals,
		labels: sideLabels(selector3.lastX)
	}),
	operated({
		id: 'bouton-poussoir-no',
		name: 'Bouton poussoir (NO)',
		prefix: 'S',
		kind: 'no',
		terms: ['13', '14'],
		actuator: push,
		keywords: ['bouton', 'poussoir', 'marche', 'bp', 'no', 's']
	}),
	operated({
		id: 'bouton-poussoir-nc',
		name: 'Bouton poussoir (NC)',
		prefix: 'S',
		kind: 'nc',
		terms: ['11', '12'],
		actuator: push,
		keywords: ['bouton', 'poussoir', 'arrêt', 'bp', 'nc', 's']
	}),
	operated({
		id: 'arret-urgence',
		name: "Bouton d'arrêt d'urgence",
		prefix: 'AU',
		kind: 'nc',
		terms: ['11', '12'],
		actuator: mushroom,
		keywords: ['arrêt', 'urgence', 'coup de poing', 'au', 'sécurité']
	}),
	operated({
		id: 'pressostat',
		name: 'Pressostat',
		prefix: 'Pr',
		kind: 'no',
		terms: ['13', '14'],
		actuator: box('P'),
		keywords: ['pressostat', 'pression', 'manque eau', 'capteur', 'pr']
	}),
	operated({
		id: 'thermostat',
		name: 'Thermostat',
		prefix: 'TH',
		kind: 'no',
		terms: ['1', '2'],
		actuator: box('θ'),
		keywords: ['thermostat', 'température', 'aquastat', 'sécurité', 'capteur', 'th']
	}),
	operated({
		id: 'contact-niveau',
		name: 'Contact de niveau (flotteur)',
		prefix: 'LS',
		kind: 'no',
		terms: ['1', '2'],
		actuator: float,
		keywords: ['niveau', 'flotteur', 'poire', 'capteur', 'ls']
	}),
	resistorSymbol('sonde', 'Sonde', CAT, 'B', ['sonde', 'température', 'capteur', 'qac', 'qad', 'b'])
];
