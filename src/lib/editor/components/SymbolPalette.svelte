<script lang="ts">
	import SymbolThumb from '$lib/render/SymbolThumb.svelte';
	import { CATEGORIES, getSymbolDef, hasSymbolDef, SYMBOLS } from '$lib/symbols';
	import { usedCustomSymbolIds } from '$lib/model/edit';
	import { specOf } from '$lib/symbols/custom';
	import type { SymbolDef } from '$lib/symbols/types';
	import { Button, ContextMenu } from '$lib/ui';
	import { Pencil, Plus, Search, Star, Trash2 } from '@lucide/svelte';
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

	/** Symboles maison posés dans ce dossier. */
	const usedCustom = $derived(usedCustomSymbolIds(editor.project));
	const inLibrary = (id: string) => editor.customLibrary.some((d) => d.id === id);

	/**
	 * Symboles maison : bibliothèque partagée + copies du projet encore posées sur un folio
	 * (un symbole supprimé de la bibliothèque disparaît dès qu'il n'est plus posé).
	 */
	const customDefs = $derived.by(() => {
		const byId = new Map<string, SymbolDef>();
		for (const d of editor.customLibrary) byId.set(d.id, d);
		for (const d of Object.values(editor.project.customSymbols))
			if (!byId.has(d.id) && usedCustom.has(d.id)) byId.set(d.id, d);
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

	/** Favoris existants (un symbole maison supprimé disparaît de la barre). */
	const favorites = $derived(
		editor.favorites.filter((id) => hasSymbolDef(id)).map((id) => getSymbolDef(id))
	);
	const isFavorite = (id: string) => editor.favorites.includes(id);
	/** Glisser un favori pour le ranger. */
	let draggedFav: string | null = $state(null);

	/** Symbole maison modifiable / supprimable de la bibliothèque partagée. */
	const canEdit = (def: SymbolDef) => !!def.custom && !!def.source && !editor.readonly;
	const canRemove = (def: SymbolDef) => !!def.custom && !editor.readonly && inLibrary(def.id);

	function edit(def: SymbolDef) {
		editor.symbolEditor = { spec: specOf(def) };
	}

	async function remove(def: SymbolDef) {
		const used = usedCustom.has(def.id);
		const msg = used
			? `Supprimer « ${def.name} » de la bibliothèque ? Il est posé dans ce dossier : il y reste ` +
				'visible jusqu’à ce que vous supprimiez ses exemplaires des folios.'
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
		{#if !query.trim()}
			<h4 class="fav-title"><Star size={11} /> Favoris</h4>
			{#if favorites.length}
				<div class="grid favorites">
					{#each favorites as s, i (s.id)}
						<button
							class="item fav"
							class:active={activeDef === s.id}
							class:dragging={draggedFav === s.id}
							title="{s.name} ({s.prefix}) — clic droit : retirer · glisser : ranger"
							draggable="true"
							onclick={() => pick(s.id)}
							oncontextmenu={(e) => {
								e.preventDefault();
								menu = { x: e.clientX, y: e.clientY, def: s };
							}}
							ondragstart={() => (draggedFav = s.id)}
							ondragend={() => (draggedFav = null)}
							ondragover={(e) => draggedFav && e.preventDefault()}
							ondrop={(e) => {
								e.preventDefault();
								if (draggedFav && draggedFav !== s.id) editor.moveFavorite(draggedFav, i);
								draggedFav = null;
							}}
						>
							<SymbolThumb defId={s.id} size={34} />
							<span>{s.name}</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="muted hint">
					Aucun favori : survolez un symbole et cliquez sur l’étoile pour l’ajouter ici.
				</p>
			{/if}
		{/if}
		{#each groups as g (g.category)}
			<h4>{g.category}</h4>
			<div class="grid">
				{#each g.items as s (s.id)}
					<div class="cell">
						<button
							class="item"
							class:active={activeDef === s.id}
							title={s.custom
								? `${s.name} (${s.prefix}) — clic droit : modifier, supprimer`
								: `${s.name} (${s.prefix})`}
							onclick={() => pick(s.id)}
							oncontextmenu={(e) => {
								e.preventDefault();
								menu = { x: e.clientX, y: e.clientY, def: s };
							}}
						>
							<SymbolThumb defId={s.id} size={34} />
							<span>{s.name}</span>
						</button>
						<button
							class="star"
							class:on={isFavorite(s.id)}
							aria-label="Favori"
							aria-pressed={isFavorite(s.id)}
							title={isFavorite(s.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
							onclick={() => editor.toggleFavorite(s.id)}><Star size={12} /></button
						>
						{#if canEdit(s) || canRemove(s)}
							<div class="tools">
								{#if canEdit(s)}
									<button
										aria-label="Modifier le symbole"
										title="Modifier le symbole"
										onclick={() => edit(s)}><Pencil size={12} /></button
									>
								{/if}
								{#if canRemove(s)}
									<button
										class="danger"
										aria-label="Supprimer le symbole"
										title="Supprimer de la bibliothèque"
										onclick={() => remove(s)}><Trash2 size={12} /></button
									>
								{/if}
							</div>
						{/if}
					</div>
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
			{
				label: isFavorite(def.id) ? 'Retirer des favoris' : 'Ajouter aux favoris',
				action: () => editor.toggleFavorite(def.id)
			},
			...(def.custom
				? [
						{ separator: true as const },
						{ label: 'Modifier le symbole…', disabled: !canEdit(def), action: () => edit(def) },
						inLibrary(def.id)
							? {
									label: 'Supprimer de la bibliothèque',
									danger: true,
									disabled: !canRemove(def),
									action: () => remove(def)
								}
							: {
									label: 'Déjà supprimé de la bibliothèque (encore posé dans ce dossier)',
									disabled: true,
									action: () => {}
								}
					]
				: [])
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
	.fav-title {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--c-accent);
	}
	.favorites .item {
		border-color: var(--c-border);
	}
	.item.dragging {
		opacity: 0.4;
	}
	.hint {
		margin: 0;
		font-size: var(--fs-xs);
	}
	.cell {
		position: relative;
		display: flex;
		min-width: 0;
	}
	.cell .item {
		flex: 1;
	}
	.star {
		position: absolute;
		top: 1px;
		right: 1px;
		display: flex;
		padding: 2px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
		opacity: 0;
	}
	.cell:hover .star,
	.star:focus-visible,
	.star.on {
		opacity: 1;
	}
	.star.on {
		color: var(--c-accent);
	}
	/* Symbole maison : modifier / supprimer (en haut à gauche, au survol). */
	.tools {
		position: absolute;
		top: 1px;
		left: 1px;
		display: flex;
		gap: 1px;
		opacity: 0;
	}
	.cell:hover .tools,
	.tools:focus-within {
		opacity: 1;
	}
	.tools button {
		display: flex;
		padding: 2px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.tools button:hover {
		color: var(--c-text);
		background: var(--c-surface-2);
	}
	.tools button.danger:hover {
		color: var(--c-danger);
	}
	.star.on :global(svg) {
		fill: currentColor;
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
