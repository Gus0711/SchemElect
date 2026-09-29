<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { KeyRound, ShieldCheck, Trash2, UserPlus } from '@lucide/svelte';
	import { Alert, Button, Card, Field, Modal } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type UserRow = (typeof data.users)[number];

	let createOpen = $state(false);
	let resetOpen = $state(false);
	let deleteOpen = $state(false);
	let target = $state<UserRow | null>(null);
	let pending = $state(false);
	let notice = $state('');

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	function open(kind: 'reset' | 'delete', u: UserRow) {
		target = u;
		notice = '';
		if (kind === 'reset') resetOpen = true;
		else deleteOpen = true;
	}

	const submit: SubmitFunction = ({ action }) => {
		pending = true;
		return async ({ result, update }) => {
			await update();
			pending = false;
			if (result.type === 'success') {
				const kind = action.search.replace('?/', '');
				notice =
					kind === 'create'
						? 'Utilisateur créé.'
						: kind === 'reset'
							? `Mot de passe de ${target?.name} réinitialisé (ses sessions ont été fermées).`
							: `Utilisateur ${target?.name} supprimé.`;
				createOpen = resetOpen = deleteOpen = false;
			}
		};
	};

	const errorFor = (action: string) =>
		form && 'error' in form && form.action === action ? form.error : null;
</script>

<svelte:head><title>Utilisateurs — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Utilisateurs</h1>
	<Button variant="primary" onclick={() => ((createOpen = true), (notice = ''))}>
		<UserPlus size={16} /> Nouvel utilisateur
	</Button>
</div>

{#if notice}<Alert variant="success">{notice}</Alert>{/if}

<Card>
	<table>
		<thead>
			<tr>
				<th>Nom</th>
				<th>Identifiant</th>
				<th>Rôle</th>
				<th>Créé le</th>
				<th class="actions-col"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td class="strong"
						>{u.name}{#if u.id === data.user.id}<span class="muted"> (vous)</span>{/if}</td
					>
					<td>{u.login}</td>
					<td>
						{#if u.role === 'admin'}
							<span class="role admin"><ShieldCheck size={14} /> Administrateur</span>
						{:else}
							<span class="role">Utilisateur</span>
						{/if}
					</td>
					<td>{dateFmt.format(new Date(u.createdAt))}</td>
					<td class="actions-col">
						<div class="row-actions">
							<Button
								variant="ghost"
								size="sm"
								title="Réinitialiser le mot de passe"
								onclick={() => open('reset', u)}
							>
								<KeyRound size={15} />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								title="Supprimer"
								disabled={u.id === data.user.id}
								onclick={() => open('delete', u)}
							>
								<Trash2 size={15} />
							</Button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Card>

<Modal bind:open={createOpen} title="Nouvel utilisateur">
	<form id="create-user" method="POST" action="?/create" use:enhance={submit}>
		<div class="row">
			<Field label="Identifiant" name="login" autocomplete="off" required />
			<Field label="Nom affiché" name="name" required />
		</div>
		<div class="row">
			<Field
				label="Mot de passe"
				name="password"
				type="password"
				autocomplete="new-password"
				required
			/>
			<Field label="Rôle">
				<select name="role">
					<option value="user">Utilisateur</option>
					<option value="admin">Administrateur</option>
				</select>
			</Field>
		</div>
		{#if errorFor('create')}<Alert>{errorFor('create')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (createOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="create-user" disabled={pending}>Créer</Button>
	{/snippet}
</Modal>

<Modal bind:open={resetOpen} title="Réinitialiser le mot de passe">
	<form id="reset-user" method="POST" action="?/reset" use:enhance={submit}>
		<input type="hidden" name="id" value={target?.id ?? ''} />
		<p class="muted">
			Nouveau mot de passe pour <strong>{target?.name}</strong> ({target?.login}).
		</p>
		<Field
			label="Nouveau mot de passe"
			name="password"
			type="password"
			autocomplete="new-password"
			required
		/>
		{#if errorFor('reset')}<Alert>{errorFor('reset')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (resetOpen = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="reset-user" disabled={pending}
			>Réinitialiser</Button
		>
	{/snippet}
</Modal>

<Modal bind:open={deleteOpen} title="Supprimer l'utilisateur">
	<form id="delete-user" method="POST" action="?/delete" use:enhance={submit}>
		<input type="hidden" name="id" value={target?.id ?? ''} />
		<p>
			Supprimer le compte <strong>{target?.name}</strong> ({target?.login}) ? Ses projets sont
			conservés.
		</p>
		{#if errorFor('delete')}<Alert>{errorFor('delete')}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (deleteOpen = false)}>Annuler</Button>
		<Button variant="danger" type="submit" form="delete-user" disabled={pending}
			><Trash2 size={16} /> Supprimer</Button
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
	.strong {
		font-weight: var(--fw-medium);
	}
	.role {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.role.admin {
		color: var(--c-primary);
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
	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: 0;
	}
	form p {
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
