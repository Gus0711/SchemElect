/**
 * Numérotation des pages d'un dossier exporté.
 * L'export PDF monte les composants d'écran (FolioPage…) avec ce contexte pour que le
 * cartouche affiche le nombre total de pages du dossier (page de garde, borniers
 * compris) sans modifier les composants de rendu.
 */
export const PAGE_NUMBERING = Symbol('schemelect.pageNumbering');

export interface PageNumbering {
	/** Nombre total de pages affiché dans le cartouche. */
	total: number;
}

export function pageNumberingContext(n: PageNumbering): Map<symbol, PageNumbering> {
	return new Map([[PAGE_NUMBERING, n]]);
}

/** Grille imprimée sur les folios (option d'export). */
export interface PrintGrid {
	kind: 'points' | 'quadrillage' | 'cases';
	step: number;
	opacity: number;
}
