/**
 * Catalogue de départ, proposé une fois sur la page « Catalogue » quand la bibliothèque
 * est vide (bouton « Importer le catalogue de départ »).
 *
 * - « Relevé dossier DW261136 » : références trouvées dans le dossier WinRelais de
 *   référence (`exemple_schema/`) ;
 * - les autres : références courantes du matériel d'armoire GTB / chaufferie.
 *
 * Toutes les fiches sont marquées « à vérifier » : désignations, contacts et surtout
 * encombrements doivent être confirmés sur les fiches techniques avant de s'y fier.
 */
import type { CatalogItem } from './catalog';

const CHECK = 'Catalogue de départ — à vérifier';
const DOSSIER = 'Relevé dossier DW261136 — à vérifier';

type Starter = Omit<CatalogItem, 'id'>;

const SE = 'Schneider Electric';

/** Contacteur TeSys K (bobine 24 V CA : suffixe B7). */
const tesysK = (ref: string, amps: number, aux: 'NO' | 'NC', notes = CHECK): Starter => ({
	reference: ref,
	manufacturer: SE,
	designation: `Contacteur TeSys K 3P ${amps} A AC-3, 1 ${aux} aux., bobine 24 V CA`,
	category: 'Contacteur',
	contacts: aux === 'NO' ? { no: 1, nc: 0 } : { no: 0, nc: 1 },
	w: 45,
	h: 58,
	mounting: 'rail',
	notes
});

/** Contacteur TeSys D (1 NO + 1 NC intégrés, bobine 24 V CA). */
const tesysD = (ref: string, amps: number): Starter => ({
	reference: ref,
	manufacturer: SE,
	designation: `Contacteur TeSys D 3P ${amps} A AC-3, 1 NO + 1 NC, bobine 24 V CA`,
	category: 'Contacteur',
	contacts: { no: 1, nc: 1 },
	w: 45,
	h: 77,
	mounting: 'rail',
	notes: CHECK
});

/** Disjoncteur moteur TeSys GV2ME (réglage thermique). */
const gv2 = (ref: string, range: string): Starter => ({
	reference: ref,
	manufacturer: SE,
	designation: `Disjoncteur moteur TeSys GV2ME, réglage ${range} A`,
	category: 'Disjoncteur moteur',
	w: 45,
	h: 89,
	mounting: 'rail',
	notes: CHECK
});

/** Disjoncteur Acti9 iC60N courbe C. */
const ic60 = (poles: 1 | 2 | 3 | 4, amps: number): Starter => ({
	reference: `A9F74${poles}${String(amps).padStart(2, '0')}`,
	manufacturer: SE,
	designation: `Disjoncteur Acti9 iC60N ${poles}P C${amps}`,
	category: 'Disjoncteur',
	w: poles * 18,
	h: 85,
	mounting: 'rail',
	notes: CHECK
});

const harmony = (ref: string, designation: string, extra: Partial<Starter> = {}): Starter => ({
	reference: ref,
	manufacturer: SE,
	designation,
	category: 'Façade',
	w: 30,
	h: 30,
	mounting: 'porte',
	notes: CHECK,
	...extra
});

export const STARTER_CATALOG: Starter[] = [
	// --- Relevés dans le dossier de référence
	tesysK('LC1K0910B7', 9, 'NO', DOSSIER),
	tesysK('LC1K0610B7', 6, 'NO', DOSSIER),
	{
		reference: 'ZBE101',
		manufacturer: SE,
		designation: 'Bloc contact 1 NO pour tête Harmony Ø22',
		category: 'Façade',
		notes: DOSSIER
	},
	{
		reference: '4 067 71',
		manufacturer: 'Legrand',
		designation: 'Appareil modulaire 2 pôles (désignation à compléter)',
		category: 'Protection',
		mounting: 'rail',
		notes: DOSSIER
	},
	{
		reference: '676313',
		manufacturer: '',
		designation: 'Prise de courant 2P+T pour armoire',
		category: 'Divers',
		mounting: 'rail',
		notes: `${DOSSIER} (code fournisseur Z 000 377 838)`
	},

	// --- Contacteurs
	tesysK('LC1K0901B7', 9, 'NC'),
	tesysD('LC1D09B7', 9),
	tesysD('LC1D12B7', 12),
	tesysD('LC1D18B7', 18),
	tesysD('LC1D25B7', 25),
	{
		reference: 'LADN11',
		manufacturer: SE,
		designation: 'Bloc de contacts auxiliaires frontal TeSys D, 1 NO + 1 NC',
		category: 'Contacteur',
		notes: CHECK
	},
	{
		reference: 'LADN22',
		manufacturer: SE,
		designation: 'Bloc de contacts auxiliaires frontal TeSys D, 2 NO + 2 NC',
		category: 'Contacteur',
		notes: CHECK
	},

	// --- Disjoncteurs moteur
	gv2('GV2ME05', '0,63–1'),
	gv2('GV2ME06', '1–1,6'),
	gv2('GV2ME07', '1,6–2,5'),
	gv2('GV2ME08', '2,5–4'),
	gv2('GV2ME10', '4–6,3'),
	gv2('GV2ME14', '6–10'),
	gv2('GV2ME16', '9–14'),
	{
		reference: 'GVAE11',
		manufacturer: SE,
		designation: 'Contact auxiliaire frontal pour GV2, 1 NO + 1 NC',
		category: 'Disjoncteur moteur',
		notes: CHECK
	},

	// --- Disjoncteurs modulaires
	ic60(1, 2),
	ic60(1, 10),
	ic60(1, 16),
	ic60(2, 2),
	ic60(2, 6),
	ic60(2, 10),
	ic60(2, 16),
	ic60(2, 20),
	ic60(3, 16),
	ic60(4, 16),
	ic60(4, 25),
	{
		reference: 'A9R11240',
		manufacturer: SE,
		designation: 'Interrupteur différentiel Acti9 iID 2P 40 A 30 mA type AC',
		category: 'Protection',
		w: 36,
		h: 85,
		mounting: 'rail',
		notes: CHECK
	},
	{
		reference: 'A9R11440',
		manufacturer: SE,
		designation: 'Interrupteur différentiel Acti9 iID 4P 40 A 30 mA type AC',
		category: 'Protection',
		w: 72,
		h: 85,
		mounting: 'rail',
		notes: CHECK
	},

	// --- Relais
	{
		reference: 'RXM2AB2B7',
		manufacturer: SE,
		designation: 'Relais Zelio RXM 2 OF 12 A, bobine 24 V CA',
		category: 'Relais',
		contacts: { no: 2, nc: 2 },
		mounting: 'rail',
		accessories: [{ reference: 'RXZE2S108M', quantity: 1 }],
		notes: CHECK
	},
	{
		reference: 'RXM4AB2B7',
		manufacturer: SE,
		designation: 'Relais Zelio RXM 4 OF 6 A, bobine 24 V CA',
		category: 'Relais',
		contacts: { no: 4, nc: 4 },
		mounting: 'rail',
		accessories: [{ reference: 'RXZE2S114M', quantity: 1 }],
		notes: CHECK
	},
	{
		reference: 'RXM2AB2BD',
		manufacturer: SE,
		designation: 'Relais Zelio RXM 2 OF 12 A, bobine 24 V CC',
		category: 'Relais',
		contacts: { no: 2, nc: 2 },
		mounting: 'rail',
		accessories: [{ reference: 'RXZE2S108M', quantity: 1 }],
		notes: CHECK
	},
	{
		reference: 'RXM4AB2BD',
		manufacturer: SE,
		designation: 'Relais Zelio RXM 4 OF 6 A, bobine 24 V CC',
		category: 'Relais',
		contacts: { no: 4, nc: 4 },
		mounting: 'rail',
		accessories: [{ reference: 'RXZE2S114M', quantity: 1 }],
		notes: CHECK
	},
	{
		reference: '40.52.8.024.0000',
		manufacturer: 'Finder',
		designation: 'Relais 40.52, 2 RT 8 A, bobine 24 V CA',
		category: 'Relais',
		contacts: { no: 2, nc: 2 },
		mounting: 'rail',
		accessories: [{ reference: '95.05', quantity: 1 }],
		notes: CHECK
	},
	{
		reference: '40.52.9.024.0000',
		manufacturer: 'Finder',
		designation: 'Relais 40.52, 2 RT 8 A, bobine 24 V CC',
		category: 'Relais',
		contacts: { no: 2, nc: 2 },
		mounting: 'rail',
		accessories: [{ reference: '95.05', quantity: 1 }],
		notes: CHECK
	},

	{
		reference: 'RXZE2S108M',
		manufacturer: SE,
		designation: 'Embase à contacts séparés pour relais Zelio RXM 2 OF',
		category: 'Relais',
		mounting: 'rail',
		notes: CHECK
	},
	{
		reference: 'RXZE2S114M',
		manufacturer: SE,
		designation: 'Embase à contacts séparés pour relais Zelio RXM 4 OF',
		category: 'Relais',
		mounting: 'rail',
		notes: CHECK
	},
	{
		reference: '95.05',
		manufacturer: 'Finder',
		designation: 'Support à vis pour relais 40.52',
		category: 'Relais',
		mounting: 'rail',
		notes: CHECK
	},

	// --- Alimentations
	{
		reference: 'ABL8REM24030',
		manufacturer: SE,
		designation: 'Alimentation à découpage Phaseo 24 V CC 3 A',
		category: 'Alimentation',
		mounting: 'rail',
		notes: CHECK
	},
	{
		reference: 'ABL8REM24050',
		manufacturer: SE,
		designation: 'Alimentation à découpage Phaseo 24 V CC 5 A',
		category: 'Alimentation',
		mounting: 'rail',
		notes: CHECK
	},

	// --- Façade (Harmony XB5, Ø22)
	harmony('XB5AVB1', 'Voyant lumineux Ø22 blanc, DEL 24 V'),
	harmony('XB5AVB3', 'Voyant lumineux Ø22 vert, DEL 24 V'),
	harmony('XB5AVB4', 'Voyant lumineux Ø22 rouge, DEL 24 V'),
	harmony('XB5AVB5', 'Voyant lumineux Ø22 orange, DEL 24 V'),
	harmony('XB5AA31', 'Bouton-poussoir Ø22 vert affleurant, 1 NO'),
	harmony('XB5AA42', 'Bouton-poussoir Ø22 rouge affleurant, 1 NC'),
	harmony('XB5AD21', 'Commutateur à manette Ø22, 2 positions fixes, 1 NO'),
	harmony('XB5AD33', 'Commutateur à manette Ø22, 3 positions fixes, 2 NO'),
	harmony('XB5AS8442', 'Arrêt d’urgence Ø40 tourner pour déverrouiller, 1 NC', {
		w: 40,
		h: 40
	}),

	// --- Bornes (Phoenix Contact)
	{
		reference: '3031212',
		manufacturer: 'Phoenix Contact',
		designation: 'Borne à ressort ST 2,5 gris',
		category: 'Borne',
		notes: CHECK
	},
	{
		reference: '3031225',
		manufacturer: 'Phoenix Contact',
		designation: 'Borne à ressort ST 2,5 BU bleu (neutre)',
		category: 'Borne',
		notes: CHECK
	},
	{
		reference: '3031238',
		manufacturer: 'Phoenix Contact',
		designation: 'Borne de terre à ressort ST 2,5-PE vert/jaune',
		category: 'Borne',
		notes: CHECK
	},
	{
		reference: '3044076',
		manufacturer: 'Phoenix Contact',
		designation: 'Borne à vis UT 2,5 gris',
		category: 'Borne',
		notes: CHECK
	}
];
