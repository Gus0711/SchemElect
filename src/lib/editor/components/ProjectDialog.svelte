<script lang="ts">
	/** Propriétés du dossier : cartouche, indices de révision, potentiels. */
	import { deepClone, newId } from '$lib/model/ids';
	import { formatWireNumber, WIRE_NUMBER_TEMPLATES, WIRE_SECTIONS } from '$lib/model/nets';
	import type { Potential, ProjectMeta, ProjectSettings, Revision } from '$lib/model/types';
	import { Button, Field, Modal } from '$lib/ui';
	import { listTemplates, saveTemplate } from '$lib/api/client';
	import {
		DEFAULT_TEMPLATE_ID,
		defaultTemplate,
		projectTemplate,
		type DocTemplate
	} from '$lib/model/template';
	import TemplateEditor from './TemplateEditor.svelte';
	import { Plus, Trash } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import type { Editor } from '../editor.svelte';

	let { editor, open = $bindable(false) }: { editor: Editor; open?: boolean } = $props();

	let meta: ProjectMeta = $state({} as ProjectMeta);
	let revisions: Revision[] = $state([]);
	let potentials: Potential[] = $state([]);
	let settings: ProjectSettings = $state({ wireNumberDigits: 2, wireNumberStart: 1 });
	/** Exemple du numéro de fil (folio 03, colonne D, 12e fil). */
	const numberExample = $derived(
		formatWireNumber(settings.wireNumberTemplate?.trim() || '{N}', {
			N: String(Math.max(0, Number(settings.wireNumberStart) || 0) + 11).padStart(
				Math.min(6, Math.max(1, Number(settings.wireNumberDigits) || 1)),
				'0'
			),
			F: '03',
			C: 'D'
		})
	);
	const isPreset = (t: string | undefined) =>
		WIRE_NUMBER_TEMPLATES.some((x) => x.value === (t?.trim() || '{N}'));
	let tab: 'info' | 'template' | 'revisions' | 'potentials' | 'numbering' = $state('info');
	/** Modèle de cartouche / page de garde du dossier (copie locale jusqu'à « Enregistrer »). */
	let template: DocTemplate = $state(defaultTemplate());
	let library: DocTemplate[] = $state([]);
	let chosen = $state('');
	let libraryMessage = $state('');

	// À l'ouverture : copie locale du dossier. Les écritures sont hors suivi (`untrack`) :
	// relire `meta` après l'avoir écrit relançait l'effet en boucle.
	$effect(() => {
		if (!open) return;
		const p = $state.snapshot(editor.project);
		untrack(() => {
			meta = { ...deepClone(p.meta), fields: deepClone(p.meta.fields ?? {}) };
			revisions = deepClone(p.revisions);
			potentials = deepClone(p.potentials);
			settings = { sectionDisplay: 'all', ...deepClone(p.settings) };
			template = deepClone(projectTemplate(p));
			libraryMessage = '';
		});
		listTemplates()
			.then((l) => (library = l))
			.catch(() => (library = []));
	});

	/** Remplace le modèle du dossier par un modèle de la bibliothèque (ou le standard). */
	function applyChosen() {
		const t =
			chosen === DEFAULT_TEMPLATE_ID ? defaultTemplate() : library.find((x) => x.id === chosen);
		if (!t) return;
		template = deepClone($state.snapshot(t) as DocTemplate);
		libraryMessage = `Modèle « ${t.name} » appliqué au dossier (à enregistrer).`;
	}

	/** Enregistre le modèle du dossier dans la bibliothèque partagée. */
	async function saveToLibrary(asNew: boolean) {
		let t = $state.snapshot(template) as DocTemplate;
		if (asNew || t.id === DEFAULT_TEMPLATE_ID) {
			const name = prompt(
				'Nom du modèle dans la bibliothèque :',
				asNew ? `${t.name} (copie)` : t.name
			);
			if (!name?.trim()) return;
			t = { ...t, id: newId('tpl'), name: name.trim() };
		}
		try {
			const saved = await saveTemplate(t);
			template = deepClone(saved);
			library = [...library.filter((x) => x.id !== saved.id), saved].sort((a, b) =>
				a.name.localeCompare(b.name, 'fr')
			);
			libraryMessage = `Modèle « ${saved.name} » enregistré dans la bibliothèque.`;
		} catch (e) {
			libraryMessage = e instanceof Error ? e.message : 'Enregistrement impossible';
		}
	}

	const usedPotentials = $derived(
		new Set(editor.project.folios.flatMap((f) => f.bars.map((b) => b.potentialId)))
	);

	const infoFields: [Exclude<keyof ProjectMeta, 'fields'>, string][] = [
		['name', 'Nom du projet'],
		['affaireNumber', 'N° d’affaire'],
		['planNumber', 'N° de plan'],
		['client', 'Client / site'],
		['author', 'Dessinateur'],
		['company', 'Société'],
		['companyAddress', 'Adresse société']
	];

	function save() {
		const m = $state.snapshot(meta);
		const r = $state.snapshot(revisions);
		const pots = $state.snapshot(potentials);
		const st = $state.snapshot(settings);
		const tpl = $state.snapshot(template) as DocTemplate;
		const isDefault = JSON.stringify(tpl) === JSON.stringify(defaultTemplate());
		editor.transact('Propriétés du dossier', (p) => {
			if (isDefault) delete p.template;
			else p.template = tpl;
			p.meta = { ...m, modifiedAt: p.meta.modifiedAt };
			p.revisions = r;
			p.potentials = pots;
			p.settings = {
				wireNumberStart: Math.max(0, Math.round(st.wireNumberStart) || 0),
				wireNumberDigits: Math.min(6, Math.max(1, Math.round(st.wireNumberDigits) || 1)),
				...(st.wireNumberTemplate?.trim() && st.wireNumberTemplate.trim() !== '{N}'
					? { wireNumberTemplate: st.wireNumberTemplate.trim() }
					: {}),
				...(st.wireSection?.trim() ? { wireSection: st.wireSection.trim() } : {}),
				...(st.sectionDisplay && st.sectionDisplay !== 'all'
					? { sectionDisplay: st.sectionDisplay }
					: {})
			};
		});
		open = false;
	}

	function nextIndice() {
		const last = revisions.at(-1)?.indice;
		return last ? String.fromCharCode(last.charCodeAt(0) + 1) : 'A';
	}
</script>

<Modal bind:open title="Propriétés du dossier" width={tab === 'template' ? '1180px' : '640px'}>
	<nav class="tabs">
		<button class:active={tab === 'info'} onclick={() => (tab = 'info')}>Cartouche</button>
		<button class:active={tab === 'template'} onclick={() => (tab = 'template')}
			>Modèle (cartouche, page de garde)</button
		>
		<button class:active={tab === 'revisions'} onclick={() => (tab = 'revisions')}>Indices</button>
		<button class:active={tab === 'potentials'} onclick={() => (tab = 'potentials')}
			>Potentiels</button
		>
		<button class:active={tab === 'numbering'} onclick={() => (tab = 'numbering')}
			>Numérotation et sections</button
		>
	</nav>

	{#if tab === 'info'}
		<div class="grid2">
			{#each infoFields as [key, label] (key)}
				<Field {label} bind:value={meta[key]} />
			{/each}
		</div>
		{#if template.fields.length}
			<h4 class="sub">Champs du modèle « {template.name} »</h4>
			<div class="grid2">
				{#each template.fields as f (f.key)}
					<Field label={f.label} bind:value={meta.fields![f.key]} />
				{/each}
			</div>
		{/if}
	{:else if tab === 'template'}
		<div class="tpl-bar">
			<span class="small">Modèle du dossier : <strong>{template.name}</strong></span>
			<span class="spacer"></span>
			<select class="cell" bind:value={chosen} title="Modèles de la bibliothèque partagée">
				<option value="">Choisir un modèle…</option>
				<option value={DEFAULT_TEMPLATE_ID}>Standard (par défaut)</option>
				{#each library as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
			</select>
			<Button size="sm" disabled={!chosen || editor.readonly} onclick={applyChosen}
				>Appliquer</Button
			>
			<Button size="sm" disabled={editor.readonly} onclick={() => saveToLibrary(false)}
				>Enregistrer dans la bibliothèque</Button
			>
			<Button
				size="sm"
				variant="ghost"
				disabled={editor.readonly}
				onclick={() => saveToLibrary(true)}>… comme nouveau modèle</Button
			>
		</div>
		{#if libraryMessage}<p class="muted small">{libraryMessage}</p>{/if}
		<TemplateEditor bind:template project={{ ...editor.project, meta, revisions }} />
	{:else if tab === 'revisions'}
		<table>
			<thead><tr><th>Indice</th><th>Modification</th><th>Date</th><th></th></tr></thead>
			<tbody>
				{#each revisions as r, i (i)}
					<tr>
						<td><input class="cell short" bind:value={r.indice} /></td>
						<td><input class="cell" bind:value={r.description} /></td>
						<td><input class="cell" type="date" bind:value={r.date} /></td>
						<td
							><button class="icon" onclick={() => revisions.splice(i, 1)} title="Supprimer"
								><Trash size={14} /></button
							></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
		<div>
			<Button
				size="sm"
				onclick={() =>
					revisions.push({
						indice: nextIndice(),
						description: '',
						date: new Date().toISOString().slice(0, 10)
					})}
			>
				<Plus size={14} /> Ajouter un indice
			</Button>
		</div>
	{:else if tab === 'numbering'}
		<p class="muted">
			Les fils sont numérotés sur tout le dossier, dans l'ordre des folios puis de gauche à droite.
			Les fils reliés à un potentiel (barre) portent le nom du potentiel et ne sont pas numérotés.
			Un numéro imposé sur un fil (inspecteur) est conservé.
		</p>
		<div class="grid2">
			<Field label="Premier numéro" type="number" min="0" bind:value={settings.wireNumberStart} />
			<Field
				label="Nombre de chiffres"
				type="number"
				min="1"
				max="6"
				bind:value={settings.wireNumberDigits}
				hint="2 → 01, 02… ; 3 → 001, 002…"
			/>
		</div>
		<div class="grid2">
			<Field label="Format du numéro">
				<select
					class="control"
					value={isPreset(settings.wireNumberTemplate)
						? settings.wireNumberTemplate?.trim() || '{N}'
						: 'custom'}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						// Personnalisé : point de départ modifiable dans le champ « Modèle ».
						settings.wireNumberTemplate = v === 'custom' ? '{F}-{N}' : v;
					}}
				>
					{#each WIRE_NUMBER_TEMPLATES as t (t.value)}
						<option value={t.value}>{t.label} ({t.example})</option>
					{/each}
					<option value="custom">Personnalisé…</option>
				</select>
			</Field>
			<Field
				label="Modèle"
				bind:value={settings.wireNumberTemplate}
				placeholder={'{N}'}
				hint={'{N} n°, {F} folio, {C} colonne — exemple : ' + numberExample}
			/>
		</div>
		<p class="muted small">
			Avec {'{F}'}, le compteur repart à chaque folio (insérer un folio ne renumérote pas les
			autres) ; avec {'{C}'}, à chaque colonne.
		</p>
		<h4>Sections des fils (mm²)</h4>
		<p class="muted">
			Section d’un fil : celle imposée sur le fil (inspecteur), sinon celle de son potentiel (onglet
			Potentiels), sinon la section par défaut ci-dessous. Affichée sur le fil (« 1,5² »), du côté
			opposé au numéro.
		</p>
		<div class="grid2">
			<Field
				label="Section par défaut (fils hors potentiel)"
				bind:value={settings.wireSection}
				placeholder="0,75"
				list="wire-sections"
				hint="Vide = pas de section"
			/>
			<Field label="Afficher sur le dessin">
				<select class="control" bind:value={settings.sectionDisplay}>
					<option value="all">Toutes les sections</option>
					<option value="imposed">Seulement les sections imposées sur un fil</option>
					<option value="none">Aucune</option>
				</select>
			</Field>
		</div>
	{:else}
		<table>
			<thead
				><tr
					><th>Nom</th><th>Couleur de fil</th><th>Section (mm²)</th><th>Tracé</th><th>Pointillé</th
					><th></th></tr
				></thead
			>
			<tbody>
				{#each potentials as pot, i (pot.id)}
					<tr>
						<td><input class="cell" bind:value={pot.name} /></td>
						<td><input class="cell" bind:value={pot.wireColor} /></td>
						<td
							><input
								class="cell narrow"
								bind:value={pot.section}
								placeholder="—"
								list="wire-sections"
							/></td
						>
						<td><input class="swatch" type="color" bind:value={pot.stroke} /></td>
						<td><input type="checkbox" bind:checked={pot.dashed} /></td>
						<td>
							<button
								class="icon"
								disabled={usedPotentials.has(pot.id)}
								title={usedPotentials.has(pot.id) ? 'Utilisé par une barre' : 'Supprimer'}
								onclick={() => potentials.splice(i, 1)}><Trash size={14} /></button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div>
			<Button
				size="sm"
				onclick={() =>
					potentials.push({
						id: newId('pot'),
						name: 'Nouveau potentiel',
						wireColor: '',
						stroke: '#111111'
					})}
			>
				<Plus size={14} /> Ajouter un potentiel
			</Button>
		</div>
	{/if}

	<datalist id="wire-sections">
		{#each WIRE_SECTIONS as s (s)}<option value={s}></option>{/each}
	</datalist>

	{#snippet actions()}
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" onclick={save} disabled={editor.readonly}>Enregistrer</Button>
	{/snippet}
</Modal>

<style>
	.tabs {
		display: flex;
		gap: var(--sp-1);
		border-bottom: 1px solid var(--c-border);
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
	.sub {
		margin: var(--sp-3) 0 var(--sp-2);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.tpl-bar {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.spacer {
		flex: 1;
	}
	.small {
		font-size: var(--fs-sm);
		margin: 0;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-3);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th {
		text-align: left;
		font-weight: var(--fw-medium);
		color: var(--c-text-muted);
		padding: var(--sp-1);
	}
	td {
		padding: 2px var(--sp-1);
	}
	.cell.narrow {
		width: 70px;
	}
	.cell {
		width: 100%;
		height: 28px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	.cell.short {
		width: 56px;
	}
	.swatch {
		width: 40px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
	}
	.icon {
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.icon:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
