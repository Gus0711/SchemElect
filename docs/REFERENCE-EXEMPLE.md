# Référence — dossier WinRelais réel

Source : `exemple_schema/DW261136 ESSIQUE 86 LGTS ST QUENTIN.pdf` / `.xrs`
(dessiné le 27/09/2026 par V.R, WinRelais 2.1 Premium). Rendus page par page :
`exemple_schema/png/p01.png` … `p13.png`.

C'est **le niveau de rendu et de fonctionnalité à atteindre**. SchemElect doit produire un
dossier équivalent, plus vite.

## 1. Structure du dossier

| Page | Folio | Contenu |
|---|---|---|
| p01 | 01 | Distribution : arrivée DTU, IG 40A, interrupteur différentiel, barres de potentiel, transfo 230/24V, voyants défaut/sous tension |
| p02 | 02 | Chaudière 1 : Q1, KM1, boîte équipement « CHAUDIÈRE 1 + OCI345 », sondes, commande S1/KM1, voyants |
| p03 | 03 | Chaudière 2 (même structure que 02 → **candidat macro / copie de folio**) |
| p04 | 04 | Puissance pompes circuit constant ECS : 2 pompes Wilo, câble SYT1, renvois de fils |
| p05 | 05 | Commande pompes circuit constant ECS |
| p06–p07 | 06–07 | Puissance / commande pompes circuit régulé radiateurs (même motif que 04–05) |
| p08 | 08 | Pompes bouclage ECS |
| p09 | 09 | PAC Navistem T3100 |
| p10 | 10 | Départs directs (prise, préparateur ECS, désembouteur) |
| p11 | 11 | **Implantation** armoire 1000H×600L×250P : goulottes, rails oméga, appareils, borniers |
| p12 | 12 | **Façade** : voyants, commutateurs, grille en cm |
| p13 | — | **Page de garde** : logo, société, affaire, sommaire des folios, tableau des indices, n° d'affaire, n° de plan, nb de folios |

## 2. Mise en page d'un folio

- Format **A4 paysage** (297×210 mm), cadre avec **grille de repérage** : colonnes **A–Q** en haut, lignes
  **1–11** à gauche (implantation/façade : A–Y × 1–17).
- **Cartouche** en bas : société + adresse | n° plan + nom d'affaire / titre du folio |
  Dessiné le / Modifié le / Par | n° folio / nb total.

## 3. Conventions graphiques et métier observées

- **Barres de potentiel** horizontales traversant le folio, reprises d'un folio à l'autre,
  avec nom à gauche et **couleur de fil** à droite :
  Phase 1 = Marron, Phase 2 = Noir, Phase 3 = Rouge, Neutre = Bleu, 24V/Commande = Violet,
  24V après PME = Marron, retour commun = Blanc (pointillé bleu).
- Le **tracé est coloré selon le potentiel** (bleu neutre, marron phase 1, violet 24V…).
- **Points de jonction** (gros point bleu) sur les dérivations.
- **Bornes de symbole** : petits carrés rouges avec numéro (1, 2, A1, A2, 13, 14, 1/L1, 2/T1…).
- **Repères d'appareil** : Q1, KM1, S1, H1, FT, TT, QT, IG, DEF1, MA1, ME, M1… affichés à côté
  du symbole avec la **valeur** (10A, Courbe C, 230/24V 100VA…).
- **Référence constructeur** affichable sur le symbole (ex. `LC1K0910B7` en bleu, vertical).
- **Renvois croisés** : sous un contact, `(02 - L)` = position de la bobine (folio 02,
  colonne L). Sous une bobine, **tableau NO | NC** listant les positions de tous ses contacts.
- **Numéros de fils** (équipotentielles) en bleu : `01`, `02`… numérotés sur tout le dossier.
- **Renvois de fils inter-folios** : flèches rouges avec destination `(04-G)`.
- **Borniers** : bornes `P1…Pn` (puissance), `C1…Cn` (commande), symbole rond.
- **Câbles** : ellipse regroupant des conducteurs, nom (« CABLE SYT1 3 PAIRES ») et couleur
  de chaque paire.
- **Boîtes d'équipement** externes (chaudière, pompe) en pointillé/cadre avec leurs bornes
  nommées (QX1/L, B3/G, SSM, SBM, DP…).
- Symboles vus : disjoncteur (uni/bi/tri + neutre), interrupteur différentiel, interrupteur
  sectionneur, porte-fusible, transformateur, contacteur (bobine + pôles + contacts aux.),
  relais, contacts NO/NC, commutateurs 2 et 3 positions (A/M, 0/1/2), pressostat, voyants
  (couleurs), moteur mono, prise de courant, sonde, bus.

## 4. Format `.xrs` (WinRelais) — notes d'exploration

- Fichier **texte Latin-1**, fins de ligne CRLF, ~10 000 lignes pour 13 folios.
- Sections `¤#Nom¤` terminées par `¤#FIN¤` ; champs séparés par `·` (U+00B7).
- Sections vues : `Schema`, `NombreFolio`, `Folio`, `VueFolio`, `CartoucheTexte`, `Symbole`
  (170), `Broche` (bornes), `Contour`, `Arc`, `RefCroise`, `RefConstructeur`, `RefBaseData`,
  `VueArmoire`, `Contacts`, `Jonction`, `FilBus`, `RenvoiF`, `TableauCase`, `InfoRevision`.
- Dimensions en 1/100 mm (`29700·21000` = 297×210, cohérent avec le PDF A4 paysage).
- ➜ Un **import `.xrs`** est envisageable (reprise de l'existant / de la bibliothèque de
  symboles) mais demande de la rétro-ingénierie : phase tardive, voir ROADMAP.
