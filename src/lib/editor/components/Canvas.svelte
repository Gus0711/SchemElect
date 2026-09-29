<script lang="ts">
	/** Zone de dessin : rendu du folio (FolioContent) + surcouches d'édition. */
	import { itemBounds } from '$lib/model/edit';
	import { fragmentOrigin } from '$lib/model/fragments';
	import { AREA } from '$lib/model/layout';
	import { panelTransform } from '$lib/model/panel';
	import type { ItemRef } from '$lib/model/types';
	import FolioContent from '$lib/render/FolioContent.svelte';
	import GridLayer from '$lib/render/GridLayer.svelte';
	import SymbolView from '$lib/render/SymbolView.svelte';
	import type { Editor } from '../editor.svelte';
	import type { Interaction } from '../interaction.svelte';
	import FragmentView from './FragmentView.svelte';
	import { ContextMenu } from '$lib/ui';
	import { buildContextMenu } from '../contextMenu';

	let { editor, interaction }: { editor: Editor; interaction: Interaction } = $props();

	let svg: SVGSVGElement;
	let width = $state(0);
	let height = $state(0);
	let fitted = false;

	const vp = $derived(editor.viewport);

	$effect(() => {
		if (!width || !height) return;
		vp.width = width;
		vp.height = height;
		if (!fitted) {
			vp.fit();
			fitted = true;
		}
	});

	const local = (e: MouseEvent) => {
		const r = svg.getBoundingClientRect();
		return [e.clientX - r.left, e.clientY - r.top] as const;
	};

	function onpointerdown(e: PointerEvent) {
		svg.setPointerCapture(e.pointerId);
		(document.activeElement as HTMLElement | null)?.blur?.();
		interaction.pointerDown(e, ...local(e));
	}

	function outline(ref: ItemRef) {
		const b = itemBounds(editor.folio, ref);
		if (!b) return null;
		const m = 1;
		return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m };
	}

	const grid = $derived(editor.grid);

	const tool = $derived(editor.tool);
	const cursor = $derived(editor.cursor);
	const px = $derived(1 / vp.scale);
	const cursorClass = $derived(
		interaction.panning
			? 'grabbing'
			: interaction.overHandle
				? 'resize'
				: interaction.spaceDown
					? 'grab'
					: tool.kind === 'select'
						? 'default'
						: 'crosshair'
	);
</script>

<div class="canvas" bind:clientWidth={width} bind:clientHeight={height}>
	<svg
		bind:this={svg}
		viewBox={vp.viewBox}
		class={cursorClass}
		role="application"
		aria-label="Folio"
		{onpointerdown}
		onpointermove={(e) => interaction.pointerMove(e, ...local(e))}
		onpointerup={() => interaction.pointerUp()}
		onpointerleave={() => interaction.leave()}
		ondblclick={(e) => interaction.doubleClick(...local(e))}
		onwheel={(e) => {
			e.preventDefault();
			interaction.wheel(e, ...local(e));
		}}
		oncontextmenu={(e) => e.preventDefault()}
	>
		<defs> </defs>

		<g class="page-shadow">
			<rect x="0" y="0" width="297" height="210" />
		</g>

		<FolioContent
			project={editor.project}
			folio={editor.folio}
			analysis={editor.analysis}
			showOpenTerminals={editor.showOpenTerminals}
			showWarnings
		/>

		<!-- Grille d'affichage (aide à l'écran, non exportée). Folios d'armoire : cases seulement. -->
		{#if grid.show && (grid.kind === 'cases' || !editor.panel)}
			<GridLayer kind={grid.kind} step={grid.step} opacity={grid.opacity} px={vp.scale} />
		{/if}

		<!-- Surcouches d'édition (non exportées) -->
		<g class="overlay" pointer-events="none">
			{#if interaction.hover && !editor.isSelected(interaction.hover)}
				{@const o = outline(interaction.hover)}
				{#if o}<rect class="hover" x={o.x} y={o.y} width={o.w} height={o.h} />{/if}
			{/if}

			{#each editor.selection as ref (ref.id)}
				{#if ref.kind === 'wire'}
					{@const w = editor.folio.wires.find((x) => x.id === ref.id)}
					{#if w}<polyline
							class="sel-wire"
							points={w.points.map((p) => `${p.x},${p.y}`).join(' ')}
						/>{/if}
				{:else}
					{@const o = outline(ref)}
					{#if o}<rect class="sel" x={o.x} y={o.y} width={o.w} height={o.h} />{/if}
				{/if}
			{/each}

			{#if editor.scaleHandle}
				{@const h = editor.scaleHandle}
				<rect
					class="scale-handle"
					x={h.x - 4 * px}
					y={h.y - 4 * px}
					width={8 * px}
					height={8 * px}
				/>
			{/if}

			{#if interaction.box}
				{@const b = interaction.box}
				<rect class="box {b.mode}" x={b.x} y={b.y} width={b.w} height={b.h} />
			{/if}

			{#if interaction.drawingRect}
				{@const r = interaction.drawingRect}
				<rect class="box inside" x={r.x} y={r.y} width={r.w} height={r.h} />
			{/if}

			{#if interaction.drawingCable}
				{@const c = interaction.drawingCable}
				<ellipse
					class="box inside"
					cx={(c.a.x + c.b.x) / 2}
					cy={(c.a.y + c.b.y) / 2}
					rx={Math.max(Math.abs(c.b.x - c.a.x) / 2, 1.1)}
					ry={Math.max(Math.abs(c.b.y - c.a.y) / 2, 1.1)}
				/>
			{/if}

			{#if interaction.drawingRail}
				{@const r = interaction.drawingRail}
				<line class="wire-preview" x1={r.a.x} y1={r.a.y} x2={r.b.x} y2={r.b.y} />
			{/if}

			{#if interaction.wirePreview.length}
				<polyline
					class="wire-preview"
					points={interaction.wirePreview.map((p) => `${p.x},${p.y}`).join(' ')}
				/>
			{/if}

			{#if cursor && tool.kind === 'place'}
				<SymbolView
					s={{
						id: 'ghost',
						defId: tool.defId,
						deviceId: '',
						x: cursor.x,
						y: cursor.y,
						rotation: tool.rotation,
						mirror: tool.mirror
					}}
					ghost
				/>
			{:else if cursor && tool.kind === 'paste'}
				{@const o = fragmentOrigin(tool.fragment)}
				<g transform="translate({cursor.x - o.x} {cursor.y - o.y})">
					<FragmentView fragment={tool.fragment} ghost />
				</g>
			{:else if cursor && tool.kind === 'mount' && editor.panel}
				{@const k = panelTransform(editor.panel).k}
				{@const c = tool.candidate}
				<rect
					class="box inside"
					x={cursor.x - (c.w * k) / 2}
					y={cursor.y - (c.h * k) / 2}
					width={c.w * k}
					height={c.h * k}
				/>
			{:else if cursor && tool.kind === 'rail' && editor.panel && !interaction.drawingRail}
				<line
					class="wire-preview"
					x1={cursor.x - 8}
					y1={cursor.y}
					x2={cursor.x + 8}
					y2={cursor.y}
				/>
			{:else if cursor && tool.kind === 'bar'}
				<line class="wire-preview" x1={AREA.x} y1={cursor.y} x2={AREA.x + AREA.w} y2={cursor.y} />
			{/if}

			{#if cursor && tool.kind !== 'select' && interaction.snapResult}
				{@const k = interaction.snapResult.kind}
				{#if k === 'grid'}
					<g class="crosshair-mark">
						<line x1={cursor.x - 6 * px} y1={cursor.y} x2={cursor.x + 6 * px} y2={cursor.y} />
						<line x1={cursor.x} y1={cursor.y - 6 * px} x2={cursor.x} y2={cursor.y + 6 * px} />
					</g>
				{:else}
					<circle class="snap {k}" cx={cursor.x} cy={cursor.y} r={5 * px} />
				{/if}
			{/if}
		</g>
	</svg>
</div>

{#if interaction.menu}
	{@const m = interaction.menu}
	<ContextMenu
		x={m.x}
		y={m.y}
		items={buildContextMenu(editor, m.ref, m.at)}
		onclose={() => (interaction.menu = null)}
	/>
{/if}

<style>
	.canvas {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--c-canvas);
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
		user-select: none;
	}
	svg.crosshair {
		cursor: crosshair;
	}
	svg.resize {
		cursor: nwse-resize;
	}
	.scale-handle {
		fill: var(--c-surface);
		stroke: var(--c-selection);
		stroke-width: 1.5;
	}
	svg.grab {
		cursor: grab;
	}
	svg.grabbing {
		cursor: grabbing;
	}
	.page-shadow rect {
		fill: #fff;
		filter: drop-shadow(0 1px 3px var(--c-page-shadow));
	}
	.overlay :global(*) {
		vector-effect: non-scaling-stroke;
	}
	.sel {
		fill: var(--c-selection-fill);
		stroke: var(--c-selection);
		stroke-width: 1.25;
		stroke-dasharray: 4 3;
	}
	.hover {
		fill: none;
		stroke: var(--c-hover);
		stroke-width: 1;
	}
	.sel-wire {
		fill: none;
		stroke: var(--c-selection);
		stroke-width: 5;
		stroke-opacity: 0.35;
		stroke-linejoin: round;
	}
	.box {
		fill: var(--c-selection-fill);
		stroke: var(--c-selection);
		stroke-width: 1;
	}
	.box.touch {
		stroke-dasharray: 5 3;
	}
	.wire-preview {
		fill: none;
		stroke: var(--c-selection);
		stroke-width: 1.5;
		stroke-dasharray: 6 3;
	}
	.snap {
		fill: none;
		stroke: var(--c-success);
		stroke-width: 1.5;
	}
	.snap.terminal {
		stroke: var(--c-danger);
	}
	.crosshair-mark line {
		stroke: var(--c-selection);
		stroke-width: 1;
	}
</style>
