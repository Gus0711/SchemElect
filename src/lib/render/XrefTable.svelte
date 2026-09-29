<script lang="ts">
	/** Tableau NO | NC sous une bobine : positions de ses contacts. */
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let {
		x,
		y,
		table,
		overflow = { no: false, nc: false }
	}: {
		x: number;
		y: number;
		table: { no: string[]; nc: string[] };
		/** Colonnes en dépassement (éditeur uniquement) : affichées en rouge. */
		overflow?: { no: boolean; nc: boolean };
	} = $props();

	const colorOf = (over: boolean) => (over ? schematic.color.accent : schematic.color.ink);

	const size = schematic.text.xref;
	const colW = 8.5;
	const lineH = size * 1.25;
	const rows = $derived(Math.max(table.no.length, table.nc.length, 1));
	const stroke = { stroke: schematic.color.ink, 'stroke-width': schematic.stroke.thin };
</script>

{#if table.no.length || table.nc.length}
	<g>
		<Label
			x={x + colW / 2}
			y={y + size}
			text="NO"
			{size}
			anchor="middle"
			color={colorOf(overflow.no)}
		/>
		<Label
			x={x + colW * 1.5}
			y={y + size}
			text="NC"
			{size}
			anchor="middle"
			color={colorOf(overflow.nc)}
		/>
		<line x1={x} y1={y + lineH} x2={x + colW * 2} y2={y + lineH} {...stroke} />
		<line x1={x + colW} y1={y} x2={x + colW} y2={y + lineH * (rows + 1)} {...stroke} />
		{#each table.no as r, i (i)}
			<Label
				x={x + colW / 2}
				y={y + lineH * (i + 2) - 0.4}
				text={`(${r})`}
				{size}
				anchor="middle"
				color={colorOf(overflow.no)}
			/>
		{/each}
		{#each table.nc as r, i (i)}
			<Label
				x={x + colW * 1.5}
				y={y + lineH * (i + 2) - 0.4}
				text={`(${r})`}
				{size}
				anchor="middle"
				color={colorOf(overflow.nc)}
			/>
		{/each}
	</g>
{/if}
