<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Copy, FilePlus2, FolderOpen, Lock, Pencil, Search, Trash2 } from '@lucide/svelte';
	import { fetchProject } from '$lib/api/client';
	import DuplicateDialog from '$lib/editor/components/DuplicateDialog.svelte';
	import type { ProjectMeta } from '$lib/model/types';
	import { Alert, Button, Card, Field, Modal } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Summary = (typeof data.projects)[number];

	let query = $state('');
	let createOpen = $state(false);
	let renameTarget = $state<Summary | null>(null);
	let renameOpen = $state(false);
	let renameValue = $state('');
	let deleteTarget = $state<Summary | null>(null);
	let deleteOpen = $state(false);
	let pending = $state(false);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.projects;
		return data.projects.filter(
			(p) => p.name.toLowerCase().includes(q) || p.affaireNumber.toLowerCase().includes(q)
		);
	});

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
	const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

	function openRename(p: Summary) {
		renameTarget = p;
		renameValue = p.name;
		renameOpen = true;
	}

	let duplicateOpen = $state(false);
	let duplicateTarget: { id: string; meta: ProjectMeta } | null = $state(null);
	let duplicateError = $state('');

	/** Duplication : le cartouche complet (n° de plan, client) vient du document. */
	async function openDuplicate(p: Summary) {
		duplicateError = '';
		try {
			const { data } = await fetchProject(p.id);
			duplicateTarget = { id: p.id, meta: data.meta };
			duplicateOpen = true;
		} catch (e) {
			duplicateError = e instanceof Error ? e.message : 'Projet introuvable';
		}
	}

	function openDelete(p: Summary) {
		deleteTarget = p;
		deleteOpen = true;
	}

	/** Ferme les modales après succès et rafraîchit la liste. */
	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			pending = false;
			if (result.type === 'success') {
				renameOpen = false;
				deleteOpen = false;
			}
		};
	};

	const errorFor = (action: string) =>
		form && 'error' in form && form.action === action ? form.error : null;
</script>

<svelte:head><title>Projets — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Projets</h1>
	<div class="search">
		<Search size={16} />
		<input
			type="search"
			placeholder="Rechercher (nom, n° d'affaire)…"
			bind:value={query}
			aria-label="Rechercher"
		/>
	</div>
	<form method="POST" action="?/demo">
		<Button type="submit" title="Créer un dossier d'exemple pour découvrir l'outil"
			>Projet de démonstration</Button
		>
	</form>
	<form method="POST" action="?/demoArmoire">
		<Button
			type="submit"
			title="Dossier d'exemple complet : distribution, chaudière, pompe, implantation et façade"
			>Exemple armoire complète</Button
		>
	</form>
	<Button variant="primary" onclick={() => (createOpen = true)}
		><FilePlus2 size={16} /> Nouveau projet</Button
	>
</div>

{#if duplicateError}<Alert>{duplicateError}</Alert>{/if}
{#if !renameOpen && errorFor('rename')}<Alert>{errorFor('rename')}</Alert>{/if}
{#if !deleteOpen && errorFor('delete')}<Alert>{errorFor('delete')}</Alert>{/if}

<Card>
	{#if data.projects.length === 0}
		<div class="empty">
			<FolderOpen size={32} />
			<p>Aucun projet pour l'instant.</p>
			<Button variant="primary" onclick={() => (createOpen = true)}
				><FilePlus2 size={16} /> Créer le premier projet</Button
			>
		</div>
	{:else if filtered.length === 0}
		<p class="muted empty">Aucun projet ne correspond à « {query} ».</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Nom</th>
					<th>N° d'affaire</th>
					<th>Modifié le</th>
					<th>Par</th>
					<th>État</th>
					<th class="actions-col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as p (p.id)}
					<tr>
						<td><a class="name" href="/projets/{p.id}">{p.name}</a></td>
						<td>{p.affaireNumber || '—'}</td>
						<td>{fmtDate(p.updatedAt)}</td>
						<td>{p.updatedByName ?? '—'}</td>
						<td>
							{#if p.lock}
								<span
									class="lock"
									title="Ouvert en édition depuis {timeFmt.format(new Date(p.lock.at))}"
								>
									<Lock size={14} />
									{p.lock.userId === data.user.id ? 'Vous' : p.lock.userName}
								</span>
							{:else}
								<span class="muted">Libre</span>
							{/if}
						</td>
						<td class="actions-col"
							><div class="row-actions">
								<Button
									variant="ghost"
									size="sm"
									title="Dupliquer (nouvelle affaire)"
									disabled={pending}
									onclick={() => openDuplicate(p)}
								>
									<Copy size={15} />
								</Button>
								<Button variant="ghost" size="sm" title="Renommer" onclick={() => openRename(p)}>
									<Pencil size={15} />
								</Button>
								<Button variant="ghost" size="sm" title="Supprimer" onclick={() => openDelete(p)}>
									<Trash2 size={15} />
								</Button>
							</div></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

{#if duplicateTarget}
	<DuplicateDialog
		bind:open={duplicateOpen}
		projectId={duplicateTarget.id}
		meta={duplicateTarget.meta}
	/>
{/if}

<Modal bind:open={createOpen} title="Nouveau projet">
	<form id="create-form" method="POST" action="?/create" use:enhance={submit}>
		<Field label="Nom du projet" name="name" required />
		<div class="row">
			<Field label="N° d'affaire" name="affaireNumber" />
			<Field label="N° de plan" name="planNumber" />
		</div>
		<Field label="Client" name="client" />
		<Field label="Modèle de cartouche et de page de garde">
			<select name="template">
				<option value="">Standard</option>
				{#each data.templates as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
			</select>
		</Field>
		{#if errorFor('create')}<Alert>{errorFor('create')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (createOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="create-form" disabled={pending}>Créer</Button>
	{/snippet}
</Modal>

<Modal bind:open={renameOpen} title="Renommer le projet">
	<form id="rename-form" method="POST" action="?/rename" use:enhance={submit}>
		<input type="hidden" name="id" value={renameTarget?.id ?? ''} />
		<Field label="Nom du projet" name="name" bind:value={renameValue} required />
		{#if errorFor('rename')}<Alert>{errorFor('rename')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (renameOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="rename-form" disabled={pending}>Renommer</Button>
	{/snippet}
</Modal>

<Modal bind:open={deleteOpen} title="Supprimer le projet">
	<form id="delete-form" method="POST" action="?/delete" use:enhance={submit}>
		<input type="hidden" name="id" value={deleteTarget?.id ?? ''} />
		<p>
			Supprimer définitivement <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.
		</p>
		{#if errorFor('delete')}<Alert>{errorFor('delete')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (deleteOpen = false)}>Annuler</Button>
		<Button variant="danger" type="submit" form="delete-form" disabled={pending}
			><Trash2 size={16} /> Supprimer</Button
		>
	{/snippet}
</Modal>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.toolbar h1 {
		flex: 1;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 320px;
		height: var(--control-h);
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text-muted);
	}
	.search:focus-within {
		border-color: var(--c-primary);
		outline: 2px solid var(--c-primary-soft);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--c-text);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: var(--sp-2) var(--sp-3);
		text-align: left;
		border-bottom: 1px solid var(--c-border);
		white-space: nowrap;
	}
	th {
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	tbody tr:hover {
		background: var(--c-surface-2);
	}
	.name {
		font-weight: var(--fw-medium);
		white-space: normal;
	}
	.lock {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		color: var(--c-warning);
		font-weight: var(--fw-medium);
	}
	.actions-col {
		width: 1%;
		text-align: right;
	}
	.row-actions {
		display: flex;
		justify-content: flex-end;
		gap: 2px;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-6) 0;
		color: var(--c-text-muted);
		text-align: center;
	}
	.empty p {
		margin: 0;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
