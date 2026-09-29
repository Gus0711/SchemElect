/** Tout ce qui est calculé à partir du projet (jamais stocké). */
import { analyzeCables, type CableAnalysis } from './cables';
import { computeCrossRefs, type CrossRef } from './crossrefs';
import { analyzeNets, type NetAnalysis } from './nets';
import { computeStrips, type TerminalStrip } from './strips';
import type { Id, Project } from './types';

export interface WireStyle {
	stroke?: string;
	dashed?: boolean;
	number?: string;
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
	for (const [wireId, net] of nets.netOfWire) {
		const pot = net.potentialId ? potentials.get(net.potentialId) : undefined;
		wireStyle.set(wireId, { stroke: pot?.stroke, dashed: pot?.dashed, number: net.number });
	}
	return { nets, crossRefs: computeCrossRefs(project), wireStyle, cables: analyzeCables(project) };
}

export function projectStrips(project: Project, analysis: ProjectAnalysis): TerminalStrip[] {
	return computeStrips(project, analysis.nets, analysis.cables);
}
