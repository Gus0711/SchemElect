import type { SymbolDef } from '$lib/symbols/types';

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

export interface Folio {
	id: Id;
	title: string;
	symbols: SymbolInstance[];
	wires: Wire[];
	bars: Bar[];
	texts: TextItem[];
	rects: RectItem[];
}

export interface ProjectMeta {
	name: string;
	affaireNumber: string;
	planNumber: string;
	client: string;
	company: string;
	companyAddress: string;
	author: string;
	createdAt: string;
	modifiedAt: string;
}

export interface Revision {
	indice: string;
	description: string;
	date: string;
}

export interface ProjectSettings {
	wireNumberDigits: number;
	wireNumberStart: number;
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
}

/** Élément sélectionnable d'un folio. */
export type ItemKind = 'symbol' | 'wire' | 'bar' | 'text' | 'rect';

export interface ItemRef {
	kind: ItemKind;
	id: Id;
}
