<script lang="ts">
	/**
	 * Création / modification d'un symbole maison : image de documentation (ou cadre
	 * titré) + bornes posées EXACTEMENT où l'on clique, déplaçables à la souris et au
	 * clavier, avec zoom molette pour la précision.
	 */
	import type { Dir } from '$lib/model/geometry';
	import Prim from '$lib/render/Prim.svelte';
	import {
		buildCustomSymbol,
		nearestSide,
		spreadTerminals,
		terminalPoint,
		type CustomSymbolSpec
	} from '$lib/symbols/custom';
	import { schematic } from '$lib/theme/schematic';
	import { Button, Field, Modal } from '$lib/ui';
	import {
		Crop,
		Eraser,
		ImagePlus,
		Maximize,
		MousePointer2,
		Trash,
		Undo2,
		Wand
	} from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { Editor } from '../editor.svelte';
	import {
		cropImage,
		eraseImage,
		imageFromClipboard,
		prepareImage,
		removeBackground,
		type FracRect,
		type PreparedImage
	} from '../image';

	let {
		editor,
		open = $bindable(false),
		initial = null,
		onsaved
	}: {
		editor: Editor;
		open?: boolean;
		/** Symbole à modifier (sinon création). */
		initial?: CustomSymbolSpec | null;
		onsaved?: (defId: string, created: boolean) => void;
	} = $props();

	const SIDES: { id: Dir; label: string }[] = [
		{ id: 'n', label: 'Haut' },
		{ id: 's', label: 'Bas' },
		{ id: 'w', label: 'Gauche' },
		{ id: 'e', label: 'Droite' }
	];

	const blank = (): CustomSymbolSpec => ({
		name: '',
		category: 'Mes symboles',
		prefix: 'A',
		w: 60,
		h: 40,
		title: '',
		terminals: [],
		snapToGrid: false
	});

	let spec: CustomSymbolSpec = $state(blank());
	let ratio: number | null = $state(null);
	let quickSide: Dir = $state('n');
	let quickNames = $state('');
	let busy = $state(false);
	let error = $state('');
	let svg: SVGSVGElement | undefined = $state();
	let svgWidth = $state(600);
	let listEl: HTMLDivElement | undefined = $state();
	/** Borne sélectionnée (index) : surlignée, déplaçable aux flèches. */
	let selected: number | null = $state(null);
	/** Vue de l'aperçu (mm). */
	let view = $state({ x: -10, y: -10, w: 80, h: 60 });
	/** Outil de l'aperçu : poser les bornes, rogner ou gommer l'image. */
	let tool: 'terminals' | 'crop' | 'erase' = $state('terminals');
	/** Zone en cours de tracé (rogner / gommer), en mm. */
	let region: { x: number; y: number; w: number; h: number } | null = $state(null);
	let processing = $state(false);
	/** Historique des retouches d'image (annuler). */
	type ImageState = Pick<CustomSymbolSpec, 'image' | 'w' | 'h' | 'terminals'> & {
		ratio: number | null;
	};
	let history: ImageState[] = $state([]);

	// Réinitialisation à l'ouverture uniquement : ne lire que `open` et `initial`
	// (lire `spec` ici relancerait l'effet à chaque modification du formulaire).
	$effect(() => {
		if (!open) return;
		const next = initial ? structuredClone($state.snapshot(initial) as CustomSymbolSpec) : blank();
		spec = next;
		ratio = next.image ? next.h / next.w : null;
		selected = null;
		error = '';
		tool = 'terminals';
		history = [];
		fit(next.w, next.h);
	});

	const def = $derived(buildCustomSymbol({ ...spec, id: spec.id ?? 'custom-preview' }));
	const canSave = $derived(!!spec.name.trim() && spec.w > 0 && spec.h > 0);
	/** mm par pixel écran : marqueurs et textes de taille constante à l'écran. */
	const mmPerPx = $derived(view.w / Math.max(1, svgWidth));

	function fit(w = spec.w, h = spec.h) {
		const m = Math.max(w, h) * 0.04 + 3;
		view = { x: -m, y: -m, w: w + 2 * m, h: h + 2 * m };
	}

	const round1 = (v: number) => Math.round(v * 10) / 10;

	function toMm(e: MouseEvent) {
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg!.getScreenCTM()!.inverse());
		return { x: round1(p.x), y: round1(p.y) };
	}

	// ------------------------------------------------------------ image

	async function useImage(file: Blob | null | undefined) {
		if (!file) return;
		try {
			const img = await prepareImage(file);
			const oldH = spec.h;
			spec.image = img.href;
			ratio = img.ratio;
			spec.h = round1(spec.w * img.ratio);
			// Les bornes déjà posées suivent le changement de hauteur.
			if (oldH) for (const t of spec.terminals) t.y = round1((t.y * spec.h) / oldH);
			if (!spec.name) spec.name = 'Nouveau module';
			fit();
		} catch (e) {
			error = (e as Error).message;
		}
	}

	function removeImage() {
		spec.image = undefined;
		ratio = null;
	}

	/**
	 * Redimensionne le corps : l'image garde ses proportions ; les bornes sont mises à
	 * l'échelle pour rester sur leurs vis (ou sur les bords d'un cadre).
	 */
	function resizeTo(w: number, h?: number, refit = true) {
		const nw = Math.max(5, round1(w || 5));
		const nh = ratio ? round1(nw * ratio) : Math.max(5, round1(h ?? spec.h));
		const kx = nw / spec.w,
			ky = nh / spec.h;
		spec.w = nw;
		spec.h = nh;
		for (const t of spec.terminals) {
			t.x = round1(t.x * kx);
			t.y = round1(t.y * ky);
		}
		if (refit) fit();
	}

	function setWidth(w: number) {
		resizeTo(w);
	}

	// ------------------------------------------------------------ retouches d'image

	const snapshotState = (): ImageState =>
		$state.snapshot({
			image: spec.image,
			w: spec.w,
			h: spec.h,
			terminals: spec.terminals,
			ratio
		}) as ImageState;

	function undoImage() {
		const prev = history.pop();
		if (!prev) return;
		spec.image = prev.image;
		spec.w = prev.w;
		spec.h = prev.h;
		spec.terminals = prev.terminals;
		ratio = prev.ratio;
		fit();
	}

	/** Applique une retouche (asynchrone) avec annulation possible. */
	async function retouch(
		op: (href: string) => Promise<PreparedImage>,
		after?: (img: PreparedImage) => void
	) {
		if (!spec.image || processing) return;
		processing = true;
		try {
			const before = snapshotState();
			const img = await op(spec.image);
			history.push(before);
			spec.image = img.href;
			after?.(img);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			processing = false;
		}
	}

	const toFrac = (r: { x: number; y: number; w: number; h: number }): FracRect => ({
		x: r.x / spec.w,
		y: r.y / spec.h,
		w: r.w / spec.w,
		h: r.h / spec.h
	});

	/** Rogner : même échelle (mm par pixel), les bornes restent sur leurs vis. */
	function crop(r: { x: number; y: number; w: number; h: number }) {
		retouch(
			(href) => cropImage(href, toFrac(r)),
			(img) => {
				ratio = img.ratio;
				spec.w = round1(r.w);
				spec.h = round1(r.w * img.ratio);
				for (const t of spec.terminals) {
					t.x = round1(t.x - r.x);
					t.y = round1(t.y - r.y);
				}
				fit();
			}
		);
	}

	function erase(r: { x: number; y: number; w: number; h: number }) {
		retouch((href) => eraseImage(href, toFrac(r)));
	}

	/** Zone tracée, bornée au corps de l'image. */
	function clampRegion(a: { x: number; y: number }, b: { x: number; y: number }) {
		const x1 = Math.max(0, Math.min(a.x, b.x)),
			y1 = Math.max(0, Math.min(a.y, b.y));
		const x2 = Math.min(spec.w, Math.max(a.x, b.x)),
			y2 = Math.min(spec.h, Math.max(a.y, b.y));
		return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
	}

	// ------------------------------------------------------------ souris

	type Drag =
		| { kind: 'none' }
		| { kind: 'move'; index: number; moved: boolean }
		| { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
		| { kind: 'pending'; sx: number; sy: number }
		| { kind: 'region'; start: { x: number; y: number } }
		| { kind: 'resize' };
	let drag: Drag = { kind: 'none' };

	function onpointerdown(e: PointerEvent) {
		svg!.setPointerCapture(e.pointerId);
		if (e.button === 1 || e.button === 2) {
			drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
			return;
		}
		if ((e.target as Element).closest('[data-resize]')) {
			drag = { kind: 'resize' };
			return;
		}
		if (tool !== 'terminals' && spec.image) {
			const p = toMm(e);
			drag = { kind: 'region', start: p };
			region = clampRegion(p, p);
			return;
		}
		const target = (e.target as Element).closest('[data-terminal]');
		if (target) {
			const index = Number(target.getAttribute('data-terminal'));
			selected = index;
			drag = { kind: 'move', index, moved: false };
			return;
		}
		drag = { kind: 'pending', sx: e.clientX, sy: e.clientY };
	}

	function onpointermove(e: PointerEvent) {
		if (drag.kind === 'move') {
			const p = toMm(e);
			const t = spec.terminals[drag.index];
			t.x = p.x;
			t.y = p.y;
			drag.moved = true;
		} else if (drag.kind === 'region') {
			region = clampRegion(drag.start, toMm(e));
		} else if (drag.kind === 'resize') {
			const p = toMm(e);
			resizeTo(p.x, p.y, false);
		} else if (drag.kind === 'pan') {
			view.x = drag.vx - (e.clientX - drag.sx) * mmPerPx;
			view.y = drag.vy - (e.clientY - drag.sy) * mmPerPx;
		}
	}

	async function onpointerup(e: PointerEvent) {
		const d = drag;
		drag = { kind: 'none' };
		if (d.kind === 'resize') {
			fit();
			return;
		}
		if (d.kind === 'region') {
			const r = region;
			region = null;
			if (r && r.w > 1 && r.h > 1) {
				if (tool === 'crop') crop(r);
				else erase(r);
			}
			return;
		}
		if (d.kind !== 'pending' || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) return;
		// Clic dans le vide : nouvelle borne à l'endroit exact.
		const p = toMm(e);
		spec.terminals.push({
			id: String(spec.terminals.length + 1),
			x: p.x,
			y: p.y,
			dir: nearestSide(spec.w, spec.h, p.x, p.y)
		});
		selected = spec.terminals.length - 1;
		await tick();
		focusName(selected);
	}

	function onwheel(e: WheelEvent) {
		e.preventDefault();
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg!.getScreenCTM()!.inverse());
		const k = Math.exp(e.deltaY * 0.0015);
		const w = Math.min(Math.max(view.w * k, 5), 2000);
		const f = w / view.w;
		view = { x: p.x - (p.x - view.x) * f, y: p.y - (p.y - view.y) * f, w, h: view.h * f };
	}

	/** Flèches : déplacement fin de la borne sélectionnée (0,1 mm ; Maj : 1 mm). */
	function onkeydown(e: KeyboardEvent) {
		if (selected === null || !open) return;
		const el = e.target as HTMLElement;
		if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
		const step = e.shiftKey ? 1 : 0.1;
		const t = spec.terminals[selected];
		if (!t) return;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		if (e.key in moves) {
			e.preventDefault();
			t.x = round1(t.x + moves[e.key][0]);
			t.y = round1(t.y + moves[e.key][1]);
		} else if (e.key === 'Delete') {
			e.preventDefault();
			removeTerminal(selected);
		}
	}

	function focusName(index: number) {
		const inputs = listEl?.querySelectorAll<HTMLInputElement>('input.name');
		inputs?.[index]?.select();
	}

	// ------------------------------------------------------------ liste

	function spread() {
		const names = quickNames
			.split(/[,;]/)
			.map((n) => n.trim())
			.filter(Boolean);
		if (!names.length) return;
		spec.terminals = [...spec.terminals, ...spreadTerminals(names, quickSide, spec.w, spec.h)];
		quickNames = '';
	}

	function removeTerminal(index: number) {
		spec.terminals = spec.terminals.filter((_, i) => i !== index);
		selected = null;
	}

	async function save() {
		busy = true;
		error = '';
		try {
			const created = !spec.id;
			const saved = await editor.saveCustomSymbol(
				buildCustomSymbol($state.snapshot(spec) as CustomSymbolSpec)
			);
			open = false;
			onsaved?.(saved.id, created);
		} catch (e) {
			error = (e as Error).message || 'Enregistrement impossible';
		} finally {
			busy = false;
		}
	}

	/** Petite flèche indiquant la sortie du fil. */
	function exitPath(p: { x: number; y: number }, dir: Dir, len: number) {
		const [dx, dy] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir];
		return `M ${p.x} ${p.y} L ${p.x + dx * len} ${p.y + dy * len}`;
	}
</script>

<svelte:window
	{onkeydown}
	onpaste={(e) => {
		if (!open) return;
		const file = imageFromClipboard(e);
		if (file) {
			e.preventDefault();
			useImage(file);
		}
	}}
/>

<Modal bind:open title={initial ? 'Modifier le symbole' : 'Nouveau symbole'} width="1100px">
	<div class="layout">
		<div class="preview">
			<p class="muted hint">
				{#if !spec.image && !spec.title}
					Collez (Ctrl+V) une capture de la documentation, déposez une image, ou donnez un titre
					pour un bloc rectangulaire.
				{:else if tool === 'crop'}
					<strong>Tracez le rectangle à conserver</strong> (les cotes et le blanc autour seront supprimés).
					Les bornes déjà posées restent sur leurs vis.
				{:else if tool === 'erase'}
					<strong>Tracez un rectangle à effacer</strong> (une cote qui traverse l'appareil, un texte inutile…).
				{:else}
					<strong>Clic</strong> : poser une borne à cet endroit · <strong>glisser</strong> une borne
					: la déplacer · <strong>flèches</strong> : ajuster (0,1 mm, Maj 1 mm) ·
					<strong>molette</strong>
					: zoom · clic droit glissé : déplacer la vue · <strong>coin bas-droit</strong> : redimensionner
				{/if}
			</p>
			{#if spec.image || spec.title}
				<div class="tools">
					<div class="seg" role="group" aria-label="Outil">
						<button class:on={tool === 'terminals'} onclick={() => (tool = 'terminals')}
							><MousePointer2 size={14} /> Bornes</button
						>
						<button
							class:on={tool === 'crop'}
							disabled={!spec.image}
							onclick={() => (tool = 'crop')}><Crop size={14} /> Rogner</button
						>
						<button
							class:on={tool === 'erase'}
							disabled={!spec.image}
							onclick={() => (tool = 'erase')}><Eraser size={14} /> Gommer</button
						>
					</div>
					<Button
						size="sm"
						variant="ghost"
						disabled={!spec.image || processing}
						title="Rend le fond blanc transparent (les fils et le schéma restent visibles)"
						onclick={() => retouch((href) => removeBackground(href))}
						><Wand size={14} /> Fond transparent</Button
					>
					<Button
						size="sm"
						variant="ghost"
						disabled={!history.length || processing}
						title="Annuler la dernière retouche d'image"
						onclick={undoImage}><Undo2 size={14} /> Annuler ({history.length})</Button
					>
					{#if processing}<span class="muted small">Traitement…</span>{/if}
				</div>
			{/if}
			<div class="stage" class:region-tool={tool !== 'terminals'} bind:clientWidth={svgWidth}>
				<svg
					bind:this={svg}
					viewBox="{view.x} {view.y} {view.w} {view.h}"
					role="application"
					aria-label="Aperçu du symbole"
					{onpointerdown}
					{onpointermove}
					{onpointerup}
					{onwheel}
					oncontextmenu={(e) => e.preventDefault()}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						useImage(e.dataTransfer?.files[0]);
					}}
				>
					{#each def.graphics as p, i (i)}
						<Prim {p} />
					{/each}
					{#each spec.terminals as t, i (i)}
						{@const p = terminalPoint(spec, t)}
						{@const r = 5 * mmPerPx}
						<g class="terminal" class:selected={selected === i} data-terminal={i}>
							<path
								d={exitPath(p, t.dir, 14 * mmPerPx)}
								stroke={schematic.color.terminal}
								stroke-width={1.5 * mmPerPx}
							/>
							<circle cx={p.x} cy={p.y} r={r * 1.8} fill="transparent" />
							<rect
								x={p.x - r / 2}
								y={p.y - r / 2}
								width={r}
								height={r}
								fill={schematic.color.terminal}
							/>
							<text
								x={p.x + 7 * mmPerPx}
								y={p.y - 5 * mmPerPx}
								font-size={11 * mmPerPx}
								font-family={schematic.font}
								fill={schematic.color.accent}>{t.id}</text
							>
						</g>
					{/each}
					{#if region}
						<rect
							class="region {tool}"
							x={region.x}
							y={region.y}
							width={region.w}
							height={region.h}
							stroke-width={1.5 * mmPerPx}
							stroke-dasharray="{6 * mmPerPx} {4 * mmPerPx}"
						/>
					{/if}
					<!-- Poignée de redimensionnement (coin bas-droit du corps) -->
					<rect
						class="resize"
						data-resize
						x={spec.w - 5 * mmPerPx}
						y={spec.h - 5 * mmPerPx}
						width={10 * mmPerPx}
						height={10 * mmPerPx}
						stroke-width={1.5 * mmPerPx}
					>
						<title>Redimensionner</title>
					</rect>
				</svg>
				<button class="fit" title="Voir tout" onclick={() => fit()}><Maximize size={14} /></button>
			</div>
			<div class="row left">
				<label class="file">
					<ImagePlus size={16} />
					<span>{spec.image ? 'Changer l’image' : 'Choisir une image'}</span>
					<input
						type="file"
						accept="image/*"
						onchange={(e) => useImage(e.currentTarget.files?.[0])}
					/>
				</label>
				{#if spec.image}
					<Button size="sm" variant="ghost" onclick={removeImage}
						>Retirer l’image (bloc rectangulaire)</Button
					>
				{/if}
			</div>
		</div>

		<div class="form">
			<Field label="Nom" bind:value={spec.name} placeholder="Sontay IO-RMA" />
			<div class="row">
				<Field label="Catégorie (palette)" bind:value={spec.category} />
				<Field label="Préfixe de repère" bind:value={spec.prefix} placeholder="A" />
			</div>
			{#if !spec.image}
				<Field label="Titre dans le cadre" bind:value={spec.title} placeholder="SONTAY IO-RMA" />
			{/if}
			<div class="row">
				<Field
					label="Largeur (mm)"
					type="number"
					min="5"
					step="0.5"
					value={spec.w}
					onchange={(e) => setWidth(Number(e.currentTarget.value))}
				/>
				<Field
					label="Hauteur (mm)"
					type="number"
					min="5"
					step="0.5"
					bind:value={spec.h}
					disabled={!!ratio}
					hint={ratio ? 'Suit les proportions de l’image' : undefined}
				/>
			</div>
			<label class="check">
				<input type="checkbox" bind:checked={spec.snapToGrid} /> Aligner les bornes sur la grille (2,5
				mm)
			</label>

			<fieldset>
				<legend>Ajout rapide d'une rangée (à ajuster ensuite à la souris)</legend>
				<div class="row">
					<select bind:value={quickSide}>
						{#each SIDES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
					</select>
					<input
						class="quick"
						placeholder="24V, 0V, 0V, IP"
						bind:value={quickNames}
						onkeydown={(e) => e.key === 'Enter' && spread()}
					/>
					<Button size="sm" onclick={spread}>Ajouter</Button>
				</div>
			</fieldset>

			<div class="terminals" bind:this={listEl}>
				<div class="thead">
					<span>Borne</span><span>X (mm)</span><span>Y (mm)</span><span>Sortie</span><span></span>
				</div>
				{#each spec.terminals as t, i (i)}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div class="trow" class:selected={selected === i} onclick={() => (selected = i)}>
						<input class="name" bind:value={t.id} />
						<input type="number" step="0.1" bind:value={t.x} />
						<input type="number" step="0.1" bind:value={t.y} />
						<select bind:value={t.dir} title="Côté par lequel le fil sort">
							{#each SIDES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
						</select>
						<button class="del" title="Supprimer" onclick={() => removeTerminal(i)}
							><Trash size={13} /></button
						>
					</div>
				{:else}
					<p class="muted">Aucune borne : cliquez sur l'image à l'endroit de chaque borne.</p>
				{/each}
			</div>
			{#if error}<p class="error">{error}</p>{/if}
		</div>
	</div>

	{#snippet actions()}
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" onclick={save} disabled={!canSave || busy}>
			{busy ? 'Enregistrement…' : 'Enregistrer dans la bibliothèque'}
		</Button>
	{/snippet}
</Modal>

<style>
	.layout {
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: var(--sp-4);
		min-height: 480px;
	}
	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
	}
	.hint {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 420px;
	}
	.stage svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: var(--c-surface-2);
		border: 1px dashed var(--c-border-strong);
		border-radius: var(--radius);
		cursor: crosshair;
		touch-action: none;
		user-select: none;
	}
	.terminal {
		cursor: move;
	}
	.terminal.selected rect {
		outline: none;
		stroke: var(--c-selection);
		stroke-width: 0.4;
	}
	.terminal.selected circle {
		fill: var(--c-selection-fill);
		stroke: var(--c-selection);
		stroke-width: 0.2;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.seg button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px var(--sp-2);
		border: none;
		background: var(--c-surface);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.seg button + button {
		border-left: 1px solid var(--c-border);
	}
	.seg button.on {
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
	.seg button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.small {
		font-size: var(--fs-xs);
	}
	.region-tool svg {
		cursor: cell;
	}
	.region {
		fill: var(--c-selection-fill);
		stroke: var(--c-selection);
	}
	.region.erase {
		fill: rgba(217, 45, 32, 0.12);
		stroke: var(--c-danger);
	}
	.resize {
		fill: var(--c-surface);
		stroke: var(--c-selection);
		cursor: nwse-resize;
	}
	.fit {
		position: absolute;
		top: var(--sp-2);
		right: var(--sp-2);
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		cursor: pointer;
	}
	.file {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-1) var(--sp-3);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		cursor: pointer;
		font-size: var(--fs-sm);
	}
	.file input {
		display: none;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}
	.row {
		display: flex;
		gap: var(--sp-2);
		align-items: flex-end;
	}
	.row:not(.left) > :global(*) {
		flex: 1;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-sm);
	}
	fieldset {
		margin: 0;
		padding: var(--sp-2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	legend {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	select,
	input.quick,
	.trow input {
		height: 28px;
		min-width: 0;
		padding: 0 var(--sp-1);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-sm);
	}
	fieldset select {
		flex: 0 0 90px;
	}
	.terminals {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 260px;
		overflow-y: auto;
	}
	.thead,
	.trow {
		display: grid;
		grid-template-columns: 1fr 64px 64px 80px 24px;
		gap: var(--sp-1);
		align-items: center;
	}
	.trow {
		padding: 1px;
		border-radius: var(--radius-sm);
	}
	.trow.selected {
		background: var(--c-primary-soft);
	}
	.thead {
		font-size: var(--fs-xs);
		color: var(--c-text-muted);
	}
	.del {
		border: none;
		background: transparent;
		color: var(--c-text-muted);
		cursor: pointer;
	}
	.del:hover {
		color: var(--c-danger);
	}
	.error {
		color: var(--c-danger);
		font-size: var(--fs-sm);
	}
</style>
