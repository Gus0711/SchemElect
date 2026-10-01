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
| `Folio` | `symbols`, `wires`, `bars`, `texts`, `rects`, `cables` |
| `Device` | appareil physique : `tag` (KM1), valeur, désignation, référence, fabricant |
| `CatalogItem` | fiche du catalogue matériel (référence, fabricant, désignation, contacts, encombrement, montage) ; le projet garde une copie des fiches utilisées (`Project.catalog`, clé `referenceKey`) |
| `SymbolInstance` | symbole posé : `defId`, `deviceId`, position, rotation, miroir |
| `Wire` | polyligne orthogonale ; `numberOverride` optionnel |
| `Bar` | barre de potentiel horizontale |
| `CableItem` | câble posé en travers des fils : repère (W1), axe (x, y, longueur, vertical), type, paires, couleurs, section, texte |
| `Potential` | Phase 1, Neutre, 24V… : nom, couleur de fil, couleur de tracé |

Unités : **mm**, grille de magnétisme **2,5 mm**. Folio A4 paysage, zone de dessin et
colonnes A–Q / lignes 1–11 définies dans `layout.ts`.

Format versionné (`schemaVersion`) ; toute lecture passe par `migrateProject`.

## 3. Règles métier (toutes testées dans `model.test.ts`)

- **Connectivité géométrique** (`nets.ts`) : une extrémité de fil connecte ce qu'elle touche
  (borne, fil, barre). Bornes pontées d'un symbole (`bridges`), renvois de même repère et
  barres de même potentiel relient entre folios. Union-find.
- **Sections des fils** (`sectionNets` dans `nets.ts`) : par équipotentielle — section
  imposée sur un fil (`Wire.section`) > section du potentiel (`Potential.section`) > section
  par défaut du dossier (`settings.wireSection`, fils hors potentiel). Affichage réglable
  (`settings.sectionDisplay` : toutes / imposées / aucune) : `WireStyle.section`, dessinée par
  `WireView` du côté opposé au numéro (verticale à gauche d'un fil vertical, sous un fil
  horizontal). Colonne « Section » de la liste des fils CSV.
- **Numérotation des fils** : séquentielle sur tout le dossier, ordre folio → x → y ; les
  réseaux reliés à un potentiel ne sont pas numérotés ; `numberOverride` imposable.
- **Repères** (`tags.ts`, `edit.ts`) : repère auto par préfixe à la pose. Taper le repère
  d'un appareil existant sur un symbole **rattache** le symbole (contact → bobine) ; sinon
  l'appareil est **renommé**.
- **Renvois croisés** (`crossrefs.ts`) : slave → position du master ; master → tableau
  NO|NC ; renvois de fil → position des autres renvois.
- **Borniers** (`strips.ts`) : bornes de rôle `terminal` groupées par préfixe ; côté
  intérieur / extérieur = appareils câblés directement (par fils) sur la borne haute / basse.
- **Câbles** (`cables.ts`) : un câble est une ellipse posée en travers des fils ; les fils
  qu'elle coupe (segments perpendiculaires à son axe) sont ses conducteurs, dans l'ordre de
  l'axe. Calculés : couleur de chaque conducteur, libellés (nom vertical à gauche, « Paire
  Ciel / Jaune » le long du 1er fil de chaque paire, comme le folio 04), colonne « Câble »
  des borniers (« W1 P1 Ciel », par équipotentielle), carnet de câbles CSV, contrôles
  (câble plein, câble vide, repère en double). Types prédéfinis (`CABLE_TYPES`) : SYT1
  (paires ; 3 premières d'après l'exemple, suivantes à valider), U1000 R2V / H07RN-F (code
  couleur normalisé), LiYCY, numéroté. Outil **Câble** (K) : glisser en travers des fils.
- **Contacts disponibles** (`Device.contacts`, `crossrefs.ts`) : un master déclare ses contacts
  NO/NC ; dépassement signalé (tableau en rouge à l'écran, jamais dans le PDF, + Contrôles).
- **Alignement** (`edit.ts` : `alignItems`, `distributeItems`) : référence = premier
  sélectionné ; « axe » d'un symbole = abscisse de sa 1re borne ; les fils suivent.
- **Fragments** (`fragments.ts`) : copier/coller, macros, duplication de folio — un seul
  mécanisme, avec renumérotation des repères.
- **Édition** (`edit.ts`) : déplacement avec fils élastiques orthogonaux, glisser de
  segment, rotation, suppression (appareils orphelins nettoyés).

## 3 bis. Catalogue matériel, inventaire, nomenclature

- **Catalogue** (`model/catalog.ts`) : une fiche par référence ; comparaison des références
  par `referenceKey` (sans espaces / points / tirets, majuscules : « 4 067 71 » = « 406771 »).
  Bibliothèque partagée (table `catalog`, `server/catalog.ts`, API `/api/catalog`, page
  `/catalogue` : recherche, fiche, import / export CSV, catalogue de départ
  `model/catalogStarter.ts`). Le projet garde **une copie** des fiches utilisées
  (`Project.catalog`) : `assignReference` (choix de la référence dans l'inspecteur) recopie la
  fiche, reprend le fabricant et retire les copies inutiles ; `catalogUpdates` /
  `applyCatalogUpdates` = bouton « Reprendre les fiches du catalogue » du panneau Appareils.
  Les fragments (copier/coller, macros) transportent les fiches.
- **Déduit d'une fiche** (jamais recopié sur l'appareil) : contacts disponibles
  (`deviceContacts` : saisie de l'appareil, sinon fiche → alerte de dépassement) et
  encombrement / montage (`deviceFootprint` : fiche, sinon valeur par symbole).
- **Inventaire** (`model/inventory.ts`) : `listDevices` (appareils physiques hors renvois /
  décors, famille = catégorie du symbole principal, emplacements, problèmes « sans
  référence » / « contacts ») et `searchProject` (recherche Ctrl+F : repères, références,
  désignations, n° de fils, bornes, câbles, folios, textes ; classement par pertinence).
- **Accessoires liés** (`CatalogItem.accessories` : référence + quantité, saisis en texte
  « 2 × LADN11, RXZE2S114M ») : recopiés dans le projet avec la fiche, ajoutés à la
  nomenclature (quantité × appareils, « accessoire de KA1 à KA4 »). Un seul niveau.
- **Nomenclature** (`model/nomenclature.ts`) : une ligne par référence (quantité, repères
  compactés « KA1 à KA4 » par `compressTags`), puis les appareils sans référence par préfixe
  (« À compléter »). Bornes comprises.

## 3 bis-2. Liste de commande (`model/orderList.ts`)

Tout ce qu'il faut acheter, groupé par fabricant (`groupByManufacturer` : fabricants, puis
« Sans fabricant », puis « À compléter » = lignes sans référence). Sources : nomenclature
(appareils, bornes, accessoires) ; matériel d'armoire calculé depuis les folios
d'implantation — enveloppe (`Panel.reference`), rails en barres de 2 m, goulottes en mètres
par dimension (`ductSize`), 2 butées + 1 flasque par bornier ; câbles par référence ou
désignation, longueur `CableItem.cableLength` (m) ; lignes libres `Project.orderExtras`.
Références du matériel : `Project.materials` ; leurs fiches sont recopiées par
`linkReference` et gardées par `pruneProjectCatalog` (`orderReferences`). Pas de prix.
Sorties : onglet « Liste de commande » de la fenêtre Nomenclature (saisie des références et
lignes libres), CSV, pages « LISTE DE COMMANDE » en fin de PDF (`export/orderTable.ts`,
`render/OrderPage.svelte`).

**Piège Svelte** : sur l'état réactif, ne pas écrire `(p.x ??= {})[k] = v` ni
`(p.list ??= []).push(…)` — `??=` renvoie l'objet brut, la modification n'est pas vue (et
peut être perdue). Écrire `p.x ??= {}; p.x[k] = v`.

## 3 ter. Historique des versions et duplication

- Règles pures (`model/versions.ts`, testées) : version **automatique** à l'enregistrement si
  la précédente a plus de 15 min, à la fermeture du dossier (libération du verrou), à la
  création — jamais sans changement (empreinte SHA-256 du document sans `modifiedAt`) ;
  version **nommée** à la main, à chaque nouvel indice de révision (« Indice B — … »), avant
  une restauration. Conservation (`versionsToPrune`) : automatiques gardées 48 h, puis la
  dernière de chaque jour pendant 30 jours ; nommées toujours. Restauration (`canRestore`) :
  administrateur ou intervenant (auteur d'une version ou dernier modificateur).
- Stockage (`server/versions.ts`) : table `project_versions` (document gzip + base64,
  résumé folios / appareils, empreinte). Branché dans `server/projects.ts` (`insertProject`,
  `saveProjectData`, `restoreVersion`, `duplicateProject`, `versionOnClose`).
- API : `/api/projects/[id]/versions` (GET liste + droit, POST version nommée),
  `…/versions/[vid]` (GET document), `…/versions/[vid]/restore` (POST, verrou requis),
  `/api/projects/[id]/duplicate` (POST : nom, affaire, plan, client, indices remis à zéro,
  `versionId` optionnel).
- Interface : bouton **Historique** (`HistoryDialog` : enregistrer une version, voir,
  restaurer, dupliquer) ; consultation d'une version = route `/projets/[id]/versions/[vid]`
  (`EditorApp` avec `version` : lecture seule, `EditSession.archive()`, bandeau PDF /
  duplication) ; `DuplicateDialog` (éditeur, historique, liste des projets). Restauration :
  `session.flush()` → `session.suspend()` → API → rechargement de la page.

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

## 4 bis. Implantation et façade (`model/panel.ts`, `model/footprints.ts`)

Un folio d'armoire porte `Folio.panel` (`kind` : `implantation` | `facade`) : enveloppe
L × H × P, rails (axe + longueur), goulottes (emprise + hauteur), éléments posés
(`PanelItem` : appareil du schéma ou bornier, centre + encombrement). Tout est en **mm
réels** ; `panelTransform` calcule l'échelle normalisée (auto ou imposée) et la position
sur la page. Déduit : rail porteur (`railOf`), remplissage, chevauchements, appareils à
placer (`panelCandidates`), largeur des borniers (`syncPanels`, appelé dans `transact`),
alertes (`panelIssues`). Encombrement / montage par défaut par symbole
(`footprints.ts`), montage modifiable par appareil (`Device.mounting`). Placement
automatique (`autoPlace`) : rails par type d'appareil ; façade une rangée par folio.
Rendu : `render/PanelView.svelte` (écran et PDF). Éditeur : outils Rail / Goulotte /
pose d'appareil, onglet **Appareils** (`PanelDevices`), `PanelInspector`, magnétisme 5 mm
réels (`Editor.snap`).

## 4 ter. Cartouche et page de garde (`model/template.ts`)

`DocTemplate` : logo (data URL), champs libres (`fields`, valeurs dans `meta.fields`),
cartouche = cases (`text` à lignes, `logo`, `folio` ; largeur 0 = reste), page de garde =
blocs société / présentation / titre / pied (3 cases). Les textes contiennent des champs
`{clé}` résolus par `fillText` (projet, folio, champs libres). `projectTemplate(project)`
= copie du projet ou modèle Standard (rendu d'origine). Rendu : `render/TitleBlock.svelte`
(dans `FolioFrame`) et `CoverPage`. Bibliothèque : table `templates`, `server/templates.ts`,
API `/api/templates`, page `/modeles` ; édition : `TemplateEditor` (aperçu en direct),
onglet Modèle des propriétés du dossier, choix à la création du projet.

## 4 quater. Folio borniers (`model/stripDrawing.ts`)

`Folio.strips = { prefixes }` (vide = tous) : folio sans symboles, dessiné à partir de
`projectStrips` (`render/StripDrawing.svelte`). Mise en page en bandeaux (`layoutStripPages`),
un folio = une page ; série = folios borniers de même filtre (`stripFolioPage`,
`stripSeriesIssues`). Double-clic : `stripTerminalAt` → `goToSymbol`.

## 5. Éditeur (`src/lib/editor/`)

- `editor.svelte.ts` — `Editor` : projet réactif, folio courant, sélection, outil,
  historique (instantanés), `transact()` / gestes, presse-papiers (localStorage, marche
  entre projets).
- `interaction.svelte.ts` — gestes souris/clavier → commandes (aucune règle métier).
- `viewport.svelte.ts` — zoom / déplacement.
- `session.svelte.ts` — verrou (heartbeat 30 s) et sauvegarde automatique (1,2 s).
- `components/` — `EditorApp` (assemblage), `Toolbar`, `Sidebar` (Folios / Symboles /
  Macros / Appareils ; sur un folio d'armoire l'onglet Symboles devient « À placer »),
  `Canvas`, `Inspector`, `ChecksPanel`, `ProjectDialog`, `StripsDialog`, `StatusBar`,
  `DevicesPanel` (liste des appareils, filtres, emplacements), `SearchDialog` (Ctrl+F),
  `NomenclatureDialog`, `CatalogItemDialog` (fiche catalogue, aussi utilisée par `/catalogue`).
- Catalogue dans l'éditeur : `Editor.catalog` (chargé au démarrage), `setReference`,
  `catalogChanges`, `applyCatalogChanges` ; navigation générique `Editor.goToItem`.

Raccourcis : liste complète dans `shortcuts.ts`, affichée par l'aide (**?** / F1,
`ShortcutsDialog`). Principaux : S sélection, W fil, B barre, K câble, T texte, C cadre,
/ recherche de symbole, Entrée reprendre le dernier symbole, R pivoter, X miroir, F2 modifier,
Suppr, Ctrl+Z/Y, Ctrl+C/X/V/D/A, flèches (Maj ×4), PgPréc/PgSuiv et Début/Fin folios,
F page entière, + / − / 1 zoom, G grille, Espace (fil : inverser le coude ; sinon : déplacer
la vue), Ctrl+S, Ctrl+E exporter.
Clic droit : menu contextuel (`contextMenu.ts`, composant générique `ui/ContextMenu.svelte`) ;
clic droit glissé ou bouton du milieu : déplacer la vue ; pendant un fil : terminer.
Navigation (`crossTargets` dans `crossrefs.ts`, `Editor.goToSymbol`) : double-clic sur un
renvoi de fil → renvoi jumeau ; sur un contact → sa bobine ; menu clic droit « Aller à… ».

## 6. Serveur (`src/lib/server/`, `src/routes/api/`)

SQLite (libSQL) + Drizzle, tables créées au démarrage. Auth maison (Argon2id, sessions
hachées). Verrou d'édition par projet (expire après 2 min sans heartbeat). API JSON :
projets (GET/PUT), verrou, macros, symboles maison, modèles, catalogue (`/api/catalog` : GET,
POST d'une fiche ou `{ items }` pour un import — même référence = mise à jour). Client typé : `src/lib/api/client.ts`.

Sauvegarde automatique (`backup.ts`, démarrée par le hook `init` de `hooks.server.ts`) :
copie cohérente `VACUUM INTO` dans `backups/` à côté de la base (ou `BACKUP_DIR`), toutes les
`BACKUP_INTERVAL_HOURS` h (défaut 24, 0 = désactivé), `BACKUP_KEEP` conservées (défaut 30).
Page admin `/admin/sauvegardes` : liste, « Sauvegarder maintenant », téléchargement.

## 7. Export (`src/lib/export/`)

PDF (jsPDF + svg2pdf.js) à partir des MÊMES composants SVG : page de garde, folios,
borniers, nomenclature (option, cochée dès qu'un appareil a une référence ;
`export/bomTable.ts` + `render/BomPage.svelte`). CSV (`;`, BOM UTF-8) : borniers,
nomenclature par référence, liste des appareils, fils, câbles.

## 8. Design

- Interface : **uniquement** les variables de `src/lib/styles/tokens.css` et le kit
  `src/lib/ui/` (Button, Field, Modal, Panel, Card…). Changer le design = modifier ces deux
  endroits.
- Deux thèmes aux couleurs Dumortier (marine + doré) : **clair « Atelier »** (défaut, bloc
  `:root`) et **sombre « Nuit »** (bloc `:root[data-theme='dark']`). Choix Clair / Sombre /
  Système par poste (`localStorage`), bouton `ThemeToggle` dans l'en-tête et la barre
  d'outils de l'éditeur ; `src/lib/ui/theme.svelte.ts` + script anti-flash dans
  `src/app.html`. Police d'interface : Manrope (`@fontsource-variable/manrope`, servie
  localement). Les folios restent blancs dans les deux thèmes ; les vignettes de symboles
  ont un fond papier en sombre (`--c-thumb-bg`, `--c-drawing-bg`).
- Schémas : **uniquement** `src/lib/theme/schematic.ts` (traits, couleurs, polices, tailles
  de texte, `signalColors` des voyants) — utilisé à l'écran et dans le PDF.
