import { describe, expect, it } from 'vitest';
import { analyzeProject } from '$lib/model/analysis';
import { cableIssues } from '$lib/model/cables';
import { contactOverflows } from '$lib/model/crossrefs';
import { panelCandidates, panelIssues } from '$lib/model/panel';
import { buildSampleArmoire } from './sampleArmoire';

describe('exemple complet d’armoire', () => {
	const project = buildSampleArmoire();
	const analysis = analyzeProject(project);

	it('a 5 folios : distribution, chaudière, pompe, implantation, façade', () => {
		expect(project.folios.map((f) => f.title)).toEqual([
			'DISTRIBUTION',
			'CHAUDIÈRE 1',
			'POMPE CHAUFFAGE',
			'IMPLANTATION',
			'FAÇADE'
		]);
	});

	it('ne déclenche aucun contrôle', () => {
		for (const f of project.folios)
			expect(analysis.nets.openTerminals.get(f.id) ?? [], f.title).toEqual([]);
		expect(analysis.nets.nets.filter((n) => n.shortedPotentials.length)).toEqual([]);
		expect(panelIssues(project)).toEqual([]);
		expect(contactOverflows(project, analysis.crossRefs)).toEqual([]);
		expect(cableIssues(analysis.cables)).toEqual([]);
		// Chaque câble coupe ses conducteurs.
		expect(analysis.cables.cables).toHaveLength(2);
		for (const c of analysis.cables.cables) expect(c.crossings.length).toBe(2);
	});

	it('le secondaire du transformateur est le 24V des folios de commande', () => {
		const tt = Object.values(project.devices).find((d) => d.tag === 'TT1')!;
		const net = analysis.nets.netOfTerminal.get(
			`${project.folios[0].symbols.find((s) => s.deviceId === tt.id)!.id}:3`
		);
		expect(net?.potentialId).toBe('24V');
	});

	it('tout est posé en implantation et en façade', () => {
		const impl = panelCandidates(project, 'implantation').filter((c) => c.mounting === 'rail');
		expect(impl.every((c) => c.placed)).toBe(true);
		const door = panelCandidates(project, 'facade').filter((c) => c.mounting === 'porte');
		expect(door.map((c) => c.tag).sort()).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'S1', 'S2']);
		expect(door.every((c) => c.placed)).toBe(true);
	});
});
