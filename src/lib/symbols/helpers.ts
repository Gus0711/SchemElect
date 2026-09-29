/** Briques de dessin partagées par les définitions de symboles (évite la duplication). */
import type { FillKind, Prim, StrokeKind, SymbolDef, Tone, TerminalDef } from './types';
import type { Dir, Rect } from '$lib/model/geometry';

/** Pas entre pôles d'un appareil multipolaire. */
export const POLE = 7.5;
/** Longueur standard d'un élément vertical entre ses deux bornes. */
export const SPAN = 15;

export const line = (
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	stroke?: StrokeKind,
	tone?: Tone
): Prim => ({ t: 'line', x1, y1, x2, y2, stroke, tone });

export const rect = (
	x: number,
	y: number,
	w: number,
	h: number,
	opts: { stroke?: StrokeKind; fill?: 'none' | 'ink' | 'paper'; r?: number; tone?: Tone } = {}
): Prim => ({ t: 'rect', x, y, w, h, ...opts });

export const circle = (
	cx: number,
	cy: number,
	r: number,
	opts: { stroke?: StrokeKind; fill?: 'none' | 'ink' | 'paper'; tone?: Tone } = {}
): Prim => ({ t: 'circle', cx, cy, r, ...opts });

export const path = (
	d: string,
	opts: { stroke?: StrokeKind; fill?: 'none' | 'ink' | 'paper'; tone?: Tone } = {}
): Prim => ({ t: 'path', d, ...opts });

export const text = (
	x: number,
	y: number,
	value: string,
	opts: { size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; tone?: Tone } = {}
): Prim => ({ t: 'text', x, y, text: value, ...opts });

export const term = (
	id: string,
	x: number,
	y: number,
	dir: Dir,
	hideLabel = false
): TerminalDef => ({
	id,
	x,
	y,
	dir,
	hideLabel
});

/** Paire de bornes verticales haut (dir n) / bas (dir s). */
export const vTerminals = (top: string, bottom: string, x = 0, len = SPAN): TerminalDef[] => [
	term(top, x, 0, 'n'),
	term(bottom, x, len, 's')
];

/** Pattes de raccordement d'un élément vertical : de 0 à `a` et de `b` à `len`. */
export const leads = (a: number, b: number, x = 0, len = SPAN): Prim[] => [
	line(x, 0, x, a),
	line(x, b, x, len)
];

/** Contact à fermeture (NO) vertical centré en x. */
export const contactNO = (x = 0): Prim[] => [...leads(5, 10, x), line(x, 10, x - 3, 4.8)];

/** Contact à ouverture (NC) vertical centré en x. */
export const contactNC = (x = 0): Prim[] => [
	...leads(5, 10, x),
	line(x, 5, x + 3, 5),
	line(x, 10, x + 3.4, 4.2)
];

/** Liaison mécanique pointillée horizontale (entre pôles / vers une commande). */
export const mechLink = (x1: number, x2: number, y: number): Prim => line(x1, y, x2, y, 'dashed');

/** Élément de protection magnétothermique sur un pôle (croix + demi-lune). */
export const breakerPole = (x = 0): Prim[] => [
	...leads(5, 10, x),
	line(x, 10, x - 3, 4.8),
	line(x - 0.9, 4.1, x + 0.9, 5.9),
	line(x - 0.9, 5.9, x + 0.9, 4.1)
];

/* ------------------------------------------------------------------------- */
/* Briques de haut niveau (appareils multipolaires, contacts, bobines…)      */
/* ------------------------------------------------------------------------- */

/** Numérotation normalisée des pôles de puissance (haut → bas). */
export const POLES_L: [string, string][] = [
	['1', '2'],
	['3', '4'],
	['5', '6'],
	['7', '8']
];
/** Pôle de neutre : N en haut, N' en bas (ids de bornes uniques). */
export const POLE_N: [string, string] = ['N', "N'"];
/** Pôles principaux de contacteur. */
export const POLES_KM: [string, string][] = [
	['1/L1', '2/T1'],
	['3/L2', '4/T2'],
	['5/L3', '6/T3']
];

/** Point milieu de la lame d'un contact NO dessiné par contactNO / breakerPole. */
export const BLADE_MID = { dx: -1.5, y: 7.4 };

/**
 * Appareil multipolaire : un pôle vertical tous les `POLE` mm à partir de x = 0,
 * bornes haut (y = 0) / bas (y = len), liaison mécanique pointillée entre les lames.
 */
export function multipole(
	poles: [string, string][],
	draw: (x: number, i: number) => Prim[],
	opts: { len?: number; link?: boolean } = {}
): { graphics: Prim[]; terminals: TerminalDef[]; lastX: number } {
	const len = opts.len ?? SPAN;
	const lastX = (poles.length - 1) * POLE;
	const graphics = poles.flatMap((_, i) => draw(i * POLE, i));
	if (poles.length > 1 && opts.link !== false)
		graphics.push(mechLink(BLADE_MID.dx, lastX + BLADE_MID.dx, BLADE_MID.y));
	const terminals = poles.flatMap(([top, bottom], i) => vTerminals(top, bottom, i * POLE, len));
	return { graphics, terminals, lastX };
}

/**
 * Textes à droite d'un appareil dont le dernier pôle est en x = `lastX` :
 * repère, valeur, désignation, puis renvoi empilés — rien ne croise les fils des pôles.
 */
export function sideLabels(lastX: number, len = SPAN): SymbolDef['labels'] {
	const x = lastX + 3;
	return {
		tag: { x, y: 6 },
		value: { x, y: 8.8 },
		designation: { x, y: 11.4 },
		xref: { x, y: Math.min(14, len - 1) }
	};
}

/** Pôle de contacteur : contact NO + demi-cercle sur le contact fixe. */
export const contactorPole = (x = 0): Prim[] => [
	...contactNO(x),
	path(`M ${x} 5 A 0.9 0.9 0 0 1 ${x} 3.2`)
];

/** Pôle de sectionneur / interrupteur-sectionneur : contact NO + barre sur le contact fixe. */
export const disconnectorPole = (x = 0): Prim[] => [...contactNO(x), line(x - 1, 5, x + 1, 5)];

/** Élément thermique (créneau) sur la patte basse d'un pôle. */
export const thermalMark = (x = 0): Prim[] => [path(`M ${x} 11 H ${x + 1.2} V 13.5 H ${x}`)];

/** Fusible vertical (rectangle traversé par le conducteur) entre y1 et y2. */
export const fuse = (x: number, y1: number, y2: number): Prim[] => [
	rect(x - 1.2, y1, 2.4, y2 - y1, { fill: 'paper' }),
	line(x, y1, x, y2)
];

/** Rectangle orienté (centre, vecteur unitaire de l'axe long, demi-longueur, demi-largeur). */
export function orientedRect(
	cx: number,
	cy: number,
	ux: number,
	uy: number,
	hl: number,
	hw: number,
	fill: FillKind = 'paper'
): Prim {
	const nx = -uy,
		ny = ux;
	const p = (a: number, b: number) =>
		`${+(cx + ux * a + nx * b).toFixed(3)} ${+(cy + uy * a + ny * b).toFixed(3)}`;
	return path(`M ${p(-hl, -hw)} L ${p(hl, -hw)} L ${p(hl, hw)} L ${p(-hl, hw)} Z`, { fill });
}

/** Lame de sectionneur porte-fusible : contact avec cartouche fusible sur la lame. */
export const fuseDisconnectorPole = (x = 0): Prim[] => {
	const len = Math.hypot(3, 5.2);
	return [...disconnectorPole(x), orientedRect(x - 1.5, 7.4, -3 / len, -5.2 / len, 1.9, 0.75)];
};

/** Vanne (deux triangles tête-bêche) horizontale centrée en (cx, cy). */
export const valve = (cx: number, cy: number, w = 4, h = 2): Prim[] => [
	path(`M ${cx - w} ${cy - h} L ${cx} ${cy} L ${cx - w} ${cy + h} Z`),
	path(`M ${cx + w} ${cy - h} L ${cx} ${cy} L ${cx + w} ${cy + h} Z`)
];

/**
 * Raccordement d'une borne (x, y0) à un cercle (cx, cy, r) : vertical de y0 jusqu'à `bend`,
 * puis droit vers le centre, arrêté sur le cercle.
 */
export function leadToCircle(
	x: number,
	bend: number,
	cx: number,
	cy: number,
	r: number,
	y0 = 0
): Prim[] {
	const dx = cx - x,
		dy = cy - bend;
	if (Math.abs(dx) < 0.01) return [line(x, y0, x, y0 < cy ? cy - r : cy + r)];
	const d = Math.hypot(dx, dy);
	return [
		line(x, y0, x, bend),
		line(x, bend, +(cx - (dx / d) * r).toFixed(3), +(cy - (dy / d) * r).toFixed(3))
	];
}

/** Commande mécanique : liaison pointillée depuis la lame d'un contact NO jusqu'à x = `to`. */
export const actuatorLink = (to: number, from = BLADE_MID.dx): Prim =>
	mechLink(to, from, BLADE_MID.y);

/** Corps de bobine (A1 en haut, A2 en bas). */
export const coilBody = (): Prim[] => [...leads(5, 10), rect(-4.5, 5, 9, 5, { fill: 'paper' })];

/**
 * Bobine (master) : repère inscrit dans le rectangle, tableau NO|NC dessous.
 * `extra` : graphisme complémentaire (temporisation, télérupteur…).
 */
export function coilSymbol(
	id: string,
	name: string,
	category: string,
	prefix: string,
	keywords: string[],
	extra: Prim[] = []
): SymbolDef {
	return defineSymbol({
		id,
		name,
		category,
		keywords,
		prefix,
		role: 'master',
		graphics: [...coilBody(), ...extra],
		terminals: vTerminals('A1', 'A2'),
		labels: {
			tag: { x: 0, y: 8.4, anchor: 'middle' },
			designation: { x: 5.5, y: 8.4 },
			// Tableau NO|NC à droite de la patte basse (ne croise pas le fil de A2).
			xref: { x: 3.5, y: 10.5 }
		}
	});
}

/** Contact (slave) NO ou NC à 2 bornes : repère + renvoi à droite. */
export function auxContact(
	id: string,
	name: string,
	category: string,
	prefix: string,
	kind: 'no' | 'nc',
	terms: [string, string],
	keywords: string[],
	extra: Prim[] = []
): SymbolDef {
	const x = kind === 'no' ? 3 : 4.5;
	return defineSymbol({
		id,
		name,
		category,
		keywords,
		prefix,
		role: 'slave',
		contactKind: kind,
		graphics: [...(kind === 'no' ? contactNO() : contactNC()), ...extra],
		terminals: vTerminals(...terms),
		labels: { tag: { x, y: 7 }, xref: { x, y: 10.2 } }
	});
}

/** Élément résistif vertical (sonde, résistance) : bornes 1/2, désignation verticale à gauche. */
export function resistorSymbol(
	id: string,
	name: string,
	category: string,
	prefix: string,
	keywords: string[],
	inner: Prim[] = [],
	defaults?: SymbolDef['defaults']
): SymbolDef {
	return defineSymbol({
		id,
		name,
		category,
		keywords,
		prefix,
		role: 'standalone',
		graphics: [...leads(4, 11), rect(-1.5, 4, 3, 7, { fill: 'paper' }), ...inner],
		terminals: vTerminals('1', '2'),
		labels: {
			tag: { x: 3, y: 7 },
			value: { x: 3, y: 9.6 },
			designation: { x: -3, y: 0, anchor: 'end', vertical: true }
		},
		defaults
	});
}

/* ------------------------------------------------------------------------- */
/* Boîte englobante calculée                                                 */
/* ------------------------------------------------------------------------- */

/** Points caractéristiques d'un chemin SVG (commandes ABSOLUES uniquement). */
function pathPoints(d: string): { x: number; y: number; r: number }[] {
	const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
	const out: { x: number; y: number; r: number }[] = [];
	let i = 0,
		cmd = '',
		cx = 0,
		cy = 0;
	const num = () => Number(tokens[i++]);
	const pt = (r = 0) => out.push({ x: cx, y: cy, r });
	while (i < tokens.length) {
		if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
		switch (cmd) {
			case 'M':
			case 'L':
				cx = num();
				cy = num();
				pt();
				break;
			case 'H':
				cx = num();
				pt();
				break;
			case 'V':
				cy = num();
				pt();
				break;
			case 'Q':
			case 'C': {
				for (let k = 0; k < (cmd === 'C' ? 3 : 2); k++) {
					cx = num();
					cy = num();
					pt();
				}
				break;
			}
			case 'A': {
				const r = Math.max(num(), num());
				i += 3;
				pt(r);
				cx = num();
				cy = num();
				pt(r);
				break;
			}
			case 'Z':
				break;
			default:
				throw new Error(
					`Commande de chemin non gérée : ${cmd} (utiliser M L H V A Q C Z absolues)`
				);
		}
	}
	return out;
}

/** Boîte englobante (conservatrice) du graphisme et des bornes d'un symbole. */
export function graphicsBounds(graphics: Prim[], terminals: TerminalDef[] = []): Rect {
	let x1 = Infinity,
		y1 = Infinity,
		x2 = -Infinity,
		y2 = -Infinity;
	const add = (x: number, y: number, r = 0) => {
		x1 = Math.min(x1, x - r);
		y1 = Math.min(y1, y - r);
		x2 = Math.max(x2, x + r);
		y2 = Math.max(y2, y + r);
	};
	for (const p of graphics) {
		if (p.t === 'line') {
			add(p.x1, p.y1);
			add(p.x2, p.y2);
		} else if (p.t === 'rect') {
			add(p.x, p.y);
			add(p.x + p.w, p.y + p.h);
		} else if (p.t === 'circle') add(p.cx, p.cy, p.r);
		else if (p.t === 'path') for (const q of pathPoints(p.d)) add(q.x, q.y, q.r);
	}
	for (const t of terminals) add(t.x, t.y);
	if (x1 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
	const r = (v: number) => Math.round(v * 100) / 100;
	return { x: r(x1), y: r(y1), w: r(x2 - x1), h: r(y2 - y1) };
}

/** Définit un symbole ; `bounds` est calculée depuis le graphisme et les bornes si absente. */
export function defineSymbol(def: Omit<SymbolDef, 'bounds'> & { bounds?: Rect }): SymbolDef {
	// Le renvoi n'a de sens que pour master / slave / link.
	const labels = ['master', 'slave', 'link'].includes(def.role)
		? def.labels
		: { ...def.labels, xref: undefined };
	if (!labels.xref) delete labels.xref;
	return { ...def, labels, bounds: def.bounds ?? graphicsBounds(def.graphics, def.terminals) };
}
