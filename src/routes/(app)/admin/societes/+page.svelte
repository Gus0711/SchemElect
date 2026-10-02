<script lang="ts">
	/** Super-administrateur : sociétés de la plateforme, création, renommage, accès. */
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Building2, LogIn, Pencil, Plus } from '@lucide/svelte';
	import { Alert, Button, Card, Field, Modal } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Org = (typeof data.organizations)[number];

	let createOpen = $state(false);
	let renameOpen = $state(false);
	let target: Org | null = $state(null);
	let pending = $state(false);
	let notice = $state('');

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	const submit: SubmitFunction = ({ action }) => {
		pending = true;
		return async ({ result, update }) => {
			await update();
			pending = false;
			if (result.type === 'success') {
				notice = action.search.includes('create')
					? 'Société créée avec son administrateur.'
					: 'Société renommée.';
				createOpen = renameOpen = false;
			}
		};
	};

	/** Entrer dans une société : la suite de la navigation se fait dans ses dossiers. */
	async function enter(id: string) {
		await fetch('/api/session/organization', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await invalidateAll();
		await goto('/');
	}

	const errorFor = (action: string) =>
		form && 'error' in form && form.action === action ? form.error : null;
</script>

<svelte:head><title>Sociétés — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Sociétés</h1>
	<Button variant="primary" onclick={() => ((createOpen = true), (notice = ''))}
		><Plus size={16} /> Nouvelle société</Button
	>
</div>

<p class="muted">
	Chaque société a ses propres utilisateurs, dossiers, catalogue, macros et modèles : aucune ne voit
	les données d’une autre. Vous pouvez entrer dans une société pour l’assister.
</p>

{#if notice}<Alert variant="success">{notice}</Alert>{/if}

<Card>
	<table>
		<thead>
			<tr>
				<th>Société</th>
				<th class="num">Utilisateurs</th>
				<th class="num">Dossiers</th>
				<th>Créée le</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.organizations as o (o.id)}
				<tr class:current={o.id === data.user.organizationId}>
					<td class="strong"
						><Building2 size={14} />
						{o.name}
						{#if o.id === data.user.organizationId}<span class="badge">active</span>{/if}
						{#if o.id === data.user.homeOrganizationId}<span class="muted">
								(la vôtre)</span
							>{/if}</td
					>
					<td class="num">{o.users}</td>
					<td class="num">{o.projects}</td>
					<td>{dateFmt.format(new Date(o.createdAt))}</td>
					<td class="actions">
						<Button
							size="sm"
							variant="ghost"
							title="Renommer"
							onclick={() => ((target = o), (renameOpen = true), (notice = ''))}
							><Pencil size={14} /></Button
						>
						<Button
							size="sm"
							disabled={o.id === data.user.organizationId}
							onclick={() => enter(o.id)}><LogIn size={14} /> Entrer</Button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Card>

<Modal bind:open={createOpen} title="Nouvelle société">
	<form id="create-org" method="POST" action="?/create" use:enhance={submit}>
		<Field label="Nom de la société" name="organization" required />
		<p class="muted small">Son premier administrateur :</p>
		<div class="row">
			<Field label="Identifiant" name="login" autocomplete="off" required />
			<Field label="Nom affiché" name="name" required />
		</div>
		<Field
			label="Mot de passe"
			name="password"
			type="password"
			autocomplete="new-password"
			required
		/>
		{#if errorFor('create')}<Alert>{errorFor('create')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (createOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="create-org" disabled={pending}>Créer</Button>
	{/snippet}
</Modal>

<Modal bind:open={renameOpen} title="Renommer la société">
	<form id="rename-org" method="POST" action="?/rename" use:enhance={submit}>
		<input type="hidden" name="id" value={target?.id ?? ''} />
		<Field label="Nom" name="name" value={target?.name ?? ''} required />
		{#if errorFor('rename')}<Alert>{errorFor('rename')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (renameOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="rename-org" disabled={pending}>Enregistrer</Button
		>
	{/snippet}
</Modal>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
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
	}
	th {
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		font-weight: var(--fw-bold);
	}
	.strong {
		font-weight: var(--fw-bold);
	}
	tr.current {
		background: var(--c-primary-soft);
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.badge {
		margin-left: var(--sp-1);
		padding: 0 6px;
		border-radius: 999px;
		background: var(--c-primary);
		color: var(--c-on-primary);
		font-size: var(--fs-xs);
	}
	.actions {
		display: flex;
		gap: var(--sp-1);
		justify-content: flex-end;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.small {
		margin: 0;
		font-size: var(--fs-sm);
	}
</style>
