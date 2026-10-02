/**
 * Opérations d'édition. Fonctions pures qui MUTENT le projet passé en argument
 * (l'éditeur les appelle dans une transaction d'historique).
 */
import { getSymbolDef } from '$lib/symbols';
import {
	boundsOf,
	distToPolyline,
	EPS,
	nextRotation,
	pointKey,
	pointOnPolyline,
	pointOnSegment,
	rectContainsPoint,
	rectContainsRect,
	rectsIntersect,
	simplifyPolyline,
	snap,
	type Rect
} from './geometry';
import { cableBounds, cableEllipseBounds, cableNameBounds, newCable, rotateCable } from './cables';
import { deepClone, newId } from './ids';
import {
	createPanel,
	deletePanelItems,
	isPanelKind,
	movePanelItems,
	PANEL_TITLES,
	panelHitTest,
	panelItemBounds,
	panelItems,
	projectEnclosure,
	pruneMounts
} from './panel';
import { createBar, createFolio } from './project';
import { symbolBounds, symbolTerminals } from './symbolGeometry';
import { nextFreeTag, parseTag } from './tags';
import type {
	CableItem,
	Folio,
	Id,
	ItemKind,
	PanelKind,
	ItemRef,
	Point,
	Project,
	RectItem,
	Rotation,
	SymbolInstance,
	TextItem,
	Wire
} from './types';

// ---------------------------------------------------------------- appareils

export function allTags(project: Project): string[] {
	return Object.values(project.devices).map((d) => d.tag);
}

export function createDevice(
	project: Project,
	prefix: string,
	defaults: { value?: string; designation?: string } = {}
) {
	const id = newId('d');
	project.devices[id] = { id, tag: nextFreeTag(prefix, allTags(project)), ...defaults };
	return project.devices[id];
}

export function findDeviceByTag(project: Project, tag: string) {
	const t = tag.trim().toUpperCase();
	return Object.values(project.devices).find((d) => d.tag.toUpperCase() === t);
}

export function symbolsOfDevice(project: Project, deviceId: Id): SymbolInstance[] {
	return project.folios.flatMap((f) => f.symbols.filter((s) => s.deviceId === deviceId));
}

/**
 * Change le repère d'un symbole :
 * - si un autre appareil porte déjà ce repère → le symbole y est RATTACHÉ (ex. contact → KM1) ;
 * - sinon → l'appareil est RENOMMÉ (tous ses symboles suivent).
 */
export function setSymbolTag(
	project: Project,
	symbol: SymbolInstance,
	tag: string
): 'linked' | 'renamed' | 'unchanged' {
	const clean = tag.trim();
	const current = project.devices[symbol.deviceId];
	if (!clean || current?.tag === clean) return 'unchanged';
	const existing = findDeviceByTag(project, clean);
	if (existing && existing.id !== symbol.deviceId) {
		symbol.deviceId = existing.id;
		removeOrphanDevices(project);
		return 'linked';
	}
	if (current) current.tag = clean;
	return 'renamed';
}

/** Détache un symbole de son appareil (nouvel appareil, nouveau repère). */
export function detachSymbol(project: Project, symbol: SymbolInstance) {
	const def = getSymbolDef(symbol.defId);
	const prefix = parseTag(project.devices[symbol.deviceId]?.tag ?? def.prefix).prefix || def.prefix;
	symbol.deviceId = createDevice(project, prefix).id;
}

export function removeOrphanDevices(project: Project) {
	const used = new Set(project.folios.flatMap((f) => f.symbols.map((s) => s.deviceId)));
	for (const id of Object.keys(project.devices)) if (!used.has(id)) delete project.devices[id];
	// Implantation / façade : les appareils disparus du schéma sont retirés.
	pruneMounts(project);
	pruneCustomSymbols(project);
}

/** Symboles maison posés sur au moins un folio du projet. */
export function usedCustomSymbolIds(project: Project): Set<string> {
	const ids = new Set<string>();
	for (const f of project.folios)
		for (const s of f.symbols) if (project.customSymbols[s.defId]) ids.add(s.defId);
	return ids;
}

/** Retire les copies embarquées des symboles maison qui ne sont plus posés nulle part. */
export function pruneCustomSymbols(project: Project) {
	const used = usedCustomSymbolIds(project);
	for (const id of Object.keys(project.customSymbols))
		if (!used.has(id)) delete project.customSymbols[id];
}

// ---------------------------------------------------------------- création

export function addSymbol(
	project: Project,
	folio: Folio,
	defId: string,
	pos: Point,
	rotation: Rotation = 0,
	mirror = false
): SymbolInstance {
	const def = getSymbolDef(defId);
	// Symbole maison : copie embarquée dans le projet (dossier autonome).
	if (def.custom) project.customSymbols[def.id] = deepClone(def);
	const device = def.role === 'decor' ? null : createDevice(project, def.prefix, def.defaults);
	const s: SymbolInstance = {
		id: newId('s'),
		defId,
		deviceId: device?.id ?? '',
		x: pos.x,
		y: pos.y,
		rotation,
		mirror
	};
	folio.symbols.push(s);
	return s;
}

export function addWire(folio: Folio, points: Point[]): Wire | null {
	const pts = simplifyPolyline(points);
	if (pts.length < 2) return null;
	const w: Wire = { id: newId('w'), points: pts };
	folio.wires.push(w);
	return w;
}

export function addBar(folio: Folio, potentialId: Id, y: number) {
	const bar = createBar(potentialId, snap(y));
	folio.bars.push(bar);
	return bar;
}

export function addText(folio: Folio, pos: Point, text: string, size = 2.5): TextItem {
	const t: TextItem = { id: newId('t'), x: pos.x, y: pos.y, text, size };
	folio.texts.push(t);
	return t;
}

export function addRect(folio: Folio, r: Rect, dashed = true): RectItem {
	const item: RectItem = { id: newId('r'), ...r, dashed };
	folio.rects.push(item);
	return item;
}

/** Câble tracé de `a` à `b` en travers des fils (conducteurs déduits des fils coupés). */
export function addCable(project: Project, folio: Folio, a: Point, b: Point, type?: string) {
	const cable: CableItem = newCable(project, folio, a, b, newId('c'), type);
	folio.cables.push(cable);
	return cable;
}

// ---------------------------------------------------------------- géométrie des éléments

export function textBounds(t: TextItem): Rect {
	const w = Math.max(1, t.text.length) * t.size * 0.56;
	const h = t.size * 1.2;
	const x = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
	const r = { x, y: t.y - t.size, w, h };
	if (t.rotation === 90 || t.rotation === 270) return { x: t.x - h / 2, y: t.y - w, w: h, h: w };
	return r;
}

export function itemBounds(folio: Folio, ref: ItemRef): Rect | null {
	if (isPanelKind(ref.kind)) return panelItemBounds(folio, ref);
	switch (ref.kind) {
		case 'symbol': {
			const s = folio.symbols.find((x) => x.id === ref.id);
			return s ? symbolBounds(s) : null;
		}
		case 'wire': {
			const w = folio.wires.find((x) => x.id === ref.id);
			return w ? boundsOf(w.points) : null;
		}
		case 'bar': {
			const b = folio.bars.find((x) => x.id === ref.id);
			return b ? { x: b.x1, y: b.y, w: b.x2 - b.x1, h: 0 } : null;
		}
		case 'text': {
			const t = folio.texts.find((x) => x.id === ref.id);
			return t ? textBounds(t) : null;
		}
		case 'rect': {
			const r = folio.rects.find((x) => x.id === ref.id);
			return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
		}
		case 'cable': {
			const c = folio.cables.find((x) => x.id === ref.id);
			return c ? cableBounds(c) : null;
		}
	}
}

export function allItems(folio: Folio): ItemRef[] {
	return [
		...folio.symbols.map((x) => ({ kind: 'symbol' as const, id: x.id })),
		...folio.wires.map((x) => ({ kind: 'wire' as const, id: x.id })),
		...folio.bars.map((x) => ({ kind: 'bar' as const, id: x.id })),
		...folio.texts.map((x) => ({ kind: 'text' as const, id: x.id })),
		...folio.rects.map((x) => ({ kind: 'rect' as const, id: x.id })),
		...folio.cables.map((x) => ({ kind: 'cable' as const, id: x.id })),
		...panelItems(folio)
	];
}

/** Élément sous le curseur (priorité : symbole, texte, nom de câble, fil, câble, barre, cadre). */
export function hitTest(folio: Folio, p: Point, tol: number): ItemRef | null {
	for (let i = folio.symbols.length - 1; i >= 0; i--) {
		const s = folio.symbols[i];
		if (rectContainsPoint(symbolBounds(s), p, tol * 0.5)) return { kind: 'symbol', id: s.id };
	}
	for (const t of folio.texts)
		if (rectContainsPoint(textBounds(t), p, tol * 0.5)) return { kind: 'text', id: t.id };
	for (const c of folio.cables)
		if (rectContainsPoint(cableNameBounds(c), p, tol * 0.5)) return { kind: 'cable', id: c.id };
	const mounted = panelHitTest(folio, p, tol);
	if (mounted) return mounted;
	let best: { ref: ItemRef; d: number } | null = null;
	for (const w of folio.wires) {
		const d = distToPolyline(p, w.points);
		if (d <= tol && (!best || d < best.d)) best = { ref: { kind: 'wire', id: w.id }, d };
	}
	if (best) return best.ref;
	for (const c of folio.cables)
		if (rectContainsPoint(cableEllipseBounds(c), p, tol)) return { kind: 'cable', id: c.id };
	for (const b of folio.bars)
		if (p.x >= b.x1 - tol && p.x <= b.x2 + tol && Math.abs(p.y - b.y) <= tol)
			return { kind: 'bar', id: b.id };
	for (const r of folio.rects) {
		const edges = [
			{ x: r.x, y: r.y },
			{ x: r.x + r.w, y: r.y },
			{ x: r.x + r.w, y: r.y + r.h },
			{ x: r.x, y: r.y + r.h },
			{ x: r.x, y: r.y }
		];
		if (distToPolyline(p, edges) <= tol) return { kind: 'rect', id: r.id };
	}
	return null;
}

/** Sélection rectangle : `inside` = entièrement contenu, `touch` = intersecte. */
export function itemsInRect(folio: Folio, rect: Rect, mode: 'inside' | 'touch'): ItemRef[] {
	return allItems(folio).filter((ref) => {
		const b = itemBounds(folio, ref);
		if (!b) return false;
		return mode === 'inside' ? rectContainsRect(rect, b) : rectsIntersect(rect, b);
	});
}

// ---------------------------------------------------------------- déplacement

const groupIds = (refs: ItemRef[], kind: ItemKind) =>
	new Set(refs.filter((r) => r.kind === kind).map((r) => r.id));

/**
 * Déplace une extrémité de fil en conservant un tracé orthogonal
 * (le segment adjacent suit ; un coude est ajouté si nécessaire).
 */
export function dragWireEnd(points: Point[], index: number, to: Point): Point[] {
	const pts = points.map((p) => ({ ...p }));
	const last = pts.length - 1;
	const old = pts[index];
	const nIdx = index === 0 ? 1 : last - 1;
	const n = pts[nIdx];
	const wasVertical = Math.abs(old.x - n.x) < EPS;
	pts[index] = { ...to };
	if (pts.length === 2) {
		if (wasVertical && Math.abs(to.x - n.x) > EPS) {
			const midY = snap((to.y + n.y) / 2);
			const mid = [
				{ x: to.x, y: midY },
				{ x: n.x, y: midY }
			];
			pts.splice(1, 0, ...(index === 0 ? mid : mid.reverse()));
		} else if (!wasVertical && Math.abs(to.y - n.y) > EPS) {
			const midX = snap((to.x + n.x) / 2);
			const mid = [
				{ x: midX, y: to.y },
				{ x: midX, y: n.y }
			];
			pts.splice(1, 0, ...(index === 0 ? mid : mid.reverse()));
		}
	} else if (wasVertical) n.x = to.x;
	else n.y = to.y;
	return simplifyPolyline(pts);
}

export function moveItems(folio: Folio, refs: ItemRef[], dx: number, dy: number) {
	if (!dx && !dy) return;
	movePanelItems(folio, refs, dx, dy);
	const symIds = groupIds(refs, 'symbol');
	const wireIds = groupIds(refs, 'wire');
	const barIds = groupIds(refs, 'bar');

	// Points d'accroche qui bougent : bornes des symboles, tracés des fils, barres déplacés.
	const movedTerminalKeys = new Set<string>();
	for (const s of folio.symbols)
		if (symIds.has(s.id)) for (const t of symbolTerminals(s)) movedTerminalKeys.add(pointKey(t));
	const movedWires = folio.wires
		.filter((w) => wireIds.has(w.id))
		.map((w) => w.points.map((p) => ({ ...p })));
	const movedBars = folio.bars.filter((b) => barIds.has(b.id)).map((b) => ({ ...b }));

	const follows = (p: Point) =>
		movedTerminalKeys.has(pointKey(p)) ||
		movedWires.some((pts) => pointOnPolyline(p, pts)) ||
		movedBars.some((b) => pointOnSegment(p, { x: b.x1, y: b.y }, { x: b.x2, y: b.y }));

	// Fils non sélectionnés : leurs extrémités accrochées suivent (élastique orthogonal).
	for (const w of folio.wires) {
		if (wireIds.has(w.id) || w.points.length < 2) continue;
		const last = w.points.length - 1;
		const moveStart = follows(w.points[0]);
		const moveEnd = follows(w.points[last]);
		if (moveStart && moveEnd) {
			w.points = w.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
			continue;
		}
		if (moveStart)
			w.points = dragWireEnd(w.points, 0, { x: w.points[0].x + dx, y: w.points[0].y + dy });
		if (moveEnd)
			w.points = dragWireEnd(w.points, last, {
				x: w.points[last].x + dx,
				y: w.points[last].y + dy
			});
	}

	for (const s of folio.symbols)
		if (symIds.has(s.id)) {
			s.x += dx;
			s.y += dy;
		}
	for (const w of folio.wires)
		if (wireIds.has(w.id)) w.points = w.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
	for (const b of folio.bars)
		if (barIds.has(b.id)) {
			b.y += dy;
			b.x1 += dx;
			b.x2 += dx;
		}
	const textIds = groupIds(refs, 'text');
	for (const t of folio.texts)
		if (textIds.has(t.id)) {
			t.x += dx;
			t.y += dy;
		}
	const rectIds = groupIds(refs, 'rect');
	for (const r of folio.rects)
		if (rectIds.has(r.id)) {
			r.x += dx;
			r.y += dy;
		}
	const cableIds = groupIds(refs, 'cable');
	for (const c of folio.cables)
		if (cableIds.has(c.id)) {
			c.x += dx;
			c.y += dy;
		}
}

/** Index du segment de fil le plus proche d'un point. */
export function nearestSegment(points: Point[], p: Point): number {
	let best = 0,
		bestD = Infinity;
	for (let i = 0; i < points.length - 1; i++) {
		const d = distToPolyline(p, [points[i], points[i + 1]]);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
}

/**
 * Déplace un segment de fil perpendiculairement à sa direction. Les extrémités du
 * fil restent accrochées : un segment d'about est créé si nécessaire.
 * Travaille sur une copie des points d'origine (`base`) pour un glissé sans dérive.
 */
export function moveWireSegment(base: Point[], seg: number, dx: number, dy: number): Point[] {
	const pts = base.map((p) => ({ ...p }));
	const a = pts[seg];
	const b = pts[seg + 1];
	const vertical = Math.abs(a.x - b.x) < EPS;
	const off = vertical ? { x: dx, y: 0 } : { x: 0, y: dy };
	if (!off.x && !off.y) return simplifyPolyline(pts);
	const last = pts.length - 1;
	const na = { x: a.x + off.x, y: a.y + off.y };
	const nb = { x: b.x + off.x, y: b.y + off.y };
	const out = [...pts.slice(0, seg)];
	out.push(seg === 0 ? a : na);
	if (seg === 0) out.push(na);
	if (seg + 1 === last) out.push(nb, b);
	else out.push(nb);
	// Les segments voisins (perpendiculaires) restent orthogonaux sans autre ajustement.
	out.push(...pts.slice(seg + 2));
	return simplifyPolyline(out);
}

// ---------------------------------------------------------------- suppression, rotation

export function deleteItems(project: Project, folio: Folio, refs: ItemRef[]) {
	const del = (kind: ItemKind) => groupIds(refs, kind);
	const s = del('symbol'),
		w = del('wire'),
		b = del('bar'),
		t = del('text'),
		r = del('rect'),
		c = del('cable');
	folio.symbols = folio.symbols.filter((x) => !s.has(x.id));
	folio.wires = folio.wires.filter((x) => !w.has(x.id));
	folio.bars = folio.bars.filter((x) => !b.has(x.id));
	folio.texts = folio.texts.filter((x) => !t.has(x.id));
	folio.rects = folio.rects.filter((x) => !r.has(x.id));
	folio.cables = folio.cables.filter((x) => !c.has(x.id));
	deletePanelItems(folio, refs);
	removeOrphanDevices(project);
}

export function rotateItems(folio: Folio, refs: ItemRef[]) {
	const ids = groupIds(refs, 'symbol');
	for (const s of folio.symbols) if (ids.has(s.id)) s.rotation = nextRotation(s.rotation);
	const tids = groupIds(refs, 'text');
	for (const t of folio.texts)
		if (tids.has(t.id)) t.rotation = t.rotation === 270 ? undefined : t.rotation === 90 ? 270 : 90;
	const cids = groupIds(refs, 'cable');
	for (const c of folio.cables) if (cids.has(c.id)) rotateCable(c);
}

export function mirrorItems(folio: Folio, refs: ItemRef[]) {
	const ids = groupIds(refs, 'symbol');
	for (const s of folio.symbols) if (ids.has(s.id)) s.mirror = !s.mirror;
}

// ---------------------------------------------------------------- folios

export function addFolio(project: Project, afterIndex: number, title = 'Nouveau folio'): Folio {
	const folio = createFolio(title);
	// Les barres de potentiel sont reprises du folio de schéma précédent (continuité du dossier).
	const prev = project.folios
		.slice(0, afterIndex + 1)
		.reverse()
		.find((f) => !f.panel);
	if (prev) folio.bars = prev.bars.map((b) => ({ ...b, id: newId('b') }));
	project.folios.splice(afterIndex + 1, 0, folio);
	return folio;
}

/**
 * Folio d'implantation ou de façade, à la suite de `afterIndex`. L'armoire reprend les
 * dimensions d'un folio d'armoire existant (implantation et façade de la même armoire).
 */
/** Folio borniers automatique (dessin des borniers, `prefixes` vide = tous). */
export function addStripsFolio(
	project: Project,
	afterIndex: number,
	prefixes: string[] = []
): Folio {
	const folio = createFolio('BORNIERS');
	folio.strips = { prefixes: [...prefixes] };
	project.folios.splice(afterIndex + 1, 0, folio);
	return folio;
}

export function addPanelFolio(project: Project, afterIndex: number, kind: PanelKind): Folio {
	const folio = createFolio(PANEL_TITLES[kind]);
	folio.panel = createPanel(kind, projectEnclosure(project));
	project.folios.splice(afterIndex + 1, 0, folio);
	return folio;
}

export function deleteFolio(project: Project, folioId: Id) {
	if (project.folios.length <= 1) return;
	project.folios = project.folios.filter((f) => f.id !== folioId);
	removeOrphanDevices(project);
}

export function moveFolio(project: Project, from: number, to: number) {
	if (to < 0 || to >= project.folios.length || from === to) return;
	const [f] = project.folios.splice(from, 1);
	project.folios.splice(to, 0, f);
}

// ---------------------------------------------------------------- alignement

export type AlignMode = 'left' | 'axis' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Abscisse / ordonnée de référence d'un élément. Pour un symbole, l'« axe » est
 * l'abscisse de sa première borne (l'axe du fil) : aligner des symboles sur l'axe
 * les met sur le même conducteur vertical.
 */
function anchorOf(folio: Folio, ref: ItemRef, mode: AlignMode): number | null {
	const b = itemBounds(folio, ref);
	if (!b) return null;
	switch (mode) {
		case 'left':
			return b.x;
		case 'right':
			return b.x + b.w;
		case 'top':
			return b.y;
		case 'bottom':
			return b.y + b.h;
		case 'middle':
			return b.y + b.h / 2;
		case 'axis': {
			const s = ref.kind === 'symbol' ? folio.symbols.find((x) => x.id === ref.id) : undefined;
			return s ? s.x : b.x + b.w / 2;
		}
	}
}

const isHorizontalMode = (mode: AlignMode) =>
	mode === 'left' || mode === 'axis' || mode === 'right';

/** Éléments alignables (les fils suivent leurs symboles, ils ne sont pas alignés eux-mêmes). */
const alignable = (refs: ItemRef[]) => refs.filter((r) => r.kind !== 'wire' && r.kind !== 'bar');

/**
 * Aligne les éléments sur le premier sélectionné (référence), comme dans les logiciels
 * de DAO : la référence ne bouge pas. Déplacements magnétisés sur la grille.
 */
export function alignItems(folio: Folio, refs: ItemRef[], mode: AlignMode) {
	const items = alignable(refs);
	if (items.length < 2) return;
	const target = anchorOf(folio, items[0], mode);
	if (target === null) return;
	for (const ref of items.slice(1)) {
		const cur = anchorOf(folio, ref, mode);
		if (cur === null) continue;
		const d = snap(target - cur);
		if (isHorizontalMode(mode)) moveItems(folio, [ref], d, 0);
		else moveItems(folio, [ref], 0, d);
	}
}

/** Répartit les éléments à intervalles égaux entre le premier et le dernier (par axe). */
export function distributeItems(
	folio: Folio,
	refs: ItemRef[],
	direction: 'horizontal' | 'vertical'
) {
	const mode: AlignMode = direction === 'horizontal' ? 'axis' : 'middle';
	const items = alignable(refs)
		.map((ref) => ({ ref, pos: anchorOf(folio, ref, mode) }))
		.filter((i): i is { ref: ItemRef; pos: number } => i.pos !== null)
		.sort((a, b) => a.pos - b.pos);
	if (items.length < 3) return;
	const first = items[0].pos;
	const step = (items[items.length - 1].pos - first) / (items.length - 1);
	items.slice(1, -1).forEach((item, i) => {
		const d = snap(first + step * (i + 1) - item.pos);
		if (direction === 'horizontal') moveItems(folio, [item.ref], d, 0);
		else moveItems(folio, [item.ref], 0, d);
	});
}

// ---------------------------------------------------------------- échelle

export const SCALE_MIN = 0.2;
export const SCALE_MAX = 5;

/** Seuls les symboles maison (images, blocs) se redimensionnent sur le folio. */
export function isScalable(s: SymbolInstance): boolean {
	return !!getSymbolDef(s.defId).custom;
}

/**
 * Change l'échelle d'un exemplaire de symbole (ancré sur son origine). Les fils
 * raccordés à ses bornes suivent en restant orthogonaux.
 */
export function scaleSymbol(folio: Folio, symbolId: Id, scale: number) {
	const s = folio.symbols.find((x) => x.id === symbolId);
	if (!s) return;
	const k = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(scale * 100) / 100));
	const before = symbolTerminals(s);
	s.scale = k === 1 ? undefined : k;
	const after = symbolTerminals(s);
	const moves = new Map(before.map((t, i) => [pointKey(t), after[i]]));
	for (const w of folio.wires) {
		const last = w.points.length - 1;
		for (const i of [0, last]) {
			const to = moves.get(pointKey(w.points[i]));
			if (to) w.points = dragWireEnd(w.points, i, { x: to.x, y: to.y });
		}
	}
}
