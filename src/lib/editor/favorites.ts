/**
 * Symboles favoris : barre d'accès rapide en haut du panneau Symboles (comme la colonne de
 * boutons de WinRelais). Liste mémorisée par utilisateur sur le serveur (`/api/prefs`).
 */

export const FAVORITES_PREF = 'favoriteSymbols';
export const MAX_FAVORITES = 24;

/** Favoris proposés tant que l'utilisateur n'a rien choisi : les symboles les plus posés. */
export const DEFAULT_FAVORITES = [
	'contact-no',
	'contact-nc',
	'bobine-contacteur',
	'bobine-relais',
	'voyant',
	'bouton-poussoir-no',
	'disjoncteur-2p',
	'borne-c',
	'borne-p',
	'renvoi-sortie',
	'renvoi-entree',
	'terre'
];

/** Liste reçue (serveur, ancienne version) → identifiants uniques, au plus MAX_FAVORITES. */
export function normalizeFavorites(raw: unknown): string[] | null {
	if (!Array.isArray(raw)) return null;
	const out: string[] = [];
	for (const x of raw)
		if (typeof x === 'string' && x.trim() && x.length <= 120 && !out.includes(x)) out.push(x);
	return out.slice(0, MAX_FAVORITES);
}

/** Ajoute (en fin de liste) ou retire un symbole des favoris. */
export function toggleFavorite(list: string[], defId: string): string[] {
	return list.includes(defId)
		? list.filter((x) => x !== defId)
		: [...list, defId].slice(0, MAX_FAVORITES);
}

/** Déplace un favori (glisser dans la barre). */
export function moveFavorite(list: string[], defId: string, to: number): string[] {
	const from = list.indexOf(defId);
	if (from < 0) return list;
	const next = list.filter((x) => x !== defId);
	next.splice(Math.max(0, Math.min(next.length, to)), 0, defId);
	return next;
}
