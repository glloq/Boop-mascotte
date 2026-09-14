# 07 — Ce qui est implémenté

Suivi de l'audit vers le code. Chaque ligne dit ce qui a changé, où, et ce qui
le prouve.

Principe suivi partout, repris d'[UIR-00](../UIR_REFACTOR_BASELINE.md) :
**aucune capacité ne perd sa porte.** Les fonctions avancées sont déplacées ou
repliées, jamais supprimées — et chaque repli est accompagné du test qui
vérifie que la porte existe encore.

---

## ✅ Fait

### Le socle : les gestes d'une pièce (UI-01 / UI-02)

| Ce qui a changé | Où |
| --- | --- |
| Catalogue et décisions, pur et testé | **nouveau** `ui/piece-actions.js` |
| Six actions sous la sélection, au canvas | **nouveau** `ui/selection-actions.js` |
| Le menu contextuel rend le catalogue au lieu de sa propre liste | `ui/canvas-menu.js` |
| Un seul exécutant ; le menu, la barre et le clavier sont trois portes | `app/editor-app.js` |
| `GESTURE_SURFACES` remplace trois tests séparés de la même question | `ui/piece-actions.js` |
| Le toast accepte une action, tient 7 s, et s'efface quand elle s'exécute | `shell/overlays.js` |
| Confirmation seulement quand on ne peut pas voir ce qu'on perd | `ui/piece-actions.js`, `app/editor-app.js` |
| Échap abandonne la sélection, en dernier recours | `app/editor-app.js` |
| `G R S P` là où aucun outil ne revendique ces lettres | `svg-editor/gizmo-geometry.js` |

**Résultat** : `Suppr`, `Ctrl+D`, `Ctrl+C/V`, `Ctrl+A`, `]`/`[`, `Shift+F10` et
le clic droit répondent dans Design ▸ Face, Design ▸ Hands, Rig et Artwork. Pas
dans Preview — le canvas y est un banc d'essai et une suppression serait un
piège.

**Le chemin de suppression est aussi le bon** : une pièce à l'intérieur du
dessin d'une partie de bibliothèque remonte à cette partie et passe par
`facePartCommands.remove`, qui emporte l'artwork, les rôles et les mouvements
ensemble. C'est le chemin qui ne laisse pas
« role leftEye references missing element eyeLeft » derrière lui.

**Prouvé par** `core/tests/piece-actions.test.js` (12), les tests de
`removePiece` dans `core/tests/character-builder.test.js`, et
`ux45-character-builder` (Suppr, la barre, le menu simple).

### Design ▸ Face

| Ce qui a changé | Où |
| --- | --- |
| `Type` et `Style` quittent la liste et deviennent deux `<select>` d'en-tête | `ui/character-builder/type-browser.js`, `style-browser.js`, `visual-rows.js` |
| `Couleurs` descend en pied de liste | `ui/character-builder/visual-rows.js` |
| Les cartes deviennent une grille de vignettes carrées | **nouveau** `styles/library.css` |
| Un champ de recherche sur le nom, la description et **les tags** | `part-browser.js`, `character-builder.js` |
| L'inspector en trois niveaux : basic / ▸ More / ▸ Advanced | `part-inspector.js` |
| `☐ Show every drawing` lève le filtre de morphologie, avec un badge par carte | `part-browser.js`, `character-builder.js` |
| Les six actions sous le nom de la pièce | `part-inspector.js` |
| *Remove* supprimé — `Suppr` le fait pour toute pièce, par le bon chemin | `part-inspector.js`, `character-builder.js` |

**Prouvé par** `ux45-character-builder` (27 specs), `masc05-type`,
`masc06-style`, `masc08b-visual-rows`, `character-builder.test.js` (42).

### Preview

| Ce qui a changé | Où |
| --- | --- |
| Quatre fonds : transparent (défaut), clair, sombre, couleur | **nouveau** `ui/preview-stage.js`, `styles/preview.css` |
| Quatre tailles nommées : 32 · 64 · 128 · 256 · Ajuster | idem |
| Un avertissement quand un contour passe sous le pixel | `ui/preview-stage.js` |
| Simulateur, journal, états, curseurs et mains sous un seul « Test the rig », replié | `ui/preview-panel.js` |

**Prouvé par** `core/tests/preview-stage.test.js` (5) et deux nouvelles specs
dans `ux08-preview-readiness`.

### Navigation

| Ce qui a changé | Où |
| --- | --- |
| L'éditeur ouvre sur `design.face` au lieu de l'éditeur vectoriel | `ui/task-router.js`, `app/services/project-service.js` |
| `Artwork`, `Deform`, `Timeline`, `States` derrière un chevron `›` | `shell/workspace-nav.js`, `styles/shell.css` |
| Le chevron s'ouvre pour toute route qui atterrit sur un écran avancé | `shell/workspace-nav.js` |
| Il se souvient : ouvrir Artwork une fois suffit | `ui/workspace-state.js` (`expertNav`) |
| `📱` descend dans `•••` ; `⟲` devient `⟲ Rest` et se sépare d'Undo | `shell/topbar.js`, `styles/shell.css` |
| `ID: eyeLeft` se replie sous *Identifier* | `svg-editor/layers-panel.js` |

L'importation d'un SVG atterrit toujours dans Artwork — c'est le seul cas où
l'auteur arrive avec un dessin à travailler.

### Rig — les quatre écrans (PR UI-07)

Mesuré avant : la colonne de gauche de Rig ▸ Assign faisait **4 226 px dans une
fenêtre de 836 px**, et *Face parts* — la seule section pour laquelle cet écran
existe — commençait à **3 661 px**. L'arbre SVG était déclaré en troisième
position, au-dessus de tout panneau de travail, et une mascotte a cent trente
calques, tous les groupes ouverts : arriver sur l'écran, c'était faire défiler
trois écrans et demi de doigts de la main gauche pour atteindre son sujet.
Artwork avait le même problème (outils à 3 633 px).

| Ce qui a changé | Où |
| --- | --- |
| Le panneau de l'écran ouvre la colonne ; *Structure* passe en dernier | `shell/side-nav.js` |
| L'arbre défile dans sa propre boîte là où il n'est pas le sujet | `styles/shell.css` |
| Dans Artwork il reste entier : c'est le seul écran dont l'arbre **est** le sujet | idem |
| Les onglets d'une partie deviennent `Drawing · Movement · Range · Details` | `rig-editor/semantic-parts/rig-panel.js` |

Mesuré après :

| Écran | Colonne avant | Colonne après | Sujet à |
| --- | --- | --- | --- |
| `rig.assign` | 4 226 px | **1 219 px** | 114 px |
| `rig.controls` | 3 927 px | **920 px** | 100 px |
| `rig.head2d` | 3 762 px | **836 px** | 100 px |
| `rig.deform` | 4 120 px | **1 113 px** | 100 px |
| `design.artwork` | 3 927 px | 3 946 px | **86 px** (outils) |

Les mots : `Controls` désignait deux choses à un centimètre l'une de l'autre —
le deuxième écran de Rig dans la navigation, et les mouvements d'une partie dans
le panneau juste en dessous. Seuls les mots changent : `data-rig-tab` garde ses
quatre identifiants, donc toute route, commande ou spec qui en nomme un le nomme
encore.

**Prouvé par** deux specs dans `ux22-layout` — l'une mesure l'ordre et la hauteur
sur les trois écrans, l'autre lit les quatre onglets. Les deux vérifient aussi
que *Structure* est toujours là : c'est la façon de choisir une pièce que le
canvas ne donne pas.

**Corrigé au passage** : *Poses* était tombé dans le repli « Test the rig » de
Preview. Un état nommé se presse et se regarde, exactement comme une expression,
une animation ou une réaction ; il siège avec elles. Le banc garde les curseurs,
le simulateur et les mains.

### Le bug que l'écran d'accueil a découvert

Changer l'écran d'ouverture a fait tomber dix-neuf specs. Dix-huit disaient
simplement « le modèle atterrit dans Artwork » et ont été corrigées. La
dix-neuvième disait autre chose : **Ctrl+Z ne redessinait pas.**

Le canvas peint d'abord et écrit le document ensuite — chaque site de mutation
est `commands.setTransform(...)` puis `api.applyElementTransform(...)` — donc
rien ne relisait jamais le document *vers* le dessin. `history.undo()` remplace
le document entier, et l'illustration restait exactement là où le glissement
l'avait laissée : les nombres de l'inspector disaient une chose et la mascotte
en montrait une autre.

Deux moitiés, et il fallait les deux :

| Ce qui a changé | Où |
| --- | --- |
| `undo()` et `redo()` repassent par `preview.apply()` | `app/editor-app.js` |
| `applyElementTransform` inscrit ce qu'il a peint dans `lastApplied` | `svg-editor/svg-canvas.js` |

Le cache était le vrai coupable. `applyFrame` saute une écriture quand l'image
calculée correspond à ce qu'il croit que le nœud porte ; `applyElementTransform`
écrivait le même attribut dans son dos. Après un undo, l'image calculée valait
la position de repos, le cache disait *déjà au repos* — et rien n'était écrit.

`preview.apply()` plutôt qu'une écriture directe des transformations : le
runtime possède cet attribut pendant qu'une réaction ou un mouvement joue, et
compose la transformation de l'auteur avec la pose vivante. Écrire la
transformation de base par-dessous effacerait ce qui est en train de jouer —
essayé, et c'est exactement ce qui s'est passé.

Pourquoi si longtemps invisible : chaque test qui pressait Ctrl+Z changeait
d'espace juste après, ce qui redessinait tout. La seule surface où l'on glisse
une pièce et où l'on fait Ctrl+Z sans aller nulle part — Design ▸ Face — est
celle où l'éditeur ouvre désormais.

### Behavior ▸ Reactions (PR UI-08)

La colonne la plus haute de l'éditeur : **5 725 px dans une fenêtre de 836 px**,
dont **2 624 px** — près de la moitié — pour une seule liste, *Motions that never
run* : une carte pour chacun des trente mouvements du modèle, dont aucun n'a
encore de déclencheur. Une chose vraie, dite trente fois, en bas d'une colonne
que personne n'atteint.

| Ce qui a changé | Où |
| --- | --- |
| *Motions that never run* devient une ligne et un compte | `ui/reaction-studio.js` |
| Le style du repli, en jetons | **nouveau** `styles/behavior.css` |
| Les lignes des trois listes s'empilent : un nom, puis ce qu'il est | `index.html` (`.expression-item`) |

| | Avant | Après |
| --- | --- | --- |
| Colonne de Behavior ▸ Reactions | 5 725 px | **3 137 px** |
| Bloc *Motions that never run* | 2 624 px | **52 px** (30 lignes derrière) |

Rien n'est perdu : derrière le repli, c'est la même liste, chaque ligne avec son
choix de *quand* et son bouton *Run it*. Ce qui disparaît est le reproche, pas
la porte.

**Le rendu, au passage.** Les lignes des trois listes (expressions, mouvements,
réactions) partageaient une rangée flex en `space-between` : correct pour
« 3 controls », illisible pour « On "yes" → Happy → Nod → Set left hand state
→ Thumbs up → then return to idle ». Dans une colonne de 300 px les deux textes
revenaient à la ligne et s'entrelacçaient — le nom au milieu de sa propre
description. Un titre au-dessus de son sous-titre, comme les cartes de presets
juste à côté.

**Prouvé par** une spec dans `ux22-layout` (le repli, le compte, les trente
lignes toujours là, la colonne sous 4 000 px) et `ux13-reactions`, qui ouvre le
repli comme une personne le ferait avant de choisir un *quand*.

### Animate, et les cartes des trois catalogues (PR UI-09)

Une carte de preset portait trois textes : un nom, ce qu'elle fait, et **ce dont
elle est faite**. Deux des trois étaient des `<small>` coupés à deux lignes
chacun (`-webkit-line-clamp: 2`), donc une seule carte pouvait dépenser quatre
lignes d'une colonne de 300 px — et finir les deux phrases par des points de
suspension. Le pire des deux mondes : la place prise, et la phrase inachevée.

La recette passe sur le `title` de la carte. Ce n'est pas une décision que l'on
prend au moment d'appuyer sur *Add* ; ce qui **manque** reste à voix haute,
parce que sur une carte qu'on ne peut pas presser, c'est tout le message.

| | Avant | Après |
| --- | --- | --- |
| Carte de motion (médiane) | 104 px | **70 px** |
| Catalogue ouvert (groupe *Head*) | 1 545 px | **1 147 px** |
| Colonne d'Animate ▸ Motions | 3 998 px | **3 599 px** |
| Colonne de Behavior ▸ Reactions | 3 137 px | **2 947 px** |

Les expressions gardent leur deuxième ligne : c'est un compte court
(« 3 movements »), pas une recette, et il ne revient jamais à la ligne.

**Prouvé par** une spec dans `ux22-layout` qui lit les deux moitiés — la recette
hors de la carte, la recette toujours dans son `title` — et mesure la hauteur ;
et par `ux12-motion-studio`, dont l'assertion sur *Uses* lit désormais le
`title`.

### Le clic, le gizmo et la paire (PR UI-03 / UI-04)

Un œil du template est un groupe de sept formes. Cliquer sur l'œil
sélectionnait `glintLeft` — un reflet de deux pixels, affiché
« Left eye glint » — et quelqu'un qui appuyait ensuite sur `Suppr` effaçait un
reflet au lieu d'un œil.

Et les trois façons de déplacer une pièce n'étaient pas d'accord :

| Geste | Cible, avant | Miroir de la paire, avant |
| --- | --- | --- |
| Champs *X / Y / Taille* | la partie entière | **oui** |
| Gizmo au canvas | la forme sélectionnée | non |
| Flèches du clavier | la forme sélectionnée | non |

Une personne cochait « éditer les deux yeux » (coché par défaut), glissait l'œil
gauche, et seul l'œil gauche bougeait ; puis tapait un nombre, et les deux
bougeaient.

| Ce qui a changé | Où |
| --- | --- |
| Un seul point d'accroche : `resolve` · `contains` · `commit` | `svg-editor/svg-canvas.js` (`setPieceModel`) |
| Le clic remonte à la pièce **nommée** la plus proche | `character-builder.js` (`resolvePiece`) |
| Le double-clic descend, `Échap` remonte d'un niveau | `svg-canvas.js`, `app/editor-app.js` |
| Le gizmo **et** les flèches écrivent par `writeTransforms` | `character-builder.js` (`commitTransform`) |
| Le fil d'Ariane : `Face › Left eye › Left eye glint` | `part-inspector.js`, `styles/library.css` |

**Une règle pour deux sortes de visage.** La pièce qu'un clic désigne est la plus
proche chose *qui a un nom* en remontant l'arbre : sur un visage de
bibliothèque, l'instance que l'ajustement a posée ; sur le template, l'élément
qu'une partie sémantique appelle `leftEye`. Elle s'arrête au premier nom, ce qui
est la raison pour laquelle cliquer un œil ne sélectionne pas la tête : `faceRoot`
a un nom aussi, et il est plus haut. Une pupille garde le sien — la partie Gaze
la nomme — donc le milieu d'un œil est bien une pupille.

Le modèle n'est branché que sur la moitié `simple` de `GESTURE_SURFACES`
(Design ▸ Face, Design ▸ Hands) : Artwork **est** l'éditeur vectoriel, et Rig
assigne des rôles à des éléments nommés. Les deux veulent la forme sous le
pointeur, et les deux reçoivent `null`.

**Prouvé par** deux specs dans `ux45-character-builder` — l'une lit les deux
moitiés (la pièce au clic, chaque forme toujours atteignable au double-clic et
par le fil d'Ariane), l'autre le miroir et l'undo unique.

**Une assertion obsolète retirée**, la troisième de cette suite : `ux45`
affirmait `pupilRight.x === 0` après un glissement — le défaut de l'audit §2.2,
écrit comme une intention.

### Les messages de validation (PR UI-05)

Supprimer un dessin dans Artwork laisse `semanticParts[*].roles` pointer sur un
élément qui n'existe plus. Le validateur disait :

> Semantic part "eyes": role "leftEye" references missing element "eyeLeft".

Vrai, inactionnable, et écrit pour quelqu'un qui lit le schéma. Le seul bouton
ouvrait un écran : il restait à trouver *Clear*, sur le bon rôle, sur la bonne
partie. Il dit désormais :

> Eyes: nothing is drawn for its left eye any more. Pick another drawing for it,
> or take the role off.

| Ce qui a changé | Où |
| --- | --- |
| Le contrôle remonte là où un problème a une cible et un remède | `validate-project.js` (`orphanRoleIssues`) |
| Un *remède* à côté du *Fix* : la réparation, pas l'endroit | `issue-guidance.js` (`describeRemedy`) |
| Deux boutons dans Project check | `shell/overlays.js` |
| Le remède branché sur `assignRole(partId, role, null)`, avec Annuler | `app/services/export-service.js` |

**Corrigé au passage, et c'était un défaut de ce travail-ci.** Le toast du remède
disparaît immédiatement : la passe de validation déclenchée par la réparation
elle-même écrivait son résumé par-dessus, et l'offre *Annuler* partait avant
qu'on puisse la prendre. Deux causes :

- le garde-fou de `setStatus` ne protégeait que les messages *info*
  (`routine && tone === 'info'`), alors que le résumé est un *warn* — un message
  que l'auteur vient de provoquer prime sur le battement de cœur, quel qu'en
  soit le ton ;
- le câblage du service perdait le troisième argument
  (`setStatus:(message,tone)=>shell.setStatus(message,tone)`), donc **aucune**
  action du service n'a jamais eu son bouton.

**Prouvé par** un test unitaire sur le message pur et l'absence de mots de
schéma, et une spec dans `ux16-export-readiness` qui suit le parcours entier :
le dessin supprimé, la phrase, les deux boutons, la réparation, le toast avec
*Annuler*, et le problème qui ne revient pas.

### La bibliothèque et les presets — ce qui restait de §8 (PR UI-06)

**Rien à faire, et il faut le dire.** La ligne « les 22 presets visibles d'un
coup » du plan était fausse sur deux points, vérifiés en mesurant :

- il y a **six** presets de look, pas vingt-deux, et les six sont déjà visibles
  d'un coup — une grille de vignettes carrées de 117 px, deux par ligne dans la
  colonne de 300 px, chacune avec sa vraie image ;
- §8.1 (la planche) et §8.2 (la recherche) ont été faits dans la passe
  Design ▸ Face.

Ce qui restait de §8 est §8.3 (favoris et récents), resté en P2.

**Un défaut trouvé en mesurant, lui bien réel.** Sur le visage du template, où
aucune pièce ne vient de la bibliothèque, le sélecteur *Look* n'avait qu'une
option, **désactivée** : un `<select>` dont toutes les options le sont ne
sélectionne rien et dessine une boîte vide. Le contrôle se lisait comme cassé
plutôt que comme « pas encore ».

| Ce qui a changé | Où |
| --- | --- |
| Une option de tête, sélectionnée : « No look to apply yet » | `style-browser.js` |
| Les looks restent listés, désactivés — ce qu'ils sont vaut d'être lu | idem |

**Prouvé par** une spec dans `ux45-character-builder` : quelque chose est
sélectionné, la boîte a des mots, et la porte se rouvre dès qu'une pièce de
bibliothèque arrive sur le visage.

### Rendu global

| Ce qui a changé | Où |
| --- | --- |
| Une couche de jetons : palette, espacement, rayons, élévation, type, motion | **nouveau** `styles/tokens.css` |
| Quatre fichiers CSS réels, chargés avant les blocs en ligne | `styles/` |
| Cinq règles retirées d'`index.html`, ré-exprimées en jetons | `styles/library.css` |
| La migration documentée, avec ses mesures | **nouveau** `styles/README.md` |

---

## ⏳ Reste à faire

Par ordre de valeur, avec la référence de l'audit.

| Priorité | Tâche | Référence |
| --- | --- | --- |
| **P1** | Clic = la pièce, double-clic = dedans, fil d'Ariane de sélection | [02](02_PROBLEMES.md) §2.1 · PR **UI-03** |
| **P1** | Le gizmo agit sur la partie, et miroite la paire liée comme les champs | §2.2 · PR **UI-04** |
| **P1** | Messages de validation en langage utilisateur, avec un *Fix* | §4.2 · PR **UI-05** |
| **P1** | Les mains dessinées depuis Design, sans aller-retour vers Rig | §1 (op. 11) |
| **P2** | Favoris et récents dans la bibliothèque | §8.3 |
| **P2** | Colonnes redimensionnables ; aligner/centrer hors d'Artwork | §10.1, §5 |
| **P2** | Magnétisme et guides au déplacement ; zoom sur la sélection ; isoler exposé | §5 |
| **P2** | Liste des pièces **par rôle** sous *Avancé* dans Face | §1.3 |
| **P2** | Mode `Simple / Complet` et les libellés français | §7.3 |
| **P2** | Assistant de création en trois écrans | [04](04_RECOMMANDATIONS.md) §5 |
| **P3** | Migration complète du CSS hors d'`index.html` | [06](06_PLAN_PR.md) P3-1 |
| **P3** | Jeu d'icônes cohérent à la place des glyphes unicode | P3-4 |

---

## Ce que les tests disent

| Suite | État |
| --- | --- |
| `npm test` (unitaires) | **2 085 passent** |
| `npm run build` | propre |
| Suite navigateur complète (hors `@visual`) | lancée entièrement, pas seulement `@critical` |

**Échecs préexistants**, vérifiés dans un *worktree* à `f2bf469` — le commit qui
précède ce travail — et non par un `git stash` contre `HEAD`, qui contenait déjà
les changements :

- `editor.spec.js` × 2 (injection de balises, contrôles sur téléphone) ;
- `ux13-reactions:119`, `ux14-event-simulator:74` ;
- `ux26-direct-controls:177` et `:201` ;
- les deux instantanés `@visual`.

`ux22-stress` mesure des budgets de temps : il échoue sous charge parallèle et
passe seul. Ce n'est pas un échec du produit, c'est la limite du conteneur.

### Ce que `@critical` ne voyait pas

Neuf régressions du changement d'écran d'accueil (`DEFAULT_MODE`) n'ont été
trouvées qu'en lançant la suite **entière**. L'éditeur ouvre sur *Face*, donc :

- les specs qui saisissent un outil de dessin vont d'abord dans Artwork
  (`ux25` × 4, `ux20` téléphone) ;
- la fiche des capacités s'ouvre par le menu `•••` où elle est descendue
  (`openCapabilitySheet`) ;
- l'anneau des flèches ouvre le chevron avant de marcher sur un écran expert ;
- *Poses* était tombé dans le repli « Test the rig » de Preview.

La leçon est dans la méthode : `@critical` est une garde, pas une preuve, et un
décompte de tests n'a de valeur que si l'on sait contre quel `dist` il a tourné.

Deux assertions obsolètes ont été retirées, toutes deux ayant écrit un défaut
comme une intention :

- `ux45` affirmait « Delete deletes nothing here » sur le Character Builder.
- `ux45` affirmait que museau, bec, robot et monstre n'avaient « rien de
  dessiné » — trois des quatre ont été dessinés depuis (MASC-10B, 11B, 12B) ;
  seul le monstre attend encore une corne.
