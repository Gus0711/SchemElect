<script lang="ts">
	/**
	 * Recherche dans tout le dossier (Ctrl+F) : repères, références, n° de fils, bornes,
	 * câbles, folios, textes. ↑ / ↓ pour choisir, Entrée pour y aller, Échap pour fermer.
	 */
	import { searchProject, type SearchHit, type SearchKind } from '$lib/model/inventory';
	import { Cable, FileText, Hash, Search, SquareDot, Type, Zap } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	let query = $state('');
	let active = $state(0);
	let input: HTMLInputElement | undefined = $state();
	let listEl: HTMLUListElement | undefined = $state();

	const hits = $derived(
		editor.searchOpen ? searchProject(editor.project, editor.analysis, query) : []
	);

	const LABEL: Record<SearchKind, string> = {
		device: 'Appareil',
		terminal: 'Borne',
		wire: 'Fil',
		cable: 'Câble',
		folio: 'Folio',
		text: 'Texte'
	};
	const ICON = {
		device: Zap,
		terminal: SquareDot,
		wire: Hash,
		cable: Cable,
		folio: FileText,
		text: Type
	};

	// Ouverture : texte sélectionné, prêt à être remplacé.
	$effect(() => {
		if (!editor.searchOpen) return;
		tick().then(() => {
			input?.focus();
			input?.select();
		});
	});
	$effect(() => {
		void query;
		active = 0;
	});

	function close() {
		editor.searchOpen = false;
	}

	function go(hit: SearchHit | undefined) {
		if (!hit) return;
		editor.goToItem(hit.folioId, hit.item);
		close();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!hits.length) return;
			active = (active + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
			tick().then(() => listEl?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			go(hits[active]);
		}
	}
</script>

{#if editor.searchOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={close}></div>
	<div class="search" role="dialog" aria-label="Rechercher dans le dossier">
		<label class="field">
			<Search size={16} />
			<input
				bind:this={input}
				bind:value={query}
				{onkeydown}
				placeholder="Rechercher : KM3, P12, n° de fil 27, LC1D09, pompe…"
				aria-label="Rechercher dans le dossier"
			/>
			<kbd>Échap</kbd>
		</label>
		{#if query.trim()}
			<ul bind:this={listEl}>
				{#each hits as h, i (`${h.kind}:${h.folioId}:${h.item?.id ?? ''}:${h.label}`)}
					{@const Icon = ICON[h.kind]}
					<li>
						<button
							class:active={i === active}
							onmouseenter={() => (active = i)}
							onclick={() => go(h)}
						>
							<Icon size={14} />
							<span class="label">{h.label}</span>
							<span class="detail">{h.detail}</span>
							<span class="kind">{LABEL[h.kind]}</span>
						</button>
					</li>
				{:else}
					<li class="empty">Aucun résultat.</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">
				Repère (KM3), borne (P12), n° de fil (27), référence, désignation, câble (W2), titre ou
				numéro de folio, texte.
			</p>
		{/if}
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: var(--c-backdrop);
	}
	.search {
		position: fixed;
		top: 72px;
		left: 50%;
		z-index: 91;
		width: min(640px, calc(100vw - 32px));
		transform: translateX(-50%);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
		box-shadow: var(--shadow);
		overflow: hidden;
	}
	.field {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-3);
		border-bottom: 1px solid var(--c-border);
		color: var(--c-text-muted);
	}
	.field input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-size: var(--fs-lg);
		color: var(--c-text);
	}
	kbd {
		padding: 1px 6px;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		font-size: var(--fs-xs);
		font-family: inherit;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: var(--sp-1);
		max-height: 55vh;
		overflow-y: auto;
	}
	li button {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 100%;
		padding: var(--sp-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		text-align: left;
		cursor: pointer;
		color: var(--c-text);
	}
	li button.active {
		background: var(--c-primary-soft);
	}
	li button :global(svg) {
		flex-shrink: 0;
		color: var(--c-text-muted);
	}
	.label {
		font-weight: var(--fw-bold);
		white-space: nowrap;
	}
	.detail {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
	.kind {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.empty,
	.hint {
		margin: 0;
		padding: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
</style>
