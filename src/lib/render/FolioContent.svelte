<script lang="ts">
	/**
	 * Contenu complet d'un folio en SVG (unités mm). Utilisé tel quel par l'éditeur
	 * (dans son propre <svg> zoomable) et par l'export PDF (via FolioPage).
	 */
	import type { ProjectAnalysis } from '$lib/model/analysis';
	import type { Folio, Project } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import BarView from './BarView.svelte';
	import FolioFrame from './FolioFrame.svelte';
	import Label from './Label.svelte';
	import SymbolView from './SymbolView.svelte';
	import WireView from './WireView.svelte';

	let {
		project,
		folio,
		analysis,
		showOpenTerminals = false,
		showWarnings = false
	}: {
		project: Project;
		folio: Folio;
		analysis: ProjectAnalysis;
		showOpenTerminals?: boolean;
		/** Alertes d'édition (dépassement de contacts…) — éditeur seulement. */
		showWarnings?: boolean;
	} = $props();

	const index = $derived(project.folios.findIndex((f) => f.id === folio.id));
	const potentials = $derived(new Map(project.potentials.map((p) => [p.id, p])));
	const junctions = $derived(analysis.nets.junctions.get(folio.id) ?? []);
	const open = $derived(showOpenTerminals ? (analysis.nets.openTerminals.get(folio.id) ?? []) : []);
</script>

<FolioFrame meta={project.meta} title={folio.title} {index} total={project.folios.length} />

{#each folio.rects as r (r.id)}
	<rect
		x={r.x}
		y={r.y}
		width={r.w}
		height={r.h}
		fill="none"
		stroke={schematic.color.ink}
		stroke-width={schematic.stroke.normal}
		stroke-dasharray={r.dashed ? schematic.stroke.dash : undefined}
	/>
{/each}

{#each folio.bars as bar (bar.id)}
	<BarView {bar} potential={potentials.get(bar.potentialId)} />
{/each}

<!-- Symboles puis fils : un fil n'est jamais masqué par un symbole (images maison). -->
{#each folio.symbols as s (s.id)}
	<SymbolView
		{s}
		device={project.devices[s.deviceId]}
		xref={analysis.crossRefs.get(s.id)}
		{showWarnings}
	/>
{/each}

{#each folio.wires as wire (wire.id)}
	<WireView {wire} style={analysis.wireStyle.get(wire.id)} />
{/each}

{#each junctions as j (`${j.x},${j.y}`)}
	<circle cx={j.x} cy={j.y} r={schematic.junctionRadius} fill={schematic.color.junction} />
{/each}

{#each folio.texts as t (t.id)}
	<Label
		x={t.x}
		y={t.y}
		text={t.text}
		size={t.size}
		bold={t.bold}
		color={t.color ?? schematic.color.ink}
		anchor={t.anchor}
		vertical={t.rotation === 90 || t.rotation === 270}
	/>
{/each}

{#each open as p (`${p.x},${p.y}`)}
	<circle
		cx={p.x}
		cy={p.y}
		r={1.1}
		fill="none"
		stroke={schematic.color.openTerminal}
		stroke-width={0.3}
	/>
{/each}
