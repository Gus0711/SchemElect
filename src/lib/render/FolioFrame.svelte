<script lang="ts">
	/** Cadre du folio : bordure, repères de grille A–Q / 1–11, cartouche. */
	import { AREA, BAND, COL_W, COLUMNS, FRAME, ROW_H, ROWS, TITLEBLOCK } from '$lib/model/layout';
	import type { Project } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import { getContext } from 'svelte';
	import Label from './Label.svelte';
	import { PAGE_NUMBERING, type PageNumbering } from './pageNumbering';
	import TitleBlock from './TitleBlock.svelte';

	let {
		project,
		title,
		index,
		total
	}: { project: Project; title: string; index: number; total: number } = $props();

	/** Export du dossier : le total affiché est celui du dossier complet. */
	const numbering = getContext<PageNumbering | undefined>(PAGE_NUMBERING);
	const shownTotal = $derived(numbering?.total ?? total);

	const S = schematic.stroke;
	const C = schematic.color;
	const T = schematic.text;
	const line = { stroke: C.frame, 'stroke-width': S.frameInner };
</script>

<rect x={0} y={0} width={297} height={210} fill={C.paper} />
<rect
	x={FRAME.x}
	y={FRAME.y}
	width={FRAME.w}
	height={FRAME.h}
	fill="none"
	stroke={C.frame}
	stroke-width={S.frame}
/>

<!-- Bandeau des colonnes -->
<line x1={AREA.x} y1={AREA.y} x2={FRAME.x + FRAME.w} y2={AREA.y} {...line} />
{#each COLUMNS as col, i (col)}
	{@const x = AREA.x + i * COL_W}
	<line x1={x} y1={FRAME.y} x2={x} y2={AREA.y} {...line} />
	<Label
		x={x + COL_W / 2}
		y={FRAME.y + BAND - 1.3}
		text={col}
		size={T.gridLabel}
		anchor="middle"
		color={C.gridText}
	/>
{/each}

<!-- Bandeau des lignes -->
<line x1={AREA.x} y1={AREA.y} x2={AREA.x} y2={TITLEBLOCK.y} {...line} />
{#each Array.from({ length: ROWS }, (_, i) => i) as i (i)}
	{@const y = AREA.y + i * ROW_H}
	<line x1={FRAME.x} y1={y} x2={AREA.x} y2={y} {...line} />
	<Label
		x={FRAME.x + BAND / 2}
		y={y + ROW_H / 2 + 1}
		text={String(i + 1)}
		size={T.gridLabel}
		anchor="middle"
		color={C.gridText}
	/>
{/each}

<!-- Cartouche (composé selon le modèle du projet) -->
<line
	x1={FRAME.x}
	y1={TITLEBLOCK.y}
	x2={FRAME.x + FRAME.w}
	y2={TITLEBLOCK.y}
	stroke={C.frame}
	stroke-width={S.frame}
/>
<TitleBlock {project} ctx={{ folioTitle: title, folioIndex: index, total: shownTotal }} />
