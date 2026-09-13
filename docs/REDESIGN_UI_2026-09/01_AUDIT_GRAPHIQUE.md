# 01 — Audit graphique de l'existant

Mesuré, pas ressenti. Toutes les valeurs de cette page viennent de la feuille de
style réelle, extraite de `project/editor/index.html` et comptée.

```sh
awk '/<style>/,/<\/style>/' project/editor/index.html > styles.css
```

---

## A. Les chiffres

| Mesure | Valeur | Ce que cela veut dire |
| --- | --- | --- |
| Feuille de style | **109 302 octets**, 0 fichier `.css` | tout est en ligne dans `index.html` (653 lignes, dont ~1 de CSS) |
| Sélecteurs | **1 245** | pour ~40 écrans et panneaux |
| Couleurs hexadécimales distinctes | **247** | pour un thème unique, sombre |
| Occurrences de couleurs en dur | **620** | dont 15 seulement passent par une variable |
| Variables CSS déclarées | **11** (`--ux-*`) | utilisées 111 fois ; 509 valeurs restent littérales |
| `rgba()` / `color-mix()` | **0** | aucune couleur dérivée : chaque état est un nouveau hex |
| Rayons de bordure distincts | **17** | `1 2 3 5 6 7 8 9 10 12 14 50% 99 999` px |
| Tailles de police distinctes | **20** | de 9 px à 54 px |
| Valeurs de `gap` distinctes | **20** | dont `2 3 4 5 6 7 8 10 12 14 20` px |
| Valeurs de `padding` distinctes | **74** | |
| Règles `:hover` | **24** | sur 1 245 sélecteurs |
| Règles `:focus-visible` | **15** | dont une seule générique |
| Règles d'état sélectionné (`aria-pressed=true`) | **9** | pour ~30 familles de contrôles sélectionnables |
| Points de rupture | **13 déclarations** pour **9 largeurs** | `600 640 700 899 900 1000 1100 1279 1439` |
| Tailles de miniature | **4** | 38, 44, 48, 64 px |
| Surfaces flottantes | **11**, sans composant partagé | 5 `*-popover`, 6 `<dialog>`, chacun avec son propre balisage |

Deux de ces lignes suffisent à résumer l'état : **247 couleurs pour 11
variables**, et **20 tailles de police dont 119 déclarations sur ~180 valent 11
ou 12 px**.

---

## B. Typographie

```text
font-size:11px   63 déclarations
font-size:12px   56
font-size:13px   14
font-size:10px   11
font-size:11.5px 10
font-size:9px     3
─────────────────────
≤ 13 px          157 déclarations sur 180
```

La police de base est `Inter, system-ui, sans-serif` à la taille par défaut du
navigateur, mais **aucun texte de l'interface ne l'utilise** : tout est
redescendu à 11 ou 12 px. Il n'existe pas d'échelle — `10.5px`, `11.5px` et
`12.5px` existent, ce qui est le signe d'un ajustement au cas par cas et non
d'un système.

**Conséquence graphique.** Il n'y a plus de contraste de taille disponible pour
hiérarchiser. Un titre de section (`.part-styles-title`, 10.5 px) est *plus
petit* que le corps de texte qu'il introduit (`.part-style-name`, 11.5 px), et
se distingue seulement par `text-transform:uppercase` et `letter-spacing`. Quand
tout est petit, le gras et la majuscule deviennent les seuls outils de
hiérarchie, et ils saturent vite.

**Densité.** 11 px avec `line-height` implicite dans une colonne de 300 px
produit ~34 caractères par ligne. Les libellés de l'éditeur sont des phrases
(« Position, size and turn are the whole part's (Left eye): a library part moves
as one. ») : elles passent sur 3 à 4 lignes de 11 px, ce qui est la définition de
la densité excessive.

---

## C. Couleurs

### Ce qui est déclaré

```css
:root{--ux-text:#e5e7eb;--ux-muted:#b8c6dc;--ux-surface:#121c30;--ux-raised:#101a2d;
      --ux-border:#2b3a55;--ux-border-strong:#33425d;--ux-border-soft:#3b4c68;
      --ux-focus:#79adff;--ux-warn:#f3c76b;--ux-warn-text:#fde68a;--ux-success:#bce8cd}
```

Onze jetons, honnêtes et bien nommés. **Et il en manque les plus importants** :
il n'y a pas de `--ux-accent` déclaré (il est pourtant appelé une fois,
`var(--ux-accent)` — donc il tombe sur sa valeur de repli), pas de `--ux-danger`,
pas de couleur de fond de page, pas de couleur d'élévation de carte.

### Ce qui est réellement écrit

Les bleus d'accent, comptés :

```text
#79adff  33×   focus, mais aussi accent, mais aussi bordure de carte recommandée
#285fce  16×   fond d'état sélectionné
#5c8df2  13×   bordure d'état sélectionné
#245ed4   -    fond de bouton primaire
#3974eb   -    bordure de bouton primaire
#8bb6ff   5×   marque BOOP, favicon
#cfe0ff  11×   texte sur accent
#60a5fa   5×   ?
#6d9cff   4×   bordure de carte pressée
#7db3ff   4×   ?
#9cc3ff   3×   « Recommended »
#5b8de6 #7fa6e0 #6ee7a8 …
```

**Onze bleus pour une seule fonction.** Le bouton primaire est `#245ed4`, l'état
sélectionné est `#285fce`, le focus est `#79adff`, la marque est `#8bb6ff` : ce
sont quatre bleus non liés entre eux, qui ne se lisent pas comme une famille et
ne peuvent pas être déplacés ensemble.

### Le cas des surfaces

```text
#080d18  fond de page          (:root)
#11182a  topbar
#10172a  panneaux gauche et droite
#0f1728  dock bas
#101a2d  --ux-raised, carte de récupération
#121c30  --ux-surface
#111d32  .home-card
#172b4b  .home-card.recommended
#16223a  .part-style
#1d2c48  .part-style:hover
#1b2f55  .part-style[aria-pressed=true]
#1d293e  .secondary
```

**Douze niveaux de gris-bleu entre `#080d18` et `#1d293e`**, soit une
amplitude de luminance de ~6 %. Aucun ne se distingue nettement d'un autre à
l'écran ; ils ne construisent donc aucune profondeur lisible, mais ils coûtent
douze décisions à chaque nouveau composant.

### Bordures

`#29344d`, `#2b3a55`, `#2b3550`, `#2a3550`, `#2c3b58`, `#2d3d59`, `#263148`,
`#34445f`, `#344968`, `#33425d`, `#3b4c68`, `#40506b` — **douze bordures**, dont
trois seulement sont des jetons. Les neuf autres sont des variantes à 1–2 %
d'écart, invisibles et non maintenables.

---

## D. Rayons et formes

```text
8px   34×     6px  16×     7px   8×     3px  4×
10px  17×     9px  12×     5px   7×     2px  3×
12px  12×     50%  12×     99px  6×     14px 2×
```

Quatre rayons (6, 7, 8, 9) occupent la même intention visuelle — « un coin
légèrement arrondi » — et coexistent à 1 px près. Un bouton (`7px`) posé dans une
carte (`12px`) à côté d'une puce (`99px`) et d'une vignette (`8px`) donne quatre
géométries dans 200 px de large.

**Incohérence la plus visible** : `.home-card` n'a pas de `border-radius` propre
— elle hérite du `7px` de `button`. Une carte de 150 px de haut avec le rayon
d'un bouton de 30 px se lit comme un très gros bouton, ce qui est exactement
l'ambiguïté que §24 demande de supprimer.

---

## E. Boutons — le problème central

Il n'existe **qu'une seule définition** :

```css
button,.button{background:#245ed4;color:#fff;border:1px solid #3974eb;
               border-radius:7px;padding:7px 10px;font-size:12px}
.secondary,.icon{background:#1d293e;border-color:#34445f}
.danger{color:#fca5a5}
```

Donc :

| Niveau demandé (§24) | Existe ? | Ce qui se passe |
| --- | --- | --- |
| **Primary** | ✅ par défaut | **tout** `<button>` sans classe est primaire bleu plein |
| **Secondary** | ✅ `.secondary` | |
| **Tertiary / ghost** | ❌ | `button.link` existe mais n'est stylé qu'en `:hover` |
| **Danger** | ⚠ `.danger` | change **la couleur du texte seulement** — sur fond bleu plein `#245ed4`, « Delete » est du rose sur du bleu |
| **Icon-only** | ⚠ `.icon` | même boîte que le texte ; pas de carré, pas de taille garantie |
| Tailles | ❌ | une seule (`7px 10px / 12px`) |

**C'est l'inversion la plus coûteuse de la feuille de style.** Comme le style
primaire est le style *par défaut*, un écran qui contient 14 boutons contient 14
boutons primaires. La topbar en est l'illustration :

```text
[☰] [BOOP Mascot Studio] [Design][Rig][Animate][Behavior] … [📱][🔍][↶][↷]
[Project check] [⟲] [Save Project] [Export] [•••]   ✓ Saved
```

**10 boutons visibles en permanence, tous du même bleu**, plus 4 onglets, plus la
pastille d'état, plus un menu ••• qui en contient 10 autres. Aucun n'est
visuellement prioritaire, et il n'y a *aucune action principale* dans cette barre
— ce sont toutes des actions de projet.

La conséquence directe sur la demande §24 : `Créer la mascotte` ne peut pas
« ressortir beaucoup plus » que `Options avancées`, parce qu'ils partagent le
même style par défaut.

**La preuve que l'inversion trompe les auteurs du projet eux-mêmes** : la classe
`.primary` est utilisée à trois endroits — `shell/overlays.js:14`,
`ui/colour-picker.js:149`, `animation-editor/state-machine/state-machine-panel.js:16`
— et **n'est définie nulle part** dans la feuille de style. Trois fois, quelqu'un
a écrit `class="primary"` pour marquer l'action principale d'une boîte de
dialogue ; trois fois cela n'a rien changé, et personne ne l'a vu, parce que le
bouton était déjà bleu plein.

---

## F. États

### Survol

**24 règles `:hover` pour 1 245 sélecteurs.** La seule générique est
`button:hover, .button:hover`. Toutes les cartes de bibliothèque en ont une
(`.part-style:hover`, `.face-preset:hover`) — mais :

- `.face-type` (les cartes de **type de mascotte**, la décision la plus
  importante du parcours) **n'a pas de `:hover`** ;
- `.face-style`, `.home-card`, `.feature-card` non plus ;
- `.palette-row:hover` existe, `.part-swatch:hover` non.

Une carte qui ne réagit pas au survol ne se lit pas comme cliquable.

### Sélection

Neuf règles `aria-pressed=true`, et deux conventions différentes :

```css
.part-style[aria-pressed=true]{border-color:#6d9cff;background:#1b2f55}   /* discret */
.face-type-current{background:#285fce;border-color:#5c8df2}               /* plein */
```

`.face-type-current` est appliqué par une **classe**, pas par l'attribut, donc
elle échappe à la règle générique. Deux composants voisins dans la même colonne
utilisent deux mécanismes et deux intensités pour dire la même chose.

Il n'y a **aucune coche, aucun anneau, aucun badge géométrique** : la sélection
est portée uniquement par une différence de fond de ~4 % de luminance. Sur un
écran mal calibré ou en plein jour, elle est invisible.

### Focus clavier

`:focus-visible` générique existe (bon point), plus 14 règles spécifiques —
toutes pour des poignées de canvas. Les cartes, les puces et les vignettes n'ont
donc que l'anneau générique, ce qui est acceptable, mais il utilise `--ux-focus`
`#79adff`, **la même couleur que l'accent et que la bordure « recommandé »** :
un élément recommandé et un élément focalisé se ressemblent.

### Désactivé

```css
.face-type[disabled]{opacity:.55}
.part-style:disabled{opacity:.45}
.face-style[disabled]   → pas de règle propre
```

Trois opacités différentes, dont une absente. Le type *Monster*, désactivé parce
qu'aucune corne n'est dessinée, est à `.55` ; une pièce indisponible juste à côté
est à `.45`.

---

## G. Écran par écran

### G.1 — La page d'accueil

```text
┌──────────────────────────────────────────────────────────────┐
│ ☰ BOOP Mascot Studio  Design Rig Animate Behavior            │  ← la topbar
│                           📱 🔍 ↶ ↷ Project check ⟲ Save Export ••• │     reste visible
├──────────────────────────────────────────────────────────────┤     (z-index 90
│ BOOP MASCOT STUDIO                                           │      contre 80)
│ Create or continue a mascot                                  │
│ New Mascot                                                   │
│ ┌───────────────────────┐ ┌───────────────────────┐          │
│ │ New Character  Recom. │ │ Mascot Face           │          │
│ │ A preset, then any…   │ │ The mascot as it comes│          │
│ │ Head, eyes, hair,…    │ │ Head turn in 2.5D,…   │          │
│ └───────────────────────┘ └───────────────────────┘          │
│ Coming back to a saved project, or bringing your own…        │
│ Open Project and Import SVG are in the ••• menu, top right.  │
│ Continue                                                     │
│ ┌──────────────────────────────────────────────┐             │
│ │ No local draft is available.                 │             │
│ └──────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

Références : `ui/home-surface.js`, CSS `.home-surface`.

| Constat | Mesure |
| --- | --- |
| Aucune image | les deux cartes sont du texte : `<b>` + deux `<small>` |
| 5 lignes de texte par carte | 18 px, 10 px, 12 px, 12 px |
| « Ouvrir un projet » n'est **pas un bouton** | c'est une phrase de 12 px gris `#9fb2cc` qui dit où chercher |
| Le titre dit `Create or continue a mascot` | pas ce que fait le logiciel |
| Pas de projets récents | seulement un brouillon local, absent au premier lancement |
| La topbar complète est au-dessus | 10 boutons, dont `Export` et `Project check`, avant qu'un projet existe |
| Deux gradients radiaux différents | `.home-surface` et `#canvas` — deux fonds bleu nuit non identiques |

**Espaces mal utilisés.** `.home-panel{max-width:980px}` centré dans un écran de
1920 px : 48 % de la largeur est du fond vide, et les deux cartes utilisent 2
colonnes sur les 4 que la place permettrait. Le vide n'est pas au service de la
hiérarchie — il est le résidu d'une grille à deux colonnes fixée en dur.

### G.2 — L'écran de création (Design ▸ Face)

```text
┌────────────┬──────────────────────────┬──────────────┐
│ 300 px     │  minmax(320px, 1fr)      │  340 px      │
│ Face       │                          │  Inspector   │
│ ★ Presets  │        canvas            │              │
│ ◇ Type     │                          │              │
│ ◑ Style    │                          │              │
│ ◐ Colours  │                          │              │
│ ◯ Head     │                          │              │
│ ◉ Eyes     │                          │              │
│ • Pupils   │                          │              │
│ ◠ Eyelids  │                          │              │
│ ⌒ Brows    │                          │              │
│ ▽ Nose     │                          │              │
│ ◡ Mouth    │                          │              │
│ ◖ Ears     │                          │              │
│ ∿ Hair     │                          │              │
│ ≋ Facial…  │                          │              │
│ ◈ Access.  │                          │              │
│ ✋ Hands    │                          │              │
│ ADVANCED   │                          │              │
└────────────┴──────────────────────────┴──────────────┘
             190 px de dock bas (preview)
```

**Seize lignes dans une colonne**, dont les quatre premières ne sont pas des
parties du visage : `Presets`, `Type`, `Style`, `Colours` sont des *méta-choix*
présentés comme des pairs de `Eyes`. C'est le problème structurel que §3 de la
demande vise directement : **la décision qui conditionne tout est une ligne comme
les autres**.

Deux lignes (`Pupils`, `Eyelids`) n'ont **aucun dessin dans la bibliothèque**
(0 asset sur les 5 morphologies) : elles sont toujours vides.

**Le canvas a 52 % de la largeur à 1280 px** (300 + 340 fixes) et 33 % de la
hauteur utile quand le dock de 190 px est ouvert. La demande §11 réclame 70–75 %
pour l'aperçu ; on en est à la moitié.

**Les icônes** sont des caractères Unicode géométriques : `★ ◇ ◑ ◐ ◯ ◉ • ◠ ⌒ ▽ ◡
◖ ∿ ≋ ◈ ✋ ▽ ⋙ ◣ ⋏ ♜ ⑂ ▤`. Ils partagent une grille, une graisse et une taille
imposées par la police système, donc leur poids optique varie énormément (`•`
contre `▤`), et trois d'entre eux (`▽` nez et `▽` museau ; `◠` paupières et `⌒`
sourcils) sont visuellement interchangeables. Ce ne sont pas des icônes : ce sont
des puces.

### G.3 — Cartes de bibliothèque

```css
.part-style{width:72px;padding:5px 4px 6px}
.part-style-thumb{width:48px;height:48px;background:#fff;border-radius:8px}
.part-style-name{font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
```

Vignette de **48 px sur une carte de 72 px**, nom tronqué à ~10 caractères. Les
dessins de la bibliothèque sont des visages complets ou des pièces fines
(moustaches, antennes) rendues dans une boîte de 48 px sur fond blanc pur
`#fff` — le seul blanc pur de toute l'interface, ce qui produit une grille de
timbres très contrastés dans une colonne par ailleurs sombre.

`.face-preset-thumb` fait 64 px, `.hand-thumb` 38 px, `.hand-style .hand-thumb`
44 px. Quatre tailles pour la même intention.

### G.4 — L'inspector

Sept blocs, dans cet ordre : sujet, puces de pièces, position, taille et
rotation, couleurs, **Shape (`✎ Edit Shape` + `Remove`)**, quatre boutons de
réinitialisation, formulaire « Save to the library », `▸ Advanced`.

- Les actions sont **en sixième position**, sous les champs numériques ;
- Il n'y a pas de rangée d'actions au sens de §22 : `Remplacer` n'existe pas,
  `Dupliquer` non plus ;
- Chaque section porte un paragraphe de prose de 11 px : mesuré,
  **7 paragraphes explicatifs** pour 6 champs.

(L'audit précédent traite ce point en §6.2 / `P1-5`.)

### G.5 — Modales et surfaces flottantes

Onze surfaces flottantes, en deux familles et sans aucun composant partagé :

```text
divs positionnées (5)          <dialog> ouverts en showModal() (6)
  .menu-popover      •••         #command-palette
  .export-popover    Export      #shortcut-help
  .problems-popover  Project     #colour-picker
  .capability-popover 📱         #unsaved-dialog
  .advanced-popover  Advanced    #timeline-confirm
  (+ .sheet-* mobile)            (+ celui de state-machine-panel, créé à la volée)
```

Les six `<dialog>` héritent gratuitement de `::backdrop`, du piégeage du focus
et d'`Échap` — c'est le bon choix, et il n'est fait nulle part deux fois de la
même façon : chacun porte son propre balisage, son propre rayon (`10px`, `12px`),
son propre fond, et aucun n'a de structure en-tête / corps / pied. `.dialog-actions`
est la seule chose qu'ils partagent, et seulement trois d'entre eux l'utilisent.

**Aucun n'est une modale de contenu** : le plus grand est la palette de
commandes. Pour §15, cela veut dire que le modal « Modifier le dessin » n'a pas
de composant parent à réutiliser — il faut créer le composant, et les six
existants sont ses premiers clients.

### G.6 — Le canvas

```css
#canvas{background:radial-gradient(circle at top,#263959,#0e1627)}
```

Un dégradé radial bleu, sans damier, sans fond clair, sans fond transparent : une
mascotte aux contours sombres est difficile à juger dessus, et la demande §26
(« aider à produire de belles mascottes ») commence par pouvoir la voir.

Le canvas porte en revanche une chose excellente et peu visible :

```css
[data-editor-scope=out]{opacity:.22;pointer-events:none}
[data-editor-scope=in][opacity='0']{opacity:1}
```

C'est **le mode « Contexte » de §19, déjà implémenté** (`svg-canvas.js:1631`),
utilisé aujourd'hui par `Edit Shape` et par l'édition des dessins de main.

---

## H. Ce qui est déjà bien, et qu'il ne faut pas casser

1. **Le moteur de compatibilité** (`core/face-library/compatibility.js`) : pur,
   testé, dérivé des métadonnées, appelé par le builder.
2. **Les métadonnées de pièces** (`face-part-model.js`, `face-morphologies.js`) :
   catégorie, slot, morphologies, styles, tags, points de montage, symétrie par
   paire, jetons de palette. Elles couvrent déjà 9 des 10 champs demandés en §7.
3. **`data-editor-scope`** : l'édition isolée avec contexte estompé existe.
4. **Le noyau d'édition de chemins** : `path-nodes`, `path-controls`,
   `path-edit` — avec un remappage linéaire qui transporte les shape keys à
   travers un changement de topologie. C'est la partie difficile de §17 et §18, et
   elle est faite.
5. **`createHistory`** : transactions ouvertes/fermées, snapshot complet du
   document. Un « Appliquer » est déjà garanti d'être une étape d'undo unique.
6. **Le menu contextuel** (`ui/canvas-menu.js`) : 14 actions, bien écrit,
   simplement interdit dans Face.
7. **Le vocabulaire des jetons `--ux-*`** : le bon départ, jamais terminé.

---

## I. Synthèse des défauts, dans l'ordre de la demande

| Défaut demandé | Constat mesuré | Gravité |
| --- | --- | --- |
| Incohérences graphiques | 247 couleurs / 11 jetons ; 17 rayons ; 20 tailles de police ; 4 tailles de miniature ; 7 surfaces flottantes | **majeure** |
| Éléments trop techniques | `Type: muzzle / beak`, `Semantic binding`, `ID: eyeLeft`, `Projection strength`, `Yaw`/`Pitch` | majeure |
| Densité excessive | 157 déclarations de police ≤ 13 px ; 16 lignes de colonne ; 7 paragraphes dans l'inspector | **majeure** |
| Hiérarchie visuelle insuffisante | 12 surfaces à 6 % de luminance d'écart ; pas d'échelle typographique | **majeure** |
| Boutons difficiles à identifier | un seul style, primaire par défaut ; `.danger` = couleur de texte seule | **majeure** |
| Actions principales qui ne ressortent pas | `New Character` a le même rayon et la même famille qu'un bouton de barre d'outils ; `Ouvrir un projet` est une phrase | **majeure** |
| Espaces mal utilisés | Home : 48 % de vide, 2 colonnes ; éditeur : canvas à 52 % | moyenne |
| Composants uniformisables | boutons, cartes, vignettes, puces, popovers, badges, états vides, toasts | **majeure** |

La conclusion pratique : **il n'y a pas de design system, il y a 1 245 décisions
locales.** Le premier travail n'est donc pas de redessiner des écrans, c'est
d'extraire les jetons et les six composants qui portent 80 % de la surface — ce
que fait [07_DESIGN_SYSTEM.md](07_DESIGN_SYSTEM.md).
