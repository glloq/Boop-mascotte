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
| `@critical` (navigateur) | **163 passent** |
| `ux26-direct-controls` × 2, `@visual` × 2 | échouent **à l'identique sur l'arbre intact** dans ce conteneur — laissés tels quels |

Deux assertions obsolètes ont été retirées, toutes deux ayant écrit un défaut
comme une intention :

- `ux45` affirmait « Delete deletes nothing here » sur le Character Builder.
- `ux45` affirmait que museau, bec, robot et monstre n'avaient « rien de
  dessiné » — trois des quatre ont été dessinés depuis (MASC-10B, 11B, 12B) ;
  seul le monstre attend encore une corne.
