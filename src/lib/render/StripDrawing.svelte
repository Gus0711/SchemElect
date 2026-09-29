<script lang="ts">
	/**
	 * Folio borniers dessiné : pour chaque bornier, une rangée de bornes (rail et butées) ;
	 * au-dessus, n° de fil / appareils côté intérieur / position de la borne dans le schéma ;
	 * en dessous, câble / appareils côté extérieur / désignation. Même rendu écran et PDF.
	 */
	import { ellipsize } from '$lib/export/paginate';
	import { bandTop, boxTop, columnX, SD, type StripPageLayout } from '$lib/model/stripDrawing';
	import { AREA } from '$lib/model/layout';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let {
		page,
		message = ''
	}: {
		page: StripPageLayout | null;
		/** Texte affiché si la page est vide (série trop longue, aucun bornier). */
		message?: string;
	} = $props();

	const C = schematic.color;
	const K = schematic.strips;
	const T = K.text;
	const cw = schematic.charWidth;
	/** Longueur disponible pour un texte vertical au-dessus / en dessous des bornes. */
	const LEN = SD.zone - 3;
	const fit = (t: string, size: number) => ellipsize(t, LEN, size, cw);
	/** Trois colonnes de texte vertical par borne. */
	const OFF = [-2.3, 0, 2.3];
</script>

{#if !page || !page.bands.length}
	<Label
		x={AREA.x + AREA.w / 2}
		y={AREA.y + AREA.h / 2}
		text={message || 'Aucun bornier dans le schéma.'}
		size={3}
		anchor="middle"
		color={C.muted}
	/>
{:else}
	{#each page.bands as band, i (i)}
		{@const top = bandTop(i)}
		{@const by = boxTop(i)}
		<!-- Libellés des zones -->
		<Label
			x={AREA.x + 5}
			y={by - SD.zone / 2}
			text="Intérieur"
			size={T.side}
			anchor="middle"
			color={C.muted}
			vertical
		/>
		<Label
			x={AREA.x + 5}
			y={by + SD.box + SD.zone / 2}
			text="Extérieur"
			size={T.side}
			anchor="middle"
			color={C.muted}
			vertical
		/>

		{#each band.segments as seg (`${seg.prefix}-${seg.col}`)}
			{@const x0 = columnX(seg.col) - SD.pitch / 2}
			{@const x1 = columnX(seg.col + seg.rows.length - 1) + SD.pitch / 2}
			<Label
				x={x0}
				y={top + SD.title - 1.5}
				text="Bornier {seg.prefix}{seg.continued ? ' (suite)' : ''}"
				size={T.title}
				bold
			/>
			<!-- Rail et butées -->
			<rect
				x={x0 - 1}
				y={by + SD.box / 2 - 2}
				width={x1 - x0 + 2}
				height={4}
				fill={K.rail}
				stroke="none"
			/>
			<line
				x1={x0 - 0.6}
				y1={by - 1}
				x2={x0 - 0.6}
				y2={by + SD.box + 1}
				stroke={C.ink}
				stroke-width={K.endStop}
			/>
			<line
				x1={x1 + 0.6}
				y1={by - 1}
				x2={x1 + 0.6}
				y2={by + SD.box + 1}
				stroke={C.ink}
				stroke-width={K.endStop}
			/>

			{#each seg.rows as row, k (row.symbolId)}
				{@const x = columnX(seg.col + k)}
				{@const inside = row.inside.join(' · ')}
				{@const outside = row.outside.join(' · ')}
				{@const cable = row.cable.join(' · ')}
				<!-- Liaisons -->
				{#if row.wire || inside}
					<line x1={x} y1={by} x2={x} y2={by - 3} stroke={C.ink} stroke-width={K.link} />
				{/if}
				{#if cable || outside}
					<line
						x1={x}
						y1={by + SD.box}
						x2={x}
						y2={by + SD.box + 3}
						stroke={C.ink}
						stroke-width={K.link}
					/>
				{/if}
				<!-- Borne -->
				<rect
					x={x - SD.boxW / 2}
					y={by}
					width={SD.boxW}
					height={SD.box}
					fill={K.boxFill}
					stroke={C.ink}
					stroke-width={K.box}
				/>
				<Label
					x={x + T.tag * 0.35}
					y={by + SD.box / 2}
					text={row.tag}
					size={T.tag}
					anchor="middle"
					bold
					vertical
				/>
				<!-- Au-dessus : n° de fil, appareils intérieurs, position -->
				<Label
					x={x + OFF[0] + T.wire * 0.35}
					y={by - 4}
					text={fit(row.wire, T.wire)}
					size={T.wire}
					color={C.wireNumber}
					vertical
				/>
				<Label
					x={x + OFF[1] + T.detail * 0.35}
					y={by - 4}
					text={fit(inside, T.detail)}
					size={T.detail}
					vertical
				/>
				<Label
					x={x + OFF[2] + T.detail * 0.35}
					y={by - 4}
					text={fit(`(${row.position})`, T.detail)}
					size={T.detail}
					color={C.accent}
					vertical
				/>
				<!-- En dessous : câble, appareils extérieurs, désignation -->
				<Label
					x={x + OFF[0] + T.wire * 0.35}
					y={by + SD.box + 4}
					text={fit(cable, T.wire)}
					size={T.wire}
					color={C.reference}
					anchor="end"
					vertical
				/>
				<Label
					x={x + OFF[1] + T.detail * 0.35}
					y={by + SD.box + 4}
					text={fit(outside, T.detail)}
					size={T.detail}
					anchor="end"
					vertical
				/>
				<Label
					x={x + OFF[2] + T.detail * 0.35}
					y={by + SD.box + 4}
					text={fit(row.designation, T.detail)}
					size={T.detail}
					color={C.muted}
					anchor="end"
					vertical
				/>
			{/each}
		{/each}
	{/each}
{/if}
