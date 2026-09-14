# 07 — Design system

> **Note d'implémentation (post-#144).** Ce chapitre décrit le système tel qu'il
> a été proposé — préfixe `--bp-*`, `base.css` / `components.css` / `surfaces.css`
> remplaçant les blocs `<style>` de `index.html`. Pendant l'écriture de l'étude,
> la PR #144 a livré la même sortie du CSS avec un vocabulaire `--ux-*` et une
> stratégie **additive** : le `<link>` passe avant les blocs en ligne, donc
> adopter la couche ne peut pas déplacer un pixel, et chaque bloc est migré en
> étant supprimé puis réécrit. C'est cette couche-là qui est en place. Le
> raisonnement ci-dessous (inventaire, hiérarchie des actions, contrastes,
> composants) reste valable et a été transposé ; l'état courant et la marche à
> suivre sont dans `project/editor/styles/README.md`. Lire les noms `--bp-*` de
> ce chapitre comme des rôles, pas comme des identifiants.

## A. Le principe

> **Un module ne choisit jamais une valeur. Il choisit un jeton.**

Aujourd'hui : 247 couleurs, 17 rayons, 20 tailles de police, 74 paddings, 11
jetons. Cible : **un fichier de jetons, six composants, et une règle qui interdit
les valeurs littérales** — vérifiée par un test, sans quoi elle ne tiendra pas
plus de trois PR.

### D'abord, sortir le CSS de `index.html`

```text
project/editor/index.html      653 lignes, dont ~109 Ko de CSS en ligne
                 ↓
project/editor/styles/
  tokens.css        les jetons, et rien d'autre
  base.css          reset, typographie, focus
  components.css    les six composants
  layout.css        la coque, les colonnes, le rail, le tiroir
  surfaces.css      ce qui reste, par écran, en attendant d'être absorbé
```

Vite gère `<link rel="stylesheet">` sans configuration. C'est un déplacement
mécanique, sans aucun changement visuel, et c'est la condition de tout le reste :
on ne peut pas auditer une feuille de style qu'on ne peut pas ouvrir.

### Le test qui tient la règle

```js
// core/tests/design-tokens.test.js  (nouveau)
// components.css et layout.css ne contiennent aucune couleur littérale.
const css = read('styles/components.css') + read('styles/layout.css');
assert.equal(css.match(/#[0-9a-f]{3,8}/gi) ?? [], []);
// et aucun rayon ou espacement hors échelle
assert.equal(css.match(/border-radius:\s*(?!var\()/g) ?? [], []);
```

`surfaces.css` en est exempté au départ, et y entre au fur et à mesure des PR.
C'est ce qui rend la migration progressive au lieu d'être un grand soir.

---

## B. Les jetons

### B.1 — Couleurs

```css
:root{
  /* Fonds — quatre niveaux, avec un écart de luminance perceptible */
  --bp-bg:            #0a1020;   /* la page */
  --bp-surface:       #131c33;   /* panneaux, rail, tiroir */
  --bp-raised:        #1c2846;   /* cartes, popovers */
  --bp-raised-hover:  #24325a;   /* survol d'une carte */

  /* Traits */
  --bp-border:        #2a3654;   /* séparation ordinaire */
  --bp-border-strong: #3d4c70;   /* bord d'un contrôle */

  /* Texte */
  --bp-text:          #e8edf7;
  --bp-text-muted:    #9aa9c4;   /* 4.9:1 sur --bp-surface */
  --bp-text-faint:    #6b7a96;   /* décoratif uniquement, jamais porteur */

  /* Accent — une seule famille, cinq degrés */
  --bp-accent-fg:     #d6e4ff;   /* texte sur un fond accent */
  --bp-accent-tint:   #1d2f5c;   /* fond d'un élément sélectionné */
  --bp-accent:        #3b6fe0;   /* remplissage primaire */
  --bp-accent-hover:  #4c80f0;
  --bp-accent-ring:   #7aa7ff;   /* focus, et seulement le focus */

  /* Sémantique */
  --bp-danger:        #e4606c;
  --bp-danger-tint:   #3a1b22;
  --bp-warn:          #f0c368;
  --bp-warn-tint:     #382c14;
  --bp-success:       #56cf95;
  --bp-success-tint:  #16362a;

  /* Vignettes — le seul endroit clair de l'interface */
  --bp-thumb-bg:      #eef2f8;   /* pas #fff : #fff vibre sur du bleu nuit */
  --bp-thumb-border:  #cdd7e6;
}
```

**Trois règles non négociables :**

1. **`--bp-accent-ring` ne sert qu'au focus clavier.** Aujourd'hui `#79adff` est
   à la fois le focus, la bordure « recommandé » et une couleur d'accent : un
   élément recommandé et un élément focalisé se ressemblent.
2. **Aucun état n'invente une couleur.** Un survol est `--bp-raised-hover`, une
   sélection `--bp-accent-tint` + `--bp-accent` en bordure. Pas de sixième bleu.
3. **Tout fond porteur de texte a un contraste vérifié** contre `--bp-text` ou
   `--bp-text-muted` (AA, 4.5:1). Le tableau de contrôle est dans le test.

> **Onze jetons de couleur deviennent vingt-deux — et 620 valeurs littérales
> deviennent zéro.** Le nombre de jetons augmente ; le nombre de *décisions*
> s'effondre.

### B.2 — Typographie

```css
:root{
  --bp-font: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
  --bp-text-xs:  12px;  --bp-lh-xs: 16px;   /* méta, compteurs, badges */
  --bp-text-sm:  13px;  --bp-lh-sm: 18px;   /* corps de l'interface */
  --bp-text-md:  15px;  --bp-lh-md: 22px;   /* libellés de contrôles, cartes */
  --bp-text-lg:  18px;  --bp-lh-lg: 24px;   /* titres de panneau */
  --bp-text-xl:  24px;  --bp-lh-xl: 30px;   /* titres d'écran */
  --bp-text-2xl: 40px;  --bp-lh-2xl:46px;   /* le héros de la Home, seul */
  --bp-weight-regular: 400;
  --bp-weight-medium:  550;
  --bp-weight-bold:    680;
}
```

**Six tailles, contre vingt.** Le corps passe de **11 px à 13 px**, les libellés
de contrôles de 11–12 px à **15 px**.

> **Risque à traiter de front.** Passer de 11 px à 13/15 px fait déborder des
> panneaux dimensionnés pour 11 px. Ce n'est acceptable que parce que la
> variante B de [06](06_BUILDER.md) **rend 228 px au canvas** (300 → 72) et que
> les libellés y sont des mots et non des phrases. Chaque PR qui augmente une
> taille doit vérifier le panneau concerné à 1280 px et à 1024 px.

**La règle qui supprime la moitié du texte** : une explication de plus d'une
ligne n'est pas dans le panneau, elle est dans l'infobulle du contrôle. Les
sept paragraphes de l'inspector deviennent sept `title`.

### B.3 — Espacement, rayons, élévation, mouvement

```css
:root{
  --bp-space-1: 4px;  --bp-space-2: 8px;   --bp-space-3: 12px;
  --bp-space-4: 16px; --bp-space-5: 24px;  --bp-space-6: 32px; --bp-space-7: 48px;

  --bp-radius-sm:  6px;    /* puces, badges, champs */
  --bp-radius-md:  10px;   /* boutons, vignettes */
  --bp-radius-lg:  14px;   /* cartes, popovers */
  --bp-radius-xl:  20px;   /* modales, cartes de l'assistant */
  --bp-radius-pill:999px;

  --bp-shadow-1: 0 1px 2px #00000040;                      /* carte posée */
  --bp-shadow-2: 0 6px 16px #00000059;                     /* popover, tiroir */
  --bp-shadow-3: 0 18px 48px #00000073;                    /* modale */

  --bp-ease: cubic-bezier(.2,.8,.3,1);
  --bp-duration-fast: 120ms;   /* survol, pression */
  --bp-duration-base: 180ms;   /* tiroir, popover */
  --bp-duration-slow: 260ms;   /* modale */
}
@media (prefers-reduced-motion: reduce){
  :root{--bp-duration-fast:0ms;--bp-duration-base:0ms;--bp-duration-slow:0ms}
}
```

**Cinq rayons contre dix-sept.** La correspondance est directe :
`1 2 3 → sm` · `5 6 7 8 9 → md` · `10 12 14 → lg` · `99 999 → pill`.

---

## C. Les boutons — la correction la plus importante

### Le problème à renverser

```css
/* aujourd'hui */
button,.button{background:#245ed4;…}   /* ← TOUT bouton est primaire */
```

### La règle nouvelle

```css
/* la base ne peint rien */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--bp-space-2);
     font:var(--bp-weight-medium) var(--bp-text-sm)/1 var(--bp-font);
     border:1px solid transparent;border-radius:var(--bp-radius-md);
     cursor:pointer;transition:background var(--bp-duration-fast) var(--bp-ease)}
```

### Quatre niveaux (demande §24)

| Niveau | Classe | Apparence | Règle d'usage |
| --- | --- | --- | --- |
| **Primary** | `.btn-primary` | fond `--bp-accent`, texte `#fff` | **une seule par écran**, jamais dans une barre d'outils |
| **Secondary** | `.btn-secondary` | fond `--bp-raised`, bordure `--bp-border-strong` | l'action ordinaire |
| **Tertiary** | `.btn-ghost` | pas de fond, pas de bordure, texte `--bp-text-muted` | barres d'outils, actions répétées, tout ce qui est dense |
| **Danger** | `.btn-danger` | texte et bordure `--bp-danger`, fond `--bp-danger-tint` **au survol seulement** | destructif |

```css
.btn-primary  {background:var(--bp-accent);color:#fff}
.btn-primary:hover{background:var(--bp-accent-hover)}
.btn-secondary{background:var(--bp-raised);border-color:var(--bp-border-strong);color:var(--bp-text)}
.btn-secondary:hover{background:var(--bp-raised-hover)}
.btn-ghost    {background:transparent;color:var(--bp-text-muted)}
.btn-ghost:hover{background:var(--bp-raised);color:var(--bp-text)}
.btn-danger   {background:transparent;border-color:var(--bp-danger);color:var(--bp-danger)}
.btn-danger:hover{background:var(--bp-danger-tint)}
```

**Ce qui change concrètement** : la topbar passe de 10 boutons bleus pleins à
**7 `ghost` + 1 `secondary` (Enregistrer) + 0 primaire**, parce qu'aucune action
de barre de projet n'est l'action principale d'un écran. `Créer cette mascotte`
et `+ Nouvelle mascotte` sont alors les seuls boutons pleins de l'application, et
ils ressortent sans effort — ce que §24 demande.

**Sur `.danger`** : aujourd'hui `.danger{color:#fca5a5}` appliqué à un bouton
laisse le fond bleu primaire. « Delete » est donc du rose sur du bleu. La
nouvelle définition annule le fond, ce qui rend l'action identifiable sans être
« visuellement envahissante » (§24).

### Trois tailles

| | Hauteur | Padding | Police | Usage |
| --- | --- | --- | --- | --- |
| `.btn-sm` | 28 px | `0 10px` | `--bp-text-xs` | barres d'outils denses, puces |
| `.btn` | 36 px | `0 14px` | `--bp-text-sm` | par défaut |
| `.btn-lg` | 48 px | `0 24px` | `--bp-text-md` | Home, assistant, `Appliquer` |

### Icône seule

```css
.btn-icon{width:36px;height:36px;padding:0;flex:none}
.btn-icon.btn-sm{width:28px;height:28px}
```

**Deux obligations**, faute de quoi c'est un bouton illisible :

1. un `aria-label` — tous les boutons icône actuels en ont un, c'est acquis ;
2. une **infobulle** (composant `tooltip`, §D.9) ; aujourd'hui c'est un `title`
   natif, qui n'apparaît pas au clavier et pas du tout sur tactile.

---

## D. Les composants

### D.1 — Carte

```text
.card                 fond --bp-raised, radius lg, bordure --bp-border
.card:hover           fond --bp-raised-hover, bordure --bp-border-strong
.card[aria-pressed]   bordure 2px --bp-accent, fond --bp-accent-tint, pastille ✓
.card:disabled        opacity .45, curseur not-allowed
.card--pick           carte à vignette (bibliothèque, assistant)
.card--info           carte de contenu (Home, aide)
```

**Une seule règle de sélection dans toute l'application** : bordure 2 px accent
+ **pastille ✓ de 18 px** en coin haut-droit. C'est la pastille qui règle le
problème mesuré en [01](01_AUDIT_GRAPHIQUE.md) §F : un écart de fond de 4 % ne
se voit pas, une coche se voit.

### D.2 — Modale

**À créer** : six `<dialog>` sont ouverts en `showModal()` (palette de commandes,
aide, sélecteur de couleur, changements non enregistrés, et deux confirmations),
chacun avec son propre balisage et son propre rayon, aucun avec une structure
en-tête / corps / pied — et aucun n'est une modale de contenu. Le composant
n'existe donc pas ; les six deviennent ses premiers clients.

```html
<dialog class="modal modal--lg">
  <header class="modal-head"><h2>…</h2><button class="btn-icon btn-ghost">✕</button></header>
  <div class="modal-body">…</div>
  <footer class="modal-foot">
    <button class="btn btn-ghost">Annuler</button>
    <span class="modal-foot-spacer"></span>
    <button class="btn btn-secondary">Réinitialiser</button>
    <button class="btn btn-primary">Appliquer</button>
  </footer>
</dialog>
```

| Règle | Valeur |
| --- | --- |
| Élément | `<dialog>` natif — `::backdrop`, piégeage du focus, `Échap` gratuits |
| Tailles | `sm` 420 px · `md` 640 px · `lg` 900 px · `full` `min(1280px, 92vw) × 88vh` |
| Rayon | `--bp-radius-xl` |
| Ombre | `--bp-shadow-3` |
| Fond | `--bp-surface`, `::backdrop` `#06090f` à 62 % |
| Pied | actions **à droite**, annulation **à gauche** ; la primaire en dernier |
| Fermeture | `Échap`, `✕`, clic sur le fond — **sauf** si des modifications non appliquées existent, où le clic sur le fond ne ferme pas et où `Échap` demande confirmation |
| Sur mobile | `full` devient plein écran, sans rayon |

### D.3 — Tiroir

```text
.drawer               --bp-surface, --bp-shadow-2, largeur 360 px
.drawer[data-side=left]    glisse depuis le rail
.drawer-head          titre + compteur + ✕
```

Réutilise le scrim mobile existant (`.drawer-scrim`). Sur bureau, **pas de
scrim plein écran** : seuls les 60 px adjacents au tiroir sont voilés, pour que
la mascotte reste pleinement lisible pendant qu'on choisit.

### D.4 — Champ numérique

```text
┌──────────────────────────────┐
│ Taille              1.00  ⌃⌄ │   36 px, libellé à gauche, valeur à droite
└──────────────────────────────┘
```

| Règle | Valeur |
| --- | --- |
| Hauteur | 36 px (cible tactile 44 px sur `pointer:coarse`) |
| Molette | **désactivée** sauf si le champ a le focus — sinon un défilement de panneau modifie une valeur |
| `↑` `↓` | ± pas ; `Maj` ± 10 pas ; `Alt` ± 0,1 pas |
| Glissement | sur le **libellé**, curseur `ew-resize` : le geste de réglage sans quitter la souris |
| Unité | suffixe grisé dans le champ, jamais dans le libellé |
| Nombre de décimales | figé par le pas, jamais flottant |

### D.5 — Curseur (slider)

Piste 4 px `--bp-border-strong`, remplissage `--bp-accent`, poignée 16 px avec
anneau de focus. Valeur **toujours affichée** à droite ; un curseur sans nombre
est un réglage qu'on ne peut pas reproduire.

### D.6 — Onglets

```text
.tabs                 rangée, séparateur 1px en dessous
.tab                  ghost, 36 px
.tab[aria-selected]   texte --bp-text, soulignement 2px --bp-accent
```

Un seul motif, utilisé par les espaces de travail, par `Pièce seule / Contexte`
du modal SVG, et par les disclosures de l'inspector. Aujourd'hui il y a
`.stage-tab`, `.timeline-view button[aria-pressed]` et `.face-type-current` :
trois motifs pour un onglet.

### D.7 — Badge

```text
.badge            --bp-text-xs, radius pill, padding 2px 8px
.badge--neutral   fond --bp-raised,        texte --bp-text-muted
.badge--accent    fond --bp-accent-tint,   texte --bp-accent-ring
.badge--warn      fond --bp-warn-tint,     texte --bp-warn
.badge--success   fond --bp-success-tint,  texte --bp-success
```

Remplace `part-style-badge`, `part-style-worn`, `part-style-pack`,
`part-style-mine`, `part-style-limited`, `part-style-custom`, `semantic-badge`,
`status-pill` — **huit classes, un composant.**

### D.8 — Menu contextuel

`ui/canvas-menu.js` existe et est bon. Trois ajustements :

| Point | Aujourd'hui | Proposé |
| --- | --- | --- |
| Hauteur d'entrée | variable, `<small>` inline | 32 px fixe, l'indice en colonne droite grisée |
| Groupes | un seul bloc de 14 | 3 groupes séparés par un trait |
| Filtrage | tout, partout | par contexte (voir [05](05_BIBLIOTHEQUE.md) §E) |

### D.9 — Infobulle

**À créer.** Les `title` natifs ne s'affichent pas au clavier, pas sur tactile,
et avec un délai de 1 s non contrôlable. Un composant de 40 lignes :
apparition à 400 ms, `--bp-text-xs`, `--bp-raised`, `--bp-shadow-2`, disparition
immédiate, montré aussi au `:focus-visible`.

C'est la contrepartie de la règle « une explication de plus d'une ligne n'est
pas dans le panneau » : sans infobulles correctes, retirer la prose est une
perte d'information.

### D.10 — État vide

```text
┌──────────────────────────────────────┐
│              ◌                       │   pictogramme 32 px, --bp-text-faint
│     Aucune moustache pour l'instant  │   --bp-text-md
│     Les dessins d'un pack ou les      │   --bp-text-sm, --bp-text-muted
│     vôtres apparaîtront ici.          │
│        [ Importer un SVG ]            │   au plus une action, secondary
└──────────────────────────────────────┘
```

Trois règles : jamais plus d'une action ; jamais de ton d'excuse ; **jamais
d'état vide là où la section peut simplement ne pas être affichée** (c'est le
cas de *Reprendre* sur la Home et des rangées sans dessin).

### D.11 — Notification (toast)

L'audit l'a déjà demandé (`P1-1`) : `setStatus` écrit du `textContent`, donc
aucun des quinze messages disant « Undo puts it back » n'offre *Annuler*.

```text
┌────────────────────────────────────────────┐
│ ✓  L'œil gauche a été remplacé.  [Annuler] │
└────────────────────────────────────────────┘
```

| Règle | Valeur |
| --- | --- |
| Durée | 4 s sans action, **7 s** avec |
| Position | bas-centre, au-dessus de la barre d'état |
| Empilement | 3 au maximum, le plus récent en bas |
| Tons | `info` (neutre), `success`, `warn`, `danger` |
| `aria-live` | `polite`, `assertive` pour `danger` |

### D.12 — Sélection (au canvas)

| Élément | Valeur |
| --- | --- |
| Contour | 1,5 px `--bp-accent-ring`, **non mis à l'échelle** par le zoom |
| Poignées | 10 px, fond `--bp-surface`, bord accent ; 14 px sur `pointer:coarse` |
| Pivot | anneau creux, jamais plein — il ne se déplace pas comme une poignée |
| Multi-sélection | contour pointillé englobant + contour plein par pièce |
| Barre d'actions | 8 px sous la boîte, bascule au-dessus si la place manque |

---

## E. La hiérarchie des actions, appliquée

| Écran | Primary (1) | Secondary | Ghost | Danger |
| --- | --- | --- | --- | --- |
| Home | `+ Nouvelle mascotte` | `Ouvrir un projet` | `⚙`, `?` | — |
| Assistant, étape 1 | — (une carte *est* l'action) | — | `← Annuler` | — |
| Assistant, étape 2 | `Créer cette mascotte` | — | `← Type` | — |
| Builder | — | `Enregistrer` | `Tester`, `Exporter`, `↶`, `↷`, `⚙`, `?` | — |
| Inspector | — | `Remplacer`, `Dupliquer`, `✎ Dessin` | — | `Retirer` |
| Modal SVG | `Appliquer` | `Réinitialiser` | `Annuler` | — |
| Confirmation de suppression | — | `Annuler` | — | `Supprimer` |

**Trois règles :**

1. **Une seule primaire visible à la fois.** Si un écran en veut deux, l'une
   des deux n'est pas l'action principale.
2. **Aucune primaire dans une barre d'outils.** Une barre est un ensemble
   d'égaux ; rendre l'un d'eux bleu plein le rend faussement urgent.
3. **Une action destructive est `danger`, pas `primary`.** `Supprimer` dans une
   confirmation reste à droite, mais en rouge sur fond neutre : identifiable,
   non envahissant.

---

## F. Les icônes

Aujourd'hui : `★ ◇ ◑ ◐ ◯ ◉ • ◠ ⌒ ▽ ◡ ◖ ∿ ≋ ◈ ✋ ⋙ ◣ ⋏ ♜ ⑂ ▤` — des caractères
Unicode, donc une graisse et un rendu dépendants de la police, un poids optique
incohérent (`•` contre `▤`), et deux paires interchangeables (`▽` nez / `▽`
museau ; `◠` paupières / `⌒` sourcils).

**Proposé** : un jeu SVG de ~28 pictogrammes, en ligne, trait 1,5 px, grille de
24, `currentColor`, dans `ui/icons.js` :

```js
export const ICON = Object.freeze({
  head:'<path …/>', eyes:'…', brows:'…', nose:'…', mouth:'…', beak:'…',
  muzzle:'…', whiskers:'…', ears:'…', hair:'…', crest:'…', horns:'…',
  antenna:'…', panels:'…', facialHair:'…', accessory:'…', hands:'…',
  replace:'…', duplicate:'…', editShape:'…', remove:'…', hide:'…', lock:'…',
  forward:'…', backward:'…', search:'…', undo:'…', redo:'…'
});
export const icon = (name, { size = 20 } = {}) => `<svg …>${ICON[name]}</svg>`;
```

C'est la dépendance dure de la variante B de [06](06_BUILDER.md) : un rail
d'icônes n'est utilisable que si les icônes sont distinctes.

---

## G. Le vocabulaire (demande §25)

### Ce qui est déjà fait, et sert de modèle

`ui/control-catalog.js` traduit **déjà** chaque paramètre de rig en intention :

```js
headX:{label:'Move left / right'}   lookY:{label:'Look up / down'}
browRaise:{label:'Raise'}           mouthOpen:{label:'Open / close'}
earWiggle:{label:'Wiggle'}          pupilScale:{label:'Pupil size'}
```

Et un test de garde échoue si un contrôle déclaré n'a pas d'entrée. **Le motif
demandé par §25 existe : il faut l'étendre, pas l'inventer.**

### Ce qui reste à traduire

| Mot technique | Où | Proposé |
| --- | --- | --- |
| `Muzzle` / `Beak` / `Monster` | cartes de type | Animal · Oiseau · Créature |
| `Preset` | builder, assistant | **Modèle** |
| `Morphology` | code et bulles | *jamais affiché* |
| `Semantic part`, `Semantic binding` | Face Setup, validation | **Rôle** ; le reste sous *Avancé* |
| `Rig` | onglet d'espace de travail | **Mouvements** |
| `Deform`, `Warp` | écran, panneau | **Déformer** (sous *Avancé*) |
| `Shape key` | Avancé | **Pose enregistrée** |
| `Keyform` | Avancé | **Grille de poses** |
| `Pivot` | gizmo, mains | **Point de rotation** |
| `Amplitude` | Motions | **Ampleur** |
| `Easing` | Motions | **Accélération** (`Douce · Linéaire · Sèche`) |
| `Depth` / `Parallax` | mains, Avancé | **Devant / derrière** |
| `Projection strength` | Head 2.5D | **Relief** |
| `Anchor`, `Reach` | mains | **Point d'attache**, **Portée** |
| `Constraint`, `Binding` | inspector Avancé | *reste — c'est un écran d'expert* |
| `viewBox` | artboard, mains | **Cadre du dessin** |
| `Guard` (transition) | States | **Condition** |
| `ID: eyeLeft` | calques | sous `▸ Avancé` (audit `P1-8`) |

### La règle qui évite la prochaine fuite

Un libellé visible ne vient jamais d'un id. Deux tables, deux tests :

```js
// ui/control-catalog.js   existe : contrôles de rig       ✅ testé
// ui/vocabulary.js        nouveau : morphologies, slots, catégories, écrans
```

et un test qui parcourt `FACE_SLOTS`, `FACE_MORPHOLOGIES`,
`FACE_PART_CATEGORIES` et `MODES`, et échoue si l'un d'eux n'a pas d'entrée
visible — exactement la garde que `control-catalog` possède déjà.

---

## H. Aider à faire de belles mascottes (demande §26)

Des valeurs par défaut, jamais des règles. Cinq propositions, toutes réalisables
sur l'existant :

| Fonction | Comment | Existe déjà ? |
| --- | --- | --- |
| **Palettes recommandées** | 5 à 6 palettes nommées appliquées aux jetons (`skin`, `outline`, `hair`, `eyeWhite`, `pupil`…) en une étape d'undo | `palette-model.js` gère les jetons ; il manque les palettes |
| **Presets de couleur par type** | une palette par défaut différente pour Animal / Oiseau / Robot | à ajouter au modèle |
| **Symétrie automatique** | déjà là : `pairOf` miroite `X` et la rotation, avec une case pour délier | ✅ `character-builder.js:382` |
| **Centrage et tailles recommandées** | déjà là : l'auto-fit place une pièce à sa `referenceBox` et `Reset position` y revient | ✅ `face-layout.js` |
| **Proportions** | au glissement, une aide magnétique légère vers l'axe médian et vers la taille d'origine (±3 %), désactivable | à ajouter au gizmo |
| **Styles cohérents** | `restylePlan()` dit déjà en trois nombres ce qu'un style changerait | ✅, sans variantes dessinées |

**Ce qu'il ne faut pas faire** : bloquer un glissement, refuser une couleur,
afficher un avertissement de « proportion incorrecte ». §26 le dit — « ne pas
imposer des règles strictes ». Une bonne valeur par défaut et un aimant léger
suffisent ; le reste appartient à l'auteur.
