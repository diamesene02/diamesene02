# Comment on travaille : la spec d'abord

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
