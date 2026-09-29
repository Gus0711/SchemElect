<script lang="ts">
	/** Fenêtre d'export du dossier : PDF (page de garde, borniers) et listes CSV. */
	import type { ProjectAnalysis } from '$lib/model/analysis';
	import type { Project } from '$lib/model/types';
	import { Button, Modal } from '$lib/ui';
	import { devicesCsv, downloadText, stripsCsv, wiresCsv } from './csv';
	import { safeFileName } from './dossier';

	let {
		open = $bindable(false),
		project,
		analysis
	}: { open?: boolean; project: Project; analysis: ProjectAnalysis } = $props();

	let cover = $state(true);
	let strips = $state(true);
	let busy = $state(false);
	let error = $state('');

	const base = $derived(
		safeFileName(`${project.meta.planNumber || 'schema'} ${project.meta.name}`) || 'schema'
	);

	async function exportPdf() {
		busy = true;
		error = '';
		try {
			// Chargé à la demande : jsPDF / svg2pdf ne pèsent pas sur l'éditeur.
			const { downloadProjectPdf } = await import('./pdf');
			await downloadProjectPdf(project, analysis, { cover, strips });
		} catch (e) {
			console.error(e);
			error = `Échec de la génération du PDF : ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			busy = false;
		}
	}

	function exportCsv(kind: 'strips' | 'devices' | 'wires') {
		const content =
			kind === 'strips'
				? stripsCsv(project, analysis)
				: kind === 'devices'
					? devicesCsv(project)
					: wiresCsv(project, analysis);
		const suffix = kind === 'strips' ? 'borniers' : kind === 'devices' ? 'nomenclature' : 'fils';
		downloadText(`${base} - ${suffix}.csv`, content);
	}
</script>

<Modal bind:open title="Exporter le dossier" width="440px">
	<section>
		<h3>Dossier PDF</h3>
		<label class="check"
			><input type="checkbox" bind:checked={cover} disabled={busy} /> Page de garde</label
		>
		<label class="check"
			><input type="checkbox" bind:checked={strips} disabled={busy} /> Borniers</label
		>
		<div class="row">
			<Button variant="primary" onclick={exportPdf} disabled={busy}>
				{busy ? 'Génération…' : 'Exporter le PDF'}
			</Button>
		</div>
		{#if error}<p class="error">{error}</p>{/if}
	</section>

	<section>
		<h3>Listes (CSV, Excel)</h3>
		<div class="row">
			<Button onclick={() => exportCsv('strips')}>Borniers</Button>
			<Button onclick={() => exportCsv('devices')}>Nomenclature des appareils</Button>
			<Button onclick={() => exportCsv('wires')}>Liste des fils</Button>
		</div>
	</section>

	{#snippet actions()}
		<Button variant="ghost" onclick={() => (open = false)}>Fermer</Button>
	{/snippet}
</Modal>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	h3 {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--c-text);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-md);
		color: var(--c-text);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	.error {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-danger);
	}
</style>
