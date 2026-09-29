<script lang="ts">
	import type { Prim } from '$lib/symbols/types';
	import { fillAttr, schematic, strokeAttrs, toneColor } from '$lib/theme/schematic';

	/** `signal` : couleur de signalisation de l'appareil (teinte `signal`). */
	/** `scale` : échelle du symbole (les traits gardent leur épaisseur). */
	let { p, signal, scale = 1 }: { p: Prim; signal?: string; scale?: number } = $props();
</script>

{#if p.t === 'line'}
	<line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} {...strokeAttrs(p.stroke, p.tone, signal, scale)} />
{:else if p.t === 'rect'}
	<rect
		x={p.x}
		y={p.y}
		width={p.w}
		height={p.h}
		rx={p.r}
		fill={fillAttr(p.fill, p.tone, signal)}
		{...strokeAttrs(p.stroke, p.tone, signal, scale)}
	/>
{:else if p.t === 'circle'}
	<circle
		cx={p.cx}
		cy={p.cy}
		r={p.r}
		fill={fillAttr(p.fill, p.tone, signal)}
		{...strokeAttrs(p.stroke, p.tone, signal, scale)}
	/>
{:else if p.t === 'path'}
	<path
		d={p.d}
		fill={fillAttr(p.fill, p.tone, signal)}
		{...strokeAttrs(p.stroke, p.tone, signal, scale)}
	/>
{:else if p.t === 'image'}
	<image x={p.x} y={p.y} width={p.w} height={p.h} href={p.href} preserveAspectRatio="none" />
{:else if p.t === 'text'}
	<text
		x={p.x}
		y={p.y}
		font-size={p.size ?? schematic.text.tag}
		font-family={schematic.font}
		font-weight={p.bold ? 'bold' : 'normal'}
		text-anchor={p.anchor ?? 'start'}
		fill={toneColor(p.tone, signal)}>{p.text}</text
	>
{/if}
