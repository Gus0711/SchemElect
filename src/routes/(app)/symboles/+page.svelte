<script lang="ts">
	/** Aperçu de la bibliothèque de symboles (relecture visuelle). */
	import type { Device, SymbolInstance } from '$lib/model/types';
	import SymbolView from '$lib/render/SymbolView.svelte';
	import { CATEGORIES, SYMBOLS } from '$lib/symbols';
	import type { SymbolDef } from '$lib/symbols/types';

	/** Marges autour de `bounds` (mm) : place pour les repères à droite et les renvois dessous. */
	const M = { left: 4, right: 16, top: 4, bottom: 6 };
	/** Échelle d'affichage (px par mm). */
	const SCALE = 5;

	let filter = $state('');

	const groups = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		const match = (s: SymbolDef) =>
			!q ||
			[s.id, s.name, s.prefix, ...(s.keywords ?? [])].some((k) => k.toLowerCase().includes(q));
		return CATEGORIES.map((category) => ({
			category,
			symbols: SYMBOLS.filter((s) => s.category === category && match(s))
		})).filter((g) => g.symbols.length);
	});

	function view(def: SymbolDef) {
		const b = def.bounds;
		const x = b.x - M.left,
			y = b.y - M.top,
			w = b.w + M.left + M.right,
			h = b.h + M.top + M.bottom;
		return { viewBox: `${x} ${y} ${w} ${h}`, width: w * SCALE, height: h * SCALE };
	}

	const instance = (def: SymbolDef): SymbolInstance => ({
		id: def.id,
		defId: def.id,
		deviceId: 'd',
		x: 0,
		y: 0,
		rotation: 0
	});

	const device = (def: SymbolDef): Device => ({
		id: 'd',
		tag: def.prefix + '1',
		value: def.defaults?.value,
		designation: def.defaults?.designation,
		reference: def.labels.reference ? 'REF-CONSTR' : undefined
	});
</script>

<svelte:head>
	<title>Bibliothèque de symboles — SchemElect</title>
</svelte:head>

<main>
	<header>
		<h1>Bibliothèque de symboles</h1>
		<span class="count">{SYMBOLS.length} symboles</span>
		<input type="search" placeholder="Filtrer (nom, id, mot-clé, préfixe)…" bind:value={filter} />
	</header>

	{#each groups as g (g.category)}
		<section>
			<h2>{g.category} <span class="count">{g.symbols.length}</span></h2>
			<div class="grid">
				{#each g.symbols as def (def.id)}
					{@const v = view(def)}
					<figure>
						<svg
							viewBox={v.viewBox}
							width={v.width}
							height={v.height}
							role="img"
							aria-label={def.name}
						>
							<rect
								class="bounds"
								x={def.bounds.x}
								y={def.bounds.y}
								width={def.bounds.w}
								height={def.bounds.h}
							/>
							<SymbolView
								s={instance(def)}
								device={def.role === 'decor' ? undefined : device(def)}
							/>
						</svg>
						<figcaption>
							<strong>{def.name}</strong>
							<code>{def.id}</code>
							<span class="meta"
								>{def.role}{def.contactKind ? ` · ${def.contactKind}` : ''} · {def.prefix ||
									'—'}</span
							>
						</figcaption>
					</figure>
				{/each}
			</div>
		</section>
	{/each}
</main>

<style>
	main {
		height: 100%;
		overflow: auto;
		padding: var(--sp-5);
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-bottom: var(--sp-5);
	}

	header input {
		margin-left: auto;
		width: 320px;
		height: var(--control-h);
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border-strong);
		border-radius: var(--radius-sm);
		font: inherit;
		background: var(--c-surface);
		color: var(--c-text);
	}

	section {
		margin-bottom: var(--sp-6);
	}

	h2 {
		margin-bottom: var(--sp-3);
	}

	.count {
		color: var(--c-text-muted);
		font-size: var(--fs-sm);
		font-weight: normal;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--sp-3);
	}

	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-3);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
	}

	svg {
		max-width: 100%;
		height: auto;
		flex: 1;
	}

	.bounds {
		fill: var(--c-selection-fill);
		stroke: none;
	}

	figcaption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		text-align: center;
		font-size: var(--fs-sm);
	}

	code {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}

	.meta {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
</style>
