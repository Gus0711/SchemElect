<script lang="ts">
	/** Cadre du folio : bordure, repères de grille A–Q / 1–11, cartouche. */
	import {
		AREA,
		BAND,
		COL_W,
		COLUMNS,
		FRAME,
		ROW_H,
		ROWS,
		TITLEBLOCK,
		folioNumber
	} from '$lib/model/layout';
	import type { ProjectMeta } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import { getContext } from 'svelte';
	import Label from './Label.svelte';
	import { PAGE_NUMBERING, type PageNumbering } from './pageNumbering';

	let {
		meta,
		title,
		index,
		total
	}: { meta: ProjectMeta; title: string; index: number; total: number } = $props();

	/** Export du dossier : le total affiché est celui du dossier complet. */
	const numbering = getContext<PageNumbering | undefined>(PAGE_NUMBERING);
	const shownTotal = $derived(numbering?.total ?? total);

	const S = schematic.stroke;
	const C = schematic.color;
	const T = schematic.text;
	const line = { stroke: C.frame, 'stroke-width': S.frameInner };

	// Colonnes du cartouche (mm)
	const tb = TITLEBLOCK;
	const cCompany = 58;
	const cDates = 48;
	const cFolio = 18;
	const xProject = tb.x + cCompany;
	const xDates = tb.x + tb.w - cFolio - cDates;
	const xFolio = tb.x + tb.w - cFolio;
	const midY = tb.y + tb.h / 2;
	const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');
	const projectLine = $derived([meta.planNumber, meta.name].filter(Boolean).join(' '));
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
<line x1={AREA.x} y1={AREA.y} x2={AREA.x} y2={tb.y} {...line} />
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

<!-- Cartouche -->
<line
	x1={FRAME.x}
	y1={tb.y}
	x2={FRAME.x + FRAME.w}
	y2={tb.y}
	stroke={C.frame}
	stroke-width={S.frame}
/>
<line x1={xProject} y1={tb.y} x2={xProject} y2={tb.y + tb.h} {...line} />
<line x1={xDates} y1={tb.y} x2={xDates} y2={tb.y + tb.h} {...line} />
<line x1={xFolio} y1={tb.y} x2={xFolio} y2={tb.y + tb.h} {...line} />
<line x1={xProject} y1={midY} x2={xDates} y2={midY} {...line} />
<line x1={xFolio} y1={tb.y + tb.h} x2={xFolio + cFolio} y2={tb.y} {...line} />

<Label
	x={tb.x + cCompany / 2}
	y={tb.y + 6}
	text={meta.company}
	size={T.titleblock.normal}
	anchor="middle"
	bold
/>
<Label
	x={tb.x + cCompany / 2}
	y={tb.y + 12}
	text={meta.companyAddress}
	size={T.titleblock.small}
	anchor="middle"
/>

<Label x={xProject + 2} y={midY - 2.2} text={projectLine} size={T.titleblock.normal} />
<Label x={xProject + 2} y={tb.y + tb.h - 2.2} text={title} size={T.titleblock.normal} />

<Label x={xDates + 2} y={tb.y + 4} text="Dessiné le :" size={T.titleblock.small} />
<Label
	x={xDates + cDates - 2}
	y={tb.y + 4}
	text={fmt(meta.createdAt)}
	size={T.titleblock.small}
	anchor="end"
/>
<Label x={xDates + 2} y={tb.y + 8.5} text="Modifié le :" size={T.titleblock.small} />
<Label
	x={xDates + cDates - 2}
	y={tb.y + 8.5}
	text={fmt(meta.modifiedAt)}
	size={T.titleblock.small}
	anchor="end"
/>
<Label x={xDates + 2} y={tb.y + 13} text="Par :" size={T.titleblock.small} />
<Label
	x={xDates + cDates - 2}
	y={tb.y + 13}
	text={meta.author}
	size={T.titleblock.small}
	anchor="end"
/>

<Label x={xFolio + 2} y={tb.y + 5.5} text={folioNumber(index)} size={T.titleblock.big} />
<Label
	x={xFolio + cFolio - 1.5}
	y={tb.y + tb.h - 1.8}
	text={String(shownTotal)}
	size={T.titleblock.normal}
	anchor="end"
/>
