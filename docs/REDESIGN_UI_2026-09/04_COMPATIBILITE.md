# 04 — Compatibilité, métadonnées et filtrage

## A. Le constat qui change tout

> **Le filtrage demandé en §5 et §8 existe, fonctionne, est testé, et est déjà
> appelé par l'interface.**

```js
// ui/character-builder/character-builder.js:163      ← les pièces
const offered = assetsFor({ library, morphology: activeMorphology(), slot: row.id })

// ui/character-builder/character-builder.js:247      ← les presets
presetsFor({ presets, library, morphology: activeMorphology() })

// ui/character-builder/character-builder.js:88       ← les rangées de catégories
deriveVisualRows(…, { morphology: activeMorphology() })
```

Vérifié en exécutant le registre :

```text
presetsFor({morphology:'human'})   classic professor young old robot minimal
presetsFor({morphology:'muzzle'})  cat dog fox bear wolf rabbit
presetsFor({morphology:'beak'})    owl duck parrot crow cute-bird slim-bird
presetsFor({morphology:'robot'})   robot-screen robot-retro robot-industrial robot-toy
```

**Aucune fuite.** Un preset humain n'apparaît jamais sous *Oiseau*. La demande
§8 — « il ne doit plus être possible d'avoir une bibliothèque mélangeant humains,
oiseaux, animaux, robots, objets » — est déjà satisfaite *à condition que
quelqu'un ait choisi un type*.

### Ce qui ne va donc pas

Trois défauts, tous d'interface, aucun de moteur :

| # | Défaut | Preuve |
| --- | --- | --- |
| **C1** | **Le type n'est jamais demandé**, et vaut `'human'` par défaut | `character-builder.js:194` |
| **C2** | Le filtrage s'arrête aux **pièces et aux presets**. Il ne touche ni la recherche (inexistante), ni les suggestions, ni un bouton *Remplacer* (inexistant), ni les rangées vides | §5 de la demande énumère 7 surfaces, 2 sont couvertes |
| **C3** | Il n'y a **aucune échappatoire** : le mode « tout afficher » de §6 n'existe pas. Un auteur qui veut des oreilles de chat sur un humain ne peut pas | audit `9.2` |

Le travail n'est donc pas d'écrire un moteur de compatibilité. Il est de
**brancher celui qui existe sur les cinq surfaces qui l'ignorent**, et de lui
ajouter une porte de sortie.

---

## B. Vocabulaire : ce que l'utilisateur lit, ce que le code garde

Le code nomme les morphologies par **ce dont la face est faite**. C'est la bonne
règle pour le modèle, et la mauvaise pour un écran.

```text
interne (inchangé)   visible (nouveau)     pourquoi
──────────────────   ──────────────────    ─────────────────────────────────
human                Human                 —
muzzle               Animal                on choisit un chat, pas un museau
beak                 Bird                  on choisit une chouette, pas un bec
robot                Robot                 —
monster              Creature              « monstre » est plus étroit que le contenu visé
```

> **Langue.** L'interface de Boop est en anglais ; cette étude est en français.
> Les libellés livrés sont donc `Human · Animal · Bird · Robot · Creature`.
> Le principe est le même dans les deux langues : le mot visible décrit **ce
> que l'auteur fabrique**, jamais l'anatomie qui le compose.

**Rien ne change dans les données.** Une table de libellés, à côté de la table de
morphologies, et une seule règle : `FACE_MORPHOLOGIES[id].label` devient un
libellé d'auteur ; l'id reste `muzzle` dans le document, dans les packs, dans les
assets et dans les tests.

```js
// core/face-library/face-morphologies.js — MORPHOLOGY_TABLE, colonne 2
['muzzle', 'Animal',   'Un chat, un chien, un renard, un ours : un museau devant le visage.', […]],
['beak',   'Oiseau',   'Un oiseau : un bec qui s\'ouvre, et une crête à la place des cheveux.', […]],
```

C'est **une ligne de diff par morphologie**, et `masc01-morphology.test.js`
continue de vérifier les ids.

Les mêmes règles s'appliquent aux emplacements (`FACE_SLOTS`) :

| interne | aujourd'hui | proposé |
| --- | --- | --- |
| `facialHair` | Facial Hair | Barbe et moustache |
| `crest` | Crest | Crête |
| `panels` | Panels | Plaques |
| `antenna` | Antenna | Antenne |
| `pupils` | Pupils | Regard |
| `eyelids` | Eyelids | Paupières |

---

## C. Les métadonnées, auditées champ par champ (demande §7)

`normalizeFacePart()` gèle 24 champs. Confrontés aux dix demandés :

| Demandé §7 | Champ existant | État |
| --- | --- | --- |
| catégorie | `category` (11 valeurs, liées au rig) | ✅ |
| sous-catégorie | `slot` (18 valeurs) + `assetSlot()` de repli | ✅ |
| type de mascotte compatible | `morphologies: []` — **vide = universel** | ✅ |
| styles compatibles | `variant: { of, style }` | ⚠ *voir C.1* |
| emplacement | `mountPoint` (15 ancres nommées) | ✅ |
| symétrie éventuelle | — **dérivée**, pas déclarée | ⚠ *voir C.2* |
| côté gauche / droit | via les clés de `roles` (`leftEye`, `rightEar`…) | ✅ |
| possibilité de duplication | `category.multiple` | ⚠ *au niveau catégorie* |
| parent logique | `host: { part, role }` | ✅ **excellent** |
| profondeur recommandée | `depth` (nombre, `null` = celle de l'élément) | ✅ |

Plus six champs que §7 ne demandait pas et qui servent directement l'interface :
`tags` (vocabulaire libre, 103 dessins sur 150 en portent), `paletteRoles`,
`referenceBox`, `behind`, `pack`, `origin`.

> **Neuf champs sur dix sont là.** Le modèle de §7 n'est pas à construire ; il est
> à compléter de deux champs et à exploiter.

### C.1 — Le champ « styles compatibles »

Aujourd'hui un dessin dit *dans quel style il est* (`variant.style`), pas
*quels styles il accepte*. C'est le bon modèle : un dessin est dans un style, et
`styledAsset()` cherche s'il en existe une version dans le style demandé. Un
champ « styles compatibles » serait une deuxième vérité à tenir en phase.

**Recommandation : ne rien ajouter.** La question « ce style peut-il redessiner
cette pièce ? » est déjà répondue par `restylePlan()`, et sa réponse à trois
états (`replace` / `already` / `kept`) est plus juste qu'un booléen.

### C.2 — La symétrie : le seul manque réel

La paire gauche/droite est **reconstruite** à l'exécution par le builder
(`pairOf`, `character-builder.js:382`, miroir de `X` et de la rotation), à partir
des noms de rôles. Cela marche pour les onze catégories du rig, et **pas** pour
une pièce dessinée à la main ni pour un accessoire d'un pack.

**Évolution minimale proposée**, un champ, optionnel, silencieux par défaut :

```js
// normalizeFacePart(), à côté de `slot` et `morphologies`
// Comment la pièce se comporte en paire, quand elle en fait une.
//   null          → le comportement d'aujourd'hui (déduit des rôles)
//   'mirror'      → l'axe X et la rotation sont miroités
//   'independent' → deux exemplaires, jamais liés
//   'single'      → une seule, jamais dupliquée (un nez, un bec)
symmetry: ['mirror','independent','single'].includes(source.symmetry) ? source.symmetry : null,
```

Et un second, pour §7 « possibilité de duplication », aujourd'hui décidé au
niveau de la catégorie et donc faux pour les slots dédiés (un museau est un
`accessory`, donc `multiple`, alors qu'on n'en porte qu'un) :

```js
// Combien la face peut en porter. 0 = ce que dit la catégorie.
maxInstances: Number.isInteger(Number(source.maxInstances)) && source.maxInstances > 0 ? Number(source.maxInstances) : 0,
```

`visual-rows.js` contourne déjà ce problème avec un drapeau `dedicated` calculé ;
ce champ le rend déclaratif et le rend disponible aux packs.

**Coût** : deux lignes dans `normalizeFacePart`, deux dans `validateFacePart`,
zéro migration (les deux sont optionnels et rétro-compatibles par construction —
c'est le contrat que `morphologies` a déjà posé : *« un asset qui ne dit rien est
universel »*).

### C.3 — Trois emplacements vides

```text
pupils   0 dessin   mais listé dans 5 morphologies sur 5
eyelids  0 dessin   listé dans human
horns    0 dessin   listé dans monster → rend `monster` indisponible
```

`Pupils` et `Eyelids` produisent des lignes toujours vides dans la colonne. Trois
options, par ordre de préférence :

1. **Masquer une rangée dont la bibliothèque n'a rien**, sauf si la mascotte en
   porte déjà une (un template en a). `slotsFor()` renvoie déjà `count`, donc
   c'est un filtre d'une ligne dans `deriveVisualRows`.
2. Les dessiner. Les pupilles et les paupières sont **déjà incluses dans les
   dessins d'yeux** (`eyes.round-large` contient `pupilLeft`, `lidUpperLeft`…) :
   ce sont des rangées qui décrivent des pièces que personne n'installe
   séparément.
3. Les retirer des morphologies. **Déconseillé** : le rig s'en sert (`gaze`,
   `eyelids` sont des parties sémantiques à part entière).

---

## D. Le filtrage étendu aux sept surfaces

La demande §5 énumère sept endroits. État actuel et cible :

| Surface | Aujourd'hui | Cible | Comment |
| --- | --- | --- | --- |
| Presets | ✅ filtré | ✅ | déjà `presetsFor()` |
| Bibliothèque (pièces) | ✅ filtré | ✅ | déjà `assetsFor()` |
| Catégories / rangées | ✅ ordonnées par morphologie | ✅ + masquage des rangées vides | `deriveVisualRows` + `slotsFor().count` |
| **Résultats de recherche** | ❌ pas de recherche | ✅ | `assetsFor({ …, query })` — voir [05](05_BIBLIOTHEQUE.md) |
| **Suggestions** | ❌ n'existent pas | ✅ | tags du personnage → tri, pas filtre |
| **Bouton Remplacer** | ❌ n'existe pas | ✅ | ouvre la bibliothèque *déjà* sur le slot |
| **Éléments recommandés** | ❌ | ✅ | 4 premiers par score de tag |

### Une seule fonction d'accès, partout

Toute surface qui liste des dessins passe par **une seule requête**, ce qui rend
impossible d'oublier un filtre :

```js
// core/face-library/compatibility.js — signature étendue, rétro-compatible
export function assetsFor({
  library, morphology, style, slot,
  query = '',            // nom + description + tags
  includeIncompatible = false,   // l'échappatoire de §6
  affinity = []          // tags du personnage, pour trier — jamais pour filtrer
} = {})
```

Trois règles d'implémentation, à tenir :

1. `includeIncompatible` **n'élargit jamais le slot** : demander des yeux
   renvoie des yeux, compatibles ou non, jamais des becs.
2. `affinity` **trie**, ne filtre pas. Un renard propose d'abord les oreilles
   taguées `fox`, puis `canine`, puis le reste — mais le reste est là.
3. La fonction reste **pure** et sans DOM, comme aujourd'hui.

---

## E. Le mode « Tout afficher » (demande §6)

### Où il vit

Pas un réglage global, pas une préférence de projet : **une bascule locale à la
bibliothèque**, dans son en-tête, à côté de la recherche.

```text
┌─────────────────────────────────────────────────────────┐
│  Oreilles                              12 dessins       │
│  ┌───────────────────────────────┐  ┌────────────────┐  │
│  │ 🔍 Chercher                   │  │ Compatibles ▾  │  │
│  └───────────────────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
                                          │
                                          ├─ ✓ Compatibles avec Oiseau
                                          └─   Toute la bibliothèque   (+38)
```

| Décision | Choix | Pourquoi |
| --- | --- | --- |
| Forme | un menu à deux entrées, pas une case à cocher | une case *« afficher les incompatibles »* décochée est une accusation ; un menu est un point de vue |
| Défaut | **Compatibles**, toujours, à chaque ouverture | §6 : « ce mode doit être secondaire » |
| Persistance | la session, jamais le projet | c'est une préférence d'auteur, pas une donnée (règle D du dépôt) |
| Le `+38` | affiché **avant** de basculer | c'est ce qui rend la bascule découvrable sans l'imposer |
| Après bascule | les dessins hors-type portent une pastille discrète `Humain` | l'auteur sait ce qu'il prend, sans qu'on l'en empêche |
| Retour | la bascule revient à *Compatibles* en changeant de rangée | on n'est jamais bloqué en mode expert par accident |

### Ce qui se passe quand on pose une pièce incompatible

**Rien de spécial, et c'est volontaire.** L'installation est la même :
`facePartCommands.install()` ne consulte pas la morphologie — la compatibilité
est une affaire d'offre, pas de règle. Une seule chose change, dans le calcul du
type courant :

```js
// morphologiesOfFace() renvoie déjà [] quand les pièces ne s'accordent plus
const worn = morphologiesOfFace(doc(), { library });   // []  → face hybride
```

La barre de titre du builder passe alors de `Oiseau › Chouette` à
`Oiseau › Chouette · modifié`, et la bibliothèque **reste filtrée sur le type
choisi**, qui demeure l'intention déclarée. C'est le comportement souhaité par
§6 : « le logiciel doit guider sans limiter ».

### Les quatre exemples de §6, vérifiés contre les assets

| Souhait | Faisable aujourd'hui ? |
| --- | --- |
| un humain avec des oreilles animales | ✅ 11 oreilles `muzzle` + 3 universelles |
| un oiseau avec une moustache | ✅ 5 dessins `facialHair`, tous universels |
| un robot avec des yeux humains | ✅ 5 yeux universels, 9 `robot` |
| une créature hybride | ✅ par composition ; le type `Créature` reste indisponible tant qu'aucune corne n'existe |

---

## F. Les presets contextuels (demande §8)

### Déjà vrai

`presetsFor()` partitionne sans fuite. Le seul défaut est de **présentation** :
les 22 presets sont rendus par `preset-browser.js` dans une rangée de
`.face-preset` de 64 px, derrière une ligne d'accordéon `★ Presets`, et il n'y a
aucun titre de groupe.

### Deux corrections

**F.1 — Un personnage n'est plus un « preset ».** Le mot est technique et il
désigne deux choses différentes dans la même liste :

```text
aujourd'hui, dans la même rangée :
  [Mascot Face]   ← un TEMPLATE : un projet complet, avec confirmation
  [Classic] [Professor] [Young] …  ← des RECETTES appliquées à la face en place
```

Deux natures, deux conséquences (l'un remplace le projet, l'autre est une étape
d'undo), un seul endroit. Le redesign les sépare :

| Ce que c'est | Nom visible | Où |
| --- | --- | --- |
| une recette sur la face en place | **Modèle** | ligne *Modèle* du builder, et étape 2 de l'assistant |
| un projet complet à charger | **Repartir de zéro** | menu `•••`, avec sa confirmation |
| la recette de l'auteur | **Mes modèles** | même rangée, badge `Mien` |

**F.2 — `defaultPreset` est faux pour les oiseaux.**

```js
// core/face-library/face-morphologies.js
['beak', 'Beak', '…', ['head','eyes','pupils','eyebrows','beak','crest','accessory'], null],
                                                                                      ↑
                                                          six presets d'oiseau existent
```

`null` datait de MASC-12A, avant que `owl`, `duck`, `parrot`, `crow`,
`cute-bird` et `slim-bird` ne soient dessinés. À corriger en `'owl'` (le plus
reconnaissable), ce qui donne à *Oiseau* une vignette de carte de type et un
défaut pour « Surprends-moi ».

`monster` garde `null` — c'est exact, il n'a rien.

---

## G. Ce que l'utilisateur ne doit jamais voir

Conformément à §7 (« cela doit servir à l'interface mais ne doit normalement
jamais être visible ») et §25, la liste des fuites actuelles à colmater :

| Fuite | Où | Remplacement |
| --- | --- | --- |
| `Muzzle`, `Beak`, `Monster` | cartes de type | Animal, Oiseau, Créature |
| `morphology`, `slot`, `category` | bulles d'aide, formulaire de sauvegarde | jamais |
| `Nothing is drawn for its horns yet` | carte de type désactivée | la carte n'est pas affichée |
| `3 movements are not carried by this drawing` | cartes de bibliothèque | pastille `Limité` + bulle en langage d'intention |
| `Goes on as accessory — what the rig knows it by` | formulaire de sauvegarde | `Où elle se pose : sur la tête` |
| `ID: eyeLeft` | panneau de calques | sous `▸ Avancé` (audit `P1-8`) |
| `Semantic part "x": role "y" references missing element "z"` | Project check | audit `P1-7` |
