/**
 * Format de définition d'un symbole.
 *
 * Conventions (voir docs/SYMBOLES.md) :
 * - unités mm, origine (0,0) = première borne (en général la borne du haut) ;
 * - toutes les bornes sur la grille de 2,5 mm ;
 * - un symbole « vertical » par défaut (courant de haut en bas) ;
 * - le style (épaisseurs, couleurs, polices) n'est PAS dans la définition :
 *   uniquement des styles nommés résolus par $lib/theme/schematic.ts.
 */
import type { Dir, Rect } from '$lib/model/geometry';

export type StrokeKind = 'normal' | 'thin' | 'thick' | 'dashed' | 'none';
export type FillKind = 'none' | 'ink' | 'paper';

/**
 * Teinte : `ink` (défaut, noir), `accent` (rouge des renvois), `muted` (gris),
 * `signal` (couleur tirée de la valeur de l'appareil : voyant « Rouge », « Vert »…).
 */
export type Tone = 'ink' | 'accent' | 'muted' | 'signal';

interface PrimBase {
	stroke?: StrokeKind;
	fill?: FillKind;
	tone?: Tone;
}

export type Prim =
	| (PrimBase & { t: 'line'; x1: number; y1: number; x2: number; y2: number })
	| (PrimBase & { t: 'rect'; x: number; y: number; w: number; h: number; r?: number })
	| (PrimBase & { t: 'circle'; cx: number; cy: number; r: number })
	| (PrimBase & { t: 'path'; d: string })
	/** Image (symbole maison créé depuis une documentation) : data URL PNG/JPEG. */
	| { t: 'image'; x: number; y: number; w: number; h: number; href: string }
	| {
			t: 'text';
			x: number;
			y: number;
			text: string;
			size?: number;
			anchor?: 'start' | 'middle' | 'end';
			bold?: boolean;
			tone?: Tone;
	  };

export interface TerminalDef {
	/** Identifiant = numéro de borne affiché (A1, 13, 2/T1…). */
	id: string;
	x: number;
	y: number;
	/** Direction de sortie du fil. */
	dir: Dir;
	/** Masquer le numéro de borne. */
	hideLabel?: boolean;
	/** Texte affiché s'il diffère de l'id (bornes homonymes, ex. deux « 0V »). */
	label?: string;
}

/**
 * Rôle métier du symbole :
 * - `standalone` : appareil représenté par un seul symbole (voyant, moteur…) ;
 * - `master`     : symbole principal d'un appareil multi-symboles (bobine, disjoncteur) :
 *                  affiche le tableau NO | NC des positions de ses contacts ;
 * - `slave`      : contact / pôle rattaché à un master : affiche la position du master ;
 * - `terminal`   : borne de bornier (P1, C3, X1…) ;
 * - `link`       : renvoi de fil entre folios (les renvois de même repère sont reliés) ;
 * - `decor`      : graphique sans appareil (terre, flèche…).
 */
export type SymbolRole = 'standalone' | 'master' | 'slave' | 'terminal' | 'link' | 'decor';

export type ContactKind = 'no' | 'nc' | 'co' | 'pole';

export interface LabelAnchor {
	x: number;
	y: number;
	anchor?: 'start' | 'middle' | 'end';
	/** Texte vertical (référence constructeur par ex.). */
	vertical?: boolean;
}

export interface SymbolDef {
	id: string;
	name: string;
	category: string;
	keywords?: string[];
	/** Préfixe de repère par défaut (KM, Q, H…). */
	prefix: string;
	role: SymbolRole;
	contactKind?: ContactKind;
	graphics: Prim[];
	terminals: TerminalDef[];
	/** Groupes de bornes reliées en interne (ex. borne de bornier haut/bas). */
	bridges?: string[][];
	/** Emplacements des textes. Absent = texte non affiché. */
	labels: {
		tag?: LabelAnchor;
		value?: LabelAnchor;
		reference?: LabelAnchor;
		designation?: LabelAnchor;
		/** Renvoi croisé (slave/link) ou tableau NO|NC (master). */
		xref?: LabelAnchor;
	};
	/** Boîte englobante locale (sélection, collisions). */
	bounds: Rect;
	defaults?: { value?: string; designation?: string };
	/**
	 * Symbole maison (créé dans l'application, stocké en base et recopié dans chaque
	 * projet qui l'utilise pour que le dossier reste autonome).
	 */
	custom?: boolean;
	/** Symbole maison : données de l'éditeur (corps, bornes) pour pouvoir le modifier. */
	source?: {
		w: number;
		h: number;
		image?: string;
		title?: string;
		/** Bornes (position libre ; anciens symboles : côté + position le long du bord). */
		terminals: (
			{ id: string; x: number; y: number; dir: Dir } | { id: string; side: Dir; at: number }
		)[];
		snapToGrid: boolean;
	};
}
