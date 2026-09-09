# lib/noyau — copies conformes du web

Les six fichiers `.ts` de ce dossier sont des **copies octet pour octet** de
`five-scorer/lib/`. Ils ne contiennent aucun accès au DOM (`document`,
`window`, `navigator`, `localStorage`) : ils tournent donc tels quels sous
React Native, sous Node et dans un navigateur.

| Fichier | Source | Ce qu'il porte |
|---|---|---|
| `clock.ts` | `five-scorer/lib/clock.ts` | Le chrono du match, dérivé de `elapsedMs` + `runningSince`. |
| `ids.ts` | `five-scorer/lib/ids.ts` | cuid2 côté client, et le garde anti-injection Prisma. |
| `color.ts` | `five-scorer/lib/color.ts` | APCA, encre et bande d'une chasuble, nom français d'une couleur. |
| `theme.ts` | `five-scorer/lib/theme.ts` | Les 30 jetons du thème, dérivés des deux chasubles. |
| `balance.ts` | `five-scorer/lib/balance.ts` | Le tirage de deux équipes équilibrées. |
| `retro.ts` | `five-scorer/lib/retro.ts` | La bascule « match saisi après coup ». |

## La règle, et pourquoi elle tient

**On ne modifie JAMAIS un fichier de ce dossier.** On modifie
`five-scorer/lib/<le même nom>`, puis on recopie :

```bash
cd five-scorer-mobile
for f in clock.ts ids.ts theme.ts color.ts balance.ts retro.ts; do
  cp ../five-scorer/lib/$f lib/noyau/$f
done
```

La raison est celle du §3.5 de `MOBILE.md` : la règle des couleurs, celle du
chrono et celle de l'équilibrage ne doivent exister qu'à **un seul endroit**.
Le jour où l'une bouge, le web et le mobile doivent bouger ensemble.

`copie-conforme.test.ts` vérifie l'égalité octet pour octet à chaque
`npm run tester`. **Un échec de ce test n'est pas un bug du test** : il dit
que le web a bougé et que la copie est en retard (ou qu'on a édité la copie).
La correction est la boucle `cp` ci-dessus, suivie d'une relecture du diff.
