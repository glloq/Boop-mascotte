# 09 — Wireframes

Douze écrans, à 1440 × 900 sauf mention. Les valeurs en marge sont des pixels.

> **Trois des douze écrans demandés se recouvrent**, et c'est un résultat de
> l'étude, pas un oubli :
> - **③ sous-type** et **⑤ preset** sont **le même écran** — le sous-type *est*
>   le modèle (voir [03](03_CREATION.md) §C) ;
> - **④ style** n'apparaît **que si** au moins deux styles ont des variantes
>   dessinées ; il y en a zéro aujourd'hui.
>
> Les trois sont dessinés quand même, pour que la comparaison soit possible.

---

## ① Nouvelle page d'accueil

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  ◕ BOOP                                                      ⚙     ?      │ 56
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│                                                                     ↕ 56  │
│                              ┌──────────┐                                 │
│                              │  ◕    ◕  │        200×200                   │
│                              │    ‿     │        cligne toutes les 4 s     │
│                              └──────────┘                                 │
│                                                                     ↕ 32  │
│                    Créez et animez votre mascotte                   40/46 │
│         Un personnage qui cligne, sourit et réagit — sans code      16/24 │
│                                                                     ↕ 32  │
│        ┌──────────────────────────────┐   ┌────────────────────────┐      │
│        │   +   Nouvelle mascotte      │   │   Ouvrir un projet     │  48  │
│        └──────────────────────────────┘   └────────────────────────┘      │
│             btn-primary  btn-lg                btn-secondary  btn-lg      │
│                                                                     ↕ 56  │
│  ─────────────────────────────────────────────────────────────────────── │
│                                                                     ↕ 20  │
│  REPRENDRE                                        Tous les projets (7) →  │ 12
│                                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│  │ ┌────────────┐ │  │ ┌────────────┐ │  │ ┌────────────┐ │               │
│  │ │            │ │  │ │            │ │  │ │            │ │   160×120     │
│  │ │   aperçu   │ │  │ │   aperçu   │ │  │ │   aperçu   │ │               │
│  │ └────────────┘ │  │ └────────────┘ │  │ └────────────┘ │               │
│  │ Renard       ● │  │ Robot 2        │  │ Chouette       │   15/550      │
│  │ il y a 2 min   │  │ il y a 3 jours │  │ la sem. dern.  │   12/muted    │
│  └────────────────┘  └────────────────┘  └────────────────┘               │
│    ● = brouillon non enregistré                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Premier lancement** — la section REPRENDRE est absente, remplacée par :

```text
                 ou essayez un exemple :   Renard   ·   Robot   ·   Chouette
                                          ↑ btn-ghost, 15 px
```

---

## ② Choix du type de mascotte

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  ← Annuler                Nouvelle mascotte                      ● ○      │ 56
├───────────────────────────────────────────────────────────────────────────┤
│                                                                     ↕ 48  │
│                  Quelle mascotte voulez-vous créer ?                24/30 │
│                                                                     ↕ 40  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │
│  │               │ │               │ │               │ │               │  │
│  │   ┌───────┐   │ │   ┌───────┐   │ │   ┌───────┐   │ │   ┌───────┐   │  │
│  │   │ ◕   ◕ │   │ │   │ ᵔ ᴥ ᵔ │   │ │   │ ◕ ◣ ◕ │   │ │   │ ▪ ▪ ▪ │   │  │
│  │   │   ‿   │   │ │   │   ▽   │   │ │   │       │   │ │   │ ───── │   │  │
│  │   └───────┘   │ │   └───────┘   │ │   └───────┘   │ │   └───────┘   │  │
│  │               │ │               │ │               │ │               │  │
│  │    HUMAIN     │ │    ANIMAL     │ │    OISEAU     │ │    ROBOT      │  │ 18/650
│  │   6 modèles   │ │   6 modèles   │ │   6 modèles   │ │   4 modèles   │  │ 13/muted
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘  │
│        224×248           224×248           224×248          224×248       │
│                                                                     ↕ 40  │
│       Autrement :   Partir d'un dessin vide    ·    Importer un SVG       │ 13/ghost
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

| État | Rendu |
| --- | --- |
| repos | `--bp-raised`, bordure `--bp-border`, `--bp-radius-xl` |
| survol | `--bp-raised-hover`, bordure `--bp-border-strong`, `scale(1.02)`, la vignette cligne |
| focus | anneau `--bp-accent-ring` 2 px, décalé de 2 px |
| pressé | bordure 2 px `--bp-accent`, fond `--bp-accent-tint`, ✓ 18 px en haut-droite |
| indisponible | **non affiché** |

`Créature` s'ajoute automatiquement en 5ᵉ carte dès qu'une corne est dessinée
(`availableMorphologies()`). La grille passe alors à `repeat(auto-fit,
minmax(200px, 1fr))` et se réorganise en 5 ou en 3 + 2 selon la largeur.

---

## ③ Choix du sous-type  ·  ⑤ Choix d'un preset — **le même écran**

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  ← Type                   Nouvelle mascotte                      ○ ●      │ 56
├────────────────────────────────────┬──────────────────────────────────────┤
│                                    │                                      │
│  ANIMAL                      13/12 │                                      │
│  Lequel ?                    24/30 │                                      │
│                                    │              ┌─────────┐             │
│  ┌──────────┐ ┌──────────┐         │              │  ᵔ  ᴥ  ᵔ │             │
│  │ ┌──────┐ │ │ ┌──────┐ │         │              │    ▽    │             │
│  │ │ ^ω^  │ │ │ │ ·ᴥ·  │ │         │              │   \_/   │             │
│  │ └──────┘ │ │ └──────┘ │         │              └─────────┘             │
│  │  Chat  ✓ │ │  Chien   │         │                                      │
│  └──────────┘ └──────────┘         │       aperçu en direct, animé        │
│  ┌──────────┐ ┌──────────┐         │       survol = aperçu temporaire     │
│  │ │ >ᴥ<  │ │ │ │ ᵔᴥᵔ  │ │         │                                      │
│  │  Renard  │ │  Ours    │         │                                      │
│  └──────────┘ └──────────┘         │                                      │
│  ┌──────────┐ ┌──────────┐         │                                      │
│  │  Loup    │ │  Lapin   │         │                                      │
│  └──────────┘ └──────────┘         │                                      │
│      168×192 chacune               │                                      │
│                                    │                                      │
│  ⤺ Surprends-moi             ghost │      ┌────────────────────────────┐  │
│                                    │      │  Créer cette mascotte  →   │  │ 48
│                                    │      └────────────────────────────┘  │
│         30 %  ·  432 px            │             70 %  ·  1008 px         │
└────────────────────────────────────┴──────────────────────────────────────┘
```

- `← Type` nomme l'étape de retour, jamais « Précédent ».
- Double-clic sur une carte = carte + `Créer`.
- `⤺ Surprends-moi` prend un modèle au hasard **et applique aussi une palette
  au hasard** ([07](07_DESIGN_SYSTEM.md) §H).
- Sous 900 px : l'aperçu passe en haut, `40vh`, la grille dessous.

---

## ④ Choix du style — **conditionnel**

Affiché **seulement** si ≥ 2 styles ont des variantes dessinées. Aujourd'hui : 1
style, 0 variante — l'écran n'apparaît jamais.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  ← Chouette              Nouvelle mascotte                     ○ ○ ●      │
├────────────────────────────────────┬──────────────────────────────────────┤
│  Dans quel style ?           24/30 │                                      │
│                                    │              ┌─────────┐             │
│  ┌──────────┐ ┌──────────┐         │              │  ◕ ◣ ◕  │             │
│  │  ╭───╮   │ │  ┌───┐   │         │              └─────────┘             │
│  │  Rond  ✓ │ │  Plat    │         │      l'aperçu change au survol       │
│  │ Actuel   │ │ 14 pièces│         │                                      │
│  └──────────┘ └──────────┘         │                                      │
│  ┌──────────┐                      │                                      │
│  │  Rétro   │                      │      ┌────────────────────────────┐  │
│  │ 9 de 14  │  ← partiel           │      │       Continuer  →         │  │
│  └──────────┘    5 inchangées      │      └────────────────────────────┘  │
└────────────────────────────────────┴──────────────────────────────────────┘
```

Les quatre états (`current` · `available` · `partial` · `unavailable`) et leurs
phrases existent déjà dans `style-browser.js` : cet écran est ce composant, en
grand.

---

## ⑥ Character Builder — variante B retenue

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ ◕ BOOP   Oiseau › Chouette      ↶ ↷        Tester  Enregistrer  Exporter ⚙│ 56
├────┬──────────────────────────────────────────────────┬───────────────────┤
│ 72 │                                                  │       340         │
│    │                                                  │                   │
│ ◯  │                                                  │  Œil gauche  Yeux │ 18/650
│Tête│                                                  │ ┌────┬────┬────┬─┐│
│────│                    ┌──────────┐                  │ │ ⇄  │ ⧉  │ ✎  │🗑││ 36
│ ◉ ●│                    │  ◕    ◕  │                  │ └────┴────┴────┴─┘│
│Yeux│                    │          │                  │  Rempl. Dupl. Des.│ 11
│ ⌒  │                    │    ◣     │                  │                   │
│Sour│                    │          │                  │  ▾ Position       │
│ ◣  │                    │   \___/  │                  │   X [ 83.0 ]      │
│ Bec│                    └──────────┘                  │   Y [113.0 ]      │
│────│                                                  │   Taille [ 1.00 ] │
│ ♜  │             canvas — 1028 px, 68 %               │   Rotation [ 0 ]  │
│Crê.│                                                  │   ☑ Lier les deux │
│────│                                                  │                   │
│ ◈  │                                                  │  ▾ Couleurs       │
│Acc.│                                                  │   ■ ■ ■ ■ ■       │
│────│                                                  │                   │
│ ✋ │                                                  │  ▸ Avancé         │
│Main│                                                  │                   │
└────┴──────────────────────────────────────────────────┴───────────────────┘
```

- Le rail montre **les rangées peuplées du type courant** — *Regard* et
  *Paupières* sont absents (0 dessin), *Nez*, *Bouche*, *Cheveux*, *Museau*
  aussi, puisqu'un oiseau n'en a pas.
- `●` sur *Yeux* : cette rangée diffère du modèle.
- Sans sélection, l'inspector se replie : le canvas monte à **94 %**.
- Le fil d'Ariane `Oiseau › Chouette` est cliquable sur ses deux segments.

---

## ⑦ Bibliothèque filtrée (le tiroir)

```text
┌────┬─────────────────────────────┬────────────────────────────────────────┐
│ ◯  │  Yeux              11 dessins│                                       │
│────│  ┌───────────────┐ ┌────────┐│                                       │
│ ◉ ●│  │ 🔍 chercher   │ │Compat.▾││              ┌──────────┐             │
│Yeux│  └───────────────┘ └────────┘│              │  ◕    ◕  │             │
│ ⌒  │                              │              │          │             │
│    │  RECOMMANDÉS POUR UNE        │              │    ◣     │             │
│ ◣  │  CHOUETTE                    │              │   \___/  │             │
│    │  ┌──────┐┌──────┐┌──────┐    │              └──────────┘             │
│ ♜  │  │ ▢▢   ││ ▢▢   ││ ▢▢   │    │                                       │
│    │  │Ronds ││Grands││ Mi-  │    │      le survol d'une carte montre      │
│ ◈  │  │      ││      ││clos  │    │      le remplacement sur la mascotte   │
│    │  └──────┘└──────┘└──────┘    │      (non destructif, aucun undo)      │
│ ✋ │                              │                                       │
│    │  TOUS                        │                                       │
│    │  ┌──────┐┌──────┐┌──────┐    │                                       │
│    │  │ ✓    ││      ││      │    │                                       │
│    │  └──────┘└──────┘└──────┘    │                                       │
│    │  ┌──────┐┌──────┐┌──────┐    │                                       │
│    │  │      ││      ││      │    │                                       │
│    │  └──────┘└──────┘└──────┘    │                                       │
│    │       96×112, vignette 80    │                                       │
│ 72 │            360               │                 1008                  │
└────┴─────────────────────────────┴────────────────────────────────────────┘
       ↑ tiroir, --bp-shadow-2       ↑ voile de 40 % sur 60 px seulement
```

Le menu `Compatibles ▾` :

```text
┌─────────────────────────────────┐
│ ✓ Compatibles avec Oiseau    11 │
│   Toute la bibliothèque      +10│
└─────────────────────────────────┘
```

En mode « toute la bibliothèque », les dessins hors type portent un badge
`--bp-badge-neutral` nommant leur type d'origine (`Humain`, `Robot`).

---

## ⑧ Édition normale d'une mascotte (rien de sélectionné)

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ ◕ BOOP   Oiseau › Chouette      ↶ ↷        Tester  Enregistrer  Exporter ⚙│
├────┬──────────────────────────────────────────────────────────────────────┤
│ ◯  │                                                                      │
│ ◉ ●│                                                                      │
│ ⌒  │                          ┌──────────────┐                            │
│ ◣  │                          │              │                            │
│ ♜  │                          │   ◕      ◕   │       canvas — 94 %        │
│ ◈  │                          │              │                            │
│ ✋ │                          │      ◣       │       la mascotte cligne   │
│    │                          │              │       et respire           │
│    │                          │     \____/   │                            │
│    │                          └──────────────┘                            │
│    │                                                                      │
│    │    ⊖ ──────●────── ⊕   100 %   [Ajuster]      ← barre de vue, ghost   │
└────┴──────────────────────────────────────────────────────────────────────┘
```

Une pièce sélectionnée fait apparaître l'inspector **et** la barre flottante :

```text
                          ┌──────────────┐
                          │  ╔══════╗    │   ╔ ╗ = boîte de sélection
                          │  ║ ◕    ║ ◕  │         + poignées de gizmo
                          │  ╚══════╝    │
                          │   ⇄ ⧉ ✎ ⇅ 🗑 │   ← 8 px sous la boîte
                          └──────────────┘
```

---

## ⑨ Inspector d'une pièce

```text
┌───────────────────────────────────┐
│                              340  │
│  Œil gauche              Yeux     │  18/650  ·  12/muted
│                                   │
│  ┌──────┬──────┬──────┬────────┐  │
│  │  ⇄   │  ⧉   │  ✎   │   🗑   │  │  36 px, btn-secondary ×3 + btn-danger
│  └──────┴──────┴──────┴────────┘  │
│   Rempl.  Dupl.  Dessin  Retirer  │  11/muted
│                                   │
│  ┌ Œil gauche │ Œil droit ┐       │  puces — les deux pièces de la rangée
│                                   │
│  ▾ POSITION ET TAILLE             │  12/upper/muted
│    X          [   83.0   ]        │  36 px
│    Y          [  113.0   ]        │
│    Taille     [    1.00  ]        │
│    Rotation   [      0°  ]        │
│    ☑ Modifier les deux ensemble   │
│    Écartement [   74.0   ]        │
│                                   │
│  ▾ COULEURS                       │
│    ■  ■  ■  ■  ■         +3       │  28 px, radius sm
│                                   │
│  ▸ AVANCÉ                         │
│                                   │
│  ────────────────────────────     │
│  ↺ Remettre en place              │  btn-ghost, 13 px
│  ↺ Remettre les couleurs          │
└───────────────────────────────────┘
```

Contre l'existant : les actions passent de la **6ᵉ** à la **2ᵉ** position ; les
sept paragraphes de prose deviennent des infobulles ; les quatre boutons de
réinitialisation deviennent deux liens en pied ; le formulaire
« Save to the library » passe sous `▸ AVANCÉ`.

---

## ⑩ Menu contextuel

```text
        ┌────────────────────────────────────────┐
        │  Œil gauche                            │  12/muted, non cliquable
        ├────────────────────────────────────────┤
        │  ⇄   Remplacer…                        │  32 px
        │  ⧉   Dupliquer                  Ctrl+D │  ← raccourci à droite
        │  ✎   Modifier le dessin                │
        ├────────────────────────────────────────┤
        │  ⇧   Avancer                    Ctrl+] │
        │  ⇩   Reculer                    Ctrl+[ │
        │  ⇄   Retourner horizontalement         │
        ├────────────────────────────────────────┤
        │  ◌   Masquer                         H │
        │  🔒  Verrouiller                     L │
        ├────────────────────────────────────────┤
        │  🗑   Retirer                      Suppr│  --bp-danger
        └────────────────────────────────────────┘
                        220 px
```

C'est `ui/canvas-menu.js` **filtré** : les cinq entrées techniques
(`Assign to a face part`, `Edit points`, `Add a pin here`, `Convert to a path`,
`Stop cutting it`) ne s'affichent pas dans Face. Elles restent entières dans
Artwork.

`Retirer` / `Supprimer` : le mot dépend de l'origine de la pièce
(bibliothèque → *Retirer*, dessin de l'auteur → *Supprimer*).

---

## ⑪ Modal SVG Editor — vue « Pièce seule »

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✎  Modifier le dessin — Bec                                            ✕   │ 56
├──────┬──────────────────────────────────────────────────────────────────────┤
│  64  │  ┌────────────────────────────────────────────────────────────────┐  │
│      │  │ ░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░▒▒░░  damier léger  │  │
│  ▶   │  │                                                                │  │
│ Sél. │  │                                                                │  │
│      │  │                        ●━━━━━━━━━●                             │  │
│ [⌁]  │  │                       ╱  ○     ○  ╲      ● point anguleux      │  │
│ Pts  │  │                      ●             ●     ◉ point sélectionné   │  │
│      │  │                       ╲           ╱      ○ poignée de courbe   │  │
│  ✎   │  │                        ◉━━━━━━━━━●                             │  │
│Plume │  │                                                                │  │
│      │  │                                                                │  │
│  ▭   │  │                                                                │  │
│Forme │  └────────────────────────────────────────────────────────────────┘  │
│      │                                                                      │
│ ──── │  ┌──────────────┬──────────┐         ⊖ ─────●───── ⊕  180 %  Ajuster │
│      │  │ Pièce seule  │ Contexte │                                         │
│  ■   │  └──────────────┴──────────┘   ← onglets                             │
│ Fond │                                                                      │
│      │  Point :  ◇ anguleux  ● lisse     ＋ ajouter     ✕ supprimer         │ 36
│      │           ↑ options de l'outil courant, une seule rangée             │
├──────┴──────────────────────────────────────────────────────────────────────┤
│  Annuler                    ↶  ↷              Réinitialiser      Appliquer   │ 64
│  btn-ghost                 ghost               btn-secondary    btn-primary  │
└─────────────────────────────────────────────────────────────────────────────┘
                        min(1280px, 92vw) × 88vh
```

Options selon l'outil :

```text
▶ Sélection   Remplissage ▣   Contour ▣   Épaisseur [2]   ⇄ ⇅
⌁ Points      ◇ anguleux  ● lisse   ＋ ajouter   ✕ supprimer
✎ Plume       Remplissage ▣   Contour ▣   Épaisseur [2]   ⏎ terminer
▭ Formes      ▭ ▢ ╱   Remplissage ▣   Contour ▣   Épaisseur [2]
```

---

## ⑫ Modal SVG Editor — vue « Contexte »

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✎  Modifier le dessin — Bec                                            ✕   │
├──────┬──────────────────────────────────────────────────────────────────────┤
│      │  ┌────────────────────────────────────────────────────────────────┐  │
│  ▶   │  │                                                                │  │
│      │  │                    ░░░░░░░░░░░░░░░░░                           │  │
│ [⌁]  │  │                   ░░  ◌       ◌  ░░      le reste de la face   │  │
│      │  │                  ░░░             ░░░     à 22 %, inerte        │  │
│  ✎   │  │                  ░░░   ●━━━━━●   ░░░                           │  │
│      │  │                  ░░░  ╱ ○   ○ ╲  ░░░     la pièce éditée       │  │
│  ▭   │  │                  ░░░ ●       ● ░░░       à 100 %, avec ses     │  │
│      │  │                  ░░░  ╲     ╱  ░░░       points                │  │
│ ──── │  │                   ░░░  ◉━━━●  ░░░                              │  │
│      │  │                    ░░░░░░░░░░░░                                │  │
│  ■   │  │                                                                │  │
│      │  └────────────────────────────────────────────────────────────────┘  │
│      │  ┌──────────────┬──────────┐         ⊖ ─────●───── ⊕  100 %  Ajuster │
│      │  │ Pièce seule  │[Contexte]│                                         │
│      │  └──────────────┴──────────┘                                         │
│      │  Point :  ◇ anguleux  ● lisse     ＋ ajouter     ✕ supprimer         │
├──────┴──────────────────────────────────────────────────────────────────────┤
│  Annuler                    ↶  ↷              Réinitialiser      Appliquer   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**C'est le mode par défaut**, et il ne coûte rien : `[data-editor-scope=out]
{opacity:.22;pointer-events:none}` existe déjà et est exactement cela. « Pièce
seule » est la nouveauté, et c'est une règle CSS (`display:none`).

Le cadrage est **conservé** en basculant : seule l'opacité du reste change, donc
l'œil ne perd pas la pièce.

### Cas d'erreur, dans le pied

```text
├──────┴──────────────────────────────────────────────────────────────────────┤
│ ⚠ « Sourire » ne correspond plus à ce contour : ce point ne peut pas être    │
│   supprimé sans perdre cette expression.                                    │
│                                                                             │
│  Annuler          [ Supprimer quand même ]     Réinitialiser     Appliquer  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Le message vient de `migrateElementTopology` (`path-topology.js:88`), qui le
produit déjà. Ce qui change : il s'affiche **dans le modal, de façon
persistante**, et non dans un toast de 4 secondes.
