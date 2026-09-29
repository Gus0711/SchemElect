<script lang="ts">
	/** Câble multi-conducteurs : ellipse en travers des fils, nom et couleurs des conducteurs. */
	import { cableEllipseBounds, cableLabels, CABLE_RY, type CableCrossing } from '$lib/model/cables';
	import type { CableItem } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let {
		cable,
		crossings,
		warn = false
	}: {
		cable: CableItem;
		crossings: CableCrossing[];
		/** Câble plein : ellipse en rouge (éditeur). */
		warn?: boolean;
	} = $props();

	const e = $derived(cableEllipseBounds(cable));
	const labels = $derived(cableLabels(cable, crossings));
</script>

<ellipse
	cx={e.x + e.w / 2}
	cy={e.y + e.h / 2}
	rx={cable.vertical ? CABLE_RY : e.w / 2}
	ry={cable.vertical ? e.h / 2 : CABLE_RY}
	fill="none"
	stroke={warn ? schematic.color.cableOverflow : schematic.color.cable}
	stroke-width={schematic.stroke.normal}
/>
{#each labels as l, i (i)}
	<Label
		x={l.x}
		y={l.y}
		text={l.text}
		size={l.size}
		bold={l.bold}
		anchor={l.anchor}
		vertical={l.vertical}
		color={l.bold ? schematic.color.cable : schematic.color.cableColors}
	/>
{/each}
