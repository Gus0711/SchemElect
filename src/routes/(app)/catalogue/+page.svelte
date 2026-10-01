<script lang="ts">
	/** Catalogue matériel partagé : fiches par référence, import / export CSV. */
	import { invalidateAll } from '$app/navigation';
	import { deleteCatalogItem, importCatalogItems } from '$lib/api/client';
	import CatalogItemDialog from '$lib/editor/components/CatalogItemDialog.svelte';
	import { downloadText, toCsv } from '$lib/export/csv';
	import {
		CATALOG_CSV_HEADER,
		catalogCsvRow,
		compareCatalogItems,
		importCatalogCsv,
		normalizeCatalogItem,
		referenceKey,
		type CatalogItem
	} from '$lib/model/catalog';
	import { STARTER_CATALOG } from '$lib/model/catalogStarter';
	import { normalizeSearch } from '$lib/model/inventory';
	import { Alert, Button, Card } from '$lib/ui';
	import { Download, FilePlus2, PackagePlus, Pencil, Search, Trash, Upload } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let category = $state('');
	let dialogOpen = $state(false);
	let editing: Partial<CatalogItem> | null = $state(null);
	let error = $state('');
	let info = $state('');
	let pending = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	const items = $derived([...data.items].sort(compareCatalogItems));
	const categories = $derived(
		[...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort((a, b) =>
			a.localeCompare(b, 'fr')
		)
	);
	const visible = $derived.by(() => {
		const q = normalizeSearch(query);
		const qRef = referenceKey(query);
		return items.filter(
			(i) =>
				(!category || i.category === category) &&
				(!q ||
					normalizeSearch(
						[i.reference, i.manufacturer, i.designation, i.category, i.notes].join(' ')
					).includes(q) ||
					(!!qRef && referenceKey(i.reference).includes(qRef)))
		);
	});
	/** Fiches du catalogue de départ absentes de la bibliothèque. */
	const starterMissing = $derived.by(() => {
		const have = new Set(items.map((i) => referenceKey(i.reference)));
		return STARTER_CATALOG.filter((s) => !have.has(referenceKey(s.reference)));
	});

	const MOUNT = { rail: 'Rail', porte: 'Porte', externe: 'Hors armoire' } as const;

	function open(item: Partial<CatalogItem> | null) {
		editing = item;
		dialogOpen = true;
	}

	async function run(fn: () => Promise<string | void>) {
		pending = true;
		error = '';
		info = '';
		try {
			info = (await fn()) ?? '';
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Opération impossible';
		} finally {
			pending = false;
		}
	}

	async function remove(item: CatalogItem) {
		if (
			!confirm(
				`Supprimer la fiche « ${item.reference} » ? Les dossiers qui l’utilisent gardent leur copie.`
			)
		)
			return;
		await run(() => deleteCatalogItem(item.id));
	}

	async function importFile(file: File) {
		const text = await file.text();
		const res = importCatalogCsv(text);
		if (!res.items.length) {
			error = res.skipped[0]?.reason ?? 'Aucune fiche trouvée dans le fichier.';
			return;
		}
		const have = new Set(items.map((i) => referenceKey(i.reference)));
		const updates = res.items.filter((i) => have.has(referenceKey(i.reference))).length;
		const lines = [
			`${res.items.length} fiche(s) lue(s) dans « ${file.name} » :`,
			`• ${res.items.length - updates} nouvelle(s)`,
			`• ${updates} mise(s) à jour (même référence)`
		];
		if (res.skipped.length)
			lines.push(`• ${res.skipped.length} ligne(s) ignorée(s) (sans référence)`);
		if (res.unknownColumns.length)
			lines.push(`Colonnes ignorées : ${res.unknownColumns.join(', ')}`);
		if (!confirm(`${lines.join('\n')}\n\nImporter ?`)) return;
		await run(async () => {
			const r = await importCatalogItems(res.items);
			return `Import terminé : ${r.created} fiche(s) créée(s), ${r.updated} mise(s) à jour.`;
		});
	}

	async function importStarter() {
		const n = starterMissing.length;
		if (
			!confirm(
				`Ajouter ${n} fiche(s) du catalogue de départ (Schneider, Legrand, Finder, Phoenix Contact, références du dossier DW261136) ?\n\nLes fiches existantes ne sont pas modifiées. Toutes sont marquées « à vérifier » : contrôler désignations et encombrements sur les fiches techniques.`
			)
		)
			return;
		await run(async () => {
			const list = starterMissing
				.map((s) => normalizeCatalogItem(s))
				.filter((x): x is CatalogItem => !!x);
			const r = await importCatalogItems(list);
			return `${r.created} fiche(s) ajoutée(s) au catalogue.`;
		});
	}

	function exportCsv() {
		const rows = items.map(catalogCsvRow);
		downloadText('Catalogue SchemElect.csv', toCsv(CATALOG_CSV_HEADER, rows));
	}

	function downloadTemplate() {
		const example = [
			'LC1D09B7',
			'Schneider Electric',
			'Contacteur 3P 9 A',
			'Contacteur',
			1,
			1,
			45,
			77,
			'Rail',
			''
		];
		downloadText('Modèle import catalogue.csv', toCsv(CATALOG_CSV_HEADER, [example]));
	}

	const contacts = (i: CatalogItem) =>
		i.contacts ? `${i.contacts.no} NO · ${i.contacts.nc} NC` : '';
	const size = (i: CatalogItem) =>
		i.w && i.h ? `${String(i.w).replace('.', ',')} × ${String(i.h).replace('.', ',')}` : '';
</script>

<svelte:head><title>Catalogue — SchemElect</title></svelte:head>

<div class="toolbar">
	<h1>Catalogue matériel</h1>
	<div class="buttons">
		<Button
			onclick={() => fileInput?.click()}
			disabled={pending}
			title="Fichier CSV (Excel : Enregistrer sous › CSV point-virgule)"
			><Upload size={16} /> Importer CSV</Button
		>
		<Button onclick={exportCsv} disabled={!items.length}><Download size={16} /> Exporter CSV</Button
		>
		<Button variant="primary" onclick={() => open(null)}
			><FilePlus2 size={16} /> Nouvelle fiche</Button
		>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept=".csv,.txt,text/csv"
		hidden
		onchange={(e) => {
			const f = e.currentTarget.files?.[0];
			e.currentTarget.value = '';
			if (f) importFile(f);
		}}
	/>
</div>

<p class="muted">
	Une fiche par référence constructeur : fabricant, désignation, contacts auxiliaires disponibles
	(contrôle des contacts dessinés) et encombrement (implantation). Dans l’éditeur, la référence d’un
	appareil se choisit dans ce catalogue ; chaque dossier garde sa propre copie des fiches utilisées
	(bouton « Mettre à jour » dans le panneau Appareils).
	<button class="link" onclick={downloadTemplate}>Modèle de fichier d’import</button>
</p>

{#if error}<Alert>{error}</Alert>{/if}
{#if info}<Alert variant="success">{info}</Alert>{/if}

{#if starterMissing.length}
	<Card>
		<div class="starter">
			<div>
				<strong>{items.length ? 'Compléter avec le catalogue de départ' : 'Catalogue vide'}</strong>
				<p class="muted">
					{starterMissing.length} références courantes prêtes à l’emploi : contacteurs et disjoncteurs
					moteur TeSys, disjoncteurs Acti9, relais Zelio et Finder, alimentations Phaseo, façade Harmony,
					bornes Phoenix Contact, et les références relevées dans le dossier DW261136. À vérifier avant
					usage.
				</p>
			</div>
			<Button onclick={importStarter} disabled={pending}
				><PackagePlus size={16} /> Importer le catalogue de départ</Button
			>
		</div>
	</Card>
{/if}

<div class="filters">
	<label class="search">
		<Search size={14} />
		<input placeholder="Rechercher (référence, fabricant, désignation…)" bind:value={query} />
	</label>
	<select bind:value={category}>
		<option value="">Toutes les catégories</option>
		{#each categories as c (c)}<option value={c}>{c}</option>{/each}
	</select>
	<span class="muted count">{visible.length} / {items.length} fiche(s)</span>
</div>

{#if items.length}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Référence</th>
					<th>Fabricant</th>
					<th>Désignation</th>
					<th>Catégorie</th>
					<th>Contacts</th>
					<th>L × H (mm)</th>
					<th>Montage</th>
					<th>Remarque</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each visible as i (i.id)}
					<tr ondblclick={() => open(i)}>
						<td class="ref">{i.reference}</td>
						<td>{i.manufacturer}</td>
						<td>{i.designation}</td>
						<td>{i.category ?? ''}</td>
						<td class="nowrap">{contacts(i)}</td>
						<td class="nowrap">{size(i)}</td>
						<td>{i.mounting ? MOUNT[i.mounting] : ''}</td>
						<td class="notes muted">{i.notes ?? ''}</td>
						<td class="actions">
							<Button size="sm" variant="ghost" title="Modifier" onclick={() => open(i)}
								><Pencil size={14} /></Button
							>
							<Button
								size="sm"
								variant="ghost"
								title="Supprimer"
								disabled={pending}
								onclick={() => remove(i)}><Trash size={14} /></Button
							>
						</td>
					</tr>
				{:else}
					<tr><td colspan="9" class="muted">Aucune fiche ne correspond.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<CatalogItemDialog
	bind:open={dialogOpen}
	initial={editing}
	{categories}
	onsaved={(it) => {
		info = `Fiche « ${it.reference} » enregistrée.`;
		invalidateAll();
	}}
/>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.buttons {
		display: flex;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--c-primary);
		text-decoration: underline;
		cursor: pointer;
	}
	.starter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
	}
	.starter p {
		margin: var(--sp-1) 0 0;
		font-size: var(--fs-sm);
	}
	.filters {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex: 1;
		min-width: 240px;
		max-width: 480px;
		padding: 0 var(--sp-2);
		height: var(--control-h);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		color: var(--c-text-muted);
		background: var(--c-surface);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
	}
	select {
		height: var(--control-h);
		padding: 0 var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
	}
	.count {
		font-size: var(--fs-sm);
	}
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-surface);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-sm);
	}
	th {
		position: sticky;
		top: 0;
		padding: var(--sp-2);
		text-align: left;
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		background: var(--c-surface-2);
		border-bottom: 1px solid var(--c-border);
		white-space: nowrap;
	}
	td {
		padding: 4px var(--sp-2);
		border-bottom: 1px solid var(--c-border);
		vertical-align: middle;
	}
	tbody tr:hover {
		background: var(--c-surface-2);
	}
	.ref {
		font-weight: var(--fw-bold);
		white-space: nowrap;
	}
	.nowrap {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.notes {
		max-width: 220px;
		font-size: var(--fs-xs);
	}
	.actions {
		display: flex;
		gap: 2px;
		justify-content: flex-end;
	}
</style>
