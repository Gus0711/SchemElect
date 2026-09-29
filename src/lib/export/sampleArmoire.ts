/**
 * Exemple complet et simple d'armoire de chaufferie, construit par code avec les
 * opérations d'édition du modèle (comme `sample.ts`) :
 *
 * - 01 DISTRIBUTION : arrivée P1/P2 → interrupteur général QS1 → différentiel ID1 → barres
 *   Phase 1 / Neutre ; voyant « Sous tension » H1 ; prise de service Q2 + XP1 ;
 *   transformateur Q1 + TT1 230/24V dont le secondaire part en renvois (24V / 0V).
 * - 02 CHAUDIÈRE 1 : Q4 → KM1 → P3/P4 → chaudière (câble W1) ; commande Auto/Manu S1 → KM1,
 *   voyant de marche H2, défaut chaudière DEF1 → C1/C2 → voyant rouge H3.
 * - 03 POMPE CHAUFFAGE : Q5 → KM2 → P5/P6 → pompe M1 (câble W2) ; S2 → KM2, voyant de marche
 *   H4, défaut (déclenchement Q5) → voyant rouge H5.
 * - 04 IMPLANTATION : armoire 800 × 600 × 250, 3 rails, appareils rangés automatiquement.
 * - 05 FAÇADE : voyants et commutateurs, une rangée par folio du schéma.
 */
import {
	addBar,
	addCable,
	addFolio,
	addPanelFolio,
	addRect,
	addSymbol,
	addText,
	addWire,
	setSymbolTag
} from '$lib/model/edit';
import { autoPlace, defaultLayoutOptions, generateLayout } from '$lib/model/panel';
import { createProject } from '$lib/model/project';
import type { Device, Folio, Point, Project, SymbolInstance } from '$lib/model/types';
import { schematic } from '$lib/theme/schematic';

const p = (x: number, y: number): Point => ({ x, y });

function bar(folio: Folio, potentialId: string, y: number, x1: number, x2: number) {
	const b = addBar(folio, potentialId, y);
	b.x1 = x1;
	b.x2 = x2;
}

/** Symbole + description de son appareil. */
function put(
	project: Project,
	folio: Folio,
	defId: string,
	at: Point,
	d: Partial<Omit<Device, 'id' | 'tag'>> = {}
): SymbolInstance {
	const s = addSymbol(project, folio, defId, at);
	if (s.deviceId) Object.assign(project.devices[s.deviceId], d);
	return s;
}

const tagOf = (project: Project, s: SymbolInstance) => project.devices[s.deviceId].tag;

/** Équipement hors armoire : cadre pointillé titré. */
function equipment(folio: Folio, x: number, y: number, w: number, h: number, title: string) {
	addRect(folio, { x, y, w, h });
	const t = addText(folio, p(x + w - 2.5, y + h - 3), title, 2.6);
	t.bold = true;
	t.anchor = 'end';
	t.color = schematic.color.reference;
}

/**
 * Départ moteur / équipement commandé par contacteur (folios 02 et 03) : puissance à
 * gauche (barres Phase 1 / Neutre), commande à droite (barres 24V / 0V).
 */
function feeder(
	project: Project,
	f: Folio,
	o: {
		breaker: Partial<Device>;
		coil: Partial<Device>;
		selector: Partial<Device>;
		run: Partial<Device>;
		fault: Partial<Device>;
		/** Défaut : contact de l'équipement (externe) ou contact auxiliaire du disjoncteur. */
		faultFromBreaker: boolean;
		equipmentTitle: string;
		motor: boolean;
		cable: string;
	}
) {
	bar(f, 'L1', 22.5, 20, 140);
	bar(f, 'N', 30, 20, 140);
	bar(f, '24V', 30, 150, 287);
	bar(f, '0V', 170, 150, 287);

	// ---- commande (bobine créée d'abord : repère KM1 / KM2)
	const coil = put(project, f, 'bobine-contacteur', p(222.5, 120), o.coil);
	put(project, f, 'commutateur-a-m', p(222.5, 45), o.selector);
	addWire(f, [p(222.5, 30), p(222.5, 45)]);
	addWire(f, [p(222.5, 60), p(222.5, 120)]);
	addWire(f, [p(222.5, 135), p(222.5, 170)]);

	const aux = put(project, f, 'contact-no', p(257.5, 60));
	put(project, f, 'voyant', p(257.5, 120), o.run);
	addWire(f, [p(257.5, 30), p(257.5, 60)]);
	addWire(f, [p(257.5, 75), p(257.5, 120)]);
	addWire(f, [p(257.5, 135), p(257.5, 170)]);

	// ---- puissance : disjoncteur → pôles du contacteur → bornier P → équipement
	const breaker = put(project, f, 'disjoncteur-1p-n', p(40, 45), o.breaker);
	addWire(f, [p(40, 22.5), p(40, 45)]);
	addWire(f, [p(47.5, 30), p(47.5, 45)]);
	const poles = put(project, f, 'poles-contacteur-2p', p(40, 70));
	addWire(f, [p(40, 60), p(40, 70)]);
	addWire(f, [p(47.5, 60), p(47.5, 70)]);
	put(project, f, 'borne-p', p(40, 95), { designation: `${o.equipmentTitle} phase` });
	put(project, f, 'borne-p', p(47.5, 95), { designation: `${o.equipmentTitle} neutre` });
	addWire(f, [p(40, 85), p(40, 95)]);
	addWire(f, [p(47.5, 85), p(47.5, 95)]);

	if (o.motor) {
		put(project, f, 'moteur-mono', p(40, 125), {
			designation: o.equipmentTitle,
			value: '0,37 kW'
		});
		addWire(f, [p(40, 100), p(40, 125)]);
		addWire(f, [p(47.5, 100), p(47.5, 125)]);
		addWire(f, [p(55, 125), p(55, 120)]);
		addText(f, p(56, 121.5), 'PE', 1.8);
		equipment(f, 25, 117.5, 55, 42.5, o.equipmentTitle);
	} else {
		addWire(f, [p(40, 100), p(40, 127.5)]);
		addWire(f, [p(47.5, 100), p(47.5, 127.5)]);
		addText(f, p(39, 131), 'L', 1.8).anchor = 'end';
		addText(f, p(48.5, 131), 'N', 1.8);
		equipment(f, 25, 117.5, 110, 50, o.equipmentTitle);
	}
	addCable(project, f, p(35, 112.5), p(52.5, 112.5), o.cable).section = '1,5';

	// ---- défaut → voyant rouge
	put(project, f, 'voyant', p(187.5, 152.5), o.fault);
	addWire(f, [p(187.5, 167.5), p(187.5, 170)]);
	if (o.faultFromBreaker) {
		// Contact auxiliaire du disjoncteur (déclenchement) dans l'armoire.
		const q = put(project, f, 'contact-aux-disjoncteur-no', p(187.5, 60));
		addWire(f, [p(187.5, 30), p(187.5, 60)]);
		addWire(f, [p(187.5, 75), p(187.5, 152.5)]);
		setSymbolTag(project, q, tagOf(project, breaker));
	} else {
		// Contact sec de défaut de l'équipement, repris sur le bornier de commande.
		put(project, f, 'borne-c', p(187.5, 45), { designation: 'Défaut chaudière' });
		put(project, f, 'borne-c', p(187.5, 137.5), { designation: 'Retour défaut' });
		addWire(f, [p(187.5, 30), p(187.5, 45)]);
		const def = put(project, f, 'contact-no', p(125, 125), {
			designation: 'Contact de défaut chaudière',
			mounting: 'externe'
		});
		setSymbolTag(project, def, 'DEF1');
		addWire(f, [p(187.5, 50), p(187.5, 95), p(125, 95), p(125, 125)]);
		addWire(f, [
			p(125, 140),
			p(125, 145),
			p(145, 145),
			p(145, 132.5),
			p(187.5, 132.5),
			p(187.5, 137.5)
		]);
		addWire(f, [p(187.5, 142.5), p(187.5, 152.5)]);
	}

	for (const s of [poles, aux]) setSymbolTag(project, s, tagOf(project, coil));
}

export function buildSampleArmoire(): Project {
	const project = createProject('EXEMPLE — ARMOIRE CHAUFFERIE', 'V.R');
	Object.assign(project.meta, {
		affaireNumber: 'D260001',
		planNumber: 'DW-EXEMPLE',
		client: 'Exemple — chaufferie 1 chaudière + 1 pompe'
	});
	project.revisions = [
		{ indice: 'A', description: 'Création du dossier', date: '29/09/2026' },
		{ indice: 'B', description: 'Ajout implantation et façade', date: '29/09/2026' }
	];

	// ------------------------------------------------------------ 01 DISTRIBUTION
	const f1 = project.folios[0];
	f1.title = 'DISTRIBUTION';
	bar(f1, 'L1', 110, 20, 200);
	bar(f1, 'N', 117.5, 20, 200);

	const arrival = addText(f1, p(22.5, 35), 'ARRIVÉE 230V', 2.4);
	arrival.bold = true;
	put(project, f1, 'borne-p', p(30, 40), { designation: 'Arrivée phase' });
	put(project, f1, 'borne-p', p(37.5, 40), { designation: 'Arrivée neutre' });
	addWire(f1, [p(30, 45), p(30, 55)]);
	addWire(f1, [p(37.5, 45), p(37.5, 55)]);
	put(project, f1, 'interrupteur-sectionneur-2p', p(30, 55), {
		value: '40A',
		designation: 'Interrupteur général',
		reference: 'A9S65240'
	});
	addWire(f1, [p(30, 70), p(30, 80)]);
	addWire(f1, [p(37.5, 70), p(37.5, 80)]);
	put(project, f1, 'interrupteur-differentiel-2p', p(30, 80), {
		value: '40A 30mA',
		designation: 'Différentiel général',
		reference: 'A9R11240'
	});
	addWire(f1, [p(30, 95), p(30, 110)]);
	addWire(f1, [p(37.5, 95), p(37.5, 117.5)]);

	// Voyant sous tension
	put(project, f1, 'voyant', p(70, 125), { value: 'Blanc', designation: 'Sous tension' });
	addWire(f1, [p(70, 110), p(70, 125)]);
	addWire(f1, [p(70, 140), p(70, 147.5), p(77.5, 147.5), p(77.5, 117.5)]);

	// Prise de service
	put(project, f1, 'disjoncteur-1p-n', p(110, 125), {
		value: '16A courbe C',
		designation: 'Prise de service'
	});
	addWire(f1, [p(110, 110), p(110, 125)]);
	addWire(f1, [p(117.5, 117.5), p(117.5, 125)]);
	put(project, f1, 'prise-2p-t', p(110, 155), { designation: 'Prise de service' });
	addWire(f1, [p(110, 140), p(110, 155)]);
	addWire(f1, [p(117.5, 140), p(117.5, 147.5), p(115, 147.5), p(115, 155)]);
	addWire(f1, [p(120, 155), p(120, 150), p(130, 150)]);
	addText(f1, p(131, 151), 'PE', 1.8);

	// Transformateur de commande 230/24V
	put(project, f1, 'disjoncteur-2p', p(160, 125), {
		value: '2A courbe C',
		designation: 'Protection transformateur'
	});
	addWire(f1, [p(160, 110), p(160, 125)]);
	addWire(f1, [p(167.5, 117.5), p(167.5, 125)]);
	put(project, f1, 'transformateur', p(160, 147.5), {
		value: '230/24V 63VA',
		designation: 'Transformateur de commande'
	});
	addWire(f1, [p(160, 140), p(160, 147.5)]);
	addWire(f1, [p(167.5, 140), p(167.5, 147.5)]);
	const r24 = put(project, f1, 'renvoi-sortie', p(160, 180), { designation: '24V' });
	const r0 = put(project, f1, 'renvoi-sortie', p(167.5, 180), { designation: '0V' });
	addWire(f1, [p(160, 172.5), p(160, 180)]);
	addWire(f1, [p(167.5, 172.5), p(167.5, 180)]);
	addText(f1, p(172, 184), '24V / 0V vers folio 02', 1.8);

	// ------------------------------------------------------------ 02 CHAUDIÈRE 1
	const f2 = addFolio(project, 0, 'CHAUDIÈRE 1');
	f2.bars = [];
	feeder(project, f2, {
		breaker: { value: '10A courbe C', designation: 'Chaudière 1' },
		coil: {
			designation: 'Chaudière 1',
			reference: 'LC1K0910B7',
			manufacturer: 'Schneider Electric',
			contacts: { no: 1, nc: 0 }
		},
		selector: { designation: 'Auto / Manu chaudière 1' },
		run: { value: 'Vert', designation: 'Marche chaudière 1' },
		fault: { value: 'Rouge', designation: 'Défaut chaudière 1' },
		faultFromBreaker: false,
		equipmentTitle: 'CHAUDIÈRE 1',
		motor: false,
		cable: 'U1000 R2V'
	});
	// Arrivée du 24V / 0V venant du transformateur (folio 01).
	const r24in = put(project, f2, 'renvoi-entree', p(280, 22.5));
	addWire(f2, [p(280, 22.5), p(280, 30)]);
	const r0in = put(project, f2, 'renvoi-entree', p(280, 160));
	addWire(f2, [p(280, 160), p(280, 170)]);
	setSymbolTag(project, r24in, tagOf(project, r24));
	setSymbolTag(project, r0in, tagOf(project, r0));

	// ------------------------------------------------------------ 03 POMPE CHAUFFAGE
	const f3 = addFolio(project, 1, 'POMPE CHAUFFAGE');
	f3.bars = [];
	feeder(project, f3, {
		breaker: { value: '6A courbe C', designation: 'Pompe chauffage' },
		coil: {
			designation: 'Pompe chauffage',
			reference: 'LC1K0910B7',
			manufacturer: 'Schneider Electric'
		},
		selector: { designation: 'Auto / Manu pompe' },
		run: { value: 'Vert', designation: 'Marche pompe' },
		fault: { value: 'Rouge', designation: 'Défaut pompe' },
		faultFromBreaker: true,
		equipmentTitle: 'POMPE CHAUFFAGE',
		motor: true,
		cable: 'U1000 R2V'
	});

	// ------------------------------------------------------------ 04 IMPLANTATION
	const impl = addPanelFolio(project, 2, 'implantation');
	impl.panel!.enclosure = { w: 600, h: 800, d: 250 };
	generateLayout(impl.panel!, defaultLayoutOptions(impl.panel!.enclosure));
	autoPlace(project, impl);

	// ------------------------------------------------------------ 05 FAÇADE
	const facade = addPanelFolio(project, 3, 'facade');
	autoPlace(project, facade);

	return project;
}
