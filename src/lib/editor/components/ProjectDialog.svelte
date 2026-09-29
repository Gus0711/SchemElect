<script lang="ts">
	/** Propriétés du dossier : cartouche, indices de révision, potentiels. */
	import { deepClone, newId } from '$lib/model/ids';
	import type { Potential, ProjectMeta, ProjectSettings, Revision } from '$lib/model/types';
	import { Button, Field, Modal } from '$lib/ui';
	import { Plus, Trash } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { editor, open = $bindable(false) }: { editor: Editor; open?: boolean } = $props();

	let meta: ProjectMeta = $state({} as ProjectMeta);
	let revisions: Revision[] = $state([]);
	let potentials: Potential[] = $state([]);
	let settings: ProjectSettings = $state({ wireNumberDigits: 2, wireNumberStart: 1 });
	let tab: 'info' | 'revisions' | 'potentials' | 'numbering' = $state('info');

	$effect(() => {
		if (!open) return;
		const p = $state.snapshot(editor.project);
		meta = deepClone(p.meta);
		revisions = deepClone(p.revisions);
		potentials = deepClone(p.potentials);
		settings = deepClone(p.settings);
	});

	const usedPotentials = $derived(
		new Set(editor.project.folios.flatMap((f) => f.bars.map((b) => b.potentialId)))
	);

	const infoFields: [keyof ProjectMeta, string][] = [
		['name', 'Nom du projet'],
		['affaireNumber', 'N° d’affaire'],
		['planNumber', 'N° de plan'],
		['client', 'Client / site'],
		['author', 'Dessinateur'],
		['company', 'Société'],
		['companyAddress', 'Adresse société']
	];

	function save() {
		const m = $state.snapshot(meta);
		const r = $state.snapshot(revisions);
		const pots = $state.snapshot(potentials);
		const st = $state.snapshot(settings);
		editor.transact('Propriétés du dossier', (p) => {
			p.meta = { ...m, modifiedAt: p.meta.modifiedAt };
			p.revisions = r;
			p.potentials = pots;
			p.settings = {
				wireNumberStart: Math.max(0, Math.round(st.wireNumberStart) || 0),
				wireNumberDigits: Math.min(6, Math.max(1, Math.round(st.wireNumberDigits) || 1))
			};
		});
		open = false;
	}

	function nextIndice() {
		const last = revisions.at(-1)?.indice;
		return last ? String.fromCharCode(last.charCodeAt(0) + 1) : 'A';
	}
</script>

<Modal bind:open title="Propriétés du dossier" width="640px">
	<nav class="tabs">
		<button class:active={tab === 'info'} onclick={() => (tab = 'info')}>Cartouche</button>
		<button class:active={tab === 'revisions'} onclick={() => (tab = 'revisions')}>Indices</button>
		<button class:active={tab === 'potentials'} onclick={() => (tab = 'potentials')}
			>Potentiels</button
		>
		<button class:active={tab === 'numbering'} onclick={() => (tab = 'numbering')}
			>Numérotation</button
		>
	</nav>

	{#if tab === 'info'}
		<div class="grid2">
			{#each infoFields as [key, label] (key)}
				<Field {label} bind:value={meta[key]} />
			{/each}
		</div>
	{:else if tab === 'revisions'}
		<table>
			<thead><tr><th>Indice</th><th>Modification</th><th>Date</th><th></th></tr></thead>
			<tbody>
				{#each revisions as r, i (i)}
					<tr>
						<td><input class="cell short" bind:value={r.indice} /></td>
						<td><input class="cell" bind:value={r.description} /></td>
						<td><input class="cell" type="date" bind:value={r.date} /></td>
						<td
							><button class="icon" onclick={() => revisions.splice(i, 1)} title="Supprimer"
								><Trash size={14} /></button
							></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
		<div>
			<Button
				size="sm"
				onclick={() =>
					revisions.push({
						indice: nextIndice(),
						description: '',
						date: new Date().toISOString().slice(0, 10)
					})}
			>
				<Plus size={14} /> Ajouter un indice
			</Button>
		</div>
	{:else if tab === 'numbering'}
		<p class="muted">
			Les fils sont numérotés sur tout le dossier, dans l'ordre des folios puis de gauche à droite.
			Les fils reliés à un potentiel (barre) portent le nom du potentiel et ne sont pas numérotés.
			Un numéro imposé sur un fil (inspecteur) est conservé.
		</p>
		<div class="grid2">
			<Field label="Premier numéro" type="number" min="0" bind:value={settings.wireNumberStart} />
			<Field
				label="Nombre de chiffres"
				type="number"
				min="1"
				max="6"
				bind:value={settings.wireNumberDigits}
				hint="2 → 01, 02… ; 3 → 001, 002…"
			/>
		</div>
	{:else}
		<table>
			<thead
				><tr><th>Nom</th><th>Couleur de fil</th><th>Tracé</th><th>Pointillé</th><th></th></tr
				></thead
			>
			<tbody>
				{#each potentials as pot, i (pot.id)}
					<tr>
						<td><input class="cell" bind:value={pot.name} /></td>
						<td><input class="cell" bind:value={pot.wireColor} /></td>
						<td><input class="swatch" type="color" bind:value={pot.stroke} /></td>
						<td><input type="checkbox" bind:checked={pot.dashed} /></td>
						<td>
							<button
								class="icon"
								disabled={usedPotentials.has(pot.id)}
								title={usedPotentials.has(pot.id) ? 'Utilisé par une barre' : 'Supprimer'}
								onclick={() => potentials.splice(i, 1)}><Trash size={14} /></button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div>
			<Button
				size="sm"
				onclick={() =>
					potentials.push({
						id: newId('pot'),
						name: 'Nouveau potentiel',
						wireColor: '',
						stroke: '#111111'
					})}
			>
				<Plus size={14} /> Ajouter un potentiel
			</Button>
		</div>
	{/if}

	{#snippet actions()}
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" onclick={save} disabled={editor.readonly}>Enregistrer</Button>
	{/snippet}
</Modal>

<style>
	.tabs {
		display: flex;
		gap: var(--sp-1);
		border-bottom: 1px solid var(--c-border);
	}
	.tabs button {
		padding: var(--sp-2) var(--sp-3);
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.tabs button.active {
		color: var(--c-primary);
		border-bottom-color: var(--c-primary);
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th {
		text-align: left;
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		padding: var(--sp-1);
	}
	td {
		padding: 2px var(--sp-1);
	}
	.cell {
		width: 100%;
		height: 28px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	.cell.short {
		width: 56px;
	}
	.swatch {
		width: 40px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	.icon {
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.icon:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
