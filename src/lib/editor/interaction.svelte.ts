/**
 * Interactions souris / clavier du canvas. Traduit les gestes en appels aux
 * commandes de l'éditeur ; aucune règle métier ici (elles sont dans $lib/model).
 */
import { projectStrips } from '$lib/model/analysis';
import { crossTargets } from '$lib/model/crossrefs';
import { stripFolioPage, stripTerminalAt } from '$lib/model/stripDrawing';
import * as edit from '$lib/model/edit';
import { getSymbolDef } from '$lib/symbols';
import {
	rectFromPoints,
	routeWire,
	samePoint,
	simplifyPolyline,
	type Dir,
	type Rect
} from '$lib/model/geometry';
import {
	addDuct,
	addMount,
	addRailAt,
	panelTransform,
	settleOnRails,
	toReal
} from '$lib/model/panel';
import { isConnectionPoint, snapTarget, type SnapResult } from '$lib/model/snap';
import type { ItemRef, Point } from '$lib/model/types';
import type { Editor } from './editor.svelte';

/** Distance (px écran) pour le magnétisme et la sélection. */
const HIT_PX = 7;
/** Déplacement minimal (px) avant de considérer un glisser. */
const DRAG_PX = 4;

type Drag =
	| { kind: 'none' }
	| {
			kind: 'pan';
			lastX: number;
			lastY: number;
			/** Clic droit : sans déplacement, ouvre le menu contextuel au relâcher. */
			menu?: { clientX: number; clientY: number; at: Point; moved: boolean };
	  }
	| { kind: 'pending'; screen: Point; model: Point; ref: ItemRef | null; additive: boolean }
	| { kind: 'move'; last: Point; moved: boolean }
	| { kind: 'segment'; wireId: string; seg: number; base: Point[]; start: Point; moved: boolean }
	| { kind: 'box'; start: Point; current: Point; additive: boolean }
	| { kind: 'rect'; start: Point; current: Point }
	| { kind: 'cable'; start: Point; current: Point }
	| { kind: 'rail'; start: Point; current: Point }
	| { kind: 'duct'; start: Point; current: Point }
	| { kind: 'scale'; symbolId: string; origin: Point; base: number; d0: number; moved: boolean };

/** Extrémité d'un câble : axe horizontal ou vertical selon le geste. */
function cableEnd(start: Point, current: Point): Point {
	return Math.abs(current.x - start.x) >= Math.abs(current.y - start.y)
		? { x: current.x, y: start.y }
		: { x: start.x, y: current.y };
}

export class Interaction {
	/** Rectangle de sélection en cours (mode `inside` si tiré vers la droite). */
	box: (Rect & { mode: 'inside' | 'touch' }) | null = $state(null);
	/** Cadre en cours de tracé (outil cadre). */
	drawingRect: Rect | null = $state(null);
	/** Axe du câble en cours de tracé (outil câble). */
	drawingCable: { a: Point; b: Point } | null = $state(null);
	/** Rail en cours de tracé (folio d'implantation). */
	drawingRail: { a: Point; b: Point } | null = $state(null);
	/** Points validés du fil en cours. */
	wirePoints: Point[] = $state([]);
	snapResult: SnapResult | null = $state(null);
	hover: ItemRef | null = $state(null);
	spaceDown = $state(false);
	/** Curseur au-dessus de la poignée de redimensionnement. */
	overHandle = $state(false);
	panning = $state(false);
	/** Menu contextuel ouvert (coordonnées écran + point modèle + élément visé). */
	menu: { x: number; y: number; at: Point; ref: ItemRef | null } | null = $state(null);

	private drag: Drag = { kind: 'none' };
	private horizontalFirst: boolean | null = null;
	/** Sens de sortie de la borne de départ du fil (premier tronçon seulement). */
	private startDir: Dir | undefined = undefined;

	constructor(private editor: Editor) {}

	/** Accroche du curseur : bornes / fils sur un schéma, grille réelle sur un folio d'armoire. */
	private target(p: Point): SnapResult {
		const ed = this.editor;
		return ed.panel ? { point: ed.snap(p), kind: 'grid' } : snapTarget(ed.folio, p, this.tol);
	}

	private get tol() {
		return HIT_PX / this.editor.viewport.scale;
	}

	/** Aperçu du fil : points validés + coude jusqu'au curseur. */
	get wirePreview(): Point[] {
		const pts = this.wirePoints;
		const target = this.snapResult?.point;
		if (!pts.length || !target) return [];
		const toDir = this.snapResult?.terminal?.dir;
		return [...pts.slice(0, -1), ...this.route(pts[pts.length - 1], target, toDir).points];
	}

	/**
	 * Tronçon du dernier point au curseur : sort dans le sens de la borne de départ (premier
	 * tronçon) et arrive dans le sens de la borne visée.
	 */
	private route(from: Point, to: Point, toDir?: Dir) {
		return routeWire(from, to, {
			fromDir: this.wirePoints.length === 1 ? this.startDir : undefined,
			toDir,
			horizontalFirst: this.horizontalFirst
		});
	}

	// ------------------------------------------------------------ souris

	pointerDown(e: PointerEvent, sx: number, sy: number) {
		const ed = this.editor;
		const p = ed.viewport.toModel(sx, sy);
		this.menu = null;
		if (e.button === 2 && ed.tool.kind === 'wire' && this.wirePoints.length) {
			this.finishWire();
			return;
		}
		if (e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)) {
			this.drag = {
				kind: 'pan',
				lastX: e.clientX,
				lastY: e.clientY,
				menu:
					e.button === 2
						? { clientX: e.clientX, clientY: e.clientY, at: p, moved: false }
						: undefined
			};
			this.panning = e.button !== 2;
			return;
		}
		if (e.button !== 0) return;
		const tool = ed.tool;
		const target = this.target(p);

		switch (tool.kind) {
			case 'wire':
				return this.wireClick(target);
			case 'place':
				ed.transact('Poser un symbole', (proj, f) => {
					const s = edit.addSymbol(proj, f, tool.defId, target.point, tool.rotation, tool.mirror);
					ed.selection = [{ kind: 'symbol', id: s.id }];
				});
				ed.lastPlacedDefId = tool.defId;
				return;
			case 'paste':
				ed.placeFragment(tool.fragment, ed.snap(p), tool.devices);
				ed.setTool({ kind: 'select' });
				return;
			case 'bar':
				ed.transact('Ajouter une barre', (_, f) => {
					const b = edit.addBar(f, tool.potentialId, target.point.y);
					ed.selection = [{ kind: 'bar', id: b.id }];
				});
				ed.setTool({ kind: 'select' });
				return;
			case 'text':
				ed.transact('Ajouter un texte', (_, f) => {
					const t = edit.addText(f, ed.snap(p), 'Texte');
					ed.selection = [{ kind: 'text', id: t.id }];
				});
				ed.setTool({ kind: 'select' });
				ed.requestFocus('text');
				return;
			case 'rect':
				this.drag = { kind: 'rect', start: ed.snap(p), current: ed.snap(p) };
				return;
			case 'cable':
				this.drag = { kind: 'cable', start: ed.snap(p), current: ed.snap(p) };
				return;
			case 'rail':
			case 'duct':
				this.drag = { kind: tool.kind, start: ed.snap(p), current: ed.snap(p) };
				return;
			case 'mount': {
				const panel = ed.panel;
				if (!panel) return;
				const at = toReal(panelTransform(panel), ed.snap(p));
				ed.transact('Placer un appareil', (_, f) => {
					const item = addMount(f.panel!, tool.candidate, at);
					ed.selection = [{ kind: 'mount', id: item.id }];
				});
				ed.setTool({ kind: 'select' });
				return;
			}
			default: {
				const h = ed.scaleHandle;
				if (h && Math.hypot(p.x - h.x, p.y - h.y) <= this.tol) {
					ed.beginGesture();
					this.drag = {
						kind: 'scale',
						symbolId: h.symbolId,
						origin: h.origin,
						base: h.scale,
						d0: Math.max(1e-6, Math.hypot(h.x - h.origin.x, h.y - h.origin.y)),
						moved: false
					};
					return;
				}
				const ref = edit.hitTest(ed.folio, p, this.tol);
				const additive = e.shiftKey || e.ctrlKey;
				if (ref && !ed.isSelected(ref)) ed.select([ref], additive);
				else if (ref && additive) ed.select([ref], true);
				this.drag = { kind: 'pending', screen: { x: sx, y: sy }, model: p, ref, additive };
			}
		}
	}

	pointerMove(e: PointerEvent, sx: number, sy: number): void {
		const ed = this.editor;
		const p = ed.viewport.toModel(sx, sy);
		const d = this.drag;

		if (d.kind === 'pan') {
			if (d.menu && !d.menu.moved) {
				if (Math.hypot(e.clientX - d.menu.clientX, e.clientY - d.menu.clientY) < DRAG_PX) return;
				d.menu.moved = true;
				this.panning = true;
			}
			ed.viewport.panBy(e.clientX - d.lastX, e.clientY - d.lastY);
			d.lastX = e.clientX;
			d.lastY = e.clientY;
			return;
		}

		this.snapResult = this.target(p);
		ed.cursor = this.snapResult.point;

		switch (d.kind) {
			case 'pending': {
				if (Math.hypot(sx - d.screen.x, sy - d.screen.y) < DRAG_PX) return;
				if (!d.ref) {
					this.drag = { kind: 'box', start: d.model, current: p, additive: d.additive };
					this.updateBox();
					return;
				}
				ed.beginGesture();
				const single = ed.selection.length === 1 && d.ref.kind === 'wire';
				const wire = single ? ed.folio.wires.find((w) => w.id === d.ref!.id) : undefined;
				if (wire) {
					this.drag = {
						kind: 'segment',
						wireId: wire.id,
						seg: edit.nearestSegment(wire.points, d.model),
						base: wire.points.map((q) => ({ ...q })),
						start: ed.snap(d.model),
						moved: false
					};
				} else this.drag = { kind: 'move', last: ed.snap(d.model), moved: false };
				return this.pointerMove(e, sx, sy);
			}
			case 'move': {
				const g = ed.snap(p);
				const dx = g.x - d.last.x;
				const dy = g.y - d.last.y;
				if (!dx && !dy) return;
				const refs = ed.selection;
				ed.gesture((_, f) => edit.moveItems(f, refs, dx, dy));
				d.last = g;
				d.moved = true;
				return;
			}
			case 'segment': {
				const g = ed.snap(p);
				const wire = ed.folio.wires.find((w) => w.id === d.wireId);
				if (!wire) return;
				const pts = edit.moveWireSegment(d.base, d.seg, g.x - d.start.x, g.y - d.start.y);
				ed.gesture(() => (wire.points = pts));
				d.moved = true;
				return;
			}
			case 'box':
				d.current = p;
				this.updateBox();
				return;
			case 'scale': {
				// Échelle proportionnelle à la distance à l'origine, par pas de 5 %.
				const k = (d.base * Math.hypot(p.x - d.origin.x, p.y - d.origin.y)) / d.d0;
				const stepped = Math.round(k * 20) / 20;
				ed.gesture((_, f) => edit.scaleSymbol(f, d.symbolId, stepped));
				d.moved = true;
				return;
			}
			case 'rect':
				d.current = ed.snap(p);
				this.drawingRect = rectFromPoints(d.start, d.current);
				return;
			case 'cable':
				d.current = ed.snap(p);
				this.drawingCable = { a: d.start, b: cableEnd(d.start, d.current) };
				return;
			case 'rail':
				d.current = ed.snap(p);
				this.drawingRail = { a: d.start, b: { x: d.current.x, y: d.start.y } };
				return;
			case 'duct':
				d.current = ed.snap(p);
				this.drawingRect = rectFromPoints(d.start, d.current);
				return;
			default: {
				const h = ed.scaleHandle;
				this.overHandle = !!h && Math.hypot(p.x - h.x, p.y - h.y) <= this.tol;
				if (ed.tool.kind === 'select') this.hover = edit.hitTest(ed.folio, p, this.tol);
			}
		}
	}

	pointerUp() {
		const ed = this.editor;
		const d = this.drag;
		this.drag = { kind: 'none' };
		this.panning = false;
		switch (d.kind) {
			case 'pan':
				if (d.menu && !d.menu.moved) this.openMenu(d.menu.clientX, d.menu.clientY, d.menu.at);
				return;
			case 'pending':
				if (!d.ref && !d.additive) ed.clearSelection();
				else if (d.ref && !d.additive && ed.selection.length > 1) ed.select([d.ref]);
				return;
			case 'move':
				// Folio d'implantation : un appareil lâché près d'un rail s'y accroche.
				if (ed.panel && d.moved) {
					const ids = ed.selection.filter((r) => r.kind === 'mount').map((r) => r.id);
					ed.gesture((_, f) => f.panel && settleOnRails(f.panel, ids));
				}
				ed.endGesture('Déplacer', d.moved);
				return;
			case 'rail': {
				this.drawingRail = null;
				const panel = ed.panel;
				if (panel) {
					const t = panelTransform(panel);
					const a = toReal(t, d.start);
					const b = toReal(t, d.current);
					ed.transact('Ajouter un rail', (_, f) => {
						const r = addRailAt(f.panel!, a.x, a.y, b.x);
						ed.selection = [{ kind: 'rail', id: r.id }];
					});
				}
				ed.setTool({ kind: 'select' });
				return;
			}
			case 'duct': {
				this.drawingRect = null;
				const panel = ed.panel;
				if (panel) {
					const t = panelTransform(panel);
					const a = toReal(t, d.start);
					const b = toReal(t, d.current);
					const r = rectFromPoints(a, b);
					if (r.w >= 10 && r.h >= 10)
						ed.transact('Ajouter une goulotte', (_, f) => {
							const g = addDuct(f.panel!, r);
							ed.selection = [{ kind: 'duct', id: g.id }];
						});
				}
				ed.setTool({ kind: 'select' });
				return;
			}
			case 'segment':
				ed.endGesture('Modifier le tracé', d.moved);
				return;
			case 'scale':
				ed.endGesture('Redimensionner', d.moved);
				return;
			case 'box': {
				const b = this.box;
				this.box = null;
				if (b) ed.select(edit.itemsInRect(ed.folio, b, b.mode), d.additive);
				return;
			}
			case 'rect': {
				this.drawingRect = null;
				const r = rectFromPoints(d.start, d.current);
				if (r.w >= 2.5 && r.h >= 2.5)
					ed.transact('Ajouter un cadre', (_, f) => {
						const item = edit.addRect(f, r);
						ed.selection = [{ kind: 'rect', id: item.id }];
					});
				ed.setTool({ kind: 'select' });
				return;
			}
			case 'cable': {
				this.drawingCable = null;
				const b = cableEnd(d.start, d.current);
				if (Math.hypot(b.x - d.start.x, b.y - d.start.y) >= 5)
					ed.transact('Ajouter un câble', (proj, f) => {
						const c = edit.addCable(proj, f, d.start, b);
						ed.selection = [{ kind: 'cable', id: c.id }];
					});
				ed.setTool({ kind: 'select' });
				return;
			}
		}
	}

	/** Ouvre le menu contextuel ; l'élément visé est sélectionné s'il ne l'était pas. */
	private openMenu(x: number, y: number, at: Point) {
		const ed = this.editor;
		if (ed.tool.kind !== 'select') ed.setTool({ kind: 'select' });
		const ref = edit.hitTest(ed.folio, at, this.tol);
		if (ref && !ed.isSelected(ref)) ed.select([ref]);
		if (!ref) ed.clearSelection();
		this.menu = { x, y, at: ed.snap(at), ref };
	}

	doubleClick(sx: number, sy: number) {
		const ed = this.editor;
		if (ed.tool.kind === 'wire') {
			this.finishWire();
			return;
		}
		// Folio borniers : double-clic sur une borne dessinée → son symbole dans le schéma.
		if (ed.folio.strips) {
			const page = stripFolioPage(
				ed.project,
				ed.folio,
				projectStrips(ed.project, ed.analysis)
			).page;
			const row = page && stripTerminalAt(page, ed.viewport.toModel(sx, sy));
			if (row) {
				ed.goToSymbol(row.symbolId);
				return;
			}
		}
		const ref = edit.hitTest(ed.folio, ed.viewport.toModel(sx, sy), this.tol);
		if (!ref) return;
		ed.select([ref]);
		if (ref.kind === 'symbol') {
			// Renvoi de fil → renvoi correspondant ; contact → sa bobine. Sinon : éditer le repère.
			const role = getSymbolDef(ed.folio.symbols.find((s) => s.id === ref.id)!.defId).role;
			const target =
				role === 'link' || role === 'slave' ? crossTargets(ed.project, ref.id)[0] : undefined;
			if (target) ed.goToSymbol(target.symbolId);
			else ed.requestFocus('tag');
		}
		if (ref.kind === 'text') ed.requestFocus('text');
		if (ref.kind === 'mount') {
			// Appareil posé en implantation / façade → son symbole dans le schéma.
			const item = ed.panel?.items.find((i) => i.id === ref.id);
			const s = item?.deviceId ? edit.symbolsOfDevice(ed.project, item.deviceId)[0] : undefined;
			if (s) ed.goToSymbol(s.id);
		}
	}

	wheel(e: WheelEvent, sx: number, sy: number) {
		const vp = this.editor.viewport;
		if (e.shiftKey) vp.panBy(-e.deltaY, 0);
		else vp.zoomBy(Math.exp(-e.deltaY * 0.0015), sx, sy);
	}

	leave() {
		this.snapResult = null;
		this.hover = null;
		this.editor.cursor = null;
	}

	private updateBox() {
		if (this.drag.kind !== 'box') return;
		const { start, current } = this.drag;
		this.box = {
			...rectFromPoints(start, current),
			mode: current.x >= start.x ? 'inside' : 'touch'
		};
	}

	// ------------------------------------------------------------ fils

	private wireClick(target: SnapResult) {
		const p = target.point;
		if (!this.wirePoints.length) {
			this.wirePoints = [p];
			this.startDir = target.terminal?.dir;
			this.horizontalFirst = null;
			return;
		}
		const last = this.wirePoints[this.wirePoints.length - 1];
		if (samePoint(last, p)) {
			this.finishWire();
			return;
		}
		const path = this.route(last, p, target.terminal?.dir).points;
		this.wirePoints = [...this.wirePoints, ...path.slice(1)];
		this.horizontalFirst = null;
		// Arrivée sur une borne / un fil / une barre : le fil est terminé.
		if (target.kind !== 'grid' || isConnectionPoint(this.editor.folio, p)) this.finishWire();
	}

	finishWire() {
		const pts = simplifyPolyline(this.wirePoints);
		this.wirePoints = [];
		this.horizontalFirst = null;
		if (pts.length < 2) return;
		this.editor.transact('Tracer un fil', (_, f) => edit.addWire(f, pts));
	}

	cancelWire() {
		this.wirePoints = [];
		this.horizontalFirst = null;
	}

	undoWirePoint() {
		this.wirePoints = this.wirePoints.slice(0, -1);
	}

	toggleWireDirection() {
		const pts = this.wirePoints;
		const target = this.snapResult?.point;
		if (!pts.length || !target) return;
		const toDir = this.snapResult?.terminal?.dir;
		this.horizontalFirst = !this.route(pts[pts.length - 1], target, toDir).horizontalFirst;
	}

	// ------------------------------------------------------------ clavier

	/** Retourne true si la touche a été traitée. */
	keyDown(e: KeyboardEvent): boolean {
		const ed = this.editor;
		const mod = e.ctrlKey || e.metaKey;
		const k = e.key.toLowerCase();

		if (e.key === ' ') {
			this.spaceDown = true;
			if (ed.tool.kind === 'wire' && this.wirePoints.length) this.toggleWireDirection();
			return true;
		}
		if (mod) {
			switch (k) {
				case 'z':
					if (e.shiftKey) ed.redo();
					else ed.undo();
					return true;
				case 'y':
					ed.redo();
					return true;
				case 'c':
					ed.copy();
					return true;
				case 'x':
					ed.cut();
					return true;
				case 'v':
					ed.paste();
					return true;
				case 'd':
					ed.duplicate();
					return true;
				case 'a':
					ed.selectAll();
					return true;
			}
			return false;
		}

		// Flèches : 2,5 mm sur un schéma, 5 mm réels sur un folio d'armoire (Maj : ×4 / ×10).
		const step = ed.panel
			? (e.shiftKey ? 50 : 5) * panelTransform(ed.panel).k
			: e.shiftKey
				? 10
				: 2.5;
		switch (e.key) {
			case 'Escape':
				if (this.wirePoints.length) this.cancelWire();
				else if (ed.tool.kind !== 'select') ed.setTool({ kind: 'select' });
				else ed.clearSelection();
				return true;
			case 'Delete':
				ed.deleteSelection();
				return true;
			case 'Backspace':
				if (this.wirePoints.length) this.undoWirePoint();
				else ed.deleteSelection();
				return true;
			case 'Enter':
				if (this.wirePoints.length) this.finishWire();
				else if (ed.tool.kind === 'select') return ed.repeatLastSymbol();
				return true;
			case 'F2':
				ed.editSelection();
				return true;
			case 'Home':
				ed.setFolio(ed.project.folios[0].id);
				return true;
			case 'End':
				ed.setFolio(ed.project.folios[ed.project.folios.length - 1].id);
				return true;
			case '+':
			case '=':
				ed.viewport.zoomBy(1.25);
				return true;
			case '-':
				ed.viewport.zoomBy(1 / 1.25);
				return true;
			case '1':
				ed.viewport.actualSize();
				return true;
			case '/':
				ed.requestFocus('symbolSearch');
				return true;
			case 'ArrowLeft':
				ed.nudge(-step, 0);
				return true;
			case 'ArrowRight':
				ed.nudge(step, 0);
				return true;
			case 'ArrowUp':
				ed.nudge(0, -step);
				return true;
			case 'ArrowDown':
				ed.nudge(0, step);
				return true;
			case 'PageUp':
				ed.stepFolio(-1);
				return true;
			case 'PageDown':
				ed.stepFolio(1);
				return true;
		}
		switch (k) {
			case 'r':
				ed.rotate();
				return true;
			case 'x':
				ed.mirror();
				return true;
			case 'w':
				ed.setTool({ kind: 'wire' });
				return true;
			case 't':
				ed.setTool({ kind: 'text' });
				return true;
			case 'c':
				ed.setTool({ kind: 'rect' });
				return true;
			case 'k':
				ed.setTool({ kind: 'cable' });
				return true;
			case 'b':
				ed.setTool({ kind: 'bar', potentialId: ed.barPotential });
				return true;
			case 's':
			case 'v':
				this.cancelWire();
				ed.setTool({ kind: 'select' });
				return true;
			case 'f':
				ed.viewport.fit();
				return true;
			case 'g':
				ed.setGrid({ show: !ed.grid.show });
				return true;
		}
		return false;
	}

	keyUp(e: KeyboardEvent) {
		if (e.key === ' ') this.spaceDown = false;
	}
}
