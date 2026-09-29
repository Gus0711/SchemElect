# Architecture — SchemElect

Description de référence de **ce qui est implémenté**. À tenir à jour à chaque session.

## 1. Principe

Le **modèle métier** (`src/lib/model/`) est la seule source de vérité : un document JSON
`Project`. Tout ce qui se déduit — équipotentielles, numéros de fils, jonctions, renvois
croisés, borniers, contrôles — est **calculé** (`analyzeProject`) et jamais stocké.

Le rendu SVG (`src/lib/render/`) est **unique** : les mêmes composants servent à l'écran
(éditeur) et au PDF (export). Il n'y a pas de bibliothèque de diagramme tierce (voir
ADR-001 bis).

```
            ┌─────────────── src/lib/model (TS pur, testé) ───────────────┐
 Project ──►│ edit.ts  fragments.ts  nets.ts  crossrefs.ts  strips.ts     │──► ProjectAnalysis
 (JSON)     │ geometry.ts  layout.ts  snap.ts  tags.ts  project.ts        │
            └──────────────────────────────────────────────────────────────┘
                 ▲ mutations (transact)                  │ lecture
 src/lib/editor  │ Editor (état runes, historique)       ▼
   Interaction ──┘ (souris/clavier)            src/lib/render (SVG)
   EditSession (verrou + autosave) ──► /api    FolioContent → écran & PDF
```

## 2. Modèle de données (`src/lib/model/types.ts`)

| Type | Rôle |
|---|---|
| `Project` | `meta` (cartouche), `revisions`, `potentials`, `devices` (map id → Device), `folios`, `settings` |
| `Folio` | `symbols`, `wires`, `bars`, `texts`, `rects` |
| `Device` | appareil physique : `tag` (KM1), valeur, désignation, référence, fabricant |
| `SymbolInstance` | symbole posé : `defId`, `deviceId`, position, rotation, miroir |
| `Wire` | polyligne orthogonale ; `numberOverride` optionnel |
| `Bar` | barre de potentiel horizontale |
| `Potential` | Phase 1, Neutre, 24V… : nom, couleur de fil, couleur de tracé |

Unités : **mm**, grille de magnétisme **2,5 mm**. Folio A4 paysage, zone de dessin et
colonnes A–Q / lignes 1–11 définies dans `layout.ts`.

Format versionné (`schemaVersion`) ; toute lecture passe par `migrateProject`.

## 3. Règles métier (toutes testées dans `model.test.ts`)

- **Connectivité géométrique** (`nets.ts`) : une extrémité de fil connecte ce qu'elle touche
  (borne, fil, barre). Bornes pontées d'un symbole (`bridges`), renvois de même repère et
  barres de même potentiel relient entre folios. Union-find.
- **Numérotation des fils** : séquentielle sur tout le dossier, ordre folio → x → y ; les
  réseaux reliés à un potentiel ne sont pas numérotés ; `numberOverride` imposable.
- **Repères** (`tags.ts`, `edit.ts`) : repère auto par préfixe à la pose. Taper le repère
  d'un appareil existant sur un symbole **rattache** le symbole (contact → bobine) ; sinon
  l'appareil est **renommé**.
- **Renvois croisés** (`crossrefs.ts`) : slave → position du master ; master → tableau
  NO|NC ; renvois de fil → position des autres renvois.
- **Borniers** (`strips.ts`) : bornes de rôle `terminal` groupées par préfixe ; côté
  intérieur / extérieur = appareils câblés directement (par fils) sur la borne haute / basse.
- **Contacts disponibles** (`Device.contacts`, `crossrefs.ts`) : un master déclare ses contacts
  NO/NC ; dépassement signalé (tableau en rouge à l'écran, jamais dans le PDF, + Contrôles).
- **Alignement** (`edit.ts` : `alignItems`, `distributeItems`) : référence = premier
  sélectionné ; « axe » d'un symbole = abscisse de sa 1re borne ; les fils suivent.
- **Fragments** (`fragments.ts`) : copier/coller, macros, duplication de folio — un seul
  mécanisme, avec renumérotation des repères.
- **Édition** (`edit.ts`) : déplacement avec fils élastiques orthogonaux, glisser de
  segment, rotation, suppression (appareils orphelins nettoyés).

## 4. Bibliothèque de symboles (`src/lib/symbols/`)

Définitions déclaratives (`SymbolDef`) : primitives graphiques, bornes, rôle
(`master`/`slave`/`standalone`/`terminal`/`link`/`decor`), emplacements des textes.
Un fichier par catégorie dans `library/`, chargé automatiquement. Voir `docs/SYMBOLES.md`.
Aperçu de toute la bibliothèque : route `/symboles`.

**Symboles maison** (`custom.ts`, éditeur `CustomSymbolDialog.svelte`) : une image de
documentation (déposée, choisie ou collée Ctrl+V, réduite et ré-encodée en data URL) ou un
cadre titré, plus des bornes posées **exactement au clic** (sur les vis de l'image),
déplaçables à la souris et aux flèches (0,1 mm), zoom molette ; « ajout rapide » d'une
rangée ; magnétisme grille optionnel (désactivé par défaut). Retouches d'image dans
l'éditeur (`editor/image.ts`, canvas) : rogner, gommer une zone, fond blanc → transparent,
annuler ; poignée de redimensionnement (bornes mises à l'échelle). Rendu : les fils sont
dessinés **au-dessus** des symboles. Redimensionnement **par exemplaire** sur le folio
(`SymbolInstance.scale`, `scaleSymbol`, poignée `Editor.scaleHandle`, champ « Échelle % »),
réservé aux symboles maison ; les fils suivent, les traits gardent leur épaisseur. Stockés dans la bibliothèque partagée (table `custom_symbols`, API `/api/symbols`),
enregistrés à l'exécution (`registerCustomSymbols`) et **recopiés dans le projet**
(`Project.customSymbols`) dès qu'ils sont posés : le dossier reste autonome (copier/coller
et macros transportent aussi les définitions). Bornes homonymes (deux « 0V ») : id unique
`0V#2`, libellé `0V`.

## 5. Éditeur (`src/lib/editor/`)

- `editor.svelte.ts` — `Editor` : projet réactif, folio courant, sélection, outil,
  historique (instantanés), `transact()` / gestes, presse-papiers (localStorage, marche
  entre projets).
- `interaction.svelte.ts` — gestes souris/clavier → commandes (aucune règle métier).
- `viewport.svelte.ts` — zoom / déplacement.
- `session.svelte.ts` — verrou (heartbeat 30 s) et sauvegarde automatique (1,2 s).
- `components/` — `EditorApp` (assemblage), `Toolbar`, `Sidebar` (Folios / Symboles /
  Macros), `Canvas`, `Inspector`, `ChecksPanel`, `ProjectDialog`, `StripsDialog`,
  `StatusBar`.

Raccourcis : S sélection, W fil, T texte, C cadre, R pivoter, X miroir, Suppr, Ctrl+Z/Y,
Ctrl+C/X/V/D/A, flèches (Maj ×4), PgPréc/PgSuiv folios, F page entière, G grille,
Espace (pendant un fil : inverser le coude ; sinon : déplacer la vue), Ctrl+S.
Clic droit : menu contextuel (`contextMenu.ts`, composant générique `ui/ContextMenu.svelte`) ;
clic droit glissé ou bouton du milieu : déplacer la vue ; pendant un fil : terminer.
Navigation (`crossTargets` dans `crossrefs.ts`, `Editor.goToSymbol`) : double-clic sur un
renvoi de fil → renvoi jumeau ; sur un contact → sa bobine ; menu clic droit « Aller à… ».

## 6. Serveur (`src/lib/server/`, `src/routes/api/`)

SQLite (libSQL) + Drizzle, tables créées au démarrage. Auth maison (Argon2id, sessions
hachées). Verrou d'édition par projet (expire après 2 min sans heartbeat). API JSON :
projets (GET/PUT), verrou, macros. Client typé : `src/lib/api/client.ts`.

## 7. Export (`src/lib/export/`)

PDF (jsPDF + svg2pdf.js) à partir des MÊMES composants SVG : page de garde, folios,
borniers. CSV (`;`, BOM UTF-8) : borniers, appareils, fils.

## 8. Design

- Interface : **uniquement** les variables de `src/lib/styles/tokens.css` et le kit
  `src/lib/ui/` (Button, Field, Modal, Panel, Card…). Changer le design = modifier ces deux
  endroits.
- Schémas : **uniquement** `src/lib/theme/schematic.ts` (traits, couleurs, polices, tailles
  de texte, `signalColors` des voyants) — utilisé à l'écran et dans le PDF.
