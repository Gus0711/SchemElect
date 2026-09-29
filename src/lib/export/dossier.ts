/**
 * Plan du dossier exporté : quelles pages, dans quel ordre, avec quelle numérotation.
 * Pur (sans DOM) : utilisé par l'export PDF et testé avec Vitest.
 *
 * Numérotation (comme le dossier WinRelais de référence) :
 * - les folios de schéma gardent leur numéro (index dans `project.folios`) ;
 * - les folios « BORNIERS » suivent ;
 * - « NB DE FOLIOS » (page de garde) ne compte pas la page de garde ;
 * - le total du cartouche compte toutes les pages du PDF.
 */
import { projectStrips, type ProjectAnalysis } from '$lib/model/analysis';
import { folioNumber } from '$lib/model/layout';
import type { Project, ProjectMeta } from '$lib/model/types';
import { paginateStrips, type StripPage } from './stripsTable';

export interface ExportOptions {
	cover?: boolean;
	strips?: boolean;
}

export interface CoverEntry {
	number: string;
	title: string;
}

export const STRIPS_TITLE = 'BORNIERS';

export interface DossierPlan {
	cover: boolean;
	stripPages: StripPage[];
	/** Sommaire (page de garde). */
	entries: CoverEntry[];
	/** Folios numérotés (schémas + borniers), hors page de garde. */
	folioCount: number;
	/** Pages du PDF. */
	totalPages: number;
}

export function planDossier(
	project: Project,
	analysis: ProjectAnalysis,
	opts: ExportOptions = {}
): DossierPlan {
	const cover = opts.cover ?? true;
	const stripPages = (opts.strips ?? true) ? paginateStrips(projectStrips(project, analysis)) : [];
	const entries: CoverEntry[] = [
		...project.folios.map((f, i) => ({ number: folioNumber(i), title: f.title })),
		...stripPages.map((_, k) => ({
			number: folioNumber(project.folios.length + k),
			title: STRIPS_TITLE
		}))
	];
	const folioCount = entries.length;
	return { cover, stripPages, entries, folioCount, totalPages: folioCount + (cover ? 1 : 0) };
}

/** Nom de fichier sans caractères interdits (Windows). */
export function safeFileName(name: string): string {
	return (
		name
			// eslint-disable-next-line no-control-regex
			.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/[. ]+$/, '')
	);
}

/** `${planNumber || 'schema'} ${name}.pdf` */
export function pdfFileName(meta: ProjectMeta): string {
	return `${safeFileName(`${meta.planNumber || 'schema'} ${meta.name}`) || 'schema'}.pdf`;
}
