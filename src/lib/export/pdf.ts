/**
 * Export PDF du dossier (navigateur uniquement).
 *
 * Chaque page est rendue par les MÊMES composants Svelte qu'à l'écran (FolioPage,
 * CoverPage, StripsPage), montés hors écran, puis convertie en vectoriel par svg2pdf.
 * Aucun code de dessin spécifique au PDF.
 */
import { mount, unmount, flushSync, type Component } from 'svelte';
import type { ProjectAnalysis } from '$lib/model/analysis';
import { PAGE } from '$lib/model/layout';
import type { Project } from '$lib/model/types';
import CoverPage from '$lib/render/CoverPage.svelte';
import FolioPage from '$lib/render/FolioPage.svelte';
import { pageNumberingContext } from '$lib/render/pageNumbering';
import StripsPage from '$lib/render/StripsPage.svelte';
import { downloadBlob } from './csv';
import { pdfFileName, planDossier, STRIPS_TITLE, type ExportOptions } from './dossier';

type AnyProps = Record<string, unknown>;

export async function buildProjectPdf(
	project: Project,
	analysis: ProjectAnalysis,
	opts: ExportOptions = {}
): Promise<Blob> {
	const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
	const plan = planDossier(project, analysis, opts);
	const context = pageNumberingContext({ total: plan.totalPages });

	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
	doc.setProperties({
		title: [project.meta.planNumber, project.meta.name].filter(Boolean).join(' '),
		author: project.meta.author,
		creator: 'SchemElect'
	});

	const host = document.createElement('div');
	host.setAttribute('aria-hidden', 'true');
	Object.assign(host.style, {
		position: 'fixed',
		left: '-100000px',
		top: '0',
		width: `${PAGE.w}mm`,
		height: `${PAGE.h}mm`,
		overflow: 'hidden',
		pointerEvents: 'none'
	});
	document.body.appendChild(host);

	let first = true;
	async function renderPage<P extends AnyProps>(component: Component<P>, props: P) {
		const target = document.createElement('div');
		host.appendChild(target);
		const instance = mount(component, { target, props, context });
		try {
			flushSync();
			const svg = target.querySelector('svg');
			if (!svg) throw new Error('Rendu de page vide');
			if (!first) doc.addPage('a4', 'landscape');
			first = false;
			await svg2pdf(svg, doc, { x: 0, y: 0, width: PAGE.w, height: PAGE.h });
		} finally {
			await unmount(instance);
			target.remove();
		}
	}

	try {
		if (plan.cover)
			await renderPage(CoverPage, { project, entries: plan.entries, folioCount: plan.folioCount });
		for (const folio of project.folios) await renderPage(FolioPage, { project, folio, analysis });
		for (const [k, page] of plan.stripPages.entries())
			await renderPage(StripsPage, {
				meta: project.meta,
				page,
				index: project.folios.length + k,
				total: plan.totalPages,
				title: STRIPS_TITLE
			});
	} finally {
		host.remove();
	}
	return doc.output('blob');
}

export async function downloadProjectPdf(
	project: Project,
	analysis: ProjectAnalysis,
	opts: ExportOptions = {}
): Promise<void> {
	const blob = await buildProjectPdf(project, analysis, opts);
	downloadBlob(pdfFileName(project.meta), blob);
}
