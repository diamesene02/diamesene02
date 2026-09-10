# Comment on travaille : la spec d'abord

*Relu le 10 septembre 2026 contre l'état de l'art — [github/spec-kit](https://github.com/github/spec-kit)
et [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec). On n'a installé ni l'un
ni l'autre : nos quatre fichiers SONT leur `specify → plan → tasks`, en français
et dans le vocabulaire du club. On leur a pris les trois choses qu'on n'avait
pas — la **constitution**, la distinction **base / delta**, et les deux
**gardes**.*

## La base et les deltas

`specs/0000-le-club-et-lapp/` est la **base** : ce que le produit fait
aujourd'hui, 549 cas vérifiés dans le code. Elle ne se réécrit pas, elle se
tient à jour.

Toute autre spec est un **delta** : elle ne décrit pas le système, elle décrit
**ce qui change**. Elle nomme donc, dans son texte, **les cas de 0000 qu'elle
referme**, par leur identifiant (`HL-04`, `TRANS-13`…). Quand elle est livrée,
l'état de ces cas passe à `fait` dans `cas.md`.

Sans ce lien, la base vieillit en silence et on répare deux fois la même chose.

## La constitution

`specs/CONSTITUTION.md` porte dix articles qui gouvernent toutes les specs. Une
spec qui en contredit un est refusée — ou change la constitution, et alors elle
le dit, avec la raison. C'est ce que `/analyser` vérifie en premier.

## Les quatre fichiers

Une fonctionnalité passe par quatre fichiers, dans cet ordre, sous
`specs/NNNN-nom-court/` :

| Fichier | Ce qu'il contient | Ce qu'il ne contient PAS |
|---|---|---|
| `spec.md` | Le **problème**, dans les mots du club. Ce qu'on doit pouvoir faire, et à quoi on saura que c'est fait. | Aucune solution. Ni écran, ni route, ni table. |
| `plan.md` | Le **comment** : contrat serveur, découpage de l'écran, ce qu'on ne fait PAS et pourquoi. | Du code. |
| `taches.md` | La liste **ordonnée**, chaque tâche avec sa vérification exécutable. | Des intentions floues. |
| `journal.md` | Ce qui a **divergé** du plan, et pourquoi. Écrit pendant, pas après. | Un résumé de ce que fait le code — ça, le diff le dit. |

## Pourquoi cet ordre

Le défaut qu'on a payé le plus cher jusqu'ici n'est pas un bug : c'est d'avoir
construit un écran à partir d'un rapport au lieu de la page. Une spec écrite
avant force à poser la question à laquelle personne n'avait répondu — et c'est
souvent là que le vrai travail se révèle. La spec 0001 en est l'exemple : elle
devait dire « on porte le formulaire d'édition », elle dit autre chose.

## Les règles qui ne changent pas

1. **La spec est validée avant le plan, le plan avant la première ligne.**
   Une spec qu'on écrit après le code s'appelle une justification.
2. **Chaque critère d'acceptation est vérifiable par une commande.** « L'écran
   est clair » n'est pas un critère. « `parcours-lecture.mjs` rend TOUT VERT »
   en est un.
3. **Les écarts assumés sont écrits dans le plan, pas découverts dans le
   diff.** Ce qu'on ne fait pas est aussi une décision.
4. **Le journal se tient pendant.** Ce qu'un commit fait se lit dans son diff ;
   ce qu'il a ÉCARTÉ ne se lit nulle part ailleurs.
5. **Rien ne part sans avoir été vu dans le simulateur, à côté de la page du
   site.** C'est la règle du 9 septembre, elle survit à la méthode.

## Ce que ça remplace

`five-scorer/MOBILE.md` reste le plan d'ensemble — la carte du chantier, avec
ses étapes numérotées et leur état. Les specs sont le détail d'une étape, une
par dossier. MOBILE.md pointe vers elles ; elles ne le répètent pas.

## Les deux gardes

Elles s'ouvrent avec une commande, et elles ne sont pas facultatives.

| Garde | Quand | Ce qu'elle empêche |
|---|---|---|
| **`/clarifier NNNN`** | Après la spec, **avant** le plan | Qu'un plan invente en silence les réponses aux questions ouvertes. La spec 0001 en a porté sept pendant des semaines. |
| **`/analyser NNNN`** | Avant la première ligne de code, puis avant de livrer | Qu'un chiffre recopié d'un document à l'autre ne soit jamais recompté. Deux erreurs sont passées le 10 septembre 2026 exactement comme ça — un comptage faux de 51 cas, et un arrondi lu à l'euro au lieu du centime. |

`/analyser` relit la spec **contre la constitution**, **contre le code**
(chaque `fichier:ligne` est rouvert), **contre elle-même**, et **contre la
base**. C'est la relecture adverse, rendue systématique au lieu d'être un coup
de chance.

## Ce qu'on n'a pas pris, et pourquoi

- **Le CLI de spec-kit** (`.specify/`, Python, gabarits anglais) : il installerait
  un second `specs/` à côté du nôtre, en anglais, pour faire ce que nos quatre
  fichiers font déjà. Ses bonnes idées sont ci-dessus.
- **`openspec/changes/`** : même raison — c'est notre `specs/NNNN-…/`.
- **BMAD-METHOD** : douze agents pour simuler une équipe agile. On est un.
