/**
 * Liste des raccourcis clavier et gestes souris de l'éditeur, affichée par l'aide (`?`).
 * À tenir à jour avec `interaction.svelte.ts` (keyDown) et `EditorApp.svelte`.
 */

export interface Shortcut {
	/** Touches (une combinaison par entrée : « Ctrl », « Z »). */
	keys: string[][];
	label: string;
	/** Précision affichée en petit. */
	hint?: string;
}

export interface ShortcutGroup {
	title: string;
	items: Shortcut[];
}

export const SHORTCUTS: ShortcutGroup[] = [
	{
		title: 'Outils',
		items: [
			{ keys: [['S'], ['V']], label: 'Sélection' },
			{ keys: [['W']], label: 'Fil', hint: 'Clic : coude ; double-clic ou Entrée : terminer' },
			{ keys: [['B']], label: 'Barre de potentiel', hint: 'Dernier potentiel choisi' },
			{ keys: [['K']], label: 'Câble', hint: 'Glisser en travers des fils' },
			{ keys: [['T']], label: 'Texte' },
			{ keys: [['C']], label: 'Cadre' },
			{
				keys: [['/']],
				label: 'Rechercher un symbole',
				hint: 'Taper « KM », Entrée : 1er résultat, puis clic sur le folio'
			},
			{ keys: [['Entrée']], label: 'Reprendre le dernier symbole posé' },
			{ keys: [['Échap']], label: 'Annuler l’outil / vider la sélection' }
		]
	},
	{
		title: 'Fil en cours de tracé',
		items: [
			{ keys: [['Espace']], label: 'Inverser le coude' },
			{ keys: [['Retour arrière']], label: 'Retirer le dernier point' },
			{ keys: [['Entrée'], ['Clic droit']], label: 'Terminer le fil' },
			{ keys: [['Échap']], label: 'Abandonner le fil' }
		]
	},
	{
		title: 'Édition',
		items: [
			{ keys: [['Ctrl', 'Z']], label: 'Annuler' },
			{
				keys: [
					['Ctrl', 'Y'],
					['Ctrl', 'Maj', 'Z']
				],
				label: 'Rétablir'
			},
			{ keys: [['Ctrl', 'C']], label: 'Copier', hint: 'Fonctionne d’un projet à l’autre' },
			{ keys: [['Ctrl', 'X']], label: 'Couper' },
			{ keys: [['Ctrl', 'V']], label: 'Coller', hint: 'Repères renumérotés' },
			{ keys: [['Ctrl', 'D']], label: 'Dupliquer la sélection' },
			{ keys: [['Ctrl', 'A']], label: 'Tout sélectionner' },
			{ keys: [['Suppr']], label: 'Supprimer la sélection' },
			{ keys: [['R']], label: 'Pivoter', hint: 'Aussi pendant la pose d’un symbole' },
			{ keys: [['X']], label: 'Miroir' },
			{ keys: [['F2']], label: 'Modifier le repère, le texte ou le n° de fil' },
			{ keys: [['Flèches']], label: 'Déplacer d’un pas', hint: '2,5 mm (armoire : 5 mm)' },
			{ keys: [['Maj', 'Flèches']], label: 'Déplacer de 4 pas', hint: 'Armoire : 50 mm' }
		]
	},
	{
		title: 'Vue et navigation',
		items: [
			{ keys: [['F']], label: 'Page entière' },
			{ keys: [['+'], ['−']], label: 'Zoom avant / arrière' },
			{ keys: [['1']], label: 'Taille réelle (100 %)' },
			{
				keys: [['G']],
				label: 'Afficher / masquer la grille',
				hint: 'Type, pas, visibilité : bouton « Grille » en bas à droite'
			},
			{ keys: [['PgPréc'], ['PgSuiv']], label: 'Folio précédent / suivant' },
			{ keys: [['Début'], ['Fin']], label: 'Premier / dernier folio' },
			{ keys: [['Espace', 'glisser']], label: 'Déplacer la vue' }
		]
	},
	{
		title: 'Dossier',
		items: [
			{ keys: [['Ctrl', 'S']], label: 'Enregistrer tout de suite', hint: 'Sinon : automatique' },
			{ keys: [['Ctrl', 'E']], label: 'Exporter (PDF, CSV)' },
			{ keys: [['?'], ['F1']], label: 'Cette aide' }
		]
	},
	{
		title: 'Souris',
		items: [
			{ keys: [['Molette']], label: 'Zoom sur le curseur' },
			{ keys: [['Maj', 'Molette']], label: 'Défilement horizontal' },
			{ keys: [['Clic droit']], label: 'Menu contextuel' },
			{ keys: [['Clic droit glissé'], ['Clic milieu']], label: 'Déplacer la vue' },
			{
				keys: [['Double-clic']],
				label: 'Modifier le repère ; sur un renvoi / contact : y aller',
				hint: 'Folio d’armoire : aller au symbole du schéma'
			},
			{
				keys: [
					['Maj', 'Clic'],
					['Ctrl', 'Clic']
				],
				label: 'Ajouter / retirer de la sélection'
			},
			{
				keys: [['Glisser vers la droite']],
				label: 'Sélection des éléments entièrement inclus'
			},
			{ keys: [['Glisser vers la gauche']], label: 'Sélection des éléments touchés' }
		]
	}
];
