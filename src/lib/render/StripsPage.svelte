<script lang="ts">
	/**
	 * Folio « BORNIERS » (A4 paysage) : une page de tableaux de borniers, dans le même
	 * cadre + cartouche que les folios de schéma. La pagination est calculée par
	 * $lib/export/stripsTable (paginateStrips).
	 */
	import {
		STRIP_COLUMNS,
		STRIP_GAP_LINES,
		STRIP_LINE,
		STRIP_MARGIN,
		STRIP_PAD,
		stripRowLines,
		type StripPage
	} from '$lib/export/stripsTable';
	import { AREA, PAGE } from '$lib/model/layout';
	import type { ProjectMeta } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import FolioFrame from './FolioFrame.svelte';
	import Label from './Label.svelte';

	let {
		meta,
		page,
		index,
		total,
		title = 'BORNIERS',
		width = `${PAGE.w}mm`,
		height = `${PAGE.h}mm`
	}: {
		meta: ProjectMeta;
		page: StripPage;
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
	const tableW = STRIP_COLUMNS.reduce((a, c) => a + c.width, 0);
	const colX = STRIP_COLUMNS.map(
		(_, i) => x0 + STRIP_COLUMNS.slice(0, i).reduce((a, c) => a + c.width, 0)
	);
	/** Décalage de la ligne de base du texte dans une ligne de hauteur L. */
	const baseline = L - 0.95;

	const blocks = $derived.by(() => {
		let y = AREA.y + STRIP_MARGIN;
		return page.map((block, bi) => {
			if (bi) y += STRIP_GAP_LINES * L;
			const titleY = y;
			const headerY = y + L;
			y = headerY + L;
			const rows = block.items.map((row) => {
				const cells = stripRowLines(row);
				const h = Math.max(1, ...cells.map((c) => c.length)) * L;
				const r = { key: row.symbolId, y, h, cells };
				y += h;
				return r;
			});
			return { key: `${block.key}-${bi}`, block, titleY, headerY, bottom: y, rows };
		});
	});
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE.w} {PAGE.h}" {width} {height}>
	<FolioFrame {meta} {title} {index} {total} />

	{#each blocks as b (b.key)}
		<Label
			x={x0}
			y={b.titleY + baseline}
			text={`Bornier ${b.block.key}${b.block.continued ? ' (suite)' : ''}`}
			size={T.title}
			bold
		/>
		<rect x={x0} y={b.headerY} width={tableW} height={L} fill={S.headerFill} stroke="none" />
		{#each STRIP_COLUMNS as col, i (col.key)}
			<Label
				x={colX[i] + STRIP_PAD}
				y={b.headerY + baseline}
				text={col.label}
				size={T.header}
				bold
			/>
		{/each}

		{#each b.rows as r (r.key)}
			<line x1={x0} y1={r.y} x2={x0 + tableW} y2={r.y} stroke={C.ink} stroke-width={S.stroke} />
			{#each r.cells as lines, ci (ci)}
				{#each lines as text, li (li)}
					<Label x={colX[ci] + STRIP_PAD} y={r.y + li * L + baseline} {text} size={T.cell} />
				{/each}
			{/each}
		{/each}

		{#each colX.slice(1) as x (x)}
			<line x1={x} y1={b.headerY} x2={x} y2={b.bottom} stroke={C.ink} stroke-width={S.stroke} />
		{/each}
		<rect
			x={x0}
			y={b.headerY}
			width={tableW}
			height={b.bottom - b.headerY}
			fill="none"
			stroke={C.ink}
			stroke-width={S.strokeStrong}
		/>
	{/each}
</svg>
