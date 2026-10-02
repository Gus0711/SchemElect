<script lang="ts">
	/**
	 * Création / modification d'un symbole maison : image de documentation (ou cadre
	 * titré) + bornes posées EXACTEMENT où l'on clique, déplaçables à la souris et au
	 * clavier, avec zoom pour la précision. Fenêtre de travail presque plein écran, en trois
	 * étapes : image (et retouches), identité / taille, bornes (nommées automatiquement).
	 */
	import type { Dir } from '$lib/model/geometry';
	import Prim from '$lib/render/Prim.svelte';
	import {
		buildCustomSymbol,
		expandNames,
		nearestSide,
		nextTerminalName,
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
		Square,
		Trash,
		Undo2,
		Wand,
		ZoomIn,
		ZoomOut
	} from '@lucide/svelte';
	import { tick, untrack } from 'svelte';
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
		// Bornes sur la grille par défaut : les fils arrivent droits, sans petits décalages.
		snapToGrid: true
	});

	let spec: CustomSymbolSpec = $state(blank());
	let ratio: number | null = $state(null);
	let quickSide: Dir = $state('n');
	/** Noms des prochaines bornes (« 24V, 0V, IP1..IP8 ») : chaque clic prend le suivant. */
	let quickNames = $state('');
	let busy = $state(false);
	let error = $state('');
	let svg: SVGSVGElement | undefined = $state();
	let stageW = $state(800);
	let stageH = $state(500);
	let listEl: HTMLDivElement | undefined = $state();
	/** Borne sélectionnée (index) : surlignée, déplaçable aux flèches. */
	let selected: number | null = $state(null);
	/** Vue de l'aperçu (mm) ; sa hauteur suit les proportions de la zone de dessin. */
	let viewBox = $state({ x: -10, y: -10, w: 80 });
	const view = $derived({ ...viewBox, h: (viewBox.w * stageH) / Math.max(1, stageW) });
	/** Fichier image (bouton « Choisir une image »). */
	let fileInput: HTMLInputElement | undefined = $state();
	/** Outil de l'aperçu : poser les bornes, rogner ou gommer l'image. */
	let tool: 'terminals' | 'crop' | 'erase' = $state('terminals');
	/** Zone en cours de tracé (rogner / gommer), en mm. */
	let region: { x: number; y: number; w: number; h: number } | null = $state(null);
	let processing = $state(false);
	/** Historique des modifications (image, taille, bornes) : Annuler / Ctrl+Z. */
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
		quickNames = '';
		tick().then(() => fit(next.w, next.h));
	});

	const def = $derived(buildCustomSymbol({ ...spec, id: spec.id ?? 'custom-preview' }));
	const canSave = $derived(!!spec.name.trim() && spec.w > 0 && spec.h > 0);
	/** mm par pixel écran : marqueurs et textes de taille constante à l'écran. */
	const mmPerPx = $derived(view.w / Math.max(1, stageW));
	/** Nom de la borne posée au prochain clic. */
	const nextName = $derived(
		expandNames(quickNames)[0] ?? nextTerminalName(spec.terminals.map((t) => t.id))
	);
	const empty = $derived(!spec.image && !spec.title);

	/** Cadre la vue sur le corps du symbole, en occupant toute la zone de dessin. */
	function fit(w = spec.w, h = spec.h) {
		const m = Math.max(w, h) * 0.06 + 2;
		const aspect = stageH / Math.max(1, stageW);
		const vw = Math.max(w + 2 * m, (h + 2 * m) / aspect);
		viewBox = { x: w / 2 - vw / 2, y: h / 2 - (vw * aspect) / 2, w: vw };
	}

	/** Zoom autour du centre de la vue (boutons) ou d'un point (molette). */
	function zoom(k: number, at = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) {
		const w = Math.min(Math.max(view.w * k, 5), 2000);
		const f = w / view.w;
		viewBox = { x: at.x - (at.x - view.x) * f, y: at.y - (at.y - view.y) * f, w };
	}

	// La zone de dessin change de taille (fenêtre redimensionnée) : garder le cadrage.
	let lastStage = '';
	$effect(() => {
		const key = `${stageW}x${stageH}`;
		if (open && key !== lastStage) {
			lastStage = key;
			untrack(() => fit());
		}
	});

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
			if (spec.image) remember();
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
		remember();
		spec.image = undefined;
		ratio = null;
		if (!spec.title) spec.title = spec.name.toUpperCase() || 'MODULE';
	}

	/** Bloc rectangulaire titré, sans image. */
	function blankBlock() {
		if (!spec.name) spec.name = 'Nouveau module';
		spec.title = spec.name.toUpperCase();
	}

	/**
	 * Redimensionne le corps : l'image garde ses proportions ; les bornes sont mises à
	 * l'échelle pour rester sur leurs vis (ou sur les bords d'un cadre).
	 */
	function resizeTo(w: number, h?: number, refit = true) {
		if (refit) remember();
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

	/** Mémorise l'état avant une modification (Annuler). */
	function remember() {
		history.push(snapshotState());
		if (history.length > 100) history.shift();
	}

	function undo() {
		const prev = history.pop();
		if (!prev) return;
		const resized = prev.w !== spec.w || prev.h !== spec.h || prev.image !== spec.image;
		spec.image = prev.image;
		spec.w = prev.w;
		spec.h = prev.h;
		spec.terminals = prev.terminals;
		ratio = prev.ratio;
		selected = null;
		if (resized) fit();
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
			if (history.length > 100) history.shift();
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
			remember();
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
			if (!drag.moved) remember();
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
			viewBox.x = drag.vx - (e.clientX - drag.sx) * mmPerPx;
			viewBox.y = drag.vy - (e.clientY - drag.sy) * mmPerPx;
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
		// Clic dans le vide : nouvelle borne à l'endroit exact, nommée d'après la liste
		// saisie (ou la précédente + 1).
		const p = toMm(e);
		remember();
		const queue = expandNames(quickNames);
		const id = queue.shift() ?? nextTerminalName(spec.terminals.map((t) => t.id));
		quickNames = queue.join(', ');
		spec.terminals.push({
			id,
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
		zoom(Math.exp(e.deltaY * 0.0015), { x: p.x, y: p.y });
	}

	/** Flèches : déplacement fin de la borne sélectionnée (0,1 mm ; Maj : 1 mm). */
	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		const el = e.target as HTMLElement;
		if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			undo();
			return;
		}
		if (e.key === 'Escape') {
			selected = null;
			tool = 'terminals';
			return;
		}
		const tools: Record<string, typeof tool> = { b: 'terminals', r: 'crop', g: 'erase' };
		if (!e.ctrlKey && !e.metaKey && tools[e.key.toLowerCase()]) {
			if (tools[e.key.toLowerCase()] === 'terminals' || spec.image)
				tool = tools[e.key.toLowerCase()];
			return;
		}
		if (selected === null) return;
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
			if (!e.repeat) remember();
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
		const names = expandNames(quickNames);
		if (!names.length) return;
		remember();
		spec.terminals = [...spec.terminals, ...spreadTerminals(names, quickSide, spec.w, spec.h)];
		quickNames = '';
	}

	function removeTerminal(index: number) {
		remember();
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

<Modal
	bind:open
	title={initial ? 'Modifier le symbole' : 'Nouveau symbole'}
	width="min(1600px, 96vw)"
	height="92vh"
	dismissible={false}
>
	<div class="layout">
		<section class="preview">
			<div class="toolbar">
				<input
					bind:this={fileInput}
					class="hidden"
					type="file"
					accept="image/*"
					onchange={(e) => useImage(e.currentTarget.files?.[0])}
				/>
				<Button size="sm" onclick={() => fileInput?.click()}
					><ImagePlus size={14} /> {spec.image ? 'Changer l’image' : 'Choisir une image'}</Button
				>
				{#if spec.image}
					<Button
						size="sm"
						variant="ghost"
						title="Remplacer l’image par un cadre titré"
						onclick={removeImage}><Square size={14} /> Sans image</Button
					>
				{/if}
				<span class="sep"></span>
				<div class="seg" role="group" aria-label="Outil">
					<button
						class:on={tool === 'terminals'}
						title="Poser et déplacer les bornes (B)"
						onclick={() => (tool = 'terminals')}><MousePointer2 size={14} /> Bornes</button
					>
					<button
						class:on={tool === 'crop'}
						disabled={!spec.image}
						title="Garder seulement une partie de l’image (R)"
						onclick={() => (tool = 'crop')}><Crop size={14} /> Rogner</button
					>
					<button
						class:on={tool === 'erase'}
						disabled={!spec.image}
						title="Effacer une zone de l’image : cote, texte… (G)"
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
					title="Annuler la dernière modification (Ctrl+Z)"
					onclick={undo}><Undo2 size={14} /> Annuler ({history.length})</Button
				>
				{#if processing}<span class="muted small">Traitement…</span>{/if}
				<span class="spacer"></span>
				<div class="zoom" role="group" aria-label="Zoom">
					<button title="Zoom arrière" aria-label="Zoom arrière" onclick={() => zoom(1.25)}
						><ZoomOut size={15} /></button
					>
					<button title="Zoom avant" aria-label="Zoom avant" onclick={() => zoom(0.8)}
						><ZoomIn size={15} /></button
					>
					<button title="Voir tout" aria-label="Voir tout" onclick={() => fit()}
						><Maximize size={15} /></button
					>
				</div>
			</div>

			<div
				class="stage"
				class:region-tool={tool !== 'terminals'}
				bind:clientWidth={stageW}
				bind:clientHeight={stageH}
			>
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
						{@const r = 6 * mmPerPx}
						<g class="terminal" class:selected={selected === i} data-terminal={i}>
							<path
								d={exitPath(p, t.dir, 16 * mmPerPx)}
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
								y={p.y - 6 * mmPerPx}
								font-size={13 * mmPerPx}
								font-weight="bold"
								font-family={schematic.font}
								fill={schematic.color.accent}
								paint-order="stroke"
								stroke={schematic.color.paper}
								stroke-width={3 * mmPerPx}>{t.id}</text
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
					{#if !empty}
						<!-- Poignée de redimensionnement (coin bas-droit du corps) -->
						<rect
							class="resize"
							data-resize
							x={spec.w - 6 * mmPerPx}
							y={spec.h - 6 * mmPerPx}
							width={12 * mmPerPx}
							height={12 * mmPerPx}
							stroke-width={1.5 * mmPerPx}
						>
							<title>Redimensionner</title>
						</rect>
					{/if}
				</svg>
				{#if empty}
					<div class="drop">
						<ImagePlus size={40} />
						<strong>Collez une capture de la documentation (Ctrl+V)</strong>
						<span>ou glissez une image ici</span>
						<div class="drop-actions">
							<Button variant="primary" onclick={() => fileInput?.click()}
								><ImagePlus size={16} /> Choisir une image…</Button
							>
							<Button onclick={blankBlock}><Square size={16} /> Bloc sans image</Button>
						</div>
					</div>
				{/if}
			</div>

			<p class="help">
				{#if empty}
					1. Une image de l’appareil (capture de la notice) ou un simple cadre titré.
				{:else if tool === 'crop'}
					<strong>Rogner</strong> : tracez le rectangle à <strong>garder</strong>. Les bornes déjà
					posées restent sur leurs vis. Échap : revenir aux bornes.
				{:else if tool === 'erase'}
					<strong>Gommer</strong> : tracez un rectangle à <strong>effacer</strong> (cote, texte inutile…).
					Échap : revenir aux bornes.
				{:else}
					<strong>Clic</strong> : poser la borne <strong class="next">{nextName}</strong> ·
					<strong>glisser</strong> une borne : la déplacer · <strong>flèches</strong> : ajuster (Maj
					: 1 mm) · <strong>Suppr</strong> : supprimer · <strong>molette</strong> : zoom ·
					<strong>clic droit glissé</strong> : déplacer la vue · <strong>Ctrl+Z</strong> : annuler
				{/if}
			</p>
		</section>

		<aside class="side">
			<section>
				<h3>Identité</h3>
				<Field label="Nom" bind:value={spec.name} placeholder="Sontay IO-RMA" />
				<div class="row">
					<Field label="Catégorie (palette)" bind:value={spec.category} />
					<Field label="Préfixe de repère" bind:value={spec.prefix} placeholder="A" />
				</div>
				{#if !spec.image && !empty}
					<Field label="Titre dans le cadre" bind:value={spec.title} placeholder="SONTAY IO-RMA" />
				{/if}
			</section>

			<section>
				<h3>Taille sur le schéma</h3>
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
						value={spec.h}
						onchange={(e) => resizeTo(spec.w, Number(e.currentTarget.value))}
						disabled={!!ratio}
						hint={ratio ? 'Suit les proportions de l’image' : undefined}
					/>
				</div>
				<label class="check">
					<input type="checkbox" bind:checked={spec.snapToGrid} /> Aligner les bornes sur la grille (2,5
					mm)
				</label>
			</section>

			<section class="terms">
				<h3>Bornes <span class="count">{spec.terminals.length}</span></h3>
				<Field
					label="Noms des prochaines bornes"
					bind:value={quickNames}
					placeholder="24V, 0V, IP1..IP8"
					hint="Chaque clic sur l’image pose la suivante. « IP1..IP8 » = IP1 à IP8. Vide : numérotation automatique."
				/>
				<div class="row spread">
					<span class="small muted">ou d’un coup, réparties sur le côté</span>
					<select bind:value={quickSide} aria-label="Côté">
						{#each SIDES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
					</select>
					<Button size="sm" disabled={!expandNames(quickNames).length} onclick={spread}
						>Répartir</Button
					>
				</div>

				<div class="terminals" bind:this={listEl}>
					<div class="thead">
						<span>Nom</span><span>X (mm)</span><span>Y (mm)</span><span>Sortie du fil</span><span
						></span>
					</div>
					{#each spec.terminals as t, i (i)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="trow" class:selected={selected === i} onclick={() => (selected = i)}>
							<input class="name" bind:value={t.id} aria-label="Nom de la borne" />
							<input type="number" step="0.1" bind:value={t.x} aria-label="X (mm)" />
							<input type="number" step="0.1" bind:value={t.y} aria-label="Y (mm)" />
							<select bind:value={t.dir} title="Côté par lequel le fil sort">
								{#each SIDES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
							</select>
							<button class="del" title="Supprimer" onclick={() => removeTerminal(i)}
								><Trash size={13} /></button
							>
						</div>
					{:else}
						<p class="muted small">Aucune borne : cliquez sur l’image à l’endroit de chaque vis.</p>
					{/each}
				</div>
			</section>
			{#if error}<p class="error">{error}</p>{/if}
		</aside>
	</div>

	{#snippet actions()}
		<span class="footnote muted small">Échap ne ferme pas la fenêtre : utilisez Annuler.</span>
		<Button onclick={() => (open = false)}>Annuler</Button>
		<Button variant="primary" onclick={save} disabled={!canSave || busy}>
			{busy ? 'Enregistrement…' : 'Enregistrer dans la bibliothèque'}
		</Button>
	{/snippet}
</Modal>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 400px;
		gap: var(--sp-4);
		height: 100%;
		min-height: 0;
	}
	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		min-height: 0;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.hidden {
		display: none;
	}
	.sep {
		width: 1px;
		height: 20px;
		background: var(--c-border);
	}
	.spacer {
		flex: 1;
	}
	.help {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--c-text-muted);
	}
	.help .next {
		padding: 0 4px;
		border-radius: var(--radius-sm);
		background: var(--c-primary-soft);
		color: var(--c-primary);
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 200px;
	}
	.stage svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: var(--c-drawing-bg);
		border: 1px solid var(--c-border-strong);
		border-radius: var(--radius);
		cursor: crosshair;
		touch-action: none;
		user-select: none;
	}
	.drop {
		position: absolute;
		inset: var(--sp-4);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		border: 2px dashed var(--c-border-strong);
		border-radius: var(--radius-lg);
		background: var(--c-surface);
		color: var(--c-text-muted);
		text-align: center;
	}
	.drop strong {
		color: var(--c-text);
		font-size: var(--fs-md);
	}
	.drop-actions {
		display: flex;
		gap: var(--sp-2);
		margin-top: var(--sp-2);
	}
	.terminal {
		cursor: move;
	}
	.terminal.selected rect {
		stroke: var(--c-selection);
		stroke-width: 0.4;
	}
	.terminal.selected circle {
		fill: var(--c-selection-fill);
		stroke: var(--c-selection);
		stroke-width: 0.2;
	}
	.seg,
	.zoom {
		display: inline-flex;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.seg button,
	.zoom button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px var(--sp-2);
		border: none;
		background: var(--c-surface);
		font-size: var(--fs-sm);
		cursor: pointer;
	}
	.seg button + button,
	.zoom button + button {
		border-left: 1px solid var(--c-border);
	}
	.seg button.on {
		background: var(--c-primary-soft);
		color: var(--c-primary);
		font-weight: var(--fw-medium);
	}
	.seg button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.zoom button:hover,
	.seg button:hover:not(:disabled):not(.on) {
		background: var(--c-surface-2);
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
		fill: var(--c-danger-soft);
		fill-opacity: 0.6;
		stroke: var(--c-danger);
	}
	.resize {
		fill: var(--c-surface);
		stroke: var(--c-selection);
		cursor: nwse-resize;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
		min-height: 0;
	}
	.side section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding-bottom: var(--sp-3);
		border-bottom: 1px solid var(--c-border);
	}
	.side section.terms {
		flex: 1;
		min-height: 0;
		border-bottom: none;
		padding-bottom: 0;
	}
	h3 {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin: 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--c-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.count {
		padding: 0 6px;
		border-radius: 999px;
		background: var(--c-surface-2);
		color: var(--c-text);
	}
	.row {
		display: flex;
		gap: var(--sp-2);
		align-items: flex-start;
	}
	.row > :global(*) {
		flex: 1;
	}
	.row.spread {
		align-items: center;
	}
	.row.spread > :global(*) {
		flex: 0 0 auto;
	}
	.row.spread span {
		flex: 1;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-sm);
	}
	select,
	.trow input {
		height: 28px;
		min-width: 0;
		padding: 0 var(--sp-1);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
		font-size: var(--fs-sm);
	}
	.terminals {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-height: 120px;
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
		position: sticky;
		top: 0;
		background: var(--c-surface);
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
		margin: 0;
		color: var(--c-danger);
		font-size: var(--fs-sm);
	}
	.footnote {
		margin-right: auto;
		align-self: center;
	}
</style>
