<script lang="ts">
	/**
	 * Création guidée d'un schéma : 1. l'affaire (existante, nouvelle — avec au besoin un
	 * nouveau client — ou « non classé ») ; 2. le schéma (nom, n° de plan, modèle). Envoie
	 * l'action `create` de la page Projets, utilisable depuis n'importe quelle page.
	 */
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { affaireTitle, type Affaire } from '$lib/model/affaires';
	import { Alert, Button, Field, Modal } from '$lib/ui';

	let {
		open = $bindable(false),
		affaires,
		clients,
		templates,
		affaireId = ''
	}: {
		open?: boolean;
		affaires: (Affaire & { clientName: string })[];
		clients: { id: string; name: string }[];
		templates: { id: string; name: string }[];
		/** Affaire proposée (fiche affaire, bouton « + » d'une affaire). */
		affaireId?: string;
	} = $props();

	const NEW = '__new';

	let affaire = $state('');
	let clientId = $state('');
	let error = $state('');
	let pending = $state(false);

	// À chaque ouverture : affaire proposée, premier client.
	$effect(() => {
		if (!open) return;
		affaire = affaireId;
		clientId = clients[0]?.id ?? NEW;
		error = '';
	});

	const choices = $derived(
		affaires
			.filter((a) => a.status !== 'archivee' || a.id === affaireId)
			.sort(
				(a, b) =>
					a.clientName.localeCompare(b.clientName, 'fr') ||
					b.year - a.year ||
					a.whysoft.localeCompare(b.whysoft)
			)
	);
	const chosen = $derived(affaires.find((a) => a.id === affaire) ?? null);

	const submit: SubmitFunction = () => {
		pending = true;
		error = '';
		return async ({ result }) => {
			pending = false;
			if (result.type === 'redirect') {
				open = false;
				await goto(result.location);
			} else if (result.type === 'failure')
				error = String(result.data?.error ?? 'Création impossible');
			else if (result.type === 'error') error = result.error?.message ?? 'Création impossible';
		};
	};
</script>

<Modal bind:open title="Nouveau projet" width="560px">
	<form id="new-project-form" method="POST" action="/?/create" use:enhance={submit}>
		<h4>1. Affaire</h4>
		<Field
			label="Affaire"
			hint={affaire === NEW
				? 'L’affaire est créée avec le schéma.'
				: affaire
					? 'Le client et le n° WhySoft du cartouche viennent de l’affaire.'
					: 'Le schéma reste non classé : client et n° d’affaire saisis à la main.'}
		>
			<select name="affaire" bind:value={affaire}>
				<option value="">Non classé (saisie libre)</option>
				<option value={NEW}>+ Nouvelle affaire…</option>
				{#each choices as a (a.id)}
					<option value={a.id}>{a.clientName} — {affaireTitle(a)} ({a.year})</option>
				{/each}
			</select>
		</Field>
		{#if affaire === NEW}
			<div class="new">
				<Field label="Client de l’affaire">
					<select name="clientId" bind:value={clientId}>
						{#each clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
						<option value={NEW}>+ Nouveau client…</option>
					</select>
				</Field>
				{#if clientId === NEW}
					<Field label="Nom du nouveau client" name="clientName" required />
				{/if}
				<div class="row">
					<Field label="N° WhySoft" name="whysoft" />
					<Field
						label="Année"
						name="year"
						type="number"
						min="1990"
						max="2200"
						value={String(new Date().getFullYear())}
					/>
				</div>
				<Field
					label="Désignation de l’affaire"
					name="affaireLabel"
					placeholder="Chaufferie collège Jean Moulin"
				/>
			</div>
		{:else if chosen}
			<p class="muted small">
				{chosen.clientName} · {affaireTitle(chosen)} · {chosen.year}
			</p>
		{/if}

		<h4>2. Schéma</h4>
		<Field label="Nom du projet" name="name" required placeholder="Armoire chaufferie" />
		<div class="row">
			{#if !affaire}<Field label="N° d'affaire" name="affaireNumber" />{/if}
			<Field label="N° de plan" name="planNumber" />
		</div>
		{#if !affaire}<Field label="Client" name="client" />{/if}
		<Field label="Modèle de cartouche et de page de garde">
			<select name="template">
				<option value="">Standard</option>
				{#each templates as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
			</select>
		</Field>
		{#if error}<Alert>{error}</Alert>{/if}
	</form>
	{#snippet actions()}
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" type="submit" form="new-project-form" disabled={pending}
			>{pending ? 'Création…' : 'Créer et ouvrir'}</Button
		>
	{/snippet}
</Modal>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: 0;
	}
	h4 {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.new {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-3);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface-2);
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	.small {
		margin: 0;
		font-size: var(--fs-sm);
	}
</style>
