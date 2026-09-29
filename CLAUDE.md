# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

**SchemElect** — éditeur **web** de **schémas électriques** d'armoires (contexte : armoires
GTB / chaufferie de la S.A.R.L Dumortier). Objectif : permettre au dessinateur de produire
**plus vite** qu'avec WinRelais (outil actuel) un dossier de schémas complet : folios,
renvois croisés, numéros de fils, borniers, nomenclature, implantation, façade, export PDF.

Principe directeur : **le schéma est un modèle de données**, le dessin n'en est que
l'affichage. Un symbole appartient à un **appareil** (KM1) qui a un type, des bornes, une
référence constructeur ; tout ce qui peut être déduit (repères, renvois, numéros de fils,
borniers, nomenclature) est **calculé**, jamais ressaisi.

Interface **en français**. Utilisateurs : dessinateur(s) armoire, techniciens.

**Outil autonome** : ne dépend d'aucun autre outil interne et **ne modifie jamais un autre
dépôt** (en particulier DumTools — interdit d'y toucher).

**État actuel (2026-09-29)** : V1 fonctionnelle (phases 1 à 11) + menu clic droit,
alignement, alerte de contacts, navigation par renvois (double-clic), voyants colorés,
**symboles maison** (image de documentation retouchable — rogner / gommer / fond
transparent — ou cadre titré, bornes posées au clic, bibliothèque partagée) et
redimensionnement des symboles maison sur le folio. Détail : `docs/JOURNAL.md`.

## Priorités (à traiter dans cet ordre — voir `docs/ROADMAP.md` § Priorités)

1. 🔴 **Sécuriser** : premier commit git (rien n'est commité ! demander l'accord de
   l'utilisateur avant de committer) + sauvegarde automatique de la base SQLite (`data/`).
2. 🔴 **Test par le dessinateur (V.R)** sur le dossier DW261136 → ses retours priment sur
   tout le reste de la liste.
3. 🔴 **Mise en service** sur le serveur interne (Docker : `ORIGIN`, HTTPS éventuel,
   sauvegarde du volume `data/`).
4. 🟠 **Câbles** multi-conducteurs (nom, type, paires + couleurs ; ex. folio 04 « CABLE SYT1
   3 PAIRES »).
5. 🟡 **Panneau « Appareils »** (liste de tous les repères, recherche, appareils sans
   référence) + **recherche** dans le dossier (« KM3 », « P12 »).
6. 🟠 Selon les retours : catalogue matériel + nomenclature par référence dans le PDF ;
   folios implantation / façade ; historique par indice de révision.
7. 🟡 Plus tard : récupération locale en cas de coupure réseau, cartouche / page de garde
   personnalisables, import `.xrs` WinRelais.

## Documents de référence

- **`docs/CDC.md`** — cahier des charges fonctionnel. Fait foi pour le périmètre.
- **`docs/ROADMAP.md`** — phases de développement, **une phase ≈ une session de code**.
  Chaque phase a ses tâches et ses critères de validation. **Lire la phase en cours avant de coder.**
- **`docs/REFERENCE-EXEMPLE.md`** — analyse du dossier WinRelais réel fourni
  (`exemple_schema/`) : conventions graphiques et métier à reproduire. Fait foi pour le rendu.
- **`docs/DECISIONS.md`** — décisions techniques (ADR courts) et questions ouvertes.
- **`docs/JOURNAL.md`** — journal des sessions : ce qui a été fait, ce qui reste, pièges.
  **À mettre à jour en fin de chaque session.**
- **`docs/ARCHITECTURE.md`** — description de **ce qui est implémenté** (modèle, règles,
  éditeur, serveur, export, design). **À lire en premier**, à tenir à jour.
- `docs/SYMBOLES.md` — format et conventions des symboles, comment en ajouter.
- `exemple_schema/` — dossier réel : `.pdf` (13 folios), `.xrs` (source WinRelais, texte
  Latin-1), `png/pNN.png` (rendu de chaque page, lisible directement avec l'outil Read).

## Stack

- **100 % TypeScript, pas de Rust.** **SvelteKit** (Svelte 5 runes, TS strict), adapter node.
  Serveur interne multi-postes (Docker), comptes simples, verrou d'édition par projet.
- **Pas de bibliothèque de diagramme** (ADR-001 bis) : rendu SVG par composants Svelte
  (`src/lib/render/`), le même pour l'écran et le PDF (jsPDF + svg2pdf.js).
- `src/lib/model/` : modèle métier **pur** (aucune dépendance DOM/Svelte), source de vérité ;
  tout ce qui se déduit est calculé par `analyzeProject`.
- `src/lib/editor/` : état (`Editor`, runes), interactions, session (verrou + autosave), panneaux.
- `src/lib/symbols/` : bibliothèque déclarative, un fichier par catégorie (chargement auto).
- `src/lib/server/` : SQLite (libSQL) + Drizzle, auth Argon2id, verrous. API dans `src/routes/api/`.
- Tests : Vitest (modèle, symboles, serveur, export) + Playwright (`tests/e2e`, Edge).

## Design (modifiable sans toucher au reste)

- Interface : `src/lib/styles/tokens.css` (variables) + kit `src/lib/ui/`. Aucun style en dur
  ailleurs que via ces variables.
- Schémas (écran + PDF) : `src/lib/theme/schematic.ts` uniquement.

## Conventions

- Code et identifiants en anglais ou français cohérent par module ; **textes UI en français**.
- Vocabulaire métier (à utiliser tel quel dans le code et l'UI) : **projet** (dossier),
  **folio**, **appareil** (device, ex. KM1), **symbole** (représentation graphique d'une
  partie d'appareil), **borne** (terminal/port, ex. A1, 13), **fil** / **équipotentielle**
  (net), **potentiel** (barre : Phase 1, Neutre, 24V…), **renvoi** (référence croisée
  folio-colonne, ex. `(02 - L)`), **bornier** (-X, P, C), **câble**, **cartouche**.
- Coordonnées de référence d'un folio : colonnes **A–Q**, lignes **1–11** (format **A4 paysage** 297×210
  de l'exemple). Un renvoi s'écrit `(FF - C)` : numéro de folio sur 2 chiffres + colonne.
- Toute règle de calcul métier va dans `src/lib/model/` avec ses tests.
- Ne pas committer sans demande explicite de l'utilisateur.

## Commandes

- `npm run dev` — serveur de dev sur **http://127.0.0.1:5300** (port fixe ; premier lancement → /setup)
- `npm test` — tests unitaires · `npm run test:e2e` — bout en bout (Playwright + Edge)
- `npm run check` — types · `npm run lint` / `npm run format` — Prettier + ESLint
- `npm run build` — build de production

Avant de terminer une session : `npm run check && npm run lint && npm test && npm run test:e2e`.

Pièges : OneDrive peut verrouiller des fichiers (EBUSY) → réessayer ; les ports 5182–5281 sont
réservés par Windows (le e2e utilise 4299). Ne pas utiliser `structuredClone` sur l'état
Svelte (Proxy) → `deepClone` de `$lib/model/ids`.
