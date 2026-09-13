# 00 — Synthèse

## Ce que l'audit a trouvé

L'éditeur est organisé en quatre espaces de travail (Design · Rig · Animate ·
Behavior) avec treize écrans, et cette organisation est **bonne** : chaque espace
répond à une question que l'auteur se pose vraiment, et [UIR-01](../UIR_REFACTOR_BASELINE.md)
a déjà fait le travail de découpage. L'audit ne propose pas de la refaire.

Le problème est ailleurs, et il est net.

**Design ▸ Face** — le « Character Builder », la surface explicitement conçue
pour la personne qui ne connaît rien au rigging — est la seule surface
d'édition de l'éditeur **à laquelle on a retiré les gestes d'édition**. Ce n'est
pas une omission par oubli : c'est écrit dans le code comme une décision
(`docs/CHARACTER_BUILDER.md` : « draws, deletes and copies nothing: those stay
with the vector tools »). Mais du point de vue de l'utilisateur, la décision
produit une surface où :

| Geste | Design ▸ Face | Design ▸ Artwork |
| --- | --- | --- |
| Sélectionner au canvas | ✅ | ✅ |
| Déplacer / tourner / redimensionner (gizmo) | ✅ | ✅ |
| Flèches pour déplacer | ✅ | ✅ |
| **Touche Suppr** | ❌ | ✅ |
| **Clic droit → menu** | ❌ | ✅ |
| **Ctrl+D dupliquer** | ❌ | ✅ |
| **Ctrl+C / Ctrl+V** | ❌ | ✅ |
| **Ctrl+A / Ctrl+G** | ❌ | ✅ |
| **Liste des calques (ordre, masquer, verrouiller)** | ❌ | ✅ |
| **Aligner / distribuer** | ❌ | ✅ |
| **Multi-sélection au lasso** | ✅ (mais gizmo désactivé) | ✅ |

Références : `project/editor/app/editor-app.js:794` (bloc `character` : nudge +
gizmo seulement) contre `:799` (bloc `create` : tout le reste),
`editor-app.js:251` (`CANVAS_MENU_WORKSPACES = new Set(['create', 'rig'])`),
`project/editor/index.html:294` (`[data-workspace=character] .structure-tools{display:none}`).

La conséquence est que le débutant a deux choix : apprendre l'éditeur vectoriel
(neuf outils, une barre d'options, un arbre de calques) pour supprimer un œil,
ou ne pas supprimer l'œil.

## Les dix problèmes qui comptent

| # | Problème | Priorité |
| --- | --- | --- |
| 1 | **Suppr ne fait rien dans Design ▸ Face.** Le seul « retirer » est un bouton *Remove* dans l'inspector, et il n'apparaît que pour les catégories multiples (`character-model.js:122` : `removable: Boolean(category.multiple)`) — donc jamais pour une tête, des yeux, une bouche, un nez, des cheveux. | **P0** |
| 2 | **Pas de clic droit dans Design ▸ Face.** Le menu contextuel du canvas existe, est bon (14 actions), et est refusé sur la surface simple. | **P0** |
| 3 | **Aucun ordre d'affichage accessible depuis Face.** Le panneau Structure est masqué en CSS ; mettre les lunettes devant les cheveux impose de passer par Artwork. | **P0** |
| 4 | **Le clic canvas sélectionne la forme la plus profonde.** Cliquer un œil sélectionne `glintLeft` (« Left eye glint »). Pas de « clic = la pièce, double-clic = dedans ». `svg-canvas.js:1090` (`element.on('click')` + `stopPropagation`). | **P0** |
| 5 | **Le gizmo et les champs de l'inspector n'agissent pas sur la même chose.** Les champs écrivent sur `instanceRootOf(...)` et miroitent la paire (`character-builder.js:382`) ; le gizmo écrit sur `selectedId` et ne miroite rien (`svg-canvas.js:921`). Glisser l'œil gauche ≠ taper X dans l'œil gauche. | **P0** |
| 6 | **Aucun toast n'a de bouton.** `setStatus` écrit du `textContent` (`shell/overlays.js`). Quinze messages disent « Undo puts it back » sans offrir *Annuler*. | **P1** |
| 7 | **Le premier écran après « Mascot Face » est l'éditeur vectoriel.** `DEFAULT_MODE = 'design.artwork'` (`task-router.js:156`). Neuf outils de dessin en face d'une personne qui voulait une mascotte. | **P1** |
| 8 | **L'architecture interne fuit dans l'UI.** `ID: eyeLeft` sous chaque calque sélectionné (`layers-panel.js`), « Semantic part "x": role "y" references missing element "z" » dans Project check (`rig-validator.js:75`), « Goes on as accessory — what the rig knows it by » dans le formulaire de sauvegarde, quatre lignes de méta (*Presets · Type · Style · Colours*) avant la première partie du visage. | **P1** |
| 9 | **Preview ne fait pas ce qu'on attend d'un preview.** Pas de fond (blanc / sombre / damier / transparent), pas de taille d'affichage, mais huit sections dont un simulateur d'événements et un journal. | **P1** |
| 10 | **Le canvas a 52 % de l'écran à 1280 px** (`300px` + `310px` de panneaux fixes) et perd la priorité dès qu'on ouvre quelque chose. | **P2** |

## La cible

Une seule règle, appliquée partout :

> **Ce qu'on fait à une pièce se fait sur la pièce.**
> La sélection est visible, les six gestes essentiels sont à portée de main
> (déplacer, redimensionner, tourner, dupliquer, remplacer, supprimer), et tout
> le reste est derrière *Avancé*.

Concrètement, six changements portent 80 % du gain :

1. **Un module de gestes partagé** (`ui/piece-actions.js`) appelé par Face,
   Artwork et Rig : Suppr, Ctrl+D, Ctrl+C/V, clic droit, ordre, miroir, verrou.
   C'est du *déplacement* de code, pas de l'écriture.
2. **Une barre d'actions flottante sous la sélection** au canvas — six boutons,
   les mêmes six partout.
3. **Un clic = la pièce, un double-clic = dedans**, avec un fil d'Ariane qui dit
   où on est.
4. **Des toasts avec un bouton *Annuler***, et plus aucune confirmation modale
   pour une action annulable.
5. **Une bibliothèque en grille de vignettes**, filtrée automatiquement par
   compatibilité, avec *Tout afficher* comme échappatoire.
6. **Un Preview nu** : la mascotte, quatre fonds, trois tailles, les expressions
   et les mouvements. Le simulateur et le journal passent sous *Test avancé*.

Aucun de ces six ne demande de toucher au store, au rig, au runtime ou aux
commandes. Le détail est dans [06_PLAN_PR.md](06_PLAN_PR.md).

## Ce que l'audit ne recommande pas

- **Ne pas refaire la navigation en quatre espaces.** Elle est juste. Ce qui
  manque est un mode *Simple* qui n'affiche que Design et Preview, pas une
  cinquième réorganisation.
- **Ne pas supprimer Artwork, Deform, Timeline ou States.** Les déplacer sous
  *Avancé* dans leur propre espace suffit.
- **Ne pas fusionner le Character Builder et Artwork.** Deux surfaces sur un
  document, c'est le bon modèle ; le problème est que l'une a été privée des
  gestes de l'autre.
- **Ne pas introduire de second store, de second undo ou de second canvas.**
