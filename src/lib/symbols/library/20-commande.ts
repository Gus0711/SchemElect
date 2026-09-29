import type { SymbolDef } from '../types';
import {
	circle,
	coilSymbol,
	contactNC,
	contactNO,
	leads,
	line,
	SPAN,
	vTerminals
} from '../helpers';

const CAT = 'Commande';

/** Bobine : A1 en haut, A2 en bas, repère inscrit dans le rectangle (comme WinRelais). */
const coil = (id: string, name: string, prefix: string, keywords: string[]): SymbolDef =>
	coilSymbol(id, name, CAT, prefix, keywords);

export const symbols: SymbolDef[] = [
	coil('bobine-contacteur', 'Bobine de contacteur', 'KM', ['bobine', 'contacteur', 'km']),
	coil('bobine-relais', 'Bobine de relais', 'KA', ['bobine', 'relais', 'ka', 'def', 'ma']),
	{
		id: 'contact-no',
		name: 'Contact à fermeture (NO)',
		category: CAT,
		keywords: ['contact', 'no', 'fermeture', 'auxiliaire'],
		prefix: 'KA',
		role: 'slave',
		contactKind: 'no',
		graphics: contactNO(),
		terminals: vTerminals('13', '14'),
		labels: {
			tag: { x: 3, y: 7 },
			xref: { x: 3, y: 10.2 }
		},
		bounds: { x: -3.5, y: 0, w: 5, h: SPAN }
	},
	{
		id: 'contact-nc',
		name: 'Contact à ouverture (NC)',
		category: CAT,
		keywords: ['contact', 'nc', 'ouverture', 'auxiliaire'],
		prefix: 'KA',
		role: 'slave',
		contactKind: 'nc',
		graphics: contactNC(),
		terminals: vTerminals('11', '12'),
		labels: {
			tag: { x: 4.5, y: 7 },
			xref: { x: 4.5, y: 10.2 }
		},
		bounds: { x: -1, y: 0, w: 5, h: SPAN }
	},
	{
		id: 'voyant',
		name: 'Voyant lumineux',
		category: CAT,
		keywords: ['voyant', 'lampe', 'signalisation', 'h'],
		prefix: 'H',
		role: 'standalone',
		graphics: [
			...leads(4.5, 10.5),
			// Teinte `signal` : couleur du voyant saisie en valeur (« Rouge », « Vert »…).
			circle(0, 7.5, 3, { fill: 'paper', tone: 'signal' }),
			line(-2.12, 5.38, 2.12, 9.62, 'normal', 'signal'),
			line(-2.12, 9.62, 2.12, 5.38, 'normal', 'signal')
		],
		terminals: vTerminals('X1', 'X2'),
		labels: {
			tag: { x: 4, y: 8.3 },
			designation: { x: 4, y: 11.2 }
		},
		bounds: { x: -3, y: 0, w: 6, h: SPAN }
	}
];
