<script lang="ts">
	/**
	 * Grille d'un folio : points ou quadrillage au pas choisi, ou cases de repérage A–Q ×
	 * 1–11. À l'écran (`px` donné) : taille constante en pixels quel que soit le zoom ;
	 * à l'impression : tailles en mm. Couleurs : $lib/theme/schematic.ts.
	 */
	import { AREA, COL_W, COLUMNS, ROW_H, ROWS } from '$lib/model/layout';
	import { schematic } from '$lib/theme/schematic';

	let {
		kind,
		step,
		opacity,
		px
	}: {
		kind: 'points' | 'quadrillage' | 'cases';
		step: number;
		opacity: number;
		/** Pixels écran par mm (écran) ; absent = impression. */
		px?: number;
	} = $props();

	const G = schematic.grid;
	const P = G.print;
	const screen = $derived(px !== undefined);
	/** Épaisseur : pixels à l'écran, mm à l'impression. */
	const w = (pixels: number, mm: number) => (px ? pixels / px : mm);

	const range = (from: number, len: number) =>
		Array.from({ length: Math.floor(len / step + 1e-6) }, (_, i) => from + (i + 1) * step);
	const xs = $derived(range(AREA.x, AREA.w - 0.01));
	const ys = $derived(range(AREA.y, AREA.h - 0.01));
	/** Trait renforcé tous les 10 mm quand le pas est plus fin. */
	const major = (d: number) => step < 10 && Math.abs(d / 10 - Math.round(d / 10)) < 1e-6;
	const dotR = $derived(w(1.3, P.dot));
</script>

<g class="grid-layer" {opacity} pointer-events="none">
	{#if kind === 'points'}
		{#if screen}
			<!-- Écran : motif répété (léger même au pas de 2,5 mm). -->
			<defs>
				<pattern
					id="grid-points"
					width={step}
					height={step}
					patternUnits="userSpaceOnUse"
					x={AREA.x}
					y={AREA.y}
				>
					<circle cx={0} cy={0} r={dotR} fill={G.dot} />
					<circle cx={step} cy={0} r={dotR} fill={G.dot} />
					<circle cx={0} cy={step} r={dotR} fill={G.dot} />
					<circle cx={step} cy={step} r={dotR} fill={G.dot} />
				</pattern>
			</defs>
			<rect x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} fill="url(#grid-points)" />
		{:else}
			<!-- Impression : points réels (les motifs SVG passent mal en PDF). -->
			{#each ys as y (y)}
				{#each xs as x (x)}
					<circle cx={x} cy={y} r={dotR} fill={G.dot} />
				{/each}
			{/each}
		{/if}
	{:else if kind === 'quadrillage'}
		{#each xs as x (x)}
			{@const m = major(x - AREA.x)}
			<line
				x1={x}
				y1={AREA.y}
				x2={x}
				y2={AREA.y + AREA.h}
				stroke={m ? G.major : G.line}
				stroke-width={m ? w(1.1, P.major) : w(0.7, P.line)}
			/>
		{/each}
		{#each ys as y (y)}
			{@const m = major(y - AREA.y)}
			<line
				x1={AREA.x}
				y1={y}
				x2={AREA.x + AREA.w}
				y2={y}
				stroke={m ? G.major : G.line}
				stroke-width={m ? w(1.1, P.major) : w(0.7, P.line)}
			/>
		{/each}
	{:else}
		{@const dash = px ? `${6 / px} ${4 / px}` : P.cellDash}
		{#each COLUMNS.slice(1) as col, i (col)}
			{@const x = AREA.x + (i + 1) * COL_W}
			<line
				x1={x}
				y1={AREA.y}
				x2={x}
				y2={AREA.y + AREA.h}
				stroke={G.cell}
				stroke-width={w(1, P.cell)}
				stroke-dasharray={dash}
			/>
		{/each}
		{#each Array.from({ length: ROWS - 1 }, (_, i) => i + 1) as i (i)}
			{@const y = AREA.y + i * ROW_H}
			<line
				x1={AREA.x}
				y1={y}
				x2={AREA.x + AREA.w}
				y2={y}
				stroke={G.cell}
				stroke-width={w(1, P.cell)}
				stroke-dasharray={dash}
			/>
		{/each}
	{/if}
</g>
