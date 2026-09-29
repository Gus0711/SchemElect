<script lang="ts">
	/** Texte de schéma, horizontal ou vertical, toujours lisible. */
	import { schematic } from '$lib/theme/schematic';

	let {
		x,
		y,
		text,
		size = schematic.text.tag,
		anchor = 'start',
		color = schematic.color.ink,
		bold = false,
		vertical = false
	}: {
		x: number;
		y: number;
		text: string;
		size?: number;
		anchor?: 'start' | 'middle' | 'end';
		color?: string;
		bold?: boolean;
		vertical?: boolean;
	} = $props();
</script>

{#if text}
	<text
		{x}
		{y}
		font-size={size}
		font-family={schematic.font}
		font-weight={bold ? 'bold' : 'normal'}
		text-anchor={anchor}
		fill={color}
		transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}>{text}</text
	>
{/if}
