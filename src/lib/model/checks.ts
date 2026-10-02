/**
 * Contrôles de cohérence du dossier (calculés en continu) : bornes en l'air, courts-circuits,
 * contacts dépassés, câbles, folios d'armoire, séries de folios borniers, renvois orphelins.
 */
import { getSymbolDef } from '$lib/symbols';
import { projectStrips, type ProjectAnalysis } from './analysis';
import { cableIssues } from './cables';
import { contactOverflows } from './crossrefs';
import { folioNumber } from './layout';
import { panelIssues } from './panel';
import { stripSeriesIssues } from './stripDrawing';
import type { Project } from './types';

export interface ProjectIssue {
	text: string;
	/** Folio concerné (clic : y aller). */
	folioId?: string;
}

export function projectIssues(project: Project, a: ProjectAnalysis): ProjectIssue[] {
	const out: ProjectIssue[] = [];
	project.folios.forEach((f, i) => {
		const open = a.nets.openTerminals.get(f.id) ?? [];
		if (open.length)
			out.push({
				text: `Folio ${folioNumber(i)} : ${open.length} borne(s) non raccordée(s)`,
				folioId: f.id
			});
	});
	for (const n of a.nets.nets)
		if (n.shortedPotentials.length) {
			const names = [n.potentialId, ...n.shortedPotentials]
				.map((id) => project.potentials.find((p) => p.id === id)?.name ?? id)
				.join(' / ');
			out.push({ text: `Court-circuit : ${names}`, folioId: n.wires[0]?.folioId });
		}
	for (const o of contactOverflows(project, a.crossRefs)) {
		const folio = project.folios.find((f) => f.symbols.some((s) => s.deviceId === o.deviceId));
		out.push({
			text: `${o.tag} : ${o.no} NO / ${o.nc} NC dessinés pour ${o.avail.no} NO / ${o.avail.nc} NC disponibles`,
			folioId: folio?.id
		});
	}
	for (const c of cableIssues(a.cables)) out.push({ text: c.text, folioId: c.folioId });
	out.push(...panelIssues(project));
	if (project.folios.some((f) => f.strips))
		out.push(...stripSeriesIssues(project, projectStrips(project, a)));
	const links = new Map<string, number>();
	for (const f of project.folios)
		for (const s of f.symbols)
			if (getSymbolDef(s.defId).role === 'link')
				links.set(s.deviceId, (links.get(s.deviceId) ?? 0) + 1);
	for (const [id, n] of links)
		if (n < 2) out.push({ text: `Renvoi ${project.devices[id]?.tag ?? ''} sans correspondance` });
	return out;
}
