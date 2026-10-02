/**
 * Connectivité électrique (équipotentielles), jonctions et numérotation des fils.
 *
 * Règles de connexion (géométriques) :
 * - les deux extrémités d'un fil sont au même potentiel ;
 * - une extrémité de fil connecte ce qu'elle touche : borne, autre fil (n'importe où
 *   sur son tracé), barre de potentiel ;
 * - deux bornes superposées sont connectées ; une borne posée sur une barre aussi ;
 * - les bornes pontées d'un symbole (`bridges`) sont connectées ;
 * - les renvois (`link`) de même appareil sont connectés entre folios ;
 * - une barre de potentiel porte le même potentiel sur tous les folios.
 * Un fil qui passe sur une borne sans s'y terminer ne s'y connecte PAS.
 */
import { getSymbolDef } from '$lib/symbols';
import { EPS, pointKey, pointOnPolyline, pointOnSegment, samePoint } from './geometry';
import { columnAt, folioNumber } from './layout';
import { symbolTerminals } from './symbolGeometry';
import type { Folio, Id, Point, Project } from './types';

class UnionFind {
	private parent = new Map<string, string>();
	find(k: string): string {
		let p = this.parent.get(k);
		if (p === undefined) {
			this.parent.set(k, k);
			return k;
		}
		if (p === k) return k;
		p = this.find(p);
		this.parent.set(k, p);
		return p;
	}
	union(a: string, b: string): void {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) this.parent.set(ra, rb);
	}
}

export interface TerminalRef {
	folioId: Id;
	symbolId: Id;
	terminalId: string;
}

export interface Net {
	id: string;
	potentialId?: Id;
	/** Potentiels différents court-circuités sur ce réseau (erreur de schéma). */
	shortedPotentials: Id[];
	number?: string;
	/** Section en mm² : imposée sur un fil, sinon celle du potentiel, sinon celle du dossier. */
	section?: string;
	/** La section est imposée sur un fil (pas reprise du potentiel ni du dossier). */
	sectionImposed?: boolean;
	/** Couleur du fil : imposée sur un fil, sinon celle du potentiel, sinon celle du dossier. */
	color?: string;
	/** La couleur est imposée sur un fil. */
	colorImposed?: boolean;
	wires: { folioId: Id; wireId: Id }[];
	terminals: TerminalRef[];
}

export interface NetAnalysis {
	nets: Net[];
	netOfWire: Map<Id, Net>;
	/** Clé `symbolId:terminalId`. */
	netOfTerminal: Map<string, Net>;
	junctions: Map<Id, Point[]>;
	/** Bornes non raccordées, par folio. */
	openTerminals: Map<Id, Point[]>;
}

const pk = (folioId: Id, p: Point) => `p|${folioId}|${pointKey(p)}`;
const potKey = (id: Id) => `pot|${id}`;
const linkKey = (deviceId: Id) => `link|${deviceId}`;

export function analyzeNets(project: Project): NetAnalysis {
	const uf = new UnionFind();
	const terminalKeys: { ref: TerminalRef; key: string }[] = [];
	const junctions = new Map<Id, Point[]>();
	const openTerminals = new Map<Id, Point[]>();

	for (const folio of project.folios) {
		connectFolio(folio, uf, terminalKeys, project);
		junctions.set(folio.id, folioJunctions(folio));
	}

	// Regroupement par racine
	const byRoot = new Map<string, Net>();
	const netFor = (key: string): Net => {
		const root = uf.find(key);
		let net = byRoot.get(root);
		if (!net) {
			net = { id: root, shortedPotentials: [], wires: [], terminals: [] };
			byRoot.set(root, net);
		}
		return net;
	};

	const netOfWire = new Map<Id, Net>();
	for (const folio of project.folios) {
		for (const w of folio.wires) {
			if (w.points.length < 2) continue;
			const net = netFor(pk(folio.id, w.points[0]));
			net.wires.push({ folioId: folio.id, wireId: w.id });
			netOfWire.set(w.id, net);
		}
	}

	const netOfTerminal = new Map<string, Net>();
	const wiredKeys = new Set<string>();
	for (const folio of project.folios)
		for (const w of folio.wires)
			for (const p of [w.points[0], w.points[w.points.length - 1]])
				if (p) wiredKeys.add(pk(folio.id, p));

	for (const { ref, key } of terminalKeys) {
		const net = netFor(key);
		net.terminals.push(ref);
		netOfTerminal.set(`${ref.symbolId}:${ref.terminalId}`, net);
	}

	for (const pot of project.potentials) {
		const net = byRoot.get(uf.find(potKey(pot.id)));
		if (!net) continue;
		if (net.potentialId && net.potentialId !== pot.id) net.shortedPotentials.push(pot.id);
		else net.potentialId = pot.id;
	}

	// Bornes « en l'air » : ni fil, ni autre borne, ni barre sur leur réseau.
	for (const folio of project.folios) {
		const open: Point[] = [];
		for (const s of folio.symbols) {
			const def = getSymbolDef(s.defId);
			if (def.role === 'link') continue;
			for (const t of symbolTerminals(s)) {
				const net = netOfTerminal.get(`${s.id}:${t.id}`);
				const connected =
					!!net && (net.wires.length > 0 || net.terminals.length > 1 || !!net.potentialId);
				if (!connected && !wiredKeys.has(pk(folio.id, t))) open.push({ x: t.x, y: t.y });
			}
		}
		openTerminals.set(folio.id, open);
	}

	const nets = [...byRoot.values()];
	numberNets(project, nets);
	sectionNets(project, nets);
	colorNets(project, nets);
	return { nets, netOfWire, netOfTerminal, junctions, openTerminals };
}

function connectFolio(
	folio: Folio,
	uf: UnionFind,
	terminalKeys: { ref: TerminalRef; key: string }[],
	project: Project
) {
	const termPoints: Point[] = [];
	for (const s of folio.symbols) {
		const def = getSymbolDef(s.defId);
		const terms = symbolTerminals(s);
		const keyOf = new Map<string, string>();
		for (const t of terms) {
			const key = pk(folio.id, t);
			keyOf.set(t.id, key);
			termPoints.push(t);
			terminalKeys.push({ ref: { folioId: folio.id, symbolId: s.id, terminalId: t.id }, key });
			if (def.role === 'link' && project.devices[s.deviceId]) uf.union(key, linkKey(s.deviceId));
		}
		for (const group of def.bridges ?? []) {
			const keys = group.map((id) => keyOf.get(id)).filter((k): k is string => !!k);
			for (let i = 1; i < keys.length; i++) uf.union(keys[0], keys[i]);
		}
	}

	for (const t of termPoints)
		for (const bar of folio.bars)
			if (pointOnSegment(t, { x: bar.x1, y: bar.y }, { x: bar.x2, y: bar.y }))
				uf.union(pk(folio.id, t), potKey(bar.potentialId));

	for (const w of folio.wires) {
		if (w.points.length < 2) continue;
		const ends = [w.points[0], w.points[w.points.length - 1]];
		uf.union(pk(folio.id, ends[0]), pk(folio.id, ends[1]));
		for (const e of ends) {
			for (const other of folio.wires) {
				if (other === w || other.points.length < 2) continue;
				if (pointOnPolyline(e, other.points))
					uf.union(pk(folio.id, e), pk(folio.id, other.points[0]));
			}
			for (const bar of folio.bars)
				if (pointOnSegment(e, { x: bar.x1, y: bar.y }, { x: bar.x2, y: bar.y }))
					uf.union(pk(folio.id, e), potKey(bar.potentialId));
		}
	}
}

/**
 * Bornes reliées DIRECTEMENT à un point par des fils du folio (sans passer par une
 * barre de potentiel ni un renvoi). Sert aux borniers : « qui est câblé sur cette borne ».
 */
export function directlyConnected(
	folio: Folio,
	start: Point,
	exclude: Id
): { symbolId: Id; terminalId: string }[] {
	const wires = folio.wires.filter((w) => w.points.length >= 2);
	const ends = (w: (typeof wires)[number]) => [w.points[0], w.points[w.points.length - 1]];
	const visited = new Set<Id>();
	const queue = wires.filter((w) => ends(w).some((e) => samePoint(e, start)));
	queue.forEach((w) => visited.add(w.id));
	while (queue.length) {
		const w = queue.shift()!;
		for (const o of wires) {
			if (visited.has(o.id)) continue;
			const touches =
				ends(o).some((e) => pointOnPolyline(e, w.points)) ||
				ends(w).some((e) => pointOnPolyline(e, o.points));
			if (touches) {
				visited.add(o.id);
				queue.push(o);
			}
		}
	}
	const points = [start, ...wires.filter((w) => visited.has(w.id)).flatMap(ends)];
	const out: { symbolId: Id; terminalId: string }[] = [];
	for (const s of folio.symbols) {
		if (s.id === exclude) continue;
		for (const t of symbolTerminals(s))
			if (points.some((p) => samePoint(p, t))) out.push({ symbolId: s.id, terminalId: t.id });
	}
	return out;
}

/** Points de jonction à dessiner : dérivations en T, départs sur barre, nœuds ≥ 3 fils. */
export function folioJunctions(folio: Folio): Point[] {
	const out: Point[] = [];
	const add = (p: Point) => {
		if (!out.some((q) => samePoint(q, p))) out.push({ x: p.x, y: p.y });
	};
	const endCount = new Map<string, { p: Point; n: number }>();
	for (const w of folio.wires) {
		if (w.points.length < 2) continue;
		for (const e of [w.points[0], w.points[w.points.length - 1]]) {
			const k = pointKey(e);
			const c = endCount.get(k) ?? { p: e, n: 0 };
			c.n++;
			endCount.set(k, c);
			for (const bar of folio.bars)
				if (pointOnSegment(e, { x: bar.x1, y: bar.y }, { x: bar.x2, y: bar.y })) add(e);
			for (const other of folio.wires) {
				if (other === w || other.points.length < 2) continue;
				const first = other.points[0];
				const last = other.points[other.points.length - 1];
				if (samePoint(e, first) || samePoint(e, last)) continue;
				if (pointOnPolyline(e, other.points, EPS)) add(e);
			}
		}
	}
	for (const { p, n } of endCount.values()) if (n >= 3) add(p);
	return out;
}

/** Section de chaque équipotentielle : fil imposé > potentiel > défaut du dossier. */
function sectionNets(project: Project, nets: Net[]) {
	const imposed = new Map<Id, string>();
	for (const f of project.folios)
		for (const w of f.wires) if (w.section?.trim()) imposed.set(w.id, w.section.trim());
	const potSection = new Map(project.potentials.map((p) => [p.id, p.section?.trim() || '']));
	const def = project.settings.wireSection?.trim() || '';
	for (const n of nets) {
		if (!n.wires.length) continue;
		const own = n.wires.map((w) => imposed.get(w.wireId)).find(Boolean);
		const pot = n.potentialId ? potSection.get(n.potentialId) : '';
		const section = own || pot || (n.potentialId ? '' : def);
		if (!section) continue;
		n.section = section;
		n.sectionImposed = !!own;
	}
}

/** Couleur de chaque équipotentielle : fil imposé > potentiel > défaut du dossier. */
function colorNets(project: Project, nets: Net[]) {
	const imposed = new Map<Id, string>();
	for (const f of project.folios)
		for (const w of f.wires) if (w.color?.trim()) imposed.set(w.id, w.color.trim());
	const potColor = new Map(project.potentials.map((p) => [p.id, p.wireColor?.trim() || '']));
	const def = project.settings.wireColor?.trim() || '';
	for (const n of nets) {
		if (!n.wires.length) continue;
		const own = n.wires.map((w) => imposed.get(w.wireId)).find(Boolean);
		const pot = n.potentialId ? potColor.get(n.potentialId) : '';
		const color = own || pot || (n.potentialId ? '' : def);
		if (!color) continue;
		n.color = color;
		n.colorImposed = !!own;
	}
}

/** Couleurs de fil usuelles (normes armoire) ; le tracé de chacune est dans le thème. */
export const WIRE_COLORS = [
	'Noir',
	'Marron',
	'Rouge',
	'Orange',
	'Jaune',
	'Vert',
	'Bleu',
	'Bleu clair',
	'Violet',
	'Gris',
	'Blanc',
	'Rose',
	'Vert/Jaune'
];

/** Sections usuelles proposées à la saisie (mm²). */
export const WIRE_SECTIONS = ['0,5', '0,75', '1', '1,5', '2,5', '4', '6', '10', '16', '25'];

/** Texte d'une section sur le dessin : « 1,5 » → « 1,5² » (texte libre laissé tel quel). */
export function sectionLabel(section: string): string {
	const s = section.trim().replace('.', ',');
	return /^\d+(,\d+)?$/.test(s) ? `${s}²` : s;
}

/**
 * Numérotation : séquentielle sur tout le dossier (comme l'exemple WinRelais),
 * dans l'ordre des folios puis de gauche à droite, de haut en bas.
 * Les réseaux reliés à un potentiel (barre) ne sont pas numérotés : ils portent
 * le nom du potentiel. Un numéro imposé sur un fil s'applique à tout son réseau.
 */
function numberNets(project: Project, nets: Net[]) {
	const folioIndex = new Map(project.folios.map((f, i) => [f.id, i]));
	const wireById = new Map<Id, { points: Point[]; numberOverride?: string }>();
	for (const f of project.folios) for (const w of f.wires) wireById.set(w.id, w);

	const candidates = nets
		.filter((n) => n.wires.length > 0 && !n.potentialId)
		.map((n) => {
			let best = { fi: Infinity, x: Infinity, y: Infinity };
			let override: string | undefined;
			for (const { folioId, wireId } of n.wires) {
				const w = wireById.get(wireId)!;
				if (w.numberOverride) override ??= w.numberOverride;
				const fi = folioIndex.get(folioId) ?? 0;
				for (const p of w.points) {
					if (
						fi < best.fi ||
						(fi === best.fi &&
							(p.x < best.x - EPS || (Math.abs(p.x - best.x) < EPS && p.y < best.y)))
					)
						best = { fi, x: p.x, y: p.y };
				}
			}
			return { net: n, key: best, override };
		})
		.sort((a, b) => a.key.fi - b.key.fi || a.key.x - b.key.x || a.key.y - b.key.y);

	const used = new Set(candidates.map((c) => c.override).filter(Boolean) as string[]);
	const { wireNumberDigits: digits, wireNumberStart: start } = project.settings;
	const template = project.settings.wireNumberTemplate?.trim() || '{N}';
	const counters = new Map<string, number>();
	for (const c of candidates) {
		if (c.override) {
			c.net.number = c.override;
			continue;
		}
		const fields = { F: folioNumber(c.key.fi), C: columnAt(c.key.x) };
		const scope = wireNumberScope(template, fields);
		let counter = counters.get(scope) ?? start;
		let label: string;
		do {
			label = formatWireNumber(template, { ...fields, N: String(counter++).padStart(digits, '0') });
		} while (used.has(label));
		counters.set(scope, counter);
		used.add(label);
		c.net.number = label;
	}
}

/** Modèles de numéro de fil proposés (Propriétés du dossier). */
export const WIRE_NUMBER_TEMPLATES = [
	{ value: '{N}', label: 'Séquentiel sur le dossier', example: '12' },
	{ value: '{F}/{N}', label: 'Par folio : folio / n°', example: '03/12' },
	{ value: 'F{F}/{N}', label: 'Par folio, façon WinRelais', example: 'F03/12' },
	{ value: '{F}{N}', label: 'Par folio, accolé', example: '0312' },
	{ value: '{F}{C}{N}', label: 'Par folio et colonne', example: '03D1' }
];

/** Remplit un modèle de numéro de fil ({N}, {F}, {C}). */
export function formatWireNumber(
	template: string,
	fields: { N: string; F: string; C: string }
): string {
	return template.replace(/\{([NFC])\}/g, (_, k: 'N' | 'F' | 'C') => fields[k]);
}

/** Portée du compteur : tout le dossier, chaque folio ({F}), ou chaque colonne ({C}). */
function wireNumberScope(template: string, fields: { F: string; C: string }): string {
	const perFolio = template.includes('{F}');
	const perColumn = template.includes('{C}');
	return `${perFolio || perColumn ? fields.F : ''}|${perColumn ? fields.C : ''}`;
}
