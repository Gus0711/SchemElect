/**
 * Fragments : un morceau de folio autonome (symboles, fils, barres, textes, cadres, câbles
 * + appareils référencés). Sert au copier/coller, aux macros et à la duplication
 * de folio — un seul mécanisme, avec renumérotation des repères.
 */
import { getSymbolDef } from '$lib/symbols';
import type { SymbolDef } from '$lib/symbols/types';
import { allCableTags } from './cables';
import { boundsOf, snap } from './geometry';
import { allItems, itemBounds } from './edit';
import { deepClone, newId } from './ids';
import { clonePanelLayout } from './panel';
import { compareTags, nextFreeTag, parseTag } from './tags';
import type {
	Bar,
	CableItem,
	Device,
	Folio,
	Id,
	ItemRef,
	Project,
	RectItem,
	SymbolInstance,
	TextItem,
	Wire
} from './types';

export interface Fragment {
	symbols: SymbolInstance[];
	wires: Wire[];
	bars: Bar[];
	texts: TextItem[];
	rects: RectItem[];
	/** Absent dans les macros enregistrées avant les câbles. */
	cables?: CableItem[];
	devices: Record<Id, Device>;
	/** Symboles maison utilisés (pour coller dans un autre projet / macros). */
	symbolDefs?: Record<string, SymbolDef>;
}

export function emptyFragment(): Fragment {
	return { symbols: [], wires: [], bars: [], texts: [], rects: [], cables: [], devices: {} };
}

export function isEmptyFragment(f: Fragment): boolean {
	return (
		!f.symbols.length &&
		!f.wires.length &&
		!f.bars.length &&
		!f.texts.length &&
		!f.rects.length &&
		!f.cables?.length
	);
}

/** Extrait une copie profonde des éléments sélectionnés. */
export function extractFragment(project: Project, folio: Folio, refs: ItemRef[]): Fragment {
	const ids = new Set(refs.map((r) => r.id));
	const clone = <T>(x: T): T => deepClone(x);
	const frag: Fragment = {
		symbols: folio.symbols.filter((s) => ids.has(s.id)).map(clone),
		wires: folio.wires.filter((w) => ids.has(w.id)).map(clone),
		bars: folio.bars.filter((b) => ids.has(b.id)).map(clone),
		texts: folio.texts.filter((t) => ids.has(t.id)).map(clone),
		rects: folio.rects.filter((r) => ids.has(r.id)).map(clone),
		cables: folio.cables.filter((c) => ids.has(c.id)).map(clone),
		devices: {}
	};
	for (const s of frag.symbols) {
		const d = project.devices[s.deviceId];
		if (d) frag.devices[d.id] = clone(d);
		const def = project.customSymbols[s.defId];
		if (def) (frag.symbolDefs ??= {})[def.id] = clone(def);
	}
	return frag;
}

/** Coin haut-gauche du fragment (pour l'insertion relative au curseur). */
export function fragmentOrigin(frag: Fragment): { x: number; y: number } {
	const tmp: Folio = { id: '', title: '', ...frag, cables: frag.cables ?? [] };
	const rects = allItems(tmp)
		.map((r) => itemBounds(tmp, r))
		.filter((r): r is NonNullable<typeof r> => !!r);
	if (!rects.length) return { x: 0, y: 0 };
	const b = boundsOf(
		rects.flatMap((r) => [
			{ x: r.x, y: r.y },
			{ x: r.x + r.w, y: r.y + r.h }
		])
	);
	return { x: snap(b.x), y: snap(b.y) };
}

/** Fragment ramené à l'origine (0,0) — format de stockage des macros. */
export function normalizeFragment(frag: Fragment): Fragment {
	const o = fragmentOrigin(frag);
	return translateFragment(deepClone(frag), -o.x, -o.y);
}

export function translateFragment(frag: Fragment, dx: number, dy: number): Fragment {
	for (const s of frag.symbols) {
		s.x += dx;
		s.y += dy;
	}
	for (const w of frag.wires) w.points = w.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
	for (const b of frag.bars) {
		b.y += dy;
		b.x1 += dx;
		b.x2 += dx;
	}
	for (const t of frag.texts) {
		t.x += dx;
		t.y += dy;
	}
	for (const r of frag.rects) {
		r.x += dx;
		r.y += dy;
	}
	for (const c of frag.cables ?? []) {
		c.x += dx;
		c.y += dy;
	}
	return frag;
}

export interface InsertOptions {
	/**
	 * `renumber` : nouveaux appareils avec repères suivants (copier/coller, macro, duplication) ;
	 * `keep` : conserve les appareils d'origine (couper/coller, déplacement entre folios).
	 */
	devices: 'renumber' | 'keep';
}

/**
 * Insère un fragment (déjà positionné) dans un folio. Retourne les références des
 * éléments créés (pour les sélectionner).
 */
export function insertFragment(
	project: Project,
	folio: Folio,
	source: Fragment,
	opts: InsertOptions
): ItemRef[] {
	const frag = deepClone(source);
	const deviceMap = new Map<Id, Id>();
	// Symboles maison transportés par le fragment : recopiés dans le projet cible.
	for (const def of Object.values(frag.symbolDefs ?? {})) project.customSymbols[def.id] ??= def;

	if (opts.devices === 'renumber') {
		// Ordre naturel des repères conservé : KM1, KM2 → KM5, KM6.
		const used = Object.values(project.devices).map((d) => d.tag);
		const devices = Object.values(frag.devices).sort((a, b) => compareTags(a.tag, b.tag));
		for (const d of devices) {
			const prefix = parseTag(d.tag).prefix || '?';
			const tag = nextFreeTag(prefix, used);
			used.push(tag);
			const id = newId('d');
			project.devices[id] = { ...d, id, tag };
			deviceMap.set(d.id, id);
		}
	} else {
		for (const d of Object.values(frag.devices)) {
			if (!project.devices[d.id]) project.devices[d.id] = d;
			deviceMap.set(d.id, d.id);
		}
	}

	const refs: ItemRef[] = [];
	for (const s of frag.symbols) {
		const role = getSymbolDef(s.defId).role;
		s.id = newId('s');
		s.deviceId = role === 'decor' ? '' : (deviceMap.get(s.deviceId) ?? s.deviceId);
		folio.symbols.push(s);
		refs.push({ kind: 'symbol', id: s.id });
	}
	const push = <K extends 'wires' | 'bars' | 'texts' | 'rects'>(
		key: K,
		kind: ItemRef['kind'],
		prefix: string
	) => {
		for (const item of frag[key]) {
			item.id = newId(prefix);
			(folio[key] as (typeof item)[]).push(item);
			refs.push({ kind, id: item.id });
		}
	};
	push('wires', 'wire', 'w');
	push('bars', 'bar', 'b');
	push('texts', 'text', 't');
	push('rects', 'rect', 'r');
	// Câbles : nouveau repère (W3…) sauf déplacement (couper/coller) sans conflit.
	const cableTags = allCableTags(project);
	for (const c of frag.cables ?? []) {
		c.id = newId('c');
		if (opts.devices === 'renumber' || cableTags.includes(c.tag))
			c.tag = nextFreeTag('W', cableTags);
		cableTags.push(c.tag);
		folio.cables.push(c);
		refs.push({ kind: 'cable', id: c.id });
	}
	return refs;
}

/** Duplique un folio juste après l'original, avec renumérotation des repères. */
export function duplicateFolio(project: Project, folioId: Id): Folio | null {
	const index = project.folios.findIndex((f) => f.id === folioId);
	if (index < 0) return null;
	const src = project.folios[index];
	const frag = extractFragment(project, src, allItems(src));
	const copy: Folio = {
		id: newId('f'),
		title: `${src.title} (copie)`,
		symbols: [],
		wires: [],
		bars: [],
		texts: [],
		rects: [],
		cables: []
	};
	insertFragment(project, copy, frag, { devices: 'renumber' });
	// Folio d'armoire : même disposition (rails, goulottes), appareils à reposer.
	if (src.panel) copy.panel = clonePanelLayout(src.panel);
	// Folio borniers : même filtre (le double affiche la page suivante de la série).
	if (src.strips) copy.strips = { prefixes: [...src.strips.prefixes] };
	project.folios.splice(index + 1, 0, copy);
	return copy;
}
