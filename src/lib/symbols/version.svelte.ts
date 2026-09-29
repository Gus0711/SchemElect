/**
 * Compteur réactif des symboles maison : incrémenté quand la bibliothèque dynamique
 * change, pour que les composants qui lisent `getSymbolDef` se mettent à jour
 * (le registre lui-même reste en TS pur pour le modèle et les tests).
 */
export const customSymbolsVersion = $state({ v: 0 });

export function bumpCustomSymbols() {
	customSymbolsVersion.v++;
}
