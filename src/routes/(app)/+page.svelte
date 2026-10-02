<script lang="ts">
	/**
	 * Page Projets : schémas classés Client › Affaire › Schémas (ou les plus récents d'abord),
	 * filtres client / année / statut, recherche (nom, n° WhySoft, client, désignation),
	 * création guidée, PDF, duplication vers une autre affaire.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ChevronDown,
		ChevronRight,
		Copy,
		FileDown,
		FilePlus2,
		FolderInput,
		FolderOpen,
		Lock,
		Pencil,
		Plus,
		Search,
		Trash2
	} from '@lucide/svelte';
	import { fetchProject } from '$lib/api/client';
	import { canEdit } from '$lib/model/access';
	import { AFFAIRE_STATUSES, affaireTitle, STATUS_LABEL } from '$lib/model/affaires';
	import { buildProjectTree, treeYears, type StatusFilter } from '$lib/model/projectTree';
	import DuplicateDialog from '$lib/editor/components/DuplicateDialog.svelte';
	import NewProjectDialog from '$lib/projects/NewProjectDialog.svelte';
	import type { ProjectMeta } from '$lib/model/types';
	import { Alert, Button, Card, Field, Modal } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Lecteur : consultation seulement (ni création, ni renommage, ni suppression). */
	const editable = $derived(canEdit(data.user.role));

	type Summary = (typeof data.projects)[number];

	// --- Vue et filtres (mémorisés dans le navigateur) -----------------------------
	const VIEW_KEY = 'schemelect.projects.view';
	const readView = (): 'tree' | 'recent' => {
		try {
			return localStorage.getItem(VIEW_KEY) === 'recent' ? 'recent' : 'tree';
		} catch {
			return 'tree';
		}
	};
	let view: 'tree' | 'recent' = $state(typeof localStorage === 'undefined' ? 'tree' : readView());
	function setView(v: 'tree' | 'recent') {
		view = v;
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {
			/* navigation privée : non mémorisé */
		}
	}

	let query = $state('');
	let clientId = $state('');
	let year = $state('');
	let status: StatusFilter = $state('');
	const filtering = $derived(!!(query.trim() || clientId || year || status));

	const rows = $derived(data.projects.map((p) => ({ ...p, affaireId: p.affaire?.id ?? null })));
	const tree = $derived(
		buildProjectTree(rows, data.affaires, {
			query,
			clientId,
			year: year ? Number(year) : null,
			status
		})
	);
	const years = $derived(treeYears(rows, data.affaires));
	/** Vue « Récents » : mêmes filtres, à plat, le plus récent d'abord. */
	const recent = $derived(
		[
			...tree.clients.flatMap((c) => c.affaires.flatMap((a) => a.projects)),
			...tree.unclassified
		].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
	);
	const unclassifiedTotal = $derived(rows.filter((p) => !p.affaireId).length);

	/** Clients repliés (vue par affaire). */
	let collapsed: Record<string, boolean> = $state({});

	function resetFilters() {
		query = '';
		clientId = '';
		year = '';
		status = '';
	}

	// --- Actions --------------------------------------------------------------------
	let createOpen = $state(false);
	let createAffaire = $state('');
	let renameTarget = $state<Summary | null>(null);
	let renameOpen = $state(false);
	let renameValue = $state('');
	let deleteTarget = $state<Summary | null>(null);
	let deleteOpen = $state(false);
	let pending = $state(false);
	let pdfBusy: string | null = $state(null);
	let actionError = $state('');

	function openCreate(affaireId = '') {
		createAffaire = affaireId;
		createOpen = true;
	}

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

	/** Duplication : le cartouche complet (n° de plan, client) vient du document. */
	async function openDuplicate(p: Summary) {
		actionError = '';
		try {
			const { data } = await fetchProject(p.id);
			duplicateTarget = { id: p.id, meta: data.meta };
			duplicateOpen = true;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Projet introuvable';
		}
	}

	async function pdf(p: Summary) {
		pdfBusy = p.id;
		actionError = '';
		try {
			const { downloadSavedProjectPdf } = await import('$lib/export/projectPdf');
			await downloadSavedProjectPdf(p.id);
		} catch (e) {
			actionError = `PDF de « ${p.name} » : ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			pdfBusy = null;
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
	<div class="views" role="tablist" aria-label="Affichage">
		<button role="tab" aria-selected={view === 'tree'} onclick={() => setView('tree')}
			>Par affaire</button
		>
		<button role="tab" aria-selected={view === 'recent'} onclick={() => setView('recent')}
			>Récents</button
		>
	</div>
	<span class="spacer"></span>
	{#if editable}
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
		<Button variant="primary" onclick={() => openCreate()}
			><FilePlus2 size={16} /> Nouveau projet</Button
		>
	{/if}
</div>

<div class="filters">
	<div class="search">
		<Search size={16} />
		<input
			type="search"
			placeholder="Rechercher : nom, n° WhySoft, client, désignation…"
			bind:value={query}
			aria-label="Rechercher"
		/>
	</div>
	<select bind:value={clientId} aria-label="Client">
		<option value="">Tous les clients</option>
		{#each data.clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
	</select>
	<select bind:value={year} aria-label="Année">
		<option value="">Toutes les années</option>
		{#each years as y (y)}<option value={String(y)}>{y}</option>{/each}
	</select>
	<select bind:value={status} aria-label="Statut">
		<option value="">Tous les statuts</option>
		{#each AFFAIRE_STATUSES as s (s)}<option value={s}>{STATUS_LABEL[s]}</option>{/each}
		<option value="non_classe">Non classé</option>
	</select>
	{#if filtering}
		<Button variant="ghost" size="sm" onclick={resetFilters}>Effacer les filtres</Button>
	{/if}
	<span class="count muted">{tree.count} schéma(s)</span>
</div>

{#if actionError}<Alert>{actionError}</Alert>{/if}
{#if !renameOpen && errorFor('rename')}<Alert>{errorFor('rename')}</Alert>{/if}
{#if !deleteOpen && errorFor('delete')}<Alert>{errorFor('delete')}</Alert>{/if}

{#snippet projectRow(p: Summary, indent: boolean, showAffaire: boolean)}
	<tr class:indent>
		<td class="name-col"><a class="name" href="/projets/{p.id}">{p.name}</a></td>
		{#if showAffaire}
			<td>
				{#if p.affaire}
					<a
						class="affaire"
						href="/affaires/{p.affaire.id}"
						title="{p.affaire.client} — {affaireTitle(p.affaire)}"
						>{p.affaire.whysoft || p.affaire.number || p.affaire.label}</a
					>
					<span class="muted">{p.affaire.client}</span>
				{:else}
					<span class="muted" title="Non classé (n° d'affaire du cartouche)"
						>{p.affaireNumber || 'Non classé'}</span
					>
				{/if}
			</td>
		{/if}
		<td>{fmtDate(p.updatedAt)}</td>
		<td>{p.updatedByName ?? '—'}</td>
		<td>
			{#if p.lock}
				<span class="lock" title="Ouvert en édition depuis {timeFmt.format(new Date(p.lock.at))}">
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
					title="PDF du dossier"
					disabled={pdfBusy !== null}
					onclick={() => pdf(p)}><FileDown size={15} /></Button
				>
				{#if editable}
					<Button
						variant="ghost"
						size="sm"
						title="Dupliquer (même affaire ou une autre)"
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
				{/if}
			</div></td
		>
	</tr>
{/snippet}

<Card>
	{#if data.projects.length === 0 && data.affaires.length === 0}
		<div class="empty">
			<FolderOpen size={32} />
			<p>Aucun projet pour l'instant.</p>
			{#if editable}
				<Button variant="primary" onclick={() => openCreate()}
					><FilePlus2 size={16} /> Créer le premier projet</Button
				>
			{/if}
		</div>
	{:else if tree.count === 0 && !tree.clients.length}
		<p class="muted empty">Aucun projet ne correspond aux filtres.</p>
	{:else if view === 'recent'}
		<table>
			<thead>
				<tr>
					<th>Nom</th>
					<th>Affaire</th>
					<th>Modifié le</th>
					<th>Par</th>
					<th>État</th>
					<th class="actions-col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each recent as p (p.id)}{@render projectRow(p, false, true)}{/each}
			</tbody>
		</table>
	{:else}
		<table class="tree">
			<thead>
				<tr>
					<th>Client › Affaire › Schéma</th>
					<th>Modifié le</th>
					<th>Par</th>
					<th>État</th>
					<th class="actions-col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			{#each tree.clients as c (c.clientId)}
				<tbody>
					<tr class="client">
						<td colspan="5">
							<button
								class="toggle"
								aria-expanded={!collapsed[c.clientId]}
								onclick={() => (collapsed[c.clientId] = !collapsed[c.clientId])}
							>
								{#if collapsed[c.clientId]}<ChevronRight size={16} />{:else}<ChevronDown
										size={16}
									/>{/if}
								{c.clientName}
							</button>
							<span class="muted small"
								>{c.affaires.length} affaire(s) · {c.affaires.reduce(
									(n, a) => n + a.projects.length,
									0
								)} schéma(s)</span
							>
						</td>
					</tr>
					{#if !collapsed[c.clientId]}
						{#each c.affaires as node (node.affaire.id)}
							{@const a = node.affaire}
							<tr class="affaire-row">
								<td colspan="4">
									<a class="affaire" href="/affaires/{a.id}">{affaireTitle(a)}</a>
									<span class="muted small">{a.year}</span>
									<span class="status {a.status}">{STATUS_LABEL[a.status]}</span>
									{#if !node.projects.length}<span class="muted small">— aucun schéma</span>{/if}
								</td>
								<td class="actions-col">
									{#if editable && a.status !== 'archivee'}
										<Button
											variant="ghost"
											size="sm"
											title="Nouveau schéma dans cette affaire"
											onclick={() => openCreate(a.id)}><Plus size={15} /></Button
										>
									{/if}
								</td>
							</tr>
							{#each node.projects as p (p.id)}{@render projectRow(p, true, false)}{/each}
						{/each}
					{/if}
				</tbody>
			{/each}
			{#if tree.unclassified.length}
				<tbody>
					<tr class="client">
						<td colspan="5">
							<button
								class="toggle"
								aria-expanded={!collapsed['']}
								onclick={() => (collapsed[''] = !collapsed[''])}
							>
								{#if collapsed['']}<ChevronRight size={16} />{:else}<ChevronDown size={16} />{/if}
								Non classé
							</button>
							<span class="muted small">{tree.unclassified.length} schéma(s) sans affaire</span>
						</td>
					</tr>
					{#if !collapsed['']}
						{#each tree.unclassified as p (p.id)}{@render projectRow(p, true, false)}{/each}
					{/if}
				</tbody>
			{/if}
		</table>
		{#if unclassifiedTotal && !filtering}
			<p class="hint muted small">
				<FolderInput size={14} />
				Rattachez les schémas non classés à une affaire : Dossier › Propriétés dans l’éditeur, ou « Classer
				l’existant » dans la page <a href="/affaires">Affaires</a>.
			</p>
		{/if}
	{/if}
</Card>

{#if duplicateTarget}
	<DuplicateDialog
		bind:open={duplicateOpen}
		projectId={duplicateTarget.id}
		meta={duplicateTarget.meta}
	/>
{/if}

<NewProjectDialog
	bind:open={createOpen}
	affaires={data.affaires}
	clients={data.clients}
	templates={data.templates}
	affaireId={createAffaire}
/>

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
	.toolbar,
	.filters {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.spacer {
		flex: 1;
	}
	.filters select {
		max-width: 240px;
	}
	.views {
		display: flex;
		gap: 2px;
	}
	.views button {
		padding: var(--sp-1) var(--sp-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	.views button[aria-selected='true'] {
		border-color: var(--c-border);
		background: var(--c-surface);
		color: var(--c-primary);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 340px;
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
	.count {
		margin-left: auto;
		font-size: var(--fs-sm);
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
	tbody tr:hover {
		background: var(--c-surface-2);
	}
	.tree tr.client td {
		padding-top: var(--sp-3);
		background: var(--c-surface-2);
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		margin-right: var(--sp-2);
		padding: 0;
		border: none;
		background: transparent;
		color: var(--c-text);
		font-weight: var(--fw-bold);
		cursor: pointer;
	}
	.affaire-row td:first-child {
		padding-left: calc(var(--sp-3) + 20px);
	}
	.affaire-row td > * {
		margin-right: var(--sp-2);
	}
	tr.indent .name-col {
		padding-left: calc(var(--sp-3) + 44px);
	}
	.name {
		font-weight: var(--fw-medium);
		white-space: normal;
	}
	.affaire {
		margin-right: var(--sp-1);
		font-weight: var(--fw-medium);
	}
	.status {
		padding: 1px var(--sp-2);
		border-radius: 999px;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		background: var(--c-surface-2);
		color: var(--c-text-muted);
	}
	.status.en_cours {
		background: var(--c-primary-soft);
		color: var(--c-primary);
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
	.small {
		font-size: var(--fs-sm);
	}
	.hint {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin: var(--sp-3) var(--sp-3) 0;
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
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
