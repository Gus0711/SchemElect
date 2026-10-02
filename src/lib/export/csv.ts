/**
 * Exports CSV (Excel FR) : séparateur « ; », BOM UTF-8, fins de ligne CRLF.
 * Les fonctions de génération sont pures ; seul `downloadText` touche au DOM.
 */
import { projectStrips, type ProjectAnalysis } from '$lib/model/analysis';
import { cableName, cablePosition, conductorLabel } from '$lib/model/cables';
import { folioNumber, folioRef } from '$lib/model/layout';
import { bomTagsText, computeNomenclature } from '$lib/model/nomenclature';
import {
	computeOrderList,
	formatQuantity,
	groupByManufacturer,
	SOURCE_LABEL
} from '$lib/model/orderList';
import { compareTags } from '$lib/model/tags';
import type { Project } from '$lib/model/types';
import { getSymbolDef } from '$lib/symbols';

export const CSV_SEPARATOR = ';';
export const BOM = String.fromCharCode(0xfeff);

export function csvCell(value: string | number | undefined | null): string {
	const s = value === undefined || value === null ? '' : String(value);
	return /[;"\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | undefined)[][]): string {
	return (
		BOM + [header, ...rows].map((r) => r.map(csvCell).join(CSV_SEPARATOR)).join('\r\n') + '\r\n'
	);
}

const list = (items: string[]) => items.join(', ');

/** Borniers : une ligne par borne. */
export function stripsCsv(project: Project, analysis: ProjectAnalysis): string {
	const rows = projectStrips(project, analysis).flatMap((strip) =>
		strip.rows.map((r) => [
			strip.prefix,
			r.tag,
			r.wire,
			list(r.inside),
			list(r.outside),
			list(r.cable),
			r.position,
			r.designation
		])
	);
	return toCsv(
		[
			'Bornier',
			'Repère',
			'N° fil / potentiel',
			'Intérieur',
			'Extérieur',
			'Câble',
			'Position',
			'Désignation'
		],
		rows
	);
}

/** Carnet de câbles : une ligne par conducteur (repère, couleur, fil raccordé). */
export function cablesCsv(project: Project, analysis: ProjectAnalysis): string {
	const potentials = new Map(project.potentials.map((p) => [p.id, p.name]));
	const infos = [...analysis.cables.cables].sort((a, b) => compareTags(a.cable.tag, b.cable.tag));
	const rows = infos.flatMap((info) => {
		const c = info.cable;
		const wireOf = new Map(info.crossings.map((k) => [k.index, k.wireId]));
		const count = Math.max(c.colors.length, info.crossings.length);
		return Array.from({ length: count }, (_, i) => {
			const wireId = wireOf.get(i);
			const net = wireId ? analysis.nets.netOfWire.get(wireId) : undefined;
			const wire = net?.number ?? (net?.potentialId ? (potentials.get(net.potentialId) ?? '') : '');
			return [
				c.tag,
				c.type,
				cableName(c),
				i + 1,
				i < c.colors.length ? conductorLabel(c, i) : 'en trop',
				wireId ? wire || '—' : 'libre',
				cablePosition(info)
			];
		});
	});
	return toCsv(
		['Câble', 'Type', 'Désignation', 'Conducteur', 'Couleur', 'N° fil / potentiel', 'Position'],
		rows
	);
}

/** Nomenclature des appareils (hors renvois de fil). */
export function devicesCsv(project: Project): string {
	const positions = new Map<string, string[]>();
	const physical = new Set<string>();
	project.folios.forEach((f, fi) => {
		for (const s of f.symbols) {
			if (!s.deviceId) continue;
			const list = positions.get(s.deviceId) ?? [];
			list.push(folioRef(fi, s.x));
			positions.set(s.deviceId, list);
			if (getSymbolDef(s.defId).role !== 'link') physical.add(s.deviceId);
		}
	});
	const rows = Object.values(project.devices)
		.filter((d) => physical.has(d.id))
		.sort((a, b) => compareTags(a.tag, b.tag))
		.map((d) => {
			const pos = positions.get(d.id) ?? [];
			return [d.tag, d.designation, d.value, d.reference, d.manufacturer, pos.length, list(pos)];
		});
	return toCsv(
		[
			'Repère',
			'Désignation',
			'Valeur',
			'Référence',
			'Fabricant',
			'Nombre de symboles',
			'Positions'
		],
		rows
	);
}

/** Nomenclature par référence : une ligne par référence (quantité, repères). */
export function nomenclatureCsv(project: Project): string {
	const rows = computeNomenclature(project).map((l) => [
		l.quantity,
		l.reference || 'À compléter',
		l.manufacturer,
		l.designation,
		l.category,
		bomTagsText(l)
	]);
	return toCsv(['Quantité', 'Référence', 'Fabricant', 'Désignation', 'Catégorie', 'Repères'], rows);
}

/** Liste de commande, groupée par fabricant. */
export function orderCsv(project: Project): string {
	const rows = groupByManufacturer(computeOrderList(project)).flatMap((g) =>
		g.lines.map((l) => [
			g.manufacturer,
			l.reference || 'À compléter',
			l.designation,
			formatQuantity(l.quantity),
			l.unit,
			SOURCE_LABEL[l.source],
			l.detail
		])
	);
	return toCsv(
		['Fabricant', 'Référence', 'Désignation', 'Quantité', 'Unité', 'Origine', 'Précision'],
		rows
	);
}

/** Liste des fils : une ligne par équipotentielle dessinée. */
export function wiresCsv(project: Project, analysis: ProjectAnalysis): string {
	const folioIdx = new Map(project.folios.map((f, i) => [f.id, i]));
	const symbols = new Map(project.folios.flatMap((f) => f.symbols.map((s) => [s.id, s] as const)));
	const potentials = new Map(project.potentials.map((p) => [p.id, p]));
	const potOrder = new Map(project.potentials.map((p, i) => [p.id, i]));

	const nets = analysis.nets.nets.filter((n) => n.wires.length > 0 && (n.number || n.potentialId));
	nets.sort((a, b) => {
		if (a.number && b.number) return a.number.localeCompare(b.number, 'fr', { numeric: true });
		if (a.number || b.number) return a.number ? -1 : 1;
		return (potOrder.get(a.potentialId!) ?? 0) - (potOrder.get(b.potentialId!) ?? 0);
	});

	const rows = nets.map((n) => {
		const pot = n.potentialId ? potentials.get(n.potentialId) : undefined;
		const label = n.number ?? pot?.name ?? '';
		const folios = [...new Set(n.wires.map((w) => folioIdx.get(w.folioId) ?? 0))].sort(
			(a, b) => a - b
		);
		const terms: string[] = [];
		for (const t of n.terminals) {
			const s = symbols.get(t.symbolId);
			const device = s ? project.devices[s.deviceId] : undefined;
			if (!s || !device) continue;
			const role = getSymbolDef(s.defId).role;
			if (role === 'link' || role === 'decor') continue;
			const txt = role === 'terminal' ? device.tag : `${device.tag}:${t.terminalId}`;
			if (!terms.includes(txt)) terms.push(txt);
		}
		terms.sort(
			(a, b) =>
				compareTags(a.split(':')[0], b.split(':')[0]) || a.localeCompare(b, 'fr', { numeric: true })
		);
		return [
			label,
			n.color ?? pot?.wireColor ?? '',
			n.section ?? '',
			list(folios.map(folioNumber)),
			list(terms)
		];
	});
	return toCsv(
		['N° fil / potentiel', 'Couleur', 'Section (mm²)', 'Folios', 'Bornes raccordées'],
		rows
	);
}

/** Téléchargement d'un fichier texte (navigateur uniquement). */
export function downloadText(
	filename: string,
	content: string,
	mime = 'text/csv;charset=utf-8'
): void {
	downloadBlob(filename, new Blob([content], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
