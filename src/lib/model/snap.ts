/** Magnétisme : accroche du curseur sur les points de connexion puis sur la grille. */
import { distToSegment, EPS, pointOnPolyline, samePoint, snap, snapPoint } from './geometry';
import { symbolTerminals, type AbsTerminal } from './symbolGeometry';
import type { Folio, Point } from './types';

export type SnapKind = 'terminal' | 'wire-end' | 'wire' | 'bar' | 'grid';

export interface SnapResult {
	point: Point;
	kind: SnapKind;
	terminal?: AbsTerminal;
}

/**
 * Point d'accroche le plus pertinent autour de `p` (tolérance en mm) :
 * borne > extrémité de fil > fil (projeté sur la grille) > barre > grille.
 */
export function snapTarget(folio: Folio, p: Point, tol: number): SnapResult {
	let best: { d: number; r: SnapResult } | null = null;
	const consider = (d: number, r: SnapResult) => {
		if (d <= tol && (!best || d < best.d - EPS)) best = { d, r };
	};

	for (const s of folio.symbols)
		for (const t of symbolTerminals(s))
			consider(Math.hypot(t.x - p.x, t.y - p.y), {
				point: { x: t.x, y: t.y },
				kind: 'terminal',
				terminal: t
			});
	if (best) return (best as { r: SnapResult }).r;

	for (const w of folio.wires)
		for (const e of [w.points[0], w.points[w.points.length - 1]])
			if (e) consider(Math.hypot(e.x - p.x, e.y - p.y), { point: { ...e }, kind: 'wire-end' });
	if (best) return (best as { r: SnapResult }).r;

	const g = snapPoint(p);
	for (const w of folio.wires)
		for (let i = 0; i < w.points.length - 1; i++) {
			const a = w.points[i],
				b = w.points[i + 1];
			if (distToSegment(p, a, b) > tol) continue;
			// Projection sur le segment, magnétisée sur la grille le long du segment.
			const onSeg = Math.abs(a.x - b.x) < EPS ? { x: a.x, y: snap(p.y) } : { x: snap(p.x), y: a.y };
			if (pointOnPolyline(onSeg, [a, b]))
				consider(distToSegment(p, a, b), { point: onSeg, kind: 'wire' });
		}
	for (const bar of folio.bars)
		if (Math.abs(p.y - bar.y) <= tol && g.x >= bar.x1 && g.x <= bar.x2)
			consider(Math.abs(p.y - bar.y), { point: { x: g.x, y: bar.y }, kind: 'bar' });
	if (best) return (best as { r: SnapResult }).r;

	return { point: g, kind: 'grid' };
}

/** Le point termine-t-il naturellement un fil (connexion existante) ? */
export function isConnectionPoint(folio: Folio, p: Point): boolean {
	for (const s of folio.symbols)
		for (const t of symbolTerminals(s)) if (samePoint(t, p)) return true;
	for (const w of folio.wires) if (pointOnPolyline(p, w.points)) return true;
	for (const b of folio.bars)
		if (Math.abs(b.y - p.y) < EPS && p.x >= b.x1 && p.x <= b.x2) return true;
	return false;
}
