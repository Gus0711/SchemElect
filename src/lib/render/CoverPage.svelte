<script lang="ts">
	/**
	 * Page de garde du dossier (A4 paysage, mm) — reproduit exemple_schema/png/p13.png :
	 * à gauche le sommaire, à droite société, titre, indices, n° d'affaire / plan / nb de folios.
	 */
	import { ellipsize, wrapText } from '$lib/export/paginate';
	import { PAGE, folioNumber } from '$lib/model/layout';
	import { fillText, projectTemplate, type TemplateLine, type TextSize } from '$lib/model/template';
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

	// Blocs société, présentation (facultatif) et titre : se partagent la hauteur restante.
	const tpl = $derived(projectTemplate(project));
	const ctx = $derived({ folioCount: count });
	const hasAbout = $derived(tpl.cover.about.some((l) => l.value.trim() || l.label));
	const upper = $derived(revBox.y - GAP - M);
	const boxes = $derived.by(() => {
		const shares = hasAbout ? [0.34, 0.33, 0.33] : [0.55, 0, 0.45];
		const free = upper - GAP * (hasAbout ? 2 : 1);
		const [hc, ha, ht] = shares.map((k) => free * k);
		const company = { x: rx, y: M, w: colW, h: hc };
		const about = { x: rx, y: M + hc + GAP, w: colW, h: ha };
		const title = { x: rx, y: M + hc + (hasAbout ? ha + 2 * GAP : GAP), w: colW, h: ht };
		return { company, about, title };
	});

	/** Tailles de texte par bloc (petit / normal / grand). */
	const SIZES = {
		company: { small: T.address, normal: T.client, big: T.company },
		about: { small: T.summary, normal: T.address, big: T.client },
		title: { small: T.address, normal: T.client, big: T.title }
	};

	/** Lignes d'un bloc : texte rempli, coupé à la largeur, centré verticalement. */
	function block(
		lines: TemplateLine[],
		b: { x: number; y: number; w: number; h: number },
		sizes: Record<TextSize, number>,
		width: number
	) {
		const rows = lines.flatMap((l) => {
			const size = sizes[l.size ?? 'normal'];
			const t = fillText(`${l.label ? `${l.label} ` : ''}${l.value}`, project, ctx);
			return t
				? wrapText(t, width, size, cw)
						.slice(0, 3)
						.map((text) => ({ text, size, l }))
				: [];
		});
		const lh = (sz: number) => sz * 1.25;
		const total = rows.reduce((a, r) => a + lh(r.size), 0);
		// Trop haut : tout est réduit proportionnellement.
		const k = Math.min(1, (b.h - 4) / Math.max(1, total));
		let y = b.y + (b.h - total * k) / 2;
		return rows.map((r) => {
			const size = r.size * k;
			const out = { ...r, size, y: y + size };
			y += lh(size);
			return out;
		});
	}

	/** Logo à gauche du bloc société (si présent), texte à droite. */
	const logoBox = $derived.by(() => {
		if (!tpl.logo) return null;
		const b = boxes.company;
		const h = b.h - 8;
		const w = Math.min(colW * 0.42, h / (tpl.logoRatio ?? 1));
		return { x: b.x + 5, y: b.y + 4, w, h };
	});
	const companyTextX = $derived(logoBox ? logoBox.x + logoBox.w + 4 : rx + 6);
	const companyTextW = $derived(rx + colW - 6 - companyTextX);
	const companyRows = $derived(
		block(tpl.cover.company, boxes.company, SIZES.company, companyTextW)
	);
	const aboutRows = $derived(
		hasAbout ? block(tpl.cover.about, boxes.about, SIZES.about, colW - 10) : []
	);
	const titleRows = $derived(block(tpl.cover.title, boxes.title, SIZES.title, colW - 12));
	const footer = $derived(
		[0, 1, 2].map((i) => {
			const l = tpl.cover.footer[i];
			return {
				label: l?.label ?? '',
				value: l ? fillText(l.value, project, ctx) : '',
				size: l?.size === 'big' ? T.folioCount : T.footerValue,
				bold: !!l?.bold
			};
		})
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

	<!-- Société : logo + lignes du modèle -->
	<rect
		x={boxes.company.x}
		y={boxes.company.y}
		width={boxes.company.w}
		height={boxes.company.h}
		{...box}
	/>
	{#if logoBox && tpl.logo}
		<image
			x={logoBox.x}
			y={logoBox.y}
			width={logoBox.w}
			height={logoBox.h}
			href={tpl.logo}
			preserveAspectRatio="xMidYMid meet"
		/>
	{/if}
	{#each companyRows as r, i (i)}
		<Label
			x={companyTextX + companyTextW / 2}
			y={r.y}
			text={r.text}
			size={r.size}
			anchor="middle"
			bold={r.l.bold}
			color={r.l.accent ? C.reference : C.ink}
		/>
	{/each}

	<!-- Présentation (facultative) -->
	{#if hasAbout}
		{@const ab = boxes.about}
		<rect x={ab.x} y={ab.y} width={ab.w} height={ab.h} {...box} />
		{#each aboutRows as r, i (i)}
			<Label
				x={rx + colW / 2}
				y={r.y}
				text={r.text}
				size={r.size}
				anchor="middle"
				bold={r.l.bold}
				color={r.l.accent ? C.reference : C.ink}
			/>
		{/each}
	{/if}

	<!-- Titre -->
	<rect x={boxes.title.x} y={boxes.title.y} width={boxes.title.w} height={boxes.title.h} {...box} />
	{#each titleRows as r, i (i)}
		<Label
			x={rx + colW / 2}
			y={r.y}
			text={r.text}
			size={r.size}
			anchor="middle"
			bold={r.l.bold}
			color={r.l.accent ? C.reference : C.ink}
		/>
	{/each}

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
	{#each footer as f, i (i)}
		{@const x0 = rx + footCols[i]}
		{@const x1 = rx + (footCols[i + 1] ?? colW)}
		<Label x={(x0 + x1) / 2} y={fy + 4.6} text={f.label} size={T.footerLabel} anchor="middle" />
		<Label
			x={(x0 + x1) / 2}
			y={fy + (f.size > T.footerValue ? 10.4 : 9.8)}
			text={ellipsize(f.value, x1 - x0 - 2, f.size, cw)}
			size={f.size}
			anchor="middle"
			bold={f.bold}
		/>
	{/each}
</svg>
