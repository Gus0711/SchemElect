<script lang="ts">
	/** Consultation des borniers générés (lecture seule, mis à jour en continu). */
	import { projectStrips } from '$lib/model/analysis';
	import { Modal } from '$lib/ui';
	import type { Editor } from '../editor.svelte';

	let { editor, open = $bindable(false) }: { editor: Editor; open?: boolean } = $props();

	const strips = $derived(open ? projectStrips(editor.project, editor.analysis) : []);

	function locate(symbolId: string) {
		const f = editor.project.folios.find((x) => x.symbols.some((s) => s.id === symbolId));
		if (!f) return;
		editor.setFolio(f.id);
		editor.select([{ kind: 'symbol', id: symbolId }]);
		open = false;
	}
</script>

<Modal bind:open title="Borniers" width="820px">
	{#each strips as strip (strip.prefix)}
		<h3>Bornier {strip.prefix} <span class="muted">({strip.rows.length} bornes)</span></h3>
		<table>
			<thead>
				<tr
					><th>Borne</th><th>Fil</th><th>Intérieur</th><th>Extérieur</th><th>Position</th><th
						>Désignation</th
					></tr
				>
			</thead>
			<tbody>
				{#each strip.rows as r (r.symbolId)}
					<tr onclick={() => locate(r.symbolId)}>
						<td><strong>{r.tag}</strong></td>
						<td>{r.wire}</td>
						<td>{r.inside.join(', ')}</td>
						<td>{r.outside.join(', ')}</td>
						<td>{r.position}</td>
						<td>{r.designation}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="muted">
			Aucune borne de bornier dans le dossier. Posez des symboles « Borne » (P, C, X…) depuis la
			palette.
		</p>
	{/each}
</Modal>

<style>
	h3 {
		margin-top: var(--sp-2);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th,
	td {
		padding: 4px var(--sp-2);
		border-bottom: 1px solid var(--c-border);
		text-align: left;
	}
	th {
		color: var(--c-text-muted);
		font-weight: var(--fw-medium);
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover {
		background: var(--c-surface-2);
	}
</style>
