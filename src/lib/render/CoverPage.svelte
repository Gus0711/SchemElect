<script lang="ts">
	/**
	 * Page de garde du dossier (A4 paysage, mm) — reproduit exemple_schema/png/p13.png :
	 * à gauche le sommaire, à droite société, titre, indices, n° d'affaire / plan / nb de folios.
	 */
	import { ellipsize, wrapText } from '$lib/export/paginate';
	import { PAGE, folioNumber } from '$lib/model/layout';
	import type { Project } from '$lib/model/types';
	import { schematic } from '$lib/theme/schematic';
	import Label from './Label.svelte';

	let {
		project,
		entries,
		folioCount,
		width = `${PAGE.w}mm`,
		height = `${PAGE.h}mm`
	}: {
		project: Project;
		/** Sommaire ; par défaut les folios du projet. */
		entries?: { number: string; title: string }[];
		/** « NB DE FOLIOS » ; par défaut le nombre d'entrées du sommaire. */
		folioCount?: number;
		width?: string;
		height?: string;
	} = $props();

	const C = schematic.color;
	const T = schematic.text.cover;
	const K = schematic.cover;
	const TB = schematic.table;
	const cw = schematic.charWidth;
	const box = { rx: K.radius, fill: 'none', stroke: C.frame, 'stroke-width': K.stroke };
	const thin = { stroke: C.ink, 'stroke-width': TB.stroke };

	const meta = $derived(project.meta);
	const list = $derived(
		entries ?? project.folios.map((f, i) => ({ number: folioNumber(i), title: f.title }))
	);
	const count = $derived(folioCount ?? list.length);

	// ------------------------------------------------ géométrie (mm)
	const M = 16.5;
	const GAP = 5;
	const colW = (PAGE.w - 2 * M - GAP) / 2;
	const left = { x: M, y: M, w: colW, h: PAGE.h - 2 * M };
	const rx = M + colW + GAP;
	const bottom = PAGE.h - M;

	// Sommaire : ligne d'en-tête « Folio | Nom » en bas, comme WinRelais.
	const sumX = left.x + 8;
	const sumW = left.w - 16;
	const sumNumW = 12.5;
	const sumRowH = $derived(Math.min(4.1, (left.h - 10) / (list.length + 1)));
	const sumSize = $derived(Math.min(T.summary, sumRowH * 0.68));
	const sumH = $derived(sumRowH * (list.length + 1));
	const sumY = $derived(left.y + Math.max(5, (left.h - sumH) / 4));

	// Indices : 3 lignes minimum ; au-delà de 8, les plus récents.
	const rowH = 8;
	const revRows = $derived.by(() => {
		const revs = project.revisions.slice(-8);
		return [
			...revs,
			...Array.from({ length: Math.max(0, 3 - revs.length) }, (_, i) => ({
				indice: String.fromCharCode(65 + revs.length + i),
				description: '',
				date: ''
			}))
		];
	});
	const footerH = 12;
	const spacer = 4;
	const revBox = $derived.by(() => {
		const h = rowH * (revRows.length + 1) + spacer + footerH;
		return { x: rx, y: bottom - h, w: colW, h };
	});
	const revCols = { indice: 25, date: 37 };
	const footCols = [0, 45, 95];
	const xMod = rx + revCols.indice;
	const xDate = rx + colW - revCols.date;
	const revBottom = $derived(revBox.y + rowH * (revRows.length + 1));
	const fy = bottom - footerH;

	// Blocs société et titre : se partagent la hauteur restante.
	const upper = $derived(revBox.y - GAP - M);
	const companyBox = $derived({ x: rx, y: M, w: colW, h: (upper - GAP) * 0.55 });
	const titleBox = $derived({
		x: rx,
		y: M + companyBox.h + GAP,
		w: colW,
		h: upper - GAP - companyBox.h
	});

	const companyLines = $derived(wrapText(meta.company, colW - 12, T.company, cw).slice(0, 3));
	const addressLines = $derived(
		wrapText(meta.companyAddress, colW - 12, T.address, cw).slice(0, 3)
	);
	const titleLines = $derived(wrapText(meta.name, colW - 12, T.title, cw).slice(0, 3));

	function stackY(b: { y: number; h: number }, blocks: { n: number; size: number }[], gap: number) {
		const lh = (s: number) => s * 1.2;
		const total =
			blocks.reduce((a, bl) => a + bl.n * lh(bl.size), 0) +
			gap * (blocks.filter((bl) => bl.n).length - 1);
		let y = b.y + (b.h - total) / 2;
		return blocks.map((bl) => {
			const ys = Array.from({ length: bl.n }, (_, i) => y + lh(bl.size) * i + bl.size);
			if (bl.n) y += bl.n * lh(bl.size) + gap;
			return ys;
		});
	}

	const companyY = $derived(
		stackY(
			companyBox,
			[
				{ n: companyLines.length, size: T.company },
				{ n: addressLines.length, size: T.address }
			],
			4
		)
	);
	const titleY = $derived(
		stackY(
			titleBox,
			[
				{ n: titleLines.length, size: T.title },
				{ n: meta.client ? 1 : 0, size: T.client }
			],
			4
		)
	);
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE.w} {PAGE.h}" {width} {height}>
	<rect x={0} y={0} width={PAGE.w} height={PAGE.h} fill={C.paper} />

	<!-- Sommaire -->
	<rect x={left.x} y={left.y} width={left.w} height={left.h} {...box} />
	{#each list as e, i (i)}
		{@const y = sumY + i * sumRowH}
		<Label x={sumX + 1.5} y={y + sumRowH - 0.9} text={e.number} size={sumSize} />
		<Label
			x={sumX + sumNumW + 2}
			y={y + sumRowH - 0.9}
			text={ellipsize(e.title.toUpperCase(), sumW - sumNumW - 3, sumSize, cw)}
			size={sumSize}
		/>
		<line x1={sumX} y1={y + sumRowH} x2={sumX + sumW} y2={y + sumRowH} {...thin} />
	{/each}
	<Label x={sumX + 1} y={sumY + sumH - 0.9} text="Folio" size={sumSize} bold />
	<Label x={sumX + sumNumW + 2} y={sumY + sumH - 0.9} text="Nom" size={sumSize} bold />
	<line
		x1={sumX + sumNumW}
		y1={sumY}
		x2={sumX + sumNumW}
		y2={sumY + sumH}
		stroke={C.ink}
		stroke-width={K.tableStroke}
	/>
	<rect
		x={sumX}
		y={sumY}
		width={sumW}
		height={sumH}
		fill="none"
		stroke={C.ink}
		stroke-width={K.tableStroke}
	/>

	<!-- Société -->
	<rect x={companyBox.x} y={companyBox.y} width={companyBox.w} height={companyBox.h} {...box} />
	{#each companyLines as t, i (i)}
		<Label x={rx + colW / 2} y={companyY[0][i]} text={t} size={T.company} anchor="middle" bold />
	{/each}
	{#each addressLines as t, i (i)}
		<Label x={rx + colW / 2} y={companyY[1][i]} text={t} size={T.address} anchor="middle" />
	{/each}

	<!-- Titre -->
	<rect x={titleBox.x} y={titleBox.y} width={titleBox.w} height={titleBox.h} {...box} />
	{#each titleLines as t, i (i)}
		<Label x={rx + colW / 2} y={titleY[0][i]} text={t} size={T.title} anchor="middle" bold />
	{/each}
	{#if meta.client}
		<Label x={rx + colW / 2} y={titleY[1][0]} text={meta.client} size={T.client} anchor="middle" />
	{/if}

	<!-- Indices -->
	<rect x={revBox.x} y={revBox.y} width={revBox.w} height={revBox.h} {...box} />
	<Label
		x={rx + revCols.indice / 2}
		y={revBox.y + rowH - 2.4}
		text="INDICE"
		size={T.tableHeader}
		anchor="middle"
	/>
	<Label
		x={(xMod + xDate) / 2}
		y={revBox.y + rowH - 2.4}
		text="MODIFICATION"
		size={T.tableHeader}
		anchor="middle"
	/>
	<Label
		x={xDate + revCols.date / 2}
		y={revBox.y + rowH - 2.4}
		text="DATE"
		size={T.tableHeader}
		anchor="middle"
	/>
	{#each revRows as r, i (i)}
		{@const y = revBox.y + rowH * (i + 1)}
		<line x1={rx} y1={y} x2={rx + colW} y2={y} {...thin} />
		<Label
			x={rx + revCols.indice / 2}
			y={y + rowH - 2.4}
			text={r.indice}
			size={T.tableCell}
			anchor="middle"
		/>
		<Label
			x={xMod + 2}
			y={y + rowH - 2.4}
			text={ellipsize(r.description, xDate - xMod - 4, T.tableCell, cw)}
			size={T.tableCell}
		/>
		<Label
			x={xDate + revCols.date / 2}
			y={y + rowH - 2.4}
			text={r.date}
			size={T.tableCell}
			anchor="middle"
		/>
	{/each}
	<line x1={xMod} y1={revBox.y} x2={xMod} y2={revBottom} {...thin} />
	<line x1={xDate} y1={revBox.y} x2={xDate} y2={revBottom} {...thin} />
	<line x1={rx} y1={revBottom} x2={rx + colW} y2={revBottom} {...thin} />

	<!-- N° d'affaire | N° de plan | NB DE FOLIOS -->
	<line x1={rx} y1={fy} x2={rx + colW} y2={fy} {...thin} />
	<line x1={rx + footCols[1]} y1={fy} x2={rx + footCols[1]} y2={bottom} {...thin} />
	<line x1={rx + footCols[2]} y1={fy} x2={rx + footCols[2]} y2={bottom} {...thin} />
	<Label
		x={rx + footCols[1] / 2}
		y={fy + 4.6}
		text="N° d'affaire :"
		size={T.footerLabel}
		anchor="middle"
	/>
	<Label
		x={rx + footCols[1] / 2}
		y={fy + 9.8}
		text={meta.affaireNumber}
		size={T.footerValue}
		anchor="middle"
	/>
	<Label
		x={rx + (footCols[1] + footCols[2]) / 2}
		y={fy + 4.6}
		text="N° de plan"
		size={T.footerLabel}
		anchor="middle"
	/>
	<Label
		x={rx + (footCols[1] + footCols[2]) / 2}
		y={fy + 9.8}
		text={meta.planNumber}
		size={T.footerValue}
		anchor="middle"
	/>
	<Label
		x={rx + (footCols[2] + colW) / 2}
		y={fy + 4.6}
		text="NB DE FOLIOS :"
		size={T.footerLabel}
		anchor="middle"
	/>
	<Label
		x={rx + (footCols[2] + colW) / 2}
		y={fy + 10.4}
		text={String(count)}
		size={T.folioCount}
		anchor="middle"
		bold
	/>
</svg>
