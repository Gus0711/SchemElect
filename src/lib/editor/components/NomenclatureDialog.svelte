<script lang="ts">
	/**
	 * Nomenclature du dossier : par repère (ce qui est dessiné) et liste de commande par
	 * fabricant (appareils + accessoires, matériel d'armoire calculé, câbles, lignes libres).
	 */
	import { downloadText, nomenclatureCsv, orderCsv } from '$lib/export/csv';
	import { safeFileName } from '$lib/export/dossier';
	import { linkReference } from '$lib/model/catalog';
	import { newId } from '$lib/model/ids';
	import { bomTagsText, computeNomenclature } from '$lib/model/nomenclature';
	import {
		computeOrderList,
		ductSize,
		formatQuantity,
		groupByManufacturer,
		SOURCE_LABEL
	} from '$lib/model/orderList';
	import type { MaterialRefs, OrderExtra, Project } from '$lib/model/types';
	import { Button, Modal } from '$lib/ui';
	import { Download, Plus, Trash } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';

	let { open = $bindable(false), editor }: { open?: boolean; editor: Editor } = $props();

	let tab = $state<'bom' | 'order'>('bom');

	const project = $derived(editor.project);
	const ro = $derived(editor.readonly);
	const lines = $derived(open ? computeNomenclature(project) : []);
	const missing = $derived(lines.filter((l) => !l.referenced));
	const total = $derived(lines.reduce((n, l) => n + l.quantity, 0));
	const groups = $derived(
		open && tab === 'order' ? groupByManufacturer(computeOrderList(project)) : []
	);

	/** Dimensions de goulottes posées (folios d'implantation). */
	const ductSizes = $derived(
		[
			...new Set(
				project.folios.flatMap((f) =>
					f.panel?.kind === 'implantation' ? f.panel.ducts.map(ductSize) : []
				)
			)
		].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
	);
	const enclosures = $derived(project.folios.filter((f) => f.panel?.kind === 'implantation'));
	const hasStrips = $derived(
		groups.some((g) => g.lines.some((l) => l.designation.startsWith('Butée')))
	);

	const base = $derived(
		safeFileName(`${project.meta.planNumber || 'schema'} ${project.meta.name}`) || 'schema'
	);
	const val = (e: Event) => (e.currentTarget as HTMLInputElement).value.trim();

	/** Change une référence de commande et recopie sa fiche catalogue dans le dossier. */
	function setRef(label: string, reference: string, apply: (p: Project) => void) {
		// Recopie la fiche (si elle existe) et retire les copies devenues inutiles.
		editor.transact(label, (p) => {
			apply(p);
			linkReference(p, reference, editor.catalog);
		});
	}

	function setMaterial(key: 'rail' | 'endClamp' | 'endPlate', reference: string) {
		setRef('Matériel d’armoire', reference, (p) => {
			// Pas de `(p.materials ??= {})` : il renverrait l'objet brut, pas le proxy réactif.
			p.materials ??= {};
			const m: MaterialRefs = p.materials;
			if (reference) m[key] = reference;
			else delete m[key];
		});
	}

	function setDuct(size: string, reference: string) {
		setRef('Goulotte', reference, (p) => {
			p.materials ??= {};
			p.materials.ducts ??= {};
			const ducts = p.materials.ducts;
			if (reference) ducts[size] = reference;
			else delete ducts[size];
		});
	}

	function setEnclosure(folioId: string, reference: string) {
		setRef('Enveloppe', reference, (p) => {
			const panel = p.folios.find((f) => f.id === folioId)?.panel;
			if (panel) panel.reference = reference || undefined;
		});
	}

	function addExtra() {
		editor.transact('Ligne de commande', (p) => {
			p.orderExtras ??= [];
			p.orderExtras.push({
				id: newId('x'),
				reference: '',
				manufacturer: '',
				designation: '',
				quantity: 1,
				unit: 'pce'
			});
		});
	}

	function setExtra<K extends keyof OrderExtra>(id: string, key: K, value: OrderExtra[K]) {
		editor.transact('Ligne de commande', (p) => {
			const x = p.orderExtras?.find((e) => e.id === id);
			if (!x) return;
			x[key] = value;
			if (key !== 'reference') return;
			// Fiche du catalogue : recopiée ; fabricant / désignation repris s'ils sont vides.
			const f = linkReference(p, String(value), editor.catalog);
			if (f) {
				x.manufacturer ||= f.manufacturer;
				x.designation ||= f.designation;
			}
		});
	}

	function removeExtra(id: string) {
		editor.transact('Ligne de commande', (p) => {
			p.orderExtras = (p.orderExtras ?? []).filter((x) => x.id !== id);
			if (!p.orderExtras.length) delete p.orderExtras;
			linkReference(p, '', editor.catalog);
		});
	}

	function exportCsv() {
		if (tab === 'bom') downloadText(`${base} - nomenclature.csv`, nomenclatureCsv(project));
		else downloadText(`${base} - liste de commande.csv`, orderCsv(project));
	}
</script>

{#snippet refInput(value: string | undefined, onchange: (v: string) => void, label: string)}
	<input
		class="ref-input"
		value={value ?? ''}
		placeholder="Référence…"
		list="order-catalog"
		aria-label={label}
		disabled={ro}
		onchange={(e) => onchange(val(e))}
	/>
{/snippet}

<Modal bind:open title="Nomenclature" width="980px">
	<nav class="tabs">
		<button class:active={tab === 'bom'} onclick={() => (tab = 'bom')}>Par repère</button>
		<button class:active={tab === 'order'} onclick={() => (tab = 'order')}>Liste de commande</button
		>
	</nav>

	{#if tab === 'bom'}
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
	{:else}
		<p class="muted small">
			Tout ce qu’il faut commander, par fabricant : appareils et accessoires, matériel d’armoire
			calculé depuis l’implantation (rails en barres de 2 m, goulottes en mètres, 2 butées et 1
			flasque par bornier), câbles (longueur saisie sur chaque câble, inspecteur), lignes libres.
		</p>

		<details class="settings" open={!ro}>
			<summary>Références du matériel d’armoire et lignes libres</summary>
			<div class="grid">
				<label
					>Rail oméga (barre 2 m) {@render refInput(
						project.materials?.rail,
						(v) => setMaterial('rail', v),
						'Référence du rail'
					)}</label
				>
				{#if hasStrips}
					<label
						>Butée d’arrêt {@render refInput(
							project.materials?.endClamp,
							(v) => setMaterial('endClamp', v),
							'Référence de la butée'
						)}</label
					>
					<label
						>Flasque d’extrémité {@render refInput(
							project.materials?.endPlate,
							(v) => setMaterial('endPlate', v),
							'Référence de la flasque'
						)}</label
					>
				{/if}
				{#each ductSizes as size (size)}
					<label
						>Goulotte {size}
						{@render refInput(
							project.materials?.ducts?.[size],
							(v) => setDuct(size, v),
							`Référence goulotte ${size}`
						)}</label
					>
				{/each}
				{#each enclosures as f (f.id)}
					<label
						>Enveloppe ({f.title}) {@render refInput(
							f.panel?.reference,
							(v) => setEnclosure(f.id, v),
							`Référence enveloppe ${f.title}`
						)}</label
					>
				{/each}
			</div>
			{#if !enclosures.length}
				<p class="muted small">
					Pas de folio d’implantation : enveloppe, rails et goulottes ne sont pas calculés.
				</p>
			{/if}

			<h4>Lignes libres</h4>
			{#if project.orderExtras?.length}
				<table class="extras">
					<thead
						><tr
							><th>Référence</th><th>Fabricant</th><th>Désignation</th><th class="num">Qté</th><th
								>Unité</th
							><th></th></tr
						></thead
					>
					<tbody>
						{#each project.orderExtras as x (x.id)}
							<tr>
								<td
									>{@render refInput(
										x.reference,
										(v) => setExtra(x.id, 'reference', v),
										'Référence de la ligne libre'
									)}</td
								>
								<td
									><input
										value={x.manufacturer}
										disabled={ro}
										aria-label="Fabricant de la ligne libre"
										onchange={(e) => setExtra(x.id, 'manufacturer', val(e))}
									/></td
								>
								<td
									><input
										class="wide"
										value={x.designation}
										disabled={ro}
										aria-label="Désignation de la ligne libre"
										onchange={(e) => setExtra(x.id, 'designation', val(e))}
									/></td
								>
								<td
									><input
										class="qty"
										type="number"
										min="0"
										step="any"
										value={x.quantity}
										disabled={ro}
										aria-label="Quantité de la ligne libre"
										onchange={(e) => setExtra(x.id, 'quantity', Math.max(0, Number(val(e)) || 0))}
									/></td
								>
								<td
									><input
										class="unit"
										value={x.unit ?? 'pce'}
										disabled={ro}
										aria-label="Unité de la ligne libre"
										onchange={(e) => setExtra(x.id, 'unit', val(e) || 'pce')}
									/></td
								>
								<td
									><button
										class="icon"
										title="Supprimer"
										disabled={ro}
										onclick={() => removeExtra(x.id)}><Trash size={14} /></button
									></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
			<Button size="sm" disabled={ro} onclick={addExtra}
				><Plus size={14} /> Ajouter une ligne (presse-étoupes, visserie…)</Button
			>
		</details>

		<div class="wrap">
			<table>
				<thead>
					<tr>
						<th>Référence</th>
						<th>Désignation</th>
						<th class="num">Qté</th>
						<th>Unité</th>
						<th>Origine</th>
						<th>Précision</th>
					</tr>
				</thead>
				<tbody>
					{#each groups as g (g.manufacturer)}
						<tr class="group"><td colspan="6">{g.manufacturer}</td></tr>
						{#each g.lines as l (l.key)}
							<tr class:missing={!l.reference}>
								<td class="ref">{l.reference || 'À compléter'}</td>
								<td>{l.designation}</td>
								<td class="num">{formatQuantity(l.quantity)}</td>
								<td>{l.unit}</td>
								<td>{SOURCE_LABEL[l.source]}</td>
								<td class="muted">{l.detail}</td>
							</tr>
						{/each}
					{:else}
						<tr><td colspan="6" class="muted">Rien à commander pour l’instant.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<datalist id="order-catalog">
		{#each editor.catalog as c (c.id)}<option value={c.reference}
				>{[c.manufacturer, c.designation].filter(Boolean).join(' — ')}</option
			>{/each}
	</datalist>

	{#snippet actions()}
		<Button onclick={exportCsv}><Download size={14} /> Exporter CSV</Button>
		<Button variant="ghost" onclick={() => (open = false)}>Fermer</Button>
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
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
	.tabs button.active {
		color: var(--c-primary);
		border-bottom-color: var(--c-primary);
	}
	.small {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.warn {
		color: var(--c-warning);
	}
	.settings {
		padding: var(--sp-2) var(--sp-3);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface-2);
	}
	.settings summary {
		cursor: pointer;
		font-weight: var(--fw-bold);
		font-size: var(--fs-sm);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--sp-2) var(--sp-3);
		margin: var(--sp-2) 0;
	}
	.grid label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	h4 {
		margin: var(--sp-3) 0 var(--sp-1);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--c-text-muted);
	}
	input {
		height: 26px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-sm);
		min-width: 0;
		width: 100%;
	}
	.extras {
		margin-bottom: var(--sp-2);
	}
	.extras td {
		padding: 2px;
		border: none;
	}
	.qty {
		width: 64px;
	}
	.unit {
		width: 60px;
	}
	.icon {
		display: flex;
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.wrap {
		max-height: 55vh;
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
	.extras th {
		position: static;
		background: transparent;
		border: none;
		padding: 0 2px;
		font-size: var(--fs-xs);
	}
	td {
		padding: 3px var(--sp-2);
		border-bottom: 1px solid var(--c-border);
	}
	tr.group td {
		padding-top: var(--sp-2);
		font-weight: var(--fw-bold);
		background: var(--c-primary-soft);
	}
	.num {
		text-align: right;
		width: 48px;
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
