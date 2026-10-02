import type { Prim, SymbolDef } from '../types';
import {
	actuatorLink,
	circle,
	coilSymbol,
	contactNC,
	contactNO,
	defineSymbol,
	line,
	multipole,
	path,
	rect,
	resistorSymbol,
	sideLabels,
	term,
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
/** Boîte d'organe de commande contenant un graphisme quelconque. */
const boxWith = (inner: Prim[]): Prim[] => [rect(ACT - 3, 5.9, 3, 3, { fill: 'paper' }), ...inner];
/** Commande manuelle générale (trait). */
const manual: Prim[] = [line(ACT, 5.9, ACT, 8.9)];
/** Commande par clé. */
const key: Prim[] = [
	circle(ACT - 3, 7.4, 0.9),
	line(ACT - 2.1, 7.4, ACT, 7.4),
	line(ACT - 0.9, 7.4, ACT - 0.9, 8.5)
];
/** Débit : flèche dans la boîte. */
const flow: Prim[] = boxWith([
	path(`M ${ACT - 2.6} 7.4 H ${ACT - 0.4} M ${ACT - 1.2} 6.7 L ${ACT - 0.4} 7.4 L ${ACT - 1.2} 8.1`)
]);
const float: Prim[] = [line(ACT, 7.4, ACT, 9), circle(ACT, 10.3, 1.3)];
const positions = (labels: string[]): Prim[] =>
	labels.map((l, i) =>
		text(ACT - 3 + (3 * i) / Math.max(1, labels.length - 1), 3.6, l, {
			size: 1.8,
			anchor: 'middle'
		})
	);

/**
 * Fin de course : came (triangle) portée par la lame, pointe sur la lame
 * (x = abscisse de la lame à mi-hauteur, côté = -1 à gauche, +1 à droite).
 */
const cam = (x: number, side: -1 | 1): Prim[] => [
	path(`M ${x} 7.4 L ${x + side * 2.3} 6.2 L ${x + side * 2.3} 8.6 Z`)
];

/**
 * Détecteur 3 fils (BN +, BU −, BK sortie) : boîte avec losange (détection de proximité)
 * et qualificatif du principe de détection.
 */
function sensor3w(id: string, name: string, kind: string, qualifier: Prim[]): SymbolDef {
	return defineSymbol({
		id,
		name,
		category: CAT,
		keywords: ['détecteur', 'capteur', 'proximité', '3 fils', 'pnp', 'npn', kind, 'b'],
		prefix: 'B',
		role: 'standalone',
		graphics: [
			line(0, 0, 0, 4),
			line(0, 11, 0, 15),
			line(7.5, 11, 7.5, 15),
			rect(-2.5, 4, 12.5, 7, { fill: 'paper' }),
			path('M 2.5 5.5 L 4.5 7.5 L 2.5 9.5 L 0.5 7.5 Z'),
			...qualifier
		],
		terminals: [term('BN', 0, 0, 'n'), term('BU', 0, 15, 's'), term('BK', 7.5, 15, 's')],
		labels: {
			tag: { x: 11.5, y: 6 },
			value: { x: 11.5, y: 8.8 },
			designation: { x: 11.5, y: 11.4 }
		},
		defaults: { value: 'PNP NO' }
	});
}

/** Contact à 2 bornes actionné par un organe de commande (appareil autonome). */
function operated(o: {
	id: string;
	name: string;
	prefix: string;
	kind: 'no' | 'nc';
	terms: [string, string];
	actuator: Prim[];
	keywords: string[];
	/** Organe dessiné directement sur la lame (pas de liaison mécanique). */
	direct?: boolean;
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
			...(o.direct ? [] : [actuatorLink(ACT, no ? undefined : NC_BLADE_X)]),
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
	resistorSymbol('sonde', 'Sonde', CAT, 'B', [
		'sonde',
		'température',
		'capteur',
		'qac',
		'qad',
		'b'
	]),
	operated({
		id: 'interrupteur',
		name: 'Interrupteur (commande manuelle)',
		prefix: 'S',
		kind: 'no',
		terms: ['1', '2'],
		actuator: manual,
		keywords: ['interrupteur', 'commande manuelle', 'marche', 'arrêt', 's']
	}),
	operated({
		id: 'commutateur-0-1',
		name: 'Commutateur 2 positions 0-1',
		prefix: 'S',
		kind: 'no',
		terms: ['13', '14'],
		actuator: [...rotary, ...positions(['0', '1'])],
		keywords: ['commutateur', 'sélecteur', 'marche', 'arrêt', '0-1', 's']
	}),
	operated({
		id: 'commutateur-a-cle',
		name: 'Commutateur à clé',
		prefix: 'S',
		kind: 'no',
		terms: ['13', '14'],
		actuator: key,
		keywords: ['commutateur', 'clé', 'serrure', 'verrouillage', 'condamnation', 's']
	}),
	operated({
		id: 'fin-de-course-no',
		name: 'Interrupteur de position / fin de course (NO)',
		prefix: 'SQ',
		kind: 'no',
		terms: ['13', '14'],
		actuator: cam(-1.5, -1),
		direct: true,
		keywords: ['fin de course', 'position', 'contact de porte', 'came', 'sq', 'no']
	}),
	operated({
		id: 'fin-de-course-nc',
		name: 'Interrupteur de position / fin de course (NC)',
		prefix: 'SQ',
		kind: 'nc',
		terms: ['11', '12'],
		actuator: cam(NC_BLADE_X, 1),
		direct: true,
		keywords: ['fin de course', 'position', 'contact de porte', 'came', 'sq', 'nc']
	}),
	operated({
		id: 'pressostat-nc',
		name: 'Pressostat (NC)',
		prefix: 'Pr',
		kind: 'nc',
		terms: ['11', '12'],
		actuator: box('P'),
		keywords: ['pressostat', 'pression', 'haute pression', 'sécurité', 'capteur', 'pr', 'nc']
	}),
	operated({
		id: 'thermostat-securite',
		name: 'Thermostat de sécurité (NC)',
		prefix: 'TH',
		kind: 'nc',
		terms: ['1', '2'],
		actuator: box('θ'),
		keywords: ['thermostat', 'sécurité', 'aquastat', 'surchauffe', 'température', 'th', 'nc']
	}),
	operated({
		id: 'controleur-debit',
		name: 'Contrôleur de débit',
		prefix: 'FS',
		kind: 'no',
		terms: ['13', '14'],
		actuator: flow,
		keywords: ['débit', 'contrôleur', 'palette', 'flow switch', 'capteur', 'fs']
	}),
	operated({
		id: 'hygrostat',
		name: 'Hygrostat',
		prefix: 'B',
		kind: 'no',
		terms: ['1', '2'],
		actuator: box('%'),
		keywords: ['hygrostat', 'humidité', 'capteur', 'b']
	}),
	sensor3w('detecteur-inductif', 'Détecteur inductif 3 fils', 'inductif', [
		path('M 5.5 7.5 A 0.5 0.5 0 0 1 6.5 7.5 A 0.5 0.5 0 0 1 7.5 7.5 A 0.5 0.5 0 0 1 8.5 7.5')
	]),
	sensor3w('detecteur-capacitif', 'Détecteur capacitif 3 fils', 'capacitif', [
		line(6.5, 6, 6.5, 9),
		line(7.7, 6, 7.7, 9)
	]),
	sensor3w('detecteur-photoelectrique', 'Détecteur photoélectrique 3 fils', 'photoélectrique', [
		path('M 9 5.3 L 6.5 6.8 M 7.4 6.7 L 6.5 6.8 L 7 6'),
		path('M 9 7.3 L 6.5 8.8 M 7.4 8.7 L 6.5 8.8 L 7 8')
	]),
	defineSymbol({
		id: 'transmetteur-4-20ma',
		name: 'Transmetteur 4-20 mA (2 fils)',
		category: CAT,
		keywords: ['transmetteur', 'capteur', '4-20mA', 'analogique', 'pression', 'température', 'b'],
		prefix: 'B',
		role: 'standalone',
		graphics: [
			line(0, 0, 0, 4),
			line(0, 11, 0, 15),
			rect(-3, 4, 6, 7, { fill: 'paper' }),
			text(0, 7.2, '4-20', { size: 1.6, anchor: 'middle' }),
			text(0, 9.6, 'mA', { size: 1.6, anchor: 'middle' })
		],
		terminals: vTerminals('+', '-'),
		labels: { tag: { x: 4, y: 6 }, value: { x: 4, y: 8.8 }, designation: { x: 4, y: 11.4 } }
	}),
	coilSymbol(
		'horloge',
		'Horloge / interrupteur horaire',
		CAT,
		'KH',
		['horloge', 'interrupteur horaire', 'programmateur', 'minuterie', 'programme', 'kh'],
		[
			circle(-6.5, 7.5, 2, { fill: 'paper' }),
			line(-6.5, 7.5, -6.5, 6.1),
			line(-6.5, 7.5, -5.4, 7.5)
		]
	)
];
