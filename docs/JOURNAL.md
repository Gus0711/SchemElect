# Journal des sessions

Une entrée par session, la plus récente en haut. Gabarit :

```
## AAAA-MM-JJ — Phase N : titre
**Fait** : …
**Reste / suite** : …
**Pièges / à savoir** : …
```

---

## 2026-10-01 (suite) — Historique des versions et duplication

**Décisions de l'utilisateur** : versions automatiques (15 min de travail + fermeture ;
48 h complètes puis 1 par jour pendant 30 jours), versions nommées sans limite, version
automatique à chaque nouvel indice ; restauration ouverte à l'administrateur **et aux
intervenants du dossier** ; mode de duplication pour une nouvelle affaire.

**Fait** :
- Table `project_versions` (document compressé), règles pures `model/versions.ts`, stockage
  `server/versions.ts`, API versions / restauration / duplication.
- Bouton **Historique** : enregistrer une version commentée, liste (nommées surlignées,
  auteur, nb de folios / appareils), **Voir** (lecture seule, PDF de la version, nouveau
  dossier à partir de la version), **Restaurer** (l'état actuel est d'abord gardé en
  « Avant restauration… », donc annulable), dupliquer.
- **Dupliquer** (liste des projets, historique, consultation) : nom, n° d'affaire, n° de
  plan, client, « repartir sans indice » ; la copie s'ouvre, son historique repart de zéro.
- Tests : 429 unitaires + 14 parcours e2e.

**Reste / suite** : comparaison de deux versions (liste des écarts) ; éventuellement
suppression d'une version nommée par l'administrateur.

**Pièges / à savoir** : les libellés générés côté serveur (« Avant restauration de la version
du … ») sont en heure de Paris (`Europe/Paris`), la liste en heure du navigateur. Les dossiers
existants n'ont pas d'historique avant leur premier enregistrement.

---

## 2026-10-01 — Panneau Appareils, recherche Ctrl+F, catalogue matériel, nomenclature

**Contexte** : l'application est déployée sur le serveur interne ; V.R a quitté la société
(l'utilisateur teste, puis un collègue). `CLAUDE.md` et la feuille de route mis à jour.

**Fait** :
- **Panneau « Appareils »** (onglet de la barre latérale ; sur un folio d'armoire l'ancien
  onglet « Appareils » s'appelle maintenant « À placer ») : tous les repères groupés par
  famille, recherche, filtres « Sans réf. » / « Contacts » (dépassement), bornes en option,
  clic = aller au symbole principal + liste des emplacements cliquables, bouton
  « Nomenclature » (aperçu + CSV).
- **Recherche Ctrl+F** (et bouton « Rechercher ») : repères, références, désignations,
  n° de fils, bornes, câbles, folios (titre ou numéro), textes ; ↑ ↓ Entrée.
- **Catalogue matériel** : page `/catalogue` (lien dans l'en-tête), fiche (référence,
  fabricant, désignation, catégorie, contacts NO/NC, L × H, montage, remarque), import CSV
  (colonnes reconnues en FR/EN, séparateur détecté, même référence = mise à jour), export CSV,
  modèle de fichier. **Catalogue de départ** (bouton) : ~54 fiches — TeSys K/D, GV2ME, Acti9
  iC60N / iID, relais Zelio / Finder, Phaseo, Harmony XB5, bornes Phoenix + 5 références
  relevées dans le dossier DW261136 (le `.xrs` n'en contient que 5). Toutes marquées
  « à vérifier ».
- **Dans l'éditeur** : la référence se choisit dans le catalogue (liste déroulante,
  casse / espaces indifférents) ; la fiche est recopiée dans le projet, le fabricant repris ;
  « ajouter au catalogue » si la référence est inconnue. Contacts disponibles et
  encombrement déduits de la fiche (alerte de contacts, implantation). Fiches transportées
  par copier / coller et macros.
- **Nomenclature par référence** : CSV + pages « NOMENCLATURE » en fin de PDF (option).
- Tests : 420 unitaires + 13 parcours e2e (nouveau : catalogue → Appareils → Ctrl+F → PDF).

**Reste / suite** :
1. Test par l'utilisateur sur le serveur ; vérifier / corriger le catalogue de départ.
2. Historique par indice de révision : **à discuter** avant de coder.
3. Éventuel : référence affichée sur le symbole depuis la fiche, export .xlsx.

**Pièges / à savoir** :
- Session cloud Linux : pas d'Edge → e2e avec une config hors dépôt (sans `channel`,
  `executablePath: '/opt/pw-browsers/chromium'`). Au tout premier lancement, l'export PDF du
  1er parcours peut dépasser le délai (Vite optimise jsPDF et recharge la page) : relancer.
- `Project.catalog` est repris dans `migrateProject` (fiches normalisées).

---

## 2026-09-29 (suite 8) — Folio borniers automatique (dessin)

**Fait** : nouveau type de folio (« + Folio » › Folio borniers) : dessin calculé des borniers
(`model/stripDrawing.ts`, `render/StripDrawing.svelte`) — bornes en rangée sur rail avec
butées ; au-dessus n° de fil (bleu), appareils intérieurs, position de la borne (rouge) ; en
dessous câble + couleur, appareils extérieurs, désignation. Petits borniers sur un même
bandeau, long bornier « (suite) », 2 bandeaux par page. Filtre par bornier (inspecteur).
**Un folio = une page** : les folios borniers de même filtre forment une série (page 1, 2…) ;
s'il en manque, contrôle + bouton « Ajouter la suite » (la numérotation, donc les renvois,
reste juste). Double-clic sur une borne → son symbole. Outils limités au texte / cadre.
Export : « Tableaux des borniers (fin de dossier) » décoché par défaut s'il existe un folio
borniers. 12 parcours e2e.

---

## 2026-09-29 (suite 7) — Grille d'affichage réglable

**Fait** : bouton « Grille : … » en bas à droite (`GridControl`) : afficher (G), type
**Points / Quadrillage / Cases A–Q** (suit le repérage du cadre), pas 2,5 / 5 / 10 mm, curseur
de visibilité. Préférence mémorisée dans le navigateur (`editor/grid.ts`, tous projets).
Folios d'armoire : cases seulement. **Imprimable** : option « Imprimer la grille dans le
PDF » (panneau Grille et fenêtre d'export) ; rendu commun écran / PDF `render/GridLayer.svelte`
(écran : taille constante en pixels ; PDF : mm, points réels car les motifs SVG passent mal),
couleurs dans `schematic.grid`. Correctif : les points étaient invisibles (0,18 mm, gris très
clair). Bouton « Tous les raccourcis » dans la barre d'état (celui de la barre du haut retiré).
11 parcours e2e.

---

## 2026-09-29 (suite 6) — Raccourcis clavier et aide

**Fait** : aide des raccourcis (touche **?** ou F1, bouton clavier de la barre d'outils,
menu clic droit, rappel dans la barre d'état) avec recherche ; liste unique dans
`editor/shortcuts.ts`. Nouveaux raccourcis : **/** (recherche de symbole, Entrée = 1er
résultat), **Entrée** (reprendre le dernier symbole posé), **B** (barre, dernier potentiel),
**F2** (repère / texte / n° de fil), **+ / − / 1** (zoom), **Début / Fin** (premier / dernier
folio), **Ctrl+E** (exporter). 10 parcours e2e.

**Pièges / à savoir** : toute nouvelle touche doit être ajoutée à `shortcuts.ts` (l'aide
n'est pas générée depuis `keyDown`). Touches testées par `e.key` : fonctionne en AZERTY.
Serveur de dev : un fichier réécrit pendant que Vite tourne (dossier OneDrive) peut être lu
**vide** et mis en cache → navigateur : « does not provide an export named 'Editor' ».
Remède : `touch` du fichier ou relancer `npm run dev` (le fichier sur disque est intact).

---

## 2026-09-29 (suite 5) — Modèles de cartouche et de page de garde

**Fait** : modèles réutilisables (`model/template.ts`) : logo (image réduite, data URL),
champs libres propres au modèle (« Lot », « Maître d'ouvrage »…, valeurs saisies par projet
dans `meta.fields`), **cartouche en cases configurables** (texte 1 à 3 lignes avec libellé,
taille, gras, bleu, traits ; case logo ; case n° de folio ; largeur, 0 = reste) et **page de
garde** (bloc société à droite du logo, présentation facultative, titre, pied à 3 cases).
Textes à champs `{affaire}`, `{plan}`, `{indice}`, `{lot}`… (menu « + champ »). Modèle
**Standard** = rendu d'origine. Bibliothèque partagée (table `templates`, API
`/api/templates`, page **Modèles** avec aperçus) ; choix du modèle à la création du projet
et dans Propriétés du dossier › Modèle (appliquer, personnaliser avec aperçu, enregistrer
dans la bibliothèque) ; chaque projet garde sa copie (`Project.template`). Rendu :
`render/TitleBlock.svelte` + `CoverPage` pilotés par le modèle (écran et PDF). 391 tests
unitaires + 9 parcours e2e.

**Reste / suite** : faire créer par V.R le modèle Dumortier réel (logo, présentation,
SIRET) ; éventuellement plusieurs hauteurs de cartouche.

**Pièges / à savoir** : `migrateProject` reconstruit le projet champ par champ — tout
nouveau champ de `Project` doit y être repris (le modèle était perdu à la relecture, attrapé
par le test). Renommer un champ libre dans l'éditeur renomme sa clé et les `{clé}` des
textes du modèle.

---

## 2026-09-29 (suite 4) — Folios d'implantation et de façade (phase 13)

**Fait** : deux nouveaux types de folio (menu « + Folio » : Schéma / Implantation / Façade),
`Folio.panel` en **mm réels** (`model/panel.ts`, `model/footprints.ts`), échelle normalisée
automatique (armoire 1000 × 600 → 1:6) ou imposée. **Implantation** : armoire debout,
goulottes + rails oméga générés (nb de rails, largeurs, hauteur de goulotte) puis outils
Rail / Goulotte ; appareils du schéma et borniers à placer (onglet **Appareils**) au clic,
accrochage au rail, **placement automatique** par type (protection → commande → borniers),
rail qui emmène ses appareils, « Serrer à gauche », cotes (largeur, hauteur, chaîne des
axes de rails), remplissage des rails ; contrôles : rail trop plein, chevauchement, hors
armoire, appareils restant à placer. **Façade** : porte à l'échelle, grille 5 cm + axe
horizontal (cotes ± comme le folio 12), voyants colorés / commutateurs / boutons / AU,
étiquettes (désignation, passage à la ligne), placement auto une rangée par folio du
schéma. Montage déduit du symbole, modifiable par appareil (`Device.mounting`).
Double-clic sur un appareil posé → son symbole. Largeur des borniers = nb de bornes
(recalculée à chaque modification). Même rendu écran / PDF (`render/PanelView.svelte`).
380 tests unitaires + 7 parcours e2e.

Placement auto : un rail par famille (protection / commande / borniers) s'il y a assez de
rails, sinon à la suite ; axes de rails générés sur des multiples de 5 mm. **Exemple
complet** (bouton « Exemple armoire complète » de l'accueil, `export/sampleArmoire.ts`) :
distribution (IG, différentiel, prise, transfo 230/24V + renvois), chaudière, pompe,
implantation 800 × 600, façade — aucun contrôle en alerte (test dédié).

**Reste / suite** : faire valider par V.R les encombrements par défaut (`footprints.ts`)
et l'ordre de rangement ; catalogue matériel (phase 12) pour les vraies dimensions par
référence ; option « armoire couchée » (comme WinRelais) si demandée.

**Pièges / à savoir** : les éléments d'armoire (`rail`, `duct`, `mount`) sont en mm réels,
convertis à la volée (`panelTransform`) ; le magnétisme y est de 5 mm réels
(`Editor.snap`). Les folios d'armoire n'ont ni symboles ni fils : l'analyse électrique ne
les voit pas.

---

## 2026-09-29 (suite 3) — Thèmes d'interface clair / sombre

**Fait** : 3 maquettes proposées (Marine, Atelier clair, Nuit) ; choix utilisateur =
**Atelier clair** par défaut + **Nuit** en mode sombre. `tokens.css` réécrit (marine
`#0b3a66`, doré `#c4921a`, coins 8 px, police Manrope), bloc sombre, sélecteur
Clair / Sombre / Système (en-tête + barre d'outils éditeur), logo dans l'en-tête. Couleurs
en dur restantes passées en variables (fond de modale, ombre du folio).

**Reste / suite** : retours V.R sur le thème ; PDF inchangé (non concerné).

**Pièges / à savoir** : les symboles sont dessinés en noir → toute vignette hors folio doit
avoir un fond `--c-thumb-bg` / `--c-drawing-bg` pour rester lisible en sombre.

---

## 2026-09-29 (suite 2) — Câbles multi-conducteurs (priorité 4, demandée avant le test V.R)

**Fait** : objet câble (`CableItem`, `Folio.cables`, `model/cables.ts`) posé à la souris
(outil **Câble**, touche K) en travers des fils : conducteurs = fils coupés, dans l'ordre ;
défaut SYT1 à paires (« CABLE SYT1 3 PAIRES », « Paire Ciel / Jaune »… comme le folio 04).
Inspecteur : repère W1, type (liste), paires / conducteurs, section, couleurs (une paire
par ligne), texte affiché, afficher les couleurs, longueur, « Ajuster à n fils », pivoter.
Colonne **Câble** dans les borniers (écran, PDF, CSV), **carnet de câbles** CSV, contrôles
(câble plein / vide / repère en double, ellipse rouge à l'écran). Copier/coller, macros,
duplication de folio (nouveau repère). Câble W1 ajouté au projet de démonstration.
361 tests unitaires + 6 parcours e2e.

**Reste / suite** : faire valider par V.R l'ordre des couleurs SYT1 au-delà de 3 paires
(`SYT1_PAIRS`) et la mise en page des libellés. Idée : poignées pour étirer le câble à la
souris (aujourd'hui : champ Longueur).

**Pièges / à savoir** : une autre session travaillait en parallèle (thème clair/sombre) et
lançait aussi les e2e sur le port 4299 → échecs en cascade ; relancer seul. Le test
« symbole maison » cliquait avant la fin de l'enregistrement serveur (course) : corrigé
(attente de la fermeture de la fenêtre et de l'outil de pose).

---

## 2026-09-29 (suite) — Priorité 1 : commit + sauvegarde de la base

**Fait** : premier commit git (`main`, accord de l'utilisateur). Sauvegarde automatique de
la base (`src/lib/server/backup.ts`) : `VACUUM INTO` (copie cohérente à chaud) dans
`backups/` à côté de la base, toutes les 24 h (vérifiée toutes les 15 min, et au démarrage
via le hook `init`), rotation 30 copies ; réglable par `BACKUP_DIR`,
`BACKUP_INTERVAL_HOURS` (0 = off), `BACKUP_KEEP`. Page admin **Sauvegardes** (liste,
« Sauvegarder maintenant », téléchargement). 347 tests unitaires + 5 parcours e2e.

**Reste / suite** : priorité 2 — test par le dessinateur (V.R) sur DW261136 ; priorité 3 —
mise en service (penser à copier `data/backups/` hors du serveur).

**Pièges / à savoir** : les sauvegardes sont sur le même disque que la base → elles
protègent d'une fausse manœuvre / corruption, pas d'une panne disque. e2e : sauvegarde
périodique désactivée (`BACKUP_INTERVAL_HOURS=0`), dossier `test-results/backups` purgé.

---

## 2026-09-29 (fin de session) — Bilan et priorités

**État** : V1 + symboles maison (image retouchable, bornes au clic, redimensionnement sur le
folio), navigation par renvois, menu clic droit, alignement, alerte de contacts. 341 tests
unitaires + 4 parcours e2e (Edge) au vert. Serveur de dev : http://127.0.0.1:5300.

**Toujours rien de commité** (l'utilisateur n'a pas encore demandé de commit).

**Priorités validées pour la suite** : voir `CLAUDE.md` § Priorités et `docs/ROADMAP.md`
§ Priorités — 1) commit + sauvegarde base, 2) test dessinateur, 3) mise en service,
4) câbles, 5) panneau Appareils + recherche, puis catalogue / implantation / indices.

**Pièges rencontrés** : cache HMR de Vite qui garde une version intermédiaire d'un fichier
(→ redémarrer le serveur de dev) ; conflit de port avec opengtb (→ port fixe 5300) ;
`$effect` qui lit l'état qu'il réinitialise (→ ne lire que les déclencheurs).

---

## 2026-09-29 — Symboles maison depuis une image de documentation

**Fait** : éditeur de symbole (bouton « + » de la palette) : image (fichier, glisser-déposer
ou Ctrl+V d'une capture) ou cadre titré ; bornes posées exactement au clic, n'importe où
sur l'image (retour utilisateur : l'accroche au bord ne convenait pas), glisser pour
déplacer, flèches 0,1 mm, zoom molette, sortie du fil réglable ; rangée rapide ;
magnétisme grille optionnel (désactivé par défaut) ; anciens symboles relus ; retouches
d'image (rogner, gommer, fond transparent, annuler), poignée de redimensionnement ; fils
dessinés au-dessus des symboles (ils passaient sous les images) ; redimensionnement des
symboles maison directement sur le folio (poignée + champ Échelle %, fils qui suivent) ; bibliothèque
partagée en base, copie embarquée dans chaque projet ; modification / suppression par clic
droit dans la palette ou depuis l'inspecteur. Rendu identique à l'écran et au PDF.

**Idée suivante** : import direct des symboles d'un `.xrs` WinRelais (format lisible :
sections `Symbole` / `Contour` / `Broche` / `Arc`, coordonnées en 1/100 mm) vers la même
bibliothèque.

---

## 2026-09-28 (nuit) — Menu clic droit, alignement, contacts, finitions

**Fait** : menu contextuel (symbole, fil, texte, multi-sélection, fond) ; alignement
(gauche / axe / droite / haut / milieu / bas) et répartition, dans l'inspecteur et le menu ;
contacts disponibles NO/NC sur bobines et disjoncteurs + alerte de dépassement (tableau
rouge, inspecteur, Contrôles) ; voyants colorés par leur valeur ; réglages de numérotation
(premier numéro, nb de chiffres) ; renommage d'un folio par double-clic ; navigation par
renvois (double-clic renvoi → renvoi jumeau, contact → bobine, menu « Aller à… ») ;
serveur de dev fixé sur 127.0.0.1:5300 (conflit de port avec opengtb sur 5174). 334 tests unitaires
+ 3 parcours e2e.

**Reste / suite** : inchangé (test dessinateur en priorité), puis câbles (phase 9),
catalogue matériel (12), implantation / façade (13).

---

## 2026-09-28 (soir) — Première version complète (phases 1 → 11, en autonomie)

**Fait** :
- Décision d'architecture : **rendu SVG maison**, pas de JointJS/X6 (ADR-001 bis).
- Modèle métier pur et testé : connectivité géométrique (union-find), jonctions,
  numérotation des fils, repères auto + rattachement par repère, renvois croisés (NO|NC,
  renvois de fil), borniers (câblage direct), fragments (copier/coller, macros, duplication
  de folio avec renumérotation), édition (fils élastiques orthogonaux, glisser de segment).
- Éditeur : palette 61 symboles (recherche), folios, macros, inspecteur, contrôles
  (bornes en l'air, courts-circuits, renvois orphelins), propriétés du dossier (cartouche,
  indices, potentiels), borniers, zoom/pan, raccourcis, annuler/rétablir, presse-papiers
  inter-projets. Analyse figée pendant les glisser (fluide sur gros dossiers).
- Serveur : comptes (Argon2id), /setup, admin utilisateurs, projets (CRUD, démo), verrou
  d'édition (heartbeat), autosave, macros partagées, Docker.
- Export : PDF (garde + folios + borniers) avec le MÊME rendu que l'écran ; CSV.
- Tests : 332 unitaires + 2 parcours Playwright (Edge) ; perf 1 200 symboles ≈ 60 ms.

**Reste / suite** (par priorité) :
1. **Test par le dessinateur** sur le dossier DW261136 (jalon V1) → noter les frictions ici.
2. Relecture de la bibliothèque de symboles par le dessinateur (`/symboles`).
3. Menu contextuel, alignement ; alerte contacts dépassés ; règles de numérotation dans l'UI.
4. Câbles (phase 9), catalogue matériel (phase 12), implantation / façade (phase 13).

**Pièges / à savoir** :
- OneDrive verrouille parfois des fichiers (EBUSY) et a corrompu un `npm install` : en cas
  d'erreur étrange de module, `rm -rf node_modules && npm install`.
- Ports 5182–5281 réservés par Windows (Hyper-V) : e2e sur 4299.
- `structuredClone` interdit sur l'état Svelte (Proxy) → `deepClone`.
- En dev, `window.__schemelect = { editor, session }` sert aux tests e2e.
- Rien n'est encore commité (attente de validation de l'utilisateur).

---

## 2026-09-28 — Cadrage

**Fait** : choix d'un moteur orienté modèle (ADR-000) ; analyse du dossier WinRelais réel
(`docs/REFERENCE-EXEMPLE.md`) ; CDC v0.1 ; roadmap en 15 phases ; rendus PNG des 13 pages de
l'exemple dans `exemple_schema/png/`.

Décisions utilisateur : 100 % TS / SvelteKit (pas de Rust), outil autonome (ne jamais
toucher DumTools), serveur multi-postes, V1 = phases 0–11, symboles maison + inspiration
QElectroTech, imports `.xrs`/PDF = bonus. Règles métier fines (numérotation des fils…) :
l'utilisateur n'est pas dessinateur → reproduire l'exemple par défaut, faire valider par V.R.

**Reste / suite** : phase 0 (POC JointJS vs X6).

**Pièges / à savoir** : le `.xrs` est en Latin-1 (séparateur `·`, sections `¤#…¤`) ; ne pas
le réencoder (voir `.gitattributes`).
