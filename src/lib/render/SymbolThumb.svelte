<script lang="ts">
	/** Vignette d'un symbole (palette, aperçus) : graphisme seul, sans textes. */
	import { getSymbolDef } from '$lib/symbols';
	import { customSymbolsVersion } from '$lib/symbols/version.svelte';
	import Prim from './Prim.svelte';

	let { defId, size = 40 }: { defId: string; size?: number } = $props();

	const def = $derived.by(() => {
		void customSymbolsVersion.v;
		return getSymbolDef(defId);
	});
	const box = $derived.by(() => {
		const b = def.bounds;
		const side = Math.max(b.w, b.h) + 3;
		return `${b.x + b.w / 2 - side / 2} ${b.y + b.h / 2 - side / 2} ${side} ${side}`;
	});
</script>

<svg class="thumb" viewBox={box} width={size} height={size} aria-hidden="true">
	{#each def.graphics as p, i (i)}
		<Prim {p} />
	{/each}
</svg>

<style>
	.thumb {
		background: var(--c-thumb-bg);
		border-radius: var(--radius-sm);
	}
	/* Vignettes lisibles quelle que soit la taille : trait constant à l'écran. */
	.thumb :global(line),
	.thumb :global(path),
	.thumb :global(rect),
	.thumb :global(circle) {
		stroke-width: 1.1px;
		vector-effect: non-scaling-stroke;
	}
</style>
