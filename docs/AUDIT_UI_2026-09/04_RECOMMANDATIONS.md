# 04 — Recommandations détaillées

Chaque recommandation dit : le problème, la proposition, ce qui existe déjà dans
le code et qu'on réutilise, et le coût.

---

## §1 — La bibliothèque de pièces : une planche, pas une liste

**Problème** — 150 dessins présentés en boutons empilés de 280 px dans une
colonne de 300 px, sans recherche, sans favoris, sans récents.

**Proposition**

```text
┌─ VISAGE ─────────────────────────────────┐
│ 🔍 [ rechercher un dessin…            ]  │
│                                          │
│  Tête  Yeux  Sourcils  Nez  Bouche      │  ← chips de slot, scroll horizontal
│  Oreilles  Cheveux  Pilosité  Access.   │
│                                          │
│  YEUX · 21 dessins        ☐ Tout afficher│
│  ┌────┐ ┌────┐ ┌────┐                   │
│  │ 👁 │ │ 👁 │ │ 👁 │                   │  ← 80×80, 3 par ligne à 300px
│  └────┘ └────┘ └────┘                   │     6 par ligne en feuille large
│  Ronds  Grands  Amande                   │
│  ┌────┐ ┌────┐ ┌────┐                   │
│  │ 👁✓│ │ 👁 │ │ 👁 │                   │  ← ✓ = celui qui est sur le visage
│  └────┘ └────┘ └────┘                   │
│  Endormis  Fins  Chat                    │
│                                          │
│  ★ Favoris   ⏱ Récents                   │
└──────────────────────────────────────────┘
```

Ce qui change dans le code :

| Quoi | Où | Nature |
| --- | --- | --- |
| `.part-style-list` passe en `grid-template-columns: repeat(auto-fill, minmax(84px,1fr))` | `index.html` (CSS) | CSS seul |
| Vignette carrée 80×80 au lieu de 44×44 | `index.html` (`.part-style-thumb`) | CSS seul |
| Champ de recherche filtrant nom + description + `assetTags(asset)` | `part-browser.js` (`styles()`), `compatibility.js` (`assetsFor`) | ~30 lignes |
| Chips de slot en tête plutôt que 18 lignes verticales | `part-browser.js` (`markup()`) | ~40 lignes |
| Favoris + récents en `localStorage` | nouveau `core/face-library/face-part-recents.js` | ~50 lignes |

**On réutilise** — `facePartThumbnail()` produit déjà de vraies vignettes SVG ;
`assetTags()` / `parseFaceTags()` lisent déjà les tags ; les badges
(`Current` / `On ×` / `Pack` / `Mine` / `Limited`) et le drag (`part-drag.js`)
restent inchangés.

---

## §2 — La compatibilité : automatique, avec une porte de sortie

**Ce qui est déjà juste et qu'il ne faut pas toucher** :

- `assetsFor({ morphology, slot, style })` filtre déjà automatiquement.
- Un style est un **souhait** : la pièce dont le restyle n'existe pas reste
  telle quelle. Jamais retirée, jamais échangée en silence.
- `restylePlan` / `describeRestylePlan` disent avant et après.
- Une carte incompatible est **affichée et désactivée avec sa raison**, pas
  masquée. C'est la bonne décision et elle est documentée dans
  `type-browser.js`.

**Les trois corrections**

1. **`☐ Tout afficher`** sous la grille. Lève le filtre de morphologie ; les
   cartes hors-kind portent un badge discret (`Museau`, `Bec`…). Aujourd'hui
   mettre un bec sur un visage humain est impossible **à trouver**, alors que le
   code le permet.
2. **`Type` et `Style` sortent de la liste de parties** et deviennent deux chips
   d'en-tête : `Humain ▾` `Soft Cartoon ▾`. Le mot *Type* devient *Genre de
   visage*.
3. **Les avertissements techniques se reformulent** :
   - `« 3 movements are not carried by this drawing — Rig ▸ Controls says which. »`
     → badge `Bouge moins`, détail en infobulle.
   - `« Nothing on this face is drawn this way yet »` → à garder : c'est honnête.

**Coût** — CSS + ~60 lignes dans `part-browser.js` et `character-builder.js`.
Aucune modification de `compatibility.js`.

---

## §3 — Divulgation progressive : appliquer partout le modèle d'*Advanced tools*

`ui/advanced-hub.js` est **le meilleur exemple de disclosure du projet** : une
carte par surface experte, sa disponibilité, la raison quand elle est
indisponible, et un bouton *Open*. C'est le modèle à généraliser.

`ui/disclosure.js` fournit déjà les trois niveaux (`basic` / `more` /
`advanced`) avec `rememberOpen()`. Il est utilisé par l'inspector de main et le
formulaire de sauvegarde de pièce. **Il n'est pas utilisé par l'inspector de
pièce ni par le browser.**

| Surface | Aujourd'hui | Proposé |
| --- | --- | --- |
| Onglets d'écran | `Artwork`, `Deform`, `Timeline`, `States` visibles à `opacity:.72` | derrière un chevron `›` en fin de rangée |
| Inspector Face | 5 champs + 7 paragraphes + 2 `<details>` | `basic` : nom, actions, Position, Taille, Rotation, Couleurs · `more` : Symétrie, Opacité, Espacement · `advanced` : Reset, Edit Shape, Face part setup, Artwork inspector, Save as library part |
| Menu contextuel | 14 entrées, 5 techniques | 9 entrées + `›` *Avancé* (Edit points, Add a pin, Convert to a path, Stop cutting it, Assign to a face part) |
| Preview | 8 sections à plat | `basic` : Expressions, Mouvements, Fond, Taille · `advanced` : Simulateur, Journal, Live controls, Automatic, Poses |
| Navigation globale | 4 espaces toujours | réglage `Simple / Complet` dans `•••` |

**Règle de décision** proposée pour toute nouvelle commande :

> Si moins d'une personne sur dix la touchera en fabriquant sa première
> mascotte, elle est `advanced`. Si le mot qui la nomme est un mot de rigging,
> elle est `advanced` **et** doit être renommée pour son emplacement `basic`,
> ou ne pas y figurer.

---

## §4 — Qualité du rendu visuel

Ce qui améliore la qualité perçue des mascottes sans compliquer la création :

| Levier | État | Proposition | Coût |
| --- | --- | --- | --- |
| **Cohérence de style** | `restylePlan` existe, exposé dans la ligne *Style* | remonter en chip d'en-tête, et signaler quand le visage mélange deux styles : « 2 pièces ne sont pas en Soft Cartoon » avec un bouton *Harmoniser* | faible |
| **Alignement automatique** | `core/face-library/face-layout.js` place déjà chaque pièce dans sa boîte de référence à l'installation (`boxInMountSpace`) — très bon | ajouter un bouton *Replacer* (= `Reset position`, déjà là) dans la barre d'actions | nul |
| **Symétrie** | paires liées par défaut (`unlinked` vide), miroir de patch (`mirrorTransformPatch`) | **faire passer le gizmo par le même chemin** (§2.2 de [02](02_PROBLEMES.md)) ; ajouter *Symétriser depuis la gauche / la droite* | moyen |
| **Proportions** | aucune aide | à ne pas faire : un « harmoniseur de proportions » sur des dessins d'auteurs différents produit des résultats pires que l'auteur |
| **Espacement** | champ `Spacing` pour une paire liée — bon | ajouter *Distribuer* aux actions de sélection multiple (existe : `distributeSelection`) | faible |
| **Rendu à petite taille** | **aucun moyen de le voir** | chips de taille dans Preview (16 / 32 / 64 / 128 / 256 px) — c'est le levier le plus rentable de cette section | faible |
| **Épaisseur des contours** | pas de contrôle global | à petite taille, des contours de 3 unités sur un visage de 32 px sont illisibles ; un curseur global *Épaisseur des traits* multipliant les `stroke-width` serait utile — mais c'est une **commande de document**, donc hors périmètre UI |
| **Contraste** | aucune vérification | dans Preview, sur fond clair et fond sombre, afficher un avertissement si le contour et le fond sont trop proches | faible |
| **Palettes** | `FACE_PALETTES` (warm / pale / cool / robot) appliquées par les presets, `PALETTE_TOKENS` (12 jetons) | exposer les 4 palettes en chips dans la ligne *Couleurs* : « Chaude · Pâle · Froide · Robot », un clic repeint tout le visage en un pas d'undo | faible |
| **Profondeur / pseudo-3D** | `core/projection/pseudo-projector.js`, `DEPTH_PARALLAX.md`, `head-pose` 2.5D | rien à changer : c'est du rig, bien rangé dans Rig |
| **Ombres** | aucune | hors périmètre |
| **Interpolation / transitions** | `CONTINUOUS_TRANSITIONS.md` — les expressions se croisent sans passer par neutre | rien à changer, c'est déjà juste |

---

## §5 — Assistant de création guidée

**Verdict : oui, mais court, et en réutilisant les composants existants.**

L'argument contre un assistant est déjà écrit dans `type-browser.js` : « an
author who came in through a preset has already made a face, and a Type press
that rebuilt it would throw their work away ». Un assistant qui **reconstruit**
est donc à éviter.

Un assistant qui **choisit** est différent. Le parcours minimal :

```text
┌─ Nouvelle mascotte ──────────────────── 1/3 ──┐
│                                               │
│  Quel genre de personnage ?                   │
│                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  🙂  │ │  🐱  │ │  🐦  │ │  🤖  │         │
│  └──────┘ └──────┘ └──────┘ └──────┘         │
│  Personne  Animal   Oiseau   Machine          │
│                                               │
│                        [ Passer ] [Suivant →] │
└───────────────────────────────────────────────┘

┌─ Nouvelle mascotte ──────────────────── 2/3 ──┐
│  Choisissez-en un, vous changerez tout après  │
│  ┌────┐┌────┐┌────┐   (les 6 presets du genre)│
│  └────┘└────┘└────┘                            │
│  ┌────┐┌────┐┌────┐                            │
│  └────┘└────┘└────┘                            │
│                        [ ← Retour ] [Suivant →]│
└───────────────────────────────────────────────┘

┌─ Nouvelle mascotte ──────────────────── 3/3 ──┐
│  Les couleurs   ● Chaude ○ Pâle ○ Froide      │
│  Les mains      ☑ Ajouter une paire           │
│                                               │
│                  [ ← Retour ] [ Terminer ]    │
└───────────────────────────────────────────────┘
        ↓
   L'éditeur, Design ▸ Face, tout modifiable
```

**Trois écrans, trois choix, un bouton *Passer* dès le premier.** Aucun écran ne
demande quelque chose qu'on ne peut pas changer après.

**Composants réutilisés à l'identique** :

| Écran | Réutilise |
| --- | --- |
| 1 — genre | `availableMorphologies()` + `typeBrowserMarkup()` (déjà des cartes avec disponibilité et raison) |
| 2 — preset | `presetsFor({ morphology })` + `presetThumbnail()` + `presetBrowserMarkup()` |
| 3 — couleurs | `FACE_PALETTES` + le chemin `retint()` du builder |
| 3 — mains | `drawHandStyle(side, id)` du workspace Design |
| Sortie | `loadTemplate('basic', { mode: 'design.face' })` puis `applyPreset`, exactement ce que `newCharacter()` fait déjà |

**Coût** — un seul fichier nouveau, `ui/character-builder/create-wizard.js`,
qui appelle les fonctions ci-dessus. Rien de nouveau côté commandes. L'assistant
remplace la carte *New Character* de Home ; la carte *Mascot Face* reste comme
échappatoire (« commencer depuis le modèle »).

**Ce qu'il apporte** — les 22 presets deviennent découvrables en deux clics
au lieu de quatre, et la morphologie est choisie **là où c'est une question
naturelle** (« quel genre de personnage ? ») plutôt que dans une ligne de
panneau qui annonce ne rien faire.

---

## §6 — Menus contextuels

Le menu existe, est bon, et doit être **disponible dans Face** avec un contenu
allégé.

```text
┌──────────────────────────────┐
│ Œil gauche                   │   ← nom éditable (déjà le cas)
│ Partie de : Yeux             │
├──────────────────────────────┤
│ ⧉  Dupliquer          Ctrl+D │
│ ⇄  Remplacer…                │   ← nouveau : ouvre la grille sur son slot
│ ⇋  Miroir horizontal         │
│ ⤢  Réinitialiser la place    │   ← = Reset position, déjà là
├──────────────────────────────┤
│ ↑↑ Premier plan              │
│ ↑  Avancer               ]   │
│ ↓  Reculer               [   │
│ ↓↓ Arrière-plan              │
├──────────────────────────────┤
│ ◐  Masquer                   │
│ 🔒 Verrouiller                │
│ ⊙  Isoler                    │   ← nouveau : setEditScope(id), existe déjà
├──────────────────────────────┤
│ 🗑  Supprimer            Suppr │
├──────────────────────────────┤
│ ›  Avancé                    │   ← replie les 5 entrées de rigging
└──────────────────────────────┘
```

Sous `› Avancé` : *Modifier les points* (Node tool), *Poser un pin*,
*Convertir en chemin*, *Ne plus découper*, *Ouvrir dans Face Setup*.

**Règles** :
- Le clic droit **n'est jamais le seul chemin** : chaque entrée existe aussi
  dans la barre d'actions ou l'inspector.
- Les raccourcis sont affichés dans le menu — c'est là qu'on les apprend.
- Dans Artwork, le menu garde ses 14 entrées à plat (public expert).
- Dans Preview, pas de menu (la décision actuelle est bonne).

**Coût** — `ui/canvas-menu.js` prend une option `{ level: 'simple' | 'full' }` ;
`editor-app.js:251` ajoute `'character'`. ~50 lignes.

---

## §7 — Raccourcis clavier, uniformisés

État actuel (`ui/shortcuts.js` + `editor-app.js`) contre la cible :

| Raccourci | Attendu | Aujourd'hui | Cible |
| --- | --- | --- | --- |
| `Suppr` | supprimer | Artwork seulement | **Artwork + Face + Rig** |
| `Ctrl+Z` | annuler | ✅ global | inchangé |
| `Ctrl+Shift+Z` / `Ctrl+Y` | rétablir | ✅ global | inchangé |
| `Ctrl+D` | dupliquer | Artwork seulement | **+ Face** |
| `Ctrl+C` / `Ctrl+V` | copier / coller | Artwork seulement | **+ Face** |
| `Ctrl+G` / `Ctrl+Shift+G` | grouper / dégrouper | Artwork seulement | **reste Artwork** (un groupe est une notion SVG) |
| `Ctrl+A` | tout sélectionner | Artwork seulement | **+ Face** |
| Flèches | déplacer d'1 unité | ✅ Artwork + Face | inchangé |
| `Shift` + flèches | déplacer de 10 | ✅ Artwork + Face | inchangé |
| `Échap` | désélectionner / fermer | ferme la surface du dessus, puis annule un mode canvas — **ne désélectionne pas** | ajouter la désélection en dernier recours |
| `G` `E` `K` `S` | déplacer / tourner / redimensionner / pivot | `G E K A` — `A` pour *anchor* | **renommer en `G R S P`** comme Blender et comme la demande, `A` gardé en alias |
| `]` / `[` | avancer / reculer | ❌ inexistants | **à ajouter** |
| `Ctrl+Shift+]` / `Ctrl+Shift+[` | premier / arrière-plan | ❌ | à ajouter |
| `Ctrl+K` | palette | ✅ | inchangé |
| `?` | aide | ✅ | inchangé |
| `Ctrl+S` | enregistrer | ✅ | inchangé |
| `Espace` | jouer / pause | ✅ Animate | inchangé |
| `V N P L R O S T H` | outils vectoriels | ✅ Artwork | **reste Artwork** — ne pas exposer dans Face |
| `Ctrl+Alt+R` | reset mascotte | ✅ global | inchangé |
| `Shift+F10` / `ContextMenu` | menu contextuel | Artwork + Rig | **+ Face** |

**À ne pas ajouter** : un raccourci par catégorie de partie, un raccourci de
zoom numérique, un raccourci de bascule de panneau. Le tableau ci-dessus est
complet et s'arrête là.

**Point d'attention** — `ui/shortcuts.js` porte le contrat « ce qui est
documenté est ce qui marche » (`match: null` = documentation seule). Les
entrées `artwork-clipboard`, `multi-select`, `artwork-nudge` disent aujourd'hui
`scope: 'Artwork'` alors que `artwork-nudge` dit « (Artwork and Character) ».
Il faudra **mettre les portées à jour dans le même commit** que le changement de
garde, sinon l'aide mentira.

---

## §8 — Responsive

Ce qui est déjà bon : trois layouts, drawer + feuille jamais simultanés,
cibles ≥ 44 px, `gateMarkup()` qui explique par écran ce qu'un téléphone ne peut
pas faire, `forceLayout('desktop')` comme échappatoire. Testé par
`ux19-tablet`, `ux20-mobile`, `ux22-layout`.

Les corrections portent sur le **desktop** :

| Problème | Proposition |
| --- | --- |
| Colonnes fixes 300 / 310 px, seulement repliables | deux séparateurs redimensionnables, en réutilisant le composant de `#timeline-resize` (pointeur + clavier + double-clic pour réinitialiser, déjà `role="separator"`) |
| Le canvas n'a jamais la priorité | la bibliothèque en pleine largeur s'ouvre **en feuille au-dessus du canvas** (comme `#export-panel`), pas en élargissant la colonne |
| Pas de plein canvas hors Preview | étendre `.focus-preview` à tous les écrans, touche `F` ou `Tab` |
| À 1000–1100 px les trois colonnes s'écrasent | un point de rupture qui replie la colonne droite en feuille à droite, comme sur tablette |

**Ce qu'il faut éviter** : ajouter des contrôles qui recouvrent la mascotte.
La barre d'actions de sélection doit se placer **sous** la boîte de sélection et
basculer au-dessus si elle sortirait du canvas — `canvas-menu.js` a déjà
exactement cette logique de placement (`place(point)`), à réutiliser.

---

## §9 — Comparaison avec d'autres logiciels

Seuls les patterns qui règlent un problème identifié dans cet audit.

| Logiciel | Pattern | Problème qu'il règle ici | Pourquoi c'est adapté à Boop | Comment l'implémenter sans complexifier |
| --- | --- | --- | --- | --- |
| **Figma** | Clic = l'objet de plus haut niveau, double-clic descend d'un niveau, fil d'Ariane en haut | §2.1 : le clic attrape le reflet de l'œil | Les pièces de Boop sont naturellement imbriquées (un œil = 7 formes) et `instanceRootOf` sait déjà où est la racine | Dans `character` uniquement : remonter le clic à `instanceRootOf`, double-clic descend, `#artwork-scope` sert de fil d'Ariane (il existe) |
| **Figma** | Barre d'actions flottante sous la sélection | §6.2 : les actions sont dans un inspector à droite, pas sur l'objet | Le canvas fait 52 % de l'écran ; l'attention est là | Réutiliser le placement de `canvas-menu.js` ; 6 boutons, jamais plus |
| **Figma / Illustrator** | Guides d'alignement rouges pendant le drag | §5 : rien n'aide à centrer | Un visage est symétrique : le guide central est *la* ligne utile | Une ligne SVG dans `gizmoLayer` quand le centre de la boîte passe à ±2 px du centre de l'artboard ou du centre d'une pièce sœur |
| **Canva** | Une grille de vignettes comme interface primaire, recherche en haut | §8.1 : liste de boutons pour 150 dessins | Boop *est* un catalogue de dessins | CSS grid + un champ de recherche sur les tags existants |
| **Canva** | Suppression immédiate + toast *Annuler*, aucune modale | §4.1 : les toasts n'ont pas de bouton | L'undo est déjà transactionnel et fiable | `setStatus(msg, tone, { action })` — un seul point à changer |
| **Canva** | Onglets de catégorie en chips horizontales | §1.4 : 18 lignes verticales | Les slots sont peu nombreux et courts | `markup()` de `part-browser.js` |
| **Adobe Character Animator** | Le rig se déduit des **noms de calques**, l'auteur ne l'assigne pas | 6 actions pour ajouter une pièce sur un SVG importé | Boop a déjà `deriveFaceRoleChecklist` et une détection (`ux06-face-detection`) | Offrir *Détecter les parties* **dans Face** au lieu de router vers Rig ▸ Assign |
| **Live2D Cubism** | Deux modes explicites : *Modeling* et *Animation* | §7.3 : quatre espaces pour qui veut juste un visage | Boop a exactement cette dualité (Design/Rig contre Animate/Behavior) | Un réglage `Simple / Complet`, pas une refonte |
| **Rive** | Les fichiers récents et les templates sur l'écran d'accueil, en grand, visuellement | 2 cartes de texte sur Home | Home est déjà réduit à l'essentiel (V3-08) | Les 22 presets en vignettes dans l'assistant (§5) |
| **Spine** | Un mode *Setup* et un mode *Animate*, et la **profondeur (draw order) comme liste toujours visible** | §1.3 : aucun ordre dans Face | L'ordre d'affichage est le concept que Boop cache le plus et dont on a le plus besoin (lunettes devant les cheveux) | Une liste de **pièces par rôle** sous *Avancé* dans Face, pas l'arbre SVG |
| **Blender** | `G` / `R` / `S` pour move / rotate / scale ; Échap annule | §7 : `G E K A` est propre à Boop | Les gestes existent déjà et sont bons | Renommer les touches, garder les anciennes en alias |
| **Blender** | Mode *isolation* (`/`) sur l'objet actif | §5 : retoucher une pièce dans un visage chargé | `setEditScope()` fait exactement ça et n'est appelé que par *Edit Shape* | Une entrée *Isoler* dans le menu et la barre d'actions |
| **Éditeurs d'avatars** (Miiverse, Bitmoji, Ready Player Me) | Une seule colonne de catégories, une grille, aucun vocabulaire technique, et un aperçu permanent | Le cumul de cet audit | C'est littéralement le produit que Boop veut être en mode Simple | C'est la cible de [05](05_ARCHITECTURE_CIBLE.md) |

**Ce qu'il ne faut pas reprendre** : les calques-multiples de Photoshop, les
contraintes d'os de Spine, les courbes de Bézier d'animation de Rive, les
graph editors, les nœuds. Boop n'en a pas besoin et en a déjà les équivalents
rangés dans Rig.

---

## §10 — Fonctionnalités UI manquantes, avec leur gain

Seules celles dont le gain est réel.

| Fonction | Existe ? | Gain | Priorité |
| --- | --- | --- | --- |
| **Glisser-déposer de pièces** | ✅ `part-drag.js` + `dropHost` | — | — |
| **Suppression au clavier dans Face** | ❌ | **très élevé** — c'est le geste manquant n°1 | **P0** |
| **Menu contextuel dans Face** | ❌ | **très élevé** | **P0** |
| **Barre d'actions sur la sélection** | ❌ | **très élevé** — porte les 6 gestes d'un coup | **P0** |
| **Toast avec *Annuler*** | ❌ | élevé — rend la suppression sans peur | **P1** |
| **Duplication directe (`Ctrl+D`) dans Face** | ❌ | élevé | **P1** |
| **Ordre avant/arrière dans Face** | ❌ | élevé | **P1** |
| **Bouton miroir** | `canvas.flip` existe, pas exposé dans Face | élevé (un visage est symétrique) | **P1** |
| **Remplacement rapide depuis la sélection** | ❌ | élevé | **P1** |
| **Recherche de pièces** | ❌ | élevé (150 dessins) | **P1** |
| **Fond et taille dans Preview** | ❌ | élevé — c'est *le* test qui compte | **P1** |
| **Fil d'Ariane de sélection** | `#artwork-scope` existe, sous-employé | élevé (dit ce qui est sélectionné) | **P1** |
| **Presets visibles tous kinds** | filtrés | élevé — 16 personnages cachés | **P1** |
| **Reset transform** | ✅ *Reset position* / *Reset all* | — | — |
| **Centrer** | `alignSelection` existe, masqué hors Artwork | moyen | **P2** |
| **Aligner / distribuer** | idem | moyen | **P2** |
| **Verrouiller** | `canvas.setLocked` existe, pas exposé dans Face | moyen | **P2** |
| **Isoler** | `setEditScope` existe, appelé seulement par *Edit Shape* | moyen | **P2** |
| **Masquer** | `canvas.setVisibility` existe, pas exposé dans Face | moyen | **P2** |
| **Favoris / récents** | ❌ | moyen | **P2** |
| **Zoom sur la sélection** | ❌ | moyen | **P2** |
| **Guides d'alignement** | ❌ | moyen | **P2** |
| **Magnétisme au déplacement** | `snapIfOn` existe, dessin seulement | moyen | **P2** |
| **Palettes en un clic** | `FACE_PALETTES` existe, appliqué par les presets seulement | moyen | **P2** |
| **Auto-fit** | `face-layout.js` le fait à l'installation | — | — |
| **Colonnes redimensionnables** | ❌ (repliables seulement) | moyen | **P2** |
| **Mode Simple / Complet** | ❌ | moyen | **P2** |
| **Assistant de création** | ❌ | moyen | **P2** |
| **Avant / après** | ❌ | **faible** — l'undo le fait, un mode comparaison est du luxe | **P3** |
| **Historique visuel** | ❌ | faible — `Ctrl+Z` suffit sur un projet de cette taille | **P3** |
| **Sélection derrière un élément (`Alt`+clic)** | ❌ | faible — `canDragBody` et le clic profond règlent déjà l'essentiel | **P3** |
| **Gizmo en multi-sélection** | ❌ | faible — le drag et les flèches marchent déjà | **P3** |
| **Changer de parent (drag dans l'arbre)** | ❌ | faible | **P3** |
| **Corbeille / restauration** | ❌ | **à ne pas faire** — l'undo est le bon modèle |
