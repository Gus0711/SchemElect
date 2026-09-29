<script lang="ts">
	/** Macros : blocs réutilisables partagés (départ moteur, voyants…), insérés avec renumérotation. */
	import { createMacro, deleteMacro, listMacros } from '$lib/api/client';
	import type { Macro } from '$lib/api/types';
	import { Button, Field, Modal } from '$lib/ui';
	import { BookmarkPlus, Trash } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { Editor } from '../editor.svelte';

	let { editor }: { editor: Editor } = $props();

	let macros: Macro[] = $state([]);
	let error = $state('');
	let dialog = $state(false);
	let name = $state('');
	let category = $state('Général');

	onMount(load);

	async function load() {
		try {
			macros = await listMacros();
			error = '';
		} catch {
			error = 'Macros indisponibles.';
		}
	}

	const groups = $derived.by(() => {
		const map = new Map<string, Macro[]>();
		for (const m of macros)
			map.set(m.category || 'Général', [...(map.get(m.category || 'Général') ?? []), m]);
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'));
	});

	function openCreate() {
		name = '';
		dialog = true;
	}

	async function save() {
		const data = editor.selectionFragment();
		if (!data || !name.trim()) return;
		await createMacro({ name: name.trim(), category: category.trim() || 'Général', data });
		dialog = false;
		await load();
	}

	async function remove(m: Macro) {
		if (!confirm(`Supprimer la macro « ${m.name} » ?`)) return;
		await deleteMacro(m.id);
		await load();
	}

	function use(m: Macro) {
		editor.setTool({ kind: 'paste', fragment: m.data, devices: 'renumber' });
	}
</script>

<div class="macros">
	<div class="actions">
		<Button
			size="sm"
			variant="ghost"
			onclick={openCreate}
			disabled={!editor.selection.length}
			title="Enregistrer la sélection comme macro"
		>
			<BookmarkPlus size={14} /> Depuis la sélection
		</Button>
	</div>
	{#if error}<p class="muted pad">{error}</p>{/if}
	<div class="list">
		{#each groups as [cat, items] (cat)}
			<h4>{cat}</h4>
			{#each items as m (m.id)}
				<div class="row">
					<button class="use" onclick={() => use(m)} title="Insérer (repères renumérotés)">
						<span>{m.name}</span>
						<small class="muted">{m.data.symbols.length} symboles</small>
					</button>
					<button class="del" onclick={() => remove(m)} title="Supprimer"
						><Trash size={13} /></button
					>
				</div>
			{/each}
		{:else}
			{#if !error}<p class="muted pad">
					Sélectionnez des éléments puis « Depuis la sélection » pour créer une macro.
				</p>{/if}
		{/each}
	</div>
</div>

<Modal bind:open={dialog} title="Nouvelle macro">
	<Field label="Nom" bind:value={name} placeholder="Départ pompe simple" />
	<Field label="Catégorie" bind:value={category} />
	<p class="muted">
		{editor.selection.length} élément(s) sélectionné(s). Les repères seront renumérotés à chaque insertion.
	</p>
	{#snippet actions()}
		<Button onclick={() => (dialog = false)}>Annuler</Button>
		<Button variant="primary" onclick={save} disabled={!name.trim()}>Enregistrer</Button>
	{/snippet}
</Modal>

<style>
	.macros {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}
	.actions {
		padding: var(--sp-2);
	}
	.pad {
		padding: 0 var(--sp-3);
		font-size: var(--fs-sm);
	}
	.list {
		overflow-y: auto;
		padding: 0 var(--sp-2) var(--sp-2);
	}
	h4 {
		margin: var(--sp-2) var(--sp-1) var(--sp-1);
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		text-transform: uppercase;
	}
	.row {
		display: flex;
		align-items: center;
	}
	.use {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 6px var(--sp-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.use:hover {
		background: var(--c-surface-2);
	}
	.del {
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
		padding: var(--sp-1);
	}
	.del:hover {
		color: var(--c-danger);
	}
</style>
