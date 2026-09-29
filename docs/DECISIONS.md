# Décisions techniques

Format court : contexte → décision → conséquences. Une décision remplacée est marquée
**Remplacée par ADR-xxx**, jamais supprimée.

---

## ADR-000 — Moteur orienté modèle plutôt que draw.io (2026-09-28) ✅

**Contexte** : draw.io offre un éditeur complet immédiatement (embed iframe), mais ne connaît
que des formes : repères, renvois croisés, numéros de fils, borniers, nomenclature devraient
être reconstruits par plugins dans une base mxGraph ancienne ou par analyse du XML après coup.

**Décision** : partir d'une bibliothèque de diagramme pilotée par un modèle de données
(**JointJS core** ou **AntV X6**), le modèle métier étant la source de vérité.

**Conséquences** : plus d'effort initial sur le confort d'édition ; en contrepartie, toutes
les fonctions « intelligentes » du CDC sont naturelles à implémenter.

---

## ADR-001 bis — Rendu SVG maison en Svelte (2026-09-28) ✅ — remplace ADR-001

**Contexte** : au démarrage du développement (en autonomie, session du soir), le choix
JointJS / X6 a été réexaminé à la lumière de l'architecture retenue : le **modèle métier
est la source de vérité** et toutes les fonctions « intelligentes » (renvois, numéros,
borniers) sont calculées depuis lui.

**Décision** : pas de bibliothèque de diagramme. Rendu SVG par des composants Svelte
(`src/lib/render/`), interactions dans `src/lib/editor/`.

**Raisons** :
- JointJS/X6 imposent leur propre modèle (graph/cells) qu'il aurait fallu **synchroniser**
  en permanence avec le modèle métier → duplication et source de bugs ;
- les fils d'un schéma électrique sont **dessinés** (polylignes orthogonales sur grille),
  pas routés automatiquement entre nœuds : l'atout principal de ces libs sert peu ;
- **un seul rendu** pour l'écran et le PDF (svg2pdf), style centralisé dans un thème →
  le design est simple à modifier ;
- les fonctions « confort » (undo, copier/coller, sélection) sont de toute façon plus
  simples au niveau du document JSON (instantanés, fragments) ;
- pas de dépendance à JointJS+ payant ni à X6 (maintenance incertaine).

**Conséquences** : le code d'interaction (glisser, fil élastique, magnétisme) est à nous
(~500 lignes) ; tout est testable sans DOM. Réversible : le rendu est isolé.

---

## ADR-001 — JointJS ou X6 — **Remplacée par ADR-001 bis**

| Critère | JointJS core (MPL 2.0) | AntV X6 (MIT) |
|---|---|---|
| Licence | MPL 2.0 ; confort d'édition (stencil, inspector, undo, clipboard, export PDF…) dans **JointJS+ payant** | MIT ; plugins undo/redo, clipboard, snapline, selection, stencil, export **gratuits** |
| Ports / bornes | | |
| Routage orthogonal | | |
| Undo/redo, copier/coller | | |
| Perf. 300 symboles | | |
| Qualité doc / communauté | | |
| Temps du POC | | |
| Manques constatés | | |

**Décision** : _à remplir_.

---

## ADR-002 — Stack applicative : 100 % TypeScript (2026-09-28) ✅

**SvelteKit** (Svelte 5, TS) pour le front **et** le serveur (sauvegarde, auth, export PDF),
SQLite/Drizzle, Docker. **Pas de Rust** : toute la charge est dans le navigateur (éditeur) ;
un backend Rust doublerait la stack pour un gain nul ici.

## ADR-004 — Serveur interne multi-postes (2026-09-28) ✅

App hébergée (Docker), projets centralisés, comptes simples, **verrou d'édition** par projet
(pas de collaboration temps réel en V1).

## ADR-005 — Symboles dessinés maison (2026-09-28) ✅

Bibliothèque SVG propre, style calqué sur le dossier WinRelais de référence ; formes et
inventaire complétés en s'inspirant de **QElectroTech** (licence à vérifier avant toute
reprise directe de fichiers).

---

## ADR-003 — Outil autonome, 100 % dessin (2026-09-28) ✅

SchemElect est un outil **autonome** : aucune dépendance, aucune modification d'un autre outil
interne (**ne jamais toucher à DumTools**). Base matériel propre. Intégration éventuelle plus
tard, par import/export. Imports WinRelais / PDF = options bonus.

Contexte : une note antérieure (DumTools, 2026-07-10) préconisait de rester sur WinRelais ;
SchemElect prend le parti de le remplacer.

---

## Questions ouvertes

Voir `docs/CDC.md` §6.
