<script lang="ts">
	/**
	 * Folio d'implantation ou de façade : armoire à l'échelle (rails, goulottes, appareils,
	 * cotes) ou porte (grille en cm, axe, voyants et commutateurs). Même rendu à l'écran et
	 * dans le PDF ; les alertes (rail plein, chevauchement) ne sont affichées qu'à l'écran.
	 */
	import { mainSymbolDef } from '$lib/model/footprints';
	import {
		ductLabel,
		isVertical,
		itemLabel,
		itemRect,
		itemsOutside,
		itemTag,
		overlappingItems,
		panelTransform,
		railFill,
		rectToPage,
		scaleLabel,
		toPage
	} from '$lib/model/panel';
	import { TERMINAL_PITCH } from '$lib/model/footprints';
	import type { Panel, PanelItem, Project } from '$lib/model/types';
	import { schematic, signalColor } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let {
		project,
		panel,
		showWarnings = false
	}: { project: Project; panel: Panel; showWarnings?: boolean } = $props();

	const P = schematic.panel;
	const T = P.text;
	const C = schematic.color;
	const cw = schematic.charWidth;

	const t = $derived(panelTransform(panel));
	const enc = $derived(panel.enclosure);
	/** Armoire sur la page. */
	const box = $derived(rectToPage(t, { x: 0, y: 0, w: enc.w, h: enc.h }));
	const fills = $derived(railFill(panel));
	const bad = $derived(
		showWarnings ? new Set([...overlappingItems(panel), ...itemsOutside(panel)]) : new Set<string>()
	);

	const title = $derived(
		panel.kind === 'implantation'
			? `ARMOIRE ${enc.h}H × ${enc.w}L × ${enc.d}P`
			: `FAÇADE — PORTE ${enc.h}H × ${enc.w}L`
	);

	/** Chaîne de cotes verticale (implantation) : haut, axes des rails, bas. */
	const chain = $derived.by(() => {
		const ys = [0, ...panel.rails.map((r) => r.y).sort((a, b) => a - b), enc.h];
		return ys.slice(1).map((y, i) => ({ from: ys[i], to: y }));
	});

	/** Façade : lignes de grille tous les 5 cm, à partir du bord gauche et de l'axe. */
	const STEP = 50;
	const gridX = $derived(
		Array.from({ length: Math.max(0, Math.ceil(enc.w / STEP) - 1) }, (_, i) => (i + 1) * STEP)
	);
	const gridY = $derived.by(() => {
		const out: { y: number; d: number }[] = [];
		for (let d = STEP; d < enc.h / 2; d += STEP)
			out.push({ y: enc.h / 2 - d, d }, { y: enc.h / 2 + d, d });
		return out;
	});
	/** Une étiquette de grille sur deux si les lignes sont trop serrées. */
	const labelEvery = $derived(STEP * t.k < 7 ? 2 : 1);

	const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
	const textW = (s: string, size: number) => s.length * size * cw;

	/** Largeur d'étiquette de façade (mm réels) : l'étiquette passe à la ligne au-delà. */
	const LABEL_W = 50;

	/** Coupe un texte en lignes (3 au plus, la dernière tronquée) pour une largeur donnée. */
	function wrap(text: string, width: number, size: number): string[] {
		const max = Math.max(4, Math.floor(width / (size * cw)));
		const lines: string[] = [];
		let cur = '';
		for (const word of text.split(/\s+/).filter(Boolean)) {
			const next = cur ? `${cur} ${word}` : word;
			if (next.length <= max || !cur) cur = next;
			else {
				lines.push(cur);
				cur = word;
			}
		}
		if (cur) lines.push(cur);
		if (lines.length > 3)
			lines.splice(
				2,
				lines.length,
				`${lines
					.slice(2)
					.join(' ')
					.slice(0, max - 1)}…`
			);
		return lines;
	}

	function shapeOf(item: PanelItem): string {
		if (!item.deviceId) return 'box';
		const defId = mainSymbolDef(project, item.deviceId) ?? '';
		if (defId === 'voyant') return 'pilot';
		if (defId.startsWith('commutateur')) return 'selector';
		if (defId.startsWith('bouton-poussoir')) return 'button';
		if (defId === 'arret-urgence') return 'estop';
		if (defId === 'buzzer') return 'buzzer';
		return 'box';
	}
</script>

{#snippet dim(x1: number, y1: number, x2: number, y2: number, text: string)}
	{@const vertical = Math.abs(x1 - x2) < 0.01}
	{@const tick = 1}
	<g stroke={P.dim} stroke-width={P.dimStroke}>
		<line {x1} {y1} {x2} {y2} />
		<line x1={x1 - tick} y1={y1 + tick} x2={x1 + tick} y2={y1 - tick} />
		<line x1={x2 - tick} y1={y2 + tick} x2={x2 + tick} y2={y2 - tick} />
	</g>
	{#if vertical}
		<Label
			x={x1 - 0.8}
			y={(y1 + y2) / 2}
			{text}
			size={T.dim}
			anchor="middle"
			color={P.dim}
			vertical
		/>
	{:else}
		<Label x={(x1 + x2) / 2} y={y1 - 0.8} {text} size={T.dim} anchor="middle" color={P.dim} />
	{/if}
{/snippet}

<!-- Titre et échelle : verticaux, à gauche (comme le folio d'implantation de référence) -->
<Label
	x={box.x - (panel.kind === 'implantation' ? 26 : 13)}
	y={box.y + box.h / 2}
	text={title}
	size={T.title}
	anchor="middle"
	bold
	vertical
/>
<Label
	x={box.x - (panel.kind === 'implantation' ? 26 : 13) + T.scale + 1}
	y={box.y + box.h / 2}
	text="Échelle {scaleLabel(t.scale)} — cotes en mm{panel.kind === 'facade'
		? ' (grille en cm)'
		: ''}"
	size={T.scale}
	anchor="middle"
	color={C.muted}
	vertical
/>

{#if panel.kind === 'implantation'}
	<!-- Goulottes -->
	{#each panel.ducts as d (d.id)}
		{@const r = rectToPage(t, d)}
		{@const label = ductLabel(d)}
		{@const vert = isVertical(d)}
		<rect
			x={r.x}
			y={r.y}
			width={r.w}
			height={r.h}
			fill={P.ductFill}
			stroke={C.ink}
			stroke-width={P.duct}
		/>
		{#if textW(label, T.duct) < (vert ? r.h : r.w) - 2 && (vert ? r.w : r.h) > T.duct}
			<Label
				x={r.x + r.w / 2 + (vert ? T.duct * 0.35 : 0)}
				y={r.y + r.h / 2 + (vert ? 0 : T.duct * 0.35)}
				text={label}
				size={T.duct}
				anchor="middle"
				vertical={vert}
			/>
		{/if}
	{/each}

	<!-- Rails : bande de 35 mm et axe -->
	{#each fills as f (f.rail.id)}
		{@const r = f.rail}
		{@const a = toPage(t, { x: r.x, y: r.y })}
		{@const len = r.length * t.k}
		{@const band = 35 * t.k}
		<rect
			x={a.x}
			y={a.y - band / 2}
			width={len}
			height={band}
			fill={P.railFill}
			stroke={P.railAxis}
			stroke-width={P.rail}
		/>
		<line
			x1={a.x - 1.5}
			y1={a.y}
			x2={a.x + len + 1.5}
			y2={a.y}
			stroke={P.railAxis}
			stroke-width={P.rail}
			stroke-dasharray={P.axisDash}
		/>
		<Label
			x={box.x - 1.5}
			y={a.y + T.rail * 0.35}
			text={showWarnings
				? `Rail ${fmt(r.length)} · ${Math.round((f.used / Math.max(1, r.length)) * 100)} %`
				: `Rail oméga ${fmt(r.length)}`}
			size={T.rail}
			anchor="end"
			color={showWarnings && f.overflow ? P.warning : P.railAxis}
			bold={showWarnings && f.overflow}
		/>
	{/each}
{:else}
	<!-- Façade : grille en cm et axe -->
	<g stroke={P.grid} stroke-width={P.gridStroke} stroke-dasharray={P.gridDash}>
		{#each gridX as x (x)}
			{@const p = toPage(t, { x, y: 0 })}
			<line x1={p.x} y1={box.y} x2={p.x} y2={box.y + box.h} />
		{/each}
		{#each gridY as g (g.y)}
			{@const p = toPage(t, { x: 0, y: g.y })}
			<line x1={box.x} y1={p.y} x2={box.x + box.w} y2={p.y} />
		{/each}
	</g>
	{#each gridX as x, i (x)}
		{#if (i + 1) % labelEvery === 0}
			<Label
				x={toPage(t, { x, y: 0 }).x}
				y={box.y - 1.2}
				text="{x / 10} cm"
				size={T.grid}
				anchor="middle"
				color={P.grid}
			/>
		{/if}
	{/each}
	{#each gridY as g (g.y)}
		{#if (g.d / STEP) % labelEvery === 0}
			<Label
				x={box.x - 1.5}
				y={toPage(t, { x: 0, y: g.y }).y + T.grid * 0.35}
				text="{g.d / 10} cm"
				size={T.grid}
				anchor="end"
				color={P.grid}
			/>
		{/if}
	{/each}
	<line
		x1={box.x - 3}
		y1={box.y + box.h / 2}
		x2={box.x + box.w + 3}
		y2={box.y + box.h / 2}
		stroke={P.railAxis}
		stroke-width={P.rail * 2}
		stroke-dasharray={P.axisDash}
	/>
{/if}

<!-- Enveloppe (armoire / porte) -->
<rect
	x={box.x}
	y={box.y}
	width={box.w}
	height={box.h}
	fill="none"
	stroke={C.ink}
	stroke-width={P.enclosure}
/>

<!-- Appareils posés -->
{#each panel.items as item (item.id)}
	{@const r = rectToPage(t, itemRect(item))}
	{@const warn = bad.has(item.id)}
	{@const stroke = warn ? P.warning : C.ink}
	{@const tag = itemTag(project, item)}
	{#if panel.kind === 'implantation'}
		<rect
			x={r.x}
			y={r.y}
			width={r.w}
			height={r.h}
			fill={P.deviceFill}
			{stroke}
			stroke-width={warn ? P.device * 2 : P.device}
		/>
		{#if item.strip}
			{@const n = Math.max(0, Math.floor((item.w - 10) / TERMINAL_PITCH))}
			{@const x0 = r.x + 5 * t.k}
			<g stroke={C.ink} stroke-width={P.stripLine}>
				{#each Array.from({ length: n + 1 }, (_, i) => i) as i (i)}
					<line
						x1={x0 + i * TERMINAL_PITCH * t.k}
						y1={r.y + r.h * 0.45}
						x2={x0 + i * TERMINAL_PITCH * t.k}
						y2={r.y + r.h}
					/>
				{/each}
			</g>
			<!-- Bornier étroit : seulement sa lettre (P, C, X…). -->
			<Label
				x={r.x + r.w / 2}
				y={r.y + r.h * 0.3}
				text={textW(tag, T.tag) > r.w - 0.6 ? item.strip : tag}
				size={T.tag}
				anchor="middle"
				bold
			/>
		{:else}
			{@const vertical = textW(tag, T.tag) > r.w - 0.6 && r.h > r.w}
			<Label
				x={r.x + r.w / 2 + (vertical ? T.tag * 0.35 : 0)}
				y={r.y + r.h / 2 + (vertical ? 0 : T.tag * 0.35)}
				text={tag}
				size={T.tag}
				anchor="middle"
				bold
				{vertical}
			/>
		{/if}
	{:else}
		{@const shape = shapeOf(item)}
		{@const cx = r.x + r.w / 2}
		{@const cy = r.y + r.h / 2}
		{@const rad = Math.min(r.w, r.h) / 2}
		{@const device = item.deviceId ? project.devices[item.deviceId] : undefined}
		{@const color = signalColor(device?.value) ?? C.ink}
		{#if shape === 'box'}
			<rect
				x={r.x}
				y={r.y}
				width={r.w}
				height={r.h}
				fill={P.deviceFill}
				{stroke}
				stroke-width={P.device}
			/>
		{:else if shape === 'estop'}
			<circle {cx} {cy} r={rad} fill="#f5c400" {stroke} stroke-width={P.device} />
			<circle {cx} {cy} r={rad * 0.6} fill="#e0241b" stroke={C.ink} stroke-width={P.device} />
		{:else}
			<circle
				{cx}
				{cy}
				r={rad}
				fill={P.deviceFill}
				stroke={warn ? P.warning : shape === 'pilot' ? color : C.ink}
				stroke-width={P.device * 1.6}
			/>
			{#if shape === 'pilot'}
				{@const d = rad * 0.7}
				<g stroke={color} stroke-width={P.device * 1.4}>
					<line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} />
					<line x1={cx - d} y1={cy + d} x2={cx + d} y2={cy - d} />
				</g>
			{:else if shape === 'selector'}
				<g stroke={C.ink} stroke-width={P.device * 2.2} stroke-linecap="round">
					<line x1={cx - rad * 1.3} y1={cy} x2={cx} y2={cy} />
					<line x1={cx - rad * 0.9} y1={cy - rad * 0.9} x2={cx} y2={cy} />
				</g>
			{:else if shape === 'button'}
				<circle {cx} {cy} r={rad * 0.6} fill="none" stroke={C.ink} stroke-width={P.device} />
			{:else if shape === 'buzzer'}
				<g stroke={C.ink} stroke-width={P.device}>
					{#each [-0.4, 0, 0.4] as k (k)}
						<line x1={cx - rad * 0.6} y1={cy + k * rad} x2={cx + rad * 0.6} y2={cy + k * rad} />
					{/each}
				</g>
			{/if}
		{/if}
		<Label x={cx} y={r.y - 0.8} text={tag} size={T.label * 0.85} anchor="middle" color={C.muted} />
		{#each wrap(itemLabel(project, item), Math.max(r.w, LABEL_W * t.k), T.label) as line, i (i)}
			<Label
				x={cx}
				y={r.y + r.h + T.label + 0.4 + i * T.label * 1.15}
				text={line}
				size={T.label}
				anchor="middle"
			/>
		{/each}
	{/if}
{/each}

{#if panel.kind === 'implantation'}
	<!-- Cotes : largeur, hauteur, chaîne des axes de rails -->
	{@render dim(box.x, box.y - 2.5, box.x + box.w, box.y - 2.5, fmt(enc.w))}
	{@render dim(box.x - 18.5, box.y, box.x - 18.5, box.y + box.h, fmt(enc.h))}
	{#each chain as c, i (i)}
		{@const a = toPage(t, { x: enc.w, y: c.from })}
		{@const b = toPage(t, { x: enc.w, y: c.to })}
		{#if b.y - a.y > 0.5}
			{@render dim(a.x + 5, a.y, b.x + 5, b.y, fmt(c.to - c.from))}
		{/if}
	{/each}
{:else}
	{@render dim(box.x + box.w + 5, box.y, box.x + box.w + 5, box.y + box.h, fmt(enc.h))}
{/if}
