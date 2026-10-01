<script lang="ts">
	/**
	 * Panneau « Appareils » : tous les repères du dossier, regroupés par famille, avec
	 * recherche, filtre « sans référence » / « contacts dépassés », emplacements (clic : y
	 * aller) et mise à jour des fiches catalogue modifiées.
	 */
	import { listDevices, normalizeSearch, type DeviceEntry } from '$lib/model/inventory';
	import { referenceKey } from '$lib/model/catalog';
	import { Button } from '$lib/ui';
	import { ChevronRight, ListOrdered, RefreshCw, Search, TriangleAlert } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';
	import NomenclatureDialog from './NomenclatureDialog.svelte';

	let { editor }: { editor: Editor } = $props();

	type Filter = 'all' | 'no-reference' | 'contacts';

	let query = $state('');
	let filter: Filter = $state('all');
	let showTerminals = $state(false);
	let expanded: string | null = $state(null);
	let bomOpen = $state(false);
	let message = $state('');

	const all = $derived(listDevices(editor.project, editor.analysis));
	const devices = $derived(all.filter((d) => !d.terminal));
	const terminals = $derived(all.filter((d) => d.terminal));
	const counts = $derived({
		'no-reference': devices.filter((d) => d.issues.includes('no-reference')).length,
		contacts: devices.filter((d) => d.issues.includes('contacts')).length
	});

	/** Appareil du symbole sélectionné : mis en évidence dans la liste. */
	const selectedDevice = $derived.by(() => {
		const ref = editor.selection.length === 1 ? editor.selection[0] : null;
		if (ref?.kind !== 'symbol') return null;
		return editor.folio.symbols.find((s) => s.id === ref.id)?.deviceId ?? null;
	});

	const matches = (d: DeviceEntry, q: string, qRef: string) =>
		!q ||
		normalizeSearch(
			[d.tag, d.designation, d.value, d.manufacturer, d.symbolName, d.catalog?.designation].join(
				' '
			)
		).includes(q) ||
		(!!qRef && !!d.reference && referenceKey(d.reference).includes(qRef));

	const groups = $derived.by(() => {
		const q = normalizeSearch(query);
		const qRef = referenceKey(query);
		const list = devices.filter(
			(d) => (filter === 'all' || d.issues.includes(filter)) && matches(d, q, qRef)
		);
		const extra =
			showTerminals && filter === 'all' ? terminals.filter((d) => matches(d, q, qRef)) : [];
		const map = new Map<string, DeviceEntry[]>();
		for (const d of [...list, ...extra]) {
			const g = map.get(d.family) ?? [];
			g.push(d);
			map.set(d.family, g);
		}
		return [...map.entries()];
	});
	const shown = $derived(groups.reduce((n, [, l]) => n + l.length, 0));

	function pick(d: DeviceEntry) {
		expanded = expanded === d.id ? null : d.id;
		editor.goToSymbol(d.mainSymbolId);
	}

	function updateCatalog() {
		const n = editor.applyCatalogChanges();
		message = `${n} fiche(s) mise(s) à jour depuis le catalogue.`;
	}
</script>

<div class="devices">
	<div class="top">
		<label class="search">
			<Search size={14} />
			<input placeholder="Rechercher (KM3, pompe, LC1D…)" bind:value={query} />
		</label>
		<div class="chips">
			<button class:active={filter === 'all'} onclick={() => (filter = 'all')}
				>Tous ({devices.length})</button
			>
			<button
				class:active={filter === 'no-reference'}
				class:warn={counts['no-reference'] > 0}
				onclick={() => (filter = 'no-reference')}
				title="Appareils sans référence constructeur (hors bornes)"
				>Sans réf. ({counts['no-reference']})</button
			>
			{#if counts.contacts}
				<button
					class:active={filter === 'contacts'}
					class="warn"
					onclick={() => (filter = 'contacts')}
					title="Plus de contacts dessinés que de contacts disponibles"
					>Contacts ({counts.contacts})</button
				>
			{/if}
		</div>
		{#if filter === 'all' && terminals.length}
			<label class="check"
				><input type="checkbox" bind:checked={showTerminals} /> Afficher les bornes ({terminals.length})</label
			>
		{/if}
	</div>

	{#if editor.catalogChanges.length && !editor.readonly}
		<div class="banner">
			<span
				>{editor.catalogChanges.length} référence(s) du dossier ont une fiche au catalogue, nouvelle ou
				modifiée depuis sa copie dans ce dossier ({editor.catalogChanges
					.map((c) => c.reference)
					.join(', ')}).</span
			>
			<Button size="sm" onclick={updateCatalog}
				><RefreshCw size={12} /> Reprendre les fiches du catalogue</Button
			>
		</div>
	{/if}
	{#if message}<p class="message">{message}</p>{/if}

	<div class="list">
		{#each groups as [family, list] (family)}
			<h4>{family} ({list.length})</h4>
			<ul>
				{#each list as d (d.id)}
					<li>
						<button
							class="row"
							class:selected={selectedDevice === d.id}
							title="Clic : aller à {d.tag} et voir ses emplacements"
							onclick={() => pick(d)}
						>
							<ChevronRight size={12} class={expanded === d.id ? 'open' : ''} />
							<span class="tag">{d.tag}</span>
							<span class="designation">{d.designation || d.symbolName}</span>
							{#if d.issues.includes('contacts')}
								<span class="flag" title="Contacts dépassés"><TriangleAlert size={12} /></span>
							{/if}
							{#if d.reference}
								<span class="ref" title={d.catalog?.designation ?? 'Hors catalogue'}
									>{d.reference}</span
								>
							{:else if !d.terminal}
								<span class="ref missing">sans réf.</span>
							{/if}
						</button>
						{#if expanded === d.id}
							<ul class="places">
								{#each d.placements as p (p.symbolId)}
									<li>
										<button onclick={() => editor.goToSymbol(p.symbolId)}
											><span class="pos">{p.ref}</span> {p.symbolName}</button
										>
									</li>
								{/each}
								{#if d.catalog}
									<li class="cat">{d.catalog.manufacturer} · {d.catalog.designation}</li>
								{/if}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">
				{all.length
					? 'Aucun appareil ne correspond.'
					: 'Aucun appareil : posez des symboles sur les folios.'}
			</p>
		{/each}
	</div>

	<div class="bottom">
		<span class="muted">{shown} affiché(s)</span>
		<Button size="sm" onclick={() => (bomOpen = true)}
			><ListOrdered size={14} /> Nomenclature</Button
		>
	</div>
</div>

<NomenclatureDialog bind:open={bomOpen} {editor} />

<style>
	.devices {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}
	.top {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: var(--sp-2) var(--sp-2) var(--sp-1) var(--sp-3);
	}
	.search {
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
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}
	.chips button {
		padding: 2px var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: 999px;
		background: var(--c-surface);
		color: var(--c-text-muted);
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.chips button.warn {
		color: var(--c-warning);
	}
	.chips button.active {
		border-color: var(--c-primary);
		background: var(--c-primary-soft);
		color: var(--c-text);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.banner {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		margin: var(--sp-1) var(--sp-2) 0 var(--sp-3);
		padding: var(--sp-2);
		border-radius: var(--radius-sm);
		background: var(--c-primary-soft);
		font-size: var(--fs-xs);
	}
	.message {
		margin: var(--sp-1) var(--sp-3) 0;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.list {
		flex: 1;
		overflow-y: auto;
		padding: 0 var(--sp-2) var(--sp-3);
	}
	h4 {
		margin: var(--sp-3) var(--sp-1) var(--sp-1);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		width: 100%;
		padding: 3px var(--sp-1);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: var(--fs-sm);
		text-align: left;
		cursor: pointer;
		color: var(--c-text);
	}
	.row:hover {
		background: var(--c-surface-2);
	}
	.row.selected {
		border-color: var(--c-primary);
		background: var(--c-primary-soft);
	}
	.row :global(svg) {
		flex-shrink: 0;
		color: var(--c-text-muted);
		transition: transform 0.1s;
	}
	.row :global(svg.open) {
		transform: rotate(90deg);
	}
	.tag {
		font-weight: var(--fw-bold);
		white-space: nowrap;
	}
	.designation {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--c-text-muted);
	}
	.ref {
		max-width: 90px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.ref.missing {
		color: var(--c-warning);
	}
	.flag {
		display: flex;
		color: var(--c-danger);
	}
	.flag :global(svg) {
		color: var(--c-danger);
	}
	.places {
		margin: 0 0 var(--sp-1) 22px;
	}
	.places button {
		padding: 1px var(--sp-1);
		border: none;
		background: transparent;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		cursor: pointer;
		text-align: left;
	}
	.places button:hover {
		color: var(--c-primary);
		text-decoration: underline;
	}
	.pos {
		font-weight: var(--fw-bold);
		color: var(--c-text);
		font-variant-numeric: tabular-nums;
	}
	.cat {
		padding: 1px var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		font-style: italic;
	}
	.empty {
		margin: var(--sp-3) var(--sp-1);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
	.bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-2) var(--sp-3);
		border-top: 1px solid var(--c-border);
		font-size: var(--fs-xs);
	}
</style>
