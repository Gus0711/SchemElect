<script lang="ts">
	/** Fiche d'une affaire : identité, statut, schémas (ouvrir, PDF, dupliquer), nouveau schéma. */
	import { enhance } from '$app/forms';
	import { Copy, FileDown, FilePlus2, Lock } from '@lucide/svelte';
	import { fetchProject } from '$lib/api/client';
	import { canEdit } from '$lib/model/access';
	import { AFFAIRE_STATUSES, affaireTitle, STATUS_LABEL } from '$lib/model/affaires';
	import type { ProjectMeta } from '$lib/model/types';
	import DuplicateDialog from '$lib/editor/components/DuplicateDialog.svelte';
	import NewProjectDialog from '$lib/projects/NewProjectDialog.svelte';
	import { Alert, Button, Card } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const editable = $derived(canEdit(data.user.role));
	const a = $derived(data.affaire);
	type Summary = (typeof data.projects)[number];

	let createOpen = $state(false);
	let pdfBusy: string | null = $state(null);
	let pdfProgress = $state('');
	let actionError = $state('');

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	async function pdf(list: Summary[]) {
		actionError = '';
		const { downloadSavedProjectPdf } = await import('$lib/export/projectPdf');
		for (const [i, p] of list.entries()) {
			pdfBusy = p.id;
			pdfProgress = list.length > 1 ? `PDF ${i + 1} / ${list.length} : ${p.name}` : '';
			try {
				await downloadSavedProjectPdf(p.id);
			} catch (e) {
				actionError = `PDF de « ${p.name} » : ${e instanceof Error ? e.message : String(e)}`;
			}
		}
		pdfBusy = null;
		pdfProgress = '';
	}

	let duplicateOpen = $state(false);
	let duplicateTarget: { id: string; meta: ProjectMeta } | null = $state(null);
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
</script>

<svelte:head><title>{affaireTitle(a)} — SchemElect</title></svelte:head>

<nav class="crumbs muted small">
	<a href="/affaires">Affaires</a> › {data.client.name}
</nav>

<div class="toolbar">
	<h1>{affaireTitle(a)}</h1>
	<span class="status {a.status}">{STATUS_LABEL[a.status]}</span>
	<span class="spacer"></span>
	{#if data.projects.length}
		<Button
			disabled={pdfBusy !== null}
			title="Télécharger le PDF de chaque schéma de l’affaire"
			onclick={() => pdf(data.projects)}
			><FileDown size={16} /> Tous les PDF ({data.projects.length})</Button
		>
	{/if}
	{#if editable && a.status !== 'archivee'}
		<Button variant="primary" onclick={() => (createOpen = true)}
			><FilePlus2 size={16} /> Nouveau schéma</Button
		>
	{/if}
</div>

{#if pdfProgress}<Alert variant="info">{pdfProgress}</Alert>{/if}
{#if actionError}<Alert>{actionError}</Alert>{/if}
{#if form && 'error' in form}<Alert>{form.error}</Alert>{/if}

<Card>
	<dl class="info">
		<div>
			<dt>Client</dt>
			<dd>{data.client.name}{data.client.city ? ` (${data.client.city})` : ''}</dd>
		</div>
		<div>
			<dt>N° WhySoft</dt>
			<dd>{a.whysoft || '—'}</dd>
		</div>
		<div>
			<dt>N° d’affaire</dt>
			<dd>{a.number || '—'}</dd>
		</div>
		<div>
			<dt>Désignation</dt>
			<dd>{a.label || '—'}</dd>
		</div>
		<div>
			<dt>Année</dt>
			<dd>{a.year}</dd>
		</div>
		<div>
			<dt>Statut</dt>
			<dd>
				{#if editable}
					<form method="POST" action="?/status" use:enhance>
						<select
							name="status"
							aria-label="Statut de l’affaire"
							value={a.status}
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						>
							{#each AFFAIRE_STATUSES as s (s)}<option value={s}>{STATUS_LABEL[s]}</option>{/each}
						</select>
					</form>
				{:else}
					{STATUS_LABEL[a.status]}
				{/if}
			</dd>
		</div>
	</dl>
	{#if a.source === 'erp'}
		<p class="muted small">Affaire reprise de l’ERP : seul le statut se modifie ici.</p>
	{/if}
</Card>

<h2>Schémas</h2>
<Card>
	{#if data.projects.length === 0}
		<p class="muted empty">
			Aucun schéma dans cette affaire.{#if editable && a.status !== 'archivee'}
				<Button size="sm" onclick={() => (createOpen = true)}
					><FilePlus2 size={14} /> Nouveau schéma</Button
				>{/if}
		</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Nom</th>
					<th>Modifié le</th>
					<th>Par</th>
					<th>État</th>
					<th class="actions-col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.projects as p (p.id)}
					<tr>
						<td><a class="name" href="/projets/{p.id}">{p.name}</a></td>
						<td>{dateFmt.format(new Date(p.updatedAt))}</td>
						<td>{p.updatedByName ?? '—'}</td>
						<td>
							{#if p.lock}
								<span class="lock"
									><Lock size={14} />
									{p.lock.userId === data.user.id ? 'Vous' : p.lock.userName}</span
								>
							{:else}<span class="muted">Libre</span>{/if}
						</td>
						<td class="actions-col"
							><div class="row-actions">
								<Button
									variant="ghost"
									size="sm"
									title="PDF du dossier"
									disabled={pdfBusy !== null}
									onclick={() => pdf([p])}><FileDown size={15} /></Button
								>
								{#if editable}
									<Button
										variant="ghost"
										size="sm"
										title="Dupliquer (même affaire ou une autre)"
										onclick={() => openDuplicate(p)}><Copy size={15} /></Button
									>
								{/if}
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

<NewProjectDialog
	bind:open={createOpen}
	affaires={data.affaires}
	clients={data.clients}
	templates={data.templates}
	affaireId={a.id}
/>

<style>
	.crumbs {
		margin-bottom: calc(-1 * var(--sp-2));
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.spacer {
		flex: 1;
	}
	h2 {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-md);
	}
	.info {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--sp-3);
		margin: 0;
	}
	dt {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	dd {
		margin: 2px 0 0;
		font-weight: var(--fw-medium);
	}
	dd form {
		margin: 0;
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
	.name {
		font-weight: var(--fw-medium);
	}
	.lock {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		color: var(--c-warning);
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
	.empty {
		display: flex;
		align-items: center;
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
