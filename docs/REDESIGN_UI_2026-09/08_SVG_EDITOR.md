# 08 — Le modal « Modifier le dessin »

## A. Ce qui existe déjà — et qui change tout

La demande §14 à §18 décrit un outil neuf. **Le moteur est écrit, testé, et déjà
appelé.** Ce qui manque est un cadre.

| Besoin | Déjà présent | Où |
| --- | --- | --- |
| Ouvrir une pièce seule à l'édition | `✎ Edit Shape` dans l'inspector | `part-inspector.js:124` → `character-builder.js:837` |
| Isoler la pièce, estomper le reste | `setEditScope(id)` + `[data-editor-scope=out]{opacity:.22;pointer-events:none}` | `svg-canvas.js:1645` |
| Déplacer un point | `pathNodes()` + outil Node | `core/path/path-nodes.js` |
| Poignées de Bézier, lisser / casser | `pathControls()`, `movePathControl()`, `smoothNode()`, `convertNode()` | `core/path/path-controls.js` |
| Ajouter / supprimer un point | `insertPathNode()`, `deletePathNode()` | `core/path/path-edit.js` |
| **Ne rien casser en changeant la topologie** | `migrateElementTopology()` : remappage linéaire de `restPath`, des morphs, des shape keys et des poses de calibration | `core/path/path-topology.js:47` |
| Dessiner (plume, ligne, rect, ellipse, polygone, texte) | `createDrawTools()` | `svg-editor/draw-tools.js` |
| Déplacer / tourner / redimensionner, pivot | `transform-gizmo.js` + `gizmo-geometry.js` | |
| Une étape d'undo pour un geste composé | `beginTransaction()` / `commitTransaction()` | `core/undo/history.js:30` |
| Assainir un SVG importé | `sanitizeSvg()` | `core/security/sanitize-svg.js` |

Et le message que l'éditeur affiche déjà après un ajout de point :

```text
Point added, and 3 shape keys came with it.
```

> **La partie difficile de §17 et §18 est faite.** Le travail restant est de
> l'interface : un cadre, trois boutons, et une barre d'outils réduite.

### Ce qui manque vraiment

| # | Manque | Conséquence |
| --- | --- | --- |
| **S1** | `Edit Shape` **quitte** le Character Builder pour `design.artwork` | le débutant se retrouve devant neuf outils de dessin, un arbre de calques et une barre d'options |
| **S2** | Aucun cadre `Annuler / Réinitialiser / Appliquer` | on ne sait pas quand on a fini, ni comment revenir en arrière autrement qu'en `Ctrl+Z` répétés |
| **S3** | Aucune bascule `Pièce seule / Contexte` | le contexte est toujours là, à 22 % — impossible de juger un contour seul |
| **S4** | `Edit Shape` n'est visible **que** dans l'inspector | pas au clic droit, pas au double-clic, pas sur la sélection |
| **S5** | La barre d'outils est celle d'Artwork : 9 outils | pour modifier une bouche, 3 suffisent |

---

## B. L'architecture du modal

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ✎ Modifier le dessin — Bouche                                       ✕   │  56
├──────┬───────────────────────────────────────────────────────────────────┤
│      │  ┌─────────────────────────────────────────────────────────────┐  │
│  ▶   │  │                                                             │  │
│ Sél. │  │                                                             │  │
│      │  │                      ╭─────────╮                            │  │
│  ⌁   │  │                     ╱     ●     ╲        ● = point          │  │
│ Pts  │  │                    ●───────────── ●      ○ = poignée        │  │
│      │  │                     ╲           ╱                           │  │
│  ✎   │  │                      ╰────●────╯                            │  │
│ Plume│  │                                                             │  │
│      │  │                                                             │  │
│  ▭   │  │                                                             │  │
│Forme │  └─────────────────────────────────────────────────────────────┘  │
│      │   [ Pièce seule │ Contexte ]          ⊖ ──●── ⊕  100 %   [Ajuster]│
│ ──── │                                                                   │
│  ■   │   Remplissage ▣  Contour ▣  Épaisseur [ 2 ]   ⇄ ⇅   ⊢⊣            │
│  Fond│                                                                   │
├──────┴───────────────────────────────────────────────────────────────────┤
│  Annuler                          ↶ ↷        Réinitialiser    Appliquer  │  64
└──────────────────────────────────────────────────────────────────────────┘
```

| Zone | Valeur |
| --- | --- |
| Taille | `min(1280px, 92vw) × 88vh` — la taille `full` du composant modale |
| Barre d'outils | **verticale, 64 px**, à gauche, groupée : 4 outils, un séparateur, la peinture |
| Canvas | tout le reste ; la pièce cadrée à ~70 % de la hauteur |
| Sous le canvas | la bascule de vue, le zoom, `Ajuster` |
| Sous cela | les options de l'outil courant — **une seule rangée**, contextuelle |
| Pied | `Annuler` (ghost, gauche) · `↶ ↷` (ghost, centre) · `Réinitialiser` (secondary) · `Appliquer` (primary) |

### Ce que le canvas montre

**Uniquement la pièce**, cadrée sur sa `referenceBox` (`face-part-model.js`) ou
sur sa boîte englobante. Pas la mascotte, pas la grille de l'artboard, pas les
calques.

Fond : un damier léger (`--bp-thumb-bg` / blanc à 4 %), pour qu'un trait clair
comme un trait sombre reste lisible — c'est le seul endroit de l'application où
un damier a un sens.

---

## C. Les outils retenus

La demande §16 en liste dix-huit. **Onze sont retenus, sept écartés**, et chaque
écart a une raison.

### Retenus

| Outil | Pourquoi | Coût |
| --- | --- | --- |
| **Sélection** | prendre une forme du dessin (une bouche a des lèvres, des dents, une langue) | existe |
| **Points** (Node) | le cœur de l'outil : bouger, ajouter, supprimer un point, tirer une poignée | existe |
| **Plume** | ajouter une forme (une dent, une ride) | existe |
| **Formes** : rectangle, ellipse, ligne | les trois qui servent vraiment | existe |
| **Remplissage** | | existe (inspector) |
| **Contour** + **épaisseur** | | existe |
| **Miroir horizontal / vertical** | un geste de mascotte par excellence | existe (`canvas-menu`) |
| **Déplacer / redimensionner / tourner** | par le **gizmo**, pas par trois boutons de barre d'outils | existe |
| **Annuler / Rétablir** | dans le pied du modal, sur l'historique du modal | existe |
| **Ajuster à la vue** | | trivial |

### Écartés

| Outil | Pourquoi |
| --- | --- |
| **Move / Scale / Rotate en outils séparés** | le gizmo fait les trois d'un seul geste ; trois boutons de plus seraient trois modes à comprendre pour zéro capacité |
| **Polygone / étoile** | présent dans `draw-tools`, mais sans usage pour une pièce de visage |
| **Texte** | un texte dans une pièce de mascotte pose un problème de police à l'export ; à laisser à Artwork |
| **Alignement / distribution** | utile pour une mise en page, pas pour une bouche |
| **Courbe de Bézier libre au-delà d'un point** | le mode Points couvre le besoin ; une plume complète est l'outil d'Illustrator |

> **Le critère appliqué** (§16 : « éviter tout outil qui n'apporte pas une forte
> valeur ») : un outil reste s'il répond à une intention qu'un auteur de mascotte
> formule vraiment — « cette bouche est trop fine », « cet œil est trop rond »,
> « je veux une dent ». Pas s'il existe dans un logiciel vectoriel.

### Quatre outils, pas onze, dans la barre

Les onze retenus tiennent en **quatre boutons** :

```text
▶  Sélection     prendre une forme, la déplacer, la tourner, la redimensionner (gizmo)
⌁  Points        bouger, ajouter, supprimer, courber
✎  Plume         ajouter une forme
▭  Formes        rectangle · ellipse · ligne   (menu déroulant sur le bouton)
───
■  Peinture      remplissage, contour, épaisseur, miroir   (rangée d'options)
```

C'est le point qui empêche de « devenir un logiciel graphique complexe ».

---

## D. L'édition des points (demande §17)

### Les gestes

| Geste | Effet | Existe |
| --- | --- | --- |
| Glisser un point | le déplace | ✅ |
| `Maj` + clic | ajoute à la sélection | ⚠ à ajouter (multi-points) |
| Rectangle de sélection | sélectionne plusieurs points | ⚠ à ajouter |
| Glisser une poignée | courbe le segment | ✅ `movePathControl` |
| `Alt` + glisser une poignée | casse la symétrie de la poignée | ✅ (option `mirror`) |
| Double-clic sur un segment | ajoute un point | ✅ `insertPathNode` |
| `Suppr` sur un point | le supprime | ✅ `deletePathNode` |
| Double-clic sur un point | bascule anguleux ↔ lisse | ✅ `convertNode` |
| `Échap` | quitte le mode Points | ✅ |
| Flèches | déplace la sélection de 1 unité (`Maj` : 10) | ✅ |

**Deux ajouts seulement** : la multi-sélection de points et sa translation
commune. Tout le reste est du branchement.

### Le rendu des poignées

| Élément | Apparence |
| --- | --- |
| Point anguleux | carré 8 px, fond `--bp-surface`, bord `--bp-accent` |
| Point lisse | cercle 8 px, mêmes couleurs |
| Point sélectionné | rempli `--bp-accent` |
| Poignée de Bézier | cercle creux 6 px, relié par un trait 1 px `--bp-accent-ring` à 60 % |
| Taille sur tactile | 14 px / 10 px |

Les poignées **ne suivent pas le zoom** : à 400 %, un point reste de 8 px à
l'écran, sinon il devient impossible à saisir.

---

## E. Isolé ou en contexte (demande §19)

```text
[ Pièce seule │ Contexte ]
```

| Mode | Rendu | Mécanisme |
| --- | --- | --- |
| **Pièce seule** | la pièce sur le damier, cadrée, seule | `data-editor-scope=out` → `display:none` |
| **Contexte** | la mascotte entière, tout sauf la pièce à 22 % et inerte | **exactement le comportement actuel**, sans une ligne de code |

Le mécanisme est donc : une règle CSS de plus.

```css
.svg-modal[data-view=alone] [data-editor-scope=out]{display:none}
/* le mode contexte est la règle existante, inchangée */
```

| Décision | Choix | Pourquoi |
| --- | --- | --- |
| Mode par défaut | **Contexte** | une bouche se juge sur un visage ; ouvrir en « seule » fait perdre les proportions, ce que §19 identifie précisément |
| Cadrage | conservé entre les deux modes | basculer ne doit pas faire sauter la vue |
| Mémoire | la session | l'auteur qui préfère « seule » ne le redit pas à chaque pièce |
| Le contexte est-il éditable ? | **non**, `pointer-events:none` | c'est ce qui fait la différence avec Artwork |

---

## F. Sécurité de l'édition (demande §18)

### Les trois boutons, et ce qu'ils font vraiment

```text
Annuler          ferme sans rien écrire dans le projet
Réinitialiser    remet la pièce dans l'état où le modal l'a trouvée, modal ouvert
Appliquer        écrit, en UNE étape d'undo de projet, et ferme
```

### Le modèle retenu : « édition en place, transaction ouverte »

Deux modèles possibles. Le second est retenu.

| | Modèle « bac à sable » | Modèle « transaction » ✅ |
| --- | --- | --- |
| Principe | copier la pièce dans un document séparé, éditer, fusionner à l'Appliquer | ouvrir une transaction d'historique, éditer le vrai document, valider ou dérouler |
| Aperçu en contexte | **impossible** sans un second rendu | gratuit — c'est le canvas |
| Risque de divergence | élevé : deux documents, un merge à écrire | nul |
| Undo pendant l'édition | à réimplémenter | celui du projet, borné par la transaction |
| Code neuf | un moteur de fusion | **zéro** |
| `Appliquer` | fusion, ré-résolution des ids | `commitTransaction()` |
| `Annuler` | jeter la copie | `history.undo()` une fois |

```js
// à l'ouverture
const opened = history.beginTransaction();   // tout ce qui suit sera une étape
const before = structuredClone(doc().elements[id]);   // pour Réinitialiser

// Appliquer
history.commitTransaction();                 // une seule étape dans la pile

// Annuler
history.commitTransaction();
history.undo();                              // la transaction entière repart
```

**`beginTransaction()` prend un instantané avant d'ouvrir** (`history.js:31`),
donc un `undo` après `commit` défait exactement l'ensemble du travail du modal.
C'est le comportement demandé par §18 (« créer une étape Undo au niveau du
projet »), et il est déjà garanti par le code existant.

> **Une contrainte à respecter absolument** : pendant que la transaction est
> ouverte, `snapshot()` ne fait rien. Il est donc **interdit** d'ouvrir un modal
> pendant qu'une autre transaction est en cours (un glissement de gizmo, un
> restyle). Le modal refuse de s'ouvrir dans ce cas, et l'ouverture est de toute
> façon impossible pendant un glissement.

### Ce que « Appliquer » doit préserver, point par point

| Élément | Risque | Ce qui le protège |
| --- | --- | --- |
| **IDs SVG** | un id perdu orpheline un rôle sémantique, une liaison, un pin, une piste de timeline | l'édition **ne recrée jamais** d'élément : `movePathNode` et `editPath` écrivent l'attribut `d` d'un nœud existant. Un ajout de forme par la plume crée un id neuf, ce qui n'invalide rien |
| **Ancres et points de montage** | `mountPoint` est résolu **une fois** à l'installation | un `d` modifié ne le rouvre pas ; la pièce ne bouge pas |
| **Liaisons (bindings)** | référencent `{ element, property }` | inchangées : aucune propriété n'est renommée |
| **Pivots** | `transform-origin` sur l'élément | **à surveiller** : redimensionner une forme au gizmo écrit une transformation, pas la géométrie ; le pivot suit. Un point déplacé au mode Points n'y touche pas |
| **Rig sémantique** | `part.roles: { leftEye: 'eyeLeft' }` → des ids | intact tant que les ids le sont |
| **Poses de calibration** | des chemins capturés, mesurés sur l'ancienne topologie | `migrateElementTopology` les remappe, et **abandonne celles qu'il ne peut pas porter** plutôt que de bloquer (`path-topology.js:93`) |
| **Shape keys** | des deltas par point contre `restPath` — un point de plus et tout casse | `remapValues(edit, delta)` les porte. Si un delta ne correspond plus, l'édition est **refusée** avec un message nommant la pose |
| **Morphs** | deux chemins entiers | remappés tous les deux |
| **`restPath`** | l'outline de référence des poses | remappé sous la forme posée |
| **Animations existantes** | les clips pilotent des **paramètres**, pas des chemins | non concernées, sauf via les shape keys, déjà couvertes |
| **Export** | `mascot.svg` est ré-assaini à l'export | non concerné |

### Les deux refus, et leur formulation

`migrateElementTopology` refuse dans deux cas. Ses messages actuels sont déjà
bons ; ils doivent apparaître **dans le modal**, à côté du bouton `Appliquer`,
et non dans un toast fugace :

```text
⚠ « Sourire » ne correspond plus à ce contour.
   Ce point ne peut pas être supprimé sans perdre cette expression.
   [ Supprimer quand même et perdre « Sourire » ]  [ Garder le point ]
```

La deuxième action est l'existante ; la première est un ajout **facultatif**, à
ne faire qu'avec une confirmation explicite nommant la pose perdue.

### Le garde-fou de dernier recours

`Appliquer` exécute, avant le `commit`, la validation existante
(`core/validation/validate-project.js`) limitée à la pièce. Si une erreur
**nouvelle** apparaît — un rôle orphelin, un chemin illisible — le modal la
montre et propose `Réinitialiser`, au lieu de valider en silence.

---

## G. La découvrabilité (demande §22)

Quatre portes, une destination :

| Porte | Libellé | Contexte |
| --- | --- | --- |
| Rangée d'actions de l'inspector | `✎ Modifier le dessin` | 3ᵉ des quatre actions |
| Menu contextuel | `Modifier le dessin` | 3ᵉ ligne, avant le séparateur |
| Barre flottante sous la sélection | `✎` | 3ᵉ des cinq icônes |
| Double-clic sur une pièce **déjà sélectionnée** | — | le geste que tout le monde essaie |

Le double-clic mérite une précision, parce qu'il entre en concurrence avec le
« clic = la pièce, double-clic = dedans » proposé par l'audit (`P0-2`) :

```text
clic sur une pièce non sélectionnée   → la sélectionne
double-clic sur une pièce sélectionnée → ouvre le modal
double-clic dans Artwork               → descend d'un niveau (inchangé)
```

Dans Face, « descendre dans la pièce » **est** l'ouverture du modal : c'est la
même intention, exprimée par le même geste, et cela retire une ambiguïté au lieu
d'en ajouter une.

**Ce qui ne doit pas arriver** : un cinquième bouton permanent dans une barre
d'outils. §22 dit « sans encombrer l'interface » ; l'action vit dans le contexte
d'une pièce sélectionnée, et nulle part ailleurs.

---

## H. Créer une pièce (demande §20) — hors du premier périmètre

§20 demande si le même mini-éditeur peut servir à **créer** une pièce. Il le
peut, et il ne doit pas le faire tout de suite.

**Pourquoi c'est différent d'une modification** : créer une pièce ne demande pas
un canvas, il demande les cinq réponses que `validateFacePart` exige —
catégorie, emplacement, rôles, boîte de référence, morphologies. Sans elles, le
dessin est une forme SVG et pas une pièce : elle n'ira dans aucune rangée, ne
portera aucun mouvement, et ne pourra pas être remplacée.

**Ce qui existe déjà** et rend l'ajout raisonnable plus tard :

```text
part-inspector.js:116   « Save to the library », avec un formulaire
                        (nom, tags, catégorie, morphologies cochées)
face-part-validation.js les cinq contrôles
face-part-commands.js   l'installation
```

**Chemin recommandé, après `UI-REDESIGN-09`** :

```text
Rangée vide « Moustaches »
  → [ + Nouvelle moustache ]
  → le modal, canvas vide, cadré sur la boîte de référence de la catégorie,
    avec la pièce voisine (la bouche) en contexte estompé
  → Appliquer ouvre le formulaire « Enregistrer dans ma bibliothèque »
```

Le modal est donc le même ; ce qui s'y ajoute est un formulaire au moment
d'appliquer. C'est une PR à part (`UI-REDESIGN-11`), volontairement hors du
périmètre initial comme §20 l'autorise.

---

## I. Importer un SVG pour une pièce (demande §21)

`Import SVG` existe, mais **remplace tout le dessin de la mascotte**
(`bindLoadSvg` → `loadSvgFile`). Importer *une pièce* est autre chose.

### Le pipeline proposé

```text
Rangée « Yeux »  →  [ + ]  →  Importer un SVG…
        │
        ├─ 1. sanitizeSvg()                    existe — scripts, liens externes, styles
        ├─ 2. mesurer la boîte englobante       existe — getBBox via le canvas
        ├─ 3. adapter le viewBox                = la boîte englobante + 4 % de marge
        ├─ 4. normaliser l'échelle              à la referenceBox de la catégorie
        ├─ 5. préfixer les ids                  ← NOUVEAU, et obligatoire
        └─ 6. demander : catégorie · nom · type(s) compatible(s)
```

**L'étape 5 est la seule vraiment nouvelle, et c'est aussi la plus dangereuse si
elle est oubliée.** Un SVG importé qui contient `id="eyeLeft"` écraserait celui
de la mascotte, et le rig se mettrait à piloter le dessin importé.
`face-part-install.js` sait déjà préfixer les ids d'un asset installé ; c'est le
même code à appeler ici.

### Le formulaire de fin

Déjà écrit, à 90 % : `part-inspector.js:116` porte le formulaire
« Save to the library » avec le nom, les tags et les cases de morphologie. Il
suffit de l'ouvrir avec les valeurs de l'import.

### Ce qu'il ne faut pas promettre

Un SVG quelconque n'est pas une pièce riggable : il n'a pas de rôles. Un œil
importé sera **un dessin d'œil**, pas un œil qui cligne, tant que ses formes ne
sont pas nommées (`leftEye`, `pupilLeft`…). Le formulaire doit le dire en une
ligne, et proposer `Rig ▸ Assign` — pas le cacher.
