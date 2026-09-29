<script lang="ts">
	/**
	 * Inspecteur d'un folio d'implantation / de façade : armoire (dimensions, échelle,
	 * génération des rails et goulottes) si rien n'est sélectionné, sinon rail, goulotte
	 * ou appareil posé. Toutes les cotes sont en mm réels.
	 */
	import { symbolsOfDevice } from '$lib/model/edit';
	import {
		autoScale,
		defaultLayoutOptions,
		ductLabel,
		generateLayout,
		itemsOutside,
		overlappingItems,
		packRail,
		railFill,
		scaleLabel,
		SCALES,
		type LayoutOptions
	} from '$lib/model/panel';
	import type { Duct, Folio, Mounting, Panel, PanelItem, Rail } from '$lib/model/types';
	import { Button, Field, Panel as Box } from '$lib/ui';
	import { AlignStartVertical, ArrowRight, Trash } from '@lucide/svelte';
	import type { Editor } from '../editor.svelte';
	import ChecksPanel from './ChecksPanel.svelte';

	let { editor }: { editor: Editor } = $props();

	const panel = $derived(editor.panel!);
	const ro = $derived(editor.readonly);
	const single = $derived(editor.selection.length === 1 ? editor.selection[0] : null);
	const rail = $derived(
		single?.kind === 'rail' ? panel.rails.find((r) => r.id === single.id) : undefined
	);
	const duct = $derived(
		single?.kind === 'duct' ? panel.ducts.find((d) => d.id === single.id) : undefined
	);
	const item = $derived(
		single?.kind === 'mount' ? panel.items.find((i) => i.id === single.id) : undefined
	);
	const device = $derived(item?.deviceId ? editor.project.devices[item.deviceId] : undefined);
	const fills = $derived(railFill(panel));
	const fill = $derived(rail ? fills.find((f) => f.rail.id === rail.id) : undefined);
	const isImpl = $derived(panel.kind === 'implantation');

	const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
	const str = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

	/** Modifie le panneau du folio courant (dans une transaction annulable). */
	function change(label: string, fn: (p: Panel, f: Folio) => void) {
		editor.transact(label, (_, f) => f.panel && fn(f.panel, f));
	}

	function setRail<K extends keyof Rail>(key: K, v: Rail[K]) {
		const id = rail!.id;
		change('Modifier le rail', (p) => {
			const r = p.rails.find((x) => x.id === id);
			if (r) r[key] = v;
		});
	}

	function setDuct<K extends keyof Duct>(key: K, v: Duct[K]) {
		const id = duct!.id;
		change('Modifier la goulotte', (p) => {
			const d = p.ducts.find((x) => x.id === id);
			if (d) d[key] = v;
		});
	}

	function setItem<K extends keyof PanelItem>(key: K, v: PanelItem[K]) {
		const id = item!.id;
		change('Modifier l’appareil posé', (p) => {
			const it = p.items.find((x) => x.id === id);
			if (it) it[key] = v;
		});
	}

	function setMounting(v: string) {
		const id = device!.id;
		editor.transact('Montage de l’appareil', (p) => {
			p.devices[id].mounting = (v || undefined) as Mounting | undefined;
		});
	}

	// Génération de la disposition (rails + goulottes)
	let layout: LayoutOptions = $state(defaultLayoutOptions({ w: 600, h: 1000, d: 250 }));
	let layoutFor = '';
	$effect(() => {
		// Proposition recalculée quand on change de folio (pas à chaque frappe).
		const id = editor.folio.id;
		if (id === layoutFor) return;
		layoutFor = id;
		const ducts = panel.ducts;
		const side = ducts.find((d) => d.h > d.w);
		const horiz = ducts.find((d) => d.w >= d.h);
		layout = {
			rails: panel.rails.length || defaultLayoutOptions(panel.enclosure).rails,
			ductW: horiz?.h ?? 40,
			sideW: side?.w ?? 40,
			depth: ducts[0]?.depth ?? 80
		};
	});

	function generate() {
		if (
			panel.rails.length + panel.ducts.length &&
			!confirm('Remplacer les rails et goulottes actuels ? (les appareils posés ne bougent pas)')
		)
			return;
		const opts = { ...layout };
		change('Générer rails et goulottes', (p) => generateLayout(p, opts));
	}

	const warnings = $derived(new Set([...overlappingItems(panel), ...itemsOutside(panel)]));
</script>

{#if rail && fill}
	<Box title="Rail oméga">
		<div class="row">
			<Field label="Axe depuis le haut (mm)">
				<input
					class="control"
					type="number"
					step="5"
					value={rail.y}
					disabled={ro}
					onchange={(e) => setRail('y', num(e))}
				/>
			</Field>
			<Field label="Début (mm)">
				<input
					class="control"
					type="number"
					step="5"
					value={rail.x}
					disabled={ro}
					onchange={(e) => setRail('x', num(e))}
				/>
			</Field>
		</div>
		<Field label="Longueur (mm)">
			<input
				class="control"
				type="number"
				step="5"
				min="20"
				value={rail.length}
				disabled={ro}
				onchange={(e) => setRail('length', Math.max(20, num(e)))}
			/>
		</Field>
		<p class="small" class:warn={fill.overflow}>
			Occupé : {fmt(fill.used)} / {fmt(rail.length)} mm ({fill.items.length} appareil{fill.items
				.length > 1
				? 's'
				: ''})
			{#if fill.overflow}— rail trop plein ou appareil qui dépasse !{:else}— reste {fmt(
					rail.length - fill.used
				)} mm{/if}
		</p>
		<div class="row">
			<Button
				size="sm"
				disabled={ro || !fill.items.length}
				title="Serre les appareils vers la gauche, sans espace"
				onclick={() => change('Serrer le rail', (p) => packRail(p, rail.id))}
				><AlignStartVertical size={14} /> Serrer à gauche</Button
			>
			<Button size="sm" variant="danger" disabled={ro} onclick={() => editor.deleteSelection()}
				><Trash size={14} /></Button
			>
		</div>
		<p class="muted small">Déplacer le rail déplace les appareils posés dessus.</p>
	</Box>
{:else if duct}
	<Box title={ductLabel(duct)}>
		<div class="row">
			<Field label="X (mm)">
				<input
					class="control"
					type="number"
					step="5"
					value={duct.x}
					disabled={ro}
					onchange={(e) => setDuct('x', num(e))}
				/>
			</Field>
			<Field label="Y (mm)">
				<input
					class="control"
					type="number"
					step="5"
					value={duct.y}
					disabled={ro}
					onchange={(e) => setDuct('y', num(e))}
				/>
			</Field>
		</div>
		<div class="row">
			<Field label="Horizontale (mm)">
				<input
					class="control"
					type="number"
					step="5"
					min="10"
					value={duct.w}
					disabled={ro}
					onchange={(e) => setDuct('w', Math.max(10, num(e)))}
				/>
			</Field>
			<Field label="Verticale (mm)">
				<input
					class="control"
					type="number"
					step="5"
					min="10"
					value={duct.h}
					disabled={ro}
					onchange={(e) => setDuct('h', Math.max(10, num(e)))}
				/>
			</Field>
		</div>
		<Field label="Hauteur de goulotte (mm)" hint="Le « H » de « 40L × 80H »">
			<input
				class="control"
				type="number"
				step="5"
				min="10"
				value={duct.depth}
				disabled={ro}
				onchange={(e) => setDuct('depth', Math.max(10, num(e)))}
			/>
		</Field>
	</Box>
{:else if item}
	<Box title={item.strip ? `Bornier ${item.strip}` : (device?.tag ?? 'Appareil')}>
		{#if device}
			<p class="small">{device.designation || 'Sans désignation'}</p>
			{#if device.reference}<p class="muted small">{device.reference}</p>{/if}
		{:else if item.strip}
			<p class="muted small">Largeur calculée : nombre de bornes × 5,2 mm + butées.</p>
		{/if}
		{#if !isImpl}
			<Field label="Étiquette" hint="Vide = désignation de l’appareil">
				<input
					class="control"
					value={item.label ?? ''}
					placeholder={device?.designation || device?.tag}
					disabled={ro}
					onchange={(e) => setItem('label', str(e).trim() || undefined)}
				/>
			</Field>
		{/if}
		<div class="row">
			<Field label={isImpl ? 'Centre X (mm)' : 'X depuis la gauche (mm)'}>
				<input
					class="control"
					type="number"
					step="5"
					value={item.x}
					disabled={ro}
					onchange={(e) => setItem('x', num(e))}
				/>
			</Field>
			<Field label={isImpl ? 'Centre Y (mm)' : 'Y depuis le haut (mm)'}>
				<input
					class="control"
					type="number"
					step="5"
					value={item.y}
					disabled={ro}
					onchange={(e) => setItem('y', num(e))}
				/>
			</Field>
		</div>
		{#if !isImpl}
			{@const axis = item.y - panel.enclosure.h / 2}
			<p class="muted small">
				Perçage : {fmt(item.x / 10)} cm du bord gauche, {fmt(Math.abs(axis) / 10)} cm {axis < 0
					? 'au-dessus'
					: axis > 0
						? 'au-dessous'
						: 'sur'} de l’axe.
			</p>
		{/if}
		<div class="row">
			<Field label={isImpl ? 'Largeur (mm)' : 'Diamètre / largeur (mm)'}>
				<input
					class="control"
					type="number"
					step="1"
					min="5"
					value={item.w}
					disabled={ro || !!item.strip}
					onchange={(e) => setItem('w', Math.max(5, num(e)))}
				/>
			</Field>
			<Field label="Hauteur (mm)">
				<input
					class="control"
					type="number"
					step="1"
					min="5"
					value={item.h}
					disabled={ro}
					onchange={(e) => setItem('h', Math.max(5, num(e)))}
				/>
			</Field>
		</div>
		{#if warnings.has(item.id)}
			<p class="warn small">Chevauche un autre appareil ou sort de l’armoire.</p>
		{/if}
		{#if device}
			{@const s = symbolsOfDevice(editor.project, device.id)[0]}
			<Field label="Montage de l’appareil">
				<select
					value={device.mounting ?? ''}
					disabled={ro}
					onchange={(e) => setMounting((e.currentTarget as HTMLSelectElement).value)}
				>
					<option value="">Automatique (selon le symbole)</option>
					<option value="rail">Sur rail (implantation)</option>
					<option value="porte">En porte (façade)</option>
					<option value="externe">Hors armoire</option>
				</select>
			</Field>
			<div class="row">
				<Button size="sm" disabled={!s} onclick={() => s && editor.goToSymbol(s.id)}
					><ArrowRight size={14} /> Voir dans le schéma</Button
				>
				<Button size="sm" variant="danger" disabled={ro} onclick={() => editor.deleteSelection()}
					><Trash size={14} /></Button
				>
			</div>
		{/if}
	</Box>
{:else}
	<Box title={isImpl ? 'Armoire' : 'Porte (façade)'}>
		<Field label="Titre du folio">
			<input
				class="control"
				value={editor.folio.title}
				disabled={ro}
				onchange={(e) => {
					const v = str(e);
					editor.transact('Renommer le folio', (_, f) => (f.title = v));
				}}
			/>
		</Field>
		<div class="row">
			<Field label="Hauteur H">
				<input
					class="control"
					type="number"
					step="50"
					min="100"
					value={panel.enclosure.h}
					disabled={ro}
					onchange={(e) => {
						const v = Math.max(100, num(e));
						change('Dimensions de l’armoire', (p) => (p.enclosure.h = v));
					}}
				/>
			</Field>
			<Field label="Largeur L">
				<input
					class="control"
					type="number"
					step="50"
					min="100"
					value={panel.enclosure.w}
					disabled={ro}
					onchange={(e) => {
						const v = Math.max(100, num(e));
						change('Dimensions de l’armoire', (p) => (p.enclosure.w = v));
					}}
				/>
			</Field>
			<Field label="Prof. P">
				<input
					class="control"
					type="number"
					step="50"
					min="50"
					value={panel.enclosure.d}
					disabled={ro}
					onchange={(e) => {
						const v = Math.max(50, num(e));
						change('Dimensions de l’armoire', (p) => (p.enclosure.d = v));
					}}
				/>
			</Field>
		</div>
		<Field label="Échelle">
			<select
				value={panel.scale ?? ''}
				disabled={ro}
				onchange={(e) => {
					const v = Number((e.currentTarget as HTMLSelectElement).value) || undefined;
					change('Échelle', (p) => (p.scale = v));
				}}
			>
				<option value="">Automatique ({scaleLabel(autoScale(panel.enclosure))})</option>
				{#each SCALES as s (s)}<option value={s}>{scaleLabel(s)}</option>{/each}
			</select>
		</Field>
		{#if isImpl}
			<p class="muted small">
				{panel.rails.length} rail(s) · {panel.ducts.length} goulotte(s) · {panel.items.length} élément(s)
				posé(s)
			</p>
			<ul class="fills">
				{#each fills as f, i (f.rail.id)}
					<li class:warn={f.overflow}>
						Rail {i + 1} : {fmt(f.used)} / {fmt(f.rail.length)} mm
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted small">
				Grille tous les 5 cm depuis le bord gauche et de part et d’autre de l’axe horizontal.
			</p>
		{/if}
	</Box>
	{#if isImpl}
		<Box title="Rails et goulottes">
			<div class="row">
				<Field label="Rails">
					<input
						class="control"
						type="number"
						min="1"
						max="12"
						bind:value={layout.rails}
						disabled={ro}
					/>
				</Field>
				<Field label="Goulotte haut. H">
					<input
						class="control"
						type="number"
						step="10"
						min="10"
						bind:value={layout.depth}
						disabled={ro}
					/>
				</Field>
			</div>
			<div class="row">
				<Field label="Larg. horizontales">
					<input
						class="control"
						type="number"
						step="10"
						min="0"
						bind:value={layout.ductW}
						disabled={ro}
					/>
				</Field>
				<Field label="Larg. côtés">
					<input
						class="control"
						type="number"
						step="10"
						min="0"
						bind:value={layout.sideW}
						disabled={ro}
					/>
				</Field>
			</div>
			<Button size="sm" disabled={ro} onclick={generate}>Générer rails et goulottes</Button>
			<p class="muted small">
				Une goulotte de chaque côté, en haut, entre les rails et en bas ; rails centrés. Ensuite :
				outils Rail / Goulotte, ou glisser et modifier ici.
			</p>
		</Box>
	{/if}
	<ChecksPanel {editor} />
{/if}

<style>
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
	.fills {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: var(--fs-sm);
		font-variant-numeric: tabular-nums;
	}
</style>
