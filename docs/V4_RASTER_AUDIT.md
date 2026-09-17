# Audit — importer et gérer des images PNG / WebP

*Second audit du programme V4, cette fois limité au chemin des images : ce qui
se passe entre un fichier posé sur l'éditeur et une mascotte exportée. Écrit en
relisant le code et en le faisant tourner dans Chromium, pas en relisant le
plan.*

Le premier audit (`docs/V4_AUDIT.md`) portait sur l'ensemble du programme.
Celui-ci ne regarde que onze modules — validation, magasin, gestionnaire,
optimisation, placement, résolution, peinture, dépôt, export, paquet `.boop`,
Inspecteur — et il est plus sévère, parce qu'un pipeline binaire est l'endroit
où un bug reste invisible le plus longtemps.

**Onze constats. Huit corrigés ici, trois consignés.**

---

## Ce qui est solide

Vérifié avant de chercher les défauts, parce qu'un audit qui ne dit que le
mauvais ne dit rien.

- **Les en-têtes sont lus, jamais décodés.** `readPng` / `readWebp` lisent la
  taille dans le conteneur, donc un PNG annonçant 3,6 milliards de pixels est
  refusé pendant qu'il est encore un en-tête. Les trois cadrages WebP — `VP8X`,
  `VP8L`, `VP8 ` — sont traités séparément et correctement, y compris le drapeau
  alpha de `VP8X` (bit 4 de l'octet 20) et le champ empaqueté de `VP8L`.
- **L'extension et le `type` du navigateur ne sont jamais crus.** Les octets
  décident ; un désaccord est signalé plutôt que subi.
- **L'ordre de l'import est le bon** : valider → redimensionner → hacher →
  stocker. Hacher avant de redimensionner nommerait des octets que personne ne
  garde.
- **Le magasin est adressé par contenu**, donc un `put` d'un identifiant déjà
  présent est un no-op et non un écrasement, et deux imports du même fichier
  partagent un enregistrement sans que rien ne compte les références.
- **La transaction IndexedDB attend son `oncomplete`**, pas seulement sa
  requête : un dépassement de quota arrive en `abort` après un succès apparent.
  Les gestionnaires sont attachés avant tout `await`, ce qui est porteur et non
  cosmétique.
- **Les URL d'objet sont révoquées.** `refreshAssets` amorce, peint, puis
  appelle `retain(références)` : une image que le dessin ne montre plus perd son
  URL. Le runtime ne le fait pas, et c'est correct — son jeu d'images est fixé
  au chargement.

---

## Corrigé

### 1. La même image ne pouvait pas être ajoutée deux fois *(déjà corrigé au précédent audit, rappelé ici car c'est le même pipeline)*

`<input type="file">` n'émet `change` que si sa valeur change. Un visage a deux
yeux et ils sortent d'un seul `eye.png`.

### 2. Un magasin en échec accusait le fichier

`addImageFile`, `addBaseImageFile` et `replaceImageFile` enveloppaient la
lecture *et* l'import dans un seul `catch` disant « Could not read head.png ».
Un quota plein, une transaction bloquée par un autre onglet, un navigateur sans
`SubtleCrypto` : les trois envoyaient l'auteur examiner un fichier parfaitement
sain.

Les trois échecs sont maintenant distincts — `importPicture()` — et celui du
magasin dit ce qu'il est : *« head.webp could not be stored: QuotaExceededError »*.

### 3. « Cette page ne gardera pas vos images » n'était dit à personne

Le magasin rapporte `persistent` et `reason` précisément pour cela, et **rien ne
les lisait**. En navigation privée, avec les données de site bloquées, ou sans
IndexedDB, le repli mémoire est correct — on doit pouvoir travailler — mais le
silence ne l'est pas. Le commentaire du module le dit lui-même : *« autosave
quietly stopping at the images while claiming to have saved »*. C'était le
comportement réel.

Dit une fois, à la première image effectivement stockée : au démarrage ce serait
un avertissement sur une fonctionnalité que personne n'utilise encore.

### 4. Une image déposée n'atterrissait pas là où on la déposait

Le geste le plus naturel — glisser un fichier sur l'œil gauche de la mascotte —
ignorait complètement le point visé : `createPictureDrop` ne transmettait que le
`File`, et `addImageFile` centrait tout dans l'artboard. Le premier geste de
l'auteur était de déplacer ce qu'il venait de déplacer.

Et **le test navigateur s'appelait « added where it was dropped on » sans jamais
le vérifier** : il n'affirmait que la présence du nœud. C'est exactement la
faille qui a laissé l'import raster être livré cassé deux fois.

Le point est maintenant transmis en coordonnées client, converti en unités
d'artwork par le canvas (`artworkPointAt`, qui existait déjà), et borné dans la
zone de travail — un dépôt hors artboard placerait sinon une pièce là où rien
n'est dessiné. Le test compare la position du nœud au point converti ; **sans le
correctif il échoue de 59,65 unités**, vérifié.

### 5. L'export embarquait les images que rien ne dessine

Un projet conserve toutes les images jamais importées : remplacer une image
laisse la précédente dans la table, **volontairement**, parce que l'annulation
doit pouvoir y revenir (« no action that can be undone deletes bytes »).

Rien de tout cela ne regarde une page web. Mesuré : un import puis un
remplacement produisent une archive contenant `assets/05f4…webp` *et*
`assets/623d…png`, dont une seule est dessinée.

L'export ne prend maintenant que les images référencées, lues dans le SVG qui
est sur le point d'être écrit — donc un nœud supprimé sur le canvas emporte son
image avec lui, même avant que le document n'ait rattrapé. Rien n'est effacé :
c'est l'archive qui est filtrée, pas le projet.

### 6. Le `.boop` les embarque aussi, et personne ne le disait

Là, les garder est juste : un `.boop` est le *projet*, et une image remplacée
est une image que l'annulation peut ramener. Ce qui manquait, c'est de le dire —
un projet double de taille à chaque échange d'image sans que rien ne le
mentionne. La sauvegarde le nomme désormais : *« 3 of them are ones nothing
draws any more, kept so undo can reach them »*.

### 7. L'archive exportée n'était jamais ouverte par un test

Le seul test de bout en bout de l'export vérifiait **le nom du fichier
téléchargé**. Une archive vide appelée `mascot-export.zip` passait. Or la boucle
asynchrone qui lit les octets du magasin (`exporter.js`, ligne 96) n'est
atteinte par rien d'autre : la suite unitaire fournit sa propre `Map`.

Le test ouvre maintenant le zip, compare l'image octet pour octet au fichier
importé, et vérifie que le SVG pointe sur `assets/…` et non sur un schéma
qu'aucun navigateur ne connaît.

### 8. Deux détails

- Une image remplacée par une image de forme différente est **ajustée dans
  l'ancienne boîte** (`preserveAspectRatio="xMidYMid meet"`) : correct, et
  invisible — elle arrive simplement plus petite que son emplacement. Le statut
  le dit maintenant quand les proportions diffèrent.
- `import()` pouvait rendre `{ ok: true, asset: null }` si `normalizeAsset`
  rejetait l'enregistrement qu'il venait de construire ; les trois appelants
  lisent `.asset.id` sans regarder. Jamais observé, désormais vérifié.
- Le garde `!Number.isFinite(size)` dans la marche des chunks PNG était mort
  (`be32` rend toujours un nombre). Remplacé par la raison réelle pour laquelle
  la boucle termine.

---

## Consigné, non corrigé

### A. `collect()` n'a toujours aucun appelant

La fonction existe, est documentée, est testée — et rien ne l'appelle. La
feuille de route avait tranché : *« Collection stays a deliberate thing, done
where there is nothing to undo »*, ce qui est juste et n'a jamais été suivi
d'un endroit délibéré.

Les correctifs 5 et 6 traitent la conséquence visible (ce qui est livré, ce qui
est dit) sans rien effacer. Ce qui reste à décider est un geste d'auteur —
*« Supprimer les 3 images inutilisées »* — donc une fonctionnalité, pas une
correction.

### B. Aucun plafond sur le magasin

`store.bytes()` existe et personne ne l'appelle. Pas de budget, pas
d'avertissement, pas d'éviction : combiné à A, une longue session grandit sans
limite jusqu'au quota du navigateur, et le quota arrive maintenant comme un
message clair (correctif 2) plutôt que comme un mystère — mais il arrive.

### C. `asset.alpha` n'est lu par personne

Stocké, normalisé, documenté sur douze lignes, et aucun lecteur — en
particulier l'offre « découper par la transparence » ne le consulte pas.

Il porte en outre une incohérence latente : après un redimensionnement, la
valeur décrit les octets **d'origine**, pas ceux qui sont stockés. Le
redimensionnement réencode via un canvas, qui écrit toujours du RGBA (vérifié :
`convertToBlob({type:'image/png'})` produit un type de couleur 6), tandis
qu'`alpha` vient de l'en-tête d'avant. Sans lecteur, c'est aujourd'hui
inobservable — ce qui est précisément pourquoi il faut l'écrire quelque part.

---

## État

| | |
| --- | --- |
| Tests unitaires | 2 336 → **2 342**, tous verts |
| Tests navigateur raster | 11, tous verts, dont deux qui échouaient avant les correctifs |
| `npm run verify` | propre |

Les six nouveaux tests couvrent : l'échec du magasin, l'avertissement de
persistance (dit une fois, et pas du tout quand le magasin est persistant), le
placement au point de dépôt avec bornage, l'export filtré, l'archive ouverte et
comparée, et le remplacement de forme différente.
