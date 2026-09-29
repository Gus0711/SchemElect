<script lang="ts">
	import SymbolThumb from '$lib/render/SymbolThumb.svelte';
	import { CATEGORIES, SYMBOLS } from '$lib/symbols';
	import { specOf } from '$lib/symbols/custom';
	import type { SymbolDef } from '$lib/symbols/types';
	import { Button, ContextMenu } from '$lib/ui';
	import { Plus, Search } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	let query = $state('');
	let searchInput: HTMLInputElement | undefined = $state();

	// Touche / : focus sur la recherche.
	$effect(() => {
		const req = editor.focusRequest;
		if (req?.field !== 'symbolSearch') return;
		queueMicrotask(() => {
			searchInput?.focus();
			searchInput?.select();
		});
	});

	const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

	/** Symboles maison : bibliothèque partagée + copies du projet (même supprimées de la bibliothèque). */
	const customDefs = $derived.by(() => {
		const byId = new Map<string, SymbolDef>();
		for (const d of editor.customLibrary) byId.set(d.id, d);
		for (const d of Object.values(editor.project.customSymbols))
			if (!byId.has(d.id)) byId.set(d.id, d);
		return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
	});

	const groups = $derived.by(() => {
		const q = normalize(query.trim());
		const match = (s: SymbolDef) =>
			!q ||
			normalize([s.name, s.prefix, s.id, s.category, ...(s.keywords ?? [])].join(' ')).includes(q);
		const all = [...customDefs, ...SYMBOLS];
		const categories = [...new Set([...customDefs.map((d) => d.category), ...CATEGORIES])];
		return categories
			.map((c) => ({ category: c, items: all.filter((s) => s.category === c && match(s)) }))
			.filter((g) => g.items.length);
	});

	let menu: { x: number; y: number; def: SymbolDef } | null = $state(null);

	function edit(def: SymbolDef) {
		editor.symbolEditor = { spec: specOf(def) };
	}

	async function remove(def: SymbolDef) {
		const used = !!editor.project.customSymbols[def.id];
		const msg = used
			? `Supprimer « ${def.name} » de la bibliothèque ? Il reste utilisable dans ce projet.`
			: `Supprimer « ${def.name} » de la bibliothèque partagée ?`;
		if (confirm(msg)) await editor.deleteCustomSymbol(def.id);
	}

	const activeDef = $derived(editor.tool.kind === 'place' ? editor.tool.defId : null);

	function pick(defId: string) {
		editor.setTool({ kind: 'place', defId, rotation: 0, mirror: false });
	}
</script>

<div class="palette">
	<div class="top">
		<label class="search">
			<Search size={14} />
			<input
				bind:this={searchInput}
				placeholder="Rechercher (disjoncteur, KM, voyant…) — touche /"
				bind:value={query}
				onkeydown={(e) => {
					// Entrée : poser le premier symbole trouvé ; Échap : revenir au folio.
					if (e.key === 'Enter' && groups[0]?.items[0]) {
						pick(groups[0].items[0].id);
						e.currentTarget.blur();
					}
					if (e.key === 'Escape') e.currentTarget.blur();
				}}
			/>
		</label>
		<Button
			size="sm"
			variant="ghost"
			title="Nouveau symbole (image de documentation ou bloc)"
			disabled={editor.readonly}
			onclick={() => (editor.symbolEditor = { spec: null })}><Plus size={16} /></Button
		>
	</div>
	<div class="list">
		{#each groups as g (g.category)}
			<h4>{g.category}</h4>
			<div class="grid">
				{#each g.items as s (s.id)}
					<button
						class="item"
						class:active={activeDef === s.id}
						title="{s.name} ({s.prefix})"
						onclick={() => pick(s.id)}
						oncontextmenu={(e) => {
							if (!s.custom) return;
							e.preventDefault();
							menu = { x: e.clientX, y: e.clientY, def: s };
						}}
					>
						<SymbolThumb defId={s.id} size={34} />
						<span>{s.name}</span>
					</button>
				{/each}
			</div>
		{:else}
			<p class="muted">Aucun symbole.</p>
		{/each}
	</div>
</div>

{#if menu}
	{@const def = menu.def}
	<ContextMenu
		x={menu.x}
		y={menu.y}
		onclose={() => (menu = null)}
		items={[
			{ label: 'Poser', action: () => pick(def.id) },
			{ label: 'Modifier le symbole…', disabled: !def.source, action: () => edit(def) },
			{ separator: true },
			{
				label: 'Supprimer de la bibliothèque',
				danger: true,
				disabled: !editor.customLibrary.some((d) => d.id === def.id),
				action: () => remove(def)
			}
		]}
	/>
{/if}

<style>
	.palette {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 2px;
		margin: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-3);
	}
	.search {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 0 var(--sp-2);
		height: var(--control-h);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
		background: var(--c-surface);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-size: var(--fs-sm);
	}
	.list {
		overflow-y: auto;
		padding: 0 var(--sp-3) var(--sp-3);
	}
	h4 {
		margin: var(--sp-3) 0 var(--sp-1);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--sp-1);
	}
	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: var(--sp-1);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		cursor: pointer;
		min-width: 0;
	}
	.item:hover {
		border-color: var(--c-border);
		background: var(--c-surface-2);
	}
	.item.active {
		border-color: var(--c-primary);
		background: var(--c-primary-soft);
	}
	.item span {
		font-size: 10px;
		line-height: 1.15;
		text-align: center;
		color: var(--c-text-muted);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>
