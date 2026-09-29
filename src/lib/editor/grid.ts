/**
 * Réglages de la grille d'affichage des folios (aide à l'écran, jamais exportée) :
 * points ou quadrillage au pas choisi, ou cases de repérage A–Q × 1–11.
 * Préférence de l'utilisateur (navigateur), commune à tous les projets.
 */

export type GridKind = 'points' | 'quadrillage' | 'cases';

export interface GridPrefs {
	show: boolean;
	kind: GridKind;
	/** Pas en mm (points et quadrillage). */
	step: number;
	/** Opacité 0,1 à 1. */
	opacity: number;
	/** Imprimer la grille dans le PDF (folios de schéma et d'armoire). */
	print: boolean;
}

export const GRID_STEPS = [2.5, 5, 10];

export const GRID_KINDS: { kind: GridKind; label: string }[] = [
	{ kind: 'points', label: 'Points' },
	{ kind: 'quadrillage', label: 'Quadrillage' },
	{ kind: 'cases', label: 'Cases A–Q' }
];

export const DEFAULT_GRID: GridPrefs = {
	show: true,
	kind: 'points',
	step: 5,
	opacity: 0.6,
	print: false
};

const KEY = 'schemelect:grid';

/** Réglages valides à partir de n'importe quelle valeur (stockage ancien ou abîmé). */
export function normalizeGrid(raw: unknown): GridPrefs {
	const g = (raw && typeof raw === 'object' ? raw : {}) as Partial<GridPrefs>;
	const opacity = Number(g.opacity);
	return {
		show: typeof g.show === 'boolean' ? g.show : DEFAULT_GRID.show,
		kind: GRID_KINDS.some((k) => k.kind === g.kind) ? (g.kind as GridKind) : DEFAULT_GRID.kind,
		step: GRID_STEPS.includes(Number(g.step)) ? Number(g.step) : DEFAULT_GRID.step,
		opacity: Number.isFinite(opacity)
			? Math.min(1, Math.max(0.1, Math.round(opacity * 20) / 20))
			: DEFAULT_GRID.opacity,
		print: g.print === true
	};
}

export function loadGrid(): GridPrefs {
	try {
		return normalizeGrid(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
	} catch {
		return { ...DEFAULT_GRID };
	}
}

export function saveGrid(g: GridPrefs) {
	try {
		localStorage.setItem(KEY, JSON.stringify(g));
	} catch {
		/* stockage indisponible : réglage pour la session seulement */
	}
}
