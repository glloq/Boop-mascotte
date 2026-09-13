# 10 — Fichiers et plan de PR

## A. Les fichiers, par nature du changement

### Nouveaux — 14 fichiers

```text
project/editor/styles/tokens.css              jetons de couleur, typo, espace, rayon, ombre, durée
project/editor/styles/base.css                reset, typographie, focus
project/editor/styles/components.css          les six composants
project/editor/styles/layout.css              coque, rail, tiroir, colonnes
project/editor/styles/surfaces.css            le reste, migré par PR

project/editor/ui/icons.js                    ~28 pictogrammes SVG
project/editor/ui/vocabulary.js               libellés visibles des morphologies, slots, écrans
project/editor/ui/components/modal.js         <dialog> + tailles + pied + focus
project/editor/ui/components/drawer.js        tiroir bureau et mobile
project/editor/ui/components/tooltip.js       infobulle clavier et tactile
project/editor/ui/new-mascot/wizard.js        l'assistant en deux étapes
project/editor/ui/character-builder/rail.js   le rail de rangées
project/editor/ui/character-builder/row-groups.js   slot → groupe
project/editor/ui/svg-editor-modal/           le modal « Modifier le dessin » (4 fichiers)
project/editor/core/state/recent-projects.js  la liste des projets récents
```

### Modifiés en profondeur — 8

| Fichier | Ce qui change |
| --- | --- |
| `project/editor/index.html` | le `<style>` de 109 Ko devient 5 `<link>` |
| `ui/home-surface.js` | réécrit — héros, deux actions, projets récents |
| `ui/character-builder/part-browser.js` | remplacé par `rail.js` + le tiroir ; la logique de cartes est reprise |
| `ui/character-builder/part-inspector.js` | réordonné : actions en 2ᵉ position, prose en infobulles |
| `ui/character-builder/character-model.js` | `CHARACTER_CATEGORIES` perd `presets`, `type`, `style` |
| `shell/topbar.js` | `data-chrome`, boutons en `ghost`, `⚙` et `?` |
| `shell/app-shell.js` | la grille : rail 72 px, plus de dock de 190 px |
| `ui/task-router.js` | `DEFAULT_MODE = 'design.face'` (audit `P1-2`), route `new-mascot` |

### Modifiés légèrement — 12

```text
core/face-library/face-morphologies.js   libellés visibles ; defaultPreset 'beak' → 'owl'
core/face-library/face-part-model.js     + symmetry, + maxInstances (optionnels)
core/face-library/face-part-validation.js  les deux nouveaux champs
core/face-library/compatibility.js       assetsFor({ query, includeIncompatible, affinity })
ui/character-builder/visual-rows.js      regroupement + masquage des rangées vides
ui/character-builder/character-builder.js  l'assistant pose la morphologie ; editShape ouvre le modal
ui/character-builder/preset-browser.js   markup réutilisé par l'assistant
ui/character-builder/type-browser.js     markup réutilisé par l'assistant
ui/canvas-menu.js                        option `level` pour filtrer les entrées
shell/overlays.js                        toasts avec action (audit `P1-1`)
svg-editor/svg-canvas.js                 `setEditScope` piloté par le modal ; multi-sélection de points
app/editor-app.js                        montage du modal, du rail, de l'assistant
```

### Intacts — la garantie de §31

```text
core/state/*            ProjectDocument, editor-store, render-plan, project-snapshot
core/undo/history.js
core/commands/artwork-commands.js
core/path/*             path-nodes, path-controls, path-edit, path-topology, path-build
core/rig/*              tout
core/projection/pseudo-projector.js
core/export/*
runtime/*               les 29 fichiers
svg-editor/transform-gizmo.js · gizmo-geometry.js · selection-overlay.js
animation-editor/*
rig-editor/*
```

**Aucune PR de ce plan ne touche au modèle de projet, aux commandes, à
l'historique, au rig ni au runtime.** Les seuls fichiers `core/` modifiés sont
ceux de la bibliothèque de pièces, et les deux champs ajoutés sont optionnels.

---

## B. Le plan

| PR | Titre | Dépend de | Taille | Risque |
| --- | --- | --- | --- | --- |
| **01** | Design system et composants de base | — | L | faible |
| **02** | Nouvelle Home | 01 | M | faible |
| **03** | Assistant : Type puis Personnage | 01, 02 | M | moyen |
| **04** | Compatibilité : filtrage sur toutes les surfaces | 03 | M | moyen |
| **05** | Character Builder contextuel (rail + tiroir) | 01, 04 | **L** | **élevé** |
| **06** | Bibliothèque dynamique de pièces | 05 | M | moyen |
| **07** | Actions contextuelles de pièces | 05 | M | **élevé** |
| **08** | Modal SVG Editor — structure | 01, 07 | M | moyen |
| **09** | Modal SVG Editor — édition des points | 08 | M | moyen |
| **10** | Sécurité : undo, rig, validation, sauvegarde | 09 | S | **élevé** |

> **Ordre avec l'audit précédent.** `P0-1` (module de gestes) et `P0-2`
> (clic = la pièce) de [`AUDIT_UI_2026-09/06_PLAN_PR.md`](../AUDIT_UI_2026-09/06_PLAN_PR.md)
> sont des **prérequis de la PR 07**. Les faire avant est plus sûr que de les
> faire dedans : ils touchent le clavier et la sélection, qui sont couverts par
> huit spécifications de navigateur.

---

### UI-REDESIGN-01 — Design system et composants de base

| | |
| --- | --- |
| **Objectif** | Sortir le CSS de `index.html`, créer les jetons, redéfinir les boutons en quatre niveaux, créer modale, tiroir, infobulle, badge, état vide, toast. Aucun changement de comportement. |
| **Fichiers** | **nouveaux** `styles/{tokens,base,components,layout,surfaces}.css`, `ui/icons.js`, `ui/components/{modal,drawer,tooltip}.js` · `index.html` · `shell/topbar.js` · `shell/overlays.js` |
| **Réutilise** | la palette `--ux-*` existante comme point de départ ; `.drawer-scrim` et `.sheet-*` pour le tiroir ; `<dialog>` de `timeline-shell` comme référence |
| **Changements** | ① déplacer le `<style>` tel quel dans `surfaces.css` — zéro diff visuel ; ② écrire `tokens.css` ; ③ réécrire `button` en `.btn` + 4 niveaux + 3 tailles, et ajouter `.btn-secondary` à **tous** les boutons qui ne sont pas primaires (≈ 180 occurrences, mécanique) ; ④ topbar en `ghost` ; ⑤ `setStatus(msg, tone, { action })` |
| **Tests** | **nouveau** `core/tests/design-tokens.test.js` (aucune couleur littérale dans `components.css`/`layout.css` ; contraste AA de chaque paire texte/fond) · `ux22-visual.spec.js` **instantanés à régénérer** · `ux21-accessibility.spec.js` · `ux02-foundation.spec.js` |
| **Risques** | ① les instantanés visuels changent partout → les régénérer en un commit séparé et **relire chaque image** ; ② passer le corps de 11 px à 13 px fait déborder des panneaux → vérifier à 1280 et 1024 px, panneau par panneau ; ③ l'inversion du style de bouton rend *tout* secondaire par défaut : un bouton oublié devient gris, ce qui est le bon sens du risque |
| **Acceptation** | `npm run verify` passe · aucune couleur littérale dans `components.css` et `layout.css` · un seul bouton primaire par écran, vérifié écran par écran · `Delete` n'est plus rose sur bleu · chaque bouton icône a une infobulle qui apparaît au clavier |

---

### UI-REDESIGN-02 — Nouvelle Home

| | |
| --- | --- |
| **Objectif** | La page d'accueil de [02](02_HOME.md) : héros animé, deux actions, projets récents, topbar réduite. |
| **Fichiers** | `ui/home-surface.js` (réécrit) · **nouveau** `core/state/recent-projects.js` · `shell/topbar.js` (`data-chrome="home"`) · `app/services/project-service.js` (écrire une entrée récente à la sauvegarde) · `styles/layout.css` |
| **Réutilise** | `renderHomeRecovery` et son modèle à trois états · `exporter.js` pour la vignette · `presetThumbnail()` pour les exemples · `preview-service.js` pour l'animation du héros |
| **Changements** | ① héros + deux boutons ; ② `recent-projects.js` (≤ 12 entrées, vignette ≤ 8 Ko) ; ③ le brouillon local devient la 1ʳᵉ carte ; ④ trois exemples au premier lancement ; ⑤ CSS de masquage de la topbar ; ⑥ `Ouvrir un projet` devient un vrai bouton qui déclenche `#project-file` |
| **Tests** | `ux03-home.spec.js` (réécrit) · `core/tests/home-entry.test.js` · `core/tests/local-recovery.test.js` · **nouveau** `core/tests/recent-projects.test.js` (plafond, ordre, vignette trop grosse, `localStorage` plein) |
| **Risques** | ① le quota `localStorage` : une vignette par projet peut saturer → plafonner et **échouer silencieusement sans casser la sauvegarde** ; ② l'entrée récente ne peut pas rouvrir un fichier sans File System Access → la carte doit ouvrir le sélecteur, pas prétendre |
| **Acceptation** | au premier lancement : 0 état vide, 3 exemples cliquables · `Ouvrir un projet` ouvre le sélecteur en un clic · aucun mot parmi `rig`, `2.5D`, `Artwork`, `library`, `preset` sur l'écran · la topbar montre 2 boutons |

---

### UI-REDESIGN-03 — Assistant : Type puis Personnage

| | |
| --- | --- |
| **Objectif** | `+ Nouvelle mascotte` ouvre les deux écrans de [03](03_CREATION.md) §E. La morphologie est **posée** et non devinée. |
| **Fichiers** | **nouveau** `ui/new-mascot/wizard.js` (+ `step-type.js`, `step-character.js`) · `ui/task-router.js` (mode `new-mascot`) · `ui/character-builder/character-builder.js` (`setMorphology` public) · `core/face-library/face-morphologies.js` (libellés + `defaultPreset: 'owl'`) · `character-model.js` (retrait de 3 entrées) |
| **Réutilise** | `typeBrowserMarkup()` et `presetBrowserMarkup()` — le markup des cartes existe · `availableMorphologies()` · `presetsFor()` · `applyPreset` de `face-part-commands.js` · le canvas pour l'aperçu · `ring-keys.js` pour le clavier |
| **Changements** | ① l'assistant ; ② `Type` et `Presets` sortent de `CHARACTER_CATEGORIES` ; ③ `Style` devient conditionnel (`availableFaceStyles().filter(s => s.variants)`) ; ④ libellés Animal / Oiseau / Créature ; ⑤ `monster` **non affiché** tant qu'indisponible ; ⑥ un type indisponible n'est jamais une carte grisée |
| **Tests** | **nouveau** `core/tests/new-mascot-wizard.test.js` (étapes, retour, clavier, étape Style omise à 0 variante, `monster` absent) · `core/tests/masc01-morphology.test.js` (les **ids** restent `muzzle`/`beak`) · `core/tests/masc05-type.test.js` · `core/tests/character-model.test.js` · **nouveau** `tests/e2e/ux48-new-mascot.spec.js` · `ux45-character-builder.spec.js` |
| **Risques** | ① retirer `type` et `presets` de `CHARACTER_CATEGORIES` casse tout test qui les compte → `character-model.test.js` et `ux45` à mettre à jour ; ② le renommage `Muzzle → Animal` : vérifier qu'aucun test ne sélectionne par libellé anglais ; ③ l'aperçu en direct construit un document : bien le faire **hors** de l'historique tant que l'assistant n'est pas validé |
| **Acceptation** | deux clics entre la Home et une mascotte complète · aucun des mots `muzzle`, `beak`, `monster`, `morphology`, `preset` à l'écran · `Échap` revient d'une étape · les 22 modèles sont atteignables · `Oiseau` a une vignette (donc `defaultPreset` corrigé) |

---

### UI-REDESIGN-04 — Compatibilité : filtrage partout

| | |
| --- | --- |
| **Objectif** | Étendre `assetsFor` à la recherche, à l'affinité et au mode « tout afficher ». Brancher les cinq surfaces non filtrées. |
| **Fichiers** | `core/face-library/compatibility.js` · `core/face-library/face-part-model.js` (+ `symmetry`, `maxInstances`) · `face-part-validation.js` · `ui/character-builder/visual-rows.js` (masquage des rangées vides) · `ui/vocabulary.js` |
| **Réutilise** | `assetTags()`, `assetHasTag()`, `assetSupportsMorphology()`, `slotsFor()`, `wornPartSlot()` — tout existe |
| **Changements** | ① signature étendue, **rétro-compatible** ; ② `includeIncompatible` n'élargit jamais le slot ; ③ `affinity` **trie** et ne filtre pas ; ④ rangées à 0 dessin masquées si la mascotte n'en porte pas ; ⑤ deux champs de métadonnées optionnels ; ⑥ table de vocabulaire + test de garde |
| **Tests** | `core/tests/masc04-compatibility.test.js` · `masc07-filtering.test.js` · `masc02-part-metadata.test.js` · `masc08c-authoring-metadata.test.js` · **nouveaux** cas : recherche par tag, `includeIncompatible` respecte le slot, `affinity` ne retire rien, un asset sans `symmetry` se comporte comme aujourd'hui · **nouveau** `core/tests/vocabulary.test.js` |
| **Risques** | faible — la fonction est pure et ses appelants passent des objets nommés. Le seul vrai risque est d'oublier que `affinity` doit trier : un filtre accidentel cacherait des dessins |
| **Acceptation** | `assetsFor({})` renvoie exactement ce qu'il renvoyait · une recherche par tag trouve les 6 dessins `cat` · `includeIncompatible` sur *Yeux* ne renvoie aucun bec · aucun slot, catégorie ou morphologie n'est sans libellé visible |

---

### UI-REDESIGN-05 — Character Builder contextuel

| | |
| --- | --- |
| **Objectif** | La variante B de [06](06_BUILDER.md) : rail de 72 px, bibliothèque en tiroir, fil d'Ariane, dock de 190 px rendu au canvas. |
| **Fichiers** | **nouveaux** `ui/character-builder/rail.js`, `row-groups.js` · `part-browser.js` (démonté) · `shell/app-shell.js` · `shell/side-nav.js` · `shell/bottom-dock.js` · `ui/artwork-scope.js` (fil d'Ariane généralisé) · `styles/layout.css` · `ui/preview-panel.js` |
| **Réutilise** | `createComponent` et son modèle plat · `deriveVisualRows` et `slotOrder()` · le markup de cartes de `part-browser.js` · `drawer.js` de la PR 01 · `icons.js` |
| **Changements** | ① rail ; ② tiroir ; ③ groupes ; ④ fil d'Ariane cliquable ; ⑤ `grid-template-rows` sans le dock ; ⑥ `Tester` ouvre l'aperçu **en plein canvas** ; ⑦ la mascotte respire au repos |
| **Tests** | `ux45-character-builder.spec.js` (**réécrit**) · `ux22-layout.spec.js` · `ux19-tablet.spec.js` · `ux20-mobile.spec.js` · `core/tests/character-builder.test.js` · `masc08b-visual-rows.test.js` · `responsive-shell.test.js` · `panel-lifecycle.test.js` |
| **Risques** | **le plus élevé du plan.** ① `part-browser.js` est monté par `editor-app.js` et lu par `e2e-hooks.js` : le remplacer casse des sélecteurs dans une dizaine de spécifications ; ② retirer le dock déplace `#preview-panel`, référencé par `ux08` et `ux14` ; ③ la grille change pour **tous** les espaces de travail, pas seulement Design |
| **Atténuation** | livrer derrière un drapeau de session (`?ui=rail`) le temps de migrer les spécifications, puis inverser le défaut dans un commit séparé |
| **Acceptation** | canvas ≥ 66 % en largeur avec l'inspector, ≥ 90 % sans · rail ≤ 10 lignes pour chaque type · aucune rangée vide · le fil d'Ariane ramène à chaque étape de l'assistant · `npm run verify` et `verify:e2e` passent |

---

### UI-REDESIGN-06 — Bibliothèque dynamique de pièces

| | |
| --- | --- |
| **Objectif** | Le contenu du tiroir : grille de 96 px, vignettes de 80 px, recherche, recommandées, bascule *Compatibles*, aperçu au survol. |
| **Fichiers** | `ui/character-builder/rail.js` (corps du tiroir) · `styles/components.css` · `compatibility.js` (branchement) · `ui/character-builder/character-builder.js` (aperçu au survol) |
| **Réutilise** | `assetsFor({ query, affinity, includeIncompatible })` de la PR 04 · `presetThumbnail()` · `part-style` comme base de `.card--pick` · le rendu non destructif de `preview-service.js` |
| **Changements** | ① grille `auto-fill minmax(96px,1fr)` ; ② vignettes 80 px sur `--bp-thumb-bg` ; ③ champ de recherche ; ④ section *Recommandés* (≤ 4, seulement si un score > 0) ; ⑤ menu `Compatibles ▾` avec le `+N` ; ⑥ aperçu au survol **via le rendu de prévisualisation, jamais via `install()`** |
| **Tests** | `ux45` · `ux22-visual` (instantanés) · **nouveaux** : la recherche par tag, le `+N`, l'aperçu au survol n'ajoute **aucune** entrée d'historique, sortir du survol restaure exactement l'état |
| **Risques** | ① l'aperçu au survol par `install()` + `undo` remplirait la pile et ferait clignoter le rig — **interdit**, à couvrir par un test qui compte les entrées d'historique ; ② les vignettes sont des SVG en ligne : 150 cartes rendues d'un coup coûtent cher → ne rendre que le slot ouvert (c'est déjà le cas) |
| **Acceptation** | 11 yeux visibles sans défilement à 900 px de haut · la recherche `pointu` dans *Oreilles* d'un renard renvoie 3 dessins · survoler 14 cartes laisse `history.getState()` inchangé · la bascule revient à *Compatibles* en changeant de rangée |

---

### UI-REDESIGN-07 — Actions contextuelles de pièces

| | |
| --- | --- |
| **Objectif** | La rangée d'actions de l'inspector, le menu contextuel filtré, la barre flottante, et `Remplacer` qui ouvre le bon slot. |
| **Prérequis** | audit `P0-1` (module de gestes partagé) et `P0-2` (clic = la pièce) |
| **Fichiers** | `ui/character-builder/part-inspector.js` · `ui/canvas-menu.js` (option `level`) · `app/editor-app.js` (`CANVAS_MENU_WORKSPACES` + `'character'`) · `ui/selection-actions.js` (de l'audit `P0-4`) · `character-builder.js` (`replace()`) |
| **Réutilise** | les 14 actions de `canvas-menu.js` · `wornPartSlot()` · `facePartCommands.remove()` · `place()` de `canvas-menu.js` pour positionner la barre flottante |
| **Changements** | ① actions en 2ᵉ position ; ② prose → infobulles ; ③ `Remplacer` ouvre le tiroir sur le slot ; ④ `Retirer` **toujours présent** (contre `removable: category.multiple` aujourd'hui) ; ⑤ menu filtré dans Face ; ⑥ `Retirer` vs `Supprimer` selon l'origine ; ⑦ toast avec `[Annuler]` |
| **Tests** | `ux31-canvas-menu.spec.js` · `ux45` · `ux25-canvas-editing.spec.js` · `core/tests/character-builder.test.js` · `inspector-selection.test.js` · **nouveaux** : retirer une tête, des yeux, un nez, une bouche (les 9 catégories aujourd'hui impossibles) ; `Remplacer` sur un bec ouvre *Bec* et pas la bibliothèque entière |
| **Risques** | **élevé** — un `Suppr` qui atteint la mauvaise cible détruit du travail. Le module de gestes doit distinguer la pièce de bibliothèque (`facePartCommands.remove(partId)`) de l'élément dessiné (`canvas.delete(id)`) : les deux n'ont pas le même effet sur le rig |
| **Acceptation** | les 11 catégories sont retirables · un retrait est annulable en un geste depuis le toast · `Remplacer` sur un bec n'ouvre jamais autre chose que *Bec* · le menu de Face ne contient plus `Assign`, `Edit points`, `Add a pin`, `Convert to a path` |

---

### UI-REDESIGN-08 — Modal SVG Editor : structure

| | |
| --- | --- |
| **Objectif** | Le cadre de [08](08_SVG_EDITOR.md) : modale, 4 outils, bascule *Pièce seule / Contexte*, pied `Annuler / Réinitialiser / Appliquer`, transaction ouverte. **Sans** l'édition des points. |
| **Fichiers** | **nouveau** `ui/svg-editor-modal/{modal.js,toolbar.js,view-toggle.js,footer.js}` · `character-builder.js` (`editShape` ouvre le modal) · `svg-canvas.js` (exposer le cadrage et le mode de vue) · `styles/components.css` |
| **Réutilise** | `modal.js` de la PR 01 · `setEditScope()` et `[data-editor-scope]` · `createDrawTools()` · `transform-gizmo` · `history.beginTransaction/commitTransaction` · `elementKind()` |
| **Changements** | ① le modal ; ② barre à 4 outils ; ③ `.svg-modal[data-view=alone] [data-editor-scope=out]{display:none}` — une règle ; ④ cadrage sur la `referenceBox` ; ⑤ transaction ouverte à l'entrée, `commit` à *Appliquer*, `commit + undo` à *Annuler* ; ⑥ *Réinitialiser* restaure l'instantané d'ouverture |
| **Tests** | **nouveaux** `core/tests/svg-editor-modal.test.js` (transaction, une seule étape d'undo, *Réinitialiser* ne ferme pas, ouverture refusée si une transaction est déjà ouverte) · **nouveau** `tests/e2e/ux49-svg-modal.spec.js` · `core/tests/history.test.js` |
| **Risques** | ① ouvrir pendant une transaction en cours ferait perdre l'étape — **refuser l'ouverture** et le tester ; ② un `Échap` avec des modifications doit demander confirmation, pas fermer ; ③ le modal doit rendre le focus à la pièce en se fermant |
| **Acceptation** | ouvrir, bouger la pièce, `Appliquer` → **une** entrée d'historique · `Annuler` → le document est identique octet pour octet · `Réinitialiser` remet l'état d'ouverture, modal ouvert · *Contexte* est le mode par défaut · le canvas ne montre que la pièce en *Pièce seule* |

---

### UI-REDESIGN-09 — Modal SVG Editor : édition des points

| | |
| --- | --- |
| **Objectif** | L'outil Points : déplacer, multi-sélectionner, ajouter, supprimer, courber, basculer anguleux/lisse. |
| **Fichiers** | `ui/svg-editor-modal/node-tool.js` (**nouveau**) · `svg-canvas.js` (multi-sélection de points) · `core/path/path-controls.js` (inchangé) · `styles/components.css` (poignées) |
| **Réutilise** | `pathNodes()`, `pathControls()`, `movePathControl()`, `smoothNode()`, `convertNode()`, `insertPathNode()`, `deletePathNode()`, `nearestPathPoint()`, et surtout `commands.editPath()` — **tout est écrit** |
| **Changements** | ① la multi-sélection de points (`Maj`+clic, rectangle) et sa translation commune — **le seul vrai ajout** ; ② le rendu des poignées aux jetons, non mis à l'échelle par le zoom ; ③ les gestes de [08](08_SVG_EDITOR.md) §D ; ④ cibles de 14 px sur `pointer:coarse` |
| **Tests** | `core/tests/path-nodes.test.js` · `path-controls.test.js` · `path-edit.test.js` · `ux30-drawing-tools.spec.js` · `ux39-drawing-tools-complete.spec.js` · **nouveaux** : translation d'une multi-sélection, `Alt` casse la symétrie de poignée, double-clic bascule anguleux/lisse |
| **Risques** | ① la multi-sélection touche `svg-canvas.js`, déjà dense, et son `nodeEdit` ; ② les poignées non mises à l'échelle demandent une conversion écran↔artwork à chaque redessin — `gizmo-geometry.js` a déjà ce calcul, le réutiliser plutôt que le réécrire |
| **Acceptation** | déplacer 4 points d'un coup est **une** entrée d'historique · ajouter un point sur une bouche avec 3 shape keys les conserve, et le modal le dit · les poignées font 8 px à 100 % comme à 400 % |

---

### UI-REDESIGN-10 — Sécurité : undo, rig, validation, sauvegarde

| | |
| --- | --- |
| **Objectif** | Fermer §18 : chaque refus de `migrateElementTopology` est montré dans le modal ; la validation tourne avant `Appliquer` ; aucun chemin ne perd silencieusement une pose. |
| **Fichiers** | `ui/svg-editor-modal/footer.js` · `core/path/path-topology.js` (messages seulement) · `core/validation/validate-project.js` (portée à un élément) · `core/validation/issue-guidance.js` |
| **Réutilise** | `migrateElementTopology` et ses cinq refus nommés · `validateProject` · `describeMigration` |
| **Changements** | ① les refus s'affichent **dans le pied, de façon persistante**, avec le nom de la pose concernée ; ② `Appliquer` lance une validation limitée à la pièce et montre toute erreur **nouvelle** ; ③ option explicite `Supprimer quand même et perdre « Sourire »`, jamais par défaut ; ④ le compte-rendu `« 3 poses conservées »` est visible après l'application |
| **Tests** | `core/tests/path-edit.test.js` · **nouveaux** : supprimer un point d'une forme portant une shape key est refusé et nomme la pose ; l'accepter explicitement retire la pose **et** laisse le projet valide ; `Appliquer` sur une pièce qui casse un rôle est bloqué ; une pose de calibration non portable est abandonnée sans bloquer |
| **Risques** | **élevé par nature** — c'est la PR qui décide de ce qu'on perd. Deux règles : jamais de perte sans nom ; jamais de perte par défaut |
| **Acceptation** | aucun chemin ne perd une shape key sans confirmation nommée · `Appliquer` sur un projet valide le laisse valide · la matrice des cinq refus de `path-topology.js` est couverte · `npm run verify` et `verify:e2e` passent |

---

## C. Ce qui reste hors périmètre

| Sujet | Pourquoi | Quand |
| --- | --- | --- |
| **Créer une pièce dans le modal** (§20) | demande un formulaire de métadonnées, pas un canvas | `UI-REDESIGN-11`, après 09 |
| **Importer un SVG pour une pièce** (§21) | le préfixage des ids est le point délicat | `UI-REDESIGN-12` |
| **Palettes recommandées** (§26) | un modèle de palettes nommées à écrire | `UI-REDESIGN-13` |
| **Mode Simple / Complet** | audit `P2-1` | selon le plan de l'audit |
| **Refonte de Rig, Animate, Behavior** | hors sujet : l'étude porte sur l'entrée et sur Design | — |
| **Dessiner les cornes, les pupilles, les paupières** | du travail d'illustration, pas de code — et ce qui débloquerait `Créature` | continu |
| **Variantes de style** | 0 aujourd'hui ; le mécanisme est complet et attend des dessins | continu |

---

## D. Ordre de mise en production conseillé

```text
01 ──► 02 ──► 03 ──► 04 ──┐
                          ├──► 05 ──► 06 ──► 07 ──► 08 ──► 09 ──► 10
     audit P0-1, P0-2 ────┘
```

**Deux jalons livrables séparément :**

- après **04**, le parcours d'entrée est réparé : la Home est claire, le type est
  demandé, les 150 dessins et les 22 modèles sont atteignables. **C'est là que
  se trouve la majeure partie du gain**, et cela ne touche ni le canvas ni le
  rig.
- après **10**, le mini-éditeur est complet.

Si le temps manque, s'arrêter après 04 est un état cohérent et livrable ; entre
05 et 09, ne pas s'arrêter (le rail sans sa bibliothèque, ou le modal sans son
outil Points, sont des états à moitié faits).
