/**
 * Inventaire du dossier : liste des appareils (panneau « Appareils ») et recherche
 * globale (Ctrl+F : repère, n° de fil, borne, câble, texte, folio). Pur, testé.
 */
import { getSymbolDef } from '$lib/symbols';
import type { SymbolRole } from '$lib/symbols/types';
import type { ProjectAnalysis } from './analysis';
import { deviceCatalogItem, deviceContacts, referenceKey, type CatalogItem } from './catalog';
import { folioNumber, folioRef } from './layout';
import { compareTags, parseTag } from './tags';
import type { Id, ItemRef, Project } from './types';

export interface DevicePlacement {
	symbolId: Id;
	folioId: Id;
	folioIndex: number;
	/** Position « FF - C ». */
	ref: string;
	role: SymbolRole;
	/** Nom du symbole (« Bobine de contacteur », « Contact NO »…). */
	symbolName: string;
}

export type DeviceIssue = 'no-reference' | 'contacts';

export interface DeviceEntry {
	id: Id;
	tag: string;
	prefix: string;
	/** Catégorie du symbole principal (Protection, Commande…) : regroupement de la liste. */
	family: string;
	/** Nom du symbole principal. */
	symbolName: string;
	designation: string;
	value: string;
	reference: string;
	manufacturer: string;
	/** Fiche catalogue (copie du projet) de la référence. */
	catalog?: CatalogItem;
	/** Bornes de bornier : listées à part. */
	terminal: boolean;
	placements: DevicePlacement[];
	/** Symbole vers lequel aller (bobine, appareil, sinon le premier). */
	mainSymbolId: Id;
	issues: DeviceIssue[];
}

const MAIN_ROLES: SymbolRole[] = ['master', 'standalone', 'terminal'];

/**
 * Appareils physiques du dossier (hors renvois de fil et décors), triés par repère.
 * Ordre des emplacements : celui du dossier (folio, puis x, puis y).
 */
export function listDevices(project: Project, analysis?: ProjectAnalysis): DeviceEntry[] {
	const byDevice = new Map<Id, DevicePlacement[]>();
	const order = new Map<Id, { x: number; y: number }>();
	project.folios.forEach((f, folioIndex) => {
		for (const s of f.symbols) {
			if (!s.deviceId) continue;
			const def = getSymbolDef(s.defId);
			if (def.role === 'link' || def.role === 'decor') continue;
			const list = byDevice.get(s.deviceId) ?? [];
			list.push({
				symbolId: s.id,
				folioId: f.id,
				folioIndex,
				ref: folioRef(folioIndex, s.x),
				role: def.role,
				symbolName: def.name
			});
			order.set(s.id, { x: s.x, y: s.y });
			byDevice.set(s.deviceId, list);
		}
	});

	const out: DeviceEntry[] = [];
	for (const [deviceId, placements] of byDevice) {
		const d = project.devices[deviceId];
		if (!d) continue;
		placements.sort((a, b) => {
			const pa = order.get(a.symbolId)!;
			const pb = order.get(b.symbolId)!;
			return a.folioIndex - b.folioIndex || pa.x - pb.x || pa.y - pb.y;
		});
		const main = placements.find((p) => MAIN_ROLES.includes(p.role)) ?? placements[0];
		const mainDef = getSymbolDef(
			project.folios[main.folioIndex].symbols.find((s) => s.id === main.symbolId)!.defId
		);
		const terminal = main.role === 'terminal';
		const issues: DeviceIssue[] = [];
		if (!d.reference?.trim() && !terminal) issues.push('no-reference');
		if (analysis && deviceContacts(project, d)) {
			const usage = analysis.crossRefs.get(main.symbolId)?.usage;
			if (usage && (usage.overflowNo || usage.overflowNc)) issues.push('contacts');
		}
		out.push({
			id: d.id,
			tag: d.tag,
			prefix: parseTag(d.tag).prefix,
			family: terminal ? 'Borniers' : mainDef.category,
			symbolName: mainDef.name,
			designation: d.designation ?? '',
			value: d.value ?? '',
			reference: d.reference ?? '',
			manufacturer: d.manufacturer ?? '',
			catalog: deviceCatalogItem(project, d),
			terminal,
			placements,
			mainSymbolId: main.symbolId,
			issues
		});
	}
	return out.sort((a, b) => compareTags(a.tag, b.tag));
}

// ---------------------------------------------------------------- recherche globale

export type SearchKind = 'device' | 'terminal' | 'wire' | 'cable' | 'text' | 'folio';

export interface SearchHit {
	kind: SearchKind;
	/** Texte principal (repère, n° de fil, titre…). */
	label: string;
	/** Précision (désignation, folio…). */
	detail: string;
	folioId: Id;
	/** Élément à sélectionner (absent : aller au folio seulement). */
	item?: ItemRef;
	score: number;
}

/** Minuscules, sans accents ni espaces superflus. */
export function normalizeSearch(s: string): string {
	return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Score d'un texte : 100 identique, 80 commence par, 50 contient ; 0 sinon. */
function matchScore(text: string | undefined, q: string): number {
	if (!text) return 0;
	const t = normalizeSearch(text);
	if (!t) return 0;
	if (t === q) return 100;
	if (t.startsWith(q)) return 80;
	if (t.includes(q)) return 50;
	return 0;
}

const KIND_ORDER: SearchKind[] = ['device', 'terminal', 'wire', 'cable', 'folio', 'text'];

/**
 * Recherche dans tout le dossier. Classement : pertinence, puis type (appareil, borne,
 * fil, câble, folio, texte), puis ordre naturel.
 */
export function searchProject(
	project: Project,
	analysis: ProjectAnalysis,
	query: string,
	limit = 60
): SearchHit[] {
	const q = normalizeSearch(query);
	if (!q) return [];
	const qRef = referenceKey(query);
	const hits: SearchHit[] = [];
	const folioIdx = new Map(project.folios.map((f, i) => [f.id, i]));

	// Appareils et bornes : repère d'abord, puis désignation / référence / valeur.
	for (const e of listDevices(project)) {
		const tagScore = matchScore(e.tag, q);
		const refScore =
			qRef && e.reference && referenceKey(e.reference).includes(qRef)
				? referenceKey(e.reference) === qRef
					? 60
					: 40
				: 0;
		const other = Math.max(
			matchScore(e.designation, q) && 30,
			matchScore(e.value, q) && 25,
			matchScore(e.manufacturer, q) && 20,
			matchScore(e.catalog?.designation, q) && 20,
			refScore
		);
		const score = Math.max(tagScore, other);
		if (!score) continue;
		const main = e.placements.find((p) => p.symbolId === e.mainSymbolId)!;
		const extra = [e.designation, e.reference].filter(Boolean).join(' · ');
		hits.push({
			kind: e.terminal ? 'terminal' : 'device',
			label: e.tag,
			detail: [extra || e.symbolName, e.placements.map((p) => p.ref).join(', ')]
				.filter(Boolean)
				.join(' — '),
			folioId: main.folioId,
			item: { kind: 'symbol', id: main.symbolId },
			score
		});
	}

	// Fils : numéro d'équipotentielle (le 1er fil dans l'ordre du dossier).
	for (const n of analysis.nets.nets) {
		if (!n.number || !n.wires.length) continue;
		const score = matchScore(n.number, q);
		if (score < 80) continue;
		const wires = [...n.wires].sort(
			(a, b) => (folioIdx.get(a.folioId) ?? 0) - (folioIdx.get(b.folioId) ?? 0)
		);
		const folios = [...new Set(wires.map((w) => folioIdx.get(w.folioId) ?? 0))];
		hits.push({
			kind: 'wire',
			label: n.number,
			detail: `Fil — folio${folios.length > 1 ? 's' : ''} ${folios.map(folioNumber).join(', ')}`,
			folioId: wires[0].folioId,
			item: { kind: 'wire', id: wires[0].wireId },
			score
		});
	}

	project.folios.forEach((f, i) => {
		// Câbles.
		for (const c of f.cables) {
			const score = Math.max(matchScore(c.tag, q), matchScore(c.type, q) && 30);
			if (score)
				hits.push({
					kind: 'cable',
					label: c.tag,
					detail: `Câble ${c.type} — folio ${folioNumber(i)}`,
					folioId: f.id,
					item: { kind: 'cable', id: c.id },
					score
				});
		}
		// Folios : numéro (« 03 ») ou titre.
		const score = Math.max(
			folioNumber(i) === q || String(i + 1) === q ? 90 : 0,
			matchScore(f.title, q) && 60
		);
		if (score)
			hits.push({
				kind: 'folio',
				label: `${folioNumber(i)} — ${f.title}`,
				detail: 'Folio',
				folioId: f.id,
				score
			});
		// Textes libres.
		for (const t of f.texts) {
			const s = matchScore(t.text, q);
			if (s)
				hits.push({
					kind: 'text',
					label: t.text.split('\n')[0],
					detail: `Texte — folio ${folioNumber(i)}`,
					folioId: f.id,
					item: { kind: 'text', id: t.id },
					score: s === 100 ? 40 : 20
				});
		}
	});

	return hits
		.sort(
			(a, b) =>
				b.score - a.score ||
				KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
				compareTags(a.label, b.label)
		)
		.slice(0, limit);
}
