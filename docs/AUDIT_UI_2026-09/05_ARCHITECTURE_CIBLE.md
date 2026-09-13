# 05 — Architecture UI cible et wireframes

---

## A. Le schéma de régions

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                                 permanent│
│  BOOP │ Mascotte · Animation · Comportement     │  🔍 ↶ ↷ ✓ Prêt  Enregistrer ⬇ ▶│
├───────┴────────────────────────────────────────┴─────────────────────────────────┤
│  NAVIGATION  (2ᵉ niveau, les écrans de l'espace ouvert)               permanent  │
│  Visage │ Mains │                                                     › Avancé   │
├────────────────────┬──────────────────────────────────┬──────────────────────────┤
│                    │  CANVAS TOOLS                    │                          │
│  LEFT PANEL        │  Mascotte / Tête / Yeux  contextuel                         │
│  contextuel        ├──────────────────────────────────┤  INSPECTOR               │
│                    │                                  │  contextuel              │
│  Parties du visage │  CANVAS                          │                          │
│  (bibliothèque)    │  permanent, prioritaire          │  la sélection            │
│                    │                                  │                          │
│  ↕ redimensionnable│      ┌ ─ ─ ─ ─ ─ ─ ┐            │  ↕ redimensionnable      │
│                    │      │  sélection  │            │                          │
│                    │      └ ─ ─ ─ ─ ─ ─ ┘            │                          │
│                    │   [⧉ ⇄ ⇋ ↑ ↓ 🗑]  ← temporaire  │                          │
│                    │                                  │                          │
│                    │  ✋ Poignées  Ajuster  100% − +  │                          │
├────────────────────┴──────────────────────────────────┴──────────────────────────┤
│  CONTEXT AREA  (dock)                                              contextuel    │
│  Timeline (Animation) · Journal (Test avancé) · Diagnostics (Avancé)             │
└──────────────────────────────────────────────────────────────────────────────────┘
              ┌──────────────────────────────────┐
              │  Œil gauche supprimé  [Annuler]  │   TOAST   temporaire
              └──────────────────────────────────┘
```

## B. Classement de chaque région

| Région | Nature | Règle |
| --- | --- | --- |
| **Topbar** | **permanent** | Ne dépend jamais de l'écran. Undo, readiness, Enregistrer, Export, Preview, recherche, `•••`. |
| **Navigation niveau 1** (3 mots) | **permanent** | `Mascotte` · `Animation` · `Comportement`. Preview est une bascule, pas un quatrième mot. |
| **Navigation niveau 2** (écrans) | **contextuel** | Les écrans de l'espace ouvert. Les écrans `advanced` sont derrière `› Avancé`. |
| **Left panel** | **contextuel** | Un panneau par écran. Sur *Visage* : la bibliothèque. Redimensionnable. |
| **Canvas tools** (fil d'Ariane + outils) | **contextuel** | Le fil d'Ariane est permanent dès qu'une pièce est sélectionnée ; la barre vectorielle n'apparaît que dans *Avancé ▸ Artwork*. |
| **Canvas** | **permanent, prioritaire** | Jamais recouvert par un panneau. Une feuille s'ouvre au-dessus seulement sur action explicite, et se ferme par `Échap`. |
| **Barre d'actions de sélection** | **temporaire** | Sous la boîte de sélection, six boutons, disparaît à la désélection. |
| **Inspector** | **contextuel** | Un adaptateur par type de sélection (l'architecture actuelle). Redimensionnable. |
| **Context area** (dock) | **contextuel** | Un seul dock à la fois (déjà le contrat de `bottom-dock.js`). |
| **Toast** | **temporaire** | Une action facultative (*Annuler*). 2,6 s sans action, 6 s avec. |
| **Feuilles** (bibliothèque large, Export, palette, couleur, aide) | **temporaire** | Au-dessus du canvas, `Échap` ferme la plus haute. |
| **Preview** | **état du canvas** | Pas une cinquième place. Bascule, et rend l'auteur à son écran. |

## C. Le renommage de la navigation

Aucun identifiant de route ne change (`MODES`, `MODE_ALIASES`, `PANEL_MODES`
restent intacts) : seulement les **libellés**, et seulement en mode Simple.

| Aujourd'hui | Mode Simple | Mode Complet |
| --- | --- | --- |
| `Design` | **Mascotte** | Design |
| `Design ▸ Face` | **Visage** | Face |
| `Design ▸ Hands` | **Mains** | Hands |
| `Design ▸ Artwork` | *(sous `› Avancé`)* **Dessin** | Artwork |
| `Rig` *(tout l'espace)* | *(sous `› Avancé` de Mascotte)* **Mouvements** | Rig |
| `Rig ▸ Assign` | **Reconnaître les parties** | Assign |
| `Rig ▸ Controls` | **Réglage des mouvements** | Controls |
| `Rig ▸ Head 2.5D` | **Rotation de la tête** | Head 2.5D |
| `Rig ▸ Deform` | **Déformations** | Deform |
| `Animate` | **Animation** | Animate |
| `Animate ▸ Expressions` | **Expressions** | Expressions |
| `Animate ▸ Motions` | **Mouvements animés** | Motions |
| `Animate ▸ Timeline` | *(sous `› Avancé`)* **Image par image** | Timeline |
| `Behavior` | **Comportement** | Behavior |
| `Behavior ▸ Reactions` | **Réactions** | Reactions |
| `Behavior ▸ Automatic` | **Tout seul** | Automatic |
| `Behavior ▸ States` | *(sous `› Avancé`)* **États** | States |

En mode Simple, `Rig` disparaît de la barre et devient `› Avancé` de
**Mascotte** — parce que le rig répond à « comment ça bouge », ce qui est une
question sur la mascotte, pas une étape du projet. Les quatre écrans de Rig
gardent leurs routes, leurs onglets et leurs deep links ; ils sont simplement
sous le chevron.

---

## D. Wireframes

### D1 — Accueil

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  BOOP Mascot Studio                                      🔍            •••       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                        Créez votre mascotte                                      │
│                                                                                  │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│    │    🙂     │  │    🐱     │  │    🐦     │  │    🤖     │                   │
│    │           │  │           │  │           │  │           │                   │
│    └───────────┘  └───────────┘  └───────────┘  └───────────┘                   │
│      Personne        Animal         Oiseau        Machine                        │
│                                                                                  │
│    Choisissez un genre — vous pourrez tout changer ensuite.                      │
│                                                                                  │
│    ─────────────────────────────────────────────────────────────────             │
│                                                                                  │
│    Reprendre                                                                     │
│    ┌────────────────────────────────────────────────┐                            │
│    │ Brouillon local — hier 18:42        [Reprendre]│                            │
│    └────────────────────────────────────────────────┘                            │
│                                                                                  │
│    Vous avez déjà un fichier ?                                                   │
│    [ Ouvrir un projet ]   [ Importer un SVG ]   [ Partir du modèle Boop ]        │
│                                                                                  │
│    ─────────────────────────────────────────────────────────────────             │
│    Boop anime un visage et deux mains flottantes. Pas de corps, pas de jambes.   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Ce qui change** — les quatre genres remplacent les deux cartes de texte, et
les 22 presets deviennent atteignables en 2 clics. *Ouvrir un projet* et
*Importer un SVG* remontent du menu `•••` (ils y restent aussi). La dernière
ligne dit le périmètre du produit.

### D2 — Character Builder (Mascotte ▸ Visage) — rien de sélectionné

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ▶  │
├───────┴───────────────────────────────────┴────────┴──────┴─────────────────┴────┤
│ Visage │ Mains │                                                      › Avancé   │
├─────────────────────────────┬───────────────────────────────┬────────────────────┤
│ Humain ▾   Soft Cartoon ▾   │                               │  VISAGE            │
│ 🔍 [ rechercher…         ]  │                               │                    │
│ ─────────────────────────── │                               │  Cliquez une pièce │
│ ★ Modèles             6 ›   │         ◜‾‾‾‾‾‾‾◝             │  sur la mascotte,   │
│ ◯ Tête        Visage    ›   │        ╱  ◉   ◉  ╲            │  ou choisissez une  │
│ ◉ Yeux   G · D          ›   │       │     ▾     │           │  catégorie à gauche.│
│ • Pupilles   G · D      ›   │       │   ◡‿‿◡   │            │                    │
│ ◠ Paupières  G · D      ›   │        ╲         ╱            │  ─────────────────  │
│ ⌃ Sourcils   G · D      ›   │         ◟_______◞             │  Couleurs du visage │
│ ▽ Nez        Nez        ›   │                               │  ■ Peau        14   │
│ ◡ Bouche  Bouche·Dents  ›   │        ✋           ✋          │  ■ Contour     22   │
│ ◖ Oreilles   G · D      ›   │                               │  ■ Cheveux      6   │
│ ∿ Cheveux    Frange     ›   │                               │  ■ Bouche       3   │
│ ≋ Pilosité   —          ›   │                               │                    │
│ ◈ Accessoires  —        ›   │                               │  Palettes          │
│ ✋ Mains     G · D       ›   │                               │  ● Chaude ○ Pâle   │
│ ─────────────────────────── │                               │  ○ Froide ○ Robot  │
│ › Avancé                    │  ✋ Poignées  Ajuster  100% − +│                    │
└─────────────────────────────┴───────────────────────────────┴────────────────────┘
```

**Ce qui change par rapport à aujourd'hui** :
- `Type` et `Style` remontent en deux chips d'en-tête (`Humain ▾`,
  `Soft Cartoon ▾`) — ils ne sont plus deux lignes avant le visage.
- Un champ de recherche.
- `Colours` descend dans l'inspector (c'est une propriété du visage, pas une
  catégorie de pièce), avec les quatre palettes en un clic.
- Le panneau commence sur *Tête*.
- `› Avancé` en pied remplace les deux boutons *Artwork* / *Face Setup*.

### D3 — Une pièce sélectionnée

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ▶  │
├───────┴───────────────────────────────────┴────────┴──────┴─────────────────┴────┤
│ Visage │ Mains │                                                      › Avancé   │
├─────────────────────────────┬───────────────────────────────┬────────────────────┤
│ Humain ▾   Soft Cartoon ▾   │ Mascotte / Tête / Yeux        │ Yeux               │
│ 🔍 [ rechercher…         ]  │                               │ ◉ Ronds            │
│ ─────────────────────────── │                               │                    │
│ ★ Modèles             6 ›   │         ◜‾‾‾‾‾‾‾◝             │ ⧉ ⇄ ⇋ ◐ 🔒 🗑       │
│ ◯ Tête        Visage    ›   │        ╱ ┌─────┐ ╲            │                    │
│ ◉ Yeux   G · D          ▾   │       │  ┆◉   ◉┆  │           │ [Œil G.] [Œil D.]  │
│   [Œil G.] [Œil D.]         │       │  └─────┘  │           │                    │
│   ┌────┐┌────┐┌────┐        │       │   ◡‿‿◡   │            │ ☑ Les deux ensemble│
│   │◉ ✓ ││ ◉  ││ ◉  │        │        ╲  ⧉⇄⇋↑↓🗑 ╱           │   Écart   [  42  ] │
│   └────┘└────┘└────┘        │         ◟_______◞             │                    │
│   Ronds Grands Amande       │                               │ POSITION           │
│   ┌────┐┌────┐┌────┐        │        ✋           ✋          │   X [ 0 ]  Y [ 0 ] │
│   │ ◉  ││ ◉  ││ ◉  │        │                               │ TAILLE ET ROTATION │
│   └────┘└────┘└────┘        │                               │   ⤢ [1.00]  ⟳ [ 0 ]│
│   Endor. Fins  Chat         │                               │ COULEURS           │
│   … 15 de plus              │                               │   ■ ■ ■ ■          │
│   ☐ Tout afficher           │                               │ ─────────────────  │
│ • Pupilles   G · D      ›   │                               │ › Plus             │
│ ◠ Paupières  G · D      ›   │  ✋ Poignées  Ajuster  100% − +│ › Avancé           │
└─────────────────────────────┴───────────────────────────────┴────────────────────┘
```

La barre d'actions flottante `⧉ ⇄ ⇋ ↑ ↓ 🗑` = **Dupliquer · Remplacer · Miroir ·
Avancer · Reculer · Supprimer**. Les mêmes six boutons sont dans l'inspector
sous le nom (pour le clavier et le lecteur d'écran) et dans le menu contextuel.

Le fil d'Ariane `Mascotte / Tête / Yeux` dit ce qui est sélectionné ; un clic
sur `Tête` sélectionne la tête, un double-clic sur le canvas descend vers
`Œil gauche`.

Sous `› Plus` : Opacité, Verrouiller, Isoler, Premier/Arrière-plan, Centrer.
Sous `› Avancé` : *Modifier la forme*, *Réinitialiser* (place / couleurs /
dessin / tout), *Réglage des mouvements*, *Inspecteur de dessin*,
*Enregistrer dans ma bibliothèque*.

### D4 — Bibliothèque en feuille large

Déclenchée par `⇄ Remplacer` ou par le champ de recherche. S'ouvre **au-dessus**
du canvas, `Échap` ferme.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ▶  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Remplacer les yeux ──────────────────────────────────────────────────── × ──┐ │
│ │ 🔍 [ rechercher un dessin…                              ]  ☐ Tout afficher   │ │
│ │                                                                              │ │
│ │ Tête(24) │ YEUX(21) │ Sourcils(19) │ Nez(9) │ Bouche(14) │ Oreilles(15) │ …  │ │
│ │                                                                              │ │
│ │ ★ Favoris                                                                    │ │
│ │ ┌──────┐┌──────┐                                                             │ │
│ │ │  ◉   ││  ◉   │                                                             │ │
│ │ └──────┘└──────┘                                                             │ │
│ │  Amande  Chat                                                                │ │
│ │                                                                              │ │
│ │ Tous les yeux · 21 dessins                                                   │ │
│ │ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐            │ │
│ │ │ ◉  ✓ ││  ◉   ││  ◉   ││  ◉   ││  ◉   ││  ◉   ││  ◉   ││  ◉   │            │ │
│ │ └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘            │ │
│ │  Ronds   Grands  Amande  Endormis Fins   Chat    Bouton  Étoile              │ │
│ │ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐            │ │
│ │ │  ◉   ││  ◉ ⚑ ││  ◉   ││  ◉   ││  ◉ ★ ││  ◉   ││  ◉   ││  ◉   │            │ │
│ │ └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘            │ │
│ │  …                        ⚑ Bouge moins   ★ Mon dessin                       │ │
│ │                                                                              │ │
│ │ Un clic remplace. Glissez sur la mascotte pour placer vous-même.             │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│  ✋ Poignées  Ajuster  100% − +                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

La même grille, plus étroite, s'affiche en place dans la colonne gauche quand on
déplie une ligne de catégorie : la feuille est l'« agrandissement », pas un
deuxième composant.

### D5 — Preview

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ◼  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Fond   ● blanc ○ sombre ○ damier ○ transparent          Taille  16 32 64 ●128   │
│                                                                                  │
│                                                                                  │
│                              ◜‾‾‾‾‾‾‾◝                                           │
│                             ╱  ◉   ◉  ╲                                          │
│                            │     ▾     │                                         │
│                            │   ◡‿‿◡   │                                          │
│                             ╲         ╱                                          │
│                              ◟_______◞                                           │
│                                                                                  │
│                             ✋         ✋                                          │
│                                                                                  │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Expressions   [Neutre] [Content] [Triste] [Surpris] [Fâché] [Clin d'œil]  …26   │
│  Mouvements    [Hocher] [Secouer] [Rebondir] [Pencher] [Regarder autour]   …30   │
│  Tête          ┌───────┐   Regard   ┌───────┐   Intensité  ▁▂▃▄▅▆▇█ 100%         │
│                │   ·   │            │   ·   │                                    │
│                └───────┘            └───────┘                                    │
│  Tout seul     ☑ Clignement  ☑ Regard vagabond  ☐ Respiration                    │
│                                                                                  │
│  › Test avancé — simulateur d'événements, journal, réactions, états, curseurs    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Preview prend tout l'écran** (c'est l'actuel `.focus-preview`, devenu le
défaut), la mascotte est au centre sur le fond choisi, et **tout ce qui est du
debug est sous un seul chevron**. Les quatre tailles répondent à la vraie
question : « est-ce que ça se lit à 32 px sur un site ? »

### D6 — Animation

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ▶  │
├───────┴───────────────────────────────────┴────────┴──────┴─────────────────┴────┤
│ Expressions │ Mouvements │                                            › Avancé   │
├─────────────────────────────┬───────────────────────────────┬────────────────────┤
│ VISAGES PRÊTS               │                               │ CONTENT            │
│ ▾ Heureux                4  │         ◜‾‾‾‾‾‾‾◝             │                    │
│  ┌─────────────────────────┐│        ╱  ^   ^  ╲            │ Intensité          │
│  │ Content     3 mvts [+]  ││       │     ▾     │           │ ▁▂▃▄▅▆▇█  100%     │
│  │ Ravi        4 mvts [+]  ││       │   ◡‿‿◡   │            │                    │
│  │ Fier        3 mvts [+]  ││        ╲         ╱            │ CE QUI BOUGE       │
│  └─────────────────────────┘│         ◟_______◞             │ Sourire      +0.8  │
│ ▸ Tristes                5  │                               │ Sourcils     +0.3  │
│ ▸ Surprise               4  │        ✋           ✋          │ Yeux         +0.2  │
│ ▸ Colère                 4  │                               │                    │
│ ▸ Jeu                    9  │                               │ [Capturer le visage│
│ ─────────────────────────── │                               │  actuel]           │
│ MES VISAGES                 │                               │                    │
│ ● Content                   │                               │ ─────────────────  │
│ ○ Endormi                   │  ✋ Poignées  Ajuster  100% − +│ › Avancé           │
│ [ + Nouveau              ]  │                               │                    │
├─────────────────────────────┴───────────────────────────────┴────────────────────┤
│  ⌃ Image par image                                              (dock replié)    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Inchangé dans son principe (le studio actuel est bon) ; seuls les libellés
changent et la Timeline devient un dock replié nommé *Image par image*.

### D7 — Comportement

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ▶  │
├───────┴───────────────────────────────────┴────────┴──────┴─────────────────┴────┤
│ Réactions │ Tout seul │                                                › Avancé   │
├─────────────────────────────┬───────────────────────────────┬────────────────────┤
│ QUAND QUELQU'UN…            │                               │ ON ME CLIQUE       │
│ ▾ clique              6     │         ◜‾‾‾‾‾‾‾◝             │                    │
│  ┌─────────────────────────┐│        ╱  ◉   ◉  ╲            │ Quand   [ clic  ▾] │
│  │ Surprise puis sourire[+]││       │     ▾     │           │ Montre  [Surpris▾] │
│  │ Salue de la main     [+]││       │   ◡‿‿◡   │            │ Bouge   [Rebond ▾] │
│  │ Hoche la tête        [+]││        ╲         ╱            │ Main    [Salut  ▾] │
│  └─────────────────────────┘│         ◟_______◞             │ Revient après 1,2 s│
│ ▸ survole             4     │                               │                    │
│ ▸ attend (rien)       3     │        ✋           ✋          │ [ ▶ Tester ]       │
│ ▸ regarde             2     │                               │                    │
│ ─────────────────────────── │                               │ ─────────────────  │
│ MES RÉACTIONS               │                               │ › Avancé           │
│ ● On me clique              │                               │   priorité, event  │
│ [ + Nouvelle             ]  │  ✋ Poignées  Ajuster  100% − +│   personnalisé     │
└─────────────────────────────┴───────────────────────────────┴────────────────────┘
```

Le vocabulaire passe de `trigger` / `priority` / `custom event` à
« quand quelqu'un… ». L'avertissement actuel « 5 de ces réactions ne
s'exécuteront jamais — la priorité la plus haute gagne » est **excellent** et
reste, reformulé : « Trois réactions écoutent le clic ; c'est *Surprise* qui
répond. »

### D8 — Éditeur avancé (Mascotte ▸ Avancé ▸ Dessin)

Inchangé — c'est l'actuel Design ▸ Artwork, et il est bon pour son public.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BOOP │ Mascotte  Animation  Comportement │ 🔍 ↶ ↷ │✓ Prêt│ Enregistrer  ⬇  │ ▶  │
├───────┴───────────────────────────────────┴────────┴──────┴─────────────────┴────┤
│ Visage │ Mains │ ‹ Avancé : Dessin · Mouvements · Rotation · Déformations         │
├─────────────────────────────┬───────────────────────────────┬────────────────────┤
│ STRUCTURE                   │ ↖ ◇ ✒ ╱ □ ○ ⬠ T ✋            │ DESSIN             │
│ 🔍 [ filtrer            ]   │ Remplissage ■  Contour ■ 2 ▾  │                    │
│ ▼ ▣ Visage                  │ Mascotte / Tête / Yeux / Œil G│ Transform          │
│   ▼ ▣ Tête          ◉ 🔓    │                               │ Apparence          │
│     ● Forme         ◉ 🔓    │         ◜‾‾‾‾‾‾‾◝             │ Géométrie          │
│     ▼ ▣ Yeux  [Yeux]◉ 🔓    │        ╱ ┌─┐     ╲            │ Liaisons           │
│       ⬭ Blanc G     ◉ 🔓    │       │  ┆◉┆  ◉  │            │ Contraintes        │
│       ● Pupille G   ◉ 🔓    │       │  └─┘     │            │ Morphs             │
│       ● Reflet G    ◉ 🔓    │        ╲         ╱            │                    │
│       ✒ Paupière G  ◉ 🔓    │         ◟_______◞             │ › Avancé           │
│   ▶ ▣ Cheveux       ◉ 🔓    │                               │                    │
│ ─────────────────────────── │  Aligner ⇤ ⇥ ⇱ ⇲  Distribuer  │                    │
│ PLAGE DE TRAVAIL  240×240   │  ✋ Poignées  Ajuster  100% − +│                    │
└─────────────────────────────┴───────────────────────────────┴────────────────────┘
```

---

## E. Ce qui reste strictement inchangé

| Fixe | Pourquoi |
| --- | --- |
| `ProjectDocument` et les domaines (`PROJECT_DOMAINS`) | Un changement de domaine fait redessiner les mauvais panneaux |
| Les commandes (`core/commands/`, `core/face-library/face-part-commands.js`, `core/hands/`) | L'UI les appelle, ne les remplace pas |
| `core/undo/` et les transactions | La fiabilité de l'undo est ce qui rend la suppression sans peur possible |
| `svg-editor/svg-canvas.js` (rendu, `documentModel`, overlays de rig) | Seuls `gizmoTarget()` et le handler de clic changent, et seulement pour `character` |
| `svg-editor/transform-gizmo.js`, `gizmo-geometry.js`, `selection-overlay.js` | Le gizmo est bon |
| `core/projection/`, `core/head-pose/`, `core/keyforms/`, `core/warp/`, `core/shape-keys/` | Pseudo-3D et déformations : du rig, bien rangé |
| `runtime/` et le format d'export | Aucune recommandation ne le touche |
| `core/face-library/compatibility.js`, `face-morphologies.js`, `face-layout.js`, `face-presets.js` | Le modèle de bibliothèque est le meilleur morceau du projet |
| `ui/task-router.js` — `MODES`, `MODE_ALIASES`, `PANEL_MODES`, `FOCUSABLE_PANELS` | Les routes et les deep links survivent ; seuls les **libellés** bougent |
| `ui/colour-picker.js` | Déjà exemplaire |
| `ui/advanced-hub.js` / `advanced-tools.js` | C'est le modèle de disclosure qu'on généralise |
| `ui/component.js`, `panel-render.js`, `disclosure.js`, `ring-keys.js`, `escape-html.js` | Les primitives ; on en fait **plus** usage, pas moins |
| `responsive-shell.js`, `mobile-capabilities.js` | Le responsive est bon |
