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
