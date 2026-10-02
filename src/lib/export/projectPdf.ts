/**
 * PDF d'un schéma enregistré, hors éditeur (fiche affaire, page Projets) : le document est
 * relu sur le serveur, ses symboles maison enregistrés, puis exporté comme depuis
 * l'éditeur (page de garde, tableaux de borniers s'il n'a pas de folio borniers).
 */
import { fetchProject } from '$lib/api/client';
import { analyzeProject } from '$lib/model/analysis';
import { migrateProject } from '$lib/model/project';
import { registerCustomSymbols } from '$lib/symbols';

export async function downloadSavedProjectPdf(id: string): Promise<void> {
	const { data } = await fetchProject(id);
	const project = migrateProject(data);
	registerCustomSymbols(Object.values(project.customSymbols ?? {}));
	const { downloadProjectPdf } = await import('./pdf');
	await downloadProjectPdf(project, analyzeProject(project), {
		cover: true,
		strips: !project.folios.some((f) => f.strips)
	});
}
