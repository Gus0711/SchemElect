# Cahier des charges — SchemElect

> Version 0.1 (2026-09-28) — rédigé à partir de l'exemple WinRelais réel
> (`docs/REFERENCE-EXEMPLE.md`). Les points marqués **❓** sont à valider.

## 1. Objectif

Un éditeur web de schémas électriques d'armoires qui fait **gagner du temps** au dessinateur
par rapport à WinRelais, en automatisant tout ce qui est déductible, et qui produit un dossier
PDF au moins équivalent à l'existant.

Critère de succès : refaire le dossier `DW261136` (12 folios + garde) **plus vite** qu'avec
WinRelais, avec un rendu jugé équivalent par le dessinateur.

## 2. Utilisateurs

- **Dessinateur armoire** (utilisateur principal, ex. V.R) : crée et modifie les dossiers.
- **Technicien / chargé d'affaire** : consulte, exporte.

**Outil autonome** : aucune dépendance à un autre outil interne (DumTools notamment). Une
intégration éventuelle viendra plus tard, par import/export, sans toucher aux autres outils.
- Poste de travail : PC, souris + clavier, grand écran. **Pas de mobile** en édition.

## 3. Périmètre fonctionnel

### 3.1 Projet et folios
- Projet = dossier d'une affaire : n° d'affaire, n° de plan, nom, client/site, indices de
  révision (indice, modification, date).
- Folios A4 paysage, grille A–Q × 1–11, cartouche automatique (titre, n°, total, dates, auteur).
- Types de folio : **schéma**, **implantation**, **façade**, **page de garde** (générée),
  **nomenclature** et **borniers** (générés).
- Ajouter / dupliquer / réordonner / renuméroter des folios ; **dupliquer un folio avec
  renommage des repères** (ex. Chaudière 1 → Chaudière 2).

### 3.2 Symboles et appareils
- Bibliothèque de symboles normalisés (IEC 60617) **dessinés maison** : d'abord ceux de
  l'exemple, puis extension inspirée de QElectroTech.
- Palette avec recherche, glisser-déposer, rotation, miroir.
- Un **appareil** (KM1) regroupe plusieurs symboles (bobine, pôles, contacts aux.) éventuellement
  sur des folios différents.
- Propriétés : repère, valeur/calibre, désignation, référence constructeur, fournisseur.
- **Repérage automatique** par préfixe (Q, KM, KA, H, S, M, X…), renommage global.
- **Éditeur de symboles** pour créer les symboles manquants ❓ (sinon import SVG + définition des bornes).

### 3.3 Fils et potentiels
- Tracé orthogonal accroché aux **bornes** et à la grille ; jonctions explicites.
- **Barres de potentiel** (Phase 1/2/3, Neutre, 24V, PE…) avec couleur de fil, reprises
  automatiquement d'un folio à l'autre.
- Couleur du tracé = couleur du potentiel.
- **Numérotation automatique des équipotentielles** : par défaut comme l'exemple (séquentielle
  01, 02… sur tout le dossier, dans l'ordre des folios), autres règles configurables plus tard.
- **Renvois de fil inter-folios** (flèches avec `(FF-C)`), mis à jour automatiquement.
- Câbles multi-conducteurs (nom, type, couleur des conducteurs).

### 3.4 Renvois croisés
- Sous chaque contact : position de la bobine `(FF - C)`.
- Sous chaque bobine : tableau NO | NC des positions des contacts.
- **Recalcul automatique** quand on déplace un symbole ou réordonne les folios.
- Alerte si un appareil a plus de contacts dessinés que physiquement disponibles.

### 3.5 Borniers, nomenclature
- Borniers générés depuis les bornes dessinées (P, C, X…) : repère, fil, destination, câble.
- **Nomenclature** générée : repère, désignation, référence, fabricant, quantité.
- Base matériel **propre à SchemElect** : catalogue de références (saisie + import CSV).
  (Nomenclature : après la V1.)

### 3.6 Implantation et façade
- Folio implantation à l'échelle : dimensions de l'armoire, rails, goulottes ; les appareils
  du schéma sont **proposés** pour placement (encombrement issu de la référence).
- Folio façade : voyants, commutateurs, étiquettes, grille en cm.

### 3.7 Productivité (« aller vite »)
- **Macros / modèles** : blocs réutilisables paramétrables (départ moteur, voyant
  marche/défaut, chaudière + OCI…), insérés avec renumérotation.
- Copier / coller entre folios et entre projets, undo/redo illimité, raccourcis clavier.
- Contrôles : bornes non raccordées, repères en double, fils sans numéro.

### 3.8 Sorties
- **PDF** multi-folios avec page de garde, sommaire, cartouches (sortie principale).
- Export CSV/Excel : nomenclature, borniers, liste des fils.
- DXF ❓ (pour échanges avec des tiers).

### 3.9 Options « ++ » (bonus, après tout le reste)
- Import `.xrs` WinRelais (reprise de dossiers et de symboles existants).
- Import PDF (reconnaissance d'un schéma existant — très complexe, exploratoire).

## 4. Hors périmètre V1

Simulation électrique, calcul de sections / sélectivité (Caneco), édition collaborative temps
réel, mobile.

## 5. Contraintes

- Application web, **serveur interne multi-postes** (Docker), projets centralisés.
- Comptes utilisateurs simples ; **verrou d'édition** par projet (un seul éditeur à la fois).

## 5 bis. Périmètre V1 (validé 2026-09-28)

Dessin + fils + folios + PDF, renvois croisés + repères auto, numéros de fils + borniers,
macros / duplication de folio. Nomenclature, implantation/façade et imports viennent après.
- Performances : un dossier de 30 folios / 500 symboles doit rester fluide.

## 6. Questions ouvertes

1. Règles métier à valider **avec le dessinateur** (V.R) : numérotation des fils, repérage,
   conventions de bornier. Par défaut : reproduire l'exemple.
2. Qui teste en premier ? (idéalement le dessinateur, dès la phase 4)
