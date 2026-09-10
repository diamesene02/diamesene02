# 0001 — Corriger un match après coup

*État : à valider · Écrit le 10 septembre 2026*

## Le problème

Un lundi soir, la feuille se tient debout, à une main, entre deux matchs, par
quelqu'un qui joue aussi. On se trompe. On tape sur la mauvaise tuile, on
compte un but qui n'était pas dedans, on oublie celui de la dernière minute.

**Aujourd'hui, une fois le match terminé, c'est définitif.** Vérifié :
`lib/localMatch.ts` et `five-scorer-mobile/lib/match/local.ts` refusent toute
écriture sur un match `FINISHED` (trois gardes, lignes 411, 585, 626 côté
mobile). Et `updateMatchDetails` (`app/actions/matches.ts:37`) — le seul
formulaire d'édition qui existe — ne touche **ni au score ni aux buteurs** :
il change les noms d'équipes, la date, l'homme du match, la saison, les notes.

Conséquence : un score faux reste faux. Il compte au classement, dans l'Élo,
dans la forme, dans le derby, dans les records. Toute la saison.

## Pour qui, et quand

Celui qui a saisi, dans les minutes ou les jours qui suivent. Presque toujours
le soir même, en se rhabillant, quand quelqu'un dit « attends, c'était 4-3 ».

## Ce qu'on doit pouvoir faire

1. **Ajouter un but oublié** à un match terminé, avec son buteur.
2. **Retirer un but** qui n'a pas eu lieu, ou qui a été attribué à la mauvaise
   personne.
3. **Corriger les à-côtés** : les noms d'équipes, la date et l'heure, l'homme
   du match, les notes.
4. **Savoir qu'un match a été corrigé**, et par qui. Une feuille qui change en
   silence après coup, dans un club, ça finit en discussion.

## Ce qu'on ne doit PAS pouvoir faire

- **Taper un score à la main.** Le score est la somme des buts ; le poser
  directement le désaccorderait des buteurs, et c'est le buteur qui compte au
  classement. On corrige des BUTS, jamais un score.
- **Supprimer un match.** Rien dans l'app ne supprime — même doctrine que pour
  les joueurs. Un match qui n'a pas eu lieu s'annule, il ne s'efface pas.
- **Corriger un match d'une saison clôturée** sans le dire très fort : le
  classement d'une saison finie a déjà été lu et commenté.

## Questions ouvertes — à trancher avant le plan

- **Q1. Qui a le droit ?** `canManage` (le capitaine) ou `canScore` (celui qui
  a saisi) ? Le premier est plus sûr, le second colle à qui se rend compte de
  l'erreur. *Proposition : `canScore`, avec la trace de qui a corrigé.*
- **Q2. Jusqu'à quand ?** Toujours, ou une fenêtre ? Le calendrier de la saison
  utilise déjà six semaines pour « on peut encore rattraper une soirée »
  (`app/api/clubs/[clubId]/saison/route.ts`). *Proposition : la même fenêtre,
  au-delà c'est un geste d'admin.*
- **Q3. Où ça vit ?** Sur le récap du match, ou dans un écran à part ?
  *Proposition : sur le récap, qui est déjà l'endroit où l'on constate
  l'erreur.*
- **Q4. Hors-ligne ?** La correction passe-t-elle par la file d'attente comme
  la saisie en direct, ou exige-t-elle le réseau comme les réglages ? *La
  saisie en direct est hors-ligne parce qu'on est au gymnase ; une correction
  se fait au chaud. Proposition : réseau exigé.*

## À quoi on saura que c'est fait

- [ ] Depuis le récap d'un match terminé, on ajoute un but à un joueur, et le
      score affiché passe de `3-2` à `4-2` — sur l'app ET sur la page du site.
- [ ] On retire ce but, le score revient à `3-2`.
- [ ] Le classement, l'Élo et la forme du joueur concerné bougent en
      conséquence : `GET .../stats` rend des chiffres différents avant et
      après, sans qu'on ait touché à autre chose.
- [ ] Le match porte une marque visible « corrigé le … » que le récap affiche.
- [ ] Un membre sans droit reçoit un refus explicite, pas un écran qui ne
      réagit pas.
- [ ] `scripts/parcours-lecture.mjs` étendu à ce lot rend **TOUT VERT**, et
      reste vert sur trois passages d'affilée.
- [ ] `tsc --noEmit` vert des deux côtés, `next build` en 0,
      `expo export --platform ios` en 0, `vitest` vert.
- [ ] Le tour complet rejoué sur le simulateur, à côté de la page du site.

## Ce que ça débloque

Le lundi soir cesse d'être irrattrapable. C'est aussi le préalable honnête à
tout ce qui lit ces chiffres — le classement, les records, le palmarès de fin
de saison : ils ne valent que si on peut réparer une faute de frappe.
