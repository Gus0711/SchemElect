<script lang="ts">
	/** Folio autonome au format A4 paysage (export PDF, aperçu, vignette). */
	import type { ProjectAnalysis } from '$lib/model/analysis';
	import { PAGE } from '$lib/model/layout';
	import type { Folio, Project } from '$lib/model/types';
	import FolioContent from './FolioContent.svelte';

	let {
		project,
		folio,
		analysis,
		width = `${PAGE.w}mm`,
		height = `${PAGE.h}mm`
	}: {
		project: Project;
		folio: Folio;
		analysis: ProjectAnalysis;
		width?: string;
		height?: string;
	} = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE.w} {PAGE.h}" {width} {height}>
	<FolioContent {project} {folio} {analysis} />
</svg>
