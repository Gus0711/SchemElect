/**
 * Registre de la bibliothèque de symboles.
 * Chaque fichier de ./library exporte `symbols: SymbolDef[]` ; ils sont chargés
 * automatiquement : ajouter un fichier suffit, pas besoin de modifier ce registre.
 */
import type { SymbolDef } from './types';

const modules = import.meta.glob<{ symbols: SymbolDef[] }>('./library/*.ts', { eager: true });

export const SYMBOLS: SymbolDef[] = Object.keys(modules)
	.sort()
	.flatMap((k) => modules[k].symbols);

const byId = new Map(SYMBOLS.map((s) => [s.id, s]));

if (byId.size !== SYMBOLS.length) {
	const seen = new Set<string>();
	for (const s of SYMBOLS) {
		if (seen.has(s.id)) throw new Error(`Symbole en double : ${s.id}`);
		seen.add(s.id);
	}
}

/** Symbole de repli si une définition a disparu de la bibliothèque. */
const MISSING: SymbolDef = {
	id: '__missing__',
	name: 'Symbole inconnu',
	category: 'Divers',
	prefix: '?',
	role: 'decor',
	graphics: [
		{ t: 'rect', x: -4, y: 0, w: 8, h: 8, stroke: 'dashed' },
		{ t: 'text', x: 0, y: 5.5, text: '?', size: 4, anchor: 'middle', tone: 'accent' }
	],
	terminals: [],
	labels: {},
	bounds: { x: -4, y: 0, w: 8, h: 8 }
};

/**
 * Symboles maison (bibliothèque partagée en base + copies embarquées dans les projets),
 * enregistrés à l'exécution. Ils ne remplacent jamais un symbole intégré.
 */
const customById = new Map<string, SymbolDef>();

export function registerCustomSymbols(defs: Iterable<SymbolDef>) {
	for (const d of defs) if (!byId.has(d.id)) customById.set(d.id, { ...d, custom: true });
}

/** Oublie un symbole maison (supprimé de la bibliothèque et plus utilisé). */
export function unregisterCustomSymbol(id: string) {
	customById.delete(id);
}

export function getSymbolDef(id: string): SymbolDef {
	return byId.get(id) ?? customById.get(id) ?? MISSING;
}

export function hasSymbolDef(id: string): boolean {
	return byId.has(id) || customById.has(id);
}

export const CATEGORIES: string[] = [...new Set(SYMBOLS.map((s) => s.category))];

export type { SymbolDef } from './types';
