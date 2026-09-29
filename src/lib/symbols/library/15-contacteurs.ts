import type { SymbolDef } from '../types';
import {
	auxContact,
	BLADE_MID,
	coilSymbol,
	contactorPole,
	defineSymbol,
	line,
	multipole,
	path,
	POLES_KM,
	rect,
	SPAN,
	term
} from '../helpers';

const CAT = 'Contacteurs et relais';

/** Pôles principaux de contacteur (slave) : repère + renvoi à droite, référence verticale à gauche. */
const poles = (n: number): SymbolDef => {
	const mp = multipole(POLES_KM.slice(0, n), contactorPole);
	const x = mp.lastX + 3;
	return defineSymbol({
		id: `poles-contacteur-${n}p`,
		name: `Pôles de contacteur ${n}P`,
		category: CAT,
		keywords: ['contacteur', 'pôles', 'puissance', 'km', `${n}p`],
		prefix: 'KM',
		role: 'slave',
		contactKind: 'pole',
		graphics: mp.graphics,
		terminals: mp.terminals,
		labels: {
			tag: { x, y: 6 },
			xref: { x, y: 9 },
			reference: { x: -4.5, y: SPAN / 2, anchor: 'middle', vertical: true }
		}
	});
};

/** Temporisation « travail » : parachute accroché à la lame. */
const onDelay = [
	line(BLADE_MID.dx, BLADE_MID.y, -5, BLADE_MID.y),
	line(-5, 6.4, -5, 8.4),
	path('M -5 6.4 A 1.6 1.6 0 0 0 -5 8.4')
];

export const symbols: SymbolDef[] = [
	poles(2),
	poles(3),
	defineSymbol({
		id: 'contact-inverseur',
		name: 'Contact inverseur (OF)',
		category: CAT,
		keywords: ['contact', 'inverseur', 'of', 'relais', 'défaut', 'co'],
		prefix: 'KA',
		role: 'slave',
		contactKind: 'co',
		graphics: [
			line(0, 0, 0, 5),
			line(0, 5, 2.5, 10),
			// contact à fermeture (14) ouvert
			line(0, 10, 0, SPAN),
			line(0, 10, -1, 10),
			// contact à ouverture (12) fermé
			line(2.5, 10, 2.5, SPAN)
		],
		terminals: [term('11', 0, 0, 'n'), term('14', 0, SPAN, 's'), term('12', 2.5, SPAN, 's')],
		labels: { tag: { x: 4, y: 6 }, xref: { x: 4, y: 9 } }
	}),
	auxContact(
		'contact-temporise-travail',
		'Contact temporisé travail (NO)',
		CAT,
		'KT',
		'no',
		['67', '68'],
		['contact', 'temporisé', 'temporisation', 'retard', 'travail', 'kt'],
		onDelay
	),
	coilSymbol(
		'bobine-relais-temporise',
		'Bobine de relais temporisé',
		CAT,
		'KT',
		['bobine', 'relais', 'temporisé', 'temporisation', 'kt'],
		[rect(-8.5, 5, 4, 5, { fill: 'paper' }), line(-8.5, 5, -4.5, 10), line(-8.5, 10, -4.5, 5)]
	),
	coilSymbol(
		'bobine-telerupteur',
		'Relais télérupteur',
		CAT,
		'KL',
		['télérupteur', 'bobine', 'impulsion', 'éclairage', 'kl'],
		[rect(-8.5, 5, 4, 5, { fill: 'paper' }), path('M -8 9 H -7.2 V 6 H -5.8 V 9 H -5')]
	)
];
