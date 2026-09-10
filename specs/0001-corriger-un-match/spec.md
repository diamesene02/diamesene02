# 0001 — Corriger un match après coup

*État : **corrigée après `/analyser`, prête pour le plan** · Écrite le 10 septembre 2026,
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
- les deux **couches locales** refusent l'écriture sur un match `FINISHED` —
  mais **seulement sur trois gestes des sept** : `addEvent`, `movePlayerTeam` et
  `ajouterJoueurAuMatch` (`lib/localMatch.ts:324,496,548` côté site,
  `five-scorer-mobile/lib/match/local.ts:411,585,626` côté app). **Aucune garde**
  sur `removeEvent`, `setEventAssist`, `setEventScorer` ni `undoLastGoalOf`.

  Ce que ça change, et la garde `/analyser` l'a vu là où j'avais écrit le
  contraire : « retirer un but » sur un match terminé **passe déjà** en local.
  L'opération part dans la file, le serveur la refuse en 403 si l'auteur n'est
  pas admin, et `lib/sync.ts:304-338` bloque alors **toute la chaîne du match**.
  Il n'y a donc pas seulement un chemin à ouvrir : il y en a un à refermer.
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

Dans les minutes ou les jours qui suivent. Presque toujours le soir même, en se
rhabillant, quand quelqu'un dit « attends, c'était 4-3 ».

**Mais pas par celui qui a saisi.** Q1 tranche `canManage` — le capitaine et les
admins — et celui qui tient la feuille est très souvent un simple membre :
`canScore = canManage || club.membersCanScore` (`lib/guard.ts:66`). C'est une
tension assumée, pas un oubli : corriger un match terminé est une correction
rétroactive, et le serveur le dit depuis toujours.

Conséquence à tenir, sans quoi la spec se contredit : **celui qui a saisi doit
au moins comprendre pourquoi il ne peut pas**, et à qui s'adresser. Un bouton
absent sans explication, c'est `APRES-12` inchangé.

## Ce qu'on doit pouvoir faire

1. **Ajouter un but oublié** à un match terminé, avec son buteur.
2. **Retirer un but** qui n'a pas eu lieu, ou qui a été attribué à la mauvaise
   personne.
3. **Corriger les à-côtés** : les noms d'équipes, la date et l'heure, l'homme
   du match, les notes, **et la saison** — `updateMatchDetails` l'écrit déjà
   (`matches.ts:83`), `APRES-14` est d'abord un déplacement de saison, et la
   retirer de cette liste l'aurait fait disparaître en silence.
4. **Savoir qu'un match a été corrigé**, et par qui. Une feuille qui change en
   silence après coup, dans un club, ça finit en discussion.
5. **Annuler un match qui n'a pas eu lieu**, et le rétablir. Un match lancé par
   erreur, un doublon, un test : aujourd'hui les deux seules issues sont
   « Terminer » à 0-0 — qui inscrit un nul, un match joué et un mouvement d'Élo
   à dix personnes pour un match qui n'a pas eu lieu — ou « Supprimer », qui
   efface tout (`APRES-23`). **Rétabli vers `FINISHED`**, avec son score et ses
   buts intacts : l'annulation ne touche qu'au statut.

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

*Garde `/clarifier` passée le 10 septembre 2026, puis garde `/analyser` le même
soir — qui a trouvé deux citations fausses et trois cas oubliés. Corrigé
ci-dessous. **Une** question tranchée par le code (Q1), **quatre** par Ibrahima
(Q2, Q5, Q6, Q8), **trois** ici parce qu'elles n'avaient qu'une réponse
défendable (Q3, Q4, Q7).*

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
  l'inverse, et en silence : `app/actions/matches.ts:79` écrit `mvpId` **sans
  regarder `motmMode`**, puis `app/actions/motm.ts:70` recompte à chaque voix et
  l'écrase. Le récap doit afficher « désigné par le capitaine » et fermer le
  vote.

  **Trouvé par `/analyser`, et plus large que je ne l'avais écrit :** il y a
  **trois portes** qui écrivent un joueur sur un match, et **les trois ne
  vérifient que l'appartenance au CLUB**, jamais à la FEUILLE — le buteur et le
  passeur (`events/route.ts:106`), l'homme du match par le formulaire
  (`matches.ts:56-61`) et par l'API (`matches/[matchId]/route.ts:156-162`). La
  première est celle qu'ouvre la fonctionnalité n°1 de cette spec : ajouter un
  but. Les trois se corrigent dans ce lot.

  *(Mes deux premières citations — `matches.ts:22` et `:43` — étaient fausses :
  `:22` est `deleteMatch`, `:43` est un commentaire. Recopiées de la spec 0000
  sans rouvrir le fichier. C'est exactement le défaut que la garde existe pour
  attraper, et c'est la troisième fois de la journée.)*

- **Q7. Le signalement par un membre ? → rien dans cette spec.** *Tranchée ici.*
  WhatsApp existe et fonctionne. Un bouton qui « prévient les admins » sans
  qu'aucune notification n'existe dans le produit (spec 0000, Q-E) serait un
  bouton qui ne fait rien. On y reviendra avec les notifications.

- **Q8. La suppression ? → l'annulation, pour le MATCH seulement, dans ce
  lot.** *Ibrahima, le 10 septembre 2026.* Le statut `CANCELED` existe déjà
  (`prisma/schema.prisma:344`) et `app/actions/schedule.ts:103-104` s'en sert —
  mais seulement sur un match `SCHEDULED`.

  **Les statistiques n'ont rien à apprendre**, et c'est vérifié requête par
  requête : `lib/stats.ts` ne lit que `FINISHED` partout, comme la vitrine,
  l'export CSV et le bilan de saison. Un match annulé sort des chiffres tout
  seul — **en LECTURE**.

  **Mais ce n'est pas « un mot dans une clause `where` »**, et je l'avais écrit.
  `/analyser` a trouvé trois choses qui manquent :
  1. **`Match` n'a ni `canceledAt` ni `cancelReason`** (seul `MatchDay` les
     porte, `schema.prisma:282-283`). Le motif n'a nulle part où aller : il faut
     une migration, et `cancelScheduledMatch` n'écrit aucun motif aujourd'hui.
  2. **`CANCELED` ne verrouille RIEN.** Les trois gardes du serveur testent
     `status === "FINISHED"` (`events/route.ts:68`, `:161`, `:224`), et les
     gardes locales aussi. **Un match annulé accepterait donc des buts**, et
     `recomputeScore` lui remettrait un score. C'est un trou que cette décision
     ouvrirait si on ne le referme pas dans le même lot.
  3. **L'app ne connaît `CANCELED` que pour une SOIRÉE**, pas pour un match.

  Les **cinq autres** chemins de suppression dure du dépôt restent ouverts et
  attendent leur propre lot — la soirée et sa cascade sur qui a payé
  (`matchday.ts:51`), l'adversaire (`opponents.ts:38`), le membre par ses deux
  portes (`club.ts:143`, `membres/[memberId]/route.ts:87`), la compo
  (`compo.ts:67,130`). *La spec 0000 en compte sept ; ce lot en referme deux —
  le match a deux portes, l'action et l'API. 7 − 2 = 5, et j'avais écrit six.*
  C'est un périmètre assumé, pas un oubli (constitution, article X).

## Les cas de la base que ce lot referme

*La spec 0000 est la base ; celle-ci est un delta. **23 cas**, tous
vérifiés dans [`cas.md`](../0000-le-club-et-lapp/cas.md) — état et gravité
relus un par un par la garde `/analyser`. Quand le lot est livré, leur état y
passe à `fait`.*

**Corriger un match terminé** — `APRES-11` (◐ les à-côtés, saison comprise) ·
`APRES-02` (◐ un but rattrapé avec une minute antérieure) · `APRES-52` (✗ la
minute d'un but existant) · `APRES-15` (◐ un match saisi le mauvais jour, à
rattacher à sa soirée) · `APRES-D3` (⚠ la date corrigée tombe au mauvais jour) ·
`APRES-21` (◐ un nom d'équipe vide ou d'une phrase entière) · `APRES-50` (◐ le
bilan sous l'écusson après correction d'un nom) · `APRES-30` (◐ deux admins
corrigent en même temps).

**La trace** — `APRES-13` (✗ « qui a touché à ça, et quand ? »). *C'est
l'attendu n°4 de cette spec, mot pour mot ; il manquait à cette liste.*

**Annuler au lieu de supprimer** — `APRES-23` (✗ un match lancé par erreur ou
terminé alors qu'il n'a jamais eu lieu — *la décision Q8 à la virgule près*) ·
`APRES-25` (⚠ un admin supprime un match terminé) · `APRES-26` (⚠ la suppression
échoue) · `APRES-51` (◐ retrouver un match annulé trois semaines après) ·
`APRES-24` (✗ revenir sur une annulation) · `APRES-27` (◐ un match supprimé
pendant qu'un téléphone a encore ses buts en file) · `APRES-04` (⚠ un match
annulé s'étiquette « Terminé »).

**Qui peut figurer sur une feuille** — `APRES-20` (⚠ un but ajouté à quelqu'un
qui n'a pas joué ce match — *la porte qu'ouvre la fonctionnalité n°1*) ·
`APRES-18` (◐ l'homme du match désigné n'a pas joué) · `APRES-D2` (⚠ attribué
par erreur) · `APRES-17` (⚠ l'admin le pose dans un club qui vote) · `TRANS-22`
(◐ le formulaire du site envoie un homme du match ou une saison sans les
valider).

**La fenêtre et les droits** — `APRES-14` (⚠ corriger un match d'une saison
clôturée) · `APRES-12` (◐ celui qui a saisi constate l'erreur et ne peut rien).

**Retiré de cette liste après `/analyser` :** `TRANS-29`. Il ne parle pas de
corriger mais de **prévenir ceux que ça concerne** — ce que Q7 renvoie
explicitement aux notifications. Le citer comme refermé aurait été le pire des
deux mondes : un cas coché que rien ne ferme.

**Explicitement PAS dans ce lot**, et c'est une décision (constitution,
article X) : les cinq autres chemins de suppression dure (`SOIREE-51`,
`SOIREE-D3`, `ADV-04`, le membre, la compo) · la notification d'une correction
(`TRANS-29`) · et `APRES-19` (l'écran d'édition ouvert sur un match en cours),
qui dépend de ce que devient `/edit` — voir le plan.

## À quoi on saura que c'est fait

- [ ] Depuis le récap d'un match terminé, on ajoute un but à un joueur, et le
      score affiché passe de `3-2` à `4-2` — sur l'app ET sur la page du site.
- [ ] On retire ce but, le score revient à `3-2`.
- [ ] Le classement, l'Élo et la forme du joueur concerné bougent en
      conséquence : `GET .../stats` rend des chiffres différents avant et
      après, sans qu'on ait touché à autre chose.
- [ ] Le match porte une marque visible « corrigé le … par … » que le récap
      affiche, sur l'app ET sur le site (`APRES-13`). **`Match.updatedAt` ne
      peut PAS la porter** : `@updatedAt` bouge à toute écriture, y compris un
      vote d'homme du match et un rejeu de file. Il faut un auteur et un
      marqueur explicite de correction.
- [ ] Un but ajouté après coup apparaît en fin de chronologie, marqué comme tel.
- [ ] Un match terminé s'ANNULE (barré, hors des stats, avec un motif) ; le
      bouton « Supprimer » et la route `DELETE` ont disparu du site ET de l'app.
      L'annulation réutilise le statut `CANCELED` qui existe déjà
      (`prisma/schema.prisma:344`) : `lib/stats.ts` ne lit que `FINISHED`, donc
      un match annulé sort des chiffres sans qu'on touche aux statistiques.
- [ ] **Deux** déclencheurs distincts, et pas un : passé six semaines
      (`42 * 86400_000`), ET sur un match d'une saison **clôturée**
      (`Season.isActive` faux) — une saison peut clore à trois semaines, et un
      match de huit semaines peut être dans la saison courante. Chacun demande
      une confirmation qui DIT ce qui va se passer, pas un « Êtes-vous sûr ? »
      (constitution, article V). C'est ce qui referme `APRES-14`.
- [ ] La fenêtre de six semaines n'est pas recopiée une troisième fois : elle
      vit dans le noyau partagé et le test de copie conforme la surveille
      (constitution, article III). Elle est aujourd'hui en DEUX endroits —
      `app/api/clubs/[clubId]/saison/route.ts:127` et
      `app/c/[slug]/saison/page.tsx:114`.
- [ ] Une désignation d'homme du match à la main FERME le vote, et le récap
      affiche « désigné par le capitaine ». Un second vote ne l'écrase plus.
- [ ] **Les trois portes** qui posent un joueur sur un match vérifient la
      FEUILLE, pas le club : le buteur et le passeur (`events/route.ts:106`),
      l'homme du match par le formulaire (`matches.ts:56-61`) et par l'API
      (`matches/[matchId]/route.ts:156-162`). Referme `APRES-20`, `APRES-18`,
      `APRES-D2`.
- [ ] Un match `CANCELED` n'accepte plus AUCUNE écriture — les gardes qui
      testent `status === "FINISHED"` (`events/route.ts:68`, `:161`, `:224`, et
      les couches locales) doivent aussi couvrir `CANCELED`. Sans ça,
      l'annulation ouvre un trou : une file d'attente rejouée écrirait des buts
      sur un match annulé, et `recomputeScore` lui remettrait un score.
- [ ] Une file rejouée sur un match annulé entre-temps échoue de façon
      DIAGNOSTIQUE et ne bloque pas toute la chaîne du match (`APRES-27`).
- [ ] Les couches locales refusent aussi `removeEvent`, `setEventAssist`,
      `setEventScorer` et `undoLastGoalOf` sur un match terminé — elles ne
      gardent aujourd'hui que `addEvent`, `movePlayerTeam` et
      `ajouterJoueurAuMatch`. **« Retirer un but » sur un match terminé est donc
      DÉJÀ possible en local** : l'op part dans la file, le serveur la refuse en
      403 si l'auteur n'est pas admin, et toute la chaîne du match se bloque.
      Ce n'est pas un chemin à ouvrir, c'est un chemin à refermer.
- [ ] La saison d'un match fait partie des à-côtés corrigeables
      (`updateMatchDetails` l'écrit déjà, `matches.ts:83`), et `mvpId` comme
      `seasonId` passent par `estIdOuVide` (`TRANS-22`).
- [ ] La migration qui porte tout ça — `canceledAt`, `cancelReason`, l'auteur et
      la date de correction, l'état « vote fermé » — est rejouée sur une base
      d'avant, et le serveur part AVANT l'app (constitution, article VII).
      `Match` n'a aujourd'hui aucun de ces champs.
- [ ] Une correction tentée sans réseau le dit et ne fait rien à moitié ; elle
      ne part PAS dans la file d'attente.
- [ ] Un match annulé peut être rétabli, et revient dans les stats.
- [ ] Un membre sans droit reçoit un refus explicite, pas un écran qui ne
      réagit pas.
- [ ] `scripts/parcours-lecture.mjs` étendu à ce lot rend **TOUT VERT**, et
      reste vert sur trois passages d'affilée.
- [ ] `tsc --noEmit` vert des deux côtés, `next build` en 0,
      `expo export --platform ios` en 0, `npm run tester` vert **dans
      `five-scorer-mobile`** — le site n'a ni `vitest`, ni script `test`, ni un
      seul fichier de test. Ce lot touche `app/actions/matches.ts` et
      `events/route.ts`, donc **il installe `vitest` côté site** et couvre au
      moins : le refus d'un buteur hors feuille, et un match annulé qui
      n'accepte rien.
- [ ] Ce que `parcours-lecture.mjs` ne peut PAS vérifier — « le récap affiche
      *désigné par le capitaine* », « le but ajouté est en fin de
      chronologie », « le bouton Supprimer a disparu » — est vérifié dans le
      simulateur, à côté de la page du site, et la capture est jointe au journal
      (constitution, article VII).
- [ ] Le tour complet rejoué sur le simulateur, à côté de la page du site.

## Ce que ça débloque

Le lundi soir cesse d'être irrattrapable. C'est aussi le préalable honnête à
tout ce qui lit ces chiffres — le classement, les records, le palmarès de fin
de saison : ils ne valent que si on peut réparer une faute de frappe.
