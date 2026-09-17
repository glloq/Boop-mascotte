# V5 — une mascotte faite d'images

*Étude de conception. Rien n'est supprimé ni construit tant que ce document
n'est pas validé.*

L'éditeur sait déjà faire une mascotte en images : importer, placer, remplacer,
découper, plier, exporter (V4). Ce qu'il ne sait pas faire, c'est **partir**
d'images — sa porte d'entrée, sa bibliothèque et son rigging supposent tous un
dessin vectoriel. Cette étude dit comment inverser ça.

---

## 1. Ce que dit le code aujourd'hui

Trois chiffres et trois mécanismes. Les chiffres disent ce qui part, les
mécanismes disent que le travail est surtout une **recomposition**, pas une
réécriture.

| | |
| --- | --- |
| Bibliothèque de visages SVG | **9 242 lignes** — 22 presets, ~150 dessins, 4 morphologies |
| Character Builder (l'UI qui la parcourt) | **3 235 lignes** |
| Fichiers de tests qui en dépendent | **41** |

Et les trois mécanismes qui existent déjà et qui portent presque tout le
nouveau système :

**① L'échange de dessins.** Une main est une bibliothèque de dessins dont un
seul est visible, indexé par un paramètre, sans interpolation entre deux
images (`runtime/hand-sprite.js`, `core/hands/hand-state-model.js`). C'est
exactement ce qu'il faut pour une paupière fermée et pour une bouche : *« a
hand is set to a state, not animated into one: the drawing swaps »*. Ça marche
sur du PNG comme sur du SVG.

**② Le choix de la méthode de rigging.** Il existe déjà, par mouvement, dans
Rig ▸ Advanced : un `<select>` « How should it move? » alimenté par
`definition.strategies[control]` et écrit par `setMethod`
(`rig-editor/semantic-parts/rig-panel.js`). Il n'est pas à inventer — il est **au
mauvais endroit** (après coup, sous Avancé) et il lui **manque deux
stratégies** (la grille de déformation et l'échange d'états).

**③ Le vocabulaire des conditions.** « ce paramètre, cet opérateur, cette
valeur », normalisé et testé (`runtime/reaction-conditions.js`, V4-090). C'est
ce qui manque pour dire *quand* un état s'affiche.

> **Conséquence.** Le seul vrai travail de runtime neuf est de généraliser ① à
> une partie quelconque. Tout le reste est du câblage, de l'UI et de la
> suppression.

---

## 2. Le modèle cible

Une mascotte est une **liste de pièces**. Une pièce a trois choses, et
seulement trois :

```text
PIÈCE
  ├─ un dessin        une ou plusieurs images (PNG/WebP), ou un SVG
  ├─ un rôle          à quoi ça sert : tête, œil gauche, bouche, décor…
  └─ un rigging       comment ça bouge : fixe, rigide, déformable, états, vectoriel
```

C'est tout. Pas de morphologie, pas de preset, pas de « type de mascotte » à
choisir d'avance : un chat, un robot, une théière et une photo de quelqu'un
sont la même chose — des pièces avec des rôles.

Le **rôle** reste celui du registre existant (`part-registry.js`), qui sait
déjà quels mouvements va avec quoi : une pièce en rôle `mouth` gagne
`mouthOpen`/`smile`, une pièce en rôle `leftEye` gagne `eyeOpen`. Ce qui
change, c'est qu'un rôle devient **optionnel** : une pièce sans rôle est du
décor qui bouge avec le reste, et c'est un cas de première classe, pas un
échec.

### Ce que ça supprime comme concept

- **La morphologie** (humain / animal / robot / oiseau). Elle existait pour
  savoir quels emplacements offrir dans un catalogue. Sans catalogue, la
  question ne se pose plus : l'auteur apporte ses pièces.
- **Le preset** (une recette de 7 dessins de la bibliothèque). Sans
  bibliothèque, il n'y a rien à recomposer.
- **L'emplacement** (`slot`). Une pièce se pose où on la pose.

---

## 3. Ce qui part

| Fichier / dossier | Lignes | Raison |
| --- | ---: | --- |
| `core/face-library/face-presets.js` | 723 | les 22 recettes |
| `core/face-library/face-morphologies.js` | 151 | plus de morphologies |
| `core/face-library/builtin/` sauf `eyes` et `mouth*` | 477 | têtes, cheveux, oreilles, nez, accessoires, pilosité |
| `core/face-library/builtin/animals\|birds\|robots/` | 2 365 | catalogues par espèce |
| `core/face-library/pilots/` | 1 564 | pilotes muzzle / beak / robot |
| `core/face-library/compatibility.js`, `face-styles.js`, `face-layout.js` | 771 | filtrage et mise en page d'un catalogue qui n'existe plus |
| `ui/character-builder/` | 3 235 | remplacé par le flux d'ajout |
| `ui/new-mascot/` | 325 | l'assistant « quel genre de mascotte » |
| Tests `masc0*`, `face-preset*`, `character-builder`, `face-layout` | ~30 fichiers | ils testent ce qui part |

**Total : 9 611 lignes de source, et une trentaine de fichiers de tests.**
C'est un tiers de ce que pèse l'éditeur, retiré — d'où l'ordre des PR au §9 et
le risque du §11.

Ce qui **reste** de la bibliothèque : le modèle d'une pièce
(`face-part-model.js`), son installation (`face-part-install.js`), sa palette
(`palette-model.js`), et les dessins d'yeux et de bouches — retravaillés
comme dit plus bas. La bibliothèque cesse d'être un catalogue de visages pour
devenir **un petit jeu de pièces vectorielles qu'une mascotte en images ne
peut pas fabriquer elle-même**.

Ce qui reste aussi : **le preset de base**, la face toute faite
(`MASCOT_TEMPLATE`). Elle n'est plus une porte d'entrée mise en avant mais une
démo — « voir une mascotte finie qui bouge » — et elle sert de référence aux
tests de non-régression du rig.

---

## 4. La page d'arrivée

Elle doit expliquer **ce qu'il faut préparer**, en restant assez générale pour
n'importe quelle mascotte. Trois phrases et une illustration, pas un tutoriel.

```text
                        Une mascotte, à partir de vos images

        Découpez votre personnage en morceaux : ce qui doit bouger
        séparément est un fichier séparé.

        ┌─────────┐  ┌────┐ ┌────┐  ┌──────┐        PNG ou WebP
        │  corps  │  │œil │ │œil │  │bouche│        fond transparent
        └─────────┘  └────┘ └────┘  └──────┘        un morceau par fichier

              [ Commencer avec mes images ]

        Pas d'images sous la main ?  Voir une mascotte d'exemple
```

Ce que la page dit, et rien de plus :

1. **Un morceau par fichier.** C'est la seule règle qui compte, et c'est celle
   que personne ne devine.
2. **Fond transparent.** PNG ou WebP. C'est la raison pour laquelle le JPEG est
   refusé, et le dire ici évite le refus plus tard.
3. **Ce qui doit bouger séparément est séparé.** Formulé comme un principe et
   non comme une liste de parties, pour que ça vaille pour un visage, un robot,
   un animal ou un objet.

Ce qu'elle **ne** dit pas : quelles parties faire. Il n'y a pas de « il vous
faut une tête, deux yeux et une bouche » — c'est précisément la contrainte que
cette refonte enlève.

L'illustration est un schéma, pas une mascotte : montrer un visage humain
rendrait implicite ce que le texte s'efforce de ne pas imposer.

---

## 5. Le flux d'ajout d'une pièce

C'est le cœur de la refonte, et c'est là que le choix du rigging se fait.

```text
  fichier déposé
        │
        ▼
  ┌──────────────────────────────────────────────┐
  │  bras-gauche.png            240 × 380        │
  │                                              │
  │  À quoi ça sert ?   [ Autre / décor      ▾ ] │
  │  Comment ça bouge ? [ Rigide             ▾ ] │
  │                     bouge, tourne, change    │
  │                     de taille                │
  │                                              │
  │              [ Ajouter ]                     │
  └──────────────────────────────────────────────┘
```

Deux questions, des valeurs par défaut sensées, et **le nom du fichier qui
répond déjà à la première** quand il le peut : la détection de rôle existante
(`face-role-detection.js`) comprend `eye`, `brow`, `pupil`, `mouth`, `head` et
les côtés `left`/`right`/`l`/`r`/`gauche`. Un fichier appelé `oeil-gauche.png`
arrive avec son rôle déjà rempli.

Le rigging proposé par défaut découle du rôle :

| Rôle détecté | Rigging proposé | Pourquoi |
| --- | --- | --- |
| tête, corps, bras, décor | **Rigide** | ça se déplace entier |
| bouche | **États** | plusieurs apparences, voir §7 |
| œil / paupière | **États** (image) ou **Vectoriel** (SVG) | voir §6 |
| oreille, queue, cheveux | **Déformable** | ça plie |
| ombre, fond | **Fixe** | ça ne bouge pas |

L'auteur peut toujours changer — c'est une proposition, pas une décision prise
à sa place — et le choix reste modifiable après coup dans l'Inspecteur, là où
il vit déjà.

---

## 6. Les types de rigging

Cinq, et pas plus. Chacun est une phrase qu'un auteur peut lire sans savoir ce
qu'est un shape key.

| Type | Ce que ça fait | Convient à | Images | Vecteur |
| --- | --- | --- | :---: | :---: |
| **Fixe** | rien ne bouge | ombre, fond, décor | ✅ | ✅ |
| **Rigide** | se déplace, tourne, grandit, s'efface | corps, tête, bras, accessoire | ✅ | ✅ |
| **Déformable** | se plie sur une grille 3×3 ou 4×4 | oreille souple, joue, queue | ✅ | ✅ |
| **États** | plusieurs dessins, un seul affiché | paupières, bouches, mains | ✅ | ✅ |
| **Vectoriel** | le contour lui-même se déforme | yeux et bouches dessinés au trait | ❌ | ✅ |

Les quatre premiers existent déjà dans le moteur : *Rigide* est le binding de
transform, *Déformable* est le mesh de la Phase 7, *États* est le mécanisme des
mains, *Fixe* est l'absence de binding. **Le seul travail neuf est de
généraliser *États* à une pièce quelconque.**

*Vectoriel* est grisé avec sa raison quand la pièce est une image — « le
contour d'une image, ce sont ses pixels » — plutôt qu'absent : une option
absente est une option qu'on croit manquante.

---

## 7. Les yeux et les paupières

C'est la partie qu'une image seule ne peut pas faire correctement, et c'est
pour ça que le SVG reste.

**Le problème d'aujourd'hui.** Une paupière est un chemin qui se translate ou
se morphe vers une position fermée. L'apparence fermée est donc *ce que la
translation produit* — l'auteur ne la choisit pas. Il ne peut pas dire « fermé,
c'est un arc content » plutôt que « fermé, c'est un trait ».

**Le modèle proposé : un jeu d'yeux.** Un jeu est un ensemble de dessins
vectoriels cohérents, posé sur n'importe quelle mascotte, redimensionné et
recoloré :

```text
JEU D'YEUX « rond »
  ouvert      ●  le blanc, la pupille, le reflet
  mi-clos     ◐  pour un regard endormi et pour le milieu d'un clignement
  fermé       —  ← plusieurs choix ici
  ├─ trait          une ligne droite
  ├─ arc content    ∪ retourné, l'œil de sourire
  ├─ cils           le trait avec trois cils
  └─ lourd          la paupière basse et épaisse
```

Ce que ça donne :

- **La pupille reste une pièce mobile** : le regard (`lookX`/`lookY`,
  `gazeX`/`gazeY`) continue de marcher exactement comme aujourd'hui, parce que
  c'est une transformation sur une pièce et pas une déformation.
- **Le clignement devient un échange d'états** piloté par `eyeOpen` : ouvert
  au-dessus de 0,6 · mi-clos entre 0,2 et 0,6 · fermé en dessous. Le runtime
  n'interpole plus une paupière, il choisit un dessin — ce qui est aussi ce qui
  rend le clignement *net* au lieu de mou.
- **L'apparence fermée est un choix**, offert au moment où l'œil est ajouté et
  changeable ensuite.

Une mascotte en images peut aussi fournir ses propres yeux : le même type
*États* accepte trois PNG. Le jeu SVG est là pour les auteurs qui n'ont pas
envie de dessiner trois paupières.

**Le règle d'affichage d'un état** réutilise le vocabulaire des conditions
(`reaction-conditions.js`) : une liste ordonnée, premier match gagnant, un état
par défaut. C'est déjà normalisé, déjà testé, déjà lisible en une phrase
(« quand `eyeOpen` est au plus 0,2 »).

---

## 8. La bouche

**Le problème d'aujourd'hui.** Une bouche est **une** forme fermée, étirée par
`mouthOpen` (scaleY), `smile` (translateY des coins) et `mouthWidth` (scaleX),
avec des dents et une langue qui apparaissent en fondu. Une seule forme
étirée ne peut pas faire un A, un O, un sourire et une moue : au-delà de
quelques degrés d'étirement ça ne ressemble plus à une bouche, et c'est ce que
« beaucoup plus propre » veut dire.

**Le modèle proposé : un jeu de bouches**, même mécanisme que les yeux.

```text
JEU DE BOUCHES « cartoon »
  fermée      ‿     au repos
  sourire     ◡     smile ≥ 0,4
  ouverte     ○     mouthOpen ≥ 0,5
  grande      ◎     mouthOpen ≥ 0,85   (dents visibles)
  triste      ◠     smile ≤ −0,4
```

Trois conséquences qui valent la refonte :

1. **Une apparence est un dessin**, donc elle est exacte. Un O est dessiné
   comme un O.
2. **Les jeux sont interchangeables.** « cartoon », « trait fin », « bec »,
   « grille de robot » sont des jeux différents avec les mêmes états ; changer
   de jeu ne touche pas au rig.
3. **La parole devient possible plus tard sans rien casser** : des visèmes sont
   des états supplémentaires avec leurs propres règles.

Ce qui est conservé du modèle actuel : une bouche peut **aussi** être
déformable par-dessus ses états (un jeu de dessins + une grille), pour les
mascottes qui veulent les deux. Les deux se composent parce que l'un choisit le
dessin et l'autre le plie.

---

## 9. Découpage

Onze PR, dans un ordre où chaque étape laisse l'éditeur utilisable.

| PR | Quoi | Taille |
| --- | --- | --- |
| **V5-01** | `runtime/part-states.js` : un jeu d'états, ses règles, l'état choisi. Généralisation de l'échange des mains, `part:states` dans `requires` | L |
| **V5-02** | Le type de rigging comme donnée de la pièce, et *États* dans le registre des stratégies | M |
| **V5-03** | Le flux d'ajout : fichier → rôle → rigging, avec les défauts déduits du nom | L |
| **V5-04** | La nouvelle page d'arrivée | M |
| **V5-07a** | L'éditeur ouvre sur Artwork : `DEFAULT_MODE`, l'ordre des écrans de Design, la colonne Artwork | M |
| **V5-07b** | Retrait du Character Builder et de l'assistant | **L** |
| **V5-05** | Retrait des 22 presets et des morphologies | M |
| **V5-06** | Retrait des dessins non conservés et des catalogues par espèce | L |
| **V5-08** | Le jeu d'yeux SVG, avec les quatre apparences fermées | L |
| **V5-09** | Le jeu de bouches SVG et la bascule du rig de bouche vers les états | L |
| **V5-10** | Migration : un projet existant s'ouvre, ses presets deviennent des pièces ordinaires | M |
| **V5-11** | Mascottes de référence, matrice de validation, notes de version | M |

**V5-01 à V5-04 avant toute suppression** : construire la porte d'entrée avant
de retirer l'ancienne, pour ne jamais être dans un état où on ne peut plus
commencer une mascotte.

### Correction d'ordre, trouvée en implémentant

Le découpage initial supprimait les presets (V5-05) avant le Character Builder
(V5-07) qui les parcourt. **C'est l'ordre inverse du bon** : vider une
bibliothèque que son écran affiche encore laisse une grille vide, c'est-à-dire
un écran cassé entre deux PR. Les consommateurs partent d'abord, la donnée
ensuite.

Et V5-07 est plus gros qu'annoncé. `design.face` — l'écran du Character
Builder — est le **mode par défaut de l'éditeur** (`DEFAULT_MODE`,
`ui/task-router.js`) : c'est là qu'on atterrit en ouvrant un projet. Le retirer,
c'est aussi choisir le nouveau défaut (`design.artwork`, là où les images
arrivent), et reprendre le routeur, la barre d'écrans et la quarantaine de
tests qui y naviguent. D'où **XL** plutôt que L, et d'où le fait que ce soit la
seule PR de ce plan qui mérite d'être découpée elle-même.

#### Le découpage de V5-07

**V5-07a — l'éditeur ouvre là où sont les pièces.** `DEFAULT_MODE` passe à
`design.artwork`, qui cesse d'être `advanced` (un écran que le mode simple doit
replier ne peut pas être l'écran d'arrivée) et passe en tête de Design. Un
template chargé depuis l'accueil y atterrit aussi : ouvrir un projet y menait
déjà. Le Character Builder reste joignable, par son onglet et par l'accueil.
Six tests unitaires disaient « Face », ils disent « Artwork ».

**V5-07b — le Character Builder et l'assistant s'en vont.** 3 560 lignes, mais
deux d'entre elles ne sont pas à supprimer : `ring-keys.js` (la navigation au
clavier en anneau, lue par `shell/workspace-nav.js`) et `hand-placement-panel.js`
(`HAND_LABELS`, lu par `ui/artwork-scope.js` et `ui/hands/hand-states.js`) ne
sont dans ce dossier que par accident d'écriture. Elles **déménagent**. Le reste
part : sept importateurs dans le code produit, quinze fichiers de tests
unitaires, quatorze specs navigateur — dont trois qui n'existent que pour lui
(`ux45`, `ux48`, `ux49`) et onze qui le traversent pour aller ailleurs et qu'il
faut reformuler, pas supprimer.

---

## 10. Ce qu'il faut décider, et ce qu'on ne fait pas

**À décider avant V5-01**

- **Les états sont-ils dans `rig.json` ?** Oui à mon sens : un exporté doit
  pouvoir cligner. Ça veut dire un marqueur `part:states` dans `requires`, comme
  les conditions de la Phase 9 — un runtime qui ignore les états afficherait
  tous les dessins l'un sur l'autre, ce qui est pire que de refuser.
- **Combien d'états par pièce ?** Je propose de ne pas plafonner mais de
  n'offrir que 3 à 5 emplacements nommés dans l'UI : au-delà, c'est une
  animation image par image, et ce n'est pas ce que cet éditeur fait.

**Ce qu'on ne fait pas**

- **Pas de détourage automatique.** « Enlever le fond » demande un modèle, fait
  moins bien que l'outil avec lequel l'auteur a découpé son image, et le dire
  sur la page d'arrivée coûte une phrase au lieu d'un sous-produit.
- **Pas d'interpolation entre deux images.** Un état remplace un état. C'est la
  règle des mains et elle est juste : rien n'interpole honnêtement entre deux
  photographies.
- **Pas de JPEG.** Une pièce a besoin d'un canal alpha.
- **Pas de reconstruction du rig existant.** Les paramètres, les expressions,
  les motions, les réactions et le state machine ne bougent pas. Une pièce en
  états écrit un paramètre comme n'importe quelle autre.

---

## 11. Risque principal

**Les 41 fichiers de tests.** Une trentaine testent ce qui part et se
suppriment avec, mais une dizaine testent *à travers* la bibliothèque des
choses qui restent — le turn 2.5D, la palette, le follow de la pilosité, la
matrice d'animation des parties. Ceux-là doivent être **reformulés sur le
preset de base** avant que la bibliothèque parte, pas après : c'est le seul
endroit de ce plan où l'ordre n'est pas négociable.
