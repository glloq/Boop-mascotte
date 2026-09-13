# 03 — Le parcours de création

## A. Ce que la bibliothèque contient vraiment

Compté en important le registre, pas en lisant la documentation :

```text
150 dessins            0 variante de style
 22 personnages prêts   5 morphologies, dont 4 utilisables
```

### Les dessins, par emplacement

```text
head 24   eyes 21   eyebrows 19   ears 15   mouth 14   nose  9
accessory 7   hair 6   muzzle 6   beak 6   crest 6   facialHair 5
antenna 4   panels 4   whiskers 4
───────────────────────────────────────────────────────────────
pupils 0   eyelids 0   horns 0        ← trois emplacements vides
```

### Ce que chaque type peut réellement offrir

| Type interne | Dessins offerts | Presets | Disponible | Manque |
| --- | --- | --- | --- | --- |
| `human` | 48 | 6 | ✅ | — |
| `muzzle` | 88 | 6 | ✅ | — |
| `beak` | 54 | 6 | ✅ | — |
| `robot` | 61 | 4 | ✅ | — |
| `monster` | 39 | **0** | ❌ | aucune corne dessinée |

### Les 22 personnages, groupés par type

```text
human   classic · professor · young · old · robot · minimal
muzzle  cat · dog · fox · bear · wolf · rabbit
beak    owl · duck · parrot · crow · cute-bird · slim-bird
robot   robot-screen · robot-retro · robot-industrial · robot-toy
monster (aucun)
```

Le partitionnement est **parfait** : `presetsFor({morphology})` ne renvoie jamais
un preset d'un autre type. Le moteur de §8 est déjà là.

---

## B. Le problème : la question n'est jamais posée

```js
// ui/character-builder/character-builder.js:191
function activeMorphology() {
  if (morphology) return morphology;                       // si on a pressé Type
  const worn = morphologiesOfFace(doc(), {…});
  return worn.length === 1 ? worn[0] : 'human';            // sinon : human
}
```

Et le choix du type est une **ligne d'accordéon repliée**, en deuxième position
d'une liste de seize, entre `★ Presets` et `◑ Style` :

```js
// ui/character-builder/character-model.js:40
Object.freeze({ id: 'type', label: 'Type', kind: 'type', glyph: '◇',
  hint: 'Human, muzzle, beak, robot, monster: what kind of face this is' }),
```

Le résultat, chiffré :

> Un nouvel utilisateur qui ne trouve pas la ligne *Type* voit **48 dessins sur
> 150** et **6 personnages sur 22**. Les 102 autres dessins et les 16 autres
> personnages existent, sont testés, sont dessinés — et sont invisibles.

Trois aggravations :

1. Le composant `type-browser.js` dit lui-même : *« Choosing a kind **changes
   nothing on the face.** »* C'est un choix correct pour une ligne d'accordéon
   qu'on presse par curiosité au milieu d'un travail — et c'est le contraire de
   ce qu'il faut pour la première décision d'un parcours.
2. Les libellés sont anatomiques, pas utilisateurs : **`Muzzle`** et **`Beak`**
   sont les mots du code. Personne ne cherche « un museau », on cherche « un
   chat ».
3. `Monster` est affiché et désactivé en permanence, avec la note *« Nothing is
   drawn for its horns yet »* — soit une promesse non tenue, en deuxième ligne
   du panneau le plus important.

---

## C. La taxonomie proposée

**Principe : ne rien inventer.** Chaque entrée de la taxonomie visible doit
correspondre à des dessins qui existent. La taxonomie est donc la morphologie
existante, renommée en mots d'utilisateur et **redécoupée là où les presets le
justifient déjà**.

### Niveau 1 — Type (5 cartes)

| Carte visible | Morphologie interne | Vraie ? | Ce qu'elle ouvre |
| --- | --- | --- | --- |
| **Humain** | `human` | ✅ 48 dessins, 6 personnages | 6 personnages |
| **Animal** | `muzzle` | ✅ 88 dessins, 6 personnages | 6 personnages |
| **Oiseau** | `beak` | ✅ 54 dessins, 6 personnages | 6 personnages |
| **Robot** | `robot` | ✅ 61 dessins, 4 personnages | 4 personnages |
| **Créature** | `monster` | ❌ 0 personnage | *voir ci-dessous* |

**Décisions à assumer :**

- **`Oiseau` est promu au niveau 1**, à côté d'`Animal`, au lieu d'être un
  sous-type d'animal. Raison : dans le code, `beak` **est** une morphologie
  sœur de `muzzle`, pas son enfant — un oiseau n'a pas de museau, il n'hérite
  d'aucun dessin d'`Animal`. En faire un sous-type ajouterait une étape qui ne
  filtre rien, et le sous-niveau d'`Animal` (mammifère / oiseau / reptile /
  poisson) contiendrait **une entrée peuplée sur quatre**. La demande §4 donne
  cet arbre en exemple ; les assets ne le portent pas.
- **`Créature` n'est pas affichée tant qu'aucune corne n'est dessinée.** Une
  carte grisée en permanence n'est pas une promesse, c'est une frustration
  répétée à chaque création. Elle réapparaît **automatiquement** dès que
  `availableMorphologies()` la déclare disponible — le mécanisme existe déjà.
- **`Personnalisé`** (demande §3) est rendu par une entrée discrète **sous** la
  grille, pas par une sixième carte : `Partir d'un dessin vide` et
  `Importer un SVG`. Ce ne sont pas des types de mascotte, ce sont des origines.

### Niveau 2 — Personnage

C'est ici que se trouve la découverte la plus importante de l'étude :

> **Le sous-type demandé en §4 existe déjà — ce sont les presets.**

```text
demande §4                     réalité du dépôt
─────────────────────          ──────────────────────────────
ANIMAL                         morphology: muzzle
 → Mammifère                    (niveau sans contenu distinct)
   → Chat                       preset 'cat'    → 6 pièces + 2 accessoires
   → Chien                      preset 'dog'
   → Renard                     preset 'fox'
   → Ours                       preset 'bear'
   → Rongeur                    preset 'rabbit'
   → Générique                  preset 'wolf'
```

`cat` n'est pas une catégorie qui mènerait ensuite à un choix de base : **c'est
la base**. Le commentaire de `face-morphologies.js` le dit explicitement :

> *« `cat`, `dog`, `fox` and `bear` are **not** here: they are presets inside
> `muzzle`. A morphology is what a face is made of; a preset is what it looks
> like. Adding a species should cost drawings, never a release. »*

Insérer un niveau « Mammifère » entre *Animal* et *Chat* ajouterait donc une
étape qui ne divise rien : les six presets de `muzzle` sont tous des mammifères.

### Niveau 3 — Style : **à supprimer**

```text
FACE_STYLES = { 'soft-cartoon': { base: true } }     1 entrée
variantes dessinées                                   0
```

L'axe de style est un **catalogue à une entrée, sans aucune variante derrière**.
Une étape « Choisissez un style » afficherait aujourd'hui exactement une carte,
déjà sélectionnée, non pressable (`faceStyleState()` renvoie `current`).

> **L'étape 3 de la demande §9 est, à ce jour, une étape à un choix.** Elle est
> retirée du parcours et reste accessible dans le builder, où elle a un sens le
> jour où un pack apporte des variantes : le mécanisme (`variant: {of, style}`,
> `styledAsset`, `restylePlan`) est complet et testé, il n'attend que des
> dessins.

Le parcours **la réintroduit automatiquement** quand elle vaut quelque chose :

```js
// pseudo-code de l'assistant
const styles = availableFaceStyles(library).filter((s) => s.variants > 0);
const steps = styles.length >= 2 ? [TYPE, STYLE, CHARACTER] : [TYPE, CHARACTER];
```

### La hiérarchie finale

```text
Mascotte
 └── Type          Humain · Animal · Oiseau · Robot    (· Créature, quand dispo.)
      └── Personnage    Chat · Chien · Renard · Ours · Loup · Lapin
           └── Personnalisation   (dans le Builder, pas dans l'assistant)
                └── Style          (réapparaît si ≥ 2 styles dessinés)
```

Soit **deux décisions avant de voir une mascotte**, et non cinq.

---

## D. Le parcours retenu : deux étapes, un aperçu

### Comparaison avec la demande §9

| Étape §9 | Décision | Motif |
| --- | --- | --- |
| 1 · Choisissez votre mascotte | **gardée** | c'est la décision qui filtre tout |
| 2 · Choisissez une famille | **fusionnée avec 4** | la famille *est* la base (les presets) |
| 3 · Choisissez un style | **retirée** | 1 style, 0 variante |
| 4 · Choisissez une base | **gardée**, devient l'étape 2 | |
| 5 · Personnalisez | **sortie de l'assistant** | c'est le Builder, pas un formulaire |
| 6 · Modifier dans l'éditeur | **supprimée en tant qu'étape** | le Builder *est* l'éditeur |

### Le parcours

```text
    Home                ÉTAPE 1              ÉTAPE 2            CHARACTER BUILDER
  ┌────────┐          ┌─────────┐          ┌─────────┐          ┌──────────────┐
  │  + Nou-│   ───►   │  Type   │   ───►   │Personnage│  ───►   │ tout le reste │
  │  velle │          │ 4 cartes│          │ 4–6 cartes│         │ non modal     │
  └────────┘          └─────────┘          └─────────┘          └──────────────┘
                          ↑                     ↑                      ↑
                    aucun retour          « ← Type »            « ← Changer de
                     nécessaire            reste possible          personnage »
```

**Deux clics entre l'accueil et une mascotte complète, rigguée, à l'écran.**

### Pourquoi ne pas faire un assistant plein écran de six pages

Trois raisons, dont une tirée du code :

1. **Le rig est déjà posé par le preset.** `facePartCommands.applyPreset()`
   installe les pièces *et* leurs rôles sémantiques. Il n'y a rien à demander à
   l'utilisateur entre le personnage et la mascotte finie.
2. Une page « Personnalisez : tête, yeux, bouche, cheveux, couleurs,
   accessoires » serait **une deuxième version du Character Builder**, à
   maintenir en parallèle. Le Builder fait déjà exactement cela, avec l'undo,
   la sélection au canvas et l'inspector.
3. Un assistant qui se ferme donne l'impression d'un point de non-retour. Le
   Builder avec un fil d'Ariane `Animal › Renard` en haut permet de changer
   d'avis à tout instant, ce qui est le vrai confort.

---

## E. Les deux écrans de l'assistant

### Étape 1 — Type

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Annuler                  Nouvelle mascotte                     1 / 2  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                   Quelle mascotte voulez-vous créer ?                    │
│                                                                          │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ │
│  │               │ │               │ │               │ │               │ │
│  │    ( ◕  ◕ )   │ │   ( ᵔ ᴥ ᵔ )   │ │    ( > o < )  │ │   [ ▪   ▪ ]   │ │
│  │     \  ‿ /    │ │    \  ▽  /    │ │      \ ◣ /    │ │    [ ──── ]   │ │
│  │               │ │               │ │               │ │               │ │
│  │    HUMAIN     │ │    ANIMAL     │ │    OISEAU     │ │    ROBOT      │ │
│  │  6 modèles    │ │  6 modèles    │ │  6 modèles    │ │  4 modèles    │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ │
│                                                                          │
│     Autrement :   Partir d'un dessin vide   ·   Importer un SVG          │
└──────────────────────────────────────────────────────────────────────────┘
```

- Vignettes de **200 × 160**, le vrai preset par défaut du type rendu en SVG —
  pas une illustration dessinée à la main qui pourrait mentir.
- Un mot, une ligne de comptage. Rien d'autre.
- Le survol anime la vignette (un clignement) ; `prefers-reduced-motion` la fige.
- Aucune carte désactivée : un type non disponible **n'est pas affiché**.

### Étape 2 — Personnage

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Type                     Nouvelle mascotte                     2 / 2  │
├───────────────────────────────────┬──────────────────────────────────────┤
│                                   │                                      │
│   ANIMAL                          │                                      │
│   Lequel ?                        │                                      │
│                                   │              ( ᵔ ᴥ ᵔ )               │
│  ┌──────┐ ┌──────┐ ┌──────┐       │               \  ▽  /                │
│  │ (^ω^)│ │ (·ᴥ·)│ │ (>ᴥ<)│       │                                      │
│  │ Chat │ │ Chien│ │Renard│       │            aperçu en direct           │
│  └──────┘ └──────┘ └──────┘       │          (30 %)          (70 %)      │
│  ┌──────┐ ┌──────┐ ┌──────┐       │                                      │
│  │ (ᵔᴥᵔ)│ │ (ಠᴥಠ)│ │ (•ᴥ•)│       │                                      │
│  │ Ours │ │ Loup │ │ Lapin│       │                                      │
│  └──────┘ └──────┘ └──────┘       │                                      │
│                                   │                                      │
│  ☐ Surprends-moi                  │       ┌──────────────────────────┐   │
│                                   │       │  Créer cette mascotte →  │   │
└───────────────────────────────────┴───────┴──────────────────────────────┘
```

- **L'aperçu occupe 70 % de la largeur** (§11), et se met à jour au *survol*
  autant qu'au clic : survoler *Renard* montre le renard, sortir revient à la
  sélection.
- Une seule action principale, en bas à droite, pleine et large.
- `← Type` en haut à gauche : pas un « Précédent » générique, le nom de l'étape.
- Un double-clic sur une carte vaut carte + validation.

### Comportement au clavier

| Touche | Effet |
| --- | --- |
| `←` `→` `↑` `↓` | parcourt la grille (`ring-keys.js` le fait déjà) |
| `Entrée` | valide la carte focalisée et avance |
| `Échap` | revient à l'étape précédente, puis annule à l'étape 1 |
| `1`–`6` | sélectionne directement la n-ième carte |

---

## F. Cartes visuelles : les règles (demande §10)

| Règle | Valeur retenue | Pourquoi |
| --- | --- | --- |
| Taille de carte, assistant | 200 × 200 (type), 150 × 170 (personnage) | une mascotte se juge à sa silhouette, pas à 48 px |
| Taille de carte, bibliothèque | 96 × 112, vignette 80 px | contre 72 × ~70 / vignette 48 px aujourd'hui |
| Fond de vignette | `--bp-thumb-bg` neutre clair, **pas `#fff`** | le blanc pur est le seul de l'UI ; il crée des timbres qui vibrent |
| Libellé | 1 à 2 mots, jamais tronqué | `white-space:nowrap` + `ellipsis` masque aujourd'hui la moitié des noms |
| Sous-titre | une donnée, jamais une phrase | « 6 modèles », « 3 mouvements limités » |
| Survol | élévation + bordure accent + **échelle 1.02** | 200 ms, annulé par `prefers-reduced-motion` |
| Sélection | bordure 2 px accent **+ pastille ✓ en coin** | une différence de fond seule est invisible (voir 01, §F) |
| Désactivé | **non affiché** dans l'assistant ; `opacity .45` + raison en bulle dans le builder | un type indisponible ne doit pas coûter une décision |
| Focus | anneau 2 px `--bp-focus`, décalé de 2 px | distinct de la bordure de sélection |

**Ce qu'il faut éviter**, conformément à §10 : aucune de ces décisions ne doit
être portée par un `<select>`. Il n'y en a pas dans l'assistant.

---

## G. L'aperçu permanent (demande §11)

| Largeur de fenêtre | Disposition |
| --- | --- |
| ≥ 1200 px | 30 % options / **70 % aperçu**, côte à côte |
| 900–1199 px | 36 % / 64 % |
| < 900 px | aperçu en haut, hauteur `40vh`, fixe ; options défilantes dessous |

L'aperçu de l'assistant **est le canvas réel**, pas une image : le document est
construit par `applyPreset` dans un magasin temporaire, et le canvas existant le
rend. Deux conséquences :

- ce qu'on voit est exactement ce qu'on obtient ;
- il n'y a pas de deuxième moteur de rendu à écrire.

La mascotte y **cligne et bouge doucement** (comportement `blink` + oscillateur
`idle`, tous deux présents dans `core/behaviors/`), ce qui est la façon la plus
directe de dire « animée » sans l'écrire.

---

## H. La première minute (demande §27)

Parcours simulé : *ouverture → Animal → Oiseau → yeux → couleur → aperçu*.

### Aujourd'hui

| # | Geste | Ce qu'il faut déjà savoir | Verdict |
| --- | --- | --- | --- |
| 1 | Lire la Home | que *New Character* est le bon des deux ; que *Mascot Face* mène à l'éditeur vectoriel | ⚠ |
| 2 | Presser *New Character* | — | ✅ |
| 3 | Atterrir dans le Builder, colonne de 16 lignes | — | ⚠ densité |
| 4 | **Trouver le type** | que la ligne `◇ Type` en position 2 conditionne tout | ❌ **bloquant** |
| 5 | Comprendre `Beak` | que « Beak » veut dire oiseau | ❌ **bloquant** |
| 6 | Presser `Beak` | que cela **ne change rien** à la face affichée (elle reste humaine) | ❌ **déroutant** |
| 7 | Rouvrir `★ Presets` | qu'il faut revenir en arrière pour que le filtre serve | ❌ |
| 8 | Choisir *Owl* | — | ✅ |
| 9 | Changer les yeux | que `◉ Eyes` s'ouvre et montre une rangée `Styles` **sous** la ligne | ⚠ |
| 10 | Changer une couleur | que `◐ Colours` est une ligne d'accordéon, 4ᵉ position | ⚠ |
| 11 | Voir l'animation | que *Preview* est dans la barre du haut, pas dans Design | ⚠ |

**Trois blocages, cinq frictions, zéro documentation disponible dans l'écran.**
Le blocage 6 est le plus grave : presser le bon bouton ne produit aucun retour
visible, donc l'utilisateur conclut qu'il s'est trompé.

### Après

| # | Geste | Ce qu'il faut savoir | Verdict |
| --- | --- | --- | --- |
| 1 | Lire `Créez et animez votre mascotte` | — | ✅ |
| 2 | `+ Nouvelle mascotte` | — | ✅ |
| 3 | *Quelle mascotte voulez-vous créer ?* → **Oiseau** | — | ✅ |
| 4 | 6 oiseaux, aperçu en direct → **Chouette** | — | ✅ |
| 5 | `Créer cette mascotte` | — | ✅ |
| 6 | Builder, fil d'Ariane `Oiseau › Chouette`, la mascotte au centre qui cligne | — | ✅ |
| 7 | Cliquer un œil **sur la mascotte** → la ligne *Yeux* s'ouvre, 11 dessins compatibles | que cliquer sélectionne | ✅ |
| 8 | Presser un autre œil | — | ✅ |
| 9 | Cliquer une couleur dans l'inspector | — | ✅ |
| 10 | La mascotte bouge déjà ; `Tester` pour les expressions | — | ✅ |

**Zéro blocage.** Aucun mot technique rencontré : ni *morphology*, ni *beak*, ni
*preset*, ni *rig*, ni *semantic*.

### Ce qui rend cela vrai, et non seulement souhaité

| Friction supprimée | Par quoi | Où c'est traité |
| --- | --- | --- |
| Trouver le type | l'assistant le demande en premier | ce document, §E |
| Comprendre `Beak` | renommage visible → interne inchangé | [04](04_COMPATIBILITE.md) §B |
| Un choix sans effet | l'assistant **applique** le personnage | ce document, §D |
| 16 lignes de colonne | regroupement dynamique en 3 groupes | [05](05_BIBLIOTHEQUE.md) §B |
| Sélection au canvas | clic = la pièce, double-clic = dedans | audit `P0-2` |
| Aperçu introuvable | la mascotte est animée dans le canvas | [06](06_BUILDER.md) §D |
