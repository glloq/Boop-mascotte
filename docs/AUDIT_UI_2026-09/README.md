# Audit UI/UX complet — septembre 2026

Un audit de l'interface de Boop Mascotte, mesuré contre une seule question :
**est-ce qu'une personne qui ne sait rien du rigging peut fabriquer et modifier
une mascotte sans documentation ?**

L'audit ne touche pas au métier. `ProjectDocument`, les commandes, l'historique,
le canvas, le renderer, les gizmos, le rig et le runtime sont des points fixes —
exactement comme dans [UIR-00](../UIR_REFACTOR_BASELINE.md). Ce qui bouge ici est
la **présentation** : la hiérarchie, la navigation, les interactions, l'ordre des
outils et la divulgation progressive.

## Les six documents

| Fichier | Ce qu'il contient | Sections de la demande |
| --- | --- | --- |
| [00_SYNTHESE.md](00_SYNTHESE.md) | Le verdict en une page, les dix problèmes qui comptent, la cible | — |
| [01_ETAT_ACTUEL.md](01_ETAT_ACTUEL.md) | L'inventaire : chaque page, panneau, barre, menu, overlay, avec son verdict | §1 |
| [02_PROBLEMES.md](02_PROBLEMES.md) | Les problèmes par zone : builder, pièces, suppression, canvas, navigation, inspector, preview, bibliothèque, compatibilité, états vides | §3 → §9, §11, §14 |
| [03_WORKFLOWS.md](03_WORKFLOWS.md) | Les 22 opérations de création reconstituées, comptées, et le tableau avant/après | §2, §20 |
| [04_RECOMMANDATIONS.md](04_RECOMMANDATIONS.md) | Les recommandations détaillées : bibliothèque, compatibilité, disclosure, rendu, assistant, menus, raccourcis, responsive, comparaison logiciels, fonctions manquantes | §5, §6, §10, §12, §13, §15 → §19 |
| [05_ARCHITECTURE_CIBLE.md](05_ARCHITECTURE_CIBLE.md) | L'architecture UI cible et les wireframes texte | §21, §22 |
| [06_PLAN_PR.md](06_PLAN_PR.md) | La priorisation P0 → P3 et le plan de PR, fichier par fichier | §23, §24 |

## Le verdict en trois lignes

Boop a **toutes** les capacités d'un éditeur de mascottes moderne — une
bibliothèque de 150 dessins, un gizmo correct, un undo transactionnel, une
palette de commandes, un rig sémantique, un runtime exporté. Ce qui manque n'est
pas une fonction : c'est que **la surface simple (Design ▸ Face) n'a pas les
gestes de base**. On ne peut pas y supprimer une pièce au clavier, ni faire un
clic droit, ni voir l'ordre d'affichage, ni dupliquer.

Les capacités existent toutes — elles sont dans *Artwork*, l'éditeur vectoriel
avancé, derrière un onglet que le débutant n'est pas censé ouvrir.

L'essentiel du travail est donc de **porter les gestes de manipulation depuis
Artwork vers Face**, et non d'en écrire de nouveaux.
