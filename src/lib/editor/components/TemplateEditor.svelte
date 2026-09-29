<script lang="ts">
	/**
	 * Édition d'un modèle de cartouche et de page de garde, avec aperçu en direct
	 * (mêmes composants de rendu que les folios et le PDF).
	 */
	import { imageFromClipboard, prepareImage } from '$lib/editor/image';
	import { FRAME, TITLEBLOCK } from '$lib/model/layout';
	import {
		BUILTIN_FIELDS,
		cellWidths,
		fieldKey,
		type DocTemplate,
		type TitleCell
	} from '$lib/model/template';
	import { newId } from '$lib/model/ids';
	import type { Project } from '$lib/model/types';
	import CoverPage from '$lib/render/CoverPage.svelte';
	import FolioFrame from '$lib/render/FolioFrame.svelte';
	import { Button, Field } from '$lib/ui';
	import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash } from '@lucide/svelte';
	import TemplateLinesEditor from './TemplateLinesEditor.svelte';

	let {
		template = $bindable(),
		project
	}: {
		template: DocTemplate;
		/** Projet servant à l'aperçu (valeurs des champs). */
		project: Project;
	} = $props();

	let tab: 'identity' | 'fields' | 'titleblock' | 'cover' = $state('identity');
	let logoError = $state('');

	const fields = $derived([
		...BUILTIN_FIELDS,
		...template.fields.map((f) => ({ key: f.key, label: `${f.label} (champ libre)` }))
	]);
	const preview = $derived({ ...project, template } as Project);
	const widths = $derived(cellWidths(template.titleblock.cells));
	const used = $derived(widths.reduce((a, b) => a + b, 0));

	async function setLogo(file: Blob | null) {
		if (!file) return;
		logoError = '';
		try {
			const img = await prepareImage(file, 800);
			template.logo = img.href;
			template.logoRatio = img.ratio;
		} catch (e) {
			logoError = e instanceof Error ? e.message : 'Image illisible';
		}
	}

	function addField() {
		const label = 'Nouveau champ';
		template.fields.push({
			key: fieldKey(
				label,
				template.fields.map((f) => f.key)
			),
			label
		});
	}

	/** Renomme un champ libre : sa clé suit le libellé, les textes qui l'utilisent aussi. */
	function renameField(i: number, label: string) {
		const f = template.fields[i];
		const old = f.key;
		const key = fieldKey(
			label,
			template.fields.filter((_, j) => j !== i).map((x) => x.key)
		);
		f.label = label;
		if (key === old) return;
		f.key = key;
		const lines = [
			...template.titleblock.cells.flatMap((c) => c.lines),
			...Object.values(template.cover).flat()
		];
		for (const l of lines) l.value = l.value.replaceAll(`{${old}}`, `{${key}}`);
	}

	function addCell(kind: TitleCell['kind']) {
		template.titleblock.cells.push({
			id: newId('c'),
			kind,
			width: kind === 'folio' ? 18 : kind === 'logo' ? 30 : 40,
			lines: kind === 'text' ? [{ value: '' }] : []
		});
	}

	function moveCell(i: number, d: number) {
		const cells = template.titleblock.cells;
		const j = i + d;
		if (j < 0 || j >= cells.length) return;
		[cells[i], cells[j]] = [cells[j], cells[i]];
	}

	const KIND: Record<TitleCell['kind'], string> = {
		text: 'Texte',
		logo: 'Logo',
		folio: 'N° de folio'
	};
</script>

<svelte:window
	onpaste={(e) => {
		if (tab !== 'identity') return;
		const f = imageFromClipboard(e);
		if (f) setLogo(f);
	}}
/>

<div class="editor">
	<div class="tb-preview">
		<h4>Cartouche</h4>
		<svg
			class="sheet"
			viewBox="{FRAME.x - 1} {TITLEBLOCK.y - 1} {FRAME.w + 2} {TITLEBLOCK.h + 2}"
			role="img"
			aria-label="Aperçu du cartouche"
		>
			<FolioFrame project={preview} title="DISTRIBUTION" index={0} total={12} />
		</svg>
	</div>
	<div class="form">
		<nav class="tabs">
			<button class:active={tab === 'identity'} onclick={() => (tab = 'identity')}>Identité</button>
			<button class:active={tab === 'fields'} onclick={() => (tab = 'fields')}>Champs libres</button
			>
			<button class:active={tab === 'titleblock'} onclick={() => (tab = 'titleblock')}
				>Cartouche</button
			>
			<button class:active={tab === 'cover'} onclick={() => (tab = 'cover')}>Page de garde</button>
		</nav>

		{#if tab === 'identity'}
			<Field label="Nom du modèle" bind:value={template.name} />
			<div class="logo">
				<div class="logo-preview">
					{#if template.logo}<img src={template.logo} alt="Logo" />{:else}<span class="muted"
							>Aucun logo</span
						>{/if}
				</div>
				<div class="logo-actions">
					<label class="file">
						<ImagePlus size={14} /> Choisir une image…
						<input
							type="file"
							accept="image/*"
							onchange={(e) => setLogo((e.currentTarget as HTMLInputElement).files?.[0] ?? null)}
						/>
					</label>
					<span class="muted small">ou Ctrl+V d’une capture</span>
					{#if template.logo}
						<Button
							size="sm"
							variant="ghost"
							onclick={() => {
								template.logo = undefined;
								template.logoRatio = undefined;
							}}><Trash size={14} /> Retirer</Button
						>
					{/if}
					{#if logoError}<span class="error small">{logoError}</span>{/if}
				</div>
			</div>
			<p class="muted small">
				Le logo s’affiche dans les cases « Logo » du cartouche et à gauche du bloc société de la
				page de garde. Les textes acceptent des champs entre accolades : <code>{'{affaire}'}</code>,
				<code>{'{plan}'}</code>, <code>{'{client}'}</code>… (menu « + champ »).
			</p>
		{:else if tab === 'fields'}
			<p class="muted small">
				Champs propres à ce modèle (« Lot », « Maître d’ouvrage », « Vérifié par »…). Leur valeur se
				saisit dans chaque projet (Propriétés du dossier › Cartouche) ; on les place dans le
				cartouche ou la page de garde avec le menu « + champ ».
			</p>
			{#each template.fields as f, i (i)}
				<div class="row">
					<input
						class="cell"
						value={f.label}
						oninput={(e) => renameField(i, (e.currentTarget as HTMLInputElement).value)}
					/>
					<code class="key">{`{${f.key}}`}</code>
					<button class="icon" title="Supprimer" onclick={() => template.fields.splice(i, 1)}
						><Trash size={14} /></button
					>
				</div>
			{/each}
			<div><Button size="sm" onclick={addField}><Plus size={14} /> Ajouter un champ</Button></div>
		{:else if tab === 'titleblock'}
			<p class="small" class:error={Math.abs(used - TITLEBLOCK.w) > 0.5}>
				Largeur utilisée : {Math.round(used)} / {Math.round(TITLEBLOCK.w)} mm — une case de largeur 0
				prend la place restante.
			</p>
			{#each template.titleblock.cells as cell, i (cell.id)}
				<div class="cellbox">
					<div class="cellhead">
						<select class="cell" bind:value={cell.kind}>
							{#each Object.entries(KIND) as [k, label] (k)}<option value={k}>{label}</option
								>{/each}
						</select>
						<label class="inline"
							>Largeur <input
								class="cell num"
								type="number"
								min="0"
								step="1"
								bind:value={cell.width}
							/> mm</label
						>
						{#if cell.kind === 'text'}
							<select class="cell" bind:value={cell.align}>
								<option value={undefined}>À gauche</option>
								<option value="center">Centré</option>
							</select>
							<label class="inline"
								><input type="checkbox" bind:checked={cell.rules} /> Traits</label
							>
						{/if}
						<span class="spacer"></span>
						<button class="icon" title="Vers la gauche" onclick={() => moveCell(i, -1)}
							><ChevronUp size={14} /></button
						>
						<button class="icon" title="Vers la droite" onclick={() => moveCell(i, 1)}
							><ChevronDown size={14} /></button
						>
						<button
							class="icon"
							title="Supprimer la case"
							onclick={() => template.titleblock.cells.splice(i, 1)}><Trash size={14} /></button
						>
					</div>
					{#if cell.kind === 'text'}
						<TemplateLinesEditor bind:lines={cell.lines} {fields} max={3} withLabel />
					{:else if cell.kind === 'logo' && !template.logo}
						<p class="muted small">Ajouter un logo dans l’onglet Identité.</p>
					{/if}
				</div>
			{/each}
			<div class="row">
				<Button size="sm" onclick={() => addCell('text')}><Plus size={14} /> Case texte</Button>
				<Button size="sm" onclick={() => addCell('logo')}><Plus size={14} /> Case logo</Button>
				<Button size="sm" onclick={() => addCell('folio')}><Plus size={14} /> N° de folio</Button>
			</div>
		{:else}
			<h4>Bloc société (à droite du logo)</h4>
			<TemplateLinesEditor bind:lines={template.cover.company} {fields} max={5} />
			<h4>Présentation (facultatif)</h4>
			<TemplateLinesEditor bind:lines={template.cover.about} {fields} max={8} />
			<h4>Titre du dossier</h4>
			<TemplateLinesEditor bind:lines={template.cover.title} {fields} max={5} />
			<h4>Pied de page (3 cases : libellé au-dessus, valeur dessous)</h4>
			<TemplateLinesEditor bind:lines={template.cover.footer} {fields} withLabel fixed />
		{/if}
	</div>

	<div class="preview">
		<h4>Page de garde</h4>
		<div class="sheet cover">
			<CoverPage project={preview} width="100%" height="auto" />
		</div>
	</div>
</div>

<style>
	.tb-preview {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.editor {
		display: grid;
		grid-template-columns: minmax(460px, 1fr) minmax(380px, 1fr);
		gap: var(--sp-4);
		min-height: 0;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		max-height: 58vh;
		overflow-y: auto;
		padding-right: var(--sp-1);
	}
	.tabs {
		display: flex;
		gap: var(--sp-1);
		border-bottom: 1px solid var(--c-border);
		margin-bottom: var(--sp-1);
	}
	.tabs button {
		padding: var(--sp-2) var(--sp-3);
		border: none;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.tabs button.active {
		color: var(--c-primary);
		border-bottom-color: var(--c-primary);
	}
	h4 {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.small {
		font-size: var(--fs-sm);
		margin: 0;
	}
	.error {
		color: var(--c-danger);
	}
	.row {
		display: flex;
		gap: var(--sp-2);
		align-items: center;
	}
	.cell {
		min-width: 0;
		height: 28px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		color: var(--c-text);
		font-size: var(--fs-sm);
	}
	.row .cell {
		flex: 1;
	}
	.num {
		width: 64px;
	}
	.key {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.icon {
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.cellbox {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		padding: var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface-2);
	}
	.cellhead {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
		white-space: nowrap;
	}
	.spacer {
		flex: 1;
	}
	.logo {
		display: flex;
		gap: var(--sp-3);
		align-items: center;
	}
	.logo-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 160px;
		height: 90px;
		border: 1px dashed var(--c-border-strong);
		border-radius: var(--radius);
		background: var(--c-drawing-bg);
	}
	.logo-preview img {
		max-width: 100%;
		max-height: 100%;
	}
	.logo-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-1);
	}
	.file {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--c-primary);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.file input {
		display: none;
	}
	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.sheet {
		width: 100%;
		background: #fff;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-sm);
	}
	.cover :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
