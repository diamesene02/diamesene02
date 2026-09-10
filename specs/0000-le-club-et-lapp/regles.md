# 0000 — Les règles du club, telles que le code les tient

*Annexe de la spec produit. 298 règles relevées dans le code le 10 septembre 2026.*

La colonne **qui la tient** est la plus importante du document. Une règle tenue par
« l'affichage » n'est pas une règle : c'est un bouton qu'on cache. Elle tombe dès que
quelqu'un appelle l'endpoint directement, ou dès qu'un deuxième écran oublie de la
recopier. Une règle tenue par « personne » est une règle qu'on croit avoir.

---

## Comptes, connexion, clubs

- **Il faut un compte : un nom, un email et un mot de passe d'au moins 8 caractères. L'email n'est jamais vérifié, le nom est libre.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/auth.ts:75-78`

- **Une session dure 90 jours et se prolonge à chaque visite (au plus une fois par jour) ; le serveur croit le cookie 5 minutes sans relire la base.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/auth.ts:93-97`

- **Une page du club exige une session valide, un compte qui existe encore, et l'appartenance au club ; sinon on est renvoyé vers la sortie de secours ou vers « Mes clubs ».**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/guard.ts:71-92 (requireClub), :28-36 (requireUser)`

- **Les routes de l'app répondent 401 sans session et 404 (jamais 403) pour un club dont on n'est pas membre, pour ne pas confirmer son existence.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/guard.ts:95-110 ; app/api/me/route.ts:20-22 ; app/api/clubs/[clubId]/route.ts:24-27`

- **Trois rôles : capitaine (owner) et admin gèrent tout ; un membre saisit un match seulement si le réglage « les membres peuvent scorer » est allumé. L'app reçoit ces droits calculés, elle ne les recalcule pas.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/guard.ts:53-68 ; lib/clubApi.ts:24-27`

- **Qui ouvre le lien d'invitation entre dans le club comme membre, sans validation du capitaine ; le code est permanent jusqu'à ce qu'un admin le régénère, ce qui tue tous les liens déjà envoyés.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/club.ts:61-84 (joinClubByCode), :122-134 (regenerateInviteCode) ; app/join/[code]/page.tsx`

- **En rejoignant, on reçoit d'office un profil joueur : la première fiche non liée, non invitée, non archivée qui porte EXACTEMENT son nom (ou surnom) est adoptée sans confirmation ; sinon une nouvelle fiche est créée.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/club.ts:27-56 (ensureLinkedPlayer)`

- **Un compte n'a qu'un seul profil joueur par club.**
  <br>*Qui la tient :* la base
  <br>`five-scorer/prisma/schema.prisma:242 (@@unique([clubId, userId])) ; lib/roster-serveur.ts:130-135`

- **« C'est moi » : un membre ne revendique qu'une fiche libre, non invitée, non archivée, et la course entre deux revendications se tranche dans la transaction. Le bouton n'apparaît que s'il n'a pas déjà de fiche.**
  <br>*Qui la tient :* le serveur pour les règles, l'affichage seulement pour « pas déjà de fiche »
  <br>`five-scorer/lib/roster-serveur.ts:70-150 (règles) ; app/c/[slug]/players/RosterClient.tsx:316 et five-scorer-mobile/app/club/[id]/effectif.tsx:183 (condition « pas déjà de fiche »)`

- **Retirer un membre délie sa fiche joueur sans l'effacer : ses matchs, buts et votes restent au club. Pour revenir il lui faut un nouveau lien.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/club.ts:172-201 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:53-88`

- **On ne peut pas se retirer soi-même — mais seulement par l'app : le site ne s'en protège pas (le commentaire de la route le dit lui-même).**
  <br>*Qui la tient :* le serveur côté app, personne côté site
  <br>`five-scorer/app/api/clubs/[clubId]/membres/[memberId]/route.ts:70-78 ; app/actions/club.ts:172-201 (aucun contrôle) ; app/c/[slug]/settings/MembersTable.tsx:107-133 (bouton « Retirer » sur sa propre ligne)`

- **Le capitaine (owner) ne peut être ni retiré ni rétrogradé, et personne ne peut être promu owner ; il n'existe aucun transfert de capitainerie.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/club.ts:154-163, 186-188 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:30-33, 66-68`

- **Un compte peut créer jusqu'à 10 clubs ; le créateur en devient capitaine et reçoit sa fiche joueur à son nom.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/auth.ts:103-111`

- **Le code d'invitation affiché aux admins (8 derniers caractères, en capitales) n'est PAS le code que le serveur accepte (l'identifiant complet, en minuscules).**
  <br>*Qui la tient :* personne — deux règles contradictoires
  <br>`five-scorer/app/c/[slug]/settings/page.tsx:79 et app/api/clubs/[clubId]/reglages/route.ts:107 (affichage) contre app/actions/club.ts:64-66 (findUnique sur le code entier)`

- **Se déconnecter depuis le téléphone prévient si des opérations attendent le réseau, puis vide TOUTE la base locale (events, participants, matches, outbox, roster, clubs), puis signe la sortie.**
  <br>*Qui la tient :* l'app (client), et seulement depuis le menu du club — pas depuis l'écran « Mes clubs »
  <br>`five-scorer-mobile/composants/MenuClub.tsx:67-88 ; composants/Noyau.tsx:40, 74-79`

- **Se déconnecter depuis le site vide le cache du service worker ; la base locale du navigateur (Dexie : matchs, outbox, effectif) n'est pas touchée.**
  <br>*Qui la tient :* le navigateur (client)
  <br>`five-scorer/components/ios/MenuClub.tsx:150-163 ; app/c/[slug]/settings/Deconnexion.tsx ; public/sw.js:156-160 ; lib/db.ts (aucune purge hors migration de schéma)`

- **Un 401 en cours de saisie arrête la file sans rien perdre et lève « reconnexion requise » ; la file ne se relance pas d'elle-même tant que ce drapeau est levé, mais une opération acceptée le rabaisse.**
  <br>*Qui la tient :* l'app (client)
  <br>`five-scorer-mobile/lib/outbox/sync.ts:280-301, 318-327 ; lib/appel.ts:147 (401 → SessionExpiree)`

- **Sur le téléphone, la session survit sans réseau : le trousseau garde une copie de la session et l'app démarre dessus tant qu'elle n'est pas expirée.**
  <br>*Qui la tient :* l'app (client)
  <br>`five-scorer-mobile/node_modules/@better-auth/expo/dist/client.js:294-309 (restoreSessionCache) ; app/index.tsx:11-35`

- **La production n'accepte que les connexions venant du site et du schéma fivescorer:// ; Expo Go (exp://) est refusé en production, et c'est voulu.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/auth.ts:44-67 ; five-scorer-mobile/lib/api.ts:100-137`

- **Mot de passe oublié : aucune règle. Rien n'envoie d'email, aucun écran ne le propose, aucun admin ne peut réinitialiser.**
  <br>*Qui la tient :* personne
  <br>`nulle part (lib/auth.ts ne configure ni sendResetPassword ni emailVerification ; aucun écran /login, /signup, connexion.tsx ne le propose)`

- **La reprise de l'historique v1 (club_legacy) n'est possible qu'avec l'ancien PIN, tant que le club n'a aucun membre, et seulement si l'exploitant a ouvert la fenêtre LEGACY_CLAIM_OPEN=1.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/legacy.ts:16-24, 46-69`

- **Les routes génériques de Better Auth (/api/auth/organization/leave, remove-member, update-member-role, delete, invite-member…) sont montées et répondent, avec les règles de Better Auth et pas celles du club (pas de déliement de fiche, pas de doctrine « rien ne supprime »).**
  <br>*Qui la tient :* le serveur (Better Auth), hors des règles du club
  <br>`five-scorer/app/api/auth/[...all]/route.ts ; lib/auth.ts:101-112 (plugin organization) ; middleware.ts:60 (api/auth exclu de la garde)`

## La soirée

- **Une réponse explicite (présent / absent / peut-être) gagne toujours sur l'abonnement.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:77`

- **Un abonné (« je viens tous les lundis ») qui n'a rien dit est compté présent.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:77 ; prisma/schema.prisma:229`

- **Quand il y a plus de présents que de places, le premier engagé a la première place ; un abonné est réputé engagé le jour où la soirée a été créée (pas le jour où il s'est abonné).**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:93,103-115`

- **La date d'engagement d'une réponse est la date de DERNIÈRE ÉCRITURE de la ligne Rsvp (@updatedAt) — y compris quand on ne change que « a payé » ou qu'on re-touche le même statut.**
  <br>*Qui la tient :* la base
  <br>`prisma/schema.prisma:463 ; app/actions/matchday.ts:92-96 ; app/actions/payments.ts:68-71`

- **Capacité 0 = pas de liste d'attente ; la capacité se règle entre 0 et 40 (défaut 12), le seuil minimum entre 2 et 30 (défaut 8).**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:105 ; lib/reglages-serveur.ts:64-70 ; prisma/schema.prisma:169,173`

- **La soirée est « confirmée » quand les titulaires atteignent le seuil, sinon « il en manque N » ; annulée si canceledAt est posé.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:117-129,135-143`

- **Un membre ne répond que pour son propre profil joueur ; un gérant (owner/admin) répond pour n'importe qui — c'est ainsi qu'on tient les habitués sans compte.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matchday.ts:88-91 ; app/api/clubs/[clubId]/soirees/[matchDayId]/rsvp/route.ts:50-53`

- **Seuls IN, OUT, MAYBE sont des réponses valides ; on ne peut pas revenir à « sans réponse ».**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matchday.ts:57,74-76 ; rsvp/route.ts:9,37-39`

- **Répondre à une soirée passée ou annulée n'est interdit nulle part côté serveur ; l'app cache seulement les boutons quand la soirée est passée.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`nulle part (app/actions/matchday.ts:77-96 ; five-scorer-mobile/app/soiree/[id].tsx:98)`

- **Créer une soirée est ouvert à qui peut scorer (donc à tout membre si « les membres peuvent scorer » est coché) ; la supprimer est réservé aux admins.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matchday.ts:16,49 ; app/api/clubs/[clubId]/soirees/nouvelle/route.ts:22-24 ; lib/guard.ts:59-66`

- **Une soirée rejoint la saison active ; s'il n'y en a pas, elle vit sans saison plutôt que d'en ouvrir une.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matchday.ts:21-29 ; nouvelle/route.ts:37-44`

- **Deux soirées le même jour civil n'ont pas de sens — mais seule la génération de saison le vérifie ; la création unitaire (site ou app) ne dédoublonne pas.**
  <br>*Qui la tient :* personne (pour la création unitaire)
  <br>`lib/calendrier-serveur.ts:115-131 (tenu) ; app/actions/matchday.ts:25-33 et nouvelle/route.ts:46-57 (pas tenu)`

- **On n'efface pas une soirée d'un calendrier généré : on l'annule, sinon la régénération la fait revenir. L'annulation existe côté serveur (admins, motif ≤ 120 car.) mais AUCUN écran ne l'appelle.**
  <br>*Qui la tient :* le serveur (sans porte d'entrée)
  <br>`prisma/schema.prisma:279-283 ; app/actions/calendrier.ts:43-79 (aucun appelant dans app/ ni components/)`

- **Supprimer une soirée emporte ses réponses (et donc qui a payé) et sa compo ; les matchs joués restent mais sont détachés de tout lundi.**
  <br>*Qui la tient :* la base
  <br>`prisma/schema.prisma:455 (Rsvp cascade), 307 (lineup cascade), 358-359 (Match SetNull) ; app/actions/matchday.ts:50-52`

- **Une soirée annulée n'est pas « la prochaine soirée » sur l'accueil du site — mais l'API de l'accueil mobile ne l'exclut pas.**
  <br>*Qui la tient :* l'affichage seulement (site)
  <br>`app/c/[slug]/page.tsx:117-120 (tenu) ; app/api/clubs/[clubId]/accueil/route.ts:40-42 (pas tenu)`

- **La compo vit sur la SOIRÉE, pas sur un match ; les matchs en héritent au coup d'envoi (joueurs, camps, gardiens, noms d'équipes).**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/compo.ts:8-14 ; app/c/[slug]/matches/new/page.tsx:45-56,104-118 ; NewMatchForm.tsx:121-125`

- **La compo se modifie par qui peut scorer ; un joueur ne peut être que dans une équipe ; tous doivent appartenir au club ; les noms d'équipes font 40 caractères max et retombent sur les chasubles du club.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/compo.ts:31,34-43,52-58,61-64 ; app/c/[slug]/sessions/[id]/page.tsx:56-58,236-237`

- **« Compo précédente » = la dernière soirée antérieure qui a une compo, joueurs archivés exclus ; elle ÉCRASE la compo courante.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/compo.ts:108-141`

- **Enregistrer la compo remplace tout (deleteMany + createMany) : le dernier qui enregistre gagne, sans détection de conflit.**
  <br>*Qui la tient :* la base
  <br>`app/actions/compo.ts:66-83`

- **Le terrain se partage entre les TITULAIRES (présents hors liste d'attente, abonnés compris) ; part = prix ÷ titulaires, arrondi au centime supérieur.**
  <br>*Qui la tient :* le serveur (calcul), l'affichage (part)
  <br>`app/c/[slug]/sessions/[id]/page.tsx:99-107 ; MoneyPanel.tsx:53-57 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:139-148`

- **Le prix du terrain est réglé par un admin, entre 0 et 100 000 € ; champ vide = pas de suivi.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/payments.ts:9,24,27-32`

- **« A payé » se coche par un admin et exige qu'une ligne de réponse existe pour ce joueur — un abonné silencieux n'en a pas.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/payments.ts:60,68-74`

- **« Réglé » sur la liste des soirées = toutes les réponses IN explicites ont payé (les abonnés silencieux ne comptent pas).**
  <br>*Qui la tient :* l'affichage seulement
  <br>`app/c/[slug]/sessions/page.tsx:80-81 ; app/api/clubs/[clubId]/soirees/route.ts:80-81,98`

- **Le mot de la soirée n'existe qu'une fois au moins un match terminé ; il est composé côté serveur, une seule implémentation pour le site et l'app.**
  <br>*Qui la tient :* le serveur
  <br>`lib/soiree.ts:39-85 (52 : null sans match)`

- **Une soirée dont le jour est passé ne se « lance » pas : elle se « saisit » (feuille sans chrono, datée du bon lundi).**
  <br>*Qui la tient :* l'affichage seulement
  <br>`app/c/[slug]/sessions/[id]/page.tsx:194-196,383-407 ; soirees/[matchDayId]/route.ts:212`

- **Le calendrier réclame « Saisir » pour un lundi passé sans feuille pendant 6 semaines, puis se tait.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`app/api/clubs/[clubId]/saison/route.ts:123-132 ; app/c/[slug]/saison/page.tsx:114-116`

- **L'abonnement se règle par le joueur lui-même ou par un gérant (pour les habitués sans compte).**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/roster.ts:20-42 ; app/api/clubs/[clubId]/joueurs/[playerId]/abonnement/route.ts:36-38`

- **Répondre présent exige le réseau sur l'app : la file hors-ligne ne sert que la feuille de match (huit opérations, aucune de présence).**
  <br>*Qui la tient :* le serveur (décision assumée)
  <br>`five-scorer-mobile/lib/api.ts:391-403 ; five-scorer-mobile/lib/outbox/types.ts:95-180`

- **Sur l'app, un match lancé depuis l'accueil ou la feuille « Créer » n'est rattaché à aucune soirée ; le serveur ne rattache pas par date.**
  <br>*Qui la tient :* personne
  <br>`five-scorer-mobile/app/club/[id]/index.tsx:163-173 ; app/club/[id]/_layout.tsx:88-104 ; app/compo.tsx:245 ; app/api/clubs/[clubId]/matches/route.ts:203-209`

- **Une réponse explicite gagne toujours sur l'abonnement.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:77-80`

- **Un abonné qui n'a rien dit est compté présent.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:77-78`

- **Premier engagé, première place : au-delà de la capacité du club, les derniers attendent.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:103-116`

- **Un abonné s'est engagé le jour où la soirée est née ; celui qui répond s'engage à l'instant où il répond.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:92-94`

- **La date d'engagement d'un joueur est la date de dernière écriture de sa ligne de réponse, quel que soit le champ écrit.**
  <br>*Qui la tient :* la base
  <br>`prisma/schema.prisma:463 (`respondedAt DateTime @updatedAt`)`

- **« Présents » veut dire « ceux qui jouent » : les remplaçants ne sont pas comptés dans le chiffre affiché.**
  <br>*Qui la tient :* le serveur
  <br>`lib/presences.ts:119-130 ; app/c/[slug]/sessions/[id]/SessionRsvpAdmin.tsx:95-97`

- **Un remplaçant sur la liste d'attente ne paie pas la place qu'il n'a pas eue.**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/sessions/[id]/page.tsx:97-103 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:143-146`

- **Un membre répond pour son propre profil joueur ; un gérant répond pour n'importe qui.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matchday.ts:86-89 ; app/api/clubs/[clubId]/soirees/[matchDayId]/rsvp/route.ts:48-51`

- **Une réponse ne peut être que Présent, Peut-être ou Absent — jamais retirée.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matchday.ts:56, 88-92 ; app/api/clubs/[clubId]/soirees/[matchDayId]/rsvp/route.ts:11, 53-58`

- **Une soirée annulée n'est pas « la prochaine soirée ».**
  <br>*Qui la tient :* le serveur — sur le site seulement ; l'API de l'accueil de l'app ne filtre pas (accueil/route.ts:41-44)
  <br>`app/c/[slug]/page.tsx:118-119`

- **Les présences d'un match programmé vivent sur une autre ligne que celles de la soirée, et les deux ne se parlent pas.**
  <br>*Qui la tient :* la base
  <br>`prisma/schema.prisma:454-466`

- **Le rang d'un joueur dans la file d'attente est calculé pour chaque soirée.**
  <br>*Qui la tient :* personne — le champ n'est lu par aucun écran ni sérialisé par aucune API
  <br>`lib/presences.ts:111`

- **L'ordre entre deux joueurs engagés au même instant (les abonnés entre eux) est l'ordre d'affichage.**
  <br>*Qui la tient :* personne — une seule des cinq requêtes qui alimentent le calcul porte un `orderBy` (app/c/[slug]/sessions/[id]/page.tsx:63)
  <br>`lib/presences.ts:97-103`

- **La soirée est confirmée quand le nombre de titulaires atteint le minimum réglé par le club.**
  <br>*Qui la tient :* l'affichage seulement — aucune conséquence n'est tirée du seuil, ni annulation ni alerte
  <br>`lib/presences.ts:119-130 ; prisma/schema.prisma:169-173`

## Le match en direct

- **Rien ne s'écrit dans un match terminé : ni but, ni changement de camp, ni retardataire. Côté serveur, seul un admin (canManage) y est autorisé.**
  <br>*Qui la tient :* le serveur (et la couche locale des deux côtés)
  <br>`five-scorer/lib/localMatch.ts:324,496,548 ; five-scorer-mobile/lib/match/local.ts:411,585,626 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68-73 ; …/lineup/route.ts:45-50,127-132 ; …/matches/[matchId]/route.ts:146-154`

- **Le score n'est jamais tapé : c'est le nombre de buts et de csc crédités à chaque camp, recalculé côté serveur à chaque événement ajouté ou retiré.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30,128,240`

- **Un contre son camp crédite l'équipe adverse au premier tap ; l'auteur se désigne après, sans bloquer le score, par une mise à jour de l'événement existant.**
  <br>*Qui la tient :* le serveur et la couche locale
  <br>`five-scorer/lib/localMatch.ts:449-474 ; five-scorer-mobile/lib/match/local.ts:545-569 ; …/events/route.ts:193-201`

- **La minute d'un but : sur le site, c'est le chrono de jeu (pauses exclues) ; sur l'app, c'est le temps écoulé depuis le coup d'envoi, pauses comprises. Sur une feuille rétro, il n'y a pas de minute.**
  <br>*Qui la tient :* l'affichage seulement (le serveur accepte n'importe quelle minute)
  <br>`five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:164-167 ; five-scorer-mobile/app/match/[id].tsx:276-280 (aucune minute passée) ; five-scorer-mobile/lib/match/local.ts:424-430`

- **Un match dont le coup d'envoi date de plus de six heures est une feuille « rétro » : pas de chrono, pas de mi-temps, pas de minute, bouton « Enregistrer ».**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer/lib/retro.ts:17-28 ; five-scorer-mobile/lib/noyau/retro.ts:17-28`

- **Il faut au moins un joueur de chaque côté : un changement de camp ne vide jamais une équipe.**
  <br>*Qui la tient :* la couche locale seulement (donc contournable par un rejeu)
  <br>`five-scorer/lib/localMatch.ts:509-516 ; five-scorer-mobile/lib/match/local.ts:598-601 ; côté serveur : nulle part (lineup PATCH n'a pas ce garde)`

- **Un joueur ne peut pas être dans les deux équipes, et tous les joueurs d'une feuille doivent être du club ; un invité créé hors-ligne est créé côté serveur avant la composition.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/route.ts:141-146,181-200 ; …/lineup/route.ts:144-166`

- **La composition d'un match ne se réécrit jamais une fois écrite (sauf pour un match encore programmé) : un rejeu tardif d'un second téléphone ne l'écrase pas.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/route.ts:250-297`

- **L'équipe de départ d'un joueur se fige au premier événement du match ; c'est elle que lisent les statistiques, pas l'équipe de fin.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:63-81 ; five-scorer/prisma/schema.prisma (MatchParticipant.initialTeam)`

- **Le retardataire entre comme joueur de champ, dans le camp choisi ; ce camp devient son équipe de départ.**
  <br>*Qui la tient :* le serveur et la couche locale
  <br>`five-scorer/lib/localMatch.ts:552-560 ; five-scorer-mobile/lib/match/local.ts:630-638 ; …/lineup/route.ts:168-181`

- **Terminer un match en cours est ouvert à qui peut saisir ; « terminer » un match déjà terminé est toléré mais inerte (ni le MVP ni la durée ne sont réécrits).**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:144-154,165-192`

- **Le vote de l'homme du match : mode VOTE seulement, match terminé, joueur ayant joué ce match, une voix par membre qu'on peut déplacer, résultat vivant à la pluralité (égalité : ordre alphabétique), sans clôture ni fenêtre de temps.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/motm.ts:23-72`

- **La file d'envoi part dans l'ordre d'insertion (clé auto-incrémentée), jamais par horodatage ; une opération acceptée est retirée ; un refus 4xx bloque TOUTE la chaîne du match et la conserve ; un 401 arrête tout et demande la reconnexion ; une panne réseau ou un 5xx relance de 5 s à 60 s ; aucun rejeu n'attend plus de 8 s.**
  <br>*Qui la tient :* la base et le client
  <br>`five-scorer/lib/sync.ts:93,252-343 ; five-scorer-mobile/lib/outbox/outbox.ts:66-125 ; five-scorer-mobile/lib/outbox/sync.ts:80-88,266-349`

- **Un but et son opération d'envoi tombent dans la même transaction : les deux, ou aucun.**
  <br>*Qui la tient :* la base
  <br>`five-scorer/lib/localMatch.ts:315-379 ; five-scorer-mobile/lib/match/local.ts:14-17,408-468 (testé dans lib/match/localMatch.test.ts:157-233)`

- **Une seule mi-temps par match ; l'annuler ramène en première période.**
  <br>*Qui la tient :* l'affichage seulement (site) / la couche locale (app)
  <br>`five-scorer-mobile/lib/match/local.ts:726,497-499 ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:682-690,531-534,960-963`

- **La saison d'un match est celle demandée si elle appartient au club, sinon la saison active — elle n'est jamais déduite de la date jouée.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/route.ts:154-176`

- **Peuvent saisir : le capitaine et les adjoints, ou tout membre si le club l'autorise (membersCanScore).**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/guard.ts:66 ; toutes les routes matches/events/lineup répondent 403 sinon ; five-scorer/app/c/[slug]/play/page.tsx:19`

- **Un seul match en direct à la fois — voulu par l'accueil du site, le récap et l'accueil de l'app, mais jamais vérifié à la création du match.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer/app/c/[slug]/page.tsx:768 ; five-scorer/app/c/[slug]/matches/[id]/page.tsx:313-318 ; five-scorer-mobile/app/club/[id]/index.tsx:163-173 ; serveur : nulle part`

- **Le son a une note par camp, se coupe depuis la chronologie, et sur l'app joue même téléphone en silencieux ; l'écran reste allumé pendant la feuille — sur l'app seulement.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer/lib/audio.ts:100-117 ; five-scorer-mobile/lib/son/son.ts:69-73 ; five-scorer-mobile/app/match/[id].tsx:162-166 ; site : aucun Wake Lock`

- **Le match suivant d'une soirée rattrapée hérite de la soirée et de la saison du match rattrapé, et prend sa date plus trente minutes.**
  <br>*Qui la tient :* l'affichage seulement (site)
  <br>`five-scorer/app/c/[slug]/matches/[id]/page.tsx:52-61,313-330 ; app : nulle part`

- **Un tap sur une tuile compte un but ; un appui long retire le dernier but de ce joueur. Rien d'autre ne peut arriver par mégarde sur une rangée.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer-mobile/app/match/[id].tsx:620-627`

- **Rien ne s'écrit dans un match terminé.**
  <br>*Qui la tient :* la base locale ET le serveur (app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68)
  <br>`five-scorer-mobile/lib/match/local.ts:411 (et 585, 626)`

- **Un but ne se crédite qu'à un joueur inscrit à ce match.**
  <br>*Qui la tient :* l'appareil seulement — le serveur ne vérifie que l'appartenance au club (events/route.ts:104-114), donc la règle est contournable
  <br>`five-scorer-mobile/lib/match/local.ts:415`

- **On ne peut pas vider un camp : il faut au moins un joueur de chaque côté.**
  <br>*Qui la tient :* la base locale
  <br>`five-scorer-mobile/lib/match/local.ts:598-601`

- **La minute d'un but se déduit de l'heure du coup d'envoi, jamais du chrono ; au-delà de six heures elle vaut « pas de minute ».**
  <br>*Qui la tient :* l'appareil
  <br>`five-scorer-mobile/lib/match/local.ts:424-430 ; lib/noyau/retro.ts:17`

- **Le but et l'opération à envoyer tombent dans la même transaction : les deux, ou aucun des deux.**
  <br>*Qui la tient :* la base locale
  <br>`five-scorer-mobile/lib/match/local.ts:408-468`

- **L'ordre d'envoi se prend sur la clé auto-incrémentée de la file, jamais sur l'heure du téléphone.**
  <br>*Qui la tient :* la base
  <br>`five-scorer-mobile/db/schema.sql:153-156`

- **Un refus 4xx met de côté l'opération ET toute la chaîne de son match ; rien n'est jamais jeté.**
  <br>*Qui la tient :* l'appareil
  <br>`five-scorer-mobile/lib/outbox/sync.ts:328-344`

- **Toute réponse 200 vaut accusé de réception, quel que soit son contenu — et l'opération est alors supprimée de la file.**
  <br>*Qui la tient :* l'appareil (c'est la règle telle qu'elle est écrite, et c'est elle qui perd la soirée derrière un portail captif)
  <br>`five-scorer-mobile/lib/outbox/sync.ts:417 puis :284 ; five-scorer/lib/sync.ts:186 puis :272`

- **Terminer un match en cours est ouvert à qui peut saisir ; retoucher un match déjà terminé demande un admin, et un rejeu tardif de « terminer » est inerte.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:146-153 et 181-192`

- **La composition d'un match ne se réécrit que s'il n'en a pas encore — sauf s'il est encore seulement programmé.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/route.ts:259-297`

- **La feuille de match ne se quitte pas d'un balayage depuis le bord gauche.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer-mobile/app/_layout.tsx:22-27`

- **Le son du but sort même quand le téléphone est en silencieux, et ne coupe pas la musique de l'échauffement.**
  <br>*Qui la tient :* l'appareil (mais posé seulement au premier but — cf. SON-03)
  <br>`five-scorer-mobile/lib/son/son.ts:69-73`

- **Au-delà du temps réglementaire du club : double coup de sifflet, chrono en rouge, et le match continue — c'est le club qui décide quand il s'arrête.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer-mobile/app/match/[id].tsx:170-185`

- **L'écran ne s'éteint pas tant qu'on est sur la feuille.**
  <br>*Qui la tient :* l'appareil (sans réglage, sans exception, sans regard sur la batterie)
  <br>`five-scorer-mobile/app/match/[id].tsx:166`

- **La durée d'un match est le chrono au moment du dernier tap de la cérémonie de fin.**
  <br>*Qui la tient :* l'appareil
  <br>`five-scorer-mobile/app/match/[id].tsx:444`

- **Qui est gardien pendant CE match : l'information est portée par la feuille (participants.is_gk) mais n'est affichée nulle part pendant le match.**
  <br>*Qui la tient :* personne
  <br>`nulle part`

- **Le mode « Corriger la composition » se ferme par un geste explicite, et par lui seul.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer-mobile/app/match/[id].tsx:552`

## Après le match

- **Toute retouche d'un match terminé (but, passe, auteur d'un csc, composition, noms d'équipes, notes) exige un admin ; un membre qui saisit reçoit 403 « Admin requis pour modifier un match terminé ».**
  <br>*Qui la tient :* le serveur
  <br>`app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68-73, 161-166, 224-229 ; app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:45-50, 127-132 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:146-154 ; app/api/clubs/[clubId]/matches/route.ts:255-257, 315-319`

- **Sur le téléphone et dans le navigateur, la feuille locale refuse toute écriture dans un match FINISHED (« Match terminé ») — c'est une garde du client, doublée côté serveur par la règle précédente.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`lib/localMatch.ts:324, 496, 548 ; five-scorer-mobile/lib/match/local.ts:411, 585, 626`

- **Le score est la somme des buts (GOAL + OWN_GOAL par camp) et se recalcule à chaque ajout ou retrait d'événement ; personne ne pose un score à la main.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30 (recomputeScore) ; prisma/schema.prisma:371-373`

- **Un match terminé ne se rouvre jamais : le PATCH n'admet que status « FINISHED », et le rejeu d'une création ne bascule que SCHEDULED → LIVE.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/clubs/[clubId]/matches/[matchId]/route.ts:113-114, 186 ; app/api/clubs/[clubId]/matches/route.ts:243-248`

- **Seul un match programmé peut être annulé (SCHEDULED → CANCELED), par un admin ; un match en cours ou terminé ne s'annule pas.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/schedule.ts:89-114`

- **Supprimer un match est réservé aux admins et efface en cascade ses buts, sa composition, ses votes et ses convocations, sans trace.**
  <br>*Qui la tient :* le serveur (droit), la base (cascade)
  <br>`app/actions/matches.ts:9-26 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:207-220 ; prisma/schema.prisma:407, 427, 455, 473 (onDelete: Cascade)`

- **Corriger les à-côtés (noms d'équipes, date et heure, homme du match, saison, notes) est réservé aux admins, sur un match de n'importe quel statut ; le score et les buteurs n'y sont pas.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/matches.ts:37-88 ; app/c/[slug]/matches/[id]/edit/page.tsx:15`

- **Le rejeu tardif d'un « Terminer » sur un match déjà terminé est inerte : il ne réécrit ni l'homme du match ni la durée.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/clubs/[clubId]/matches/[matchId]/route.ts:165-192`

- **Le vote MVP : tout membre du club, seulement en mode VOTE, seulement sur un match terminé, seulement pour un joueur qui a joué ce match ; une voix par membre, déplaçable, jamais retirée ; l'homme du match est recalculé à chaque voix (pluralité, égalité tranchée par ordre alphabétique), sans clôture.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/motm.ts:8-76`

- **L'homme du match posé par édition ou par PATCH peut être n'importe quel joueur du club, même absent de la feuille — alors que le vote exige un participant.**
  <br>*Qui la tient :* le serveur (règle incohérente entre les deux chemins)
  <br>`app/actions/matches.ts:56-61 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:156-163 ; comparer app/actions/motm.ts:36-41`

- **Un but ajouté après coup à un match terminé (par un admin) est vérifié contre le club, pas contre la feuille du match : il peut être crédité à un joueur qui n'a pas joué.**
  <br>*Qui la tient :* le serveur (trou)
  <br>`app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:97-114`

- **Le récap public /r/[id] n'existe que pour un match terminé, est interdit d'indexation, ne montre pas les photos — et ne dépend PAS du réglage « page publique » du club, contrairement à /p/[slug].**
  <br>*Qui la tient :* le serveur
  <br>`app/r/[id]/page.tsx:28-30, 62 ; comparer app/p/[slug]/page.tsx:38 et app/api/public/[slug]/route.ts:48`

- **Les statistiques, l'Élo, la forme, le classement, l'export et la fiche joueur ne lisent que les matchs FINISHED : un match annulé, supprimé ou en cours ne compte pas ; un match terminé 0–0 compte comme un nul pour tous ses joueurs.**
  <br>*Qui la tient :* le serveur
  <br>`lib/stats.ts:52, 407, 566 ; app/api/clubs/[clubId]/export/route.ts:101 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:40`

- **La carte de partage nomme au plus cinq buteurs par camp et écrit « Terminé » en dur, quel que soit le statut du match.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`lib/shareCard.ts:100, 190 ; components/PartageFeuille.tsx:68, 129`

- **Sur l'app, le récap d'un match se lit au serveur, jamais dans la base locale ; sur le site, entre deux matchs, le récap local (Dexie) s'affiche et le « Récap complet » n'est proposé que lorsque la file d'envoi du match est vide.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer-mobile/app/recap/[id].tsx:24-27, 38-52 ; components/PlayShell.tsx:206-214, 305-321`

- **La trace « corrigé le … par … » : n'existe pas. Match.updatedAt est en base mais bouge aussi au vote et au coup de sifflet, et n'est lu nulle part.**
  <br>*Qui la tient :* personne
  <br>`nulle part (prisma/schema.prisma:379 déclare updatedAt ; aucun lecteur dans app/, components/, lib/)`

- **La fenêtre de temps pour corriger, voter ou supprimer : n'existe pas. Un match d'il y a six mois se corrige, se vote et se supprime comme celui d'hier.**
  <br>*Qui la tient :* personne
  <br>`nulle part`

- **Une saison clôturée ne protège rien : l'édition accepte n'importe quelle saison du club et n'avertit pas.**
  <br>*Qui la tient :* personne
  <br>`app/actions/matches.ts:62-67 ; app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:133-148`

- **Un match annulé est étiqueté « Terminé » avec son score 0–0 par la page soirée du site et par l'API soirée que lit l'app.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`app/c/[slug]/sessions/[id]/page.tsx:335-343 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:179-195`

## Le vestiaire

- **Seul un admin (owner ou admin) ajoute, modifie, archive ou réactive un joueur ; un membre ne touche à aucune fiche, pas même la sienne.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/roster.ts:49,71,96 ; app/api/clubs/[clubId]/joueurs/route.ts:22-24 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:211-213`

- **Un joueur ne se supprime jamais : il s'archive, et son histoire (matchs, buts, votes) reste au club.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:195-200 (aucune route DELETE, aucune server action de suppression)`

- **Le nom est obligatoire ; il est coupé à 60 caractères, le surnom à 40, sans prévenir.**
  <br>*Qui la tient :* le serveur (la troncature est silencieuse ; le « nom requis » à la modification n'est tenu que par l'API, pas par la server action du site)
  <br>`lib/roster-serveur.ts:41-46 ; app/actions/roster.ts:51 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:232-234`

- **Le niveau va de 1 à 5 : arrondi et borné côté serveur, cinq cases côté écran.**
  <br>*Qui la tient :* le serveur
  <br>`lib/roster-serveur.ts:47-49 ; RosterClient.tsx:103-116 ; five-scorer-mobile/app/joueur/fiche.tsx:260-279`

- **La photo est une data-URL JPEG de 200 000 caractères au plus ; sinon elle est jetée et la fiche est enregistrée SANS photo, avec un HTTP 200.**
  <br>*Qui la tient :* le serveur (les routes API renvoient `avertissement` ; la server action du site ne dit rien)
  <br>`lib/roster-serveur.ts:34-38,52-54 ; joueurs/route.ts:34-49 ; joueurs/[playerId]/route.ts:235,245-250`

- **La photo est réduite sur l'appareil avant l'envoi : carré centré de 256 px, JPEG à 82 %, une vingtaine de kilo-octets ; l'app baisse la qualité (0,82 → 0,6 → 0,45) jusqu'à passer sous le plafond.**
  <br>*Qui la tient :* l'affichage seulement (le serveur ne vérifie que le préfixe et la longueur, ni le carré ni le vrai format)
  <br>`components/ios/PhotoJoueur.tsx:14-27 ; five-scorer-mobile/lib/photo/contrat.ts:28-29,59-72 ; five-scorer-mobile/lib/photo/choisir.ts:87-128`

- **La copie mobile du contrat photo (préfixe, plafond) est vérifiée octet pour octet contre lib/roster-serveur.ts par un test.**
  <br>*Qui la tient :* le serveur (test)
  <br>`five-scorer-mobile/lib/photo/contrat.test.ts:44-61`

- **Un compte n'a qu'un seul profil joueur par club : revendiquer une fiche délie la précédente dans la même transaction.**
  <br>*Qui la tient :* la base
  <br>`prisma/schema.prisma:242 (@@unique([clubId, userId])) ; lib/roster-serveur.ts:114-120`

- **Un invité ne se revendique pas.**
  <br>*Qui la tient :* le serveur
  <br>`lib/roster-serveur.ts:102-104`

- **Un joueur archivé ne se revendique pas.**
  <br>*Qui la tient :* le serveur
  <br>`lib/roster-serveur.ts:99-101`

- **Une fiche déjà rattachée à un autre compte ne se revendique pas — sauf par un admin depuis le site ; depuis l'app, jamais, même pour un admin.**
  <br>*Qui la tient :* le serveur
  <br>`lib/roster-serveur.ts:106-108,131 ; app/api/clubs/[clubId]/joueurs/[playerId]/lier/route.ts:46-48`

- **Deux revendications simultanées de la même fiche : la première gagne, la seconde reçoit « Ce profil vient d'être pris par un autre compte ».**
  <br>*Qui la tient :* la base (transaction, updateMany filtré sur userId null)
  <br>`lib/roster-serveur.ts:110-147`

- **Il faut être membre du club pour revendiquer une fiche, et la fiche doit appartenir à ce club.**
  <br>*Qui la tient :* le serveur
  <br>`lib/roster-serveur.ts:85-98`

- **« C'est moi » n'est proposé qu'à qui n'a pas encore de profil, sur une fiche libre et non invitée.**
  <br>*Qui la tient :* l'affichage seulement (le serveur laisse un membre qui a déjà un profil en prendre un autre : lib/roster-serveur.ts:116-135)
  <br>`app/c/[slug]/players/RosterClient.tsx:316 ; five-scorer-mobile/app/club/[id]/effectif.tsx:177-184`

- **« Vient tous les lundis » se règle soi-même, ou par un admin pour un joueur sans compte ; c'est une décision personnelle, séparée de la modification de fiche.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/roster.ts:15-42 ; app/api/clubs/[clubId]/joueurs/[playerId]/abonnement/route.ts:36-38`

- **Le formulaire de fiche n'envoie jamais `abonne` ni `isGuest`, pour ne pas écraser une décision personnelle.**
  <br>*Qui la tient :* l'affichage seulement (sanitize accepte les deux champs : lib/roster-serveur.ts:51,55)
  <br>`five-scorer-mobile/app/joueur/fiche.tsx:103-112 ; RosterClient.tsx:219-227,262-271`

- **En rejoignant le club par le lien, le compte adopte la fiche libre (non invitée, non archivée) qui porte son nom ou son surnom, sinon une fiche neuve est créée à son nom.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/club.ts:28-57,83,97`

- **Le créateur du club a d'office une fiche joueur liée à son compte.**
  <br>*Qui la tient :* le serveur
  <br>`lib/auth.ts:105-111`

- **Retirer un membre du club délie sa fiche joueur, qui reste avec son historique.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/club.ts:191-199 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:82-88`

- **Un invité se crée depuis la compo avec un prénom : niveau 3, pas gardien, pas de photo, pas abonné ; il est créé côté serveur (upsert) au premier envoi du match ou de la compo.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer-mobile/app/compo.tsx:214-224 ; lib/localMatch.ts:53-69 ; app/api/clubs/[clubId]/matches/route.ts:180-192 ; app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:140-158`

- **Les archivés sortent du vivier des présences, de la compo et du cache hors-ligne ; ils restent dans le vestiaire sous un repli « Archivés (n) ».**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/page.tsx:194 ; app/c/[slug]/sessions/[id]/page.tsx:62 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:74 ; app/api/clubs/[clubId]/roster/route.ts:23 ; RosterClient.tsx:339-374 ; effectif.tsx:191-216`

- **Les chiffres du vestiaire et de la fiche sont toutes saisons confondues (une carrière) ; la chasuble habituelle et le rang au tableau sont ceux de la saison active — ou de tout l'historique s'il n'y a pas de saison active.**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/players/page.tsx:26 ; app/api/clubs/[clubId]/effectif/route.ts:43 ; app/c/[slug]/players/[id]/page.tsx:34-64 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:30-74`

- **« Xe du tableau » se lit aux points (trierParPoints), parmi ceux qui ont joué au moins un match — pas dans l'ordre des buteurs.**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/players/[id]/page.tsx:56-64 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:64-74`

- **La chasuble habituelle est celle de la majorité des apparitions ; à égalité, la chasuble A.**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/players/[id]/page.tsx:52-54 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:57-61`

- **Les trophées et paliers : buts 1/5/10/25/50/100/200, matchs 1/10/25/50/100/200, victoires 1/10/25/50/100, homme du match 1/3/5/10/25, triplé, quadruplé, séries de 3/5/10 victoires ; chaque trophée porte la date du match qui l'a décroché ; le palier « homme du match » n'apparaît qu'après un premier titre.**
  <br>*Qui la tient :* le serveur
  <br>`lib/stats.ts:942-945,963-1066`

- **« Gardien » sur la fiche ne fait que guider le générateur d'équipes ; la carte « Dans les buts » compte les matchs où il a RÉELLEMENT gardé (isGk de la compo), matchs internes seulement, et un gardien de moins de trois matchs est classé après les réguliers.**
  <br>*Qui la tient :* le serveur
  <br>`lib/stats.ts:1106-1110,1153-1158 ; RosterClient.tsx:127 ; fiche.tsx:293`

- **Les stats d'un joueur lisent son équipe de DÉPART : changer de camp en cours de match n'emporte pas le résultat ni l'Élo dans l'autre équipe.**
  <br>*Qui la tient :* le serveur
  <br>`lib/stats.ts:30-39,206`

- **Tout identifiant venu du client est validé avant la moindre requête (un objet passé pour un id filtrait toutes les fiches libres du club d'un coup).**
  <br>*Qui la tient :* le serveur
  <br>`lib/ids.ts:10-43 ; app/actions/roster.ts:26,66,91,116 ; joueurs/[playerId]/route.ts:206 ; lier/route.ts:35 ; abonnement/route.ts:21`

- **Une fiche inconnue, ou d'un autre club, répond 404 (pas 403) pour ne pas confirmer qu'elle existe.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:14-28 ; app/c/[slug]/players/[id]/page.tsx:29 ; lib/guard.ts:105-107`

- **Les photos du classement sont servies sur la vitrine publique du club, à quiconque a le lien.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/public/[slug]/route.ts:89-92 ; app/p/[slug]/page.tsx:126`

- **Les initiales d'un avatar sans photo sont deux lettres : « Sofiane » → « SO », « Kylian Mbappé » → « KM ».**
  <br>*Qui la tient :* le serveur côté site ; nulle part côté app (composants/base.tsx:97-102 recalcule autrement et ignore le champ)
  <br>`lib/ini.ts:2-8 ; app/api/clubs/[clubId]/effectif/route.ts:62-65 (champ `initiales` servi pour ça)`

## La saison et les stats

- **Seuls les matchs TERMINÉS comptent, partout : tableau, buteurs, forme, Élo, palmarès, derby, gardiens, records, bilan. Un match en cours ou annulé n'existe pas pour les stats.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:48-56`

- **Le tableau se classe aux POINTS (victoire × pointsWin, nul × pointsDraw, barème du club), puis aux victoires, puis aux buts, puis au nom — jamais aux buts d'abord. Une seule implémentation pour le site et l'app.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/classement.ts:17-41 (utilisée par components/Classement.tsx:68 et app/api/clubs/[clubId]/stats/route.ts:165)`

- **Le résultat, l'Élo et les buts d'un joueur se comptent dans son équipe DU COUP D'ENVOI (initialTeam), pas dans celle où il finit le match.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:30-33, 154-158, 206 ; prisma/schema.prisma MatchParticipant.initialTeam`

- **L'Élo ne compte que les matchs entre nous (INTERNAL) : base 1000, K = 32, pondéré par l'écart de score (jusqu'à × 2), cote d'équipe = moyenne des membres. Sur une saison, tout le monde repart de 1000 ; sur « Toutes saisons » il se cumule.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:133, 147-163 ; lib/elo.ts:17-35`

- **La forme = les 5 derniers résultats ; la série (+3, −2) s'arrête au premier nul.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:233-241, 257`

- **Une seule saison active à la fois : ouvrir ou réactiver une saison CLÔTURE l'autre dans la même transaction, avec sa date de fin posée à maintenant.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/seasons.ts:17-26, 64-73 ; app/api/clubs/[clubId]/saisons/route.ts:30-36 ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts:44-54`

- **Un match ou une soirée s'attache à la saison active AU MOMENT de sa création — pour un match saisi hors-ligne, au moment de sa synchro. Sans saison active, il ne s'attache à rien (seasonId null).**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/matchday.ts:22-28 ; app/api/clubs/[clubId]/matches/route.ts:153-175 ; app/api/clubs/[clubId]/soirees/nouvelle/route.ts:41-49 ; app/actions/schedule.ts:56-65`

- **Clôturer une saison ne touche ni à ses matchs ni à ses soirées : ils gardent leur saison. Réactiver non plus : les matchs joués entre-temps restent où ils sont tombés.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/seasons.ts:43-46, 64-73 (updateMany sur la table season uniquement)`

- **Ouvrir, clôturer, réactiver une saison et poser le calendrier : réservé aux admins (canManage). Programmer un match et créer un adversaire : à qui peut saisir (canScore). Supprimer un adversaire : admin.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/actions/seasons.ts:13,42,63 ; app/actions/calendrier.ts:32 ; app/api/clubs/[clubId]/saison/calendrier/route.ts:20-22 ; app/actions/schedule.ts:25 ; app/actions/opponents.ts:13,36`

- **Poser le calendrier COMPLÈTE la saison active (qui s'étire pour englober les nouvelles dates) et ne crée une saison que s'il n'y en a aucune d'active. Le nom de saison tapé n'est lu qu'à la création.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/calendrier-serveur.ts:75-112`

- **Poser le calendrier est idempotent par JOUR CIVIL : une soirée déjà présente ce jour-là — même annulée — est laissée telle quelle, sa compo n'est pas écrasée.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/calendrier-serveur.ts:115-131, 159-162`

- **Les onze fériés français (Pâques calculée) et la trêve du 24 décembre au 1er janvier inclus sont retirés d'office ; chaque date se rétablit ou se retire d'un tap avant la pose.**
  <br>*Qui la tient :* l'affichage seulement (le serveur accepte n'importe quelle liste de dates)
  <br>`five-scorer/lib/calendrier.ts:48-75, 119-127 ; app/c/[slug]/saison/CalendrierForm.tsx:77-78 ; five-scorer-mobile/app/calendrier.tsx:111-114`

- **Au plus 120 soirées par pose (une saison hebdomadaire en compte ~44) ; au moins une.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/calendrier-serveur.ts:15, 57-60 ; lib/calendrier.ts:119`

- **La saison proposée par défaut va du 1er septembre au 31 juillet, jamais dans le passé ; en août on propose la suivante, en juillet celle qui finit.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer/lib/calendrier.ts:137-151`

- **Sur Stats, la période par défaut est la saison active, sinon « Toutes saisons » ; un identifiant de saison inconnu retombe sur ce défaut au lieu d'une erreur.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/c/[slug]/stats/page.tsx:100-108 ; app/api/clubs/[clubId]/stats/route.ts:52-62`

- **Le palmarès COMPLET (homme du match, buteur, passeur, meilleur %V à 5 matchs minimum, Élo le plus haut si quelqu'un a bougé, l'inoxydable) n'existe que pour une saison CLÔTURÉE ; une saison ouverte n'a que le podium MVP / buteur / passeur. Le passeur n'apparaît que si le club compte les passes.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:304-343 ; app/c/[slug]/stats/page.tsx:141-155, 171-211`

- **Records et derby ne comptent que les matchs entre nous. Seuils : la paire ≥ 4 matchs ensemble et ≥ 60 % ; le carton > 1 but ; la série > 1 victoire ; la soirée la plus prolifique > 1 match ; « ça va bouger vite » sous 10 matchs.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:650-654, 668, 796-811, 844-846 ; app/c/[slug]/stats/Records.tsx:153`

- **Le derby oppose le camp A au camp B sur toute la période ; ses noms sont ceux du DERNIER match ; une soirée revient à qui y a gagné le plus de matchs, sinon elle est partagée.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:849-851, 867-898`

- **Gardiens : matchs entre nous seulement ; encaissé = ce que l'autre camp a marqué ; les réguliers (≥ 3 matchs) sont classés entre eux à la moyenne, les dépanneurs après.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:1107, 1129-1131, 1153-1157`

- **Contre un club extérieur, nous sommes toujours l'équipe A ; le bilan se compte au barème du club ; l'Élo des nôtres ne bouge pas.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/stats.ts:150-151, 510-516`

- **Un adversaire est unique par nom EXACT dans le club ; il se crée à la volée depuis un formulaire de match, jamais depuis un carnet.**
  <br>*Qui la tient :* la base
  <br>`five-scorer/prisma/schema.prisma:329 (@@unique clubId,name) ; app/actions/opponents.ts:16-20`

- **« Saisir » sur une soirée passée sans match n'apparaît que 42 jours ; « Répondre » que 15 jours avant ; une soirée est « passée » 6 h après son heure.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/c/[slug]/saison/page.tsx:94, 114, 143 ; app/api/clubs/[clubId]/saison/route.ts:101, 127, 156`

- **L'export CSV parle Excel FR (« ; », BOM UTF-8), neutralise les cellules commençant par = + - @, et s'ouvre à tout membre du club.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/export/route.ts:14-40, 47-50`

- **Sur l'app, Stats, Saison et Poser le calendrier exigent le réseau : aucun cache de lecture, aucune file d'attente pour ces gestes (« geste d'organisation, fait au chaud »).**
  <br>*Qui la tient :* personne (c'est une absence, assumée en commentaire)
  <br>`five-scorer-mobile/lib/api.ts:880-883, 939-946, 960-973 ; app/calendrier.tsx:126-148`

## Réglages, membres, rôles

- **Les réglages du club, la liste des membres, les rôles, le lien d'invitation, le lien iCal et les saisons sont réservés au capitaine et aux admins — jamais à un simple membre.**
  <br>*Qui la tient :* le serveur
  <br>`lib/guard.ts:56-67 ; app/c/[slug]/settings/page.tsx:29 ; app/api/clubs/[clubId]/reglages/route.ts:52,167`

- **Un admin a exactement les mêmes droits que le capitaine sur les réglages : rien ne distingue owner et admin, sauf que l'owner est intouchable.**
  <br>*Qui la tient :* le serveur
  <br>`lib/guard.ts:59 (`canManage = r !== "member"`)`

- **Il n'y a pas de bouton « Enregistrer » : un interrupteur, un choix ou un champ qu'on quitte part au serveur tout seul.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`app/c/[slug]/settings/ClubSettingsForm.tsx:93-118 ; five-scorer-mobile/app/club/[id]/reglages.tsx:86-106`

- **Les bornes des réglages sont écrites une seule fois et valent pour le site comme pour l'app : au moins 2 et au plus 30 joueurs pour que la soirée tienne, 0 à 40 de capacité (0 = jamais de liste d'attente), 1 à 120 minutes par match, 1 à 10 points la victoire, 0 à 5 points le nul, nom du club à partir de 2 caractères.**
  <br>*Qui la tient :* le serveur
  <br>`lib/reglages-serveur.ts:44-101`

- **Une valeur hors bornes n'est pas refusée : elle est ramenée dans les bornes, et l'appel est déclaré réussi.**
  <br>*Qui la tient :* le serveur
  <br>`lib/reglages-serveur.ts:41-43,65-82`

- **Un format, un mode d'homme du match ou une couleur non reconnus sont ignorés en silence, et l'appel est quand même déclaré réussi.**
  <br>*Qui la tient :* le serveur
  <br>`lib/reglages-serveur.ts:61,87,93-98`

- **Le nom du club se change ; l'adresse du club (le slug) ne se change jamais — elle est fixée à la création.**
  <br>*Qui la tient :* le serveur
  <br>`lib/reglages-serveur.ts:52-57 ; app/onboarding/CreateClubForm.tsx:50-64`

- **Les couleurs des chasubles habillent toute l'app — fond, écussons, anneaux d'avatars, barres de score — et sont recalculées, jamais stockées deux fois.**
  <br>*Qui la tient :* le serveur
  <br>`lib/theme.ts:60-170 ; lib/clubApi.ts:40-43`

- **Le club a un code d'invitation unique et régénérable ; qui ouvre le lien entre dans le club en rôle membre, sans approbation.**
  <br>*Qui la tient :* le serveur
  <br>`prisma/schema.prisma (Club.inviteCode) ; lib/rejoindre.ts:115-158 ; app/actions/club.ts:67-79`

- **Régénérer le code est irréversible : l'ancien est écrasé, il n'est nulle part, et tous les liens déjà partagés meurent à la seconde.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/club.ts:65-79 ; app/api/clubs/[clubId]/reglages/invitation/route.ts:8-12`

- **Celui qui rejoint reçoit un profil joueur : on adopte le profil non lié, non archivé et non invité qui porte le même nom ou le même surnom (accents et casse ignorés), sinon on en crée un.**
  <br>*Qui la tient :* le serveur
  <br>`lib/rejoindre.ts:81-113`

- **Le jeton du calendrier iCal est un SECOND secret, distinct du code d'invitation : s'abonner à l'agenda ne doit jamais donner le droit d'entrer dans le club.**
  <br>*Qui la tient :* la base
  <br>`prisma/schema.prisma (Club.calendarToken) ; app/api/clubs/[clubId]/reglages/route.ts:110-113`

- **Le flux iCal est en lecture seule et ne porte aucune donnée personnelle : des dates, un lieu, un titre — jamais de noms de joueurs, de présences ni de résultats.**
  <br>*Qui la tient :* le serveur
  <br>`app/api/cal/[token]/route.ts:14-18,74-134`

- **Le rôle qu'on écrit ne peut être que « admin » ou « member » : « owner » est refusé À L'EXÉCUTION, pas seulement par le type.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/club.ts:94-101 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:31-35`

- **Le capitaine ne peut être ni rétrogradé, ni retiré, par personne — et il n'existe aucun moyen de lui passer le brassard.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/club.ts:109-111,133-135 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:37-39,69-71`

- **Retirer un membre ne supprime pas son historique : son profil joueur reste au club, simplement délié de son compte — le classement d'une saison ne se réécrit pas parce que quelqu'un a quitté le groupe WhatsApp.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/club.ts:136-144 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:82-90`

- **On ne se retire pas soi-même du club.**
  <br>*Qui la tient :* le serveur, sur l'app seulement
  <br>`app/api/clubs/[clubId]/membres/[memberId]/route.ts:73-80 — et NULLE PART côté site (app/actions/club.ts:117-147)`

- **On ne se rétrograde pas soi-même.**
  <br>*Qui la tient :* personne
  <br>`nulle part`

- **Un club n'a jamais deux saisons ouvertes : ouvrir une saison clôture celle en cours, dans la même transaction.**
  <br>*Qui la tient :* le serveur
  <br>`app/actions/seasons.ts:16-27,63-73 ; app/api/clubs/[clubId]/saisons/route.ts:11-15,32-39`

- **Les nouveaux matchs et les nouvelles soirées s'attachent à la saison active ; sans saison active, ils ne s'attachent à rien.**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/settings/SeasonsCard.tsx:148-151 ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts:10-13`

- **Le générateur de calendrier COMPLÈTE la saison active plutôt que d'en ouvrir une seconde — sans quoi un admin qui ajoute trois lundis en janvier effacerait tout le classement de sa saison.**
  <br>*Qui la tient :* le serveur
  <br>`lib/calendrier-serveur.ts:75-99`

- **La page publique n'existe que si le club l'a allumée : sinon la page et sa route rendent introuvable, jamais interdit — répondre « interdit » confirmerait l'existence du club.**
  <br>*Qui la tient :* le serveur
  <br>`app/p/[slug]/page.tsx:38 ; app/api/public/[slug]/route.ts:48-53 ; app/api/clubs/[clubId]/route.ts:25-27`

- **Le barème du club s'applique à TOUS les matchs de toutes les saisons, y compris ceux déjà joués : il n'est stocké ni sur la saison ni sur le match.**
  <br>*Qui la tient :* le serveur
  <br>`app/c/[slug]/page.tsx:628-631 ; app/api/clubs/[clubId]/stats/route.ts:165,307 ; app/api/clubs/[clubId]/saison/route.ts:249-250`

- **Le droit de saisir en direct est celui d'un admin, plus celui d'un membre si le club l'autorise.**
  <br>*Qui la tient :* le serveur
  <br>`lib/guard.ts:66 ; lib/clubApi.ts:22,31`

- **Un identifiant venu du client doit être une chaîne recevable avant toute requête : sinon un objet passe pour un filtre Prisma et vise autant de lignes qu'on veut.**
  <br>*Qui la tient :* le serveur
  <br>`lib/ids.ts:27-42 ; app/actions/club.ts:90-92,123-125 ; app/actions/seasons.ts:36-38,58-60`

- **Un geste qui ne se rattrape pas doit être confirmé par une phrase qui DIT ce qui va se passer, pas par « Êtes-vous sûr ? ».**
  <br>*Qui la tient :* l'affichage seulement
  <br>`five-scorer-mobile/app/club/[id]/reglages.tsx:614-630 — appliqué sur l'app (régénérer, retirer, promouvoir, clôturer, ouvrir une saison) ; sur le site, seulement sur régénérer et retirer`

- **Un même compte n'est membre d'un club qu'une seule fois.**
  <br>*Qui la tient :* personne
  <br>`nulle part — aucun index unique sur `member` (prisma/schema.prisma), vérification par lecture-puis-écriture dans lib/rejoindre.ts:141-150`

- **Un réglage modifié laisse une trace : quoi, par qui, quand.**
  <br>*Qui la tient :* personne
  <br>`nulle part`

- **Le club ne se supprime pas.**
  <br>*Qui la tient :* l'affichage seulement
  <br>`nulle part — aucun écran ne le propose, mais POST /api/auth/organization/delete est monté et supprime le club en cascade (app/api/auth/[...all]/route.ts ; prisma/schema.prisma, Club.organization onDelete: Cascade)`

## Transversal

- **Une session vaut 90 jours et se renouvelle à chaque visite ; elle n'est relue en base qu'au plus toutes les cinq minutes, le reste du temps elle vit dans un cookie signé.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/auth.ts:87-98`

- **Le middleware ne juge que la PRÉSENCE du cookie — ni signature, ni lecture de base ; la vraie vérification est refaite par chaque page et chaque route.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/middleware.ts:4-6 et 12-14`

- **Sans aucun cookie, toute route /api/clubs/** répond 401 en JSON, jamais une redirection HTML — c'est le contrat que la file d'attente du téléphone sait lire.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/middleware.ts:38-41`

- **Connecté mais étranger au club : 404 « introuvable », jamais 403 — répondre « interdit » confirmerait l'existence du club à qui devine un identifiant.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/accueil/route.ts:29-31 ; vérifié par five-scorer-mobile/scripts/parcours-lecture.mjs:639-658`

- **Une session dont le compte a disparu passe par /session-expiree, qui EFFACE les quatre cookies de Better Auth (préfixe __Secure- compris) avant de renvoyer à /login — sinon le navigateur boucle jusqu'à ERR_TOO_MANY_REDIRECTS.**
  <br>*Qui la tient :* le serveur (site uniquement — l'app n'a pas d'équivalent)
  <br>`five-scorer/lib/guard.ts:27-36 ; app/session-expiree/route.ts:16-51 ; middleware.ts:14-22`

- **Gérer le club (canManage) = capitaine ou admin. Saisir en direct (canScore) = canManage, ou n'importe quel membre si le club a activé « les membres peuvent saisir ».**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/guard.ts:52-68`

- **Modifier un match TERMINÉ est une correction rétroactive : elle exige canManage, même pour ajouter un but.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:67-73, 161-166, 224-229 ; matches/[matchId]/route.ts:144-154`

- **Terminer un match déjà terminé est toléré (la file doit pouvoir rejouer) mais le rejeu est INERTE : il ne réécrit ni l'homme du match ni la durée.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:165-192`

- **Tout identifiant venu du client et destiné à un `where` Prisma passe par estId / idsValides — sinon un objet passe pour un filtre et une requête censée viser une ligne en vise autant qu'on veut.**
  <br>*Qui la tient :* le serveur, mais PAS partout : POST /api/clubs/[clubId]/matches n'applique la règle à aucun de ses identifiants
  <br>`five-scorer/lib/ids.ts:10-43`

- **Un 401 du serveur, et lui seul, ramène à l'écran de connexion ; toute autre erreur se retente — renvoyer quelqu'un vers un formulaire parce que le Wi-Fi du gymnase a hoqueté serait le pire des conseils.**
  <br>*Qui la tient :* l'affichage seulement, et à moitié : les écritures ne testent pas SessionExpiree, et les lectures reçoivent 404 au lieu de 401 quand le cookie survit à la session
  <br>`five-scorer-mobile/lib/appel.ts:16-27 et 138-139`

- **Une opération refusée par le serveur (4xx) est mise de côté avec TOUTE la chaîne de son match, jamais supprimée : jeter l'opération faisait tomber les suivantes en 404 et une soirée entière de buts disparaissait pendant que la pastille repassait au vert.**
  <br>*Qui la tient :* la base locale
  <br>`five-scorer-mobile/lib/outbox/sync.ts:328-344 ; lib/outbox/outbox.ts:93-125`

- **L'ordre de rejeu se prend sur la clé auto-incrémentée de la file, jamais sur l'horodatage : l'horloge du téléphone peut reculer.**
  <br>*Qui la tient :* la base
  <br>`five-scorer-mobile/db/schema.ts (outbox.id AUTOINCREMENT) ; lib/outbox/outbox.ts:7-15 et 66-71`

- **Aucun rejeu de la file n'attend plus de huit secondes ; la relance repart de 5 s et double jusqu'à 60 s tant qu'il reste quelque chose.**
  <br>*Qui la tient :* l'app — mais pour la file seulement : les lectures n'ont aucun délai
  <br>`five-scorer-mobile/lib/outbox/sync.ts:77-88 et 123-148`

- **Se déconnecter vide la base locale du téléphone, et prévient d'abord si la file n'est pas vide.**
  <br>*Qui la tient :* l'affichage seulement — contournable par le second bouton de déconnexion, app/clubs.tsx:100-107
  <br>`five-scorer-mobile/composants/MenuClub.tsx:56-88 ; composants/Noyau.tsx:26-40 et 74-79`

- **Sur le site, se déconnecter vide le cache du service worker mais GARDE la file IndexedDB : « une file d'envoi non partie n'est pas à jeter ».**
  <br>*Qui la tient :* l'affichage seulement — et c'est la doctrine INVERSE de celle de l'app
  <br>`five-scorer/components/UserMenu.tsx:70-82 ; app/c/[slug]/settings/Deconnexion.tsx:12-19`

- **Toutes les dates du site s'affichent dans le fuseau Europe/Paris, posé en constante, jamais dans celui du processus — une fonction Vercel tourne en UTC et annonçait les soirées deux heures trop tôt.**
  <br>*Qui la tient :* le serveur, pour le site — et par personne pour l'app, qui n'a aucun équivalent et n'utilise jamais `timeZone`
  <br>`five-scorer/lib/dates.ts:1-20`

- **Le calendrier d'une saison se calcule dans le fuseau de la personne qui prépare, parce que c'est elle qui joue.**
  <br>*Qui la tient :* le client (téléphone ou navigateur)
  <br>`five-scorer-mobile/lib/calendrier.ts:9-11 ; five-scorer/lib/calendrier-serveur.ts:19`

- **L'anti-doublon du calendrier compare des JOURNÉES entières, pas des horodatages — sinon une soirée déjà créée à 19 h échappait à une borne calée sur 20 h.**
  <br>*Qui la tient :* le serveur, mais dans le fuseau du PROCESSUS (UTC en production), pas dans FUSEAU
  <br>`five-scorer/lib/calendrier-serveur.ts:115-125 et 155-170`

- **En production, seule l'origine fivescorer:// est de confiance ; exp:// et exps:// ne le sont qu'en développement, parce que le plugin serveur recopie le jeton de session en clair dans l'URL de redirection pour toute origine de confiance à schéma non-http.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/lib/auth.ts:41-67 ; five-scorer-mobile/lib/api.ts:84-101`

- **Les rappels du lundi passent par un abonnement iCal, pas par des notifications — chacun colle le lien une fois et c'est SON téléphone qui rappelle, avec ses propres réglages.**
  <br>*Qui la tient :* le serveur — et le lien n'est accessible que depuis les Réglages, donc réservé à qui gère le club
  <br>`five-scorer/app/api/cal/[token]/route.ts:6-17`

- **L'app ne connaît jamais l'identifiant de compte des autres joueurs : le serveur rend estMoi et compteLie à la place de userId.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer-mobile/lib/api.ts:335-352 ; five-scorer/app/api/clubs/[clubId]/roster/route.ts`

- **Un code d'invitation inconnu répond 404, jamais 403 ; le code lui-même tient lieu d'autorisation, puisqu'on n'est pas encore membre.**
  <br>*Qui la tient :* le serveur
  <br>`five-scorer/app/api/rejoindre/route.ts:15-21 ; lib/rejoindre.ts:38-72`

- **Le miroir local du téléphone n'a pas de version : le schéma se réapplique en CREATE ... IF NOT EXISTS à chaque ouverture.**
  <br>*Qui la tient :* personne
  <br>`five-scorer-mobile/lib/outbox/base.ts:62-64 ; lib/outbox/baseExpo.ts:60-71`

- **Aucune limite de débit, nulle part : ni sur la connexion, ni sur le code d'invitation, ni sur les routes du club. Seul le client sait lire un 429.**
  <br>*Qui la tient :* personne
  <br>`nulle part ; five-scorer/lib/auth.ts:69-122 n'a pas d'option rateLimit`

- **L'app n'annonce pas sa version au serveur, et le serveur n'annonce aucune version minimale acceptée.**
  <br>*Qui la tient :* personne
  <br>`nulle part`
