<script lang="ts">
	/** Panneau de propriétés de la sélection (ou du folio si rien n'est sélectionné). */
	import {
		CABLE_TYPES,
		cableType,
		colorsToLines,
		defaultCableColors,
		defaultCableName,
		linesToColors
	} from '$lib/model/cables';
	import { detachSymbol, scaleSymbol, setSymbolTag, symbolsOfDevice } from '$lib/model/edit';
	import { folioRef } from '$lib/model/layout';
	import { WIRE_SECTIONS } from '$lib/model/nets';
	import { isPanelKind } from '$lib/model/panel';
	import { deviceCatalogItem, linkReference, type CatalogItem } from '$lib/model/catalog';
	import { deviceFootprint } from '$lib/model/footprints';
	import { parseTag } from '$lib/model/tags';
	import type { CableItem, Device, SymbolInstance } from '$lib/model/types';
	import SymbolThumb from '$lib/render/SymbolThumb.svelte';
	import { getSymbolDef } from '$lib/symbols';
	import { specOf } from '$lib/symbols/custom';
	import { Button, Field, Panel } from '$lib/ui';
	import { FlipHorizontal, Package, RotateCw, Trash } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { Editor } from '../editor.svelte';
	import AlignTools from './AlignTools.svelte';
	import CatalogItemDialog from './CatalogItemDialog.svelte';
	import PanelInspector from './PanelInspector.svelte';
	import StripsFolioInspector from './StripsFolioInspector.svelte';

	let { editor }: { editor: Editor } = $props();

	const sel = $derived(editor.selection);
	const single = $derived(sel.length === 1 ? sel[0] : null);
	const folio = $derived(editor.folio);
	const symbol = $derived(
		single?.kind === 'symbol' ? folio.symbols.find((s) => s.id === single.id) : undefined
	);
	const wire = $derived(
		single?.kind === 'wire' ? folio.wires.find((w) => w.id === single.id) : undefined
	);
	const bar = $derived(
		single?.kind === 'bar' ? folio.bars.find((b) => b.id === single.id) : undefined
	);
	const text = $derived(
		single?.kind === 'text' ? folio.texts.find((t) => t.id === single.id) : undefined
	);
	const rect = $derived(
		single?.kind === 'rect' ? folio.rects.find((r) => r.id === single.id) : undefined
	);
	const cable = $derived(
		single?.kind === 'cable' ? folio.cables.find((c) => c.id === single.id) : undefined
	);
	const cableInfo = $derived(cable ? editor.analysis.cables.byId.get(cable.id) : undefined);
	const device = $derived(symbol ? editor.project.devices[symbol.deviceId] : undefined);
	const catalogItem = $derived(deviceCatalogItem(editor.project, device));
	/** Fiche à créer dans le catalogue (« ajouter au catalogue »). */
	let newCatalogItem: Partial<CatalogItem> | null = $state(null);
	const def = $derived(symbol ? getSymbolDef(symbol.defId) : undefined);
	/** Symbole coloré par sa valeur (voyant) : la valeur est une couleur. */
	const isSignal = $derived(!!def?.graphics.some((p) => 'tone' in p && p.tone === 'signal'));
	const siblings = $derived(device ? symbolsOfDevice(editor.project, device.id) : []);
	const wireStyle = $derived(wire ? editor.analysis.wireStyle.get(wire.id) : undefined);
	const wireNet = $derived(wire ? editor.analysis.nets.netOfWire.get(wire.id) : undefined);
	const ro = $derived(editor.readonly);

	/** Repères existants de même préfixe (suggestions pour rattacher un contact). */
	const tagSuggestions = $derived.by(() => {
		if (!def) return [];
		return Object.values(editor.project.devices)
			.map((d) => d.tag)
			.filter((t) => parseTag(t).prefix === def.prefix)
			.sort();
	});

	let tagInput: HTMLInputElement | undefined = $state();
	let textInput: HTMLTextAreaElement | undefined = $state();
	let wireNumberInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		const req = editor.focusRequest;
		if (!req) return;
		tick().then(() => {
			const el =
				req.field === 'tag'
					? tagInput
					: req.field === 'text'
						? textInput
						: req.field === 'wireNumber'
							? wireNumberInput
							: undefined;
			el?.focus();
			el?.select();
		});
	});

	const MOUNTING = { rail: 'sur rail', porte: 'en porte', externe: 'hors armoire' } as const;

	const val = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const NL = '\n';

	function setTag(s: SymbolInstance, value: string) {
		editor.transact('Changer le repère', (p) => setSymbolTag(p, s, value));
	}

	function setDevice<K extends keyof Device>(key: K, value: Device[K]) {
		if (!device) return;
		const id = device.id;
		editor.transact('Modifier l’appareil', (p) => (p.devices[id][key] = value));
	}

	/** Contacts disponibles : vide sur les deux champs = pas de contrôle. */
	function setContacts(kind: 'no' | 'nc', raw: string) {
		if (!device) return;
		const id = device.id;
		const n = raw.trim() === '' ? null : Math.max(0, Math.round(Number(raw)) || 0);
		editor.transact('Contacts disponibles', (p) => {
			const d = p.devices[id];
			const next = { no: d.contacts?.no ?? 0, nc: d.contacts?.nc ?? 0, [kind]: n ?? 0 };
			d.contacts =
				n === null && !(d.contacts && d.contacts[kind === 'no' ? 'nc' : 'no']) ? undefined : next;
		});
	}

	function setScale(k: number) {
		if (!symbol || !(k > 0)) return;
		const id = symbol.id;
		editor.transact('Redimensionner', (_, f) => scaleSymbol(f, id, k));
	}

	function setCable(label: string, fn: (c: CableItem) => void) {
		if (!cable) return;
		const id = cable.id;
		editor.transact(label, (_, f) => {
			const c = f.cables.find((x) => x.id === id);
			if (c) fn(c);
		});
	}

	/** Nombre de conducteurs : les couleurs déjà saisies sont conservées. */
	function resizeCable(c: CableItem, count: number) {
		const next = defaultCableColors(c.type, c.pairs, count);
		c.colors = next.map((x, i) => c.colors[i] ?? x);
	}

	function setCableType(value: string) {
		const t = cableType(value);
		setCable('Type de câble', (c) => {
			c.type = value.trim();
			if (!t) return;
			c.pairs = t.pairs;
			c.colors = defaultCableColors(c.type, c.pairs, c.colors.length);
		});
	}

	function locate(s: SymbolInstance) {
		editor.goToSymbol(s.id);
	}

	function position(s: SymbolInstance) {
		const i = editor.project.folios.findIndex((f) => f.symbols.some((y) => y.id === s.id));
		return folioRef(i, s.x);
	}
</script>

<aside class="inspector">
	{#if editor.stripsFolio && !sel.length}
		<!-- Folio borniers automatique : titre, filtre, série. -->
		<StripsFolioInspector {editor} />
	{:else if editor.panel && (!sel.length || (single && isPanelKind(single.kind)))}
		<!-- Folio d'implantation / de façade : armoire, rail, goulotte, appareil posé. -->
		<PanelInspector {editor} />
	{:else if !sel.length}
		<Panel title="Folio">
			<Field label="Titre du folio">
				<input
					class="control"
					value={folio.title}
					disabled={ro}
					onchange={(e) => {
						const v = val(e);
						editor.transact('Renommer le folio', (_, f) => (f.title = v));
					}}
				/>
			</Field>
			<p class="muted small">
				{folio.symbols.length} symboles · {folio.wires.length} fils · {folio.bars.length} barres
			</p>
		</Panel>
	{:else if symbol && def}
		<Panel title={def.name}>
			<div class="thumb"><SymbolThumb defId={def.id} size={56} /></div>
			{#if device}
				<Field
					label="Repère"
					hint={def.role === 'slave'
						? 'Taper le repère de la bobine / du disjoncteur pour y rattacher ce contact.'
						: undefined}
				>
					<input
						class="control"
						bind:this={tagInput}
						value={device.tag}
						list="tag-suggestions"
						disabled={ro}
						onchange={(e) => setTag(symbol, val(e))}
					/>
					<datalist id="tag-suggestions">
						{#each tagSuggestions as t (t)}<option value={t}></option>{/each}
					</datalist>
				</Field>
				{#if def.role !== 'link'}
					<Field label="Valeur / calibre">
						<input
							class="control"
							value={device.value ?? ''}
							disabled={ro}
							placeholder={isSignal ? 'Rouge, Vert, Orange, Blanc…' : '10A, Courbe C, 230/24V…'}
							onchange={(e) => setDevice('value', val(e))}
						/>
					</Field>
					<Field label="Désignation">
						<input
							class="control"
							value={device.designation ?? ''}
							disabled={ro}
							onchange={(e) => setDevice('designation', val(e))}
						/>
					</Field>
					<Field label="Référence constructeur">
						<input
							class="control"
							value={device.reference ?? ''}
							list="catalog-references"
							placeholder="Choisir dans le catalogue…"
							disabled={ro}
							onchange={(e) => editor.setReference(device.id, val(e))}
						/>
					</Field>
					{#if catalogItem}
						<p class="small muted catalog">
							<Package size={12} />
							{catalogItem.designation || 'Fiche catalogue'}
						</p>
					{:else if device.reference && !ro}
						<p class="small muted catalog">
							Hors catalogue —
							<button
								class="link"
								onclick={() => {
									newCatalogItem = {
										reference: device.reference,
										manufacturer: device.manufacturer ?? '',
										contacts: device.contacts
									};
								}}>ajouter au catalogue</button
							>
						</p>
					{/if}
					<Field label="Fabricant">
						<input
							class="control"
							value={device.manufacturer ?? ''}
							disabled={ro}
							onchange={(e) => setDevice('manufacturer', val(e))}
						/>
					</Field>
					<Field label="Montage" hint="Pour les folios d’implantation et de façade">
						<select
							value={device.mounting ?? ''}
							disabled={ro}
							onchange={(e) =>
								setDevice(
									'mounting',
									((e.currentTarget as HTMLSelectElement).value || undefined) as Device['mounting']
								)}
						>
							<option value=""
								>Automatique ({MOUNTING[
									deviceFootprint(editor.project, device.id, true).mounting
								]})</option
							>
							<option value="rail">Sur rail (armoire)</option>
							<option value="porte">En porte (façade)</option>
							<option value="externe">Hors armoire</option>
						</select>
					</Field>
				{/if}
				{#if def.role === 'master'}
					{@const usage = editor.analysis.crossRefs.get(symbol.id)?.usage}
					<div class="row">
						{#each ['no', 'nc'] as const as k (k)}
							<Field label="Contacts {k.toUpperCase()} dispo.">
								<input
									class="control"
									type="number"
									min="0"
									max="20"
									placeholder={catalogItem?.contacts ? String(catalogItem.contacts[k]) : '—'}
									title={catalogItem?.contacts ? 'Vide : valeur de la fiche catalogue' : undefined}
									value={device.contacts?.[k] ?? ''}
									disabled={ro}
									onchange={(e) => setContacts(k, val(e))}
								/>
							</Field>
						{/each}
					</div>
					{#if usage}
						<p class="small" class:warn={usage.overflowNo || usage.overflowNc}>
							Dessinés : {usage.no} NO · {usage.nc} NC
							{#if usage.overflowNo || usage.overflowNc}— dépassement !{/if}
						</p>
					{/if}
				{/if}
			{/if}
			<div class="row">
				<Button size="sm" onclick={() => editor.rotate()} disabled={ro} title="Pivoter (R)"
					><RotateCw size={14} /> Pivoter</Button
				>
				<Button size="sm" onclick={() => editor.mirror()} disabled={ro} title="Miroir (X)"
					><FlipHorizontal size={14} /> Miroir</Button
				>
			</div>
			{#if def.custom}
				<div class="row">
					<Field label="Échelle (%)" hint="Ou glisser la poignée du coin sur le folio">
						<input
							class="control"
							type="number"
							min="20"
							max="500"
							step="5"
							value={Math.round((symbol.scale ?? 1) * 100)}
							disabled={ro}
							onchange={(e) => setScale(Number(val(e)) / 100)}
						/>
					</Field>
					<Button
						size="sm"
						variant="ghost"
						disabled={ro || !symbol.scale}
						onclick={() => setScale(1)}>100 %</Button
					>
				</div>
			{/if}
			{#if def.custom && def.source}
				<Button
					size="sm"
					variant="ghost"
					disabled={ro}
					onclick={() => (editor.symbolEditor = { spec: specOf(def) })}
					>Modifier le symbole maison…</Button
				>
			{/if}
		</Panel>
		{#if device && siblings.length > 1}
			<Panel title="Symboles de {device.tag}">
				<ul class="siblings">
					{#each siblings as s (s.id)}
						<li>
							<button class:current={s.id === symbol.id} onclick={() => locate(s)}>
								<span>{getSymbolDef(s.defId).name}</span>
								<span class="muted">{position(s)}</span>
							</button>
						</li>
					{/each}
				</ul>
				<Button
					size="sm"
					variant="ghost"
					disabled={ro}
					onclick={() => editor.transact('Détacher', (p) => detachSymbol(p, symbol))}
				>
					Détacher ce symbole
				</Button>
			</Panel>
		{/if}
	{:else if wire}
		<Panel title="Fil">
			<p class="small">
				{#if wireNet?.potentialId}
					Potentiel : <strong
						>{editor.project.potentials.find((p) => p.id === wireNet.potentialId)?.name}</strong
					>
				{:else}
					Numéro : <strong>{wireStyle?.number ?? '—'}</strong>
				{/if}
			</p>
			{#if wireNet?.shortedPotentials.length}
				<p class="warn small">Court-circuit entre potentiels !</p>
			{/if}
			<Field
				label="Section (mm²)"
				hint={wire.section?.trim()
					? 'Imposée sur ce fil : s’applique à toute l’équipotentielle.'
					: wireNet?.section
						? `Vide = ${wireNet.section} mm² (${wireNet.potentialId ? 'section du potentiel' : 'section par défaut du dossier'}).`
						: 'Vide = pas de section (réglages : Propriétés du dossier).'}
			>
				<input
					class="control"
					value={wire.section ?? ''}
					placeholder={wireNet?.section ?? '—'}
					list="inspector-wire-sections"
					disabled={ro}
					onchange={(e) => {
						const v = val(e).trim();
						const id = wire.id;
						editor.transact('Section de fil', (_, f) => {
							const w = f.wires.find((x) => x.id === id);
							if (w) w.section = v || undefined;
						});
					}}
				/>
				<datalist id="inspector-wire-sections">
					{#each WIRE_SECTIONS as s (s)}<option value={s}></option>{/each}
				</datalist>
			</Field>
			{#if !wireNet?.potentialId}
				<Field
					label="Numéro imposé"
					hint="Vide = numérotation automatique. S'applique à toute l'équipotentielle."
				>
					<input
						class="control"
						bind:this={wireNumberInput}
						value={wire.numberOverride ?? ''}
						disabled={ro}
						onchange={(e) => {
							const v = val(e).trim();
							const id = wire.id;
							editor.transact('Numéro de fil', (_, f) => {
								const w = f.wires.find((x) => x.id === id);
								if (w) w.numberOverride = v || undefined;
							});
						}}
					/>
				</Field>
			{/if}
			<p class="muted small">
				{wireNet?.terminals.length ?? 0} borne(s) raccordée(s) sur l'équipotentielle.
			</p>
		</Panel>
	{:else if bar}
		<Panel title="Barre de potentiel">
			<Field label="Potentiel">
				<select
					value={bar.potentialId}
					disabled={ro}
					onchange={(e) => {
						const v = val(e);
						const id = bar.id;
						editor.transact('Changer le potentiel', (_, f) => {
							const b = f.bars.find((x) => x.id === id);
							if (b) b.potentialId = v;
						});
					}}
				>
					{#each editor.project.potentials as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
				</select>
			</Field>
		</Panel>
	{:else if text}
		<Panel title="Texte">
			<Field label="Contenu">
				<textarea
					bind:this={textInput}
					value={text.text}
					disabled={ro}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLTextAreaElement).value;
						const id = text.id;
						editor.transact('Modifier le texte', (_, f) => {
							const t = f.texts.find((x) => x.id === id);
							if (t) t.text = v;
						});
					}}></textarea>
			</Field>
			<div class="row">
				<Field label="Taille (mm)">
					<input
						class="control"
						type="number"
						min="1"
						max="20"
						step="0.2"
						value={text.size}
						disabled={ro}
						onchange={(e) => {
							const v = Number(val(e)) || 2.5;
							const id = text.id;
							editor.transact('Taille du texte', (_, f) => {
								const t = f.texts.find((x) => x.id === id);
								if (t) t.size = v;
							});
						}}
					/>
				</Field>
				<label class="check">
					<input
						type="checkbox"
						checked={!!text.bold}
						disabled={ro}
						onchange={(e) => {
							const v = (e.currentTarget as HTMLInputElement).checked;
							const id = text.id;
							editor.transact('Texte gras', (_, f) => {
								const t = f.texts.find((x) => x.id === id);
								if (t) t.bold = v;
							});
						}}
					/>
					Gras
				</label>
			</div>
		</Panel>
	{:else if cable}
		{@const crossed = cableInfo?.crossings.length ?? 0}
		{@const unit = cable.pairs ? 2 : 1}
		<Panel title="Câble">
			<div class="row">
				<Field label="Repère">
					<input
						class="control"
						value={cable.tag}
						disabled={ro}
						onchange={(e) => {
							const v = val(e).trim();
							if (v) setCable('Repère du câble', (c) => (c.tag = v));
						}}
					/>
				</Field>
				<Field label="Type">
					<input
						class="control"
						list="cable-types"
						value={cable.type}
						disabled={ro}
						onchange={(e) => setCableType(val(e))}
					/>
					<datalist id="cable-types">
						{#each CABLE_TYPES as t (t.type)}<option value={t.type}>{t.hint}</option>{/each}
					</datalist>
				</Field>
			</div>
			<div class="row">
				<Field label={cable.pairs ? 'Paires' : 'Conducteurs'}>
					<input
						class="control"
						type="number"
						min="1"
						value={cable.colors.length / unit}
						disabled={ro}
						onchange={(e) => {
							const n = Math.max(1, Math.round(Number(val(e))) || 1);
							setCable('Conducteurs du câble', (c) => resizeCable(c, n * unit));
						}}
					/>
				</Field>
				<Field label="Section">
					<input
						class="control"
						value={cable.section ?? ''}
						placeholder="ex. 1,5"
						disabled={ro}
						onchange={(e) => {
							const v = val(e).trim();
							setCable('Section du câble', (c) => (c.section = v || undefined));
						}}
					/>
				</Field>
			</div>
			<div class="row">
				<Field label="Longueur (m)" hint="Liste de commande">
					<input
						class="control"
						type="number"
						min="0"
						step="0.5"
						value={cable.cableLength ?? ''}
						placeholder="—"
						disabled={ro}
						onchange={(e) => {
							const n = Number(val(e).replace(',', '.'));
							setCable('Longueur du câble', (c) => (c.cableLength = n > 0 ? n : undefined));
						}}
					/>
				</Field>
				<Field label="Référence">
					<input
						class="control"
						value={cable.reference ?? ''}
						list="catalog-references"
						placeholder="Catalogue…"
						disabled={ro}
						onchange={(e) => {
							const v = val(e).trim();
							const id = cable.id;
							editor.transact('Référence du câble', (p, f) => {
								const c = f.cables.find((x) => x.id === id);
								if (c) c.reference = v || undefined;
								linkReference(p, v, editor.catalog);
							});
						}}
					/>
				</Field>
			</div>
			<label class="check">
				<input
					type="checkbox"
					checked={cable.pairs}
					disabled={ro}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLInputElement).checked;
						setCable('Câble à paires', (c) => {
							c.pairs = v;
							if (v && c.colors.length % 2) resizeCable(c, c.colors.length + 1);
						});
					}}
				/>
				Câble à paires
			</label>
			<Field label={cable.pairs ? 'Couleurs (une paire par ligne)' : 'Couleurs (une par ligne)'}>
				<textarea
					class="control"
					rows={Math.min(8, Math.max(2, cable.colors.length / unit))}
					value={colorsToLines(cable.colors, cable.pairs).join(NL)}
					disabled={ro}
					onchange={(e) => {
						const lines = (e.currentTarget as HTMLTextAreaElement).value.split(NL);
						setCable('Couleurs du câble', (c) => {
							const colors = linesToColors(lines, c.pairs);
							if (colors.length) c.colors = colors;
						});
					}}></textarea>
			</Field>
			<Field label="Texte affiché">
				<input
					class="control"
					value={cable.name ?? ''}
					placeholder={defaultCableName(cable)}
					disabled={ro}
					onchange={(e) => {
						const v = val(e).trim();
						setCable('Texte du câble', (c) => (c.name = v || undefined));
					}}
				/>
			</Field>
			<label class="check">
				<input
					type="checkbox"
					checked={cable.showColors !== false}
					disabled={ro}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLInputElement).checked;
						setCable('Couleurs affichées', (c) => (c.showColors = v ? undefined : false));
					}}
				/>
				Afficher les couleurs sur le schéma
			</label>
			<Field label="Longueur (mm)">
				<input
					class="control"
					type="number"
					min="5"
					step="2.5"
					value={cable.length}
					disabled={ro}
					onchange={(e) => {
						const n = Number(val(e));
						if (n >= 5) setCable('Longueur du câble', (c) => (c.length = n));
					}}
				/>
			</Field>
			<p class="small" class:warn={!!cableInfo?.overflow}>
				{crossed} fil{crossed > 1 ? 's' : ''} coupé{crossed > 1 ? 's' : ''} ·
				{cable.colors.length} conducteurs{#if cableInfo?.overflow}
					— {cableInfo.overflow} en trop{/if}
			</p>
			<div class="row">
				{#if crossed && crossed !== cable.colors.length}
					<Button
						size="sm"
						disabled={ro}
						onclick={() => setCable('Ajuster le câble', (c) => resizeCable(c, crossed))}
						>Ajuster à {crossed} fils</Button
					>
				{/if}
				<Button size="sm" onclick={() => editor.rotate()} disabled={ro}
					><RotateCw size={14} /> Pivoter</Button
				>
				<Button size="sm" variant="danger" onclick={() => editor.deleteSelection()} disabled={ro}
					><Trash size={14} /></Button
				>
			</div>
		</Panel>
	{:else if rect}
		<Panel title="Cadre">
			<label class="check">
				<input
					type="checkbox"
					checked={!!rect.dashed}
					disabled={ro}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLInputElement).checked;
						const id = rect.id;
						editor.transact('Style du cadre', (_, f) => {
							const r = f.rects.find((x) => x.id === id);
							if (r) r.dashed = v;
						});
					}}
				/>
				Pointillé
			</label>
		</Panel>
	{:else}
		<Panel title="{sel.length} éléments">
			<AlignTools {editor} />
			<div class="row">
				<Button size="sm" onclick={() => editor.rotate()} disabled={ro}
					><RotateCw size={14} /> Pivoter</Button
				>
				<Button size="sm" variant="danger" onclick={() => editor.deleteSelection()} disabled={ro}
					><Trash size={14} /> Supprimer</Button
				>
			</div>
		</Panel>
	{/if}
</aside>

<!-- Références du catalogue (appareil, câble). -->
<datalist id="catalog-references">
	{#each editor.catalog as c (c.id)}<option value={c.reference}
			>{[c.manufacturer, c.designation].filter(Boolean).join(' — ')}</option
		>{/each}
</datalist>

<CatalogItemDialog
	bind:open={() => !!newCatalogItem, (v) => !v && (newCatalogItem = null)}
	initial={newCatalogItem}
	categories={[...new Set(editor.catalog.map((c) => c.category).filter((c): c is string => !!c))]}
	onsaved={(item) => {
		editor.catalogSaved(item);
		if (device) editor.setReference(device.id, item.reference);
	}}
/>

<style>
	.catalog {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin: calc(-1 * var(--sp-1)) 0 0;
	}
	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--c-primary);
		text-decoration: underline;
		cursor: pointer;
		font-size: inherit;
	}
	.inspector {
		width: var(--inspector-w);
		flex-shrink: 0;
		overflow-y: auto;
		background: var(--c-surface);
		border-left: 1px solid var(--c-border);
	}
	.thumb {
		display: flex;
		justify-content: center;
		padding: var(--sp-2);
		background: var(--c-surface-2);
		border-radius: var(--radius);
	}
	.row {
		display: flex;
		gap: var(--sp-2);
		align-items: flex-end;
	}
	.small {
		font-size: var(--fs-sm);
		margin: 0;
	}
	.warn {
		color: var(--c-danger);
		font-weight: var(--fw-medium);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-sm);
		height: var(--control-h);
	}
	.siblings {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.siblings button {
		display: flex;
		justify-content: space-between;
		width: 100%;
		padding: 4px var(--sp-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.siblings button:hover {
		background: var(--c-surface-2);
	}
	.siblings button.current {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
</style>
