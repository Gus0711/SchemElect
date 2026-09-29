# Journal des sessions

Une entrée par session, la plus récente en haut. Gabarit :

```
## AAAA-MM-JJ — Phase N : titre
**Fait** : …
**Reste / suite** : …
**Pièges / à savoir** : …
```

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
