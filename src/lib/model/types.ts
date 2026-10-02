import type { SymbolDef } from '$lib/symbols/types';
import type { CatalogItem } from './catalog';
import type { DocTemplate } from './template';

/**
 * Modèle métier SchemElect — source de vérité unique.
 * Aucune dépendance au DOM ni à Svelte : tout ce module est testable avec Vitest.
 * Unités : millimètres, repère folio (0,0) en haut à gauche, y vers le bas.
 */

export type Id = string;

export interface Point {
	x: number;
	y: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Potentiel (barre) : Phase 1, Neutre, 24V… Partagé par tout le projet. */
export interface Potential {
	id: Id;
	name: string;
	/** Couleur de fil affichée à droite de la barre (« Marron », « Bleu »…). */
	wireColor: string;
	/** Couleur du tracé (CSS). */
	stroke: string;
	dashed?: boolean;
	/** Section des fils de ce potentiel en mm² (« 2,5 ») ; absente = section par défaut. */
	section?: string;
}

/** Appareil physique (KM1, Q1, P12…). Plusieurs symboles peuvent le représenter. */
export interface Device {
	id: Id;
	tag: string;
	value?: string;
	designation?: string;
	reference?: string;
	manufacturer?: string;
	/**
	 * Contacts auxiliaires disponibles sur l'appareil réel (bobine, disjoncteur).
	 * Absent = pas de contrôle. Sert à l'alerte « trop de contacts dessinés ».
	 */
	contacts?: { no: number; nc: number };
	/** Montage imposé (sinon déduit du symbole, voir `footprints.ts`). */
	mounting?: Mounting;
}

/** Symbole posé sur un folio : instance d'une définition de la bibliothèque. */
export interface SymbolInstance {
	id: Id;
	defId: string;
	deviceId: Id;
	x: number;
	y: number;
	rotation: Rotation;
	mirror?: boolean;
	/** Échelle de cet exemplaire (symboles maison uniquement) ; absent = 1. */
	scale?: number;
}

/** Fil : polyligne orthogonale. La connectivité est géométrique (extrémités). */
export interface Wire {
	id: Id;
	points: Point[];
	/** Numéro imposé à l'équipotentielle (sinon numérotation automatique). */
	numberOverride?: string;
	/** Section imposée à l'équipotentielle, en mm² (« 1,5 ») ; sinon potentiel / défaut. */
	section?: string;
	/** Couleur imposée à l'équipotentielle (« Rouge », voir `WIRE_COLORS`) ; sinon potentiel / défaut. */
	color?: string;
}

/** Barre de potentiel horizontale. */
export interface Bar {
	id: Id;
	potentialId: Id;
	y: number;
	x1: number;
	x2: number;
}

export interface TextItem {
	id: Id;
	x: number;
	y: number;
	text: string;
	size: number;
	bold?: boolean;
	color?: string;
	rotation?: 0 | 90 | 270;
	anchor?: 'start' | 'middle' | 'end';
}

export interface RectItem {
	id: Id;
	x: number;
	y: number;
	w: number;
	h: number;
	dashed?: boolean;
}

/**
 * Câble multi-conducteurs posé en travers des fils (ellipse). Les fils coupés sont ses
 * conducteurs, dans l'ordre de l'axe (voir `cables.ts`).
 */
export interface CableItem {
	id: Id;
	/** Repère : W1, W2… (tableaux, borniers, carnet de câbles). */
	tag: string;
	/** Début de l'axe. */
	x: number;
	y: number;
	length: number;
	/** Axe vertical (coupe des fils horizontaux) ; sinon horizontal. */
	vertical?: boolean;
	/** Type : SYT1, U1000 R2V… */
	type: string;
	/** Câble à paires (un libellé « Paire Ciel / Jaune » par paire). */
	pairs: boolean;
	/** Couleurs des conducteurs dans l'ordre (câble à paires : 2 par paire). */
	colors: string[];
	/** Section (« 1,5 », « 8/10 »), reprise dans le nom par défaut. */
	section?: string;
	/** Texte affiché ; vide = calculé (« CABLE SYT1 3 PAIRES »). */
	name?: string;
	/** Afficher la couleur des conducteurs sur le schéma (défaut : oui). */
	showColors?: boolean;
	/** Référence à commander (liste de commande). */
	reference?: string;
	/** Longueur à commander, en mètres (liste de commande) ; à ne pas confondre avec `length`. */
	cableLength?: number;
}

// ---------------------------------------------------------------- implantation / façade

/**
 * Folio d'armoire : `implantation` (fond d'armoire : rails, goulottes, appareils) ou
 * `facade` (porte : voyants, commutateurs). Coordonnées RÉELLES en mm, origine au coin
 * haut-gauche de l'armoire ; la mise à l'échelle sur la page est calculée (`panel.ts`).
 */
export type PanelKind = 'implantation' | 'facade';

/** Montage d'un appareil : sur rail (fond d'armoire), en porte (façade) ou hors armoire. */
export type Mounting = 'rail' | 'porte' | 'externe';

export interface Enclosure {
	/** Largeur (L). */
	w: number;
	/** Hauteur (H). */
	h: number;
	/** Profondeur (P). */
	d: number;
}

/** Rail oméga (DIN 35 mm) horizontal : `y` = axe, de `x` à `x + length`. */
export interface Rail {
	id: Id;
	x: number;
	y: number;
	length: number;
}

/** Goulotte : emprise w × h sur le fond d'armoire ; `depth` = hauteur de la goulotte. */
export interface Duct {
	id: Id;
	x: number;
	y: number;
	w: number;
	h: number;
	depth: number;
}

/** Élément monté : appareil du schéma ou bornier. Position = CENTRE, taille = encombrement. */
export interface PanelItem {
	id: Id;
	/** Appareil du schéma (absent pour un bornier). */
	deviceId?: Id;
	/** Bornier monté (préfixe : P, C, X…) ; sa largeur suit le nombre de bornes. */
	strip?: string;
	x: number;
	y: number;
	w: number;
	h: number;
	/** Étiquette de façade imposée (sinon : désignation, sinon repère). */
	label?: string;
}

export interface Panel {
	kind: PanelKind;
	enclosure: Enclosure;
	/** Échelle imposée (dénominateur : 8 = 1:8) ; absente = automatique. */
	scale?: number;
	/** Référence de l'enveloppe (implantation) : liste de commande. */
	reference?: string;
	rails: Rail[];
	ducts: Duct[];
	items: PanelItem[];
}

export interface Folio {
	id: Id;
	title: string;
	symbols: SymbolInstance[];
	wires: Wire[];
	bars: Bar[];
	texts: TextItem[];
	rects: RectItem[];
	cables: CableItem[];
	/** Folio d'implantation ou de façade (absent = folio de schéma). */
	panel?: Panel;
	/**
	 * Folio borniers automatique (dessin calculé, voir `stripDrawing.ts`) ; `prefixes` vide
	 * = tous les borniers.
	 */
	strips?: { prefixes: string[] };
}

export interface ProjectMeta {
	name: string;
	affaireNumber: string;
	/** N° WhySoft (CRM) : relie le schéma à la commande. Repris de l'affaire si rattaché. */
	whysoft?: string;
	/**
	 * Affaire de rattachement (`clients` / `affaires` en base). Rattaché : client, n° WhySoft
	 * et n° d'affaire viennent de l'affaire (imposés à l'enregistrement et à l'ouverture).
	 */
	affaireId?: string;
	planNumber: string;
	client: string;
	company: string;
	companyAddress: string;
	author: string;
	createdAt: string;
	modifiedAt: string;
	/** Valeurs des champs libres du modèle de cartouche (clé → texte). */
	fields?: Record<string, string>;
}

export interface Revision {
	indice: string;
	description: string;
	date: string;
}

/** Affichage des sections sur les fils : toutes, seulement celles imposées sur un fil, aucune. */
export type SectionDisplay = 'all' | 'imposed' | 'none';

export interface ProjectSettings {
	wireNumberDigits: number;
	wireNumberStart: number;
	/**
	 * Modèle du numéro de fil (défaut « {N} », numérotation séquentielle sur tout le dossier) :
	 * {N} compteur, {F} numéro du folio (2 chiffres), {C} colonne. Le compteur repart à chaque
	 * folio si le modèle contient {F}, à chaque colonne s'il contient aussi {C}.
	 */
	wireNumberTemplate?: string;
	/** Section par défaut des fils hors potentiel (commande), en mm² ; vide = non renseignée. */
	wireSection?: string;
	/** Couleur par défaut des fils hors potentiel (commande) ; vide = non renseignée. */
	wireColor?: string;
	/** Affichage des sections sur le dessin (défaut : toutes). */
	sectionDisplay?: SectionDisplay;
}

/**
 * Références du matériel d'armoire calculé (liste de commande). Vide = ligne « à compléter »
 * avec une désignation générique.
 */
export interface MaterialRefs {
	/** Rail oméga, vendu en barres de 2 m. */
	rail?: string;
	/** Butée d'arrêt (2 par bornier). */
	endClamp?: string;
	/** Flasque d'extrémité (1 par bornier). */
	endPlate?: string;
	/** Goulottes : référence par dimension (« 40×60 »). */
	ducts?: Record<string, string>;
}

/** Ligne ajoutée à la main dans la liste de commande (presse-étoupes, visserie…). */
export interface OrderExtra {
	id: Id;
	reference: string;
	manufacturer: string;
	designation: string;
	quantity: number;
	/** Unité libre : « pce », « m », « lot »… (défaut pce). */
	unit?: string;
}

export const SCHEMA_VERSION = 1;

export interface Project {
	schemaVersion: typeof SCHEMA_VERSION;
	meta: ProjectMeta;
	revisions: Revision[];
	potentials: Potential[];
	devices: Record<Id, Device>;
	folios: Folio[];
	settings: ProjectSettings;
	/**
	 * Copies des symboles maison utilisés par le projet (le dossier reste lisible même si
	 * le symbole est modifié ou supprimé de la bibliothèque partagée).
	 */
	customSymbols: Record<string, SymbolDef>;
	/**
	 * Modèle de cartouche et de page de garde (copie de la bibliothèque) ; absent = modèle
	 * standard (voir `template.ts`).
	 */
	template?: DocTemplate;
	/**
	 * Copies des fiches du catalogue matériel utilisées par le projet, par
	 * `referenceKey(reference)` (voir `catalog.ts`). Absent = aucune.
	 */
	catalog?: Record<string, CatalogItem>;
	/** Références du matériel d'armoire (liste de commande). */
	materials?: MaterialRefs;
	/** Lignes libres de la liste de commande. */
	orderExtras?: OrderExtra[];
}

/** Élément sélectionnable d'un folio. */
export type ItemKind =
	'symbol' | 'wire' | 'bar' | 'text' | 'rect' | 'cable' | 'rail' | 'duct' | 'mount';

export interface ItemRef {
	kind: ItemKind;
	id: Id;
}
