<script lang="ts">
	/**
	 * Folio « NOMENCLATURE » (A4 paysage) : tableau des références du dossier, dans le même
	 * cadre + cartouche que les folios de schéma. Pagination : $lib/export/bomTable.
	 */
	import { BOM_COLUMNS, bomRowLines, type BomPage } from '$lib/export/bomTable';
	import { STRIP_LINE, STRIP_MARGIN, STRIP_PAD } from '$lib/export/stripsTable';
	import { AREA, PAGE } from '$lib/model/layout';
	import type { Project } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import FolioFrame from './FolioFrame.svelte';
	import Label from './Label.svelte';

	let {
		project,
		page,
		index,
		total,
		title = 'NOMENCLATURE',
		width = `${PAGE.w}mm`,
		height = `${PAGE.h}mm`
	}: {
		project: Project;
		page: BomPage;
		/** Index 0-based de la page dans la numérotation des folios. */
		index: number;
		total: number;
		title?: string;
		width?: string;
		height?: string;
	} = $props();

	const T = schematic.text.table;
	const S = schematic.table;
	const C = schematic.color;
	const L = STRIP_LINE;
	const x0 = AREA.x + STRIP_MARGIN;
	const tableW = BOM_COLUMNS.reduce((a, c) => a + c.width, 0);
	const colX = BOM_COLUMNS.map(
		(_, i) => x0 + BOM_COLUMNS.slice(0, i).reduce((a, c) => a + c.width, 0)
	);
	const baseline = L - 0.95;

	const block = $derived.by(() => {
		const b = page[0];
		const titleY = AREA.y + STRIP_MARGIN;
		const headerY = titleY + L;
		let y = headerY + L;
		const rows = (b?.items ?? []).map((line) => {
			const cells = bomRowLines(line);
			const h = Math.max(1, ...cells.map((c) => c.length)) * L;
			const r = { key: line.key, y, h, cells, missing: !line.referenced };
			y += h;
			return r;
		});
		return { continued: !!b?.continued, titleY, headerY, bottom: y, rows };
	});
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE.w} {PAGE.h}" {width} {height}>
	<FolioFrame {project} {title} {index} {total} />

	<Label
		x={x0}
		y={block.titleY + baseline}
		text={`Nomenclature par référence${block.continued ? ' (suite)' : ''}`}
		size={T.title}
		bold
	/>
	<rect x={x0} y={block.headerY} width={tableW} height={L} fill={S.headerFill} stroke="none" />
	{#each BOM_COLUMNS as col, i (col.key)}
		<Label
			x={colX[i] + STRIP_PAD}
			y={block.headerY + baseline}
			text={col.label}
			size={T.header}
			bold
		/>
	{/each}

	{#each block.rows as r (r.key)}
		<line x1={x0} y1={r.y} x2={x0 + tableW} y2={r.y} stroke={C.ink} stroke-width={S.stroke} />
		{#each r.cells as lines, ci (ci)}
			{#each lines as text, li (li)}
				<Label x={colX[ci] + STRIP_PAD} y={r.y + li * L + baseline} {text} size={T.cell} />
			{/each}
		{/each}
	{/each}

	{#each colX.slice(1) as x (x)}
		<line
			x1={x}
			y1={block.headerY}
			x2={x}
			y2={block.bottom}
			stroke={C.ink}
			stroke-width={S.stroke}
		/>
	{/each}
	<rect
		x={x0}
		y={block.headerY}
		width={tableW}
		height={block.bottom - block.headerY}
		fill="none"
		stroke={C.ink}
		stroke-width={S.strokeStrong}
	/>
</svg>
