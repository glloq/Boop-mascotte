# 05 — La bibliothèque contextuelle

## A. Une mise au point nécessaire

La demande §12 décrit des groupes qui contiennent un corps :

```text
CORPS          CORPS
  torse          ailes
  bras           pattes
  mains          queue
```

**Ces pièces n'existent pas, et le projet n'est pas construit pour elles.** Boop
rigge un **visage** :

- les onze catégories sémantiques sont toutes faciales
  (`FACE_PART_CATEGORIES`, `face-part-model.js:48`) ;
- les dix-huit emplacements le sont aussi (`FACE_SLOTS`) ;
- la seule chose qui n'est pas le visage, ce sont **deux mains flottantes**,
  sans bras, à la manière de Rayman (`docs/HAND_STYLES.md`), et elles ont leur
  propre écran ;
- les 150 dessins se répartissent en 15 emplacements, tous faciaux ou main.

Proposer `Torse · Bras · Ailes · Pattes · Queue` serait donc inventer des
catégories que les ressources ne portent pas — ce que §3 interdit explicitement
(« ne pas inventer inutilement des catégories »).

**La règle de groupement retenue** garde l'esprit de §12 — trois ou quatre
groupes courts plutôt que seize lignes à plat — en le posant sur ce qui existe.

---

## B. Les groupes dynamiques

Une table `slot → groupe`, dix-huit entrées, dérivée et non déclarée par
morphologie : les groupes changent parce que **la morphologie change les slots**,
pas parce qu'on a écrit cinq listes.

```js
// ui/character-builder/row-groups.js  (nouveau, ~40 lignes)
const SLOT_GROUP = {
  head: 'shape',
  eyes: 'face', pupils: 'face', eyelids: 'face', eyebrows: 'face',
  nose: 'face', mouth: 'face', beak: 'face', muzzle: 'face', whiskers: 'face',
  ears: 'crown', hair: 'crown', crest: 'crown', horns: 'crown',
  facialHair: 'crown', antenna: 'crown', panels: 'crown',
  accessory: 'extras'
};
const GROUPS = [
  { id: 'shape',  label: 'Forme' },
  { id: 'face',   label: 'Visage' },
  { id: 'crown',  label: 'Parure' },
  { id: 'extras', label: 'Accessoires' },
  { id: 'hands',  label: 'Mains' }      // la rangée du builder, pas un slot
];
```

Ce que cela donne, automatiquement, pour chaque type :

```text
HUMAIN                ANIMAL                OISEAU               ROBOT
─────────────         ─────────────         ─────────────        ─────────────
Forme                 Forme                 Forme                Forme
  Tête                  Tête                  Tête                 Tête
Visage                Visage                Visage               Visage
  Yeux                  Yeux                  Yeux                 Yeux
  Regard                Regard                Regard               Regard
  Paupières             Sourcils              Sourcils             Sourcils
  Sourcils              Museau                Bec                  Bouche
  Nez                   Nez                 Parure               Parure
  Bouche                Bouche                Crête                Oreilles
Parure                 Moustaches          Accessoires            Antenne
  Oreilles            Parure                  …                    Plaques
  Cheveux               Oreilles            Mains                Accessoires
  Barbe et moustache    Cheveux                                    …
Accessoires           Accessoires                                Mains
  …                     …
Mains                 Mains
```

Trois à cinq en-têtes au lieu de seize lignes plates, et **aucune ligne vide** :
une rangée dont `slotsFor()` renvoie `count: 0` et que la mascotte ne porte pas
n'est pas rendue (c'est ce qui fait disparaître *Regard* et *Paupières*, qui
n'ont aucun dessin).

**Comptage.** Là où la colonne montrait 16 lignes dont 4 non faciales et 2
toujours vides, elle en montre **8 à 10, toutes peuplées**, réparties sous 4 ou 5
en-têtes de 11 px en majuscules — la seule chose pour laquelle une petite
majuscule est le bon outil.

---

## C. La grille de dessins

### Aujourd'hui

```css
.part-style-list{display:flex;flex-wrap:wrap;gap:6px}
.part-style{width:72px;padding:5px 4px 6px}
.part-style-thumb{width:48px;height:48px;background:#fff}
.part-style-name{font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}
```

Une rangée de boutons de 72 px, vignette 48 px sur blanc pur, nom tronqué. Pas de
recherche, pas de tri, pas de compte, pas de récents.

### Proposé

```text
┌─────────────────────────────────────────────────────────────┐
│  Oreilles                                      14 dessins   │  ← en-tête
│  ┌───────────────────────┐   ┌──────────────────┐           │
│  │ 🔍 chat, pointu…      │   │ Compatibles   ▾  │           │
│  └───────────────────────┘   └──────────────────┘           │
│                                                             │
│  RECOMMANDÉES POUR UN RENARD                                │
│  ┌──────┐ ┌──────┐ ┌──────┐                                 │
│  │ ┌──┐ │ │ ┌──┐ │ │ ┌──┐ │                                 │
│  │ └──┘ │ │ └──┘ │ │ └──┘ │                                 │
│  │Point-│ │Larges│ │Petit-│                                 │
│  │ ues  │ │      │ │ es   │                                 │
│  └──────┘ └──────┘ └──────┘                                 │
│                                                             │
│  TOUTES                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │  ✓   │ │      │ │      │ │      │  ← ✓ = celle portée    │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
│  …                                                          │
└─────────────────────────────────────────────────────────────┘
```

| Point | Valeur | Contre aujourd'hui |
| --- | --- | --- |
| Grille | `repeat(auto-fill, minmax(96px, 1fr))` | rangée flex de 72 px |
| Vignette | 80 px, fond `--bp-thumb-bg` (gris très clair, pas `#fff`) | 48 px sur blanc pur |
| Nom | 2 lignes autorisées, jamais tronqué | 1 ligne, ellipsé |
| Compte | dans l'en-tête, toujours | absent |
| Recherche | nom + description + **tags** | absente |
| Recommandées | 3 à 4, par affinité de tags | absentes |
| Portée | pastille ✓ en coin haut-droit | classe `part-style-current`, fond à +4 % |
| Survol | élévation + bordure accent | fond à +3 % |

### La recherche, et pourquoi elle vaut son coût

103 des 150 dessins portent des tags, et le vocabulaire est déjà riche :
`bird` 29, `robot` 28, `animal` 24, `round` 11, `small` 10, `soft` 7,
`friendly` 7, `pointed` 7, `cat` 6, `feline` 5, `cute` 5, `sharp` 4…

Taper `pointu` dans *Oreilles* d'un renard, c'est trois dessins sur quatorze.
`assetTags()` et `assetHasTag()` existent déjà (`face-part-model.js:95`) ; il n'y
a qu'à les lire.

### Les « recommandées » — un tri, pas un filtre

```js
// score = nombre de tags partagés avec le personnage courant
const affinity = presetTags(currentPreset);      // ex. fox → ['fox','canine','narrow','pointed']
const score = (asset) => assetTags(asset).filter((t) => affinity.includes(t)).length;
```

Trois règles, pour que ce soit une aide et non un mur :

1. Au plus 4 recommandées, et **seulement si** au moins une a un score > 0.
2. La section *Toutes* montre **tout**, y compris les recommandées, en ordre de
   bibliothèque. On ne cache jamais rien derrière une recommandation.
3. Rien n'est appris, rien n'est stocké. Le score se recalcule, il ne se
   mémorise pas.

---

## D. Le remplacement contextuel (demande §13)

### Aujourd'hui

Il n'y a **pas de bouton *Remplacer***. Pour changer un bec :

```text
1. sélectionner le bec au canvas (ou deviner sa ligne)
2. trouver la ligne « Bec » dans la colonne de gauche
3. la déplier
4. faire défiler jusqu'à la rangée « Styles », SOUS les puces de pièces
5. presser une carte de 72 px
```

Cinq gestes, et l'étape 4 est le point de décrochage : la bibliothèque de la
pièce ouverte est **sous** la ligne, dans une colonne qui défile, et non à côté
de la pièce sélectionnée (audit `1.6`).

### Proposé

Un bouton, à trois endroits, qui mène toujours au même écran :

```text
① inspector, rangée d'actions      [ Remplacer ] [ Dupliquer ] [ ✎ Dessin ] [ 🗑 ]
② clic droit sur la pièce          Remplacer  ·  Dupliquer  ·  Modifier le dessin
③ barre flottante sous la sélection [⇄] [⧉] [✎] [⇅] [🗑]     (audit P0-4)
```

et qui ouvre :

```text
Bibliothèque ▸ Bec ▸ compatibles avec Oiseau ▸ la courante mise en évidence
```

Soit, en code, **une seule ligne** :

```js
function replace(pieceId) {
  const slot = wornPartSlot({ assetId: partOf(pieceId)?.assetId, category }, { library });
  openLibrary({ slot, morphology: activeMorphology(), current: partOf(pieceId)?.assetId });
}
```

`wornPartSlot()` existe (`compatibility.js:88`) et fait déjà exactement ce
travail : elle sait qu'une pièce est dans la rangée *Museau* parce que le dessin
dont elle vient est un museau.

### Où s'ouvre la bibliothèque

| Largeur | Forme |
| --- | --- |
| ≥ 1200 px | la colonne de gauche défile jusqu'au groupe, la rangée s'ouvre, la pièce courante est cadrée |
| < 1200 px | un panneau latéral (`drawer`) par-dessus la colonne, fermé par `Échap` ou par un choix |

Dans les deux cas la **mascotte reste visible**, et le survol d'une carte montre
le remplacement en place sur la mascotte — retour à l'état initial si on sort
sans cliquer. C'est ce qui rend les quatorze oreilles jugeables sans quatorze
undo.

> **Prévisualisation au survol : contrainte.** Elle doit passer par le rendu de
> prévisualisation (non destructif), **jamais** par `install()` suivi d'un undo.
> Un `install()` par survol remplirait la pile d'historique et ferait clignoter
> le rig. Voir [08](08_SVG_EDITOR.md) §F pour le même principe appliqué au modal.

---

## E. La rangée d'actions de l'inspector (demande §22)

```text
┌────────────────────────────────────────┐
│  Œil gauche                    Yeux    │   nom + rangée d'origine
│  ┌────────┐┌────────┐┌────────┐┌────┐  │
│  │Remplacer││Dupliquer││✎ Dessin││ 🗑 │  │   ← 4 actions, en 2ᵉ position
│  └────────┘└────────┘└────────┘└────┘  │
│                                        │
│  ▸ Position et taille                  │
│  ▸ Couleurs                            │
│  ▸ Avancé                              │
└────────────────────────────────────────┘
```

| Règle | Valeur |
| --- | --- |
| Position | juste sous le nom, **avant** tout champ |
| Nombre | 4 au maximum ; le reste au clic droit |
| Style | `secondary` sauf `🗑` qui est `danger-ghost` (texte et bordure rouges, fond neutre) |
| `Dupliquer` | masqué quand `maxInstances === 1` ou `symmetry === 'single'` |
| `🗑` | **toujours présent** — l'audit a montré qu'il n'apparaît aujourd'hui que pour 2 catégories sur 11 (`P0-1`) |
| Libellé de `🗑` | `Retirer` pour une pièce de bibliothèque, `Supprimer` pour un dessin de l'auteur — deux gestes différents (audit `4.4`) |
| Confirmation | aucune ; un toast avec `[Annuler]` (audit `P1-1`) |

Le menu contextuel reprend les quatre, plus les gestes de structure, dans
l'ordre demandé par §22 :

```text
Remplacer
Dupliquer
Modifier le dessin
─────────────────
Avancer   /  Reculer
Masquer   /  Verrouiller
─────────────────
Retirer                          (rouge)
```

C'est `ui/canvas-menu.js` **filtré**, pas réécrit : ses 14 actions sont déjà là,
il suffit de retirer `Assign to a face part`, `Edit points`, `Add a pin here`,
`Convert to a path` et `Stop cutting it` — les cinq entrées techniques — quand le
menu s'ouvre dans Face.
