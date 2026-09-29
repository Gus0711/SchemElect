<script lang="ts">
	import type { CrossRef } from '$lib/model/crossrefs';
	import { symbolAnchor, symbolTerminals } from '$lib/model/symbolGeometry';
	import type { Device, SymbolInstance } from '$lib/model/types';
	import { getSymbolDef } from '$lib/symbols';
	import { customSymbolsVersion } from '$lib/symbols/version.svelte';
	import type { LabelAnchor } from '$lib/symbols/types';
	import { schematic, signalColor } from '$lib/theme/schematic';
	import Label from './Label.svelte';
	import Prim from './Prim.svelte';
	import XrefTable from './XrefTable.svelte';

	let {
		s,
		device,
		xref,
		ghost = false,
		showWarnings = false
	}: {
		s: SymbolInstance;
		device?: Device;
		xref?: CrossRef;
		ghost?: boolean;
		/** Alertes visuelles d'édition (jamais dans le PDF). */
		showWarnings?: boolean;
	} = $props();

	const def = $derived.by(() => {
		void customSymbolsVersion.v;
		return getSymbolDef(s.defId);
	});
	const terminals = $derived.by(() => {
		void def;
		return symbolTerminals(s);
	});
	const signal = $derived(signalColor(device?.value));
	const transform = $derived(
		`translate(${s.x} ${s.y}) rotate(${s.rotation}) scale(${(s.mirror ? -1 : 1) * (s.scale ?? 1)} ${s.scale ?? 1})`
	);
	const at = (a: LabelAnchor) => symbolAnchor(s, a);
	/** Ancre de texte : si le symbole est tourné, un texte « start » reste à droite. */
	const anchorOf = (a: LabelAnchor) =>
		s.rotation === 180 && a.anchor !== 'middle' ? 'end' : (a.anchor ?? 'start');

	const T = schematic.text;
	const markerSize = schematic.terminalMarker.size;

	function terminalLabelPos(t: { x: number; y: number; dir: string }) {
		switch (t.dir) {
			case 'n':
				return { x: t.x + 0.7, y: t.y + 2.3 };
			case 's':
				return { x: t.x + 0.7, y: t.y - 0.9 };
			case 'e':
				return { x: t.x - 0.6, y: t.y - 0.7, anchor: 'end' as const };
			default:
				return { x: t.x + 0.6, y: t.y - 0.7 };
		}
	}
</script>

<g opacity={ghost ? 0.55 : 1}>
	<g {transform}>
		{#each def.graphics as p, i (i)}
			<Prim {p} {signal} scale={s.scale ?? 1} />
		{/each}
	</g>

	{#if schematic.terminalMarker.show}
		{#each terminals as t (t.id)}
			<rect
				x={t.x - markerSize / 2}
				y={t.y - markerSize / 2}
				width={markerSize}
				height={markerSize}
				fill={schematic.color.terminal}
			/>
			{#if !t.hideLabel}
				{@const lp = terminalLabelPos(t)}
				<Label x={lp.x} y={lp.y} text={t.label ?? t.id} size={T.terminal} anchor={lp.anchor} />
			{/if}
		{/each}
	{/if}

	{#if device}
		{#if def.labels.tag}
			{@const p = at(def.labels.tag)}
			<Label
				x={p.x}
				y={p.y}
				text={device.tag}
				size={T.tag}
				anchor={anchorOf(def.labels.tag)}
				bold={def.role === 'terminal'}
			/>
		{/if}
		{#if def.labels.value && device.value}
			{@const p = at(def.labels.value)}
			<Label
				x={p.x}
				y={p.y}
				text={device.value}
				size={T.value}
				anchor={anchorOf(def.labels.value)}
			/>
		{/if}
		{#if def.labels.designation && device.designation}
			{@const p = at(def.labels.designation)}
			<Label
				x={p.x}
				y={p.y}
				text={device.designation}
				size={T.designation}
				anchor={anchorOf(def.labels.designation)}
			/>
		{/if}
		{#if def.labels.reference && device.reference}
			{@const p = at(def.labels.reference)}
			<Label
				x={p.x}
				y={p.y}
				text={device.reference}
				size={T.reference}
				color={schematic.color.reference}
				vertical={def.labels.reference.vertical}
				anchor={anchorOf(def.labels.reference)}
			/>
		{/if}
		{#if def.labels.xref && xref}
			{@const p = at(def.labels.xref)}
			{#if xref.table}
				<XrefTable
					x={p.x}
					y={p.y}
					table={xref.table}
					overflow={showWarnings && xref.usage
						? { no: xref.usage.overflowNo, nc: xref.usage.overflowNc }
						: undefined}
				/>
			{:else if xref.refs?.length}
				<Label
					x={p.x}
					y={p.y}
					text={xref.refs.map((r) => `(${r})`).join(' ')}
					size={T.xref}
					anchor={anchorOf(def.labels.xref)}
					color={def.role === 'link' ? schematic.color.accent : schematic.color.ink}
				/>
			{/if}
		{/if}
	{/if}
</g>
