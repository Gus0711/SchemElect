<script lang="ts">
	/** Bibliothèque partagée des modèles de cartouche et de page de garde. */
	import { invalidateAll } from '$app/navigation';
	import { deleteTemplate, saveTemplate } from '$lib/api/client';
	import TemplateEditor from '$lib/editor/components/TemplateEditor.svelte';
	import { buildSampleArmoire } from '$lib/export/sampleArmoire';
	import { deepClone, newId } from '$lib/model/ids';
	import { newTemplate, type DocTemplate } from '$lib/model/template';
	import type { Project } from '$lib/model/types';
	import CoverPage from '$lib/render/CoverPage.svelte';
	import FolioFrame from '$lib/render/FolioFrame.svelte';
	import { FRAME, TITLEBLOCK } from '$lib/model/layout';
	import { Alert, Button, Card, Modal } from '$lib/ui';
	import { Copy, FilePlus2, Pencil, Trash } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Dossier d'exemple servant à l'aperçu des modèles. */
	const sample = buildSampleArmoire();
	const withTemplate = (t: DocTemplate): Project => ({ ...sample, template: t });

	let editing: DocTemplate | null = $state(null);
	let editorOpen = $state(false);
	let error = $state('');
	let pending = $state(false);

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

	function edit(t: DocTemplate) {
		editing = deepClone(t);
		editorOpen = true;
	}

	function create() {
		edit(newTemplate('Nouveau modèle'));
	}

	async function duplicate(t: DocTemplate) {
		await run(() => saveTemplate({ ...deepClone(t), id: newId('tpl'), name: `${t.name} (copie)` }));
	}

	async function remove(t: DocTemplate) {
		if (
			!confirm(
				`Supprimer le modèle « ${t.name} » ? Les dossiers qui l’utilisent gardent leur copie.`
			)
		)
			return;
		await run(() => deleteTemplate(t.id));
	}

	async function save() {
		if (!editing) return;
		const t = $state.snapshot(editing) as DocTemplate;
		if (!t.name.trim()) {
			error = 'Le modèle doit avoir un nom.';
			return;
		}
		if (await run(() => saveTemplate(t))) editorOpen = false;
	}

	async function run(fn: () => Promise<unknown>): Promise<boolean> {
		pending = true;
		error = '';
		try {
			await fn();
			await invalidateAll();
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Opération impossible';
			return false;
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head><title>Modèles — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Modèles de cartouche et de page de garde</h1>
	<Button variant="primary" onclick={create}><FilePlus2 size={16} /> Nouveau modèle</Button>
</div>

<p class="muted">
	Logo, société, champs libres (« Lot », « Maître d’ouvrage »…), composition du cartouche et de la
	page de garde. Un modèle se choisit à la création d’un projet ou dans Propriétés du dossier ›
	Modèle ; chaque dossier en garde sa propre copie.
</p>

{#if error && !editorOpen}<Alert>{error}</Alert>{/if}

{#if data.templates.length === 0}
	<Card
		><p class="muted">
			Aucun modèle pour l’instant : les dossiers utilisent le modèle standard.
		</p></Card
	>
{:else}
	<div class="grid">
		{#each data.templates as t (t.id)}
			<Card>
				<button class="thumb" title="Modifier" onclick={() => edit(t)}>
					<CoverPage project={withTemplate(t)} width="100%" height="auto" />
				</button>
				<svg
					class="titleblock"
					viewBox="{FRAME.x - 1} {TITLEBLOCK.y - 1} {FRAME.w + 2} {TITLEBLOCK.h + 2}"
					role="img"
					aria-label="Cartouche du modèle {t.name}"
				>
					<FolioFrame project={withTemplate(t)} title="DISTRIBUTION" index={0} total={7} />
				</svg>
				<div class="info">
					<div>
						<strong>{t.name}</strong>
						{#if t.updatedAt}<span class="muted small">
								· modifié le {dateFmt.format(new Date(t.updatedAt))}</span
							>{/if}
						{#if t.fields.length}
							<div class="muted small">Champs : {t.fields.map((f) => f.label).join(', ')}</div>
						{/if}
					</div>
					<div class="actions">
						<Button size="sm" variant="ghost" title="Modifier" onclick={() => edit(t)}
							><Pencil size={14} /></Button
						>
						<Button
							size="sm"
							variant="ghost"
							title="Dupliquer"
							disabled={pending}
							onclick={() => duplicate(t)}><Copy size={14} /></Button
						>
						<Button
							size="sm"
							variant="ghost"
							title="Supprimer"
							disabled={pending}
							onclick={() => remove(t)}><Trash size={14} /></Button
						>
					</div>
				</div>
			</Card>
		{/each}
	</div>
{/if}

<Modal bind:open={editorOpen} title="Modèle — {editing?.name ?? ''}" width="1180px">
	{#if editing}
		<TemplateEditor bind:template={editing} project={sample} />
		{#if error}<Alert>{error}</Alert>{/if}
	{/if}
	{#snippet actions()}
		<Button onclick={() => (editorOpen = false)}>Annuler</Button>
		<Button variant="primary" disabled={pending} onclick={save}>Enregistrer</Button>
	{/snippet}
</Modal>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: var(--sp-4);
	}
	.thumb {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: #fff;
		cursor: pointer;
		overflow: hidden;
	}
	.thumb :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.titleblock {
		display: block;
		width: 100%;
		margin-top: var(--sp-2);
		background: #fff;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	.info {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-2);
		margin-top: var(--sp-2);
	}
	.small {
		font-size: var(--fs-sm);
	}
	.actions {
		display: flex;
		gap: 2px;
	}
</style>
