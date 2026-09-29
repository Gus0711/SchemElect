# Roadmap de développement

Légende : ✅ fait · 🟡 partiel · ⬜ à faire. Phases ordonnées par dépendances. **Une phase ≈ une session de code.** Chaque phase est
livrable et testable : à la fin, l'app démarre et la fonctionnalité ajoutée est utilisable.

## Priorités (mise à jour 2026-09-29)

La V1 est codée ; l'ordre ci-dessous prime sur la numérotation des phases.

| # | Priorité | Sujet | Pourquoi |
|---|---|---|---|
| 1 | 🔴 | Premier commit git + sauvegarde automatique de la base | Rien n'est commité ; aucune sauvegarde des projets / comptes / symboles |
| 2 | 🔴 | Test par le dessinateur sur DW261136 (jalon V1) | Ses retours réordonnent tout le reste |
| 3 | 🔴 | Mise en service serveur interne (Docker, ORIGIN, HTTPS, backup `data/`) | Jamais déployé en réel |
| 4 | 🟠 | Câbles multi-conducteurs (phase 9) | Présents dans l'exemple (folio 04) |
| 5 | 🟡 | Panneau « Appareils » + recherche dans le dossier | Gain de temps quotidien |
| 6 | 🟠 | Catalogue matériel + nomenclature PDF (phase 12) | Référence → fabricant, nb de contacts |
| 7 | 🟠 | Implantation / façade (phase 13) | Folios 11-12 de l'exemple |
| 8 | 🟠 | Historique par indice de révision | Ressortir le PDF d'un indice, voir les écarts |
| 9 | 🟡 | Récupération locale (coupure réseau), cartouche personnalisable, import `.xrs` | Confort / reprise de l'existant |

**Rituel de session** :
1. Lire `CLAUDE.md`, la phase en cours ci-dessous et la dernière entrée de `docs/JOURNAL.md`.
2. Coder la phase, avec les tests du modèle métier.
3. Vérifier les critères de validation.
4. Cocher la phase, mettre à jour `docs/JOURNAL.md` (et `docs/ARCHITECTURE.md` dès qu'il existe).

Le folio de référence pour tester est **`exemple_schema/png/p02.png`** (Chaudière 1) : il
contient puissance, commande, bobine + contacts, renvois, voyants, bornier et boîte
d'équipement.

---

## Phase 0 — POC comparatif JointJS vs X6 ✅ (tranché : rendu SVG maison, ADR-001 bis)

**Objectif** : choisir le moteur de diagramme sur des faits, pas sur la doc.

### Tâches
1. Deux mini-projets jetables `poc/jointjs/` et `poc/x6/` (Vite + TS, sans framework).
2. Dans chacun, reproduire **un extrait du folio 02** :
   - cadre A4 paysage + grille A–Q / 1–11, zoom / pan ;
   - 2 barres de potentiel (Neutre, Phase 1) ;
   - disjoncteur Q1 (2 pôles), contacteur KM1 (bobine A1/A2 + 2 pôles + 1 contact 13-14),
     voyant H5 — symboles SVG avec **bornes = ports** ;
   - fils orthogonaux accrochés aux bornes, jonction sur une barre ;
   - déplacer un symbole → les fils suivent et restent orthogonaux ;
   - undo/redo, copier/coller, sélection multiple ;
   - export SVG du folio.
3. Mesurer : temps passé, lignes de code, qualité du routage, fluidité avec 300 symboles
   (dupliqués), ce qui a manqué dans la version gratuite.

### Critères de validation
- Grille de comparaison remplie dans `docs/DECISIONS.md` et **décision prise** (ADR-001).
- Dossier `poc/` supprimé ou archivé hors du code principal.

---

## Phase 1 — Bootstrap application ✅

**Objectif** : squelette SvelteKit + moteur retenu, un folio vide éditable.

### Tâches
1. SvelteKit (Svelte 5, TS strict), ESLint/Prettier, Vitest, Playwright.
2. Structure : `src/lib/model/` (métier pur), `src/lib/editor/` (adaptateur du moteur),
   `src/lib/symbols/` (bibliothèque), `src/routes/`.
3. Écran éditeur : zone de dessin, palette (vide), panneau propriétés (vide), barre d'outils.
4. Folio A4 paysage : cadre, grille A–Q / 1–11, cartouche (champs statiques), zoom/pan,
   accroche grille.
5. Docker + docker-compose.
6. Créer `docs/ARCHITECTURE.md` ; compléter la section Commandes de `CLAUDE.md`.

### Critères de validation
- `npm run dev` affiche un folio conforme visuellement au cadre de l'exemple.
- `npm run test` et `npm run check` passent.

---

## Phase 2 — Modèle de données et persistance ✅

**Objectif** : le modèle métier existe indépendamment du dessin et se sauvegarde.

### Tâches
1. Types : `Project`, `Folio`, `Device` (appareil), `SymbolInstance`, `Terminal` (borne),
   `Wire`, `Junction`, `Potential`, `Cable`, `Revision`.
2. Document projet JSON avec `schemaVersion` + fonction de migration.
3. SQLite + Drizzle : table projets (métadonnées + document), liste des projets, créer / ouvrir /
   renommer / supprimer.
4. Synchronisation modèle ⇄ éditeur via l'adaptateur (le modèle est la source de vérité).
5. Sauvegarde auto + indicateur « enregistré ».
6. **Comptes simples** (serveur multi-postes) : login / mot de passe (Argon2id), sessions en
   base, un rôle admin pour créer les comptes.
7. **Verrou d'édition** : un projet ouvert en écriture par X est en lecture seule pour les
   autres (« ouvert par X depuis 10:32 »), libéré à la fermeture ou après inactivité.

### Critères de validation
- Créer un projet, dessiner, recharger la page : tout est restauré.
- Deux navigateurs, deux comptes : le second voit le projet en lecture seule.
- Tests unitaires du modèle (sérialisation, migration).

---

## Phase 3 — Bibliothèque de symboles v1 ✅ (61 symboles)

**Objectif** : les symboles de l'exemple sont disponibles dans une palette.

### Tâches
Symboles **dessinés par nous** (SVG propres, IEC 60617) en reproduisant le style du dossier
WinRelais ; la collection QElectroTech sert de référence pour les formes et la liste
(extension en phase 14).

1. Format de définition d'un symbole : SVG + bornes (id, position, direction) + champs texte
   (repère, valeur, réf.) + préfixe de repère + catégorie + « rôle » (bobine, contact NO/NC,
   pôle, borne de bornier…).
2. Symboles v1 (cf. REFERENCE-EXEMPLE §3) : disjoncteurs 1P+N / 2P / 3P / 4P, interrupteur
   différentiel, sectionneur, porte-fusible, transformateur, bobine, pôles de contacteur,
   contacts NO / NC / inverseur, commutateurs 2 et 3 positions, bouton, pressostat, voyant,
   moteur mono/tri, prise, sonde, borne de bornier, renvoi de fil, boîte d'équipement.
3. Palette : catégories, recherche, glisser-déposer, rotation (R), miroir.

### Critères de validation
- Tous les symboles du folio 02 peuvent être posés avec leurs bornes numérotées.

---

## Phase 4 — Fils, potentiels, jonctions ✅

**Objectif** : câbler un folio comme dans l'exemple.

### Tâches
1. Outil fil : clic borne → borne / fil / barre, routage orthogonal, points de passage.
2. Jonctions (point) automatiques sur dérivation en T.
3. Barres de potentiel : définies au niveau projet (nom, couleur, style), posées sur un folio,
   reprises sur les suivants.
4. Couleur du fil = couleur du potentiel (propagation sur l'équipotentielle).
5. Calcul des **équipotentielles** (graphe de connexions) dans `model/` + tests.

### Critères de validation
- Le folio 02 est reproductible (hors renvois et numéros).
- **Premier test utilisateur avec le dessinateur.**

---

## Phase 5 — Confort d'édition ✅ (menu clic droit, alignement / répartition)

Sélection rectangle, déplacer/aligner, copier/coller (y compris entre folios), undo/redo,
suppression propre (fils orphelins), raccourcis clavier, menu contextuel, multi-folios
(onglets / liste latérale, réordonner, dupliquer).

**Validation** : saisir le folio 02 en entier au clavier/souris sans friction bloquante.

---

## Phase 6 — Appareils et repérage automatique ✅

1. Notion d'**appareil** : plusieurs symboles liés (bobine KM1 + pôles + contacts).
2. Repère auto par préfixe à la pose (KM1, KM2…), renommage global, détection doublons.
3. Panneau propriétés : repère, valeur, désignation, référence, fabricant.
4. Duplication de folio avec **renumérotation** des repères (Chaudière 1 → 2).

**Validation** : renommer KM1 → KM3 met à jour tous ses symboles ; folio 03 obtenu par
duplication du 02.

---

## Phase 7 — Renvois croisés ✅ (alerte contacts dépassés : champs « contacts dispo. » sur les masters)

1. Position `(FF - C)` de chaque symbole calculée depuis la grille.
2. Sous un contact : position de la bobine. Sous une bobine : tableau NO | NC.
3. Recalcul automatique (déplacement, réordonnancement des folios).
4. Alerte nombre de contacts dépassé (selon référence).

**Validation** : folios 02/05/07 de l'exemple reproduits avec des renvois identiques.

---

## Phase 8 — Numéros de fils et renvois inter-folios ✅ (premier numéro / nb de chiffres réglables)

1. Numérotation automatique des équipotentielles (règles configurables), verrouillage manuel.
2. Symbole renvoi de fil (flèche) avec destination calculée `(FF-C)`, appairage source/cible.
3. Affichage des numéros sur le schéma.

**Validation** : folios 04/05 reproduits avec numéros et renvois.

---

## Phase 9 — Borniers et câbles 🟡 (borniers ✅ ; câbles et étages à faire)

1. Borniers (P, C, X…) : numérotation auto des bornes, ordre, étages.
2. Câbles : regrouper des conducteurs, nom, type, couleurs.
3. Folio / tableau bornier généré (repère, fil, destination interne/externe, câble).

---

## Phase 10 — Export PDF du dossier ✅ (+ CSV borniers / appareils / fils)

Page de garde (logo, affaire, sommaire, indices), cartouches, tous les folios, tableaux de
borniers. Gestion des révisions (indice A, B, C…).

**Validation** : PDF comparé côte à côte avec `exemple_schema/*.pdf`.

---

## Phase 11 — Macros ✅ (bibliothèque de macros métier à constituer)

1. Macros : enregistrer une sélection comme bloc paramétrable, insérer avec renumérotation
   des repères et des fils.
2. Bibliothèque de macros métier (départ pompe, voyants marche/défaut, chaudière + OCI…).
3. Macro « folio complet » (ex. puissance + commande d'un circuit de pompes, folios 04-05).

**Validation** : reproduire les folios 06-07 de l'exemple à partir d'une macro des 04-05.

---

## 🚩 Jalon V1 — test par le dessinateur

Périmètre V1 (validé 2026-09-28) : dessin + fils + folios + PDF, renvois croisés + repères
auto, numéros de fils + borniers, macros / duplication de folio (phases 0 à 11).
Test : refaire le dossier `DW261136` complet ; noter les frictions dans `docs/JOURNAL.md` et
les transformer en tâches avant de continuer.

---

## Phase 12 — Nomenclature et base matériel 🟡 (CSV appareils ✅ ; catalogue à faire)

1. Catalogue de références propre à SchemElect (saisie + import CSV).
2. Nomenclature générée, export CSV/Excel, ajoutée au PDF.
3. Encombrement des références (pour la phase 13).

---

## Phase 13 — Implantation et façade ⬜

Folio à l'échelle (armoire, rails, goulottes), placement des appareils du schéma, contrôle
de remplissage des rails ; folio façade (voyants, commutateurs, cotes).

---

## Phase 14 — Bibliothèque de symboles étendue ⬜

Compléter la bibliothèque en redessinant, dans le style SchemElect, des symboles inspirés de
la collection **QElectroTech** (automates et E/S, variateurs, sectionneurs-fusibles,
parafoudres, relais temporisés, horloges, contacteurs de puissance tri, etc.). Vérifier la
licence de la collection QET avant toute reprise directe de fichiers ; attribution si reprise.

---

## Options « ++ » (bonus)

- **Import WinRelais `.xrs`** : parseur du format (cf. REFERENCE-EXEMPLE §4), import des
  folios et symboles de l'exemple, rapport de ce qui n'a pas pu être importé.
- **Import PDF** : exploratoire, très complexe (reconnaissance de symboles et de fils).

---

## Plus tard

Droits fins par projet, contrôles de cohérence avancés, export DXF, historique de versions
par projet, édition collaborative temps réel.
