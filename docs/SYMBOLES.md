# Bibliothèque de symboles

Code : `src/lib/symbols/` — types (`types.ts`), briques de dessin (`helpers.ts`), registre
(`index.ts`), définitions (`library/NN-categorie.ts`). Aperçu visuel : route **`/symboles`**.
Tests de conformité : `src/lib/symbols/library.test.ts`.

## 1. Format d'une définition (`SymbolDef`)

| Champ | Rôle |
|---|---|
| `id` | identifiant unique, **kebab-case**, stable (référencé par les projets enregistrés) |
| `name`, `category`, `keywords` | libellé, catégorie et mots-clés de recherche, **en français** |
| `prefix` | préfixe de repère de l'appareil créé (`Q`, `KM`, `S`…) ; vide seulement pour `decor` |
| `role` | `standalone` · `master` · `slave` · `terminal` · `link` · `decor` (voir §3) |
| `contactKind` | obligatoire pour un `slave` : `no`, `nc`, `co` (inverseur), `pole` |
| `graphics` | primitives `line` / `rect` / `circle` / `path` / `text` |
| `terminals` | bornes `{ id, x, y, dir, hideLabel? }` ; `id` = numéro affiché (A1, 13, 2/T1…) |
| `bridges` | groupes de bornes reliées en interne (borne de bornier) |
| `labels` | emplacements des textes : `tag`, `value`, `designation`, `reference`, `xref` |
| `bounds` | boîte englobante locale (sélection, collisions) |
| `defaults` | valeur / désignation proposées à la création de l'appareil |

## 2. Conventions géométriques

- Unités **mm**. Origine (0,0) = **première borne** (en général celle du haut).
- **Toutes les bornes sur la grille de 2,5 mm** (coordonnées multiples de 2,5).
- Symbole vertical par défaut : courant de haut en bas, bornes haut `dir: 'n'`, bas `dir: 's'`.
- Élément vertical standard : **`SPAN` = 15 mm** entre bornes haut et bas.
- Appareils multipolaires : pôles espacés de **`POLE` = 7,5 mm**, premier pôle en x = 0,
  liaison mécanique pointillée à mi-lame (`BLADE_MID`, y = 7,4).
- Numérotation : pôles `1/2, 3/4, 5/6, 7/8`, neutre `N` (haut) / `N'` (bas, ids uniques),
  contacteur `1/L1→2/T1, 3/L2→4/T2, 5/L3→6/T3`, contacts auxiliaires `13/14` (NO), `11/12` ou
  `21/22` (NC), inverseur `11/12/14`, temporisé `67/68`, bobine `A1/A2`.
- **Aucun style en dur** : uniquement `stroke` (`normal|thin|thick|dashed|none`), `fill`
  (`none|ink|paper`), `tone` (`ink|accent|muted`), résolus par `src/lib/theme/schematic.ts`.
- Chemins SVG : commandes **absolues** uniquement (`M L H V A Q C Z`) — nécessaire au calcul
  automatique de `bounds`.

## 3. Rôles

- `master` : élément principal d'un appareil qui a des contacts ailleurs (bobine,
  disjoncteur) → tableau NO | NC sous le symbole.
- `slave` : contact / pôle rattaché à un master (même repère) → renvoi `(FF - C)`.
- `standalone` : appareil à symbole unique (voyant, moteur, commutateur, sonde…).
- `terminal` : borne de bornier ; `link` : renvoi de fil ; `decor` : terre, masse (pas d'appareil).

## 4. Placement des textes

- `tag` / `value` / `designation` **à droite** du dernier pôle (x ≈ dernier pôle + 3),
  empilés (y 6 / 8,8 / 11,4) : helper `sideLabels(lastX)`.
- `xref` : slave → à droite sous le repère (ou sous le symbole) ; master → coin haut-gauche
  du tableau NO|NC, sous le symbole (x = -5, y = SPAN + 3). Ignoré (supprimé par
  `defineSymbol`) pour les autres rôles.
- `reference` (référence constructeur) : verticale à gauche (`vertical: true`), en bleu.
- Bobines : repère inscrit dans le rectangle.

## 5. Ajouter un symbole

1. Choisir le fichier de catégorie dans `src/lib/symbols/library/` (ou en créer un :
   il est chargé automatiquement par `import.meta.glob`, **ne pas modifier `index.ts`**).
   Le préfixe numérique fixe l'ordre des catégories.
2. Écrire la définition avec **`defineSymbol({...})`** : `bounds` est calculée depuis le
   graphisme et les bornes si elle est omise.
3. Réutiliser les briques de `helpers.ts` plutôt que de redessiner :
   - primitives : `line`, `rect`, `circle`, `path`, `text`, `term`, `vTerminals`, `leads` ;
   - contacts / pôles : `contactNO`, `contactNC`, `breakerPole`, `contactorPole`,
     `disconnectorPole`, `fuseDisconnectorPole`, `thermalMark`, `fuse`, `mechLink`,
     `actuatorLink`, `valve`, `leadToCircle`, `orientedRect` ;
   - appareils : `multipole(poles, draw)` (n pôles + bornes + liaison mécanique),
     `POLES_L`, `POLE_N`, `POLES_KM`, `coilSymbol`, `auxContact`, `resistorSymbol`,
     `sideLabels`.
   Les variantes (1P/2P/3P/4P…) doivent être générées par **une fonction commune**.
4. `npx vitest run` (grille, unicité, bounds, rôles) puis relire l'aperçu `/symboles`.

## 6. Liste des symboles

Graphismes conformes à la **CEI 60617** (NF EN 60617) : qualificatifs de fonction (croix =
disjoncteur, demi-cercle = contacteur, barre = sectionneur, créneau = thermique), organes de
commande (poussoir, tournant, clé, came, flotteur, boîte P/θ/%), parachute de temporisation
(ouvert à gauche = travail, vers la lame = repos), losange = détection de proximité.

**Protection** (`10-protection.ts`) : `disjoncteur-1p`, `-1p-n`, `-2p`, `-3p`, `-3p-n`, `-4p`
(Q, master) ; `disjoncteur-differentiel-1p-n`, `-3p-n`, `-4p` (Q, master) ;
`interrupteur-differentiel-2p`, `-4p` (ID) ; `interrupteur-sectionneur-2p`, `-3p`, `-4p`,
`sectionneur-3p` (QS) ; `porte-fusible-1p`, `-1p-n`, `-3p`, `-3p-n` (FU) ;
`disjoncteur-moteur-3p` (QM, master) ; `relais-thermique-3p` (F, master) +
`contact-relais-thermique-nc` (95/96), `contact-relais-thermique-no` (97/98) (F, slave) ;
`declencheur-mn`, `declencheur-mx` (Q, C1/C2) ; `contact-aux-disjoncteur-no` (13/14),
`contact-aux-disjoncteur-nc` (21/22) (Q, slave) ; `fusible` (FU) ; `parafoudre` (F).

**Contacteurs et relais** (`15-contacteurs.ts`) : `poles-contacteur-2p`, `-3p`, `-4p`
(KM, slave `pole`) ; `contact-inverseur` (KA, slave `co`) ; contacts temporisés (KT, slave)
`contact-temporise-travail` (67/68), `contact-temporise-travail-nc` (55/56),
`contact-temporise-repos` (67/68), `contact-temporise-repos-nc` (55/56) ;
`bobine-relais-temporise`, `bobine-relais-temporise-repos` (KT, master) ;
`relais-controle-phases` (KA, master, L1/L2/L3) ; `bobine-telerupteur` (KL, master).

**Commande** (`20-commande.ts`) : `bobine-contacteur` (KM), `bobine-relais` (KA),
`contact-no`, `contact-nc` (KA, slave), `voyant` (H).

**Commande manuelle et capteurs** (`25-manoeuvre.ts`) : `interrupteur` (S), `commutateur-a-m`,
`commutateur-0-1`, `commutateur-0-1-2`, `commutateur-a-cle` (S), `bouton-poussoir-no`,
`bouton-poussoir-nc` (S), `arret-urgence` (AU), `fin-de-course-no`, `fin-de-course-nc` (SQ),
`pressostat`, `pressostat-nc` (Pr), `thermostat`, `thermostat-securite` (TH),
`controleur-debit` (FS), `hygrostat` (B), `contact-niveau` (LS), `sonde` (B),
`detecteur-inductif`, `detecteur-capacitif`, `detecteur-photoelectrique` (B, 3 fils
BN/BU/BK), `transmetteur-4-20ma` (B, +/-), `horloge` (KH, master).

**Récepteurs et alimentation** (`30-recepteurs.ts`) : `moteur-mono` (L/N/PE),
`moteur-tri` (U/V/W/PE), `moteur-cc` (+/-/PE), `ventilateur` (M) ; `transformateur`
(TT, 1/2 → 3/4) ; `alimentation-24vdc` (G, L/N → +/-) ; `prise-2p-t` (XP) ;
`resistance-chauffante` (EH) ; `electrovanne`, `vanne-3-points`, `servomoteur-0-10v`
(YV, 1/2/3/5) ; `variateur-frequence-tri`, `variateur-frequence-mono`,
`demarreur-progressif` (U) ; `lampe` (E) ; `buzzer` (HA).

**Mesure et comptage** (`35-mesure.ts`) : `amperemetre`, `voltmetre`, `wattmetre`,
`frequencemetre`, `compteur-horaire` (P) ; `compteur-energie-mono`, `compteur-energie-tri`
(P, arrivée L… / départ L'…) ; `transformateur-courant` (TC, P1/P2 + S1/S2).

**Composants** (`40-composants.ts`) : `resistance`, `potentiometre`, `thermistance` (R) ;
`varistance` (RV) ; `condensateur`, `condensateur-polarise` (C) ; `diode`, `diode-zener`,
`led` (V, A/K) ; `batterie` (GB).

**Bornes et renvois** (`80-bornes-renvois.ts`) : `borne-x`, `borne-p`, `borne-c`,
`borne-pe`, `borne-sectionnable`, `borne-fusible`, `renvoi-sortie`, `renvoi-entree`.

**Divers** (`90-divers.ts`) : `terre`, `masse`, `terre-protection` (decor) ; `borne-appareil`
(XE, borne d'équipement externe type QX1/L) ; `entree-tor`, `sortie-tor`,
`entree-analogique`, `sortie-analogique` (A, voie d'automate).

**À faire valider par V.R** : préfixes proposés pour les nouveaux appareils (SQ, FS, KH, U,
P, TC, V, GB…) ; `sectionneur-3p` et `interrupteur-sectionneur-*` ont le même graphisme
(barre de sectionnement) comme dans l'existant.
