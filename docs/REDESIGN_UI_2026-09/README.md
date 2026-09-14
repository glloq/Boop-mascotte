# Redesign graphique — septembre 2026

Une étude du **design graphique** de Boop Mascotte et de son **parcours de
création**, mesurée contre une question différente de celle de l'audit
précédent :

> **Une personne qui ouvre Boop pour la première fois peut-elle dire ce qu'elle
> veut fabriquer avant qu'on lui montre une bibliothèque ?**

Aujourd'hui la réponse est non, et la conséquence est chiffrable : la
bibliothèque contient **150 dessins et 22 personnages prêts à l'emploi**, le
chemin par défaut en montre **48 et 6**.

## Sa place par rapport à l'audit précédent

[`docs/AUDIT_UI_2026-09/`](../AUDIT_UI_2026-09/README.md) a mesuré **les gestes**
— supprimer, dupliquer, ordonner, clic droit — et a conclu que la surface simple
avait été privée des gestes de la surface experte. Ses dix problèmes et son plan
P0 → P3 restent valables et **ne sont pas rejoués ici**.

Cette étude-ci mesure **trois choses que l'audit n'a pas couvertes** :

| | Audit UI 2026-09 | Ce document |
| --- | --- | --- |
| Sujet | les gestes d'édition | la forme graphique et l'entrée |
| Question | « puis-je manipuler une pièce ? » | « est-ce que je sais quoi faire ? » |
| Portée | Face vs Artwork | Home → Type → Builder → pièce |
| Nouveau | — | le mini-éditeur SVG par pièce |

Là où les deux se recoupent, ce document renvoie à l'audit plutôt que de
recommander deux fois (`P0-1`, `P1-2`, `P1-3`, `P1-4`, `P1-5`).

## Les dix documents

| Fichier | Contenu | Livrables demandés |
| --- | --- | --- |
| [00_SYNTHESE.md](00_SYNTHESE.md) | Le verdict, les chiffres, la direction retenue | 20 |
| [01_AUDIT_GRAPHIQUE.md](01_AUDIT_GRAPHIQUE.md) | La feuille de style mesurée : couleurs, typo, rayons, espacement, états | 1 |
| [02_HOME.md](02_HOME.md) | La première page : problèmes, trois variantes, recommandation | 2, 3 |
| [03_CREATION.md](03_CREATION.md) | Taxonomie réelle, Type → Sous-type, parcours, cartes, aperçu permanent | 4, 5, 6 |
| [04_COMPATIBILITE.md](04_COMPATIBILITE.md) | Le filtrage des pièces et des presets, les métadonnées, « Tout afficher » | 7, 8 |
| [05_BIBLIOTHEQUE.md](05_BIBLIOTHEQUE.md) | Bibliothèque contextuelle, recherche, remplacement contextuel | 9 |
| [06_BUILDER.md](06_BUILDER.md) | L'architecture du Character Builder : trois variantes, une retenue | 10, 19 |
| [07_DESIGN_SYSTEM.md](07_DESIGN_SYSTEM.md) | Jetons, composants, hiérarchie des actions, vocabulaire | 11, 12 |
| [08_SVG_EDITOR.md](08_SVG_EDITOR.md) | Le modal « Modifier le dessin » : architecture, outils, paths, undo, risques rig | 13 → 17 |
| [09_WIREFRAMES.md](09_WIREFRAMES.md) | Les douze wireframes détaillés | 18 |
| [10_PLAN_PR.md](10_PLAN_PR.md) | Fichiers à modifier et plan `UI-REDESIGN-01 → 10` | 21, 22 |

## Le verdict en trois lignes

Le **moteur de compatibilité existe déjà et fonctionne**
(`core/face-library/compatibility.js`, MASC-04) : il filtre les pièces et les
presets par morphologie, et le Character Builder l'appelle vraiment
(`character-builder.js:163`, `:247`). Ce qui manque n'est pas le filtrage.

Ce qui manque est **la question**. Le choix du type est une ligne d'accordéon
repliée, nommée *Type*, coincée entre *Presets* et *Style*, et quand personne ne
l'a ouverte le code répond `'human'` par défaut (`character-builder.js:194`).

Le redesign consiste donc à **poser la question au bon moment** — avant la
bibliothèque, jamais après — et à donner à l'interface la forme graphique qui
rend cette question évidente.

---

## État d'avancement

| PR | État | Où |
| --- | --- | --- |
| **UI-REDESIGN-01** — Design system | ↩︎ **remplacé** | `styles/tokens.css` · `styles/README.md` (voir ci-dessous) |
| **UI-REDESIGN-02** — Nouvelle Home | ✅ **livré** | `ui/home-surface.js` · `styles/screens.css` |
| **UI-REDESIGN-03** — Type puis Personnage | ✅ **livré** | `ui/new-mascot/` · `core/face-library/face-morphologies.js` |
| **UI-REDESIGN-04** — Filtrage sur toutes les surfaces | ✅ **livré** (en partie via `main`) | `core/face-library/compatibility.js` · `ui/character-builder/` |
| UI-REDESIGN-05 → 10 | à faire | — |

**UI-REDESIGN-01 a été remplacé par la couche de `main`.** Pendant l'écriture de
cette étude, la PR #144 a mené le même audit en parallèle et a livré sa propre
sortie du CSS de `index.html` : `styles/tokens.css` (onze tokens `--ux-*` déjà
lus par les blocs existants, étendus en un vocabulaire complet), plus
`gestures.css`, `library.css`, `preview.css`, `behavior.css` et `shell.css`. Sa
règle est **additive** — le lien `<link>` passe *avant* les blocs `<style>`, donc
adopter la couche ne peut pas déplacer un pixel — là où la mienne (`base.css`,
`components.css`, `surfaces.css`, tokens `--bp-*`) remplaçait les blocs et
inversait la hiérarchie des boutons. Deux systèmes ne peuvent pas cohabiter : le
mien est retiré, `screens.css` est réécrit en `--ux-*`, et la migration décrite
dans [07_DESIGN_SYSTEM.md](07_DESIGN_SYSTEM.md) continue dans
`project/editor/styles/README.md`.

**UI-REDESIGN-04, ce que `main` a livré et ce qui reste de cette branche.** La
recherche (champ dans l'en-tête du panneau, comptage par ligne, `Show every
drawing` pour passer outre le type) vient de `main` ; de cette branche restent le
**tri par affinité** — les dessins qui partagent le vocabulaire du personnage en
cours passent devant, sans que rien n'ait été écrit ligne par ligne — et le
retrait des lignes qu'aucun dessin ne peut remplir.

**Déclaré mais pas encore lu** : `symmetry` et `maxInstances` sur un dessin
(§7 du brief, [04_COMPATIBILITE.md](04_COMPATIBILITE.md) §B). Les deux champs
sont dans le modèle, validés et conservés à l'aller-retour, mais rien ne les
lit encore : la paire est toujours reconstruite à partir des noms de rôles du
rig, et le nombre d'exemplaires vient toujours de `multiple` de la catégorie.
Les lire est le travail d'une PR ultérieure ; ce qui est acquis ici, c'est le
vocabulaire dont un auteur de pack a besoin pour l'écrire.

**Non livré de la PR 02** : les *projets récents* (`core/state/recent-projects.js`).
Le modèle proposé en [02_HOME.md](02_HOME.md) §E tient toujours ; la Home livrée
montre le brouillon local quand il existe, et trois exemples sinon.

**Reste ouvert, et volontairement hors de ces deux PR** : `DEFAULT_MODE` vaut
toujours `design.artwork` (audit `P1-2`). L'assistant, lui, atterrit bien sur
`design.face` ; mais *Partir de la face toute prête*, sous **Autrement**, passe
par `bindLoadSample` et arrive donc encore dans l'éditeur vectoriel. Le corriger
touche le routeur et une dizaine de spécifications : c'est la PR de l'audit, pas
celle-ci.

**Livré dans la PR 04**, et la règle que chacun tient :

| | Règle |
| --- | --- |
| `query` | recherche le nom, la description et les **tags** ; deux mots **restreignent** (ET), ils n'élargissent pas |
| `includeIncompatible` | traverse les types, **jamais** les emplacements — demander des oreilles renvoie des oreilles |
| `affinity` | **trie** et ne filtre jamais ; un renard voit ses oreilles en premier, sans qu'aucune disparaisse |
| `symmetry`, `maxInstances` | deux champs de métadonnées optionnels ; « n'a rien dit » reste `null` et `0` |
| rangées vides | une rangée sans dessin **et** sans pièce portée n'est plus affichée |

**Non livré de la PR 04** : le bouton *Remplacer* contextuel. `assetsFor` est
prêt à le servir (`{ slot, morphology }` suffit), mais le bouton lui-même
appartient à [UI-REDESIGN-07](10_PLAN_PR.md#ui-redesign-07--actions-contextuelles-de-pièces),
qui dépend des gestes de l'audit (`P0-1`, `P0-2`).

**Écart assumé sur la PR 03** : l'assistant applique le personnage mais ne
prévisualise pas encore sur le vrai canvas — l'aperçu est la vignette SVG du
modèle, rendue par `presetThumbnail` à partir des mêmes dessins qu'une pose
installerait. C'est exact, et c'est plus simple que de monter un second canvas.

### Échecs de tests préexistants, confirmés à la base de la branche

Mesurés en reconstruisant le commit `8ff7203` (la pointe de `main` au démarrage
de ce travail) et en rejouant les mêmes spécifications : ils ne viennent pas du
redesign, et ils ne sont pas corrigés ici.

| Spécification | État à `8ff7203` | Remarque |
| --- | --- | --- |
| `ux13-reactions.spec.js:119` — *following the pointer, and acting when left alone* | ❌ échouait | **corrigée** : elle attendait un total (1) là où un groupe compte ses réactions **et** les comportements automatiques classés sous le même déclencheur |
| `ux26-direct-controls.spec.js:177` — *no handle is hidden under another one* | ❌ échouait | **corrigé** : vrai défaut — le badge `+` d'un groupe mordait d'1,5 px sur la poignée qu'il ouvre, et passait devant |
| `ux26-direct-controls.spec.js:201` — *a handle answers to the keyboard* | ❌ échouait | **corrigée** : la poignée de regard pilote `gazeX`, pas `lookX` (le rig de contrôle a séparé les deux) |
| `editor.spec.js` — *inject executable markup*, *phone and tablet* | ❌ échouaient | **corrigées ici** : elles entraient par `page.goto('./')`, qui n'installe pas la couture `?e2e=1` |
| `ux45-character-builder.spec.js:1297` — *Type … offers only the kinds the library can draw* | ❌ échouait | **corrigée ici** : elle tenait `muzzle`, `beak` et `robot` pour indisponibles, ce qui a cessé d'être vrai quand MASC-10B/11B/12B ont été dessinés |
