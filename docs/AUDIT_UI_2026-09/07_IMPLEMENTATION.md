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
| **P1** | Les 22 presets visibles d'un coup, avec des chips de genre facultatives | §8 · PR **UI-06** |
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
