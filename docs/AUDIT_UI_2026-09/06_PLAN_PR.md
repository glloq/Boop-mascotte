# 06 — Priorisation et plan de PR

---

## A. Priorisation

Chaque tâche porte : le problème actuel, la proposition, les fichiers, la
difficulté, le risque de régression et le gain attendu.

### P0 — problèmes UX bloquants

> Un utilisateur qui ne connaît rien au rigging **ne peut pas** faire ce qu'il
> vient faire.

#### P0-1 · Les gestes de pièce n'existent pas dans Design ▸ Face

| | |
| --- | --- |
| **Problème** | `Suppr`, `Ctrl+D`, `Ctrl+C`/`V`, `Ctrl+A` et le clic droit sont gardés par `shell.getWorkspace()==='create'` (`editor-app.js:771-786`, `:799-814`) et `CANVAS_MENU_WORKSPACES` (`:251`). La surface simple n'a donc aucun geste de gestion. |
| **Proposition** | Extraire un module `ui/piece-actions.js` : une table `{ action → run(id, context) }` et un routeur clavier, appelés par Face, Artwork et Rig. Dans Face, `delete` route vers `facePartCommands.remove(partId)` quand la pièce appartient à une partie de bibliothèque, et vers `canvas.delete(id)` sinon. |
| **Fichiers** | **nouveau** `project/editor/ui/piece-actions.js` · `project/editor/app/editor-app.js` · `project/editor/ui/shortcuts.js` (portées) · `project/editor/ui/canvas-menu.js` (option `level`) |
| **Difficulté** | moyenne — c'est du déplacement de code, mais le bloc clavier de `editor-app.js` est dense et non formaté |
| **Risque** | **moyen.** Un `Suppr` qui atteint la mauvaise cible détruit du travail. À couvrir par des tests avant de fusionner : `ux45-character-builder`, `ux25-canvas-editing`, `ux31-canvas-menu`, `ux38-multi-selection`, `core/tests/character-builder.test.js` |
| **Gain** | **maximal.** Supprimer passe de *impossible* à 1 touche ; dupliquer de 4 actions à 2 ; l'ordre de 5 à 2 |

#### P0-2 · Le clic canvas sélectionne la forme la plus profonde

| | |
| --- | --- |
| **Problème** | `element.on('click')` + `stopPropagation()` (`svg-canvas.js:1090`) sélectionne `glintLeft` quand on clique un œil. Aucun pattern clic/double-clic. |
| **Proposition** | Dans `character` seulement : le clic remonte à `instanceRootOf(model, id)` ou à la pièce déclarée de la catégorie ; le double-clic descend d'un niveau ; `#artwork-scope` sert de fil d'Ariane. Dans `create`, comportement inchangé. |
| **Fichiers** | `project/editor/svg-editor/svg-canvas.js` (handler de clic, ~15 lignes) · `project/editor/ui/character-builder/character-builder.js` (fournir la fonction de résolution) · `project/editor/ui/artwork-scope.js` · `project/editor/shell/canvas-column.js` |
| **Difficulté** | moyenne |
| **Risque** | moyen — `ux45`, `ux25`, `ux46-face-layout` touchent la sélection |
| **Gain** | **élevé.** L'utilisateur sélectionne ce qu'il voit |

#### P0-3 · Le gizmo et les champs n'agissent pas sur la même chose

| | |
| --- | --- |
| **Problème** | `gizmoTarget()` cible `selectedId` sans miroir ; `moveBy()` cible `instanceRootOf(...)` avec miroir de la paire liée. Le drag et la frappe font deux choses différentes. |
| **Proposition** | Dans `character`, `getTarget` retourne la racine d'instance et `onCommit` passe par `writeTransforms()` du builder (qui gère déjà la transaction et le miroir). Exposer `writeTransforms` dans l'API du builder. |
| **Fichiers** | `project/editor/svg-editor/svg-canvas.js` (`gizmoTarget`, `gizmo.onCommit`) · `project/editor/ui/character-builder/character-builder.js` (exposer `writeTransforms`) · `project/editor/app/editor-app.js` (`nudgeSelection`) |
| **Difficulté** | moyenne — le gizmo écrit aujourd'hui directement `baseTransform` via `commands.syncSvg` |
| **Risque** | **élevé** — le gizmo est central et couvert par `ux25`, `ux38`, `ux40`, `docs/SELECTION_GIZMO.md` |
| **Gain** | **élevé.** Le modèle mental redevient cohérent |

#### P0-4 · Barre d'actions flottante sur la sélection

| | |
| --- | --- |
| **Problème** | Les six gestes essentiels n'ont aucune affordance visible. Aucun débutant ne découvre `Ctrl+D`. |
| **Proposition** | Un composant `ui/selection-actions.js` : six boutons (Dupliquer · Remplacer · Miroir · Avancer · Reculer · Supprimer) placés sous la boîte de sélection, avec bascule au-dessus si débordement. Réutilise le placement de `canvas-menu.js:place()` et appelle `piece-actions.js`. |
| **Fichiers** | **nouveau** `project/editor/ui/selection-actions.js` · `project/editor/svg-editor/svg-canvas.js` (montage, comme `gizmoToolbar`) · `project/editor/index.html` (CSS) |
| **Difficulté** | faible |
| **Risque** | faible — nouveau composant ; attention à ne pas avaler les pointeurs du gizmo (`pointer-events` et un décalage sous la boîte) |
| **Gain** | **maximal.** Rend P0-1 découvrable |

### P1 — améliorations UX majeures

| Id | Problème | Proposition | Fichiers | Diff. | Risque | Gain |
| --- | --- | --- | --- | --- | --- | --- |
| **P1-1** | Les toasts n'ont pas de bouton (`textContent`) | `setStatus(msg, tone, { action: { label, run } })` rend un `<button>` ; 6 s quand il y a une action ; tous les « Undo puts it back » deviennent `[Annuler]` | `shell/overlays.js` · `index.html` (CSS `.toast`) · appelants de `setStatus` | faible | faible | élevé |
| **P1-2** | `DEFAULT_MODE = 'design.artwork'` : on atterrit dans l'éditeur vectoriel | `DEFAULT_MODE = 'design.face'` ; `loadSvgFile` garde `design.artwork` | `ui/task-router.js:156` · `app/services/project-service.js:173` | **triviale** | faible (`core/tests/task-router.test.js`, `ux03-home`, `ux35-stages`) | élevé |
| **P1-3** | 16 presets sur 22 invisibles derrière `Type` | Grille de tous les presets avec chips de genre facultatives ; `Type` et `Style` deviennent deux chips d'en-tête | `ui/character-builder/part-browser.js` · `preset-browser.js` · `type-browser.js` · `style-browser.js` · `character-model.js` (`CHARACTER_CATEGORIES`) | moyenne | moyen (`ux45`) | élevé |
| **P1-4** | Bibliothèque en liste de boutons, sans recherche | Grille `repeat(auto-fill, minmax(84px,1fr))`, vignettes 80 px, champ de recherche sur nom + description + `assetTags` | `index.html` (CSS) · `part-browser.js` · `compatibility.js` (`assetsFor` accepte `query`) | moyenne | **moyen** — `ux22-visual.spec.js-snapshots` à régénérer | élevé |
| **P1-5** | Inspector Face : 7 paragraphes, pas d'actions | Réordonner en `POSITION` / `TAILLE` / `COULEURS`, rangée d'actions sous le nom, prose en infobulles, `Save as a library part` déplacé dans *Avancé* | `ui/character-builder/part-inspector.js` | moyenne | moyen (`ux45`, `core/tests/character-builder.test.js`) | élevé |
| **P1-6** | Preview sans fond ni taille, 8 sections | Fond (4 chips) + taille (4 chips), plein écran par défaut, simulateur/journal/curseurs sous `› Test avancé` | `ui/preview-panel.js` · `shell/inspector-host.js` · `index.html` (CSS) | moyenne | moyen (`ux08`, `ux14`) | élevé |
| **P1-7** | Messages de validation en langage de schéma | Réécrire les messages de rôle orphelin et offrir un *Fix* qui retire le rôle | `core/validation/rig-validator.js` · `core/validation/issue-guidance.js` · `core/validation/validate-project.js` | faible | faible | moyen |
| **P1-8** | `ID: <id>` sous chaque calque | Déplacer sous un `<details>` *Avancé* de la ligne | `svg-editor/layers-panel.js` | triviale | faible | moyen |
| **P1-9** | 4 écrans avancés visibles en permanence | Chevron `› Avancé` en fin de rangée d'écrans | `shell/workspace-nav.js` · `index.html` (CSS) · `ui/workspace-state.js` (préférence) | faible | faible (`ux35-stages`) | moyen |
| **P1-10** | Les mains exigent un aller-retour vers Rig | Dessiner la paire depuis la ligne *Hands* de Design | `ui/character-builder/hand-placement-panel.js` · `character-builder.js` · `app/workspaces/design.js` | faible | faible (`ux32`, `ux47`) | moyen |
| **P1-11** | Pas de fil d'Ariane de sélection | Généraliser `#artwork-scope` en fil d'Ariane permanent, cliquable | `ui/artwork-scope.js` · `shell/canvas-column.js` · `svg-canvas.js` | faible | faible | moyen |

### P2 — confort

| Id | Problème | Proposition | Fichiers | Diff. | Gain |
| --- | --- | --- | --- | --- | --- |
| **P2-1** | Pas de mode Simple | Réglage `Simple / Complet` dans `•••` ; en Simple, table de libellés FR et `Rig` sous `› Avancé` de Mascotte | `ui/task-router.js` (libellés) · `shell/workspace-nav.js` · `shell/topbar.js` · `ui/workspace-state.js` | moyenne | moyen |
| **P2-2** | Colonnes non redimensionnables | Deux séparateurs, en réutilisant le composant de `#timeline-resize` | `shell/app-shell.js` · `shell/bottom-dock.js` (extraire le séparateur) · `index.html` | faible | moyen |
| **P2-3** | Pas de liste de pièces dans Face | Liste **par rôle** (pas l'arbre SVG) sous `› Avancé` : ordre, visibilité, verrou | `ui/character-builder/part-browser.js` · `character-model.js` | moyenne | moyen |
| **P2-4** | Aligner / centrer / distribuer masqués hors Artwork | Les exposer dans la barre d'actions et sous `› Plus` de l'inspector | `ui/tool-options.js` · `ui/selection-actions.js` · `index.html` | faible | moyen |
| **P2-5** | Pas de `☐ Tout afficher` | Case sous la grille, lève le filtre de morphologie, badge de genre sur les cartes hors-kind | `part-browser.js` · `character-builder.js` | faible | moyen |
| **P2-6** | Pas de favoris ni de récents | Deux listes `localStorage`, étoile au survol de la carte | **nouveau** `core/face-library/face-part-recents.js` · `part-browser.js` | faible | moyen |
| **P2-7** | Pas de magnétisme ni de guides au déplacement | Étendre `snapIfOn` au drag de sélection ; ligne SVG dans `gizmoLayer` quand le centre s'aligne | `svg-canvas.js` · `svg-editor/transform-gizmo.js` | moyenne | moyen |
| **P2-8** | Pas de zoom sur la sélection ni d'isolation exposée | `Zoom sur la sélection` dans la barre de vue ; *Isoler* (= `setEditScope`) dans le menu | `shell/canvas-column.js` · `svg-canvas.js` · `ui/canvas-menu.js` | faible | moyen |
| **P2-9** | Confirmation absente là où il en faudrait | Confirmer si ≥ 3 pièces, ou groupe portant ≥ 2 rôles, ou pièce hébergeant d'autres pièces | `ui/piece-actions.js` · `shell/overlays.js` | faible | moyen |
| **P2-10** | Palettes non exposées | Les 4 `FACE_PALETTES` en chips dans l'inspector du visage | `part-inspector.js` · `part-browser.js` | faible | moyen |
| **P2-11** | Assistant de création absent | 3 écrans, réutilisant `availableMorphologies`, `presetsFor`, `FACE_PALETTES`, `drawHandStyle` | **nouveau** `ui/character-builder/create-wizard.js` · `ui/home-surface.js` · `app/editor-app.js` | moyenne | moyen |
| **P2-12** | `⟲` et `📱` en topbar | `⟲` descend dans Preview + palette ; `📱` descend dans `•••` | `shell/topbar.js` · `ui/preview-panel.js` | triviale | faible |
| **P2-13** | `Échap` ne désélectionne pas | Ajouter la désélection en dernier maillon de `closeTopSurface()` | `app/editor-app.js` · `ui/shortcuts.js` | triviale | faible |
| **P2-14** | `G E K A` au lieu de `G R S P` | Renommer, garder les anciennes en alias | `svg-editor/gizmo-geometry.js` (`GIZMO_SHORTCUTS`) · `ui/shortcuts.js` | triviale | faible |
| **P2-15** | Pas de `]` / `[` pour l'ordre | Ajouter, plus `Ctrl+Shift+]` / `[` | `ui/piece-actions.js` · `ui/shortcuts.js` | triviale | faible |

### P3 — polish visuel

| Id | Problème | Proposition | Fichiers | Gain |
| --- | --- | --- | --- | --- |
| **P3-1** | 247 hex codés en dur contre 11 jetons `--ux-*` | Étendre le jeu de jetons et remplacer les hex par lots ; sortir le CSS de `index.html` vers `project/editor/styles/` | `index.html` · **nouveaux** `project/editor/styles/*.css` · `vite.config.js` | moyen (maintenance) |
| **P3-2** | Contraste non vérifié | Contrôle de contraste dans Preview sur fond clair et sombre | `ui/preview-panel.js` | faible |
| **P3-3** | États vides sans bouton | Ajouter le bouton d'action à chaque état vide | `part-inspector.js` · `preview-panel.js` · `expression-studio.js` | faible |
| **P3-4** | Glyphes unicode comme icônes (`◉ ⌒ ⌇ ▽ ⋙`) | Un jeu d'icônes SVG inline cohérent | `character-model.js` (`FACE_GLYPHS`) · `visual-rows.js` (`SLOT_GLYPHS`) · `layers-panel.js` (`TYPE_GLYPH`) | faible |
| **P3-5** | Gizmo en multi-sélection | Un gizmo sur la boîte englobante | `svg-canvas.js` · `transform-gizmo.js` | faible |
| **P3-6** | `Alt`+clic pour traverser | Cycle sous le pointeur | `svg-canvas.js` | faible |

---

## B. Plan de PR

Dix PR, chacune limitée en périmètre, conservant toutes les fonctions
existantes, testable seule, et fusionnable indépendamment des suivantes —
**sauf les dépendances indiquées**.

### UI-01 — Fondations : le module de gestes de pièce

> **P0-1.** Le socle de tout le reste. À fusionner en premier.

**Ce qui change** — extraire de `editor-app.js` la logique de gestes vers
`ui/piece-actions.js`, et l'ouvrir à `character` et `rig`. Aucun changement
visible **sauf** que `Suppr`, `Ctrl+D`, `Ctrl+C`/`V`, `Ctrl+A` et
`Shift+F10` fonctionnent dans Design ▸ Face.

| Fichiers |
| --- |
| **nouveau** `project/editor/ui/piece-actions.js` |
| `project/editor/app/editor-app.js` — le bloc `window.addEventListener('keydown')` (≈ lignes 744-830) et le handler `contextmenu` (≈ 251-263) |
| `project/editor/ui/shortcuts.js` — mettre les `scope` à jour (`artwork-clipboard`, `multi-select`, `artwork-nudge`, `artwork-menu`) |
| `project/editor/ui/canvas-menu.js` — option `{ level: 'simple' \| 'full' }` |
| `project/editor/ui/character-builder/character-builder.js` — exposer `removePiece(id)` qui choisit `facePartCommands.remove` ou `canvas.delete` |

**Tests** — `core/tests/character-builder.test.js`, `ux45-character-builder`,
`ux31-canvas-menu`, `ux25-canvas-editing`, `ux38-multi-selection`,
`ux21-accessibility`. **Ajouter** : « Suppr sur une pièce de bibliothèque dans
Face retire la partie et nettoie ses rôles », « Suppr sur une pièce dessinée à
la main supprime l'élément », « clic droit dans Face ouvre le menu simple ».

### UI-02 — Barre d'actions de sélection + toasts annulables

> **P0-4** et **P1-1.** Rend UI-01 découvrable. Dépend de UI-01.

| Fichiers |
| --- |
| **nouveau** `project/editor/ui/selection-actions.js` |
| `project/editor/svg-editor/svg-canvas.js` — monter la barre comme `gizmoToolbar`, la synchroniser dans `syncGizmoToolbar()` |
| `project/editor/shell/overlays.js` — `setStatus(msg, tone, { action })` |
| `project/editor/index.html` — CSS `.selection-actions`, `.toast button` |
| Appelants de `setStatus` portant « Undo … » : `app/editor-app.js`, `ui/character-builder/character-builder.js`, `app/workspaces/design.js` |

**Tests** — **nouveaux** : « la barre apparaît sous la sélection et disparaît à
la désélection », « la barre bascule au-dessus près du bord bas », « le toast
de suppression porte un bouton Annuler qui restaure ». Régénérer
`ux22-visual.spec.js-snapshots`.

### UI-03 — Sélection cohérente : clic, double-clic, fil d'Ariane

> **P0-2** et **P1-11.** Dépend de UI-01 (pour la cible des gestes).

| Fichiers |
| --- |
| `project/editor/svg-editor/svg-canvas.js` — handler de clic, `dblclick`, `api.resolveClickTarget` |
| `project/editor/ui/character-builder/character-builder.js` — fournir la résolution (`instanceRootOf` + pièces de la catégorie) |
| `project/editor/ui/artwork-scope.js` — fil d'Ariane de sélection, segments cliquables |
| `project/editor/shell/canvas-column.js` — `setArtworkScope` accepte des segments |
| `project/editor/index.html` — CSS `.artwork-scope` |

**Tests** — `ux45`, `ux25`, `ux46-face-layout`. **Nouveaux** : « un clic sur le
reflet d'un œil sélectionne les yeux », « un double-clic descend au reflet »,
« le fil d'Ariane nomme la chaîne et un clic remonte ».

### UI-04 — Le gizmo agit sur la partie

> **P0-3.** La PR la plus risquée : à fusionner seule, après UI-03.

| Fichiers |
| --- |
| `project/editor/svg-editor/svg-canvas.js` — `gizmoTarget()`, `gizmo.onCommit`, `nudge` |
| `project/editor/ui/character-builder/character-builder.js` — exposer `writeTransforms(writes)` |
| `project/editor/app/editor-app.js` — `nudgeSelection` passe par le builder dans `character` |

**Tests** — `ux25`, `ux38`, `ux40`, `ux45`, `ux46`, `core/tests/character-builder.test.js`.
**Nouveaux** : « glisser l'œil gauche avec la paire liée déplace les deux »,
« le drag et le champ X produisent la même transformation », « un geste = un pas
d'undo, même sur une paire ».

### UI-05 — Inspector contextuel

> **P1-5.** Indépendante de UI-01 à UI-04, mais meilleure après UI-02 (les
> actions y sont déjà dans le canvas).

| Fichiers |
| --- |
| `project/editor/ui/character-builder/part-inspector.js` — réordonner, rangée d'actions, `disclosureSection` pour *Plus* / *Avancé*, déplacer `saveForm` dans *Avancé*, prose en `title=` |
| `project/editor/index.html` — CSS `.part-actions` |

**Tests** — `core/tests/character-builder.test.js`, `core/tests/inspector-selection.test.js`,
`ux45`. Régénérer les captures visuelles.

### UI-06 — Bibliothèque visuelle

> **P1-3**, **P1-4**, **P2-5**, **P2-6**, **P2-10.** Indépendante.

| Fichiers |
| --- |
| `project/editor/ui/character-builder/part-browser.js` — grille, recherche, chips de slot, `☐ Tout afficher`, favoris/récents |
| `project/editor/ui/character-builder/preset-browser.js` — grille de tous les presets |
| `project/editor/ui/character-builder/type-browser.js`, `style-browser.js` — deviennent deux chips d'en-tête |
| `project/editor/ui/character-builder/character-model.js` — retirer `type`/`style`/`palette` de `CHARACTER_CATEGORIES` |
| `project/editor/core/face-library/compatibility.js` — `assetsFor({ …, query, allMorphologies })` |
| **nouveau** `project/editor/core/face-library/face-part-recents.js` |
| `project/editor/index.html` — CSS de la grille |

**Tests** — `core/tests/masc08b-visual-rows.test.js`, `masc08a-style-identity.test.js`,
`face-presets.test.js`, `ux45`, `ux46`. **Nouveaux** : « la recherche filtre sur
les tags », « Tout afficher révèle les dessins hors-genre avec leur badge »,
« les 22 presets sont listés ».

### UI-07 — Preview simplifié

> **P1-6**, **P2-12.** Indépendante.

| Fichiers |
| --- |
| `project/editor/ui/preview-panel.js` — chips de fond et de taille, `› Test avancé`, `⟲ Remettre au repos` |
| `project/editor/shell/inspector-host.js` — Preview en plein canvas |
| `project/editor/shell/topbar.js` — retirer `⟲`, déplacer `📱` dans `•••` |
| `project/editor/index.html` — CSS `[data-workspace=preview]`, fonds |

**Tests** — `ux08-preview-readiness`, `ux14-event-simulator`, `ux27-pose-chips`,
`ux21-accessibility`. **Nouveaux** : « le fond et la taille changent le rendu
sans toucher au document », « le simulateur est sous Test avancé ».

### UI-08 — Navigation : Avancé replié, mode Simple, atterrissage

> **P1-2**, **P1-9**, **P2-1**. Indépendante, mais elle touche le routeur : à
> fusionner seule.

| Fichiers |
| --- |
| `project/editor/ui/task-router.js` — `DEFAULT_MODE`, table de libellés Simple/Complet |
| `project/editor/shell/workspace-nav.js` — chevron `› Avancé`, libellés |
| `project/editor/shell/topbar.js` — bascule `Simple / Complet` dans `•••` |
| `project/editor/ui/workspace-state.js` — préférences `advancedOpen`, `uiMode` |
| `project/editor/app/services/project-service.js` — `loadTemplate` par défaut sur `design.face` |
| `project/editor/index.html` — CSS `.stage-steps` |

**Tests** — `core/tests/task-router.test.js`, `core/tests/uir00-baseline.test.js`,
`ux35-stages`, `ux03-home`, `ux02-foundation`, `ux23-legacy-removal`.
**Contrainte** : aucun id de route ni alias ne change. `uir00-baseline.test.js`
écrit les séparations comme assertions — il doit rester vert sans modification.

### UI-09 — Responsive et priorité au canvas

> **P2-2**, **P2-4**, **P2-8**, **P1-8**, **P2-13**, **P2-14**, **P2-15**.

| Fichiers |
| --- |
| `project/editor/shell/app-shell.js` — deux séparateurs redimensionnables |
| `project/editor/shell/bottom-dock.js` — extraire le séparateur en `ui/resizer.js` |
| **nouveau** `project/editor/ui/resizer.js` |
| `project/editor/shell/canvas-column.js` — *Zoom sur la sélection*, plein canvas partout |
| `project/editor/svg-editor/layers-panel.js` — `ID:` sous *Avancé* |
| `project/editor/ui/shortcuts.js`, `project/editor/svg-editor/gizmo-geometry.js` — `G R S P`, `]` / `[`, `Échap` désélectionne |
| `project/editor/index.html` — point de rupture 1000–1100 px |

**Tests** — `ux19-tablet`, `ux20-mobile`, `ux22-layout`, `ux21-accessibility`,
`ux44-editor-tools`.

### UI-10 — Polish visuel et assistant

> **P2-11**, **P3-1** à **P3-4**. À faire en dernier : la PR de jetons CSS
> régénère toutes les captures visuelles.

| Fichiers |
| --- |
| **nouveaux** `project/editor/styles/tokens.css`, `shell.css`, `panels.css`, `canvas.css` |
| `project/editor/index.html` — le CSS sort en `<link>` |
| `vite.config.js` — si nécessaire pour l'inline en build |
| **nouveau** `project/editor/ui/character-builder/create-wizard.js` |
| `project/editor/ui/home-surface.js`, `project/editor/app/editor-app.js` |
| `project/editor/ui/character-builder/character-model.js`, `visual-rows.js`, `project/editor/svg-editor/layers-panel.js` — jeu d'icônes |

**Tests** — `ux22-visual` (régénération complète), `ux03-home`, `ux45`.
**Nouveaux** : « l'assistant produit le même document que New Character + un
preset », « Passer au premier écran atterrit dans Design ▸ Visage ».

---

## C. Ordre de fusion et dépendances

```text
UI-01  Gestes de pièce ──┬── UI-02  Barre d'actions + toasts
                         │
                         └── UI-03  Clic / double-clic / fil d'Ariane
                                     │
                                     └── UI-04  Gizmo sur la partie

UI-05  Inspector          (indépendante ; meilleure après UI-02)
UI-06  Bibliothèque       (indépendante)
UI-07  Preview            (indépendante)
UI-08  Navigation         (indépendante ; à fusionner seule)
UI-09  Responsive         (après UI-02, pour la barre d'actions)
UI-10  Polish + assistant (en dernier)
```

**Chemin le plus court vers le gain maximal** : `UI-01` → `UI-02`. Deux PR, et
« créer et modifier une mascotte sans documentation » devient vrai pour
supprimer, dupliquer, remplacer, miroiter, ordonner et annuler.

---

## D. Barrières de qualité, par PR

| Avant de fusionner | Commande |
| --- | --- |
| Conflits, tests unitaires, build | `npm run verify` |
| Parcours critiques | `npm run test:e2e:critical` |
| Compatibilité navigateurs | `npm run test:e2e:smoke` |
| Suite étendue | `npm run test:e2e:extended` |
| Captures visuelles (UI-02, UI-05, UI-06, UI-07, UI-10) | `npm run test:e2e:visual` puis régénérer les instantanés dans le même commit |

**Règles qui ne se négocient pas** :

1. **Aucune capacité ne perd sa porte.** C'est le contrat de
   [UIR-00](../UIR_REFACTOR_BASELINE.md) : une PR qui laisse une ligne de la
   matrice sans route n'est pas finie. Les fonctions avancées se **cachent** ou
   se **déplacent**, jamais ne disparaissent.
2. **Aucun changement de `PROJECT_DOMAINS`.** Élargir un domaine fait
   redessiner des panneaux sans rapport ; le rétrécir les laisse périmés.
3. **Aucun id de route, alias ou panneau focusable ne change.** Les deep links,
   les *Fix* de validation et la palette les nomment.
4. **Un geste = un pas d'undo.** Vrai aujourd'hui ; à vérifier dans chaque PR
   qui touche au gizmo ou aux transformations.
5. **`ui/shortcuts.js` dit la vérité.** Ce qui est documenté est ce qui marche :
   toute garde de portée qui change met à jour le `scope` dans le même commit.
