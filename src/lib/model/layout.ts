/**
 * Mise en page d'un folio A4 paysage (reproduit le dossier WinRelais de référence) :
 * cadre, bandeau de repérage (colonnes A–Q, lignes 1–11), cartouche en bas.
 * Ces valeurs sont métier (elles déterminent les renvois « 02 - L ») ; le style
 * graphique (traits, polices, couleurs) est dans $lib/theme/schematic.ts.
 */
import type { Rect } from './geometry';

export const PAGE = { w: 297, h: 210 } as const;

/** Cadre extérieur. */
export const FRAME: Rect = { x: 10, y: 8, w: 282, h: 197 };

/** Épaisseur du bandeau des repères de grille. */
export const BAND = 5;

/** Hauteur du cartouche. */
export const TITLEBLOCK_H = 16;

/** Zone de dessin (entre bandeaux et cartouche). */
export const AREA: Rect = {
	x: FRAME.x + BAND,
	y: FRAME.y + BAND,
	w: FRAME.w - BAND,
	h: FRAME.h - BAND - TITLEBLOCK_H
};

export const TITLEBLOCK: Rect = {
	x: AREA.x,
	y: AREA.y + AREA.h,
	w: AREA.w,
	h: TITLEBLOCK_H
};

export const COLUMNS = 'ABCDEFGHIJKLMNOPQ'.split('');
export const ROWS = 11;

export const COL_W = AREA.w / COLUMNS.length;
export const ROW_H = AREA.h / ROWS;

export function columnAt(x: number): string {
	const i = Math.floor((x - AREA.x) / COL_W);
	return COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, i))];
}

export function rowAt(y: number): number {
	const i = Math.floor((y - AREA.y) / ROW_H);
	return Math.max(0, Math.min(ROWS - 1, i)) + 1;
}

export function folioNumber(index: number): string {
	return String(index + 1).padStart(2, '0');
}

/** Renvoi « 02 - L » : folio (index 0-based) + colonne de l'abscisse. */
export function folioRef(folioIndex: number, x: number): string {
	return `${folioNumber(folioIndex)} - ${columnAt(x)}`;
}
