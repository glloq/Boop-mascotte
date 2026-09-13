# 01 — État actuel de l'UI

Inventaire de chaque zone de l'interface, avec pour chacune : ce qu'elle fait,
si elle est nécessaire, si un nouvel arrivant la comprend, et ce qu'il faudrait
en faire (garder · déplacer · fusionner · simplifier · masquer · contextualiser).

Toutes les zones sont construites en JavaScript : `project/editor/index.html`
ne contient qu'un `<div id="app">` et **107 Ko de CSS** répartis sur 35 balises
`<style>`. Le DOM est écrit par `project/editor/shell/`.

---

## 1. La coquille (`project/editor/shell/`)

```text
topbar          barre projet + navigation           shell/topbar.js, shell/workspace-nav.js
side-nav        colonne gauche contextuelle 300px   shell/side-nav.js
canvas-column   barres d'outils + canvas            shell/canvas-column.js
inspector-host  colonne droite 310px                shell/inspector-host.js
bottom-dock     Timeline sous le canvas 190px       shell/bottom-dock.js
overlays        Home, toast, Problems, dialogues    shell/overlays.js
```

Grille desktop : `.workspace{grid-template-columns:300px minmax(0,1fr) 310px}`.
À 1280 px le canvas reçoit **670 px, soit 52 % de l'écran**.

**Verdict** — la décomposition est saine et récente ([UIR-02](../UIR_REFACTOR_BASELINE.md)).
Rien à refaire ; les colonnes fixes sont à rendre redimensionnables (voir P2).

---

## 2. Topbar (`shell/topbar.js`)

| Contrôle | Utilité | Nécessaire ? | Compréhensible ? | Verdict |
| --- | --- | --- | --- | --- |
| `☰` drawer | Ouvre la colonne gauche en mode compact | oui | oui | garder |
| `BOOP Mascot Studio` | Retour à Home | oui | oui | garder |
| **Navigation** (voir §3) | | | | |
| `📱` capabilities | Ce qui marche sur cet appareil + forcer le layout desktop | marginal | **non** — une icône téléphone sur un desktop n'a aucun sens | **déplacer** sous ••• |
| `🔍` search | Palette de commandes (Ctrl+K) | oui | moyennement | garder |
| `↶` `↷` | Undo / redo | oui | oui | garder |
| `Project check` | Ouvre la popover Problems ; le libellé devient `✓ Ready` / `⚠ 3` | oui | oui, depuis UIR-14 | garder |
| `⟲` reset mascot | Remet la pose au repos et efface les changements de preview | oui | **non** — un `⟲` à côté d'un `↶` se lit comme un second undo | **fusionner** dans Preview + palette |
| `Save Project` | Télécharge le JSON éditable | oui | oui | garder |
| `Export` | Ouvre le panneau d'export ; libellé « Export blocked · 2 » | oui | oui | garder |
| `•••` | New / Recover / Open / Import SVG / Import rig.json / Import face pack / (compact: undo, redo, problems, search) / Advanced ▸ Advanced tools + plugins | oui | oui | garder, y ajouter `📱` |
| `✓ Saved` pill | État de sauvegarde | oui | oui | garder |

**Nombre de contrôles visibles en topbar sur desktop : 9 actions projet + 1 pill
+ 4 onglets d'espace + 3 à 4 onglets d'écran + Preview ≈ 18.**

**Problème** — `Export` et `Save Project` sont deux boutons pleins côte à côte de
même poids visuel, et ce sont deux choses très différentes (un projet éditable,
des fichiers pour un site). Le `<small>` explicatif n'existe que dans le menu.

---

## 3. Navigation à deux niveaux (`shell/workspace-nav.js`, `ui/task-router.js`)

```text
DESIGN            RIG                      ANIMATE                 BEHAVIOR      ▶ Preview
Face Hands        Assign Controls          Expressions Motions     Reactions
     Artwork*     Head 2.5D Deform*        Timeline*               Automatic States*
                                                                   (* = advanced)
```

Treize écrans, quatre espaces, un écran global. Les écrans d'un espace fermé sont
`display:none` ; les écrans `advanced` sont visibles à `opacity:.72`
(`index.html`, `.stage-nav .workspace-tab.advanced-mode:not(.active)`).

| Aspect | Verdict |
| --- | --- |
| Les quatre questions (à quoi ça ressemble / comment ça bouge / ce que ça fait / quand) | **excellent.** À garder tel quel. |
| Les badges de readiness sur les onglets (`✓ ⚠ ● ○`) | bon, mais un `○` permanent sur un écran optionnel se lit comme une corvée — déjà corrigé par `MODE_READINESS` qui n'en met pas partout |
| `Artwork`, `Deform`, `Timeline`, `States` visibles en permanence | **problème.** Quatre surfaces expertes exposées au même niveau que Face, à 72 % d'opacité. Un débutant ne sait pas que `Artwork` est « l'éditeur SVG ». → **masquer derrière un chevron `›` par espace** |
| `DEFAULT_MODE = 'design.artwork'` (`task-router.js:156`) | **problème P1.** Charger « Mascot Face » depuis Home atterrit sur l'éditeur vectoriel. |
| Pas de mode *Simple* | **manque.** Il faudrait un réglage qui n'affiche que `Design ▸ Face`, `Design ▸ Hands` et `Preview`. |
| Le hint d'une ligne par écran (`HINTS`), avec un `×` pour le rejeter | bon, à garder |

---

## 4. Colonne gauche — la zone la plus chargée (`shell/side-nav.js`)

Huit sections, dont **une seule** est visible à la fois selon `data-workspace` :

| Section | Écran | Contenu | Verdict |
| --- | --- | --- | --- |
| `.character-tools` → `#part-browser` | Design ▸ Face | 4 lignes méta + ~11 lignes de parties + Hands + pied *Advanced* | **simplifier** (voir 02, §1) |
| `.hand-tools` → `#hand-states` | Design ▸ Hands | Bibliothèque de dessins par main, 6 verbes | garder |
| `.structure-tools` → `#layers-panel` | Design ▸ Artwork, Rig | Arbre de calques + filtre | **rendre disponible dans Face** (masqué en CSS ligne 294) |
| `.create-tools` → `#artboard-panel` | Design ▸ Artwork | Import/Replace SVG, plage de travail, `<details>` Add/Create artwork (blank canvas, face builder, ready, add feature) | garder, sous Avancé |
| `.rig-tools` → 9 `<details>` | Rig (4 écrans) | Face parts, Movements, Gaze, Head pose, Hands, Controls, Pins & holding, Warp, All parts | déjà découpé par écran (UIR-01) — garder |
| `.expressions-tools` | Animate ▸ Expressions | Studio des expressions | garder |
| `.animate-tools` | Animate ▸ Motions | Studio des motions | garder |
| `.reactions-tools` | Behavior | Réactions + Automatic + `<details>` States & behaviors | garder |

Les neuf sections de rig mesuraient **342 contrôles visibles, 521 tout ouvert**
(chiffre de `side-nav.js`) avant UIR-01. Le découpage en quatre écrans a réglé
ça — c'est le précédent à réutiliser pour Face.

---

## 5. Barres au-dessus du canvas (`shell/canvas-column.js`)

### 5a. Barre d'outils vectoriels (`.design-toolbar`)

Neuf outils : `↖ Select · ◇ Node · ✒ Pen · ╱ Line · □ Rectangle · ○ Ellipse ·
⬠ Polygon · T Text · ✋ Hand`.

Masquée pour `character`, `hands`, `rig`, `expressions`, `reactions`
(`index.html`). Visible uniquement dans Artwork.

**Verdict** — bon périmètre. Mais dans Face, **rien ne la remplace** : il n'y a
aucune barre d'outils au-dessus du canvas, donc aucun endroit où mettre les
actions de pièce. C'est exactement l'emplacement qui manque.

### 5b. Barre d'options d'outil (`#tool-options`, `ui/tool-options.js`)

Remplissage, contour, épaisseur, rayon, côtés, grille/magnétisme, et pour le
Node tool les opérations de point. Plus `.tool-arrange` (aligner / distribuer).

Masquée hors `create` (`#app:not([data-workspace=create]) .tool-options{display:none}`).

**Verdict** — **aligner / distribuer / centrer devraient être disponibles dans
Face.** Ce sont des actions de mise en page, pas de dessin vectoriel.

### 5c. Fil d'Ariane de portée (`#artwork-scope`, `ui/artwork-scope.js`)

`Design / Hands / Left hand / Point` — dit sur quoi les outils sont ouverts et
donne le retour. Excellent, sous-employé : il n'apparaît qu'en portée d'édition.

**Verdict** — **généraliser** en fil d'Ariane de sélection permanent
(`Mascotte / Tête / Yeux / Œil gauche`).

### 5d. Barre de vue (`.canvas-toolbar`)

`✋ Handles · Fit · 100% · − · +`.

**Verdict** — garder. Manque : *Zoom sur la sélection*, et une bascule de fond.

---

## 6. Canvas (`project/editor/svg-editor/svg-canvas.js`, 3 708 lignes)

| Capacité | État | Verdict |
| --- | --- | --- |
| Gizmo transform (move / rotate / scale / pivot) | bon, une commande d'historique par geste, `G E K A`, Échap annule | garder |
| Barre de mode gizmo flottante | n'existe que quand quelque chose est sélectionné | garder |
| Overlay de sélection | calque SVG séparé, `pointer-events:none`, `vector-effect:non-scaling-stroke` | garder |
| Multi-sélection : Shift+clic, lasso sur le vide | fonctionne dans `create` **et** `character` (`EDIT_WORKSPACES`) | garder |
| **Gizmo désactivé dès 2 éléments** (`svg-canvas.js:922`) | `selectedIds.length > 1 → null` ; seul un cadre pointillé reste | **problème** — on ne peut ni tourner ni redimensionner une sélection multiple |
| `canDragBody` : presser dans la boîte de la tête mais sur la bouche sélectionne la bouche | très bon | garder |
| Zoom molette, `Ctrl`+molette autour du pointeur, pan molette/`H`/espace/bouton milieu | bon | garder |
| Magnétisme à la grille | existe (`drawOptions.snap`), **réservé aux outils de dessin** | **étendre** au déplacement de pièces + guides d'alignement |
| Poignées « puppet » sur la mascotte (pose directe) | très bon, bascule `✋ Handles` | garder |
| Poignées de main, warp, pins, picker de dessin de main | overlays de rig | garder, réservés à Rig |
| Bannière de mode (`showMode` / `showNote`) | dit ce qui est en cours et comment annuler | garder |
| **Le clic sélectionne la forme la plus profonde** (`:1090`) | `element.on('click')` + `stopPropagation()` sur chaque élément | **problème P0** |
| **Pas de zoom-sur-sélection, pas de mode isolation, pas de guides** | | manques |

---

## 7. Inspector — colonne droite (`shell/inspector-host.js`, `ui/context-inspector.js`)

Un seul `<section id="context-inspector">` avec **six adaptateurs** :

| Adaptateur | Hôte | Pour | Fichier |
| --- | --- | --- | --- |
| `semantic` | `#rig-panel` | partie de visage / mouvement | `rig-editor/` |
| `artwork` | `#inspector` | élément SVG brut | `inspector/inspector.js` |
| `character` | `#part-inspector` | pièce de mascotte | `ui/character-builder/part-inspector.js` |
| `expression` | `#expression-inspector` | expression | `ui/expression-studio.js` |
| `motion` | `#motion-inspector` | clip / piste / clé | `ui/motion-studio.js` |
| `reaction` | `#reaction-inspector` | réaction | `ui/reaction-studio.js` |

Plus, dans la même colonne : `.preview-actions` (bouton *Focus* + `#preview-panel`)
et `.publish-tools` (`#publish-panel`).

**Verdict** — l'architecture « un inspector, un adaptateur par type de
sélection » est exactement la bonne. Le problème est le **contenu** de
l'adaptateur `character` (voir 02, §6) et le fait que **Preview et Publish
partagent la colonne avec l'inspector**, ce qui la rend longue.

---

## 8. Barre du bas — Timeline (`shell/bottom-dock.js`)

`DOCKS = { timeline }`. `display:none` partout sauf `data-workspace=animate`.
Redimensionnable au pointeur et au clavier, bouton `⌃ Edit key by key` /
`⌄ Hide timeline`.

**Verdict** — bon. Le dock est prévu pour accueillir le journal d'événements et
les diagnostics ; c'est là qu'ils devraient aller (ils sont aujourd'hui dans
Preview et dans Advanced tools).

---

## 9. Overlays (`shell/overlays.js`)

| Overlay | Ce que c'est | Verdict |
| --- | --- | --- |
| `[data-home]` Home | Plein écran sous la topbar : *New Character* (recommandé) + *Mascot Face* + « Continue » (brouillon local) + note « Open Project et Import SVG sont dans ••• » | **bon** depuis V3-08. Manque : une galerie de presets visuels au lieu de deux cartes de texte |
| `#toast` | `role=status`, `textContent`, 2 600 ms | **problème P1** : aucun bouton, donc aucun *Annuler* |
| `#exit-focus` / `.focus-preview` | Mode plein canvas : masque topbar + colonne droite | garder, à étendre au Preview |
| `#problems-panel` Project check | Lignes de readiness groupées + cartes de diagnostic + *Fix* | bon ; les messages sont techniques (voir 02, §9) |
| `#advanced-panel` Advanced tools | Une carte par surface experte, avec disponibilité et raison ; détails Parameters / Diagnostics / Deformation | **excellent** — c'est le modèle de disclosure à généraliser |
| `#command-palette` (Ctrl+K) | Recherche sur le registre + les éléments du projet | bon ; **seulement 13 commandes enregistrées**, aucune action de pièce |
| `#shortcut-help` (`?`) | Raccourcis groupés par portée | bon ; documente des raccourcis qui n'existent pas dans Face |
| `#colour-picker` | *Now* / *In this mascot* / *Standard* / hex / picker natif / *None* | **excellent** — 1 clic applique |
| `#capability-panel` | Ce qui marche sur l'appareil + forcer desktop | garder, déplacer son déclencheur |
| `#unsaved-dialog` | Cancel / Discard / Save | garder |
| `#export-panel` | Feuille d'export au-dessus du canvas | garder |
| `.canvas-menu` (`ui/canvas-menu.js`) | **Le menu contextuel**, un `<dialog>` : nom éditable, partie propriétaire, clip, puis 14 actions | **excellent, et indisponible dans Face** |
| `#drawer-scrim` + sheet à détentes | Compact : drawer gauche + feuille droite `collapsed/half/full` | garder |

### Le menu contextuel en détail (`ui/canvas-menu.js`)

```text
Name [____________]
Part of Left eye
──────────────────────────
Open Left eye          Face Setup
Edit points            Node tool
Add a pin here         Pins & holding
Convert to a path      For points, pins and shape keys
Stop cutting it        The shape comes back to the drawing
Duplicate
Bring forward
Send backward
Bring to front
Send to back
Flip horizontally
Flip vertically
Hide / Show
Lock / Unlock
Delete                 (danger)
```

**14 actions, dont 5 sont du rigging technique** (*Open …*, *Edit points*,
*Add a pin*, *Convert to a path*, *Stop cutting it*). Le menu est bon mais
mélange deux publics ; et il est refusé sur la surface simple.

---

## 10. Bibliothèque de pièces (`core/face-library/`, `ui/character-builder/`)

- **150 dessins livrés** (`builtin/index.js`), répartis :

  | slot | n | slot | n |
  | --- | --- | --- | --- |
  | head | 24 | accessory | 7 |
  | eyes | 21 | hair | 6 |
  | eyebrows | 19 | muzzle | 6 |
  | ears | 15 | beak | 6 |
  | mouth | 14 | crest | 6 |
  | nose | 9 | facialHair | 5 |
  | | | whiskers / antenna / panels | 4 chacun |

- **18 slots visuels** (`face-morphologies.js`) mappés sur **11 catégories
  sémantiques**. Muzzle, Whiskers, Beak, Horns, Crest, Antenna, Panels
  s'installent comme `accessory` ou `mouth`.
- **5 morphologies** : human, muzzle, beak, robot, monster (beak et monster sans
  preset par défaut).
- Presentation : `part-browser.js` → `styles()` rend des **boutons en liste
  verticale** avec vignette + nom + badge (`Current` / `On ×` / `Pack` / `Mine` /
  `Limited`).

**Verdict** — le modèle de données est excellent (slots vs catégories, style =
souhait, repli silencieux). La **présentation** ne l'est pas : c'est une liste de
boutons dans une colonne de 300 px, pas une grille de vignettes. Voir 02, §8.

---

## 11. Preview (`ui/preview-panel.js`, 30 Ko)

Huit sections `<details>` dans la colonne droite :

```text
▾ Expressions   (26)   None + groupes + Intensité
▾ Reactions     (18)   groupes par « quand » + simulateur d'événements + journal
▾ Poses         (n)    les états
▾ Animations    (30)   groupes de clips
▾ Automatic     (n)    blink, idle, oscillateurs
▾ Live controls (n)    pads XY + chips de pose + un slider par paramètre
▾ Hands         (2)    pose, profondeur, dessin
   readiness rows
```

Plus un bouton `Focus` qui masque la topbar et la colonne droite.

**Verdict** — c'est un **banc de test**, pas un preview. Manque :

- aucun **fond** (blanc, sombre, damier, transparent, image)
- aucune **taille d'affichage** (16 / 32 / 64 / 128 / 256 px — le cas réel d'usage)
- aucun **avant/après**
- le simulateur d'événements et le journal sont du debug et sont en première page

---

## 12. Ce qui expose l'architecture interne à l'utilisateur

| Fuite | Où | Ce que l'utilisateur lit |
| --- | --- | --- |
| `ID: eyeLeft` sous chaque calque sélectionné | `svg-editor/layers-panel.js`, `row()` | un identifiant technique |
| `Semantic part "eyes": role "leftEye" references missing element "eyeLeft".` | `core/validation/rig-validator.js:75` → Project check | un message de schéma |
| `Goes on as accessory — what the rig knows it by` | `part-inspector.js`, `saveForm()` | le mot « rig » et la catégorie sémantique |
| `Type` (human / muzzle / beak / robot / monster) | ligne 2 du browser | une taxonomie interne, présentée avant le visage |
| `Style` (« 7 of 9 library parts can be redrawn ») | ligne 3 du browser | un décompte d'inventaire de bibliothèque |
| `Convert to a path — For points, pins and shape keys` | menu contextuel | trois concepts de rigging |
| `Position, size and turn are the whole part's (Left eye group): a library part moves as one.` | `part-inspector.js`, `transformFields()` | la notion d'« instance » |
| `Reshaped by hand: this is yours now, from the library's Round eyes.` | `customNote()` | juste, mais long |
| `Semantic ownership conflict at eyeLeft.scaleY: eyes/eyeOpen conflicts with …` | `rig-validator.js` | illisible |
| Neuf sections `<details>` nommées *Pins & holding*, *Warp*, *All parts* | Rig | vocabulaire de rigging (correct **dans Rig**) |
| `mascot.svg` / `rig.json` / `runtime.js` | panneau Export | correct — c'est le livrable |

---

## 13. Ce qui est dupliqué

| Fonction | Endroit 1 | Endroit 2 | Endroit 3 |
| --- | --- | --- | --- |
| Undo / Redo | topbar | ••• (compact) | Ctrl+Z / palette |
| Project check | topbar | ••• (compact) | palette |
| Search | topbar | ••• (compact) | Ctrl+K |
| Duplicate | menu contextuel | panneau Structure | Ctrl+D (Artwork seulement) |
| Delete | menu contextuel | panneau Structure | Suppr (Artwork seulement) |
| Bring forward / backward / front / back | menu contextuel | panneau Structure | — |
| Hide / Lock | menu contextuel | panneau Structure (icônes de ligne) | — |
| Import SVG | ••• | Design ▸ Artwork (`Import / Replace SVG`) | — |
| Mascot Face template | Home | Design ▸ Artwork ▸ Add/Create | Design ▸ Face ▸ Presets |
| Reset mascot | topbar `⟲` | Ctrl+Alt+R | palette |

**Verdict** — la duplication n'est pas le problème (elle est voulue : plusieurs
portes vers la même pièce). Le problème est l'**asymétrie** : les mêmes actions
existent à trois endroits dans Artwork et à zéro dans Face.

---

## 14. Responsive

| Layout | Seuil | Composition |
| --- | --- | --- |
| desktop | ≥ 900 px | 300 / 1fr / 310, deux panneaux épinglés |
| tablet | 600–899 px | drawer gauche + feuille droite à détentes ; Timeline en position fixe |
| mobile | < 600 px | idem, `.bottom{display:none}`, cibles ≥ 44 px, `gateMarkup()` explique ce qui manque |

`forceLayout('desktop')` épingle le layout desktop à toute largeur.
`gateMarkup()` place un avertissement par écran de rig sur ce qu'un téléphone ne
peut pas faire.

**Verdict** — c'est **bien fait** et déjà testé (`ux19-tablet`, `ux20-mobile`).
Les vrais manques sont sur desktop : colonnes non redimensionnables, et le
canvas qui ne garde pas la priorité (voir 02, §10).

---

## 15. Ce qui est testé (contrainte pour le plan de PR)

60 specs Playwright dans `tests/e2e/`, dont les plus contraignantes pour cet
audit :

| Spec | Couvre |
| --- | --- |
| `ux45-character-builder.spec.js` | Design ▸ Face en entier |
| `ux31-canvas-menu.spec.js` | le menu contextuel |
| `ux25-canvas-editing.spec.js`, `ux38-multi-selection.spec.js`, `ux40-arrangement.spec.js` | sélection, gizmo, aligner |
| `ux35-stages.spec.js`, `ux02-foundation.spec.js` | la navigation et le routeur |
| `ux08-preview-readiness.spec.js`, `ux14-event-simulator.spec.js` | Preview |
| `ux19-tablet.spec.js`, `ux20-mobile.spec.js`, `ux22-layout.spec.js` | responsive |
| `ux21-accessibility.spec.js` | noms accessibles, focus, raccourcis |
| `ux22-visual.spec.js` + `-snapshots/` | **captures visuelles** — tout changement de CSS les casse |

Plus 40 tests `node --test` dans `project/editor/core/tests/`, dont
`character-builder.test.js` (1 310 lignes) et `task-router.test.js`.

**Conséquence pour le plan de PR** : toute PR qui touche le CSS doit
régénérer `ux22-visual.spec.js-snapshots`, et toute PR qui touche le routeur doit
passer `core/tests/task-router.test.js` et `uir00-baseline.test.js`.
