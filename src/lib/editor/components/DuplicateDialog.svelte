<script lang="ts">
	/**
	 * Dupliquer un dossier (état actuel ou version de l'historique) pour une nouvelle
	 * affaire : nom, n° d'affaire, n° de plan, client, indices de révision remis à zéro.
	 * La copie s'ouvre ensuite dans l'éditeur ; son historique repart de zéro.
	 */
	import { goto } from '$app/navigation';
	import { duplicateProject } from '$lib/api/client';
	import type { ProjectMeta } from '$lib/model/types';
	import { Alert, Button, Field, Modal } from '$lib/ui';

	let {
		open = $bindable(false),
		projectId,
		meta,
		versionId,
		versionLabel
	}: {
		open?: boolean;
		projectId: string;
		/** Cartouche du dossier source (valeurs proposées). */
		meta: Pick<ProjectMeta, 'name' | 'affaireNumber' | 'planNumber' | 'client'>;
		/** Version de l'historique à dupliquer (absente : état actuel). */
		versionId?: string;
		versionLabel?: string;
	} = $props();

	let name = $state('');
	let affaireNumber = $state('');
	let planNumber = $state('');
	let client = $state('');
	let resetRevisions = $state(true);
	let pending = $state(false);
	let error = $state('');

	$effect(() => {
		if (!open) return;
		name = `${meta.name} (copie)`;
		affaireNumber = meta.affaireNumber;
		planNumber = meta.planNumber;
		client = meta.client;
		resetRevisions = true;
		error = '';
	});

	async function submit() {
		if (!name.trim()) {
			error = 'Le nom est requis.';
			return;
		}
		pending = true;
		error = '';
		try {
			const { id } = await duplicateProject(projectId, {
				name,
				affaireNumber,
				planNumber,
				client,
				resetRevisions,
				versionId
			});
			open = false;
			await goto(`/projets/${id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Duplication impossible';
		} finally {
			pending = false;
		}
	}
</script>

<Modal bind:open title="Dupliquer le dossier" width="480px">
	<form
		class="form"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<p class="muted small">
			Copie de « {meta.name} »{versionLabel ? ` — ${versionLabel}` : ' (état actuel)'}. Folios,
			appareils, borniers, cartouche et fiches catalogue sont repris ; l’historique de la copie
			repart de zéro.
		</p>
		<Field label="Nom du nouveau dossier" bind:value={name} required />
		<div class="row">
			<Field label="N° d'affaire" bind:value={affaireNumber} />
			<Field label="N° de plan" bind:value={planNumber} />
		</div>
		<Field label="Client" bind:value={client} />
		<label class="check"
			><input type="checkbox" bind:checked={resetRevisions} /> Repartir sans indice de révision</label
		>
		{#if error}<Alert>{error}</Alert>{/if}
		<button type="submit" hidden aria-hidden="true"></button>
	</form>
	{#snippet actions()}
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" disabled={pending} onclick={submit}
			>{pending ? 'Duplication…' : 'Dupliquer et ouvrir'}</Button
		>
	{/snippet}
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
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
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-md);
	}
</style>
