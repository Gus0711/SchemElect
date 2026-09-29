/** Géométrie des symboles posés (bornes absolues, boîte englobante). */
import { getSymbolDef } from '$lib/symbols';
import { transformDir, transformPoint, transformRect, type Dir, type Rect } from './geometry';
import type { Point, SymbolInstance } from './types';

export interface AbsTerminal extends Point {
	id: string;
	dir: Dir;
	hideLabel?: boolean;
	label?: string;
}

export function symbolTerminals(s: SymbolInstance): AbsTerminal[] {
	const def = getSymbolDef(s.defId);
	return def.terminals.map((t) => ({
		...transformPoint(t, s, s.rotation, s.mirror, s.scale ?? 1),
		id: t.id,
		dir: transformDir(t.dir, s.rotation, s.mirror),
		hideLabel: t.hideLabel,
		label: t.label
	}));
}

export function symbolBounds(s: SymbolInstance): Rect {
	return transformRect(getSymbolDef(s.defId).bounds, s, s.rotation, s.mirror, s.scale ?? 1);
}

/** Position absolue d'un ancrage de texte local (le texte reste horizontal). */
export function symbolAnchor(s: SymbolInstance, local: Point): Point {
	return transformPoint(local, s, s.rotation, s.mirror, s.scale ?? 1);
}
