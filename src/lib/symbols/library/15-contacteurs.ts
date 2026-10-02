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
	term,
	text
} from '../helpers';

const CAT = 'Contacteurs et relais';

/** Pôles principaux de contacteur (slave) : repère + renvoi à droite, référence verticale à gauche. */
/** Pôles principaux de contacteur, jusqu'au 4e pôle. */
const POLES_KM4: [string, string][] = [...POLES_KM, ['7/L4', '8/T4']];

const poles = (n: number): SymbolDef => {
	const mp = multipole(POLES_KM4.slice(0, n), contactorPole);
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

/**
 * Temporisation accrochée à la lame (abscisse `bladeX`) : parachute ouvert vers la gauche
 * pour « travail » (retard à l'action), vers la lame pour « repos » (retard au relâchement).
 */
const delay = (bladeX: number, onDelay: boolean) => [
	line(bladeX, BLADE_MID.y, -5, BLADE_MID.y),
	line(-5, 6.4, -5, 8.4),
	path(`M -5 6.4 A 1.6 1.6 0 0 ${onDelay ? 0 : 1} -5 8.4`)
];
const onDelay = delay(BLADE_MID.dx, true);

/** Contact temporisé (slave KT). */
const timedContact = (id: string, name: string, kind: 'no' | 'nc', on: boolean): SymbolDef =>
	auxContact(
		id,
		name,
		CAT,
		'KT',
		kind,
		kind === 'no' ? ['67', '68'] : ['55', '56'],
		['contact', 'temporisé', 'temporisation', 'retard', on ? 'travail' : 'repos', 'kt', kind],
		delay(kind === 'no' ? BLADE_MID.dx : 1.5, on)
	);

export const symbols: SymbolDef[] = [
	poles(2),
	poles(3),
	poles(4),
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
	timedContact('contact-temporise-travail-nc', 'Contact temporisé travail (NC)', 'nc', true),
	timedContact('contact-temporise-repos', 'Contact temporisé repos (NO)', 'no', false),
	timedContact('contact-temporise-repos-nc', 'Contact temporisé repos (NC)', 'nc', false),
	coilSymbol(
		'bobine-relais-temporise-repos',
		'Bobine de relais temporisé au repos',
		CAT,
		'KT',
		['bobine', 'relais', 'temporisé', 'repos', 'retard', 'déclenchement', 'kt'],
		[rect(-8.5, 5, 4, 5, { fill: 'ink' })]
	),
	defineSymbol({
		id: 'relais-controle-phases',
		name: 'Relais de contrôle de phases',
		category: CAT,
		keywords: ['relais', 'contrôle', 'phases', 'surveillance', 'ordre', 'manque', 'rm', 'ka'],
		prefix: 'KA',
		role: 'master',
		graphics: [
			line(0, 0, 0, 5),
			line(7.5, 0, 7.5, 5),
			line(15, 0, 15, 5),
			rect(-2.5, 5, 20, 7.5, { fill: 'paper' }),
			text(7.5, 9.8, '3~', { size: 2.5, anchor: 'middle' })
		],
		terminals: [term('L1', 0, 0, 'n'), term('L2', 7.5, 0, 'n'), term('L3', 15, 0, 'n')],
		labels: {
			tag: { x: 19, y: 6.5 },
			value: { x: 19, y: 9.3 },
			designation: { x: 19, y: 12 },
			xref: { x: -2.5, y: 15 }
		}
	}),
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
