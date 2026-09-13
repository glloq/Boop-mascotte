# 03 — Workflows, reconstitués et comptés

**Convention de comptage.** Une « action » est un clic, un appui de touche ou un
geste de glissement (un drag = 1). Le défilement n'est pas compté mais est
signalé quand il est nécessaire. Point de départ : un projet chargé, l'éditeur
sur **Design ▸ Face**.

---

## A. Le parcours de création, opération par opération

### 1. Créer une nouvelle mascotte — **1 action** ✅

`Home → New Character`. Charge le template rigé, atterrit sur Design ▸ Face avec
la ligne *Presets* ouverte, et affiche « Pick a preset, then swap any part for
another style. »

C'est déjà optimal. **Sauf** si on passe par la seconde carte (*Mascot Face*),
qui atterrit sur Design ▸ Artwork — l'éditeur vectoriel (§1.5 de
[02](02_PROBLEMES.md)).

### 2. Choisir un style ou une base — **1 action, ou 4** ⚠️

La ligne *Presets* est ouverte. Un clic sur une carte applique le preset en un
pas d'undo.

Mais **22 presets existent et 6 sont visibles** : `presetsFor()` filtre par
morphologie, et la morphologie active est celle du visage présent (`human`).

| Preset | Morphologie | Visible d'entrée ? |
| --- | --- | --- |
| Classic Cartoon, Professor, Young, Old, Robot, Minimal | human | ✅ |
| Cat, Dog, Fox, Bear, Wolf, Rabbit | muzzle | ❌ |
| Screen robot, Retro robot, Industrial robot, Toy robot | robot | ❌ |
| Owl, Duck, Parrot, Crow, Cute bird, Slim bird | beak | ❌ |

Pour atteindre *Cat* : `Type` (1) → `Muzzle` (1) → `Presets` (1) → `Cat` (1) =
**4 actions**, dont deux dans une ligne dont le panneau dit lui-même qu'elle
« ne change rien sur le visage ».

C'est le plus gros gâchis de découvrabilité de l'audit : **seize personnages
prêts à l'emploi sont invisibles.**

### 3 à 9. Ajouter / changer une partie du visage — **2 actions chacune** ✅

`Head` · `Eyes` · `Pupils` · `Eyelids` · `Brows` · `Nose` · `Mouth` · `Ears` ·
`Hair` · `Facial Hair` · `Accessories` (+ `Muzzle` · `Whiskers` · `Beak` ·
`Horns` · `Crest` · `Antenna` · `Panels` selon la morphologie).

Presser la ligne (1) ouvre son corps sous elle : les chips des pièces présentes,
puis les cartes de style. Presser une carte (1) installe le dessin.

**C'est bon.** Les frictions sont :
- il faut **scroller** : 4 lignes de méta + jusqu'à 11 lignes de parties dans
  une colonne de 300 px, et le corps de la ligne ouverte s'insère dedans ;
- les cartes sont des boutons empilés de 280 px, pas une grille de vignettes ;
- **pas de recherche** parmi 150 dessins.

Pour une pièce que la mascotte n'a pas encore (pas de partie sémantique),
la ligne dit « No mouth on this mascot yet » et offre
`Assign it in Face Setup…` — **qui quitte Design pour Rig ▸ Assign**. Pour un
SVG importé non assigné, c'est le cas de **toutes** les lignes.

### 10. Ajouter un corps — **impossible : le produit n'a pas de corps** ℹ️

`CATEGORY_TABLE` (`core/face-library/face-part-model.js:46`) compte onze
catégories, toutes faciales. Boop est un **visage + deux mains flottantes**
(style Rayman, `docs/HAND_RIGGING.md`). Il n'y a ni torse, ni bras, ni jambes,
ni dans les données, ni dans la bibliothèque, ni dans le runtime.

Ce n'est pas un défaut d'UI : c'est le périmètre du produit. Mais **rien dans
l'interface ne le dit**, et c'est une attente naturelle. Une phrase sur Home
(« Boop anime un visage et deux mains ») coûte une ligne et évite la recherche
d'une fonction qui n'existe pas.

### 11. Ajouter les mains — **3 actions et un aller-retour** ⚠️

`Hands` (1) → la ligne dit « No hands yet. A pair is drawn and rigged in one
press. » → `Draw a pair of hands…` (1) → **route vers Rig ▸ Controls, section
Hand setup** → presser le bouton là-bas (1).

L'auteur quitte Design pour Rig pour obtenir des mains, alors que le bouton
dit « one press ».

**Correction** — exécuter l'action sur place : la ligne *Hands* de Design
dessine la paire, et *Hand setup…* reste offert pour l'ancre et la portée.

### 12. Changer les couleurs — **3 actions** ✅

Deux chemins, tous les deux bons :

- **Une couleur de tout le visage** : `Colours` (1) → une ligne de token
  (« Skin · 14 uses ») (1) → une pastille dans le dialogue (1). Un pas d'undo,
  changé partout.
- **Une couleur d'une pièce** : sélectionner la pièce (1) → une pastille dans
  l'inspector (1) → une pastille dans le dialogue (1).

Le dialogue est excellent (les couleurs de la mascotte d'abord, puis un jeu
standard, puis hex, puis le picker natif, puis *None*) et **un clic applique**.

**Friction** — la ligne `Colours` est la 4ᵉ, avant *Head*, et les pastilles de
l'inspector sont sous *Position*, *Taille*, *Paire*, *Spacing*.

### 13. Positionner un élément — **1 action (mais fausse), ou 3 (mais juste)** ❌

| Chemin | Actions | Ce qui bouge |
| --- | --- | --- |
| Glisser sur le canvas | 1 | **la forme cliquée** (`glintLeft` si on a cliqué le reflet), sans miroir de la paire |
| Flèches du clavier | 1 par pas | idem |
| Champs `X` / `Y` de l'inspector | clic + frappe + Tab ≈ 3 | **la partie entière**, avec miroir de la paire si liée |

Les deux chemins ne font pas la même chose (§2.1 et §2.2 de
[02](02_PROBLEMES.md)). C'est le défaut le plus insidieux de l'audit : rien ne
casse, l'auteur conclut simplement que le logiciel est imprévisible.

### 14. Modifier la taille — **1 ou 3 actions** ⚠️

Poignée de coin du gizmo (1 drag), ou `K` puis drag, ou champ `Scale` (≈ 3).
Le champ n'expose **qu'une échelle** (volontairement : « a part is made bigger
or smaller and never wider »), avec une note si la pièce est déjà non uniforme.
Bonne décision.

Même incohérence de cible que 13.

### 15. Modifier la rotation — **1 ou 3 actions** ⚠️

Poignée de rotation (1 drag), ou `E` puis drag, ou champ `Rotation` (≈ 3).
Pivot par défaut au centre de la boîte — bien traité. Même incohérence de cible.

### 16. Gérer la profondeur / l'ordre d'affichage — **impossible depuis Face** ❌

Aucune action. Le panneau *Structure* est masqué en CSS, le menu contextuel est
refusé, et l'inspector n'offre rien.

Chemin réel : `Artwork` (1) → retrouver la pièce (clic canvas ou arbre, 1) →
clic droit (1) → `Bring forward` (1) = **4 actions, et on a changé d'écran**.
Il faut ensuite revenir : `Face` (1) = **5**.

### 17. Remplacer une pièce — **2 actions** ✅

Ligne de la catégorie (1) → carte (1). `rowInstallTarget` décide correctement
si la carte remplace ou ajoute.

**Friction** — il n'y a pas de chemin depuis la sélection : une pièce
sélectionnée n'a pas de bouton *Remplacer*. Il faut savoir dans quelle ligne
elle vit.

### 18. Dupliquer une pièce — **impossible depuis Face** ❌

`Ctrl+D` est gardé par `=== 'create'` (`editor-app.js:781`). Pas d'entrée dans
l'inspector. Chemin réel : `Artwork` (1) → sélectionner (1) → `Ctrl+D` (1) = 3,
puis retour `Face` (1) = **4**.

### 19. Masquer une pièce — **impossible depuis Face** ❌

`Artwork` (1) → `Structure` → l'icône `◉` de la ligne (1) = 2, + retour = 3.
(Il faut d'abord trouver la ligne dans un arbre de ~30 entrées.)

### 20. Supprimer une pièce — **impossible depuis Face, sauf 2 catégories** ❌

| Cas | Chemin | Actions |
| --- | --- | --- |
| Accessoire / pilosité | sélectionner (1) → `Remove` dans l'inspector (1) | **2** ✅ |
| Accessoire / pilosité (bis) | sa carte de style porte `On ×` → un clic la retire | **2** ✅ |
| Tête, yeux, pupilles, paupières, sourcils, nez, bouche, oreilles, cheveux, museau, bec, crête… | **aucun chemin depuis Face** | — |
| Contournement | `Artwork` (1) → sélectionner (1) → `Suppr` (1) → retour `Face` (1) | **4**, et le rôle sémantique reste orphelin |

### 21. Annuler / rétablir — **1 action** ✅

`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`, boutons `↶ ↷` en topbar, entrées de
palette. Fonctionne partout, y compris dans Face. Un geste de gizmo = un pas
d'undo ; une paire liée = un pas ; un preset = un pas.

**C'est la meilleure partie de l'éditeur.** Ce qui manque n'est pas l'undo,
c'est le **bouton** dans le toast (§4.1 de [02](02_PROBLEMES.md)).

### 22. Prévisualiser — **1 action** ✅

L'onglet `▶ Preview` bascule et rend l'auteur à son écran. Bon.

Mais ce qu'on trouve derrière n'est pas un preview (§11 de
[01](01_ETAT_ACTUEL.md)) : pas de fond, pas de taille d'affichage, et huit
sections dont un simulateur d'événements et un journal.

---

## B. Les actions les moins intuitives, par ordre de gravité

| Rang | Action | Pourquoi personne ne la trouve |
| --- | --- | --- |
| 1 | Supprimer une partie du visage | Aucune affordance. `Suppr` ne répond pas, le clic droit ne répond pas, et *Remove* n'apparaît que pour les accessoires — donc l'absence ressemble à une règle plutôt qu'à un trou. |
| 2 | Changer l'ordre d'affichage | Aucune affordance dans Face, et le mot « calque » n'apparaît nulle part avant d'ouvrir Artwork. |
| 3 | Trouver les 16 presets non humains | Cachés derrière une ligne (`Type`) qui annonce ne rien changer. |
| 4 | Comprendre ce qui est sélectionné | Le nom affiché est celui de la forme SVG la plus profonde (« Left eye glint »). |
| 5 | Comprendre pourquoi une carte est grisée | La raison est en `title=`, donc invisible au toucher. |
| 6 | Trouver le fond / la taille du preview | N'existent pas — l'auteur les cherche. |
| 7 | Savoir ce que fait `⟲` en topbar | Un `⟲` à côté d'un `↶` se lit comme un second undo. |
| 8 | Savoir ce que fait `📱` en topbar | Une icône téléphone sur un écran 27″. |
| 9 | Trouver *Automatic* et *States* | Résolu par UIR-01 (ils ont des onglets) — mais les onglets s'appellent *Automatic* et *States*. |
| 10 | Sortir d'un *Edit Shape* | Le fil d'Ariane `#artwork-scope` le dit — s'il est remarqué. |

---

## C. Informations inutiles affichées

| Où | Quoi | Verdict |
| --- | --- | --- |
| Structure, ligne sélectionnée | `ID: eyeLeft` | supprimer (garder sous *Avancé*) |
| Inspector Face | 7 paragraphes explicatifs simultanés | réduire à 1, le reste en infobulle |
| Inspector Face | `Position, size and turn are the whole part's (Left eye group)` | n'afficher que si l'auteur tente de bouger une sous-pièce |
| Browser, ligne *Style* | `7 of 9 library parts can be redrawn` | remonter en en-tête compact |
| Cartes de style | `3 movements are not carried by this drawing — Rig ▸ Controls says which.` | reformuler sans le nom d'écran |
| Formulaire *Save as a library part* | `Goes on as accessory — what the rig knows it by` | déplacer sous *Avancé* |
| Project check | `Semantic part "eyes": role "leftEye" references missing element "eyeLeft"` | réécrire + offrir *Fix* |
| Preview | Journal d'événements en première page | déplacer sous *Test avancé* |
| Advanced tools ▸ Parameters | Table `headX / -1 → 1 / 0` | correct — c'est *Advanced* |

---

## D. Risques d'erreur utilisateur

| Risque | Mécanisme | Gravité |
| --- | --- | --- |
| Supprimer une pièce dans Artwork laisse un rôle orphelin, signalé par un message de schéma non corrigible | `canvas.delete` ne nettoie pas `semanticParts[*].roles` | **élevée** |
| Déplacer le reflet d'un œil hors de l'œil en croyant déplacer l'œil | clic = forme la plus profonde | **élevée** |
| Croire que la paire d'yeux est liée alors que le drag ne miroite pas | gizmo ≠ champs | **élevée** |
| Supprimer 8 pièces en multi-sélection sans confirmation ni toast | `deleteMany` silencieux | moyenne |
| Perdre un travail en pressant un preset (il réinstalle 8 parties) | un pas d'undo, mais pas de toast avec *Annuler* | moyenne |
| Presser *Mascot Face* dans Design ▸ Artwork ▸ Add/Create et écraser le projet | `confirmProjectReplacement()` protège ✅ | faible |
| Perdre le travail en fermant l'onglet | autosave local + « Continue » sur Home ✅ | faible |

---

## E. Tableau avant / après du nombre d'actions

Point de départ : projet chargé, **Design ▸ Face**, une pièce à modifier.

| Action | Workflow actuel | Actions | Workflow proposé | Actions |
| --- | --- | ---: | --- | ---: |
| **Créer une mascotte** | Home → *New Character* | **1** | inchangé | **1** |
| **Choisir une base (même kind)** | ligne *Presets* ouverte → carte | **1** | inchangé | **1** |
| **Choisir une base (autre kind)** | `Type` → kind → `Presets` → carte | **4** | grille de 22 presets, chips de filtre facultatives | **1** |
| **Ajouter un élément** (yeux, bouche…) | ligne de catégorie → carte | **2** | inchangé, ou glisser la vignette sur la mascotte | **1–2** |
| **Ajouter un élément (SVG importé, non assigné)** | ligne → *Assign it in Face Setup…* → Rig ▸ Assign → cliquer l'artwork → choisir le rôle → retour Face → carte | **6+** | *Détecter les parties* proposé en place dans Face | **2** |
| **Ajouter les mains** | `Hands` → *Draw a pair…* → Rig ▸ Controls → bouton | **3** | `Hands` → *Ajouter une paire* (sur place) | **2** |
| **Supprimer un élément** (accessoire) | sélectionner → *Remove* | **2** | sélectionner → `Suppr` → toast *Annuler* | **2** |
| **Supprimer un élément** (yeux, bouche, tête…) | `Artwork` → sélectionner → `Suppr` → `Face` *(+ rôle orphelin)* | **4** ⚠️ | sélectionner → `Suppr` → toast *Annuler* | **2** |
| **Supprimer plusieurs éléments** | `Artwork` → lasso → `Suppr` → `Face` | **4** | lasso → `Suppr` → confirmation (≥ 3) → toast | **3** |
| **Remplacer un élément** | ligne de catégorie → carte | **2** | sélection → *Remplacer* → carte (grille filtrée sur son slot) | **2** |
| **Changer une couleur** (une pièce) | sélectionner → pastille → pastille du dialogue | **3** | inchangé (pastilles remontées sous le nom) | **3** |
| **Changer une couleur** (tout le visage) | `Colours` → token → pastille | **3** | inchangé | **3** |
| **Déplacer un élément** | glisser *(déplace la mauvaise chose)* | **1** ⚠️ | glisser *(déplace la partie, miroite la paire)* | **1** |
| **Redimensionner** | poignée de coin | **1** | inchangé | **1** |
| **Tourner** | poignée de rotation | **1** | inchangé | **1** |
| **Dupliquer** | `Artwork` → sélectionner → `Ctrl+D` → `Face` | **4** ⚠️ | sélectionner → `Ctrl+D` | **2** |
| **Changer l'ordre** | `Artwork` → sélectionner → clic droit → *Bring forward* → `Face` | **5** ⚠️ | sélectionner → `]` (ou bouton de la barre d'actions) | **2** |
| **Masquer** | `Artwork` → `Structure` → icône `◉` → `Face` | **4** ⚠️ | sélectionner → bouton *Masquer* | **2** |
| **Miroir horizontal** | `Artwork` → sélectionner → clic droit → *Flip horizontally* → `Face` | **5** ⚠️ | sélectionner → bouton *Miroir* | **2** |
| **Centrer / aligner** | `Artwork` → sélectionner → `.tool-arrange` → bouton → `Face` | **5** ⚠️ | sélectionner → bouton *Centrer* | **2** |
| **Isoler une pièce pour la retoucher** | *Edit Shape* → Artwork en portée → retour par le fil d'Ariane | **2** | inchangé | **2** |
| **Créer une expression** | `Animate` → carte de preset *Add* | **2** | inchangé | **2** |
| **Tester le rendu** (expression + motion) | `Preview` → section *Expressions* → chip → section *Animations* → chip | **4** | `Preview` → chip d'expression → chip de motion (sections déjà ouvertes en tête) | **3** |
| **Ouvrir Preview** | onglet `▶ Preview` | **1** | inchangé | **1** |
| **Tester à la taille réelle** | *impossible* | **∞** | `Preview` → chip `32 px` | **2** |
| **Tester sur un fond clair** | *impossible* | **∞** | `Preview` → chip de fond | **2** |
| **Annuler** | `Ctrl+Z` / `↶` | **1** | + bouton *Annuler* dans le toast | **1** |

### Ce que le tableau dit

Les opérations d'**ajout** sont déjà à 1–2 actions : cette partie du produit est
bonne. Les opérations de **gestion** (supprimer, dupliquer, ordonner, masquer,
miroiter, aligner) coûtent 4 à 5 actions **et un changement d'écran**, parce
qu'elles n'existent pas là où l'auteur travaille.

Toutes tombent à 2 actions avec **un seul changement** : porter les gestes
d'Artwork dans Face, via un module partagé et une barre d'actions sur la
sélection. Il n'y a pas de nouvelle commande à écrire — `canvas.delete`,
`canvas.duplicate`, `canvas.reorder`, `canvas.reorderToEnd`, `canvas.flip`,
`canvas.setVisibility`, `canvas.setLocked`, `canvas.alignSelection`,
`facePartCommands.remove` existent tous et sont tous testés.
