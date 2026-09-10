# 0001 — Corriger un match après coup

*État : à valider · Écrit le 10 septembre 2026, révisé le même jour après le balayage « Après le match »*

## Le problème

Un lundi soir, la feuille se tient debout, à une main, entre deux matchs, par
quelqu'un qui joue aussi. On se trompe. On tape sur la mauvaise tuile, on
compte un but qui n'était pas dedans, on oublie celui de la dernière minute.

**Aujourd'hui, une fois le match terminé, personne ne peut le corriger depuis
un écran.** Vérifié, et corrigé après le balayage du 10 septembre :

- le **serveur** accepte qu'un admin ajoute ou retire un but sur un match
  terminé — `POST`/`DELETE …/matches/[matchId]/events` répond
  « Admin requis pour modifier un match terminé » (403) à qui ne gère pas, et
  recalcule le score depuis les buts (`recomputeScore`,
  `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30, 68-73`).
  **La règle existe. Aucun écran ne l'appelle.**
- les deux **couches locales** refusent, elles, toute écriture sur un match
  `FINISHED` : `lib/localMatch.ts:324,496,548` côté site,
  `five-scorer-mobile/lib/match/local.ts:411,585,626` côté app. C'est le bon
  réflexe pour la saisie en direct ; c'est ce qui rend la correction
  impossible depuis la feuille.
- `updateMatchDetails` (`app/actions/matches.ts:37`), le seul formulaire
  d'édition qui existe, ne touche **ni au score ni aux buteurs** : noms
  d'équipes, date, homme du match, saison, notes.
- et **aucune trace** : `Match.updatedAt` existe (`prisma/schema.prisma:379`)
  mais n'est ni affiché ni accompagné d'un auteur.

Conséquence : un score faux reste faux. Il compte au classement, dans l'Élo,
dans la forme, dans le derby, dans les records. Toute la saison.

**Et il existe pire que ne rien pouvoir corriger : pouvoir tout effacer.**
`deleteMatch` (`app/actions/matches.ts:9-26`, bouton `DeleteMatchButton` sous
le récap, route `DELETE …/matches/[matchId]`) supprime un match terminé,
définitivement, en cascade — événements, participants, votes, réponses —
sans trace ni corbeille. La v1 avait une suppression douce (`deletedAt`) ; la
v2 l'a retirée. Un admin qui confond « corriger » et « supprimer » efface une
soirée du classement en deux taps.

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
- **Supprimer un match.** Même doctrine que pour les joueurs : un match qui
  n'a pas eu lieu s'ANNULE, il ne s'efface pas. Aujourd'hui seul un match
  *programmé* s'annule (`app/actions/schedule.ts:89-114`) ; un match terminé
  ne peut que se supprimer. Cette spec propose l'inverse : l'annulation
  s'étend aux matchs terminés (le match reste, barré, hors des stats, avec un
  motif), et la suppression disparaît du site comme de l'app.
- **Corriger un match d'une saison clôturée** sans le dire très fort : le
  classement d'une saison finie a déjà été lu et commenté.

## Questions ouvertes — à trancher avant le plan

- **Q1. Qui a le droit ?** Le serveur dit aujourd'hui `canManage` (le
  capitaine et les admins). La spec proposait `canScore` (celui qui a saisi).
  Le code a tranché avant nous, et sa raison tient : « modifier un match
  terminé = correction rétroactive → admin ». *Proposition révisée : on garde
  `canManage`, et un membre qui constate l'erreur peut la SIGNALER au
  capitaine depuis le récap — pas la corriger.*
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
- **Q5. Un but ajouté après coup n'a pas de minute.** On la demande, on le met
  en fin de chronologie, ou à une place choisie ? *Proposition : sans minute,
  en fin de chronologie, marqué « ajouté après coup » — demander une minute
  qu'on a oubliée, c'est inviter à l'inventer.*
- **Q6. Le vote de l'homme du match.** Quand un admin le désigne à la main
  dans un club qui vote, sa désignation prime-t-elle (et ferme le vote), ou le
  prochain vote l'écrase-t-il ? Aujourd'hui le second (`app/actions/motm.ts`
  recalcule à chaque voix). *Proposition : la désignation à la main ferme le
  vote, et le dit.*
- **Q7. Le « signalement » de Q1.** Un membre qui voit l'erreur : un bouton
  « Signaler une erreur » qui prévient les admins, ou rien (il le dit sur
  WhatsApp) ? *Proposition : rien dans cette spec — WhatsApp existe ; on y
  reviendra avec les notifications.*

## À quoi on saura que c'est fait

- [ ] Depuis le récap d'un match terminé, on ajoute un but à un joueur, et le
      score affiché passe de `3-2` à `4-2` — sur l'app ET sur la page du site.
- [ ] On retire ce but, le score revient à `3-2`.
- [ ] Le classement, l'Élo et la forme du joueur concerné bougent en
      conséquence : `GET .../stats` rend des chiffres différents avant et
      après, sans qu'on ait touché à autre chose.
- [ ] Le match porte une marque visible « corrigé le … par … » que le récap
      affiche, sur l'app ET sur le site.
- [ ] Un but ajouté après coup apparaît en fin de chronologie, marqué comme tel.
- [ ] Un match terminé s'ANNULE (barré, hors des stats, avec un motif) ; le
      bouton « Supprimer » et la route `DELETE` ont disparu du site.
- [ ] Un match annulé peut être rétabli, et revient dans les stats.
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
