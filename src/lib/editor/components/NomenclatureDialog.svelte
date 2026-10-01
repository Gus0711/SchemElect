<script lang="ts">
	/** Aperçu de la nomenclature par référence du dossier, avec export CSV. */
	import { downloadText, nomenclatureCsv } from '$lib/export/csv';
	import { safeFileName } from '$lib/export/dossier';
	import { bomTagsText, computeNomenclature } from '$lib/model/nomenclature';
	import type { Project } from '$lib/model/types';
	import { Button, Modal } from '$lib/ui';
	import { Download } from '@lucide/svelte';

	let { open = $bindable(false), project }: { open?: boolean; project: Project } = $props();

	const lines = $derived(open ? computeNomenclature(project) : []);
	const missing = $derived(lines.filter((l) => !l.referenced));
	const total = $derived(lines.reduce((n, l) => n + l.quantity, 0));

	function exportCsv() {
		const base =
			safeFileName(`${project.meta.planNumber || 'schema'} ${project.meta.name}`) || 'schema';
		downloadText(`${base} - nomenclature.csv`, nomenclatureCsv(project));
	}
</script>

<Modal bind:open title="Nomenclature par référence" width="920px">
	<p class="muted small">
		{lines.length - missing.length} référence(s), {total} article(s).
		{#if missing.length}
			<span class="warn"
				>{missing.reduce((n, l) => n + l.quantity, 0)} appareil(s) sans référence (en fin de liste).</span
			>
		{/if}
		Le PDF du dossier peut inclure cette nomenclature (fenêtre Exporter).
	</p>
	<div class="wrap">
		<table>
			<thead>
				<tr>
					<th class="num">Qté</th>
					<th>Référence</th>
					<th>Fabricant</th>
					<th>Désignation</th>
					<th>Repères</th>
				</tr>
			</thead>
			<tbody>
				{#each lines as l (l.key)}
					<tr class:missing={!l.referenced}>
						<td class="num">{l.quantity}</td>
						<td class="ref">{l.reference || 'À compléter'}</td>
						<td>{l.manufacturer}</td>
						<td>{l.designation}</td>
						<td>{bomTagsText(l)}</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="muted">Aucun appareil dans le dossier.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#snippet actions()}
		<Button onclick={exportCsv} disabled={!lines.length}><Download size={14} /> Exporter CSV</Button
		>
		<Button variant="ghost" onclick={() => (open = false)}>Fermer</Button>
	{/snippet}
</Modal>

<style>
	.small {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.warn {
		color: var(--c-warning);
	}
	.wrap {
		max-height: 60vh;
		overflow: auto;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th {
		position: sticky;
		top: 0;
		padding: var(--sp-1) var(--sp-2);
		text-align: left;
		background: var(--c-surface-2);
		color: var(--c-text-muted);
		border-bottom: 1px solid var(--c-border);
	}
	td {
		padding: 3px var(--sp-2);
		border-bottom: 1px solid var(--c-border);
	}
	.num {
		text-align: right;
		width: 40px;
		font-variant-numeric: tabular-nums;
	}
	.ref {
		font-weight: var(--fw-bold);
		white-space: nowrap;
	}
	tr.missing .ref {
		color: var(--c-warning);
		font-weight: var(--fw-medium);
	}
</style>
