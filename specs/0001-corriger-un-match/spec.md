# 0001 — Corriger un match après coup

*État : **questions tranchées, prête pour le plan** · Écrite le 10 septembre 2026,
révisée le même jour après le balayage « Après le match », puis passée à la garde
`/clarifier` — les huit questions sont fermées : **une par le code** (Q1),
**quatre par Ibrahima** (Q2, Q5, Q6, Q8) et **trois tranchées ici** parce
qu'elles n'avaient qu'une réponse défendable (Q3, Q4, Q7).*

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

## Questions tranchées

*Garde `/clarifier` passée le 10 septembre 2026. Trois questions l'ont été par
le code — la preuve est citée. Quatre par Ibrahima le même jour. Aucune ne
reste ouverte : le plan peut s'écrire.*

- **Q1. Qui a le droit ? → `canManage`.** *Tranchée par le code, pas par nous.*
  `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68-73` répond déjà
  403 « Admin requis pour modifier un match terminé » à qui ne gère pas. La
  raison tient : modifier un match terminé est une correction rétroactive. On ne
  la rediscute pas.

- **Q2. Jusqu'à quand ? → six semaines, puis un geste d'admin.** *Ibrahima, le
  10 septembre 2026.* La même fenêtre que le calendrier utilise déjà pour
  réclamer une soirée non saisie — `app/api/clubs/[clubId]/saison/route.ts:127`,
  `42 * 86400_000` — dont le commentaire dit exactement pourquoi : « au-delà de
  six semaines on se tait, le score, plus personne ne l'a en tête ». Au-delà, la
  correction reste possible mais demande une confirmation qui **dit** que cette
  saison a déjà été lue et commentée.

- **Q3. Où ça vit ? → sur le récap du match.** *Tranchée ici, sans le déranger :
  c'est là qu'on constate l'erreur, et un écran de plus pour un geste qu'on fait
  deux fois par saison est un écran qu'on ne trouve pas.*

- **Q4. Hors-ligne ? → réseau exigé.** *Tranchée ici.* La saisie en direct est
  hors-ligne parce qu'on est au gymnase ; une correction se fait au chaud, et
  rejouée depuis la file elle écraserait un arbitrage que quelqu'un d'autre
  aurait rendu entre-temps. C'est déjà la règle pour les Stats, la Saison et les
  Réglages (spec 0000). **Conséquence à tenir :** le refus doit le dire — pas un
  bouton qui ne réagit pas (constitution, article V).

- **Q5. La minute d'un but ajouté après coup ? → aucune, en fin de chronologie,
  marqué comme tel.** *Ibrahima, le 10 septembre 2026.* Demander une minute
  qu'on a oubliée, c'est inviter à l'inventer — et rien ne la distinguerait plus
  jamais d'une minute réelle.

- **Q6. La désignation à la main contre le vote ? → la désignation ferme le
  vote, et le dit.** *Ibrahima, le 10 septembre 2026.* Aujourd'hui c'est
  l'inverse, et en silence : `app/actions/matches.ts:43` écrit `mvpId` **sans
  regarder `motmMode`**, puis `app/actions/motm.ts:70` recompte à chaque voix et
  l'écrase. Le récap doit afficher « désigné par le capitaine » et fermer le
  vote. **Trouvé au passage, à corriger dans le même lot :**
  `updateMatchDetails` vérifie que l'homme du match est un joueur **du club**
  (`matches.ts:22`), pas **du match** — on peut donc désigner quelqu'un qui n'a
  pas joué. La spec 0000 le liste comme une règle tenue par personne.

- **Q7. Le signalement par un membre ? → rien dans cette spec.** *Tranchée ici.*
  WhatsApp existe et fonctionne. Un bouton qui « prévient les admins » sans
  qu'aucune notification n'existe dans le produit (spec 0000, Q-E) serait un
  bouton qui ne fait rien. On y reviendra avec les notifications.

- **Q8. La suppression ? → l'annulation, pour le MATCH seulement, dans ce
  lot.** *Ibrahima, le 10 septembre 2026.* Le statut `CANCELED` existe déjà
  (`prisma/schema.prisma:344`) et `app/actions/schedule.ts:103-104` s'en sert —
  mais seulement sur un match `SCHEDULED`. L'étendre aux matchs terminés est un
  mot dans une clause `where`, et les statistiques n'ont rien à apprendre :
  elles ne lisent que `FINISHED` (`lib/stats.ts`), donc un match annulé en sort
  tout seul. Les **six autres** chemins de suppression dure du dépôt (la soirée
  et sa cascade sur qui a payé, l'adversaire, le membre, la compo — spec 0000
  § 7.5) restent ouverts et attendent leur propre lot. C'est un périmètre
  assumé, pas un oubli (constitution, article X).

## Les cas de la base que ce lot referme

*La spec 0000 est la base ; celle-ci est un delta. Vingt cas, tous vérifiés
présents dans [`cas.md`](../0000-le-club-et-lapp/cas.md). Quand le lot est
livré, leur état y passe à `fait`.*

**Corriger un match terminé** — `TRANS-29` (✗ le sujet même de cette spec) ·
`APRES-11` (⚠ les à-côtés) · `APRES-02` (◐ un but rattrapé avec une minute
antérieure) · `APRES-52` (✗ corriger la minute d'un but) · `APRES-15` (◐ un
match saisi le mauvais jour) · `APRES-D3` (⚠ la date corrigée tombe au mauvais
jour) · `APRES-21` (◐ un nom d'équipe vide ou d'une phrase entière) ·
`APRES-50` (◐ le bilan sous l'écusson après correction d'un nom).

**Annuler au lieu de supprimer** — `APRES-25` (⚠ un admin supprime un match
terminé) · `APRES-26` (⚠ la suppression échoue) · `APRES-51` (◐ retrouver un
match annulé trois semaines après) · `APRES-24` (✗ revenir sur une annulation) ·
`APRES-27` (◐ un match supprimé pendant qu'un téléphone a encore ses buts en
file).

**L'homme du match** — `APRES-17` (⚠ l'admin le pose dans un club qui vote) ·
`APRES-18` (◐ le désigné n'a pas joué ce match) · `APRES-D2` (⚠ attribué par
erreur à quelqu'un qui n'était pas là) · `TRANS-22` (◐ le formulaire du site
envoie un homme du match ou une saison).

**La fenêtre et les droits** — `APRES-14` (⚠ corriger un match d'une saison
clôturée) · `APRES-12` (◐ celui qui a saisi constate l'erreur et ne peut rien) ·
`APRES-30` (◐ deux admins corrigent le même match en même temps).

**Explicitement PAS dans ce lot**, et c'est une décision (constitution,
article X) : les six autres chemins de suppression dure — la soirée et sa
cascade sur qui a payé (`SOIREE-51`, `SOIREE-D3`), l'adversaire (`ADV-04`), le
membre, la compo. Ils restent `⚠ faux` dans la base jusqu'à leur propre lot.

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
      bouton « Supprimer » et la route `DELETE` ont disparu du site ET de l'app.
      L'annulation réutilise le statut `CANCELED` qui existe déjà
      (`prisma/schema.prisma:344`) : `lib/stats.ts` ne lit que `FINISHED`, donc
      un match annulé sort des chiffres sans qu'on touche aux statistiques.
- [ ] Passé six semaines (`42 * 86400_000`, la fenêtre du calendrier), corriger
      demande une confirmation qui DIT que cette saison a déjà été lue — pas un
      « Êtes-vous sûr ? » (constitution, article V).
- [ ] Une désignation d'homme du match à la main FERME le vote, et le récap
      affiche « désigné par le capitaine ». Un second vote ne l'écrase plus.
- [ ] On ne peut pas désigner comme homme du match quelqu'un qui n'a pas joué
      ce match — le contrôle porte sur la FEUILLE, pas sur le club
      (`app/actions/matches.ts:22` vérifie aujourd'hui le club).
- [ ] Une correction tentée sans réseau le dit et ne fait rien à moitié ; elle
      ne part PAS dans la file d'attente.
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
