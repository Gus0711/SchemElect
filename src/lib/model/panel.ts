/**
 * Folios d'implantation et de façade (armoire à l'échelle).
 *
 * Le modèle est en coordonnées RÉELLES (mm, origine au coin haut-gauche de l'armoire) ;
 * la mise à l'échelle sur la page (1:5, 1:8…) est calculée ici, de même que tout ce qui
 * se déduit : appareil sur quel rail, remplissage des rails, chevauchements, largeur des
 * borniers, appareils restant à placer.
 */
import { getSymbolDef } from '$lib/symbols';
import {
	deviceFootprint,
	doorRank,
	prefixRank,
	STRIP_H,
	stripWidth,
	type Footprint
} from './footprints';
import { rectContainsPoint, rectsIntersect, type Rect } from './geometry';
import { newId } from './ids';
import { AREA } from './layout';
import { compareTags, parseTag } from './tags';
import type {
	Duct,
	Enclosure,
	Folio,
	Id,
	ItemKind,
	ItemRef,
	Mounting,
	Panel,
	PanelItem,
	PanelKind,
	Point,
	Project,
	Rail,
	TextItem
} from './types';

/** Pas de magnétisme en mm réels. */
export const PANEL_STEP = 5;
/** Hauteur d'un rail oméga. */
export const RAIL_H = 35;
/** Distance (mm réels) sous laquelle un appareil lâché s'accroche au rail. */
const RAIL_CATCH = 20;

export const DEFAULT_ENCLOSURE: Enclosure = { w: 600, h: 1000, d: 250 };

export const PANEL_TITLES: Record<PanelKind, string> = {
	implantation: 'IMPLANTATION',
	facade: 'FAÇADE'
};

export const isPanelKind = (k: ItemKind) => k === 'rail' || k === 'duct' || k === 'mount';

const round1 = (v: number) => Math.round(v * 10) / 10;
export const snapReal = (v: number, step = PANEL_STEP) => Math.round(v / step) * step;

// ---------------------------------------------------------------- création

export interface LayoutOptions {
	rails: number;
	/** Largeur des goulottes horizontales (entre les rails). */
	ductW: number;
	/** Largeur des goulottes verticales (côtés). */
	sideW: number;
	/** Hauteur des goulottes (« 40L × 80H »). */
	depth: number;
}

/** Nombre de rails usuel pour une hauteur d'armoire (bandeau ≈ 200 mm par rail). */
export function defaultLayoutOptions(enc: Enclosure): LayoutOptions {
	return { rails: Math.max(1, Math.round((enc.h - 40) / 240)), ductW: 40, sideW: 40, depth: 80 };
}

/**
 * Disposition classique : une goulotte verticale de chaque côté, des goulottes
 * horizontales en haut, entre les rails et en bas ; rails centrés dans chaque bande.
 * Remplace les rails et goulottes existants (les appareils posés ne bougent pas).
 */
export function generateLayout(panel: Panel, opts: LayoutOptions) {
	const { w, h } = panel.enclosure;
	const n = Math.max(1, Math.round(opts.rails));
	const side = Math.max(0, opts.sideW);
	const dw = Math.max(0, opts.ductW);
	const inner = { x: side, w: w - 2 * side };
	const band = (h - (n + 1) * dw) / n;
	const ducts: Duct[] = [];
	const rails: Rail[] = [];
	if (side > 0) {
		ducts.push({ id: newId('g'), x: 0, y: 0, w: side, h, depth: opts.depth });
		ducts.push({ id: newId('g'), x: w - side, y: 0, w: side, h, depth: opts.depth });
	}
	for (let i = 0; i <= n; i++) {
		const y = i * (band + dw);
		if (dw > 0) ducts.push({ id: newId('g'), x: inner.x, y, w: inner.w, h: dw, depth: opts.depth });
		if (i < n)
			rails.push({ id: newId('r'), x: inner.x, y: snapReal(y + dw + band / 2), length: inner.w });
	}
	panel.rails = rails;
	panel.ducts = ducts.map((d) => ({ ...d, y: round1(d.y) }));
}

export function createPanel(kind: PanelKind, enclosure: Enclosure = DEFAULT_ENCLOSURE): Panel {
	const panel: Panel = { kind, enclosure: { ...enclosure }, rails: [], ducts: [], items: [] };
	if (kind === 'implantation') generateLayout(panel, defaultLayoutOptions(enclosure));
	return panel;
}

/** Enveloppe de référence pour un nouveau folio : celle d'un folio d'armoire existant. */
export function projectEnclosure(project: Project): Enclosure {
	const f = project.folios.find((x) => x.panel);
	return f?.panel ? { ...f.panel.enclosure } : { ...DEFAULT_ENCLOSURE };
}

/** Copie d'un folio d'armoire (duplication) : rails et goulottes, sans les appareils. */
export function clonePanelLayout(panel: Panel): Panel {
	return {
		...panel,
		enclosure: { ...panel.enclosure },
		rails: panel.rails.map((r) => ({ ...r, id: newId('r') })),
		ducts: panel.ducts.map((d) => ({ ...d, id: newId('g') })),
		items: []
	};
}

// ---------------------------------------------------------------- échelle

/** Échelles normalisées proposées (dénominateurs). */
export const SCALES = [1, 2, 2.5, 4, 5, 6, 8, 10, 12.5, 15, 20, 25, 30, 40, 50];

/**
 * Zone de la page réservée au dessin : titre (vertical) et cotes à gauche, chaîne de
 * cotes à droite, cote de largeur au-dessus. Une armoire de 1000 mm tient au 1:6.
 */
export const PANEL_AREA: Rect = {
	x: AREA.x + 32,
	y: AREA.y + 5,
	w: AREA.w - 46,
	h: AREA.h - 6
};

export function autoScale(enc: Enclosure): number {
	const need = Math.max(enc.w / PANEL_AREA.w, enc.h / PANEL_AREA.h);
	return SCALES.find((s) => s >= need) ?? SCALES[SCALES.length - 1];
}

export interface PanelTransform {
	/** Dénominateur (8 = 1:8). */
	scale: number;
	/** mm page par mm réel. */
	k: number;
	/** Coin haut-gauche de l'armoire sur la page. */
	ox: number;
	oy: number;
}

export function panelTransform(panel: Panel): PanelTransform {
	const scale = panel.scale && panel.scale > 0 ? panel.scale : autoScale(panel.enclosure);
	const k = 1 / scale;
	const w = panel.enclosure.w * k;
	const h = panel.enclosure.h * k;
	return {
		scale,
		k,
		ox: PANEL_AREA.x + Math.max(0, (PANEL_AREA.w - w) / 2),
		oy: PANEL_AREA.y + Math.max(0, (PANEL_AREA.h - h) / 2)
	};
}

export const toPage = (t: PanelTransform, p: Point): Point => ({
	x: t.ox + p.x * t.k,
	y: t.oy + p.y * t.k
});

export const toReal = (t: PanelTransform, p: Point): Point => ({
	x: (p.x - t.ox) / t.k,
	y: (p.y - t.oy) / t.k
});

export const rectToPage = (t: PanelTransform, r: Rect): Rect => ({
	x: t.ox + r.x * t.k,
	y: t.oy + r.y * t.k,
	w: r.w * t.k,
	h: r.h * t.k
});

/** Magnétisme d'un point de page sur la grille réelle de 5 mm. */
export function snapPanelPoint(panel: Panel, p: Point): Point {
	const t = panelTransform(panel);
	const r = toReal(t, p);
	return toPage(t, { x: snapReal(r.x), y: snapReal(r.y) });
}

/** Libellé d'échelle : « 1:8 », « 1:12,5 ». */
export function scaleLabel(scale: number): string {
	return `1:${String(scale).replace('.', ',')}`;
}

// ---------------------------------------------------------------- géométrie (mm réels)

export const itemRect = (i: PanelItem): Rect => ({
	x: i.x - i.w / 2,
	y: i.y - i.h / 2,
	w: i.w,
	h: i.h
});

export const railRect = (r: Rail): Rect => ({
	x: r.x,
	y: r.y - RAIL_H / 2,
	w: r.length,
	h: RAIL_H
});

export const ductRect = (d: Duct): Rect => ({ x: d.x, y: d.y, w: d.w, h: d.h });

/** Goulotte verticale (plus haute que large). */
export const isVertical = (d: Duct) => d.h > d.w;

/** « Goulotte 40L × 80H » */
export function ductLabel(d: Duct): string {
	return `Goulotte ${Math.round(Math.min(d.w, d.h))}L × ${Math.round(d.depth)}H`;
}

/**
 * Rail qui porte l'élément : centre sur l'axe et appareil qui chevauche le rail (un
 * appareil qui dépasse d'un bout compte, pour être signalé).
 */
export function railOf(panel: Panel, item: PanelItem): Rail | undefined {
	return panel.rails.find(
		(r) =>
			Math.abs(item.y - r.y) < 0.5 &&
			item.x + item.w / 2 > r.x + 0.5 &&
			item.x - item.w / 2 < r.x + r.length - 0.5
	);
}

/** Emprise d'un élément de folio d'armoire sur la PAGE (sélection, cadre de sélection). */
export function panelItemBounds(folio: Folio, ref: ItemRef): Rect | null {
	const panel = folio.panel;
	if (!panel) return null;
	const t = panelTransform(panel);
	switch (ref.kind) {
		case 'rail': {
			const r = panel.rails.find((x) => x.id === ref.id);
			return r ? rectToPage(t, railRect(r)) : null;
		}
		case 'duct': {
			const d = panel.ducts.find((x) => x.id === ref.id);
			return d ? rectToPage(t, ductRect(d)) : null;
		}
		case 'mount': {
			const i = panel.items.find((x) => x.id === ref.id);
			return i ? rectToPage(t, itemRect(i)) : null;
		}
		default:
			return null;
	}
}

export function panelItems(folio: Folio): ItemRef[] {
	const p = folio.panel;
	if (!p) return [];
	return [
		...p.ducts.map((x) => ({ kind: 'duct' as const, id: x.id })),
		...p.rails.map((x) => ({ kind: 'rail' as const, id: x.id })),
		...p.items.map((x) => ({ kind: 'mount' as const, id: x.id }))
	];
}

/** Élément d'armoire sous le curseur (point de page) : appareil > rail > goulotte. */
export function panelHitTest(folio: Folio, p: Point, tol: number): ItemRef | null {
	const panel = folio.panel;
	if (!panel) return null;
	const t = panelTransform(panel);
	for (let i = panel.items.length - 1; i >= 0; i--) {
		const it = panel.items[i];
		if (rectContainsPoint(rectToPage(t, itemRect(it)), p, tol * 0.5))
			return { kind: 'mount', id: it.id };
	}
	for (const r of panel.rails)
		if (rectContainsPoint(rectToPage(t, railRect(r)), p, tol * 0.5))
			return { kind: 'rail', id: r.id };
	for (const d of panel.ducts)
		if (rectContainsPoint(rectToPage(t, ductRect(d)), p, tol * 0.5))
			return { kind: 'duct', id: d.id };
	return null;
}

// ---------------------------------------------------------------- édition

/**
 * Déplace des éléments d'armoire d'un delta de PAGE (converti en mm réels). Les appareils
 * posés sur un rail déplacé suivent le rail.
 */
export function movePanelItems(folio: Folio, refs: ItemRef[], dx: number, dy: number) {
	const panel = folio.panel;
	if (!panel || (!dx && !dy)) return;
	const t = panelTransform(panel);
	const rx = round1(dx / t.k);
	const ry = round1(dy / t.k);
	const ids = (kind: ItemKind) => new Set(refs.filter((r) => r.kind === kind).map((r) => r.id));
	const railIds = ids('rail');
	const ductIds = ids('duct');
	const itemIds = ids('mount');
	for (const r of panel.rails)
		if (railIds.has(r.id))
			for (const it of panel.items)
				if (!itemIds.has(it.id) && railOf(panel, it) === r) itemIds.add(it.id);
	for (const r of panel.rails)
		if (railIds.has(r.id)) {
			r.x = round1(r.x + rx);
			r.y = round1(r.y + ry);
		}
	for (const d of panel.ducts)
		if (ductIds.has(d.id)) {
			d.x = round1(d.x + rx);
			d.y = round1(d.y + ry);
		}
	for (const it of panel.items)
		if (itemIds.has(it.id)) {
			it.x = round1(it.x + rx);
			it.y = round1(it.y + ry);
		}
}

/** Rail le plus proche d'un point (mm réels), dans sa longueur et à portée d'accroche. */
function railNear(panel: Panel, p: Point): Rail | undefined {
	let best: { r: Rail; d: number } | undefined;
	for (const r of panel.rails) {
		const d = Math.abs(p.y - r.y);
		if (d <= RAIL_CATCH && p.x >= r.x && p.x <= r.x + r.length && (!best || d < best.d))
			best = { r, d };
	}
	return best?.r;
}

/** Accroche au rail les appareils lâchés près d'un rail (fin de glisser, pose). */
export function settleOnRails(panel: Panel, itemIds: Iterable<Id>) {
	if (panel.kind !== 'implantation') return;
	const ids = new Set(itemIds);
	for (const it of panel.items) {
		if (!ids.has(it.id)) continue;
		const r = railNear(panel, it);
		if (r) it.y = r.y;
	}
}

export function deletePanelItems(folio: Folio, refs: ItemRef[]) {
	const panel = folio.panel;
	if (!panel) return;
	const del = new Set(refs.filter((r) => isPanelKind(r.kind)).map((r) => r.id));
	panel.rails = panel.rails.filter((x) => !del.has(x.id));
	panel.ducts = panel.ducts.filter((x) => !del.has(x.id));
	panel.items = panel.items.filter((x) => !del.has(x.id));
}

/**
 * Rail posé au clic à la hauteur `y` (mm réels) : il occupe l'espace libre entre les
 * goulottes verticales qui encadrent `x` (sinon toute la largeur de l'armoire).
 */
export function addRailAt(panel: Panel, x: number, y: number, x2?: number): Rail {
	let a: number;
	let b: number;
	if (x2 !== undefined && Math.abs(x2 - x) >= 10) {
		a = Math.min(x, x2);
		b = Math.max(x, x2);
	} else {
		a = 0;
		b = panel.enclosure.w;
		for (const d of panel.ducts) {
			if (!isVertical(d) || y < d.y || y > d.y + d.h) continue;
			if (d.x + d.w <= x) a = Math.max(a, d.x + d.w);
			else if (d.x >= x) b = Math.min(b, d.x);
		}
	}
	const rail: Rail = { id: newId('r'), x: round1(a), y: round1(y), length: round1(b - a) };
	panel.rails.push(rail);
	return rail;
}

export function addDuct(panel: Panel, r: Rect, depth = 80): Duct {
	const duct: Duct = { id: newId('g'), ...r, depth };
	panel.ducts.push(duct);
	return duct;
}

// ---------------------------------------------------------------- appareils à placer

export interface Candidate {
	/** `d:<deviceId>` ou `s:<préfixe>`. */
	key: string;
	deviceId?: Id;
	strip?: string;
	tag: string;
	designation: string;
	mounting: Mounting;
	w: number;
	h: number;
	/** Premier folio du schéma où l'appareil apparaît (regroupement en façade). */
	folioIndex: number;
	x: number;
	/** Déjà posé (dans un folio du même type). */
	placed?: { folioId: Id; itemId: Id };
}

/** Nombre de bornes par bornier (préfixe), d'après les symboles de rôle `terminal`. */
export function stripCounts(project: Project): Map<string, number> {
	const devices = new Map<string, Set<Id>>();
	for (const f of project.folios)
		for (const s of f.symbols) {
			const def = getSymbolDef(s.defId);
			if (def.role !== 'terminal') continue;
			const d = project.devices[s.deviceId];
			if (!d) continue;
			const prefix = parseTag(d.tag).prefix || def.prefix;
			const set = devices.get(prefix) ?? new Set();
			set.add(d.id);
			devices.set(prefix, set);
		}
	return new Map([...devices].map(([k, v]) => [k, v.size]));
}

/** Nom affiché d'un bornier monté. */
export const stripTag = (prefix: string) => `Bornier ${prefix}`;

/** Appareils du schéma et borniers, avec leur encombrement et leur état de pose. */
export function panelCandidates(project: Project, kind: PanelKind): Candidate[] {
	const placed = new Map<string, { folioId: Id; itemId: Id }>();
	for (const f of project.folios)
		if (f.panel?.kind === kind)
			for (const it of f.panel.items) {
				const key = it.deviceId ? `d:${it.deviceId}` : it.strip ? `s:${it.strip}` : '';
				if (key && !placed.has(key)) placed.set(key, { folioId: f.id, itemId: it.id });
			}

	const origin = new Map<Id, { folioIndex: number; x: number; role: string }>();
	project.folios.forEach((f, folioIndex) => {
		for (const s of f.symbols) {
			if (!s.deviceId || origin.has(s.deviceId)) continue;
			origin.set(s.deviceId, { folioIndex, x: s.x, role: getSymbolDef(s.defId).role });
		}
	});

	const out: Candidate[] = [];
	for (const d of Object.values(project.devices)) {
		const o = origin.get(d.id);
		if (!o || o.role === 'terminal' || o.role === 'link' || o.role === 'decor') continue;
		const fp: Footprint = deviceFootprint(project, d.id);
		const key = `d:${d.id}`;
		out.push({
			key,
			deviceId: d.id,
			tag: d.tag,
			designation: d.designation ?? '',
			mounting: fp.mounting,
			w: fp.w,
			h: fp.h,
			folioIndex: o.folioIndex,
			x: o.x,
			placed: placed.get(key)
		});
	}
	for (const [prefix, count] of stripCounts(project)) {
		const key = `s:${prefix}`;
		out.push({
			key,
			strip: prefix,
			tag: stripTag(prefix),
			designation: `${count} borne${count > 1 ? 's' : ''}`,
			mounting: 'rail',
			w: stripWidth(count),
			h: STRIP_H,
			folioIndex: Infinity,
			x: 0,
			placed: placed.get(key)
		});
	}
	return out;
}

/** Ordre de rangement : par type (protection, commande…) puis repère ; borniers à la fin. */
export function compareForRails(a: Candidate, b: Candidate): number {
	if (!!a.strip !== !!b.strip) return a.strip ? 1 : -1;
	const pa = parseTag(a.tag).prefix;
	const pb = parseTag(b.tag).prefix;
	return prefixRank(pa) - prefixRank(pb) || compareTags(a.tag, b.tag);
}

/** Ordre en façade : par folio du schéma, puis voyants avant commutateurs, puis repère. */
export function compareForDoor(a: Candidate, b: Candidate): number {
	return (
		a.folioIndex - b.folioIndex ||
		doorRank(parseTag(a.tag).prefix) - doorRank(parseTag(b.tag).prefix) ||
		a.x - b.x ||
		compareTags(a.tag, b.tag)
	);
}

/** Pose un appareil / bornier au point donné (mm réels) ; accroche au rail proche. */
export function addMount(panel: Panel, c: Candidate, at: Point): PanelItem {
	const item: PanelItem = {
		id: newId('m'),
		...(c.deviceId ? { deviceId: c.deviceId } : { strip: c.strip }),
		x: round1(at.x),
		y: round1(at.y),
		w: c.w,
		h: c.h
	};
	panel.items.push(item);
	settleOnRails(panel, [item.id]);
	return item;
}

/** Serre les appareils d'un rail vers la gauche, dans leur ordre actuel, sans espace. */
export function packRail(panel: Panel, railId: Id) {
	const rail = panel.rails.find((r) => r.id === railId);
	if (!rail) return;
	const items = panel.items.filter((it) => railOf(panel, it) === rail).sort((a, b) => a.x - b.x);
	let x = rail.x;
	for (const it of items) {
		it.x = round1(x + it.w / 2);
		x += it.w + GAP;
	}
}

// ---------------------------------------------------------------- contrôles

export interface RailFill {
	rail: Rail;
	items: PanelItem[];
	/** Largeur cumulée des appareils. */
	used: number;
	/** Plus de largeur d'appareils que de rail, ou appareil qui dépasse d'un bout. */
	overflow: boolean;
}

export function railFill(panel: Panel): RailFill[] {
	return panel.rails.map((rail) => {
		const items = panel.items.filter((it) => railOf(panel, it) === rail);
		const used = round1(items.reduce((s, it) => s + it.w, 0));
		const outside = items.some(
			(it) => it.x - it.w / 2 < rail.x - 0.5 || it.x + it.w / 2 > rail.x + rail.length + 0.5
		);
		return { rail, items, used, overflow: used > rail.length + 0.5 || outside };
	});
}

/** Éléments posés qui se chevauchent (ids). */
export function overlappingItems(panel: Panel): Set<Id> {
	const out = new Set<Id>();
	const shrink = (r: Rect): Rect => ({ x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 });
	const rects = panel.items.map((it) => ({ id: it.id, r: shrink(itemRect(it)) }));
	for (let i = 0; i < rects.length; i++)
		for (let j = i + 1; j < rects.length; j++)
			if (rectsIntersect(rects[i].r, rects[j].r)) {
				out.add(rects[i].id);
				out.add(rects[j].id);
			}
	return out;
}

/** Éléments sortant de l'armoire (ids). */
export function itemsOutside(panel: Panel): Set<Id> {
	const { w, h } = panel.enclosure;
	return new Set(
		panel.items
			.filter((it) => {
				const r = itemRect(it);
				return r.x < -0.5 || r.y < -0.5 || r.x + r.w > w + 0.5 || r.y + r.h > h + 0.5;
			})
			.map((it) => it.id)
	);
}

// ---------------------------------------------------------------- mise à jour automatique

/** Largeur des borniers posés = nombre de bornes actuel (appelé à chaque modification). */
export function syncPanels(project: Project) {
	let counts: Map<string, number> | null = null;
	for (const f of project.folios) {
		if (!f.panel) continue;
		for (const it of f.panel.items) {
			if (!it.strip) continue;
			counts ??= stripCounts(project);
			const w = stripWidth(counts.get(it.strip) ?? 0);
			if (it.w !== w) it.w = w;
		}
	}
}

/** Retire les appareils posés dont l'appareil a disparu du schéma, et les borniers vides. */
export function pruneMounts(project: Project) {
	let counts: Map<string, number> | null = null;
	for (const f of project.folios) {
		const panel = f.panel;
		if (!panel) continue;
		const keep = panel.items.filter((it) => {
			if (it.deviceId) return !!project.devices[it.deviceId];
			if (it.strip) return ((counts ??= stripCounts(project)).get(it.strip) ?? 0) > 0;
			return false;
		});
		if (keep.length !== panel.items.length) panel.items = keep;
	}
}

// ---------------------------------------------------------------- placement automatique

export interface AutoPlaceResult {
	placed: number;
	/** Appareils qui n'ont pas trouvé de place (rails pleins). */
	remaining: string[];
}

/** Espace entre deux appareils rangés automatiquement. */
const GAP = 0;

/** Famille de rangement : protection, commande (et le reste), borniers. */
function railGroup(c: Candidate): number {
	if (c.strip) return 2;
	return prefixRank(parseTag(c.tag).prefix) < prefixRank('KM') ? 0 : 1;
}

/**
 * Range sur les rails, de haut en bas et de gauche à droite, les appareils « sur rail »
 * pas encore posés, à la suite de ceux déjà en place. S'il y a assez de rails, chaque
 * famille (protection, commande, borniers) commence un nouveau rail, comme le folio
 * d'implantation de référence.
 */
function autoPlaceRails(project: Project, panel: Panel): AutoPlaceResult {
	const todo = panelCandidates(project, 'implantation')
		.filter((c) => c.mounting === 'rail' && !c.placed)
		.sort(compareForRails);
	const rails = [...panel.rails].sort((a, b) => a.y - b.y || a.x - b.x);
	const cursor = new Map(
		rails.map((r) => {
			const ends = panel.items.filter((it) => railOf(panel, it) === r).map((it) => it.x + it.w / 2);
			return [r.id, Math.max(r.x, ...ends)];
		})
	);
	const remaining: string[] = [];
	let placed = 0;
	let railIndex = 0;
	const spread = rails.length >= new Set(todo.map(railGroup)).size;
	let lastGroup: number | null = null;
	for (const c of todo) {
		const group = railGroup(c);
		if (spread && lastGroup !== null && group !== lastGroup && railIndex < rails.length - 1) {
			const r = rails[railIndex];
			if (cursor.get(r.id)! > r.x + 0.5) railIndex++;
		}
		lastGroup = group;
		let done = false;
		// Un appareil ne revient pas sur un rail précédent : l'ordre des types est conservé.
		for (let i = railIndex; i < rails.length && !done; i++) {
			const r = rails[i];
			const x0 = cursor.get(r.id)!;
			if (x0 + c.w > r.x + r.length + 0.5) continue;
			addMount(panel, c, { x: x0 + c.w / 2, y: r.y });
			cursor.set(r.id, x0 + c.w + GAP);
			railIndex = i;
			placed++;
			done = true;
		}
		if (!done) remaining.push(c.tag);
	}
	return { placed, remaining };
}

/**
 * Façade (mm réels) : pas des colonnes et des rangées, marge gauche, axe de la première
 * rangée, et hauteur réservée au titre de rangée au-dessus des appareils.
 */
const DOOR = { col: 55, row: 110, margin: 60, first: 80, title: 35 };

/**
 * Façade : une rangée par folio du schéma (voyants puis commutateurs), titrée par le
 * nom du folio, sous les éléments déjà posés.
 */
function autoPlaceDoor(project: Project, folio: Folio, panel: Panel): AutoPlaceResult {
	const todo = panelCandidates(project, 'facade')
		.filter((c) => c.mounting === 'porte' && !c.placed)
		.sort(compareForDoor);
	const { w, h } = panel.enclosure;
	const t = panelTransform(panel);
	const bottom = Math.max(0, ...panel.items.map((it) => it.y + it.h / 2));
	let y = panel.items.length ? snapReal(bottom + DOOR.row - 15) : DOOR.first;
	const maxX = w - DOOR.margin / 2;
	let placed = 0;
	const remaining: string[] = [];
	let group = -1;
	let x = DOOR.margin;
	for (const c of todo) {
		if (c.folioIndex !== group) {
			if (group !== -1) y += DOOR.row;
			group = c.folioIndex;
			x = DOOR.margin;
			const title = project.folios[c.folioIndex]?.title;
			if (title) folio.texts.push(rowTitle(t, { x: DOOR.margin - 15, y: y - DOOR.title }, title));
		} else if (x > maxX) {
			x = DOOR.margin;
			y += DOOR.row;
		}
		if (y > h) {
			remaining.push(c.tag);
			continue;
		}
		addMount(panel, c, { x, y });
		x += DOOR.col;
		placed++;
	}
	return { placed, remaining };
}

function rowTitle(t: PanelTransform, at: Point, text: string): TextItem {
	const p = toPage(t, at);
	return { id: newId('t'), x: p.x, y: p.y, text, size: 2.2, bold: true };
}

export function autoPlace(project: Project, folio: Folio): AutoPlaceResult {
	const panel = folio.panel;
	if (!panel) return { placed: 0, remaining: [] };
	return panel.kind === 'implantation'
		? autoPlaceRails(project, panel)
		: autoPlaceDoor(project, folio, panel);
}

/** Texte d'étiquette d'un élément posé. */
export function itemLabel(project: Project, item: PanelItem): string {
	if (item.strip) return stripTag(item.strip);
	const d = item.deviceId ? project.devices[item.deviceId] : undefined;
	return item.label || d?.designation || d?.tag || '?';
}

/** Repère affiché sur un élément posé. */
export function itemTag(project: Project, item: PanelItem): string {
	if (item.strip) return stripTag(item.strip);
	return (item.deviceId && project.devices[item.deviceId]?.tag) || '?';
}

// ---------------------------------------------------------------- contrôles du dossier

export interface PanelIssue {
	text: string;
	folioId: Id;
}

/**
 * Alertes des folios d'armoire : rail trop plein, chevauchements, appareil hors de
 * l'armoire, et appareils du schéma pas encore posés (s'il existe un folio de ce type).
 */
export function panelIssues(project: Project): PanelIssue[] {
	const out: PanelIssue[] = [];
	const firstOfKind = new Map<PanelKind, Id>();
	project.folios.forEach((f, i) => {
		const panel = f.panel;
		if (!panel) return;
		if (!firstOfKind.has(panel.kind)) firstOfKind.set(panel.kind, f.id);
		const num = String(i + 1).padStart(2, '0');
		railFill(panel).forEach((fill, r) => {
			if (fill.overflow)
				out.push({
					text: `Folio ${num} : rail ${r + 1} trop plein (${fill.used} mm d’appareils pour ${fill.rail.length} mm)`,
					folioId: f.id
				});
		});
		const overlap = overlappingItems(panel).size;
		if (overlap)
			out.push({ text: `Folio ${num} : ${overlap} appareils se chevauchent`, folioId: f.id });
		const outside = itemsOutside(panel).size;
		if (outside)
			out.push({ text: `Folio ${num} : ${outside} appareil(s) hors de l’armoire`, folioId: f.id });
	});
	for (const [kind, folioId] of firstOfKind) {
		const mounting: Mounting = kind === 'implantation' ? 'rail' : 'porte';
		const todo = panelCandidates(project, kind).filter((c) => c.mounting === mounting && !c.placed);
		if (todo.length)
			out.push({
				text: `${todo.length} appareil(s) à placer en ${kind === 'implantation' ? 'implantation' : 'façade'} : ${todo
					.slice(0, 6)
					.map((c) => c.tag)
					.join(', ')}${todo.length > 6 ? '…' : ''}`,
				folioId
			});
	}
	return out;
}
