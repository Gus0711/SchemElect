<script lang="ts">
	/**
	 * Cartouche d'un folio, composé selon le modèle du projet (`template.ts`) : suite de
	 * cases (texte sur 1 à 3 lignes, logo, n° de folio). Même rendu à l'écran et en PDF.
	 */
	import { ellipsize } from '$lib/export/paginate';
	import { TITLEBLOCK } from '$lib/model/layout';
	import {
		cellWidths,
		fillText,
		projectTemplate,
		type FieldContext,
		type TemplateLine,
		type TextSize,
		type TitleCell
	} from '$lib/model/template';
	import type { Project } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let { project, ctx }: { project: Project; ctx: FieldContext } = $props();

	const S = schematic.stroke;
	const C = schematic.color;
	const T = schematic.text.titleblock;
	const cw = schematic.charWidth;
	const tb = TITLEBLOCK;
	const line = { stroke: C.frame, 'stroke-width': S.frameInner };
	const PAD = 2;

	const template = $derived(projectTemplate(project));
	const cells = $derived(template.titleblock.cells);
	const widths = $derived(cellWidths(cells));
	const xs = $derived(widths.map((_, i) => tb.x + widths.slice(0, i).reduce((a, b) => a + b, 0)));

	const sizeOf = (s: TextSize | undefined) =>
		s === 'small' ? T.small : s === 'big' ? T.big : T.normal;

	/** Lignes d'une case texte : position, taille (réduite si la case est trop basse). */
	function layout(cell: TitleCell) {
		const n = Math.max(1, cell.lines.length);
		const h = tb.h / n;
		return cell.lines.map((l, i) => {
			const size = Math.min(sizeOf(l.size), h * 0.72);
			return { l, size, y: tb.y + h * i + h / 2 + size * 0.36, top: tb.y + h * i };
		});
	}

	const text = (l: TemplateLine) => fillText(l.value, project, ctx);
</script>

<!-- Séparations verticales des cases -->
{#each cells.slice(1) as c, i (c.id)}
	<line x1={xs[i + 1]} y1={tb.y} x2={xs[i + 1]} y2={tb.y + tb.h} {...line} />
{/each}

{#each cells as cell, i (cell.id)}
	{@const x = xs[i]}
	{@const w = widths[i]}
	{#if cell.kind === 'folio'}
		<line x1={x} y1={tb.y + tb.h} x2={x + w} y2={tb.y} {...line} />
		<Label
			x={x + PAD}
			y={tb.y + 5.5}
			text={ctx.folioIndex === undefined ? '' : fillText('{folio}', project, ctx)}
			size={T.big}
		/>
		<Label
			x={x + w - 1.5}
			y={tb.y + tb.h - 1.8}
			text={fillText('{total}', project, ctx)}
			size={T.normal}
			anchor="end"
		/>
	{:else if cell.kind === 'logo'}
		{#if template.logo}
			<image
				x={x + 1}
				y={tb.y + 1}
				width={Math.max(1, w - 2)}
				height={tb.h - 2}
				href={template.logo}
				preserveAspectRatio="xMidYMid meet"
			/>
		{/if}
	{:else}
		{#each layout(cell) as row, j (j)}
			{@const color = row.l.accent ? C.reference : C.ink}
			{#if cell.rules && j > 0}
				<line x1={x} y1={row.top} x2={x + w} y2={row.top} {...line} />
			{/if}
			{#if row.l.label}
				<Label x={x + PAD} y={row.y} text={row.l.label} size={row.size} {color} />
				<Label
					x={x + w - PAD}
					y={row.y}
					text={ellipsize(
						text(row.l),
						w - 2 * PAD - row.l.label.length * row.size * cw - 1,
						row.size,
						cw
					)}
					size={row.size}
					anchor="end"
					bold={row.l.bold}
					{color}
				/>
			{:else}
				<Label
					x={cell.align === 'center' ? x + w / 2 : x + PAD}
					y={row.y}
					text={ellipsize(text(row.l), w - 2 * PAD, row.size, cw)}
					size={row.size}
					anchor={cell.align === 'center' ? 'middle' : 'start'}
					bold={row.l.bold}
					{color}
				/>
			{/if}
		{/each}
	{/if}
{/each}
