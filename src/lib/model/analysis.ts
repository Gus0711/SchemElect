/** Tout ce qui est calculé à partir du projet (jamais stocké). */
import { analyzeCables, type CableAnalysis } from './cables';
import { computeCrossRefs, type CrossRef } from './crossrefs';
import { analyzeNets, sectionLabel, type NetAnalysis } from './nets';
import { computeStrips, type TerminalStrip } from './strips';
import type { Id, Project } from './types';

export interface WireStyle {
	stroke?: string;
	dashed?: boolean;
	number?: string;
	/** Section à afficher (« 1,5² »), selon le réglage d'affichage du dossier. */
	section?: string;
}

export interface ProjectAnalysis {
	nets: NetAnalysis;
	crossRefs: Map<Id, CrossRef>;
	wireStyle: Map<Id, WireStyle>;
	cables: CableAnalysis;
}

export function analyzeProject(project: Project): ProjectAnalysis {
	const nets = analyzeNets(project);
	const potentials = new Map(project.potentials.map((p) => [p.id, p]));
	const wireStyle = new Map<Id, WireStyle>();
	const display = project.settings.sectionDisplay ?? 'all';
	for (const [wireId, net] of nets.netOfWire) {
		const pot = net.potentialId ? potentials.get(net.potentialId) : undefined;
		const showSection =
			!!net.section && (display === 'all' || (display === 'imposed' && !!net.sectionImposed));
		wireStyle.set(wireId, {
			stroke: pot?.stroke,
			dashed: pot?.dashed,
			number: net.number,
			section: showSection ? sectionLabel(net.section!) : undefined
		});
	}
	return { nets, crossRefs: computeCrossRefs(project), wireStyle, cables: analyzeCables(project) };
}

export function projectStrips(project: Project, analysis: ProjectAnalysis): TerminalStrip[] {
	return computeStrips(project, analysis.nets, analysis.cables);
}
