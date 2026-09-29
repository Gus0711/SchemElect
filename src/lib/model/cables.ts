/**
 * Câbles multi-conducteurs (ex. « CABLE SYT1 3 PAIRES », folio 04 de l'exemple).
 *
 * Un câble est posé sur un folio comme une ellipse en travers des fils : les fils qu'elle
 * coupe sont ses conducteurs, dans l'ordre (gauche → droite, ou haut → bas). Tout le
 * reste est calculé : conducteur et couleur de chaque fil, libellés « Paire Ciel / Jaune »,
 * colonne « Câble » des borniers, carnet de câbles, contrôles (câble plein, vide).
 */
import { EPS, type Rect } from './geometry';
import type { NetAnalysis } from './nets';
import { folioRef } from './layout';
import { nextFreeTag } from './tags';
import type { CableItem, Folio, Id, Point, Project } from './types';

/** Demi-épaisseur de l'ellipse (mm). */
export const CABLE_RY = 1.1;
/** Tailles de texte (mm) : nom du câble, couleurs des conducteurs. */
export const CABLE_NAME_SIZE = 2.2;
export const CABLE_COLOR_SIZE = 2.0;

// ---------------------------------------------------------------- types de câbles

export interface CableType {
	type: string;
	pairs: boolean;
	/** Couleurs des conducteurs pour n conducteurs (n pair si câble à paires). */
	colors: (count: number) => string[];
	hint: string;
}

/**
 * Paires SYT1 : les trois premières sont celles du dossier de référence (folio 04) ;
 * les suivantes sont à faire valider par le dessinateur.
 */
export const SYT1_PAIRS: [string, string][] = [
	['Ciel', 'Jaune'],
	['Ciel', 'Blanc'],
	['Ciel', 'Bleu'],
	['Ciel', 'Marron'],
	['Ciel', 'Noir'],
	['Ciel', 'Rouge'],
	['Ciel', 'Vert'],
	['Ciel', 'Gris']
];

const numbered = (count: number, from = 1) =>
	Array.from({ length: count }, (_, i) => String(i + from));

/** Code couleur des câbles d'énergie (NF C 15-100 / HD 308). */
function powerColors(count: number): string[] {
	switch (count) {
		case 1:
			return ['Noir'];
		case 2:
			return ['Bleu', 'Marron'];
		case 3:
			return ['Vert/Jaune', 'Bleu', 'Marron'];
		case 4:
			return ['Vert/Jaune', 'Marron', 'Noir', 'Gris'];
		case 5:
			return ['Vert/Jaune', 'Bleu', 'Marron', 'Noir', 'Gris'];
		default:
			return ['Vert/Jaune', ...numbered(count - 1)];
	}
}

export const CABLE_TYPES: CableType[] = [
	{
		type: 'SYT1',
		pairs: true,
		hint: 'Téléphonique, paires',
		colors: (n) =>
			Array.from({ length: n }, (_, i) => {
				const pair = SYT1_PAIRS[Math.floor(i / 2)];
				return pair ? pair[i % 2] : String(i + 1);
			})
	},
	{ type: 'U1000 R2V', pairs: false, hint: 'Énergie, couleurs normalisées', colors: powerColors },
	{ type: 'H07RN-F', pairs: false, hint: 'Énergie souple', colors: powerColors },
	{ type: 'LiYCY', pairs: true, hint: 'Paires blindées (bus, sondes)', colors: (n) => numbered(n) },
	{ type: 'Numéroté', pairs: false, hint: 'Conducteurs numérotés', colors: (n) => numbered(n) }
];

export function cableType(type: string): CableType | undefined {
	return CABLE_TYPES.find((t) => t.type.toLowerCase() === type.trim().toLowerCase());
}

/** Couleurs par défaut d'un câble de ce type à `count` conducteurs. */
export function defaultCableColors(type: string, pairs: boolean, count: number): string[] {
	const n = pairs ? Math.max(2, Math.ceil(count / 2) * 2) : Math.max(1, count);
	const t = cableType(type);
	return t ? t.colors(n) : numbered(n);
}

/** Texte affiché par défaut : « CABLE SYT1 3 PAIRES », « CABLE U1000 R2V 3G1,5 ». */
export function defaultCableName(c: Pick<CableItem, 'type' | 'pairs' | 'colors' | 'section'>) {
	const n = c.colors.length;
	const section = c.section?.trim() ?? '';
	if (c.pairs) {
		const p = Math.ceil(n / 2);
		return `CABLE ${c.type} ${p} PAIRE${p > 1 ? 'S' : ''}${section ? ` ${section}` : ''}`.trim();
	}
	const g = c.colors.some((x) => /vert.?jaune/i.test(x)) ? 'G' : 'X';
	return `CABLE ${c.type} ${n}${g}${section}`.trim();
}

export function cableName(c: CableItem): string {
	return c.name?.trim() || defaultCableName(c);
}

/** Libellé d'un conducteur dans les tableaux : « P1 Ciel », « Bleu », « 3 ». */
export function conductorLabel(c: CableItem, index: number): string {
	const color = c.colors[index] ?? String(index + 1);
	return c.pairs ? `P${Math.floor(index / 2) + 1} ${color}` : color;
}

/**
 * Couleurs → lignes éditables (une paire par ligne « Ciel / Jaune », ou un conducteur
 * par ligne) et inversement.
 */
export function colorsToLines(colors: string[], pairs: boolean): string[] {
	if (!pairs) return [...colors];
	const out: string[] = [];
	for (let i = 0; i < colors.length; i += 2)
		out.push(colors[i + 1] !== undefined ? `${colors[i]} / ${colors[i + 1]}` : colors[i]);
	return out;
}

export function linesToColors(lines: string[], pairs: boolean): string[] {
	const clean = lines.map((l) => l.trim()).filter(Boolean);
	if (!pairs) return clean;
	return clean.flatMap((l, i) => {
		const [a, b] = l.split('/').map((s) => s.trim());
		return [a || String(2 * i + 1), b || String(2 * i + 2)];
	});
}

// ---------------------------------------------------------------- géométrie

/** Axe du câble : de `a` à `b` (horizontal par défaut, vertical si `vertical`). */
export function cableAxis(c: CableItem): { a: Point; b: Point } {
	return c.vertical
		? { a: { x: c.x, y: c.y }, b: { x: c.x, y: c.y + c.length } }
		: { a: { x: c.x, y: c.y }, b: { x: c.x + c.length, y: c.y } };
}

/** Rectangle de l'ellipse. */
export function cableEllipseBounds(c: CableItem): Rect {
	return c.vertical
		? { x: c.x - CABLE_RY, y: c.y, w: 2 * CABLE_RY, h: c.length }
		: { x: c.x, y: c.y - CABLE_RY, w: c.length, h: 2 * CABLE_RY };
}

export interface CableCrossing {
	wireId: Id;
	/** Point où le fil traverse l'axe du câble. */
	point: Point;
	/** Rang du conducteur (0…). */
	index: number;
}

/** Fils coupés par le câble, dans l'ordre de l'axe. */
export function cableCrossings(folio: Folio, c: CableItem): CableCrossing[] {
	const { a, b } = cableAxis(c);
	const found: { wireId: Id; point: Point; pos: number }[] = [];
	for (const w of folio.wires) {
		for (let i = 0; i < w.points.length - 1; i++) {
			const p = w.points[i];
			const q = w.points[i + 1];
			let hit: Point | null = null;
			if (!c.vertical && Math.abs(p.x - q.x) < EPS) {
				// Segment vertical coupant un câble horizontal.
				const inAxis = p.x > a.x + EPS && p.x < b.x - EPS;
				const inSeg = c.y >= Math.min(p.y, q.y) - EPS && c.y <= Math.max(p.y, q.y) + EPS;
				if (inAxis && inSeg) hit = { x: p.x, y: c.y };
			} else if (c.vertical && Math.abs(p.y - q.y) < EPS) {
				const inAxis = p.y > a.y + EPS && p.y < b.y - EPS;
				const inSeg = c.x >= Math.min(p.x, q.x) - EPS && c.x <= Math.max(p.x, q.x) + EPS;
				if (inAxis && inSeg) hit = { x: c.x, y: p.y };
			}
			if (hit) {
				found.push({ wireId: w.id, point: hit, pos: c.vertical ? hit.y : hit.x });
				break; // un fil = un conducteur
			}
		}
	}
	return found
		.sort((u, v) => u.pos - v.pos)
		.map((f, index) => ({ wireId: f.wireId, point: f.point, index }));
}

export interface CableLabel {
	x: number;
	y: number;
	text: string;
	/** Texte vertical (câble horizontal). */
	vertical: boolean;
	anchor: 'start' | 'end' | 'middle';
	bold: boolean;
	size: number;
}

/** Écart entre le câble et ses textes (mm). */
const LABEL_GAP = 2;
/** Écart entre un fil et le libellé de son conducteur (mm). */
const WIRE_GAP = 0.8;

/**
 * Textes du câble : nom (à gauche de l'ellipse, vertical) et couleur des conducteurs
 * (le long de chaque fil, au-dessus du câble) — comme le folio 04 de l'exemple. Pour un
 * câble à paires, un seul libellé par paire (« Paire Ciel / Jaune »), sur son 1er fil.
 */
export function cableLabels(c: CableItem, crossings: CableCrossing[]): CableLabel[] {
	const name = cableName(c);
	const out: CableLabel[] = [];
	if (c.vertical) {
		out.push({
			x: c.x,
			y: c.y - LABEL_GAP,
			text: name,
			vertical: false,
			anchor: 'middle',
			bold: true,
			size: CABLE_NAME_SIZE
		});
	} else {
		out.push({
			x: c.x - 0.5,
			y: c.y - LABEL_GAP,
			text: name,
			vertical: true,
			anchor: 'start',
			bold: true,
			size: CABLE_NAME_SIZE
		});
	}
	if (c.showColors === false) return out;
	for (const k of crossings) {
		const i = k.index;
		if (i >= c.colors.length) continue;
		let text: string;
		if (c.pairs) {
			if (i % 2) continue;
			text = `Paire ${colorsToLines(c.colors.slice(i, i + 2), true)[0]}`;
		} else text = c.colors[i];
		out.push(
			c.vertical
				? {
						x: c.x - CABLE_RY - LABEL_GAP,
						y: k.point.y - WIRE_GAP,
						text,
						vertical: false,
						anchor: 'end',
						bold: false,
						size: CABLE_COLOR_SIZE
					}
				: {
						x: k.point.x - WIRE_GAP,
						y: c.y - LABEL_GAP,
						text,
						vertical: true,
						anchor: 'start',
						bold: false,
						size: CABLE_COLOR_SIZE
					}
		);
	}
	return out;
}

/** Rectangle du nom du câble (sélection, cadre de sélection). */
export function cableNameBounds(c: CableItem): Rect {
	const size = CABLE_NAME_SIZE;
	const len = Math.max(1, cableName(c).length) * size * 0.56;
	return c.vertical
		? { x: c.x - len / 2, y: c.y - LABEL_GAP - size, w: len, h: size * 1.2 }
		: { x: c.x - 0.5 - size, y: c.y - LABEL_GAP - len, w: size * 1.2, h: len };
}

/** Emprise du câble : ellipse + nom. */
export function cableBounds(c: CableItem): Rect {
	const e = cableEllipseBounds(c);
	const n = cableNameBounds(c);
	const x = Math.min(e.x, n.x);
	const y = Math.min(e.y, n.y);
	return {
		x,
		y,
		w: Math.max(e.x + e.w, n.x + n.w) - x,
		h: Math.max(e.y + e.h, n.y + n.h) - y
	};
}

/** Pivote le câble d'un quart de tour autour de son milieu. */
export function rotateCable(c: CableItem) {
	const mid = c.vertical ? { x: c.x, y: c.y + c.length / 2 } : { x: c.x + c.length / 2, y: c.y };
	c.vertical = c.vertical ? undefined : true;
	if (c.vertical) {
		c.x = mid.x;
		c.y = mid.y - c.length / 2;
	} else {
		c.x = mid.x - c.length / 2;
		c.y = mid.y;
	}
}

// ---------------------------------------------------------------- analyse du dossier

export interface CableConductor {
	cable: CableItem;
	folioId: Id;
	index: number;
}

export interface CableInfo {
	cable: CableItem;
	folioId: Id;
	folioIndex: number;
	crossings: CableCrossing[];
	/** Fils en trop (plus de fils coupés que de conducteurs). */
	overflow: number;
}

export interface CableAnalysis {
	cables: CableInfo[];
	byId: Map<Id, CableInfo>;
	/** Conducteur(s) de câble portés par chaque fil. */
	conductorsOfWire: Map<Id, CableConductor[]>;
}

export function analyzeCables(project: Project): CableAnalysis {
	const cables: CableInfo[] = [];
	const byId = new Map<Id, CableInfo>();
	const conductorsOfWire = new Map<Id, CableConductor[]>();
	project.folios.forEach((folio, folioIndex) => {
		for (const cable of folio.cables ?? []) {
			const crossings = cableCrossings(folio, cable);
			const info: CableInfo = {
				cable,
				folioId: folio.id,
				folioIndex,
				crossings,
				overflow: Math.max(0, crossings.length - cable.colors.length)
			};
			cables.push(info);
			byId.set(cable.id, info);
			for (const k of crossings) {
				const list = conductorsOfWire.get(k.wireId) ?? [];
				list.push({ cable, folioId: folio.id, index: k.index });
				conductorsOfWire.set(k.wireId, list);
			}
		}
	});
	return { cables, byId, conductorsOfWire };
}

/** « W1 P1 Ciel » : conducteurs de câble d'une équipotentielle (colonne des borniers). */
export function netCableLabels(
	nets: NetAnalysis,
	cables: CableAnalysis,
	netId: string | undefined
): string[] {
	if (!netId) return [];
	const net = nets.nets.find((n) => n.id === netId);
	if (!net) return [];
	const out: string[] = [];
	for (const w of net.wires)
		for (const k of cables.conductorsOfWire.get(w.wireId) ?? [])
			out.push(`${k.cable.tag} ${conductorLabel(k.cable, k.index)}`);
	return [...new Set(out)];
}

/** Anomalies : câble plein (fils en trop), câble qui ne coupe aucun fil, repère en double. */
export function cableIssues(analysis: CableAnalysis): { text: string; folioId: Id; cableId: Id }[] {
	const out: { text: string; folioId: Id; cableId: Id }[] = [];
	const byTag = new Map<string, number>();
	for (const c of analysis.cables) byTag.set(c.cable.tag, (byTag.get(c.cable.tag) ?? 0) + 1);
	for (const c of analysis.cables) {
		const where = { folioId: c.folioId, cableId: c.cable.id };
		const name = `Câble ${c.cable.tag}`;
		if (!c.crossings.length) out.push({ text: `${name} : ne coupe aucun fil`, ...where });
		if (c.overflow)
			out.push({
				text: `${name} : ${c.crossings.length} fils pour ${c.cable.colors.length} conducteurs`,
				...where
			});
		if ((byTag.get(c.cable.tag) ?? 0) > 1)
			out.push({ text: `${name} : repère utilisé par plusieurs câbles`, ...where });
	}
	return out;
}

/** Position d'un câble (« 04 - C »). */
export function cablePosition(info: CableInfo): string {
	return folioRef(
		info.folioIndex,
		info.cable.x + (info.cable.vertical ? 0 : info.cable.length / 2)
	);
}

// ---------------------------------------------------------------- création

export function allCableTags(project: Project): string[] {
	return project.folios.flatMap((f) => (f.cables ?? []).map((c) => c.tag));
}

/**
 * Nouveau câble tracé de `a` à `b` : axe dominant, conducteurs = fils coupés.
 * Par défaut un SYT1 à paires (le cas du dossier de référence).
 */
export function newCable(
	project: Project,
	folio: Folio,
	a: Point,
	b: Point,
	id: Id,
	type = 'SYT1'
): CableItem {
	const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
	const pairs = cableType(type)?.pairs ?? false;
	const cable: CableItem = {
		id,
		tag: nextFreeTag('W', allCableTags(project)),
		x: vertical ? a.x : Math.min(a.x, b.x),
		y: vertical ? Math.min(a.y, b.y) : a.y,
		length: vertical ? Math.abs(b.y - a.y) : Math.abs(b.x - a.x),
		...(vertical ? { vertical: true } : {}),
		type,
		pairs,
		colors: []
	};
	const n = cableCrossings(folio, cable).length;
	cable.colors = defaultCableColors(type, pairs, Math.max(n, pairs ? 2 : 1));
	return cable;
}
