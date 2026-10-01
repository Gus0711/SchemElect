<script lang="ts">
	import type { WireStyle } from '$lib/model/analysis';
	import { longestSegment } from '$lib/model/geometry';
	import type { Wire } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let { wire, style }: { wire: Wire; style?: WireStyle } = $props();

	const d = $derived(wire.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
	const seg = $derived(longestSegment(wire.points));
	const size = schematic.text.wireNumber;
	const off = schematic.wireNumberOffset;
	// Section en plus petit, de l'autre côté du fil que le numéro (pas de chevauchement avec
	// le numéro du fil voisin) : à gauche et le long d'un fil vertical, sous un fil horizontal.
	const sectionSize = size * 0.8;
</script>

<path
	{d}
	fill="none"
	stroke={style?.stroke ?? schematic.color.ink}
	stroke-width={schematic.stroke.wire}
	stroke-dasharray={style?.dashed ? schematic.stroke.dash : undefined}
	stroke-linejoin="round"
	stroke-linecap="round"
/>
{#if style?.number}
	{#if seg.vertical}
		<Label
			x={seg.mid.x + off}
			y={seg.mid.y + size / 2}
			text={style.number}
			{size}
			color={schematic.color.wireNumber}
		/>
	{:else}
		<Label
			x={seg.mid.x}
			y={seg.mid.y - off}
			text={style.number}
			{size}
			color={schematic.color.wireNumber}
			anchor="middle"
		/>
	{/if}
{/if}
{#if style?.section}
	{#if seg.vertical}
		<Label
			x={seg.mid.x - off}
			y={seg.mid.y}
			text={style.section}
			size={sectionSize}
			color={schematic.color.wireNumber}
			anchor="middle"
			vertical
		/>
	{:else}
		<Label
			x={seg.mid.x}
			y={seg.mid.y + off + sectionSize}
			text={style.section}
			size={sectionSize}
			color={schematic.color.wireNumber}
			anchor="middle"
		/>
	{/if}
{/if}
