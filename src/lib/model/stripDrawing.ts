/**
 * Folio « borniers » automatique : dessin des borniers (bornes en rangée, fils intérieurs
 * au-dessus, extérieurs en dessous), calculé depuis les borniers du schéma (`strips.ts`).
 *
 * Un folio borniers = UNE page (la numérotation des folios, donc les renvois, reste
 * stable). Les folios borniers de même filtre forment une série : le 1er affiche la page 1
 * de la mise en page, le 2e la page 2… S'il manque des folios, un contrôle le signale.
 */
import { AREA } from './layout';
import type { StripRow, TerminalStrip } from './strips';
import type { Folio, Id, Point, Project } from './types';

/** Géométrie (mm) : pas des bornes, hauteurs des zones d'un bandeau. */
export const SD = {
	/** Pas d'une borne (colonne de textes). */
	pitch: 8,
	/** Marge gauche (libellés « Intérieur » / « Extérieur »). */
	left: 22,
	/** Hauteur du titre du bandeau. */
	title: 6,
	/** Zone des textes au-dessus / en dessous des bornes. */
	zone: 34,
	/** Hauteur d'une borne dessinée. */
	box: 12,
	/** Largeur d'une borne dessinée. */
	boxW: 6,
	/** Colonnes laissées libres entre deux borniers d'un même bandeau. */
	gap: 2,
	bandsPerPage: 2
} as const;

export const BAND_H = SD.title + 2 * SD.zone + SD.box;
/** Nombre de bornes par bandeau. */
export const PER_BAND = Math.floor((AREA.w - SD.left - 4) / SD.pitch);

export interface StripSegment {
	prefix: string;
	rows: StripRow[];
	/** Suite d'un bornier commencé sur un bandeau précédent. */
	continued: boolean;
	/** Première colonne occupée dans le bandeau. */
	col: number;
}

export interface StripBand {
	segments: StripSegment[];
}

export interface StripPageLayout {
	bands: StripBand[];
}

/**
 * Mise en page : les borniers se suivent sur les bandeaux (un petit bornier peut partager
 * un bandeau avec le précédent) ; un long bornier continue sur le bandeau suivant.
 */
export function layoutStripPages(strips: TerminalStrip[]): StripPageLayout[] {
	const bands: StripBand[] = [];
	let band: StripBand = { segments: [] };
	let used = 0;
	const newBand = () => {
		if (band.segments.length) bands.push(band);
		band = { segments: [] };
		used = 0;
	};
	for (const strip of strips) {
		let rows = strip.rows;
		let continued = false;
		while (rows.length) {
			const start = used ? used + SD.gap : 0;
			const free = PER_BAND - start;
			// Un bornier ne commence pas en fin de bandeau s'il y serait coupé trop court.
			if (free < Math.min(rows.length, 4)) {
				newBand();
				continue;
			}
			const take = rows.slice(0, free);
			band.segments.push({ prefix: strip.prefix, rows: take, continued, col: start });
			used = start + take.length;
			rows = rows.slice(take.length);
			continued = true;
			if (rows.length) newBand();
		}
	}
	newBand();
	const pages: StripPageLayout[] = [];
	for (let i = 0; i < bands.length; i += SD.bandsPerPage)
		pages.push({ bands: bands.slice(i, i + SD.bandsPerPage) });
	return pages;
}

/** Haut du bandeau n° `i` de la page. */
export const bandTop = (i: number) => AREA.y + 2 + i * (BAND_H + 2);
/** Abscisse de l'axe d'une borne (colonne `col`). */
export const columnX = (col: number) => AREA.x + SD.left + col * SD.pitch + SD.pitch / 2;
/** Haut des bornes dessinées d'un bandeau. */
export const boxTop = (i: number) => bandTop(i) + SD.title + SD.zone;

// ---------------------------------------------------------------- séries de folios

/** Filtre d'un folio borniers (vide = tous les borniers). */
export const stripsKey = (f: Folio) => [...(f.strips?.prefixes ?? [])].sort().join(',');

export function filterStrips(strips: TerminalStrip[], prefixes: string[] | undefined) {
	return prefixes?.length ? strips.filter((s) => prefixes.includes(s.prefix)) : strips;
}

export interface StripFolioPage {
	/** Page à afficher (vide si la série a plus de folios que de pages). */
	page: StripPageLayout | null;
	/** Rang du folio dans sa série (0…). */
	index: number;
	/** Nombre de folios de la série. */
	folios: number;
	/** Nombre de pages nécessaires. */
	pages: number;
}

/** Page d'un folio borniers dans sa série (folios borniers de même filtre, dans l'ordre). */
export function stripFolioPage(
	project: Project,
	folio: Folio,
	strips: TerminalStrip[]
): StripFolioPage {
	const key = stripsKey(folio);
	const series = project.folios.filter((f) => f.strips && stripsKey(f) === key);
	const index = Math.max(
		0,
		series.findIndex((f) => f.id === folio.id)
	);
	const pages = layoutStripPages(filterStrips(strips, folio.strips?.prefixes));
	return { page: pages[index] ?? null, index, folios: series.length, pages: pages.length };
}

/** Séries de folios borniers qui manquent de folios (contrôles). */
export function stripSeriesIssues(
	project: Project,
	strips: TerminalStrip[]
): { folioId: Id; text: string }[] {
	const out: { folioId: Id; text: string }[] = [];
	const seen = new Set<string>();
	for (const f of project.folios) {
		if (!f.strips || seen.has(stripsKey(f))) continue;
		seen.add(stripsKey(f));
		const s = stripFolioPage(project, f, strips);
		if (s.pages > s.folios)
			out.push({
				folioId: f.id,
				text: `Borniers : ${s.pages} pages nécessaires pour ${s.folios} folio(s) borniers — ajouter la suite`
			});
	}
	return out;
}

/** Borne dessinée sous un point du folio (double-clic → symbole du schéma). */
export function stripTerminalAt(page: StripPageLayout, p: Point): StripRow | null {
	for (const [i, band] of page.bands.entries()) {
		const top = boxTop(i);
		if (p.y < top - SD.zone || p.y > top + SD.box + SD.zone) continue;
		for (const seg of band.segments)
			for (const [k, row] of seg.rows.entries()) {
				const x = columnX(seg.col + k);
				if (Math.abs(p.x - x) <= SD.pitch / 2) return row;
			}
	}
	return null;
}
