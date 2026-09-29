<script lang="ts">
	import type { WireStyle } from '$lib/model/analysis';
	import { longestSegment } from '$lib/model/geometry';
	import type { Wire } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let { wire, style }: { wire: Wire; style?: WireStyle } = $props();

	const d = $derived(wire.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
	const seg = $derived(longestSegment(wire.points));
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
			x={seg.mid.x + schematic.wireNumberOffset}
			y={seg.mid.y + schematic.text.wireNumber / 2}
			text={style.number}
			size={schematic.text.wireNumber}
			color={schematic.color.wireNumber}
		/>
	{:else}
		<Label
			x={seg.mid.x}
			y={seg.mid.y - schematic.wireNumberOffset}
			text={style.number}
			size={schematic.text.wireNumber}
			color={schematic.color.wireNumber}
			anchor="middle"
		/>
	{/if}
{/if}
