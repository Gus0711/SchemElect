<script lang="ts">
	import type { Bar, Potential } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let { bar, potential }: { bar: Bar; potential?: Potential } = $props();

	const size = schematic.text.barName;
</script>

<line
	x1={bar.x1}
	y1={bar.y}
	x2={bar.x2}
	y2={bar.y}
	stroke={potential?.stroke ?? schematic.color.ink}
	stroke-width={schematic.stroke.bar}
	stroke-dasharray={potential?.dashed ? schematic.stroke.dash : undefined}
/>
{#if potential}
	<Label x={bar.x1 + 1} y={bar.y - 1} text={potential.name} {size} bold />
	<Label x={bar.x2 - 1} y={bar.y - 1} text={potential.wireColor} {size} bold anchor="end" />
{/if}
