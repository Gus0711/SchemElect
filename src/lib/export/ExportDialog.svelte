<script lang="ts">
	/** Fenêtre d'export du dossier : PDF (page de garde, borniers) et listes CSV. */
	import type { ProjectAnalysis } from '$lib/model/analysis';
	import type { Project } from '$lib/model/types';
	import type { PrintGrid } from '$lib/render/pageNumbering';
	import { Button, Modal } from '$lib/ui';
	import { computeNomenclature } from '$lib/model/nomenclature';
	import { cablesCsv, devicesCsv, downloadText, nomenclatureCsv, stripsCsv, wiresCsv } from './csv';
	import { safeFileName } from './dossier';

	let {
		open = $bindable(false),
		project,
		analysis,
		grid = null,
		printGrid = $bindable(false)
	}: {
		open?: boolean;
		project: Project;
		analysis: ProjectAnalysis;
		/** Grille réglée dans l'éditeur (imprimable sur demande). */
		grid?: PrintGrid | null;
		printGrid?: boolean;
	} = $props();

	const GRID_LABEL = { points: 'points', quadrillage: 'quadrillage', cases: 'cases A–Q' };

	let cover = $state(true);
	let strips = $state(true);
	let nomenclature = $state(false);
	// À chaque ouverture : tableaux de borniers en fin de dossier seulement si le dossier n'a
	// pas de folio borniers (dessin) ; nomenclature dès qu'un appareil a une référence.
	$effect(() => {
		if (!open) return;
		strips = !project.folios.some((f) => f.strips);
		nomenclature = computeNomenclature(project).some((l) => l.referenced);
	});
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
			await downloadProjectPdf(project, analysis, {
				cover,
				strips,
				nomenclature,
				grid: printGrid ? grid : null
			});
		} catch (e) {
			console.error(e);
			error = `Échec de la génération du PDF : ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			busy = false;
		}
	}

	const CSV = {
		strips: { suffix: 'borniers', make: () => stripsCsv(project, analysis) },
		devices: { suffix: 'appareils', make: () => devicesCsv(project) },
		bom: { suffix: 'nomenclature', make: () => nomenclatureCsv(project) },
		wires: { suffix: 'fils', make: () => wiresCsv(project, analysis) },
		cables: { suffix: 'câbles', make: () => cablesCsv(project, analysis) }
	};

	function exportCsv(kind: keyof typeof CSV) {
		downloadText(`${base} - ${CSV[kind].suffix}.csv`, CSV[kind].make());
	}
</script>

<Modal bind:open title="Exporter le dossier" width="440px">
	<section>
		<h3>Dossier PDF</h3>
		<label class="check"
			><input type="checkbox" bind:checked={cover} disabled={busy} /> Page de garde</label
		>
		<label class="check"
			><input type="checkbox" bind:checked={strips} disabled={busy} /> Tableaux des borniers (fin de dossier)</label
		>
		<label class="check"
			><input type="checkbox" bind:checked={nomenclature} disabled={busy} /> Nomenclature par référence
			(fin de dossier)</label
		>
		{#if grid}
			<label class="check"
				><input type="checkbox" bind:checked={printGrid} disabled={busy} /> Grille sur les folios
				<span class="muted"
					>({GRID_LABEL[grid.kind]}{grid.kind === 'cases'
						? ''
						: ` ${String(grid.step).replace('.', ',')} mm`}, {Math.round(grid.opacity * 100)} %)</span
				></label
			>
		{/if}
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
			<Button onclick={() => exportCsv('bom')}>Nomenclature par référence</Button>
			<Button onclick={() => exportCsv('devices')}>Liste des appareils</Button>
			<Button onclick={() => exportCsv('wires')}>Liste des fils</Button>
			<Button onclick={() => exportCsv('cables')}>Carnet de câbles</Button>
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
