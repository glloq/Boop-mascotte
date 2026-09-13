# 02 — Problèmes identifiés

Chaque problème porte : ce qui se passe, la référence dans le code, le risque
pour l'utilisateur, et la correction proposée.

---

## §1 — Le Character Builder (Design ▸ Face)

### 1.1 — P0 · La surface simple n'a aucun geste de suppression

`project/editor/app/editor-app.js` gère le clavier en deux blocs :

```js
if (shell.getWorkspace()==='character' && !meta) {   // :794
  if (nudgeSelection()) return;                       // flèches
  if (id && canvas.handleGizmoKey(event)) return;     // G E K A
}
if (shell.getWorkspace()==='create' && !meta) {       // :799
  …                                                   // flèches, gizmo,
  …                                                   // V N P L R O S T H,
  if (event.key==='Delete' || event.key==='Backspace') { … }   // :813
}
```

Et `Ctrl+D`, `Ctrl+C`, `Ctrl+V`, `Ctrl+A`, `Ctrl+G`, `Ctrl+Shift+G` sont tous
gardés par `=== 'create'` (lignes 771–786).

Le seul retrait offert dans Face est le bouton *Remove* de l'inspector, et il
n'apparaît que si `piece.removable` — soit `removable: Boolean(category.multiple)`
(`ui/character-builder/character-model.js:122`). `multiple` n'est vrai que pour
`accessory` et `facialHair`.

> **Donc : une tête, des yeux, des pupilles, des paupières, des sourcils, un
> nez, une bouche, des oreilles, des cheveux, un museau, un bec, une crête ne
> peuvent pas être retirés depuis Design ▸ Face. Ni au clavier, ni au clic
> droit, ni par un bouton.**

**Risque** — l'utilisateur conclut que ce n'est pas possible, ou part dans
Artwork et y supprime le groupe SVG, ce qui laisse la partie sémantique
orpheline (voir §4.4).

**Correction** — extraire un module `ui/piece-actions.js` appelé par Face,
Artwork et Rig, et y router Suppr / Ctrl+D / Ctrl+C / Ctrl+V / clic droit.
Dans Face, Suppr sur une pièce de bibliothèque appelle `facePartCommands.remove(partId)`
(qui existe déjà et gère les pièces hébergées) ; sur une pièce dessinée à la
main, `canvas.delete(id)`.

### 1.2 — P0 · Pas de menu contextuel

```js
const CANVAS_MENU_WORKSPACES = new Set(['create', 'rig']);   // editor-app.js:251
```

Le commentaire explique le choix (« In Preview the canvas is a test bench, and a
delete there would be a trap ») — mais `character` n'est pas Preview, c'est une
surface d'édition.

**Correction** — ajouter `'character'`, et **filtrer les entrées** : le menu
affiche aujourd'hui *Edit points*, *Add a pin here*, *Convert to a path*,
*Stop cutting it*, qui n'ont aucun sens pour un débutant. Voir 04, §6.

### 1.3 — P0 · Pas d'ordre d'affichage

```css
#app[data-workspace=character] .structure-tools { display:none }   /* index.html:294 */
```

Aucun moyen, dans Face, de mettre les lunettes devant les cheveux, de masquer
temporairement une pièce, ou de la verrouiller.

**Correction** — deux entrées d'ordre dans le menu contextuel et la barre
d'actions (*Avancer* / *Reculer*, avec *Premier plan* / *Arrière-plan* dans le
menu), plus une liste de pièces **par rôle** (pas par calque SVG) sous *Avancé*.

### 1.4 — P1 · Quatre lignes de méta avant le visage

```text
★ Presets    Ready-made faces to start from
◇ Type       Human, muzzle, beak, robot, monster: what kind of face this is
◑ Style      Redraw the face in another look…
◐ Colours    Skin, outline, hair, mouth: the colours of the face
◯ Head       Face
◉ Eyes       Left eye · Right eye
…
```

`Type` ne change rien sur la mascotte (c'est un filtre d'offre — c'est écrit
dans `type-browser.js`), et `Style` est un décompte d'inventaire de
bibliothèque (« 7 of 9 library parts can be redrawn »). Les deux sont au-dessus
de *Head*.

**Correction** — `Type` et `Style` remontent dans un en-tête de panneau
compact (deux `<select>` ou deux chips sur une ligne : `Human ▾` `Soft Cartoon ▾`),
`Presets` reste en tête, `Colours` descend en bas près de *Avancé*. Le panneau
commence alors sur *Head*.

### 1.5 — P1 · Le point d'entrée par défaut est l'éditeur vectoriel

`DEFAULT_MODE = 'design.artwork'` (`ui/task-router.js:156`) et
`loadTemplate(kind, { mode = 'design.artwork' })` (`app/services/project-service.js:173`).

Seul *New Character* passe `{ mode: 'design.face' }` (`editor-app.js:394`).
Donc : *Mascot Face* depuis Home, un projet ouvert, un SVG importé, un visage
généré → tous atterrissent sur neuf outils de dessin.

**Correction** — `DEFAULT_MODE = 'design.face'`, et `loadSvgFile` garde
`design.artwork` (c'est le seul cas où l'auteur arrive avec un dessin à
travailler).

### 1.6 — P2 · La bibliothèque de la pièce ouverte est sous la ligne, non à côté

Presser *Eyes* ouvre un `.part-category-body` **sous** la ligne *Eyes*, dans la
colonne de 300 px. Les cartes de style sont donc des boutons empilés de
~280 px de large. Avec 21 paires d'yeux, il faut scroller la colonne entière.

**Correction** — voir 04, §1 : la bibliothèque devient un panneau qui prend
toute la colonne (ou une feuille au-dessus du canvas) en grille de 3 colonnes.

---

## §2 — Gestion des éléments

### 2.1 — P0 · Le clic canvas sélectionne la forme la plus profonde

```js
element.on('click', (event) => {
  event.stopPropagation();
  …
  store.mutateSession(…, selectOnly(element.id()));   // svg-canvas.js:1090-1104
});
```

Un œil du template est un groupe de sept formes : `eyeWhiteLeft`, `pupilLeft`,
`glintLeft`, `rimLeft`, `lidUpperLeft`, `lidLowerLeft`, plus le groupe
`eyeLeft`. Cliquer sur l'œil sélectionne **le reflet** (`glintLeft`, affiché
« Left eye glint »).

Il n'y a pas de pattern « clic = l'objet de plus haut niveau, double-clic =
descendre dedans ». Tous les éditeurs graphiques modernes l'ont.

**Risque** — l'utilisateur croit avoir sélectionné l'œil, appuie sur Suppr (si
on l'ajoute) et supprime un reflet de 2 px ; ou glisse et déplace le reflet
hors de l'œil.

**Correction** — dans `character`, le clic remonte jusqu'à la **racine de
l'instance** (`instanceRootOf` existe déjà, `character-model.js:173`) ou à la
première pièce déclarée de la catégorie ; le double-clic entre d'un niveau et
le fil d'Ariane le dit. Dans `create`, le comportement actuel reste (c'est
l'éditeur vectoriel).

### 2.2 — P0 · Le gizmo et les champs n'agissent pas sur la même chose

| Geste | Cible | Miroir de la paire |
| --- | --- | --- |
| Champs *X / Y / Scale / Rotation* de l'inspector | `instanceRootOf(model(), pieceId)` — la partie entière | **oui** si la paire est liée (`linkedPeer`) |
| Gizmo au canvas | `selectedId` — la forme sélectionnée | **non** |
| Flèches du clavier | `selectedId` | **non** |

Références : `character-builder.js:382` (`moveBy`), `svg-canvas.js:921`
(`gizmoTarget`), `editor-app.js:788` (`nudgeSelection`).

**Risque** — l'utilisateur lie la paire d'yeux (case cochée par défaut : « every
pair is, until its box is unticked »), glisse l'œil gauche, et seul l'œil gauche
bouge. Il tape ensuite `X` et les deux bougent. Le modèle mental est cassé.

**Correction** — faire passer le gizmo de `character` par le même chemin que
les champs : `getTarget` retourne `instanceRootOf(...)` et `onCommit` appelle
`writeTransforms` du builder (qui gère déjà la transaction et le miroir).
`writeTransforms` existe (`character-builder.js`) — il suffit de l'exposer.

### 2.3 — P1 · Pas de gizmo en multi-sélection

```js
if (… || selectedIds.length > 1) return null;   // svg-canvas.js:922
```

Deux pièces sélectionnées : on peut les glisser (`moveSelectionBy`) et les
nudger (`nudgeMany`), mais pas les tourner ni les redimensionner ensemble. Seul
un cadre pointillé s'affiche.

**Correction** — P2 : un gizmo sur la boîte englobante avec un pivot au centre,
appliquant la même transformation à chaque élément. Non trivial ; à ne pas
mettre en P0.

### 2.4 — P1 · Aucun miroir accessible

`canvas.flip(id, 'x' | 'y')` existe et le menu contextuel l'offre
(*Flip horizontally* / *Flip vertically*) — donc dans Artwork seulement.
`mirrorHandPlacement` existe pour les mains. Rien pour une pièce de visage dans
Face.

**Correction** — *Miroir* dans la barre d'actions et le menu contextuel de Face.

### 2.5 — P1 · Renommer n'est possible que dans le menu contextuel ou l'arbre

Les deux sont indisponibles dans Face. L'inspector affiche le nom en lecture
seule (`<p class="small" data-part-piece-name>`).

**Correction** — rendre le nom éditable en place dans l'en-tête de l'inspector.

### 2.6 — P2 · Changer de parent n'a pas d'UI

`canvas.reparent` / `rehome` existent dans le code d'installation de pièces
mais aucune surface ne les expose. Dans Artwork on peut grouper/dégrouper, pas
déplacer un calque dans un autre groupe (pas de drag & drop dans l'arbre).

**Correction** — hors périmètre P0/P1. À noter comme manque assumé.

### 2.7 — P2 · Pas de restauration après suppression autre que l'undo

Undo est le seul filet. C'est **suffisant** — à condition que le toast offre le
bouton (voir §4.1). Pas de corbeille à prévoir.

---

## §3 — Ajout et remplacement

### 3.1 — Ce qui marche bien

- **Un clic sur une carte de style remplace la pièce** (`onStyle` →
  `commands.replace`) — 2 actions depuis Face (ligne de catégorie + carte).
- **Le glisser-déposer d'une carte sur la mascotte existe** (`part-drag.js`,
  `dropHost: shell.canvasEl`), avec un contour et le message « Drop it on the
  mascot ». Bon.
- **Les cartes disent ce qu'elles font avant le clic** : `Use` / `Add`, badge
  `On ×` pour retirer, `Current`, `Limited` avec le nombre de mouvements non
  portés.
- **Le repli est silencieux et juste** : un style qui n'existe pas pour une
  pièce laisse la pièce telle quelle, et le dit après coup.

### 3.2 — P1 · Le remplacement rapide n'existe pas depuis la sélection

Pour changer les yeux il faut : ouvrir la ligne *Eyes* dans le browser →
trouver la carte. Il n'y a pas de « pièce sélectionnée → *Remplacer…* → la grille
s'ouvre filtrée sur son slot ».

**Correction** — bouton *Remplacer* dans la barre d'actions et le menu
contextuel, qui ouvre la bibliothèque sur le slot de la pièce.

### 3.3 — P2 · Rien n'indique où une pièce va atterrir

`rowInstallTarget` (`visual-rows.js`) décide si une carte remplace la pièce du
slot ou en ajoute une nouvelle. La règle est bonne mais invisible : rien ne
survole la mascotte pour dire « ça remplacera le museau ».

**Correction** — au survol d'une carte, surligner la pièce qu'elle remplacerait
sur le canvas.

---

## §4 — La suppression, en détail

| Chemin | Existe ? | Confirmation ? | Toast ? | Undo ? | Nettoie les références ? |
| --- | --- | --- | --- | --- | --- |
| Touche `Suppr` dans **Artwork** | ✅ `editor-app.js:813` | non | **non** | ✅ | **non** |
| Touche `Suppr` dans **Face** | ❌ | — | — | — | — |
| Touche `Suppr` dans **Rig** | ❌ | — | — | — | — |
| Menu contextuel *Delete* (Artwork, Rig) | ✅ `editor-app.js:230` | non | texte seul | ✅ | **non** |
| Panneau Structure *Delete* | ✅ `layers-panel.js` | non | **non** | ✅ | **non** |
| Inspector *Remove* (Face) | ✅ mais `multiple` seulement | non | texte seul | ✅ | ✅ (`facePartCommands.remove`) |
| Sélection multiple `Suppr` (Artwork) | ✅ `canvas.deleteMany` | non | **non** | ✅ (1 pas) | **non** |
| Supprimer un groupe | ✅ (le groupe entier part) | non | non | ✅ | **non** |

### 4.1 — P1 · Aucun toast n'a de bouton

```js
setStatus(message, tone='info', {routine=false}={}) {
  const el = q('#toast');
  …
  el.textContent = message;      // shell/overlays.js
  …
}
```

`textContent`. Quinze messages de l'éditeur écrivent « Undo puts it back. » ou
« Undo brings it back. » sans qu'il y ait rien à presser. Sur un écran tactile,
`Ctrl+Z` n'existe pas.

**Correction** — `setStatus(message, tone, { action: { label, run } })` qui rend
un `<button>` dans le toast. Le toast devient
`Œil gauche supprimé — [Annuler]`, 6 s au lieu de 2,6 s quand il y a une action.
Un seul point à changer, tout le reste en bénéficie.

### 4.2 — P1 · Supprimer une pièce laisse des références orphelines

`canvas.delete(id)` retire le nœud et appelle `refreshDocument()`, qui purge
`state.elements` et notifie les domaines `['artwork','layers','semanticRig','keyforms','hands']`.
Mais **rien ne nettoie `semanticParts[*].roles`**. Le validateur le signale
ensuite :

```
Semantic part "eyes": role "leftEye" references missing element "eyeLeft".
```

(`core/validation/rig-validator.js:75`)

**Risque** — l'utilisateur supprime un œil dans Artwork et découvre dans
Project check un message de schéma qu'il ne peut pas corriger lui-même.

**Correction** — deux niveaux :
1. **P1** : réécrire le message en langage utilisateur, avec un *Fix* qui retire
   le rôle. (`core/validation/issue-guidance.js` existe pour ça.)
2. **P1** : dans Face, router Suppr vers `facePartCommands.remove(partId)` quand
   la pièce appartient à une partie de bibliothèque — ce chemin nettoie déjà.

### 4.3 — P2 · Pas de confirmation là où il en faudrait

Aujourd'hui : **zéro confirmation** pour toute suppression, ce qui est le bon
défaut. Mais supprimer un groupe qui porte cinq rôles de rig, ou huit pièces en
multi-sélection, se fait aussi silencieusement.

**Correction** — une confirmation **uniquement** si :
- la sélection compte ≥ 3 pièces, **ou**
- la pièce est un groupe qui porte ≥ 2 rôles sémantiques, **ou**
- la pièce héberge d'autres pièces (`result.hosted`).

Sinon : suppression immédiate + toast avec *Annuler*.

### 4.4 — P2 · « Delete » et « Remove » sont deux mots pour deux choses

*Delete* (menu, Structure) supprime de l'artwork. *Remove* (inspector Face)
retire la partie de la bibliothèque et nettoie le rig. Les deux sont justes,
mais l'utilisateur ne peut pas savoir lequel il veut.

**Correction** — un seul mot, *Supprimer*, et la bonne implémentation choisie
par le code selon la nature de la pièce.

---

## §5 — Le canvas

| Aspect | État | Verdict |
| --- | --- | --- |
| Visibilité de la sélection | Overlay SVG dédié, contour + 8 poignées + poignée de rotation + pivot, `non-scaling-stroke` | **bon** |
| Bounding box | `selectionBox(node)` avec minimum pour les traits fins | bon |
| Poignées de redimensionnement | 4 coins + 4 bords | bon |
| Rotation | Poignée sur tige au-dessus de la boîte | bon |
| Pivot | Déplaçable, défaut au centre de la boîte (`svg-canvas.js:930`) | **bon** — c'est un détail bien traité |
| Déplacement | Corps de la boîte, sauf si le pointeur est sur une autre pièce (`canDragBody`) | **très bon** |
| Un geste = un undo | `pointerdown → transient → pointerup → ONE command` | **bon** |
| `Échap` annule le transform en cours | oui | bon |
| Drag & drop depuis la bibliothèque | oui, avec contour et message | bon |
| Zoom / pan | Molette, `Ctrl`+molette autour du pointeur, `H`, espace, bouton milieu, `Fit`, `100%` | bon |
| Sélection derrière un autre élément | **manque.** Pas d'`Alt+clic` pour traverser, pas de liste « sous le pointeur » | **P2** |
| Sélection de très petits éléments | **problème.** Cliquer un reflet de 2 px est facile ; cliquer l'œil ne l'est pas (§2.1) | **P0** (résolu par §2.1) |
| Multi-sélection | Shift+clic, lasso sur le vide (`marquee`) | bon, mais pas de gizmo (§2.3) |
| Magnétisme | Seulement pour les outils de dessin (`snapIfOn`) | **P2** — l'étendre au déplacement |
| Guides / alignement visuel | **aucun.** Pas de ligne rouge « centré sur l'axe » | **P2** |
| Aligner / distribuer | `alignSelection`, `distributeSelection` — dans `.tool-arrange`, masqué hors Artwork | **P1** — à rendre disponible dans Face |
| Zoom sur la sélection | **manque** | P2 |
| Mode isolation | **manque** (`setEditScope` existe et fait exactement ça, mais n'est appelé que par *Edit Shape* et les dessins de main) | **P1** — exposer *Isoler* |
| Raccourcis | `G E K A` gizmo, flèches, `V N P L R O S T H` outils | bon dans Artwork, **partiels dans Face** |

---

## §6 — L'inspector

L'adaptateur `character` (`ui/character-builder/part-inspector.js`) rend, pour
une pièce sélectionnée, dans cet ordre :

```text
Eyes                          ← subject : nom de la ligne + badge de partie + « Style: Round eyes »
Left eye · Left eye           ← nom de la pièce + rôle
[Left eye][Right eye]         ← chips, + « All 2 are selected: a drag moves them together… »
Reshaped by hand: …           ← note de personnalisation (si applicable)
Position, size and turn are the whole part's (Left eye group): a library part moves as one.
☑ Edit both eyes together     ← case de liaison de paire
Right eye mirrors every change: a move out is a move out on both sides. Untick to edit Left eye alone.
Spacing [  42  ]
Position    X [  ] Y [  ]
Size and turn  Scale [  ] Rotation [  ]
Colours     ■ ■ ■ ■ ■ ■ ■   (jusqu'à 16, puis « +N more »)
            A swatch changes that colour everywhere this piece uses it.
Shape       [✎ Edit Shape]
            Opens the Node tool on this piece, in Artwork: drag its points and curves.
            [Reset position][Reset colours][Reset all]
▸ Save as a library part      a style card of yours
▸ Advanced                    rig and artwork
```

### 6.1 — P1 · Trop de prose

Sept paragraphes explicatifs pour cinq champs. Chaque phrase est **juste et bien
écrite** — mais elles sont toutes visibles en même temps, à chaque sélection.
L'inspector se lit comme une documentation, pas comme un panneau de propriétés.

**Correction** — garder une seule phrase (celle de la liaison de paire, qui
change de sens), passer les autres en `title=` / infobulle `ⓘ`, et ne montrer la
note d'instance que si l'auteur essaie de bouger une sous-pièce.

### 6.2 — P0 · Les actions essentielles ne sont pas là

Manquent : **Dupliquer, Supprimer (pour les catégories uniques), Remplacer,
Miroir, Masquer, Verrouiller, Avancer / Reculer**.

Présents à la place : *Edit Shape* (qui quitte Face pour Artwork), trois *Reset*,
et un formulaire de sauvegarde en bibliothèque avec huit champs.

**Correction** — une rangée d'actions juste sous le nom :
`⧉ Dupliquer · ⇄ Remplacer · ⇋ Miroir · ◐ Masquer · 🔒 Verrouiller · 🗑 Supprimer`.

### 6.3 — P1 · Le formulaire « Save as a library part » est au même niveau qu'« Advanced »

Huit champs (nom, part, works with × 5 cases, tags, rôles, mount point) dans un
`<details>` de niveau `advanced`, juste au-dessus d'*Advanced*. C'est une
fonction d'**auteur de bibliothèque**, pas de créateur de mascotte.

**Correction** — la déplacer **dans** *Advanced*, ou dans un menu `•••` de la
pièce.

### 6.4 — P1 · Structure non conforme au modèle demandé

La structure visée est :

```text
TRANSFORM   Position · Taille · Rotation
APPARENCE   Couleur · Opacité
COMPORTEMENT Symétrie · Association gauche/droite
▸ Réglages avancés
```

L'actuelle mélange : la symétrie (COMPORTEMENT) est **avant** Position
(TRANSFORM), et l'opacité n'est pas offerte du tout dans Face (elle est dans
l'inspector Artwork).

**Correction** — réordonner, ajouter l'opacité, grouper sous trois titres.

### 6.5 — P2 · La colonne droite porte trois choses

`#context-inspector` + `.preview-actions` (bouton Focus + tout le banc de
Preview) + `.publish-tools`. Sur Design ▸ Face, `.preview-actions` est masqué,
donc ça va — mais sur Preview, l'inspector reste monté en dessous.

---

## §7 — Navigation

### 7.1 — Ce qui est bon

- Les quatre questions sont les bonnes.
- Chaque écran reste accessible par son propre onglet ; un espace est un
  raccourci, jamais une barrière.
- Chaque espace se souvient de l'écran quitté (`lastModeInWorkspace`).
- Preview est une **bascule** et rend l'auteur à l'écran qu'il éditait.
- Les flèches parcourent les deux anneaux d'onglets (`ring-keys.js`).
- `MODE_ALIASES` garde chaque ancien nom de route vivant.

### 7.2 — P1 · L'utilisateur voit quatre surfaces expertes en permanence

`Artwork`, `Deform`, `Timeline`, `States` sont marqués `advanced: true` dans
`MODES` mais rendus comme les autres, à `opacity:.72`.

**Correction** — un chevron `›` en fin de rangée d'écrans qui révèle les écrans
avancés de l'espace ouvert. L'état est une préférence UI, et *Advanced tools*
continue de les router.

### 7.3 — P1 · Pas de mode Simple

Pour quelqu'un qui veut juste une mascotte, trois des quatre espaces sont hors
sujet. Il n'y a pas de réglage qui les replie.

**Correction** — un bouton `Simple / Complet` dans `•••`, qui en mode *Simple*
n'affiche que `Design` (Face, Hands) et `Preview`. Aucune route n'est supprimée :
la palette, *Advanced tools* et les deep links continuent d'y aller.

### 7.4 — P2 · Le vocabulaire reste celui du logiciel

`Rig`, `Semantic Rig`, `Head Pose`, `Holding`, `States`, `Deform`, `Assign`,
`Keyform`, `Warp`, `Pins`. Corrects **dans Rig**, mais visibles depuis Design.

**Correction** — en mode Simple, les mots deviennent : `Mascotte` · `Animation` ·
`Comportement`, avec `Avancé` pour le reste. Pas de renommage du code : une
table de libellés dans `task-router.js`.

---

## §8 — La bibliothèque de pièces

| Attendu | État |
| --- | --- |
| Miniatures | ✅ `facePartThumbnail` — vraies vignettes SVG |
| Taille des previews | ❌ ~44 px dans une liste verticale de 280 px de large |
| Catégories | ✅ 18 slots visuels, dans l'ordre de la morphologie |
| Filtres | ⚠️ automatique par slot + morphologie (`assetsFor`) — **rien de manuel** |
| Styles | ✅ 1 ligne *Style* globale, avec décompte de couverture |
| Tags | ⚠️ **existent dans les données** (`assetTags`, `parseFaceTags`) et ne filtrent rien |
| Compatibilité | ✅ excellente, invisible (voir §9) |
| **Recherche** | ❌ **absente.** Aucun champ, ni dans la bibliothèque ni dans le browser |
| **Favoris** | ❌ absents |
| **Historique / récents** | ❌ absents |

### 8.1 — P1 · La présentation n'est pas visuelle

`part-browser.js`, `styles()` produit, pour chaque dessin, un `<button>` avec
`.part-style-thumb` + `.part-style-name` + badge, empilés dans
`.part-style-list`. Dans une colonne de 300 px cela fait une liste, pas une
planche.

Avec 24 têtes, 21 paires d'yeux, 19 sourcils, c'est du défilement.

**Correction** — grille `repeat(auto-fill, minmax(84px, 1fr))`, vignette carrée
80×80, nom en dessous, badge en coin. Trois par ligne dans 300 px, six dans une
feuille pleine largeur.

### 8.2 — P1 · Pas de recherche

150 dessins, aucun champ de recherche. Le panneau *Structure* en a un
(`#layer-filter`), pour les calques — c'est-à-dire à l'endroit où il sert le
moins.

**Correction** — un champ en tête de la bibliothèque, qui cherche dans le nom,
la description et les tags (les tags existent déjà dans les assets).

### 8.3 — P2 · Pas de récents ni de favoris

**Correction** — deux listes en `localStorage` (comme `boop.handSets`,
`boop.drawOptions.v1`, les presets de visage) : les 8 derniers dessins utilisés,
et les favoris marqués d'une étoile au survol de la carte.

---

## §9 — La compatibilité entre pièces

### 9.1 — Ce qui est déjà excellent

`core/face-library/compatibility.js` est le meilleur module de l'audit :

- `assetsFor({ morphology, slot, style })` **filtre déjà automatiquement** par
  kind de visage et par slot.
- `styledAsset` fait qu'un style est un **souhait** : une pièce dont le restyle
  n'existe pas reste telle quelle, jamais retirée, jamais échangée en silence.
- `restylePlan` / `describeRestylePlan` disent **avant** ce qui va changer et
  **après** ce qui a changé.
- Les cartes incompatibles sont **affichées et désactivées avec la raison**
  plutôt que masquées (`type-browser.js` : « A missing option an author can see
  is a promise; one they cannot is a feature that does not exist. »).

### 9.2 — P2 · Pas d'échappatoire « Tout afficher »

Le filtrage par morphologie est total : en `Type: Human`, les 6 museaux, 6 becs,
6 crêtes, 4 antennes et 4 panneaux sont **absents de la liste**. Il n'y a aucun
bouton pour les voir quand même. Or mettre un bec sur un visage humain est une
chose parfaitement légitime à vouloir.

**Correction** — une case `☐ Tout afficher` sous la grille, qui lève le filtre
de morphologie et marque les cartes hors-kind d'un badge discret.

### 9.3 — P2 · Les avertissements techniques restent

Deux formulations exposent la mécanique :

- `« 3 movements are not carried by this drawing — Rig ▸ Controls says which. »`
  (badge `Limited`)
- `« Nothing on this face is drawn this way yet »` (carte de style indisponible)

**Correction** — la première devient « Ce dessin bouge moins que l'actuel »
avec le détail en infobulle ; la seconde reste (elle est honnête et utile).

---

## §10 — Responsive et priorité au canvas

### 10.1 — P2 · 52 % de l'écran pour le canvas

`300px` + `310px` de panneaux fixes. À 1280 px : 670 px de canvas.
Les colonnes ne sont **pas redimensionnables** — seulement repliables
entièrement (`#collapse-left`, `#collapse-right` → 42 px).

**Correction** — deux séparateurs redimensionnables comme celui de la Timeline
(`#timeline-resize` est déjà un `role="separator"` clavier-accessible ; c'est le
même composant à réutiliser deux fois).

### 10.2 — P2 · Les deux colonnes peuvent être ouvertes en même temps sur tablette

Sur tablette, la contrainte « jamais deux overlays » est respectée
(`openDrawer()` met `sheet='collapsed'`, `setSheet()` met `drawerOpen=false`).
Bien fait. Sur desktop il n'y a pas de contrainte — c'est normal.

### 10.3 — P2 · La feuille de Preview couvre la mascotte

En mode compact, `[data-sheet=full] .panel-right{height:calc(100vh - 64px)}` —
la feuille couvre tout. En `half`, 50 vh. La mascotte est alors dans les 50 %
du haut, sous la topbar. Acceptable mais serré.

---

## §11 — États vides et retour utilisateur

| Cas | Message actuel | Verdict |
| --- | --- | --- |
| Rien de sélectionné (Face) | « Pick a part on the left, or click the mascot. » | **bon** |
| Aucune mascotte | « Start from a preset, or import artwork, to build a character. » | bon, **sans bouton** → ajouter *Nouveau personnage* |
| Aucune mascotte (Preview) | « Add artwork to test a mascot here. » | bon, sans bouton |
| Aucune animation | « Add a motion preset or select an animation to edit it. » | bon |
| Bibliothèque vide (styles) | « No styles yet. A style is a set of drawings that restyle the library's own; a face pack can bring one. » | bon |
| Recherche sans résultat | « Nothing matches "…" » (palette uniquement) | bon ; **pas de recherche dans la bibliothèque** |
| Élément supprimé | rien dans Artwork/Structure ; texte seul ailleurs | **P1** — toast + *Annuler* |
| Élément incompatible | carte désactivée + raison en `title=` | **P2** — la raison n'est visible qu'au survol |
| Une opération échoue | `setStatus(reason, 'error')` | bon |
| Pas de couleur sur la pièce | « No colours to change on this piece. » | bon |
| Pas de parties assignées | « No colours to read yet: start from a face, or assign its parts in Face Setup. » | **jargon** (« Face Setup ») |
| Project check sans problème | « ✓ No problems found » | bon |

**Conclusion** — les états vides sont **presque tous bons** : ils disent quoi
faire ensuite. Les deux manques sont (a) des boutons d'action dans les états
vides, (b) le toast sans *Annuler*.
