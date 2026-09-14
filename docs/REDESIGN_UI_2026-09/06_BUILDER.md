# 06 — L'architecture du Character Builder

## A. Ce qu'elle est

```text
┌────────────┬────────────────────────┬──────────────┐
│  300 px    │ minmax(320px, 1fr)     │   340 px     │
│  fixe      │                        │   fixe       │
│  16 lignes │  canvas — 52 % à 1280  │  inspector   │
└────────────┴────────────────────────┴──────────────┘
             190 px — dock de preview
```

Cinq défauts structurels, indépendants du style :

| # | Défaut | Mesure |
| --- | --- | --- |
| **B1** | Quatre méta-choix (`Presets`, `Type`, `Style`, `Colours`) présentés comme pairs de `Eyes` | `character-model.js:37-44` |
| **B2** | La bibliothèque de la pièce ouverte s'affiche **sous** sa ligne, dans une colonne qui défile | `part-browser.js`, fonction `styles()` |
| **B3** | Le canvas a 52 % de la largeur et 33 % de la hauteur utile | colonnes fixes + dock 190 px |
| **B4** | Deux lignes toujours vides (`Pupils`, `Eyelids`) | 0 dessin sur 5 morphologies |
| **B5** | Rien ne dit ce qu'on est en train de fabriquer | aucun fil d'Ariane |

---

## B. Trois architectures

### Variante A — « Trois colonnes améliorées »

L'existant, corrigé : méta-choix sortis de la liste, groupes dynamiques,
bibliothèque en grille, colonnes redimensionnables.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ◕ BOOP    Oiseau › Chouette          Tester   Enregistrer   Exporter│
├────────────┬─────────────────────────────────────────┬───────────────┤
│ FORME      │                                         │  Œil gauche   │
│  Tête      │                                         │  [⇄][⧉][✎][🗑]│
│ VISAGE     │              ( ◕  ◕ )                   │               │
│  Yeux   ●  │               \ ◣ /                     │  ▸ Position   │
│  Sourcils  │                                         │  ▸ Couleurs   │
│  Bec       │                                         │  ▸ Avancé     │
│ PARURE     │                                         │               │
│  Crête     │                                         │               │
│ ACCESSOIRES│                                         │               │
│  …         │                                         │               │
│ MAINS      │                                         │               │
└────────────┴─────────────────────────────────────────┴───────────────┘
```

### Variante B — « Deux colonnes, bibliothèque en tiroir »

La colonne de gauche devient un **rail d'icônes de 64 px** ; presser une rangée
ouvre la bibliothèque en tiroir par-dessus le canvas, qui se referme après un
choix.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ◕ BOOP    Oiseau › Chouette          Tester   Enregistrer   Exporter│
├────┬────────────────────────────────────────────────┬────────────────┤
│ ◯  │                                                │  Œil gauche    │
│ ◉ ●│                 ( ◕  ◕ )                       │  [⇄][⧉][✎][🗑] │
│ ⌒  │                  \ ◣ /                         │  ▸ Position    │
│ ◣  │                                                │  ▸ Couleurs    │
│ ♜  │              canvas — 66 %                     │                │
│ ◈  │                                                │                │
│ ✋ │                                                │                │
└────┴────────────────────────────────────────────────┴────────────────┘
      ↑ presser ◉ →  ┌─────────────────────┐
                     │ Yeux    11 dessins  │  tiroir de 360 px,
                     │ 🔍  Compatibles ▾   │  par-dessus le canvas
                     │ ▢▢▢▢ ▢▢▢▢           │
                     └─────────────────────┘
```

### Variante C — « Canvas plein, tout en survol »

Aucune colonne permanente. Le canvas occupe tout ; cliquer une pièce fait
apparaître une barre d'actions flottante, et *Remplacer* ouvre une grille en
surimpression.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ◕ BOOP    Oiseau › Chouette          Tester   Enregistrer   Exporter│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                          ( ◕  ◕ )                                    │
│                       ┌───\ ◣ /───┐                                  │
│                       └───────────┘                                  │
│                      [⇄] [⧉] [✎] [🗑]     ← barre flottante           │
│                                                                      │
│                       canvas — 100 %                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Comparaison

| Critère | A — Trois colonnes | B — Rail + tiroir | C — Canvas plein |
| --- | --- | --- | --- |
| Lisibilité | bonne | **très bonne** — une chose à la fois | moyenne — rien n'est visible au repos |
| Rapidité (changer un œil) | 2 clics | 2 clics | 2 clics |
| Rapidité (parcourir 5 rangées) | **1 clic chacune** | 2 clics chacune (ouvrir/fermer) | 3 clics chacune |
| Information visible | élevée, parfois trop | moyenne, dosée | **très faible** |
| Espace pour le canvas | 52 → 58 % | **66 %** | **100 %** |
| Débutant | correct | **bon** — le rail est court et imagé | **mauvais** — rien n'invite |
| Découverte de la bibliothèque | moyenne | bonne | mauvaise |
| Extensibilité (packs, nouveaux slots) | bonne | **excellente** — le rail défile | mauvaise |
| Distance au code existant | **minimale** | moyenne | forte |
| Responsive | déjà traité | **naturel** — le tiroir est le motif mobile existant | mauvais sur tablette |

### Recommandation : **variante B**

Trois raisons, dans l'ordre :

1. **C'est la seule qui donne au canvas la part demandée par §11** (66 %) sans
   rendre l'interface muette comme C.
2. **Le motif existe déjà dans le dépôt.** `#app:not([data-layout=desktop])
   .drawer-scrim`, `.drawer-toggle`, `.sheet-detents` : le tiroir est le motif
   mobile actuel. La variante B l'étend au bureau au lieu d'inventer un
   composant.
3. **Elle règle B1, B2 et B3 d'un coup** : le rail ne peut pas contenir de
   méta-choix (ce sont des icônes de pièces), la bibliothèque n'est plus sous
   une ligne mais dans une surface qui lui appartient, et les 300 px rendus vont
   au canvas.

**Le risque à traiter** : un rail d'icônes est illisible si les icônes sont des
puces Unicode. La variante B **exige** le jeu d'icônes de
[07](07_DESIGN_SYSTEM.md) §F — c'est une dépendance, pas une option.

**Atténuation** : le rail montre l'icône *et* le libellé tant que la fenêtre fait
plus de 1100 px (72 px de large), et se réduit aux icônes seules en dessous. Le
libellé revient toujours en bulle.

---

## C. La variante B, en détail

### Le rail

```text
┌──────┐
│  ◯   │  Forme        ← en-tête de groupe : un séparateur, pas un mot
│ Tête │
├──────┤
│  ◉ ● │  ← ● = cette rangée a été modifiée depuis le modèle
│ Yeux │
│  ⌒   │
│Sourc.│
│  ◣   │
│ Bec  │
├──────┤
│  ♜   │
│Crête │
├──────┤
│  ◈   │
│Access│
├──────┤
│  ✋  │
│Mains │
└──────┘
```

| Règle | Valeur |
| --- | --- |
| Largeur | 72 px avec libellé, 56 px sans |
| Cible tactile | 56 × 56 minimum |
| Séparateurs de groupe | un trait 1 px `--bp-border`, sans texte — les quatre groupes se lisent par la position |
| État « ouvert » | fond accent, et le tiroir est ouvert |
| État « modifié » | une pastille 6 px, coin haut-droit |
| Rangée vide | absente |
| Ordre | celui de la morphologie (`slotOrder()` existe déjà) |

### Le tiroir

| Règle | Valeur |
| --- | --- |
| Largeur | 360 px (bureau), plein écran sous 700 px |
| Ouverture | glissement 180 ms depuis le rail ; instantané si `prefers-reduced-motion` |
| Fermeture | `Échap`, clic hors du tiroir, ou un choix |
| Le canvas | **ne se décale pas** — le tiroir passe par-dessus, avec un voile de 40 % sur les 60 px adjacents seulement |
| Persistance | reste ouvert si l'auteur a lancé une recherche ; se ferme sinon après un choix |
| Contenu | l'en-tête, la recherche, la bascule *Compatibles*, les recommandées, la grille |

### Le fil d'Ariane

```text
Oiseau  ›  Chouette  ·  modifié
  │           │
  │           └─ presser → étape 2 de l'assistant, sur place
  └─ presser → étape 1, avec un avertissement si la face a été modifiée
```

C'est la réponse à B5, et c'est aussi ce qui rend le choix du type réversible
sans être piégeux. Le composant existe déjà à moitié : `ui/artwork-scope.js`
produit exactement ce fil d'Ariane pour le canvas ; il est à généraliser.

### L'inspector

Inchangé dans sa position (colonne droite, 340 px), réorganisé selon
[05](05_BIBLIOTHEQUE.md) §E : nom, rangée d'actions, puis trois disclosures.

**Il se replie** quand rien n'est sélectionné, et laisse alors la place au
canvas — soit 80 % de largeur au repos, ce qui est l'état par défaut d'une
session de contemplation.

---

## D. L'aperçu, et la disparition du dock

```text
avant :  grid-template-rows: 58px  minmax(0,1fr)  190px
après :  grid-template-rows: 56px  minmax(0,1fr)        ← le dock disparaît
```

Le dock de 190 px héberge aujourd'hui `#preview-panel`. Deux constats :

1. La mascotte du canvas **est déjà animée** si on lui laisse jouer ses
   comportements : `blink` et l'oscillateur d'inactivité sont dans
   `core/behaviors/`, et `preview-service.js` sait les jouer sans rien écrire
   dans le document.
2. Un aperçu de 190 px sous un canvas de 600 px montre la même mascotte, deux
   fois, en plus petit.

**Proposition** : la mascotte du canvas respire en permanence (clignement +
micro-mouvement), et `Tester` ouvre l'aperçu **en plein canvas**, avec les quatre
fonds et les trois tailles que l'audit réclame (`P1-6`). Les 190 px reviennent au
canvas, et le compte final est :

```text
canvas au repos          1280 − 72 (rail)                    = 94 %
canvas avec inspector    1280 − 72 − 340                     = 68 %
canvas avec tiroir       le tiroir est par-dessus            = 68 %
hauteur                  100 % − 56 px de barre              = 92 %
```

Contre 52 % de largeur et 33 % de hauteur aujourd'hui.

---

## E. Ce qui ne change pas

Conformément à §31, et parce que c'est ce qui rend le plan réalisable :

| Brique | État |
| --- | --- |
| `ProjectDocument`, `editor-store`, `createHistory` | **intacts** |
| `createSvgCanvas` et ses 3 708 lignes | intact — il reçoit un conteneur plus large |
| `selection-overlay`, `transform-gizmo`, `gizmo-geometry` | intacts |
| `core/face-library/*` | **deux champs optionnels** (`symmetry`, `maxInstances`), un libellé par morphologie, un `defaultPreset` corrigé |
| `character-model.js` / `visual-rows.js` | `CHARACTER_CATEGORIES` perd 3 entrées (`type`, `style`, `presets` deviennent l'assistant et l'en-tête) ; le reste est inchangé |
| `part-inspector.js` | réordonné, pas réécrit |
| `part-browser.js` | **remplacé** par un rail + un tiroir ; sa logique de cartes est reprise telle quelle |
| `preset-browser`, `type-browser`, `style-browser` | déplacés dans l'assistant ; leur markup est réutilisé |
| `render-plan`, `pseudo-projector`, `runtime/*` | **intacts** |
