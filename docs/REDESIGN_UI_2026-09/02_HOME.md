# 02 — La première page

## A. Ce qu'elle est aujourd'hui

`ui/home-surface.js`, 56 lignes, produit :

```text
BOOP MASCOT STUDIO
Create or continue a mascot

New Mascot
┌──────────────────────────┐  ┌──────────────────────────┐
│ New Character   Recom.   │  │ Mascot Face              │
│ A preset, then any part  │  │ The mascot as it comes,  │
│ swapped for another style│  │ rigged and ready         │
│ Head, eyes, hair, mouth, │  │ Head turn in 2.5D, eyes, │
│ glasses and hands from   │  │ gaze, eyelids, brows,    │
│ the library, rigged as   │  │ nose, ears, hair and     │
│ they go; under a minute  │  │ mouth; lands in Artwork  │
└──────────────────────────┘  └──────────────────────────┘

Coming back to a saved project, or bringing your own drawing? Open Project
and Import SVG are in the ••• menu, top right. Once a mascot is open, Blank
canvas and Build a face are in Artwork, under Add / Create artwork.

Continue
┌────────────────────────────────────────────┐
│ No local draft is available.               │
└────────────────────────────────────────────┘
Stored only in this browser. Not synced to the cloud.
```

Au-dessus, la topbar complète reste visible et active (`z-index` 90 contre 80) :
`☰`, la marque, les 4 espaces de travail, `📱`, `🔍`, `↶`, `↷`, `Project check`,
`⟲`, `Save Project`, `Export`, `•••`, `✓ Saved`.

## B. Les huit problèmes

| # | Problème | Preuve |
| --- | --- | --- |
| **H1** | **On ne dit pas ce que fait le logiciel.** Le titre est `Create or continue a mascot` — une instruction, pas une proposition de valeur. Rien ne dit « animée ». | `home-surface.js:46` |
| **H2** | **« Ouvrir un projet » n'est pas une action.** C'est une phrase en 12 px gris `#9fb2cc` qui explique où chercher un bouton situé ailleurs. La demande §2 en fait l'une des quatre choses à comprendre immédiatement. | `elsewhere()`, `home-surface.js:39` |
| **H3** | **Il n'y a pas de projets récents.** Un seul emplacement d'autosauvegarde existe (`AUTOSAVE_KEY = 'boop-mascotte-autosave-v1'`), écrasé à chaque fois. « Projets récents » demande un **nouveau modèle**. | `core/state/local-recovery.js:1` |
| **H4** | **Aucune image.** Les deux cartes sont cinq lignes de texte. Un logiciel de mascottes dont la page d'accueil ne montre aucune mascotte. | `home-surface.js:30`, `:21` |
| **H5** | **Les deux cartes ne sont pas deux choix comparables.** *New Character* mène au Character Builder ; *Mascot Face* mène à **l'éditeur vectoriel** (`DEFAULT_MODE = 'design.artwork'`). Le débutant qui prend la carte de droite atterrit devant neuf outils de dessin. | `ui/task-router.js:156` ; audit `P1-2` |
| **H6** | **L'outillage technique est au-dessus de l'accueil.** `Export` et `Project check` sont pressables avant qu'un projet existe. | `shell/topbar.js`, `.home-surface{z-index:80}` |
| **H7** | **Le bloc *Continue* occupe une section entière pour dire « rien ».** Au premier lancement — le seul moment qui compte pour un nouvel utilisateur — c'est un cadre bordé de 18 px de padding contenant `No local draft is available.` | `renderHomeRecovery` |
| **H8** | **48 % de largeur perdue, en deux colonnes fixes.** `max-width:980px` centré ; `grid-template-columns:repeat(2,1fr)`. | CSS `.home-panel`, `.home-templates` |

**Ce qu'il faut retirer de l'accueil**, conformément à §2 : `Project check`,
`Export`, `Save Project`, `⟲ Reset mascot`, `↶ ↷`, `📱`, les quatre onglets
d'espaces de travail, et les mots `Artwork`, `rigged`, `2.5D`, `library`.

---

## C. Trois variantes

Toutes trois respectent la même contrainte : **une seule action principale
visible**, et l'accueil ne parle que de mascottes.

### Variante A — « Affiche » (héros centré)

```text
┌────────────────────────────────────────────────────────────────────┐
│  BOOP                                              ⚙  ?            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                          ( ◕   ◕ )                                 │
│                           \  ‿  /          ← la mascotte du jour,   │
│                                               animée, 200 px        │
│                                                                    │
│                 Créez et animez votre mascotte                     │
│         Un personnage qui cligne, sourit et répond, en une minute   │
│                                                                    │
│            ┌───────────────────────────┐   ┌──────────────────┐    │
│            │  +  Nouvelle mascotte     │   │ Ouvrir un projet │    │
│            └───────────────────────────┘   └──────────────────┘    │
│                                                                    │
│  Reprendre                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                            │
│  │ [vignette]│ │[vignette]│ │[vignette]│                           │
│  │ Renard    │ │ Robot 2  │ │ Chouette │                           │
│  │ hier      │ │ 3 jours  │ │ la sem.  │                           │
│  └──────────┘ └──────────┘ └──────────┘                            │
└────────────────────────────────────────────────────────────────────┘
```

- Topbar réduite à **trois éléments** : marque, réglages, aide.
- La mascotte animée est le produit : elle cligne et suit le curseur des yeux
  (le runtime le fait déjà, `preview-service.js`).
- *Reprendre* n'apparaît **que s'il y a quelque chose** ; sinon la page s'arrête
  après les deux boutons.

### Variante B — « Deux volets » (galerie à gauche, démarrage à droite)

```text
┌────────────────────────────────────────────────────────────────────┐
│  BOOP                                              ⚙  ?            │
├──────────────────────────────────┬─────────────────────────────────┤
│                                  │  Créez et animez                │
│   ┌────────┐ ┌────────┐          │  votre mascotte                 │
│   │ Renard │ │ Robot  │          │                                 │
│   └────────┘ └────────┘          │  ┌───────────────────────────┐  │
│   ┌────────┐ ┌────────┐          │  │ +  Nouvelle mascotte      │  │
│   │Chouette│ │ Chat   │          │  └───────────────────────────┘  │
│   └────────┘ └────────┘          │  ┌───────────────────────────┐  │
│                                  │  │ Ouvrir un projet          │  │
│   Vos projets                    │  └───────────────────────────┘  │
│                                  │                                 │
└──────────────────────────────────┴─────────────────────────────────┘
```

- Utilise toute la largeur ; les projets ont la place principale.
- **Mais** : au premier lancement, le volet gauche est vide — soit la moitié de
  l'écran occupée par un état vide, le jour où l'impression compte le plus.

### Variante C — « Démarrage direct » (l'accueil *est* le choix du type)

```text
┌────────────────────────────────────────────────────────────────────┐
│  BOOP                                              ⚙  ?            │
├────────────────────────────────────────────────────────────────────┤
│                 Quelle mascotte voulez-vous créer ?                │
│                                                                    │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│   │  (••)  │ │  (ᵔᴥᵔ) │ │ (>o<)  │ │ [▪▪]   │ │   +    │           │
│   │ Humain │ │ Animal │ │ Oiseau │ │ Robot  │ │ Ouvrir │           │
│   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘           │
│                                                                    │
│   Reprendre : Renard · hier      Robot 2 · 3 jours                 │
└────────────────────────────────────────────────────────────────────┘
```

- Le parcours démarre **sans clic préalable** : zéro étape avant la première
  décision utile.
- **Mais** : la page ne dit plus ce qu'est Boop, et *Ouvrir un projet* devient
  une carte parmi des types, ce qui mélange deux natures d'action — exactement
  l'erreur que §24 demande d'éviter.

### Comparaison

| Critère | A — Affiche | B — Deux volets | C — Direct |
| --- | --- | --- | --- |
| Lisibilité | **excellente** — un centre, une action | moyenne — deux centres concurrents | bonne, mais sans contexte |
| Rapidité (clics jusqu'au type) | 1 | 1 | **0** |
| Quantité d'information | faible, juste | moyenne | faible mais ambiguë |
| Utilisation de l'espace | bonne (héros + grille) | **la meilleure** | bonne |
| Premier lancement (aucun projet) | **excellent** — la section disparaît | **mauvais** — moitié d'écran vide | correct |
| Dixième lancement (12 projets) | correct — 3 récents + « Tous » | **excellent** | mauvais — récents en une ligne |
| Dit ce que fait le logiciel | **oui** | oui | **non** |
| Extensibilité (packs, exemples, tutos) | bonne — sections sous le héros | **excellente** | mauvaise — la grille est prise |

### Recommandation : **variante A**, avec un emprunt à B

**A** est retenue parce qu'elle est la seule à bien se comporter *au premier
lancement*, qui est le moment que la demande cible explicitement. Son défaut —
moins bonne quand on a beaucoup de projets — se corrige par un emprunt à B :

> *Reprendre* montre **trois projets** et un lien `Tous les projets (12)` qui
> ouvre la grille pleine largeur de la variante B **dans la même page**, en
> repliant le héros.

C'est une page qui commence comme A et devient B quand l'utilisateur le mérite.

---

## D. La Home retenue, en détail

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ◕ BOOP                                                    ⚙   ?    │   56 px
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │   ↕ 48
│                            ┌─────────┐                              │
│                            │ ( ◕ ◕ ) │   200×200, anime au survol    │
│                            │  \ ‿ /  │   (respecte prefers-reduced-  │
│                            └─────────┘    motion)                   │
│                                                                     │   ↕ 32
│                  Créez et animez votre mascotte                     │   40/48
│        Un personnage qui cligne, sourit et réagit — sans code        │   16/24
│                                                                     │   ↕ 32
│        ┌────────────────────────────┐  ┌────────────────────────┐   │
│        │   +   Nouvelle mascotte    │  │  Ouvrir un projet      │   │   52 px
│        └────────────────────────────┘  └────────────────────────┘   │
│              primary, 20px             secondary, 16px              │
│                                                                     │   ↕ 56
│  ─────────────────────────────────────────────────────────────────  │
│  Reprendre                                       Tous les projets → │   14/upper
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │
│  │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │              │
│  │ │  aperçu   │ │ │ │  aperçu   │ │ │ │  aperçu   │ │   160×120    │
│  │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │              │
│  │ Renard        │ │ Robot 2       │ │ Chouette      │   15/600     │
│  │ hier · 14:20  │ │ il y a 3 j    │ │ la sem. dern. │   12/muted   │
│  └───────────────┘ └───────────────┘ └───────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### Ce qui disparaît de la topbar sur la Home

```text
avant :  ☰  BOOP  Design Rig Animate Behavior  📱 🔍 ↶ ↷ Project check ⟲ Save Export •••  ✓
après :     BOOP                                                              ⚙  ?
```

`⚙` ouvre *Réglages* (langue, mode simple/complet, thème, unités) ; `?` ouvre
*Aide* (raccourcis, documentation, démo). Les deux sont des `menu` (§2 : « les
outils secondaires pourront être accessibles par menu, Settings, Help »).

Implémentation : un attribut `data-chrome="home"` sur `#app` et **une règle CSS**,
pas une reconstruction de la topbar.

```css
#app[data-chrome=home] .workspace-nav,
#app[data-chrome=home] .project-actions > :not(#settings-button):not(#help-button){display:none}
```

### État vide — premier lancement

La section *Reprendre* est **absente**, pas vide :

```text
                  ┌────────────────────────────┐  ┌────────────────────────┐
                  │   +   Nouvelle mascotte    │  │  Ouvrir un projet      │
                  └────────────────────────────┘  └────────────────────────┘

                    ou essayez un exemple :  Renard   Robot   Chouette
```

Trois exemples chargeables en un clic (ce sont trois presets existants :
`fox`, `robot-screen`, `owl`) remplacent l'état vide. Le nouvel utilisateur a
donc **toujours** quelque chose à regarder et à presser.

### Un projet brouillon non sauvegardé

Le brouillon local existant (`AUTOSAVE_KEY`) devient la **première carte** de
*Reprendre*, avec un badge :

```text
┌───────────────┐
│ ┌───────────┐ │
│ │  aperçu   │ │
│ └───────────┘ │
│ Sans titre  ● │  ← ● = non sauvegardé
│ il y a 2 min  │
└───────────────┘
```

Le message actuel `This local draft could not be read.` devient une carte en
état d'erreur avec une seule action, `Supprimer le brouillon`.

---

## E. Le modèle « projets récents » — évolution minimale

C'est le seul endroit de la Home qui demande plus que de la présentation.

**Aujourd'hui** : une clé, un projet, écrasée.

**Proposé** : une deuxième clé, qui ne contient **que des métadonnées et une
vignette** — jamais un projet complet, pour ne pas faire exploser le quota.

```js
// core/state/recent-projects.js  (nouveau, ~80 lignes)
export const RECENT_KEY = 'boop-mascotte-recent-v1';

/** Au plus 12 entrées, les plus récentes d'abord. */
// { id, name, savedAt, thumbnail: '<svg …>' (≤ 8 Ko), morphology, preset, source }
```

| Point | Décision |
| --- | --- |
| Où sont les projets ? | **Nulle part.** Boop reste sans serveur : une entrée récente pointe vers un fichier que l'auteur a téléchargé. La presser ouvre le sélecteur de fichiers **pré-rempli du nom attendu**, sauf pour le brouillon local, qui est le seul réellement rechargeable. |
| Pourquoi alors ? | Parce que « j'ai fait un renard la semaine dernière » est une information que seul l'auteur possède aujourd'hui, et que la retrouver est le premier geste d'un deuxième lancement. |
| Alternative plus forte | L'API File System Access (`showSaveFilePicker` + handle persisté en IndexedDB) permet une **vraie** réouverture en un clic sur Chrome/Edge. À traiter comme une amélioration progressive : `if ('showSaveFilePicker' in window)`. Firefox et Safari retombent sur le sélecteur. |
| Vignette | Le SVG du document, réduit et nettoyé — `exporter.js` sait déjà produire un `mascot.svg` assaini. Plafonné à 8 Ko ; au-delà, pas de vignette. |
| Vie privée | Rien ne quitte le navigateur. La phrase « Stored only in this browser » reste, une fois, sous la section. |

**Ce qui est honnête à dire au commanditaire** : la carte « projet récent »
telle que dessinée en §2 suppose que le logiciel puisse rouvrir un projet seul.
Sans serveur, cela n'est vrai aujourd'hui que pour le brouillon local, et ne
devient vrai pour les autres qu'avec File System Access, donc seulement sur une
partie des navigateurs. La Home recommandée fonctionne dans les deux cas : elle
montre le brouillon comme rechargeable et les autres comme des raccourcis vers
l'ouverture de fichier.
