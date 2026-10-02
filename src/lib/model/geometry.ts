import type { Point, Rotation } from './types';

export const EPS = 0.01;

export const GRID = 2.5;

export function snap(v: number, step = GRID): number {
	return Math.round(v / step) * step;
}

export function snapPoint(p: Point, step = GRID): Point {
	return { x: snap(p.x, step), y: snap(p.y, step) };
}

export function samePoint(a: Point, b: Point): boolean {
	return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

/** Clé stable d'un point (arrondi au 1/100 mm). */
export function pointKey(p: Point): string {
	return `${Math.round(p.x * 100)},${Math.round(p.y * 100)}`;
}

/** Transforme un point local de symbole en coordonnées folio. */
export function transformPoint(
	local: Point,
	origin: Point,
	rotation: Rotation,
	mirror = false,
	scale = 1
): Point {
	const x = (mirror ? -local.x : local.x) * scale;
	const y = local.y * scale;
	let rx: number, ry: number;
	switch (rotation) {
		case 90:
			rx = -y;
			ry = x;
			break;
		case 180:
			rx = -x;
			ry = -y;
			break;
		case 270:
			rx = y;
			ry = -x;
			break;
		default:
			rx = x;
			ry = y;
	}
	return { x: origin.x + rx, y: origin.y + ry };
}

export type Dir = 'n' | 's' | 'e' | 'w';

const DIRS: Dir[] = ['n', 'e', 's', 'w'];

export function transformDir(dir: Dir, rotation: Rotation, mirror = false): Dir {
	let d = dir;
	if (mirror && (d === 'e' || d === 'w')) d = d === 'e' ? 'w' : 'e';
	const i = DIRS.indexOf(d);
	return DIRS[(i + rotation / 90) % 4];
}

export function nextRotation(r: Rotation): Rotation {
	return ((r + 90) % 360) as Rotation;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export function rectFromPoints(a: Point, b: Point): Rect {
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		w: Math.abs(a.x - b.x),
		h: Math.abs(a.y - b.y)
	};
}

export function transformRect(
	r: Rect,
	origin: Point,
	rotation: Rotation,
	mirror = false,
	scale = 1
): Rect {
	const corners = [
		{ x: r.x, y: r.y },
		{ x: r.x + r.w, y: r.y },
		{ x: r.x, y: r.y + r.h },
		{ x: r.x + r.w, y: r.y + r.h }
	].map((c) => transformPoint(c, origin, rotation, mirror, scale));
	return boundsOf(corners);
}

export function boundsOf(points: Point[]): Rect {
	let x1 = Infinity,
		y1 = Infinity,
		x2 = -Infinity,
		y2 = -Infinity;
	for (const p of points) {
		x1 = Math.min(x1, p.x);
		y1 = Math.min(y1, p.y);
		x2 = Math.max(x2, p.x);
		y2 = Math.max(y2, p.y);
	}
	return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function unionRects(rects: Rect[]): Rect | null {
	if (!rects.length) return null;
	return boundsOf(
		rects.flatMap((r) => [
			{ x: r.x, y: r.y },
			{ x: r.x + r.w, y: r.y + r.h }
		])
	);
}

export function rectContainsPoint(r: Rect, p: Point, margin = 0): boolean {
	return (
		p.x >= r.x - margin &&
		p.x <= r.x + r.w + margin &&
		p.y >= r.y - margin &&
		p.y <= r.y + r.h + margin
	);
}

export function rectContainsRect(outer: Rect, inner: Rect): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.w <= outer.x + outer.w &&
		inner.y + inner.h <= outer.y + outer.h
	);
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
	return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/** Le point est-il sur le segment [a,b] (extrémités incluses) ? */
export function pointOnSegment(p: Point, a: Point, b: Point, tol = EPS): boolean {
	return distToSegment(p, a, b) <= tol;
}

export function distToSegment(p: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
	t = Math.max(0, Math.min(1, t));
	const cx = a.x + t * dx;
	const cy = a.y + t * dy;
	return Math.hypot(p.x - cx, p.y - cy);
}

export function pointOnPolyline(p: Point, pts: Point[], tol = EPS): boolean {
	for (let i = 0; i < pts.length - 1; i++)
		if (pointOnSegment(p, pts[i], pts[i + 1], tol)) return true;
	return false;
}

export function distToPolyline(p: Point, pts: Point[]): number {
	let d = Infinity;
	for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(p, pts[i], pts[i + 1]));
	return d;
}

/** Supprime les points dupliqués et les points intermédiaires colinéaires. */
export function simplifyPolyline(pts: Point[]): Point[] {
	const out: Point[] = [];
	for (const p of pts) {
		if (out.length && samePoint(out[out.length - 1], p)) continue;
		out.push({ x: p.x, y: p.y });
	}
	let changed = true;
	while (changed && out.length > 2) {
		changed = false;
		for (let i = 1; i < out.length - 1; i++) {
			const a = out[i - 1],
				b = out[i],
				c = out[i + 1];
			const colinear =
				(Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS) ||
				(Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS);
			if (colinear) {
				out.splice(i, 1);
				changed = true;
				break;
			}
		}
	}
	return out;
}

/**
 * Chemin orthogonal entre deux points : un coude.
 * `horizontalFirst` : d'abord horizontal puis vertical.
 */
export function orthoPath(a: Point, b: Point, horizontalFirst: boolean): Point[] {
	if (Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS) return [a, b];
	const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
	return [a, corner, b];
}

/** Vecteur unitaire d'une direction de sortie de fil. */
export const DIR_VEC: Record<Dir, Point> = {
	n: { x: 0, y: -1 },
	s: { x: 0, y: 1 },
	w: { x: -1, y: 0 },
	e: { x: 1, y: 0 }
};

/** Longueur minimale du fil dans le sens de sortie d'une borne avant le premier coude (mm). */
export const WIRE_STUB = 5;

/** Nombre de demi-tours (segment qui repart en arrière sur le précédent). */
function backtracks(pts: Point[]): number {
	const segs: Point[] = [];
	for (let i = 1; i < pts.length; i++) {
		const dx = pts[i].x - pts[i - 1].x,
			dy = pts[i].y - pts[i - 1].y;
		if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue;
		segs.push({ x: Math.sign(Math.round(dx * 100)), y: Math.sign(Math.round(dy * 100)) });
	}
	let n = 0;
	for (let i = 1; i < segs.length; i++)
		if (segs[i].x === -segs[i - 1].x && segs[i].y === -segs[i - 1].y) n++;
	return n;
}

/**
 * Tracé d'un tronçon de fil entre deux points, à angles droits. Depuis une borne
 * (`fromDir`), le fil sort d'abord dans le sens de la borne ; vers une borne (`toDir`), il
 * y arrive dans son sens (comme on le dessine à la main). Des deux coudes possibles, on
 * garde celui qui ne revient pas en arrière et fait le moins de coudes ; `horizontalFirst`
 * impose le choix (Espace).
 */
export function routeWire(
	a: Point,
	b: Point,
	opts: { fromDir?: Dir; toDir?: Dir; horizontalFirst?: boolean | null; stub?: number } = {}
): { points: Point[]; horizontalFirst: boolean } {
	const stub = opts.stub ?? WIRE_STUB;
	const out = (p: Point, d?: Dir) =>
		d ? { x: p.x + DIR_VEC[d].x * stub, y: p.y + DIR_VEC[d].y * stub } : p;
	const s = out(a, opts.fromDir);
	const e = out(b, opts.toDir);
	const build = (h: boolean) => [a, ...orthoPath(s, e, h), b];
	const preferred = opts.fromDir
		? opts.fromDir === 'e' || opts.fromDir === 'w'
		: Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
	let h = preferred;
	if (opts.horizontalFirst != null) h = opts.horizontalFirst;
	else {
		const score = (c: boolean) => {
			const raw = build(c);
			return backtracks(raw) * 100 + simplifyPolyline(raw).length;
		};
		if (score(!preferred) < score(preferred)) h = !preferred;
	}
	return { points: simplifyPolyline(build(h)), horizontalFirst: h };
}

/** Longueur et milieu du plus long segment d'une polyligne. */
export function longestSegment(pts: Point[]): {
	a: Point;
	b: Point;
	mid: Point;
	vertical: boolean;
} {
	let best = { a: pts[0], b: pts[1] ?? pts[0], len: -1 };
	for (let i = 0; i < pts.length - 1; i++) {
		const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
		if (len > best.len) best = { a: pts[i], b: pts[i + 1], len };
	}
	return {
		a: best.a,
		b: best.b,
		mid: { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 },
		vertical: Math.abs(best.a.x - best.b.x) < EPS
	};
}
