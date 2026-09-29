<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { DatabaseBackup, Download } from '@lucide/svelte';
	import { Alert, Button, Card } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let pending = $state(false);

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const sizeFmt = (bytes: number) =>
		bytes < 1024 * 1024
			? `${Math.max(1, Math.round(bytes / 1024))} Ko`
			: `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	};
</script>

<svelte:head><title>Sauvegardes — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Sauvegardes de la base</h1>
	{#if data.config}
		<form method="POST" action="?/backup" use:enhance={submit}>
			<Button variant="primary" type="submit" disabled={pending}>
				<DatabaseBackup size={16} /> Sauvegarder maintenant
			</Button>
		</form>
	{/if}
</div>

{#if form && 'error' in form}<Alert>{form.error}</Alert>{/if}
{#if form && 'name' in form}<Alert variant="success">Sauvegarde {form.name} créée.</Alert>{/if}

{#if !data.config}
	<Alert>La base n'est pas un fichier local : la sauvegarde automatique ne s'applique pas.</Alert>
{:else}
	<p class="muted">
		{#if data.config.intervalHours > 0}
			Sauvegarde automatique toutes les {data.config.intervalHours} h,
		{:else}
			Sauvegarde automatique désactivée (<code>BACKUP_INTERVAL_HOURS=0</code>),
		{/if}
		{data.config.keep} dernières conservées dans <code>{data.config.dir}</code>. Pensez à copier ce
		dossier hors du serveur (disque réseau, autre machine).
	</p>

	<Card>
		{#if data.backups.length === 0}
			<p class="muted">Aucune sauvegarde pour l'instant.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Fichier</th>
						<th>Taille</th>
						<th class="actions-col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.backups as b (b.name)}
						<tr>
							<td class="strong">{dateFmt.format(new Date(b.date))}</td>
							<td class="muted">{b.name}</td>
							<td>{sizeFmt(b.size)}</td>
							<td class="actions-col">
								<a class="download" href="/admin/sauvegardes/{b.name}" download title="Télécharger"
									><Download size={15} /></a
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Card>

	<p class="muted small">
		Restauration : arrêter le serveur, remplacer le fichier de base par la sauvegarde choisie
		(renommée), puis redémarrer.
	</p>
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}
	.toolbar form {
		margin: 0;
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
	.small {
		font-size: var(--fs-sm);
	}
	.actions-col {
		width: 1%;
		text-align: right;
	}
	.download {
		display: inline-flex;
		padding: var(--sp-1);
		color: var(--c-text-muted);
		border-radius: var(--radius-sm);
	}
	.download:hover {
		color: var(--c-primary);
		background: var(--c-surface-2);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
