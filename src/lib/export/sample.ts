/**
 * Projet de démonstration (inspiré du folio 02 de exemple_schema) : construit par code
 * avec les opérations d'édition du modèle. Sert à la vérification visuelle de l'export
 * et de projet d'exemple.
 *
 * Folio 01 « CHAUDIERE 1 » : barres Phase 1 / Neutre / 24V / 0V, contact KM1 → borne P1 →
 * voyant chaudière H1 → P2 → Neutre (câble W1 U1000 R2V 2X1,5) ; commande : C1 → contact KA1 → bobine KM1, contact KM1
 * → voyant H2 « Marche », renvoi R1 vers le folio 02.
 * Folio 02 « COMMANDE CHAUFFE » : C2 → contact KM1 → bobine KA1 ; arrivée du renvoi R1 →
 * voyant H3 « Demande chauffe ».
 */
import {
	addBar,
	addCable,
	addFolio,
	addRect,
	addSymbol,
	addText,
	addWire,
	setSymbolTag
} from '$lib/model/edit';
import { createProject } from '$lib/model/project';
import type { Folio, Point, Project, SymbolInstance } from '$lib/model/types';
import { schematic } from '$lib/theme/schematic';

const p = (x: number, y: number): Point => ({ x, y });

function bar(folio: Folio, potentialId: string, y: number, x1: number, x2: number) {
	const b = addBar(folio, potentialId, y);
	b.x1 = x1;
	b.x2 = x2;
	return b;
}

function describe(
	project: Project,
	s: SymbolInstance,
	d: { value?: string; designation?: string; reference?: string; manufacturer?: string }
) {
	Object.assign(project.devices[s.deviceId], d);
}

export function buildSampleProject(): Project {
	const project = createProject('ESSIQUE 86 LGTS ST QUENTIN', 'V.R');
	Object.assign(project.meta, {
		affaireNumber: 'D223456',
		planNumber: 'DW261136',
		client: 'Démo — chaufferie collective',
		createdAt: '2026-09-27T08:00:00.000Z',
		modifiedAt: '2026-09-28T08:00:00.000Z'
	});
	project.revisions = [{ indice: 'A', description: 'Création du dossier', date: '27/09/2026' }];

	// ------------------------------------------------------------ folio 01
	const f1 = project.folios[0];
	f1.title = 'CHAUDIERE 1';
	bar(f1, 'L1', 22.5, 20, 140);
	bar(f1, 'N', 30, 20, 140);
	bar(f1, '24V', 22.5, 160, 287);
	bar(f1, '0V', 170, 160, 287);

	// Puissance : Phase 1 → KM1 (13-14) → P1 → H1 → P2 → Neutre
	const km1Power = addSymbol(project, f1, 'contact-no', p(50, 45));
	const p1 = addSymbol(project, f1, 'borne-p', p(50, 80));
	const p2 = addSymbol(project, f1, 'borne-p', p(30, 80));
	addSymbol(project, f1, 'voyant', p(50, 110)); // H1 : voyant de la chaudière (externe)
	addWire(f1, [p(50, 22.5), p(50, 45)]);
	addWire(f1, [p(50, 60), p(50, 80)]);
	addWire(f1, [p(50, 85), p(50, 110)]);
	addWire(f1, [p(50, 125), p(50, 132.5), p(30, 132.5), p(30, 85)]);
	addWire(f1, [p(30, 30), p(30, 80)]);
	// Équipement externe (cadre pointillé, comme la chaudière de l'exemple)
	addRect(f1, { x: 22.5, y: 102.5, w: 65, h: 37.5 });
	const boxTitle = addText(f1, p(62.5, 125), 'CHAUDIERE 1', 2.6);
	boxTitle.bold = true;
	boxTitle.color = schematic.color.reference;
	// Câble d'alimentation de la chaudière : coupe les fils de P2 (Bleu) et P1 (Marron).
	const w1 = addCable(project, f1, p(25, 92.5), p(55, 92.5), 'U1000 R2V');
	w1.section = '1,5';

	// Commande : 24V → C1 → KA1 → KM1 (A1-A2) → 0V
	const c1 = addSymbol(project, f1, 'borne-c', p(180, 45));
	const ka1Contact = addSymbol(project, f1, 'contact-no', p(180, 60));
	const km1Coil = addSymbol(project, f1, 'bobine-contacteur', p(180, 130));
	addWire(f1, [p(180, 22.5), p(180, 45)]);
	addWire(f1, [p(180, 50), p(180, 60)]);
	addWire(f1, [p(180, 75), p(180, 130)]);
	addWire(f1, [p(180, 145), p(180, 170)]);

	// Voyant de marche : 24V → KM1 (13-14) → H2 → 0V
	const km1Aux = addSymbol(project, f1, 'contact-no', p(215, 60));
	const hRun = addSymbol(project, f1, 'voyant', p(215, 130));
	addWire(f1, [p(215, 22.5), p(215, 60)]);
	addWire(f1, [p(215, 75), p(215, 130)]);
	addWire(f1, [p(215, 145), p(215, 170)]);

	// Renvoi de l'ordre de marche vers le folio 02
	const r1Out = addSymbol(project, f1, 'renvoi-sortie', p(155, 110));
	addWire(f1, [p(180, 100), p(155, 100), p(155, 110)]);

	// ------------------------------------------------------------ folio 02
	const f2 = addFolio(project, 0, 'COMMANDE CHAUFFE');
	const c2 = addSymbol(project, f2, 'borne-c', p(180, 45));
	const km1Contact2 = addSymbol(project, f2, 'contact-no', p(180, 60));
	const ka1Coil = addSymbol(project, f2, 'bobine-relais', p(180, 130));
	addWire(f2, [p(180, 22.5), p(180, 45)]);
	addWire(f2, [p(180, 50), p(180, 60)]);
	addWire(f2, [p(180, 75), p(180, 130)]);
	addWire(f2, [p(180, 145), p(180, 170)]);

	const r1In = addSymbol(project, f2, 'renvoi-entree', p(230, 90));
	const h3 = addSymbol(project, f2, 'voyant', p(230, 130));
	addWire(f2, [p(230, 90), p(230, 130)]);
	addWire(f2, [p(230, 145), p(230, 170)]);

	// ------------------------------------------------------------ repères
	for (const s of [km1Power, km1Aux, km1Contact2]) setSymbolTag(project, s, 'KM1');
	setSymbolTag(project, ka1Contact, 'KA1');
	setSymbolTag(project, ka1Coil, 'KA1');
	setSymbolTag(project, r1In, project.devices[r1Out.deviceId].tag);

	describe(project, km1Coil, {
		reference: 'LC1K0910B7',
		manufacturer: 'Schneider Electric',
		designation: 'Chaudière 1'
	});
	describe(project, ka1Coil, {
		designation: 'Demande chauffe',
		reference: 'RXM2AB2BD',
		manufacturer: 'Schneider Electric'
	});
	describe(project, hRun, { designation: 'Voyant Marche Chaudière 1', reference: 'XB7EV03BP' });
	describe(project, h3, { designation: 'Voyant Demande chauffe' });
	describe(project, p1, { designation: 'Alimentation chaudière' });
	describe(project, p2, { designation: 'Neutre chaudière' });
	describe(project, c1, { designation: 'Commande 24V' });
	describe(project, c2, { designation: 'Commande relais' });

	return project;
}
