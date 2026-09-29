<script lang="ts">
	/** Rendu simplifié d'un fragment (fantôme de collage, aperçu de macro). */
	import { cableCrossings } from '$lib/model/cables';
	import type { Fragment } from '$lib/model/fragments';
	import CableView from '$lib/render/CableView.svelte';
	import Label from '$lib/render/Label.svelte';
	import SymbolView from '$lib/render/SymbolView.svelte';
	import WireView from '$lib/render/WireView.svelte';
	import { schematic } from '$lib/theme/schematic';

	let { fragment, ghost = false }: { fragment: Fragment; ghost?: boolean } = $props();

	const asFolio = $derived({
		id: '',
		title: '',
		...fragment,
		cables: fragment.cables ?? []
	});
</script>

<g opacity={ghost ? 0.55 : 1}>
	{#each fragment.rects as r (r.id)}
		<rect
			x={r.x}
			y={r.y}
			width={r.w}
			height={r.h}
			fill="none"
			stroke={schematic.color.ink}
			stroke-width={schematic.stroke.normal}
			stroke-dasharray={r.dashed ? schematic.stroke.dash : undefined}
		/>
	{/each}
	{#each fragment.bars as b (b.id)}
		<line
			x1={b.x1}
			y1={b.y}
			x2={b.x2}
			y2={b.y}
			stroke={schematic.color.ink}
			stroke-width={schematic.stroke.bar}
		/>
	{/each}
	{#each fragment.wires as w (w.id)}
		<WireView wire={w} />
	{/each}
	{#each fragment.symbols as s (s.id)}
		<SymbolView {s} device={fragment.devices[s.deviceId]} />
	{/each}
	{#each asFolio.cables as c (c.id)}
		<CableView cable={c} crossings={cableCrossings(asFolio, c)} />
	{/each}
	{#each fragment.texts as t (t.id)}
		<Label
			x={t.x}
			y={t.y}
			text={t.text}
			size={t.size}
			bold={t.bold}
			anchor={t.anchor}
			vertical={t.rotation === 90 || t.rotation === 270}
		/>
	{/each}
</g>
