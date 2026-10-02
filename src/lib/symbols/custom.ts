/**
 * Symboles maison : un « corps » (image de documentation ou cadre titré) et des bornes
 * placées librement (sur les vis de l'image par exemple). Fabrique une `SymbolDef`
 * ordinaire : fils, renvois, borniers et PDF les traitent comme les symboles intégrés.
 */
import { GRID, type Dir } from '$lib/model/geometry';
import { newId } from '$lib/model/ids';
import { rect, text, term } from './helpers';
import type { Prim, SymbolDef } from './types';

export interface CustomTerminalSpec {
	id: string;
	/** Position exacte (mm, depuis le coin haut-gauche du corps). */
	x: number;
	y: number;
	/** Direction de sortie du fil. */
	dir: Dir;
}

export interface CustomSymbolSpec {
	id?: string;
	name: string;
	category: string;
	prefix: string;
	/** Taille du corps sur le schéma (mm). */
	w: number;
	h: number;
	/** Image (data URL) ; sinon un cadre avec `title`. */
	image?: string;
	title?: string;
	terminals: CustomTerminalSpec[];
	/** Bornes magnétisées sur la grille de 2,5 mm (fils parfaitement alignés). */
	snapToGrid: boolean;
}

const snapGrid = (v: number) => Math.round(v / GRID) * GRID;

/** Position effective d'une borne (magnétisée si demandé). */
export function terminalPoint(spec: Pick<CustomSymbolSpec, 'snapToGrid'>, t: CustomTerminalSpec) {
	return spec.snapToGrid ? { x: snapGrid(t.x), y: snapGrid(t.y) } : { x: t.x, y: t.y };
}

/** Bord du corps le plus proche d'un point : sert de direction de sortie par défaut. */
export function nearestSide(w: number, h: number, x: number, y: number): Dir {
	const d: [Dir, number][] = [
		['n', Math.abs(y)],
		['s', Math.abs(h - y)],
		['w', Math.abs(x)],
		['e', Math.abs(w - x)]
	];
	return d.sort((a, b) => a[1] - b[1])[0][0];
}

export function newCustomSymbolId(): string {
	return `custom-${newId()}`;
}

export function buildCustomSymbol(spec: CustomSymbolSpec): SymbolDef {
	const { w, h } = spec;
	const body: Prim[] = spec.image
		? [{ t: 'image', x: 0, y: 0, w, h, href: spec.image }]
		: [
				rect(0, 0, w, h, { fill: 'paper' }),
				...(spec.title
					? [
							text(w / 2, Math.min(h / 2 + 1.2, 6), spec.title, {
								size: 3,
								anchor: 'middle',
								bold: true
							})
						]
					: [])
			];
	const seen = new Map<string, number>();
	const terminals = spec.terminals.map((t) => {
		const p = terminalPoint(spec, t);
		// Bornes homonymes (deux « 0V ») : id rendu unique, libellé conservé.
		const n = (seen.get(t.id) ?? 0) + 1;
		seen.set(t.id, n);
		const id = n === 1 ? t.id : `${t.id}#${n}`;
		return { ...term(id, p.x, p.y, t.dir), label: n === 1 ? undefined : t.id };
	});
	const xs = [0, w, ...terminals.map((t) => t.x)];
	const ys = [0, h, ...terminals.map((t) => t.y)];
	const x1 = Math.min(...xs),
		y1 = Math.min(...ys);
	return {
		id: spec.id ?? newCustomSymbolId(),
		name: spec.name.trim() || 'Symbole maison',
		category: spec.category.trim() || 'Mes symboles',
		keywords: ['maison', spec.title ?? ''].filter(Boolean),
		prefix: spec.prefix.trim() || 'A',
		role: 'standalone',
		graphics: body,
		terminals,
		labels: {
			tag: { x: w + 1.5, y: 3 },
			value: { x: w + 1.5, y: 6 },
			designation: { x: w + 1.5, y: 9 }
		},
		bounds: { x: x1, y: y1, w: Math.max(...xs) - x1, h: Math.max(...ys) - y1 },
		custom: true,
		// Données d'édition conservées pour rouvrir l'éditeur de symbole.
		source: {
			w,
			h,
			image: spec.image,
			title: spec.title,
			terminals: spec.terminals,
			snapToGrid: spec.snapToGrid
		}
	};
}

/** Ancien format (borne = côté + position le long du bord) → position libre. */
type LegacyTerminal = { id: string; side: Dir; at: number };

function upgradeTerminal(
	t: CustomTerminalSpec | LegacyTerminal,
	w: number,
	h: number
): CustomTerminalSpec {
	if (!('side' in t)) return t;
	const LEAD = 2.5;
	switch (t.side) {
		case 'n':
			return { id: t.id, x: t.at, y: -LEAD, dir: 'n' };
		case 's':
			return { id: t.id, x: t.at, y: h + LEAD, dir: 's' };
		case 'w':
			return { id: t.id, x: -LEAD, y: t.at, dir: 'w' };
		default:
			return { id: t.id, x: w + LEAD, y: t.at, dir: 'e' };
	}
}

/** Retrouve la spécification d'édition d'un symbole maison (pour le modifier). */
export function specOf(def: SymbolDef): CustomSymbolSpec | null {
	const src = def.source;
	if (!src) return null;
	return {
		id: def.id,
		name: def.name,
		category: def.category,
		prefix: def.prefix,
		...src,
		terminals: src.terminals.map((t) => upgradeTerminal(t, src.w, src.h))
	};
}

/**
 * Répartit des bornes à intervalles égaux sur un bord (saisie rapide « 24V, 0V, 0V, IP »).
 * Chaque borne reste ensuite déplaçable à la souris.
 */
export function spreadTerminals(
	names: string[],
	side: Dir,
	w: number,
	h: number
): CustomTerminalSpec[] {
	const n = names.length;
	const along = (i: number, length: number) => Math.round(((length * (i + 0.5)) / n) * 10) / 10;
	return names.map((id, i) => {
		switch (side) {
			case 'n':
				return { id, x: along(i, w), y: 0, dir: side };
			case 's':
				return { id, x: along(i, w), y: h, dir: side };
			case 'w':
				return { id, x: 0, y: along(i, h), dir: side };
			default:
				return { id, x: w, y: along(i, h), dir: side };
		}
	});
}

/**
 * Liste de noms de bornes saisie au clavier : séparés par virgule, point-virgule ou retour
 * à la ligne ; « IP1..IP8 » (ou « 1..12 ») est développé en IP1, IP2… IP8.
 */
export function expandNames(text: string): string[] {
	const out: string[] = [];
	for (const raw of text.split(/[,;\n]/)) {
		const part = raw.trim();
		if (!part) continue;
		const m = /^(.*?)(\d+)\s*\.\.\s*(?:\1)?(\d+)$/.exec(part);
		if (m) {
			const [, prefix, a, b] = m;
			const from = Number(a),
				to = Number(b);
			const step = from <= to ? 1 : -1;
			if (Math.abs(to - from) < 200) {
				for (let n = from; n !== to + step; n += step)
					out.push(`${prefix}${String(n).padStart(a.length, '0')}`);
				continue;
			}
		}
		out.push(part);
	}
	return out;
}

/**
 * Nom proposé pour la borne suivante : la dernière + 1 (« IP3 » → « IP4 », « 09 » →
 * « 10 »), sinon le rang de la borne.
 */
export function nextTerminalName(existing: string[]): string {
	const last = existing.at(-1);
	const m = last ? /^(.*?)(\d+)$/.exec(last) : null;
	if (m) return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}`;
	return String(existing.length + 1);
}

/**
 * Bornes d'un corps de `w` × `h` mm pivoté d'un quart de tour : chacune reste sur sa vis,
 * son sens de sortie tourne avec. Le corps devient `h` × `w`.
 */
export function rotateTerminals(
	terminals: CustomTerminalSpec[],
	w: number,
	h: number,
	clockwise: boolean
): CustomTerminalSpec[] {
	const CW: Record<Dir, Dir> = { n: 'e', e: 's', s: 'w', w: 'n' };
	const CCW: Record<Dir, Dir> = { n: 'w', w: 's', s: 'e', e: 'n' };
	const r = (v: number) => Math.round(v * 10) / 10;
	return terminals.map((t) =>
		clockwise
			? { ...t, x: r(h - t.y), y: r(t.x), dir: CW[t.dir] }
			: { ...t, x: r(t.y), y: r(w - t.x), dir: CCW[t.dir] }
	);
}

/**
 * Aligne un point sur les bornes déjà posées : même hauteur (rangée de vis) ou même
 * aplomb, si l'écart est inférieur à `tol` mm. Renvoie le point et les guides à afficher.
 */
export function alignToTerminals(
	p: { x: number; y: number },
	others: { x: number; y: number }[],
	tol: number
): { x: number; y: number; guideX?: number; guideY?: number } {
	let bx: { d: number; v: number } | null = null;
	let by: { d: number; v: number } | null = null;
	for (const o of others) {
		const dx = Math.abs(o.x - p.x),
			dy = Math.abs(o.y - p.y);
		if (dx <= tol && (!bx || dx < bx.d)) bx = { d: dx, v: o.x };
		if (dy <= tol && (!by || dy < by.d)) by = { d: dy, v: o.y };
	}
	return {
		x: bx ? bx.v : p.x,
		y: by ? by.v : p.y,
		...(bx ? { guideX: bx.v } : {}),
		...(by ? { guideY: by.v } : {})
	};
}
