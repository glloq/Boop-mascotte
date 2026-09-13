# 00 — Synthèse

## Le verdict

Boop a **150 dessins, 22 personnages prêts, 4 types de mascotte utilisables, et
un moteur de compatibilité qui filtre déjà tout cela correctement.**

Le chemin par défaut en montre **48 dessins et 6 personnages.**

```js
// ui/character-builder/character-builder.js:191
function activeMorphology() {
  if (morphology) return morphology;      // ← si quelqu'un a trouvé la ligne « Type »
  const worn = morphologiesOfFace(doc(), {…});
  return worn.length === 1 ? worn[0] : 'human';   // ← sinon : humain, en silence
}
```

Le choix qui conditionne toute l'interface est une **ligne d'accordéon repliée**,
en deuxième position d'une liste de seize, nommée `Type`, dont les options
s'appellent `Muzzle`, `Beak` et `Monster`. Et son composant déclare lui-même, en
commentaire :

> *« Choosing a kind **changes nothing on the face.** »*

C'est une décision juste pour une ligne qu'on presse par curiosité au milieu d'un
travail. C'est l'inverse de ce qu'il faut pour la première question d'un
parcours.

> **Le redesign n'a pas à construire un système de filtrage. Il a à poser la
> question.**

---

## Les chiffres de l'audit graphique

| | Mesuré | Cible |
| --- | --- | --- |
| Couleurs hexadécimales distinctes | **247** | 22 jetons |
| Occurrences de couleurs en dur | **620** | 0 dans les composants |
| Variables CSS | 11 | 22, et rien d'autre |
| Rayons de bordure distincts | **17** | 5 |
| Tailles de police distinctes | **20** | 6 |
| Déclarations de police ≤ 13 px | **157 sur 180** | corps à 13, libellés à 15 |
| Règles `:hover` | 24 sur 1 245 sélecteurs | une par composant |
| Styles de bouton | **1** (primaire par défaut) | 4 niveaux × 3 tailles |
| Surfaces flottantes | **11**, aucun composant partagé | 1 modale, 1 tiroir, 1 popover |
| Feuille de style | 109 Ko en ligne dans `index.html` | 5 fichiers |
| Part du canvas à 1280 px | **52 %** | 68 % avec l'inspector, 94 % sans |

Le détail, mesure par mesure : [01_AUDIT_GRAPHIQUE.md](01_AUDIT_GRAPHIQUE.md).

---

## Les huit constats qui portent le redesign

| # | Constat | Où |
| --- | --- | --- |
| **1** | **Il n'y a pas de design system, il y a 1 245 décisions locales.** Le style par défaut d'un `<button>` est *primaire bleu plein*, donc une topbar de dix boutons est dix boutons primaires, et `Créer la mascotte` ne peut pas ressortir. La classe `.primary`, écrite à trois endroits du code, **n'est définie nulle part** — et personne ne l'a remarqué. | [01](01_AUDIT_GRAPHIQUE.md) §E |
| **2** | **La Home ne dit pas ce que fait le logiciel**, ne montre aucune mascotte, et *Ouvrir un projet* y est une phrase en gris de 12 px qui explique où chercher un bouton situé ailleurs. | [02](02_HOME.md) §B |
| **3** | **Le type n'est jamais demandé** et vaut `'human'` par défaut : 68 % de la bibliothèque est invisible. | [03](03_CREATION.md) §B |
| **4** | **Le sous-type demandé existe déjà — ce sont les presets.** `cat` n'est pas une catégorie menant à un choix de base : c'est la base. Insérer « Mammifère » entre *Animal* et *Chat* ajouterait une étape qui ne divise rien. | [03](03_CREATION.md) §C |
| **5** | **L'étape « Style » n'a qu'une option et zéro variante dessinée.** C'est une étape à un choix. | [03](03_CREATION.md) §C |
| **6** | **Le filtrage existe et fonctionne** (`compatibility.js`, MASC-04) : `presetsFor` partitionne les 22 modèles sans une seule fuite. Il manque la recherche, l'affinité, le remplacement contextuel et l'échappatoire. | [04](04_COMPATIBILITE.md) §A |
| **7** | **Neuf des dix métadonnées de §7 sont déjà là**, dont `host` (parent logique) et `depth`. Manquent la symétrie déclarée et le nombre d'exemplaires. | [04](04_COMPATIBILITE.md) §C |
| **8** | **Le mini-éditeur SVG est à 90 % écrit.** `setEditScope` isole déjà une pièce avec le reste à 22 % ; `path-nodes`, `path-controls`, `path-edit` font l'édition ; `migrateElementTopology` porte les shape keys à travers un changement de topologie ; `beginTransaction` garantit une seule étape d'undo. Il manque **un cadre**. | [08](08_SVG_EDITOR.md) §A |

---

## La direction retenue

### La première page — variante « Affiche »

Un héros centré : la mascotte, une phrase, **deux boutons**, et les projets
récents en dessous quand il y en a. Trois variantes ont été comparées
([02](02_HOME.md) §C) ; celle-ci est la seule qui se comporte bien **au premier
lancement**, qui est le moment que la demande cible. Son défaut — moins bonne
avec beaucoup de projets — se corrige par un lien `Tous les projets` qui déplie
la grille pleine largeur de la variante B.

```text
                        ( ◕  ◕ )
                          ‿

              Créez et animez votre mascotte

   [ + Nouvelle mascotte ]     [ Ouvrir un projet ]

   REPRENDRE                          Tous les projets (7) →
   [ Renard ] [ Robot 2 ] [ Chouette ]
```

### Le parcours — deux décisions, pas cinq

```text
Type  ──►  Personnage  ──►  Character Builder
 4 cartes     4–6 cartes      tout le reste
```

| Étape §9 | Décision | Motif |
| --- | --- | --- |
| Choisissez votre mascotte | **gardée** | c'est ce qui filtre tout |
| Choisissez une famille | **fusionnée** | la famille *est* la base |
| Choisissez un style | **retirée** | 1 style, 0 variante |
| Choisissez une base | **gardée** → étape 2 | |
| Personnalisez | **sortie de l'assistant** | c'est le Builder |
| Modifier dans l'éditeur | **supprimée** | le Builder *est* l'éditeur |

`Style` revient automatiquement quand deux styles auront des variantes dessinées.

### La taxonomie — renommée, pas inventée

```text
interne (inchangé)   visible
human                Humain        48 dessins · 6 modèles
muzzle               Animal        88 dessins · 6 modèles
beak                 Oiseau        54 dessins · 6 modèles
robot                Robot         61 dessins · 4 modèles
monster              Créature      non affiché — aucune corne dessinée
```

Une carte grisée en permanence n'est pas une promesse, c'est une frustration
répétée. `Créature` réapparaît **automatiquement** dès qu'une corne existe :
`availableMorphologies()` le décide déjà.

### Le Character Builder — variante « rail + tiroir »

```text
┌────┬──────────────────────────────────┬─────────────┐
│ 72 │            canvas 68 %           │ inspector   │
│ ◯  │                                  │ Œil gauche  │
│ ◉ ●│           ( ◕  ◕ )               │ ⇄ ⧉ ✎ 🗑    │
│ ⌒  │              ◣                   │ ▾ Position  │
│ ◣  │                                  │ ▾ Couleurs  │
│ ♜  │                                  │ ▸ Avancé    │
│ ◈  │                                  │             │
│ ✋ │                                  │             │
└────┴──────────────────────────────────┴─────────────┘
```

Trois architectures comparées ([06](06_BUILDER.md) §B). Le rail est retenu parce
qu'il est le seul à donner au canvas la part demandée par §11 sans rendre
l'interface muette, parce que le motif du tiroir **existe déjà** dans le dépôt
(c'est la disposition mobile), et parce qu'il règle d'un coup les quatre
méta-choix mal placés, la bibliothèque sous la ligne, et les 300 px de colonne.

**Dépendance dure** : un rail d'icônes n'est lisible qu'avec de vraies icônes.
Les puces Unicode actuelles (`▽` nez et `▽` museau, `◠` paupières et `⌒`
sourcils) ne suffisent pas. Le jeu SVG de [07](07_DESIGN_SYSTEM.md) §F n'est pas
une option.

### Le modal « Modifier le dessin » — un cadre sur un moteur écrit

```text
┌─────────────────────────────────────────────────────┐
│ ✎ Modifier le dessin — Bec                      ✕   │
├──────┬──────────────────────────────────────────────┤
│ ▶ ⌁  │                  ●━━━●                       │
│ ✎ ▭  │                 ╱ ○ ○ ╲                      │
│ ──   │                ●       ●                     │
│ ■    │                                              │
│      │ [ Pièce seule │ Contexte ]    ⊖──●──⊕  Ajust.│
├──────┴──────────────────────────────────────────────┤
│ Annuler          ↶ ↷      Réinitialiser   Appliquer │
└─────────────────────────────────────────────────────┘
```

**Quatre outils**, pas dix-huit. Sept des outils listés en §16 sont écartés avec
leur raison ([08](08_SVG_EDITOR.md) §C) : le gizmo fait déjà déplacer, tourner et
redimensionner en un geste, et trois boutons de plus seraient trois modes à
comprendre pour zéro capacité.

Le modèle technique retenu est la **transaction ouverte**, et non un bac à
sable : `beginTransaction()` à l'ouverture, `commitTransaction()` à *Appliquer*,
`commit + undo` à *Annuler*. Coût en code neuf : **zéro** — l'aperçu en contexte
est le canvas lui-même, et l'étape d'undo unique est déjà garantie.

Le mode *Contexte* est le comportement actuel de `[data-editor-scope=out]`.
*Pièce seule* est une règle CSS de plus.

---

## Ce que l'étude ne recommande pas

- **Ne pas ajouter de niveau « Mammifère / Oiseau / Reptile ».** Les six presets
  de `muzzle` sont tous des mammifères ; le niveau ne diviserait rien, et son
  sous-niveau aurait une entrée peuplée sur quatre.
- **Ne pas afficher les types indisponibles en grisé.** `Monster` est grisé
  depuis MASC-01 avec la note « Nothing is drawn for its horns yet ».
- **Ne pas proposer `Torse · Bras · Ailes · Pattes · Queue`.** Boop rigge un
  visage et deux mains flottantes ; les 150 dessins sont dans 15 emplacements,
  tous faciaux ou main. Inventer ces rangées serait inventer des catégories que
  les ressources ne portent pas ([05](05_BIBLIOTHEQUE.md) §A).
- **Ne pas construire un second canvas pour le modal.** `setEditScope` fait déjà
  l'isolation, et un second document imposerait un moteur de fusion.
- **Ne pas écrire un moteur de compatibilité.** Il existe, il est pur, il est
  testé, et il est déjà appelé.
- **Ne pas refaire la navigation en quatre espaces**, ni rejouer l'audit
  précédent : ses dix problèmes et son plan P0 → P3 restent valables et sont
  cités là où ils se recoupent.

---

## L'effort, et où se trouve le gain

```text
01 ──► 02 ──► 03 ──► 04 ──┐
                          ├──► 05 ──► 06 ──► 07 ──► 08 ──► 09 ──► 10
   audit P0-1, P0-2 ──────┘
   ▲                      ▲                                        ▲
   │                      │                                        │
   prérequis          ★ l'essentiel du gain                    outil complet
                        est livré ici
```

**Après la PR 04**, le parcours d'entrée est réparé : la Home dit ce que fait le
logiciel, le type est demandé en premier, et les 150 dessins et 22 modèles sont
atteignables. Ces quatre PR ne touchent **ni le canvas, ni le rig, ni le
runtime** : elles modifient la présentation, deux champs optionnels de
métadonnées et une table de libellés.

La première minute passe alors de **trois blocages et cinq frictions** à **zéro
blocage**, sans qu'un seul mot technique — `morphology`, `beak`, `preset`,
`rig`, `semantic` — n'apparaisse à l'écran ([03](03_CREATION.md) §H).

---

## Les 22 livrables demandés

| # | Livrable | Où |
| --- | --- | --- |
| 1 | Audit graphique actuel | [01](01_AUDIT_GRAPHIQUE.md) |
| 2 | Problèmes de la page d'accueil | [02](02_HOME.md) §B |
| 3 | Nouvelle architecture de la Home | [02](02_HOME.md) §C–D |
| 4 | Nouvelle logique de création | [03](03_CREATION.md) §D |
| 5 | Taxonomie des types | [03](03_CREATION.md) §C |
| 6 | Logique Type → Sous-type | [03](03_CREATION.md) §C |
| 7 | Système de filtrage des pièces | [04](04_COMPATIBILITE.md) §D |
| 8 | Filtrage des presets | [04](04_COMPATIBILITE.md) §F |
| 9 | Nouvelle bibliothèque contextuelle | [05](05_BIBLIOTHEQUE.md) |
| 10 | Architecture du Character Builder | [06](06_BUILDER.md) §C |
| 11 | Design system recommandé | [07](07_DESIGN_SYSTEM.md) |
| 12 | Interactions principales | [07](07_DESIGN_SYSTEM.md) §D–E, [05](05_BIBLIOTHEQUE.md) §D |
| 13 | Architecture du modal SVG Editor | [08](08_SVG_EDITOR.md) §B |
| 14 | Outils SVG indispensables | [08](08_SVG_EDITOR.md) §C |
| 15 | Interactions d'édition des paths | [08](08_SVG_EDITOR.md) §D |
| 16 | Intégration Undo/Redo | [08](08_SVG_EDITOR.md) §F |
| 17 | Risques vis-à-vis du rig | [08](08_SVG_EDITOR.md) §F |
| 18 | Wireframes (12) | [09](09_WIREFRAMES.md) |
| 19 | Comparaison de variantes | [02](02_HOME.md) §C, [06](06_BUILDER.md) §B |
| 20 | Recommandation finale | ce document |
| 21 | Liste des fichiers à modifier | [10](10_PLAN_PR.md) §A |
| 22 | Plan de PR détaillé | [10](10_PLAN_PR.md) §B |
