<script lang="ts">
	/**
	 * Clients et affaires de la société : une affaire = un n° WhySoft, rattachée à un client,
	 * regroupe un ou plusieurs schémas (armoires). Saisie manuelle en attendant le connecteur
	 * ERP ; les fiches reprises de l'ERP ne se modifient pas ici.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		Briefcase,
		ChevronDown,
		ChevronRight,
		FolderInput,
		Pencil,
		Plus,
		Search,
		Trash2,
		UserPlus
	} from '@lucide/svelte';
	import { canEdit, isAdmin } from '$lib/model/access';
	import {
		AFFAIRE_STATUSES,
		affaireTitle,
		nameKey,
		STATUS_LABEL,
		type AffaireStatus
	} from '$lib/model/affaires';
	import { Alert, Button, Card, Field, Modal } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const editable = $derived(canEdit(data.user.role));
	const admin = $derived(isAdmin(data.user.role));

	type AffaireRow = (typeof data.affaires)[number];
	type ClientRow = (typeof data.clients)[number];

	let tab: 'affaires' | 'clients' = $state('affaires');
	let query = $state('');
	let status: AffaireStatus | '' = $state('en_cours');
	let year = $state('');
	let expanded: string | null = $state(null);
	let pending = $state(false);
	let notice = $state('');

	const years = $derived([...new Set(data.affaires.map((a) => a.year))].sort((a, b) => b - a));
	const unclassified = $derived(data.projects.filter((p) => !p.affaireId));

	const q = $derived(nameKey(query));
	const affaires = $derived(
		data.affaires.filter(
			(a) =>
				(!status || a.status === status) &&
				(!year || a.year === Number(year)) &&
				(!q || [a.whysoft, a.number, a.label, a.clientName].some((s) => nameKey(s).includes(q)))
		)
	);
	const clients = $derived(
		data.clients.filter((c) => !q || [c.name, c.code, c.city].some((s) => nameKey(s).includes(q)))
	);
	const schemasOf = (id: string) => data.projects.filter((p) => p.affaireId === id);

	// --- Saisie ---------------------------------------------------------------------
	let affaireOpen = $state(false);
	let editedAffaire: Partial<AffaireRow> = $state({});
	/** Affaire reprise de l'ERP : seul le statut se modifie. */
	const erp = $derived(editedAffaire.source === 'erp');
	let clientOpen = $state(false);
	let editedClient: Partial<ClientRow> = $state({});
	let deleteOpen = $state(false);
	let deleteTarget: { kind: 'client' | 'affaire'; id: string; name: string } | null = $state(null);
	let classifyOpen = $state(false);

	function openAffaire(a?: AffaireRow) {
		notice = '';
		editedAffaire = a
			? { ...a }
			: {
					clientId: data.clients[0]?.id ?? '',
					year: new Date().getFullYear(),
					status: 'en_cours'
				};
		affaireOpen = true;
	}

	function openClient(c?: ClientRow) {
		notice = '';
		editedClient = c ? { ...c } : {};
		clientOpen = true;
	}

	function openDelete(kind: 'client' | 'affaire', id: string, name: string) {
		notice = '';
		deleteTarget = { kind, id, name };
		deleteOpen = true;
	}

	const submit: SubmitFunction = ({ action }) => {
		pending = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			pending = false;
			if (result.type !== 'success') return;
			const kind = action.search.replace('?/', '');
			const d = result.data as Record<string, number> | undefined;
			notice =
				kind === 'saveAffaire'
					? 'Affaire enregistrée.'
					: kind === 'saveClient'
						? 'Client enregistré.'
						: kind === 'classify'
							? `${d?.classified ?? 0} schéma(s) classé(s) : ${d?.clients ?? 0} client(s) et ${d?.affaires ?? 0} affaire(s) créés, ${d?.skipped ?? 0} laissé(s) non classé(s).`
							: 'Supprimé.';
			affaireOpen = clientOpen = deleteOpen = classifyOpen = false;
		};
	};

	const errorFor = (action: string) =>
		form && 'error' in form && form.action === action ? form.error : null;

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
</script>

<svelte:head><title>Affaires — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Affaires</h1>
	<div class="tabs" role="tablist">
		<button role="tab" aria-selected={tab === 'affaires'} onclick={() => (tab = 'affaires')}
			>Affaires ({data.affaires.length})</button
		>
		<button role="tab" aria-selected={tab === 'clients'} onclick={() => (tab = 'clients')}
			>Clients ({data.clients.length})</button
		>
	</div>
	<div class="search">
		<Search size={16} />
		<input
			type="search"
			placeholder={tab === 'affaires' ? 'N° WhySoft, client, désignation…' : 'Nom, code, ville…'}
			bind:value={query}
			aria-label="Rechercher"
		/>
	</div>
	{#if tab === 'affaires'}
		<select bind:value={status} aria-label="Statut">
			<option value="">Tous statuts</option>
			{#each AFFAIRE_STATUSES as s (s)}<option value={s}>{STATUS_LABEL[s]}</option>{/each}
		</select>
		<select bind:value={year} aria-label="Année">
			<option value="">Toutes années</option>
			{#each years as y (y)}<option value={String(y)}>{y}</option>{/each}
		</select>
	{/if}
	{#if editable}
		{#if tab === 'affaires'}
			<Button
				variant="primary"
				disabled={!data.clients.length}
				title={data.clients.length ? '' : 'Créez d’abord un client'}
				onclick={() => openAffaire()}><Plus size={16} /> Nouvelle affaire</Button
			>
		{:else}
			<Button variant="primary" onclick={() => openClient()}
				><UserPlus size={16} /> Nouveau client</Button
			>
		{/if}
	{/if}
</div>

{#if notice}<Alert variant="success">{notice}</Alert>{/if}
{#if !deleteOpen && (errorFor('deleteClient') || errorFor('deleteAffaire'))}
	<Alert>{errorFor('deleteClient') || errorFor('deleteAffaire')}</Alert>
{/if}

{#if unclassified.length}
	<div class="unclassified">
		<FolderInput size={16} />
		<span
			><strong>{unclassified.length} schéma(s) non classé(s)</strong> : rattachez-les à une affaire
			(Dossier › Propriétés dans l’éditeur){admin
				? ', ou laissez SchemElect les classer d’après le client et le n° d’affaire de leur cartouche'
				: ''}.</span
		>
		{#if admin}
			<Button size="sm" onclick={() => ((classifyOpen = true), (notice = ''))}
				>Classer l’existant…</Button
			>
		{/if}
	</div>
{/if}

<Card>
	{#if tab === 'affaires'}
		{#if data.affaires.length === 0}
			<div class="empty">
				<Briefcase size={32} />
				<p>
					Aucune affaire. Une affaire = un n° WhySoft, chez un client ; elle regroupe les schémas de
					ses armoires.
				</p>
				{#if editable && !data.clients.length}
					<Button variant="primary" onclick={() => ((tab = 'clients'), openClient())}
						><UserPlus size={16} /> Créer le premier client</Button
					>
				{:else if editable}
					<Button variant="primary" onclick={() => openAffaire()}
						><Plus size={16} /> Créer la première affaire</Button
					>
				{/if}
			</div>
		{:else if affaires.length === 0}
			<p class="muted empty">Aucune affaire ne correspond aux filtres.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th class="toggle-col"></th>
						<th>N° WhySoft</th>
						<th>Client</th>
						<th>Désignation</th>
						<th>Année</th>
						<th>Statut</th>
						<th>Schémas</th>
						<th class="actions-col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each affaires as a (a.id)}
						<tr class:open={expanded === a.id}>
							<td class="toggle-col">
								<button
									class="toggle"
									aria-label="Schémas de l’affaire {affaireTitle(a)}"
									aria-expanded={expanded === a.id}
									onclick={() => (expanded = expanded === a.id ? null : a.id)}
								>
									{#if expanded === a.id}<ChevronDown size={16} />{:else}<ChevronRight
											size={16}
										/>{/if}
								</button>
							</td>
							<td class="strong">{a.whysoft || '—'}</td>
							<td>{a.clientName}</td>
							<td class="label"
								>{a.label}{#if a.number}<span class="muted"
										>{a.label ? ' · ' : ''}n° d’affaire {a.number}</span
									>{/if}{#if !a.label && !a.number}—{/if}</td
							>
							<td>{a.year}</td>
							<td><span class="status {a.status}">{STATUS_LABEL[a.status]}</span></td>
							<td>{a.projects}</td>
							<td class="actions-col"
								><div class="row-actions">
									{#if a.source === 'erp'}<span class="erp" title="Reprise de l’ERP">ERP</span>{/if}
									{#if editable}
										<Button
											variant="ghost"
											size="sm"
											title="Modifier"
											onclick={() => openAffaire(a)}><Pencil size={15} /></Button
										>
										<Button
											variant="ghost"
											size="sm"
											title={a.projects ? 'Des schémas y sont rattachés' : 'Supprimer'}
											disabled={a.projects > 0 || a.source === 'erp'}
											onclick={() => openDelete('affaire', a.id, affaireTitle(a))}
											><Trash2 size={15} /></Button
										>
									{/if}
								</div></td
							>
						</tr>
						{#if expanded === a.id}
							<tr class="schemas">
								<td></td>
								<td colspan="7">
									{#each schemasOf(a.id) as p (p.id)}
										<a href="/projets/{p.id}">{p.name}</a>
										<span class="muted">modifié le {dateFmt.format(new Date(p.updatedAt))}</span><br
										/>
									{:else}
										<span class="muted"
											>Aucun schéma. Rattachez un schéma depuis l’éditeur (Dossier › Propriétés) ou
											à sa création.</span
										>
									{/each}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		{/if}
	{:else if data.clients.length === 0}
		<div class="empty">
			<UserPlus size={32} />
			<p>Aucun client.</p>
			{#if editable}
				<Button variant="primary" onclick={() => openClient()}
					><UserPlus size={16} /> Créer le premier client</Button
				>
			{/if}
		</div>
	{:else}
		<table>
			<thead>
				<tr>
					<th>Client</th>
					<th>Code</th>
					<th>Ville</th>
					<th>Affaires</th>
					<th class="actions-col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each clients as c (c.id)}
					<tr>
						<td class="strong">{c.name}</td>
						<td>{c.code || '—'}</td>
						<td>{c.city || '—'}</td>
						<td>{c.affaires}</td>
						<td class="actions-col"
							><div class="row-actions">
								{#if c.source === 'erp'}<span class="erp" title="Repris de l’ERP">ERP</span>{/if}
								{#if editable && c.source !== 'erp'}
									<Button variant="ghost" size="sm" title="Modifier" onclick={() => openClient(c)}
										><Pencil size={15} /></Button
									>
									<Button
										variant="ghost"
										size="sm"
										title={c.affaires ? 'Ce client a des affaires' : 'Supprimer'}
										disabled={c.affaires > 0}
										onclick={() => openDelete('client', c.id, c.name)}><Trash2 size={15} /></Button
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

<Modal bind:open={affaireOpen} title={editedAffaire.id ? 'Modifier l’affaire' : 'Nouvelle affaire'}>
	<form id="affaire-form" method="POST" action="?/saveAffaire" use:enhance={submit}>
		<input type="hidden" name="id" value={editedAffaire.id ?? ''} />
		<Field label="Client">
			<select name="clientId" bind:value={editedAffaire.clientId} disabled={erp} required>
				{#each data.clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
		</Field>
		<div class="row">
			<Field
				label="N° WhySoft"
				name="whysoft"
				bind:value={editedAffaire.whysoft}
				disabled={erp}
				hint="Relie les schémas à la commande"
			/>
			<Field
				label="N° d’affaire (cartouche)"
				name="number"
				bind:value={editedAffaire.number}
				disabled={erp}
				hint="Facultatif"
			/>
		</div>
		<Field
			label="Désignation"
			name="label"
			bind:value={editedAffaire.label}
			disabled={erp}
			placeholder="Chaufferie collège Jean Moulin"
		/>
		<div class="row">
			<Field
				label="Année"
				name="year"
				type="number"
				min="1990"
				max="2200"
				bind:value={editedAffaire.year}
				disabled={erp}
			/>
			<Field label="Statut">
				<select name="status" bind:value={editedAffaire.status}>
					{#each AFFAIRE_STATUSES as s (s)}<option value={s}>{STATUS_LABEL[s]}</option>{/each}
				</select>
			</Field>
		</div>
		{#if erp}
			<!-- Champs désactivés non envoyés : valeurs actuelles (seul le statut change). -->
			<input type="hidden" name="clientId" value={editedAffaire.clientId} />
			<input type="hidden" name="whysoft" value={editedAffaire.whysoft} />
			<input type="hidden" name="label" value={editedAffaire.label} />
			<p class="muted small">Affaire reprise de l’ERP : seul le statut se modifie ici.</p>
		{/if}
		{#if errorFor('saveAffaire')}<Alert>{errorFor('saveAffaire')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (affaireOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="affaire-form" disabled={pending}
			>Enregistrer</Button
		>
	{/snippet}
</Modal>

<Modal bind:open={clientOpen} title={editedClient.id ? 'Modifier le client' : 'Nouveau client'}>
	<form id="client-form" method="POST" action="?/saveClient" use:enhance={submit}>
		<input type="hidden" name="id" value={editedClient.id ?? ''} />
		<Field label="Nom du client" name="name" bind:value={editedClient.name} required />
		<div class="row">
			<Field label="Code client" name="code" bind:value={editedClient.code} hint="Facultatif" />
			<Field label="Ville" name="city" bind:value={editedClient.city} />
		</div>
		{#if editedClient.id}
			<p class="muted small">
				Le nouveau nom est repris dans le cartouche des schémas rattachés (à leur prochaine
				ouverture).
			</p>
		{/if}
		{#if errorFor('saveClient')}<Alert>{errorFor('saveClient')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (clientOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="client-form" disabled={pending}
			>Enregistrer</Button
		>
	{/snippet}
</Modal>

<Modal
	bind:open={deleteOpen}
	title={deleteTarget?.kind === 'client' ? 'Supprimer le client' : 'Supprimer l’affaire'}
>
	<form
		id="delete-form"
		method="POST"
		action={deleteTarget?.kind === 'client' ? '?/deleteClient' : '?/deleteAffaire'}
		use:enhance={submit}
	>
		<input type="hidden" name="id" value={deleteTarget?.id ?? ''} />
		<p>Supprimer <strong>{deleteTarget?.name}</strong> ?</p>
		{#if errorFor('deleteClient') || errorFor('deleteAffaire')}
			<Alert>{errorFor('deleteClient') || errorFor('deleteAffaire')}</Alert>
		{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (deleteOpen = false)}>Annuler</Button>
		<Button variant="danger" type="submit" form="delete-form" disabled={pending}
			><Trash2 size={16} /> Supprimer</Button
		>
	{/snippet}
</Modal>

<Modal bind:open={classifyOpen} title="Classer l’existant">
	<form id="classify-form" method="POST" action="?/classify" use:enhance={submit}>
		<p>
			Chaque schéma non classé est rattaché d’après son cartouche : un client par nom (sans tenir
			compte des accents ni des majuscules), une affaire par client et n° d’affaire. Les clients et
			affaires qui existent déjà sont réutilisés.
		</p>
		<p class="muted small">
			Les schémas sans client ou sans n° d’affaire, et ceux ouverts en édition, restent non classés.
			Les affaires créées n’ont pas de n° WhySoft : à compléter ensuite.
		</p>
	</form>
	{#snippet actions()}
		<Button onclick={() => (classifyOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="classify-form" disabled={pending}
			>Classer {unclassified.length} schéma(s)</Button
		>
	{/snippet}
</Modal>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.toolbar h1 {
		margin-right: var(--sp-2);
	}
	.tabs {
		display: flex;
		flex: 1;
		gap: 2px;
	}
	.tabs button {
		padding: var(--sp-1) var(--sp-3);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		border-color: var(--c-border);
		background: var(--c-surface);
		color: var(--c-primary);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		width: 280px;
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
	.unclassified {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--c-border);
		border-left: 3px solid var(--c-warning);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-sm);
	}
	.unclassified span {
		flex: 1;
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
	tr.open {
		background: var(--c-surface-2);
	}
	.schemas td {
		padding-top: 0;
		white-space: normal;
		line-height: 1.8;
	}
	.schemas a {
		margin-right: var(--sp-2);
		font-weight: var(--fw-medium);
	}
	.toggle-col {
		width: 1%;
		padding-right: 0;
	}
	.toggle {
		display: flex;
		padding: 2px;
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.strong {
		font-weight: var(--fw-medium);
	}
	.label {
		white-space: normal;
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
	.erp {
		margin-right: var(--sp-2);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
	}
	.actions-col {
		width: 1%;
		text-align: right;
	}
	.row-actions {
		display: flex;
		align-items: center;
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
		max-width: 480px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: 0;
	}
	form p {
		margin: 0;
	}
	.small {
		font-size: var(--fs-sm);
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
