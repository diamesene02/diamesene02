# 0007 — Le match du lundi appartient au lundi

*État : à valider · Écrite le 17 septembre 2026, après qu'Ibrahima a dit : « on
a joué un match lundi mais je ne le trouve pas, il a juste considéré un match
que j'ai annulé ». Les chiffres de ce document ont été lus en base de
production le jour même, en lecture seule — pas repris d'un autre document.*

---

## Le problème

**Le club joue tous les lundis, le calendrier est posé, et le match du lundi
n'appartient pas au lundi.**

Le 14 septembre, le marqueur lance le match depuis l'accueil de l'app à 18:46.
Il se joue : 72 minutes, 28 buts, 10 joueurs, Blanc 17–11 Noir. Il est en base,
complet, et il compte au classement. Mais il porte `matchDayId = NULL` : il
n'appartient à aucune soirée (`prisma/schema.prisma:360`, le champ est
facultatif). La soirée du lundi 14 septembre 19:00 — qui
existe, comme les 43 autres du calendrier annuel — reste vide.

Alors trois choses arrivent, et la troisième est la pire.

**1. La soirée n'a rien à raconter.** Son bilan est vide, son mot aussi. Le
mardi matin, il n'y a rien à coller sur WhatsApp. Le calendrier de la saison
affiche « aucun match » sur un lundi où quinze personnes ont joué.

**2. Le match est difficile à retrouver.** L'accueil de l'app ne demande au
serveur que les matchs du jour (`app/api/clubs/[clubId]/accueil/route.ts:55-58`) ; du mardi au dimanche il dit « Pas encore de
match aujourd'hui », et ne nomme aucun chemin vers ce qui a été joué. Le match
est bien dans l'onglet « Matchs », un onglet plus loin — rien ne le dit.

**3. Trois écrans proposent de saisir une feuille qui existe déjà.** Une soirée
sans match rattaché est une soirée « sans résultat ». Alors le calendrier de
l'app la marque « Saisir » (`app/api/clubs/[clubId]/saison/route.ts:99,128-133`),
le calendrier du site fait exactement pareil
(`app/c/[slug]/saison/page.tsx:91,115-119`), et l'accueil du site y ajoute un
bandeau en pleine page (`app/c/[slug]/page.tsx:244-258,733-751`) : « Une soirée sans
résultat · Lundi 14 septembre · Saisir la feuille ». Les trois ouvrent une
feuille **vierge** datée de ce lundi. Les trois **créeraient un second match**,
et ils le proposent pendant six semaines.

Ce n'est pas seulement un faux match de plus. **Le doublon chasse le vrai de
l'accueil.** Aujourd'hui le 17–11 y est visible parce que le dernier match
terminé n'a pas de soirée, ce qui fait basculer la requête sur un repli par
jour : « la soirée à laquelle le dernier match est rattaché, *sinon tous les
matchs de ce jour-là* » (`app/c/[slug]/page.tsx:264-278`). Dès qu'un doublon daté de 19:00 et rattaché devient le
dernier match terminé, la requête repart sur la branche « les matchs de cette
soirée » — et ne rend que lui. Le match resterait dans l'historique complet du
site, qui liste tous les matchs terminés sans regarder les soirées ; mais
l'écran qu'on ouvre, lui, montrerait le faux à la place du vrai.

Et il n'y a même pas besoin de saisir un seul but. Il suffit de composer les
deux équipes et de taper le coup d'envoi : le faux match naît `LIVE`
(`prisma/schema.prisma:367`), et à cet instant les trois alarmes s'éteignent,
la rangée du lundi passe à « En cours », le bouton « Coup d'envoi » disparaît
de l'accueil, et six heures plus tard « Feuille restée ouverte » apparaît
(`app/c/[slug]/page.tsx:714-716`, `lib/retro.ts:17`). Personne ne saisira jamais de
but dans cette feuille : elle restera ouverte, et elle aura éteint tout ce qui
signalait qu'il y avait quelque chose à ranger. *Avant* ce tap, en revanche,
rien n'est écrit — les deux formulaires refusent une équipe vide
(`app/c/[slug]/matches/new/NewMatchForm.tsx:236-243`,
`five-scorer-mobile/app/compo.tsx:227-230`).

Enfin, le même écran se contredit. L'accueil du site sait retomber sur le jour :
le 17–11 **est** dans son onglet daté « Lundi 14 ». Le bandeau ambre, juste
au-dessus, dit que cette soirée n'a pas de résultat. L'onglet ne s'ouvre jamais
de lui-même : la priorité est écrite en dur — « ce soir » s'il y a quelque
chose ce soir, sinon « à venir » dès qu'une seule soirée future existe, sinon
seulement le premier onglet (`app/c/[slug]/page.tsx:621-625`). Le nombre de
soirées n'y entre pas ; une seule suffit à faire perdre l'onglet daté.

### Ce que la base de production dit, et qui rend ce lot petit

Quatre matchs, lus le 17 septembre :

| Match | Comment il est né | Sa soirée |
|---|---|---|
| lun. 07/09 19:00 — 18–9 | saisi le **mardi** soir, par « Saisir » depuis le calendrier | **rattaché** |
| lun. 14/09 08:06 — 6–7, annulé | lancé le lundi matin, **depuis le site** | **rattaché** |
| **lun. 14/09 18:46 — 17–11** | lancé le lundi soir, **depuis l'app** | **orphelin** |
| dim. 13/09 12:30 — annulé | un dimanche, hors calendrier | orphelin — *et c'est juste* |

Trois choses en sortent.

**Une règle existe, et ce n'est pas celle qu'on croit.** Le site recolle un
match à la prochaine soirée quand l'écart entre elle et **l'instant présent**
est de moins de douze heures — `Math.abs(soirée − maintenant) < 12 h`
(`app/c/[slug]/page.tsx:292-296`). Ce n'est pas « le jour de la soirée », c'est
une fenêtre glissante, et elle a trois défauts qu'on peut calculer :

- **Elle rate des matchs du bon jour.** Lancé à 06:30 pour une soirée de 19:00,
  l'écart fait 12 h 30 : orphelin. À 08:06 il fait 10 h 54 : rattaché. C'est
  pour ça, et pour ça seulement, que le match annulé du 14 au matin a une
  soirée — pas parce qu'il était « le bon jour ».
- **Elle se cale sur maintenant, pas sur la date du match.** Un match saisi
  hors ligne le lundi et rejoué le mercredi serait mesuré depuis le mercredi.
- **Elle n'existe que sur le site**, et seulement pour un bouton.

**Mais le produit sait déjà quelle est la bonne unité — il l'a écrit ailleurs.**
Pour choisir quelle soirée est « la prochaine », la requête ne regarde que les
soirées à partir de minuit du jour courant
(`app/c/[slug]/page.tsx:110-120`), et son commentaire raconte pourquoi
(`app/c/[slug]/page.tsx:113-117`) : « une soirée reste en cours jusqu'à la fin
de sa journée, **pas douze heures glissantes** : le mardi à 7 h, la soirée du
lundi s'affichait encore comme la prochaine, avec “ce soir” écrit dessus et le
match du jour qui venait s'y rattacher. » Le jour civil a donc déjà été payé
une fois — mais pour une autre question. Les ingrédients sont là ; c'est
l'assemblage qui manque.

**Mais elle est tenue par deux écrans, et elle ne s'applique qu'à un bouton.**
C'est la découverte du balayage 0000, mot pour mot : *une règle tenue par
l'affichage n'est pas une règle* (constitution, article III). Elle est écrite
deux fois en clair, dans deux pages du site, sans constante, sans nom, sans
test (`app/c/[slug]/page.tsx:292-296` et
`app/c/[slug]/matches/[id]/page.tsx:57-61`). Et sur l'accueil du site elle ne décide que du raccourci « Coup
d'envoi » : les deux liens voisins — « Composer les équipes »
(`app/c/[slug]/page.tsx:789`), « Lancer un match »
(`app/c/[slug]/page.tsx:795`) — partent sans la soirée, et le formulaire
d'arrivée ne la résout que depuis `?md=`
(`app/c/[slug]/matches/new/page.tsx:45-58`). Dans l'app, un seul chemin transmet une
soirée — la rangée « Saisir » du calendrier
(`five-scorer-mobile/app/club/[id]/saison.tsx:82-98` →
`five-scorer-mobile/app/compo.tsx:245`). Les trois chemins du lundi soir, eux,
partent avec le seul club : « Nouveau match » sur l'accueil
(`five-scorer-mobile/app/club/[id]/index.tsx:186`), « Lancer un match
maintenant » et « Saisir un match déjà joué » dans la feuille « Créer »
(`five-scorer-mobile/app/club/[id]/_layout.tsx:143,151`) — alors que l'accueil
a la soirée du jour sous la main
(`five-scorer-mobile/app/club/[id]/index.tsx:95`). Le serveur, lui, ne cherche
jamais : il vérifie la soirée qu'on lui donne et écrit `null` sinon
(`app/api/clubs/[clubId]/matches/route.ts:204-211`).

**Ce qui rend l'oubli d'autant plus net :** la même route, à vingt-six lignes
d'écart, traite deux rattachements de deux façons opposées. Pour la saison, si
le champ manque, le serveur retombe sur la saison active du club
(`app/api/clubs/[clubId]/matches/route.ts:155-176`). Pour la
soirée, si le champ manque, c'est `null` — définitivement, et sans que
personne en soit informé. Le commentaire qui accompagne le repli de la saison
raconte pourquoi il a fallu y revenir : un match mal rattaché « disparaissait
de toutes les vues saisonnières » du club, en « corruption silencieuse, sans
erreur ni trace ». C'est mot pour mot ce qui arrive aujourd'hui à la soirée du
lundi — sans que personne ait encore écrit le repli.

**Il y a un seul match à rattraper, et des orphelins qui doivent le rester.**
Le match du dimanche 13 n'appartient à aucune soirée parce qu'aucune soirée
n'existait ce jour-là : il a raison. La règle ne doit donc pas rattacher tout
ce qui passe — elle doit rattacher quand il y a un lundi à rejoindre, et se
taire sinon. Et comme un seul match est orphelin à tort, ce lot n'a pas besoin
d'écrire une migration : un geste suffira.

---

## Pour qui, et quand

**Le marqueur, lundi 18:46, au gymnase.** Il sort son téléphone, tape
« Nouveau match », compose les équipes, lance. Il ne doit rien avoir à faire de
plus pour que ce match soit le match de ce lundi-là. C'est le geste le plus
fréquent du produit — une fois par semaine, dix mois par an — et c'est celui
qui perd le match.

**Ibrahima, mardi matin, dans le RER.** Il veut le mot de la soirée à coller
dans le groupe : le score, les buteurs, l'homme du match. Il ouvre la soirée du
lundi : elle est vide.

**Ibrahima, jeudi soir.** Il cherche le match de lundi pour le montrer à
quelqu'un. L'accueil de l'app dit « Pas encore de match aujourd'hui » ; celui du
site lui propose, en ambre, de saisir une feuille qu'il a déjà remplie. À un
clic près, il double son propre match.

---

## Ce qu'on doit pouvoir faire

1. **Lancer le match du lundi, et qu'il soit le match de ce lundi-là — sans
   rien faire de plus.** Depuis l'app comme depuis le site, depuis n'importe
   lequel de leurs chemins de lancement. Le marqueur n'a pas à savoir ce qu'est
   un `matchDayId` ; il sait qu'on est lundi, et l'app aussi.
2. **Ne jamais se faire proposer de saisir une feuille qui existe déjà.** Un
   écran qui réclame le résultat d'une soirée doit d'abord regarder s'il y a
   un match de ce jour-là qui n'a simplement pas été rattaché — et alors
   proposer de le rattacher, pas d'en créer un second.
3. **Retrouver le match de lundi depuis l'accueil, le mardi comme le jeudi.**
   Le site le fait déjà, l'app non.
4. **Rattacher ou détacher un match après coup**, quand la règle automatique
   s'est trompée ou n'avait pas de quoi trancher. Le site sait le faire depuis
   le lot 0001 ; ce geste doit rester, rester le dernier mot — et **s'ouvrir à
   qui peut scorer** (tranché le 17 septembre 2026). Celui qui a le droit de
   créer un match a le droit de dire à quel lundi il appartient ; aujourd'hui
   il ne l'a pas, et le lundi soir il n'y a pas d'admin sous la main.
5. **Voir un orphelin signalé là où il se voit, et le ranger d'un geste.** Un
   écran qui allait réclamer la feuille et qui trouve un match de ce jour-là
   sans soirée le dit et propose de le rattacher (tranché le 17 septembre
   2026) — au lieu de se taire, ce qui laisserait le match orphelin en silence
   et la soirée vide pour toujours.

## Ce qu'on ne doit PAS faire

- **Rattacher en silence à une soirée d'un autre jour.** Un match du dimanche
  ne rejoint pas le lundi qui suit parce qu'il est proche. Sans soirée ce
  jour-là, le match reste isolé — c'est un état légitime, pas un défaut.
- **Fusionner ou effacer un doublon déjà créé.** Rien ne s'efface
  (constitution, article II). Un doublon se corrige avec les gestes qui
  existent déjà — on l'annule (lot 0006), on le rattache ou on le détache (lot
  0001). Ce lot empêche d'en fabriquer, il ne nettoie pas derrière.
- **Faire dépendre le rattachement d'un écran.** Si la règle vit dans un
  bouton, elle ne vaut que pour ce bouton — c'est exactement le défaut qu'on
  répare (article III).
- **Changer ce que « soirée » veut dire.** Le calendrier annuel, la compo
  préparée, les réponses : rien de tout ça ne bouge. Un match rejoint une
  soirée qui existe ; il n'en crée pas.

---
## Questions tranchées

### Quelle unité de temps fait foi ?

**Le jour du club — tranché par le code le 9 septembre 2026, et déjà payé une
fois.** L'accueil du site ne cherche la prochaine soirée qu'à partir de minuit
du jour courant, et son commentaire dit pourquoi : *« une soirée reste en cours
jusqu'à la fin de sa journée, pas douze heures glissantes : le mardi à 7 h, la
soirée du lundi s'affichait encore comme la prochaine, avec “ce soir” écrit
dessus et le match du jour qui venait s'y rattacher. »* Une fenêtre glissante a
donc déjà été essayée, et elle a déjà volé un match. La règle est : **un match
rejoint la soirée du même jour**, dans le fuseau du produit — ni la veille, ni
le lendemain matin. (Le fuseau est une constante, `Europe/Paris`
(`lib/dates.ts:17`), et son commentaire explique pourquoi ce n'est pas un
réglage du club ; ce lot n'y touche pas.)

Ce qui s'en déduit sans autre débat : un match du dimanche ne rejoint pas le
lundi.

**Et un cas limite qui n'est pas gratuit : le match qui commence à 23:50.**
Daté du mardi 00:30, il ne rejoint pas la soirée du lundi — mais il ne
disparaît pas pour autant : la soirée du lundi reste alors « sans résultat »,
et les trois écrans la réclament, exactement ce que la promesse n°2 doit
empêcher. Une règle du jour civil ne suffit donc pas seule : **la question que
les écrans posent et la règle qui rattache doivent regarder la même fenêtre.**
C'est le plan qui dira comment, mais la spec le nomme ici pour qu'il ne soit
pas découvert dans le diff (article X).

### Où la règle doit-elle vivre ?

*La méthode dit qu'une spec ne contient aucune solution — ni écran, ni route,
ni table. Ce qui suit n'est donc pas un choix de conception mais une
**contrainte** : l'article III interdit qu'une règle qui protège un chiffre
soit tenue par un écran, et le gymnase interdit qu'elle soit tenue par le
téléphone. Le plan dira comment ; la spec dit seulement ce qui est exclu.*

**Pas dans un écran, et pas dans le téléphone.** Deux raisons, et la seconde
est décisive.

La première est l'article III : aujourd'hui la règle est écrite deux fois, dans
deux pages du site, sans constante ni test, et elle ne décide que d'un bouton
sur trois de son propre écran. Une règle qui vit à l'écran ne vaut que pour
l'écran qui la porte — et le produit n'a que **deux** écritures de match en
base (`app/actions/schedule.ts:63` et
`app/api/clubs/[clubId]/matches/route.ts:235-240`) pour une bonne quinzaine de
boutons qui y mènent. La règle a donc deux endroits possibles, et dix-huit
endroits impossibles.

La seconde est le gymnase. **Le téléphone n'a aucune mémoire des soirées** : sa
base locale ne déclare que six tables — clubs, effectif, matchs, participants,
événements, file d'envoi (`five-scorer-mobile/db/schema.ts:50,68,90,119,136,159`).
La colonne `match_day_id` existe bien sur les matchs
(`five-scorer-mobile/db/schema.ts:93`), mais il n'y a nulle part où lire
« quel est le lundi de ce soir ». Hors réseau,
l'accueil de l'app ne rend qu'une ligne d'erreur, et le bouton « Nouveau
match » n'apparaît même pas. Une règle tenue par l'app ne marcherait donc pas
le seul soir où elle compte (constitution, article I).

Ce qui reste, c'est le serveur — et il a de quoi trancher **au bon moment** :
la date du match (`playedAt`) voyage dans la file d'envoi
(`five-scorer-mobile/lib/match/local.ts:323`) et il la lit déjà
(`app/api/clubs/[clubId]/matches/route.ts:151,230`). C'est ce qui manque le
plus à la règle d'aujourd'hui, qui se cale sur l'instant présent. Un match saisi hors
ligne le lundi et rejoué le mercredi rejoint donc le lundi, pas le mercredi.

### Rattacher tout seul, ou demander ?

**Tout seul, et défaisable.** Le geste du lundi soir se fait debout, à une
main, par quelqu'un qui joue aussi : une question de plus à ce moment-là est
une question de trop. Et le défaire existe déjà — le champ « Soirée » du
formulaire d'édition, avec son option « Aucune — match isolé » (lot 0001,
`APRES-15`). Le dernier mot reste à l'humain, il n'est simplement pas demandé
au coup d'envoi.

### Et les trois écrans qui réclament la feuille ?

**Ils doivent regarder avant de réclamer.** Aujourd'hui les trois posent la
même question — « cette soirée a-t-elle un match rattaché ? » — et concluent
« non, donc il n'y a pas eu de match ». La bonne question est : « y a-t-il un
match de ce jour-là qui n'appartient à aucune soirée ? » Si oui, l'écran ne
propose plus d'en créer un : il propose de rattacher celui qui existe, ou se
tait.

**Réclamer n'est pas proposer, et le lot ne touche qu'au premier.** Trois
écrans *réclament* sans qu'on leur demande rien, sur la foi d'une soirée qu'ils
croient vide : le calendrier de l'app, le calendrier du site et le bandeau de
l'accueil du site. La fiche d'une soirée, elle, *propose* « Lancer un match » et
« Saisir un match joué » à quelqu'un qui l'a ouverte exprès — ça reste, et c'est
juste.

**Le piège à ne pas tomber dedans en réparant.** La règle naïve — « cette
soirée a déjà un résultat, donc plus de feuille » — casserait le geste que le
code appelle lui-même « le plus fréquent d'une soirée » : **On rejoue**
(`components/RematchButton.tsx:24`). Un lundi porte plusieurs matchs — le
produit écrit « Soirée du 7 sept. · Match 2 »
(`app/c/[slug]/matches/[id]/page.tsx:250`) —
et le deuxième match d'un lundi n'est pas un doublon. C'est pour ça que la
question à poser n'est pas « cette soirée a-t-elle un résultat ? » mais
« y a-t-il un orphelin de ce jour-là à recoller ? » — la première interdirait
le match 2, la seconde ne gêne personne.

Le repli par jour n'est pas à inventer non plus : il est déjà écrit deux fois
dans le dépôt — l'accueil du site l'utilise pour son onglet daté, et la liste
des matchs de l'app groupe les orphelins sous leur jour. Le club a déjà tranché
ce qu'est la soirée d'un match ; il ne l'a simplement jamais fait lire aux
écrans qui réclament.

### Que fait-on du match déjà orphelin ?

**Un geste, pas une migration.** Il y en a un seul en base — le 17–11 du
14 septembre — et le geste qui le répare existe (champ « Soirée » de
« Modifier les infos »). Écrire une migration pour une ligne coûterait plus
cher que de la corriger.

Et il faut savoir ce qu'une migration en masse frôlerait. **La soirée mixte —
une partie des matchs d'un lundi rattachée, l'autre non — n'est pas un risque
futur : c'est l'état actuel de la soirée du 14 septembre**, qui porte le match
annulé de 08:06 (rattaché) et le 17–11 (orphelin). Aujourd'hui l'état ne fait encore aucun dégât
visible, et c'est un hasard : les deux écrans qui souffriraient ne regardent
que les matchs terminés, et le rattaché du 14 est annulé
(`app/c/[slug]/page.tsx:267`, `app/api/clubs/[clubId]/matchs/route.ts:69`). Le
jour où deux matchs **terminés** du même lundi seront l'un rattaché et l'autre
pas, deux choses casseront, et aucun cas de la base ne les décrit : l'accueil
du site n'a qu'un repli tout ou rien — si le dernier match du soir est
rattaché, son onglet daté ne montre que les rattachés et les autres
disparaissent — et la liste des matchs de l'app coupe le même lundi en deux
groupes, l'un sous la soirée, l'autre sous la date. Ce lot doit donc supprimer
cet état, pas en fabriquer d'autres.

### Et la soirée qu'on supprime, qui détache tout ?

**Hors lot, et nommé — parce qu'il défait exactement ce que ce lot fait.**
Supprimer une soirée est une suppression **dure**
(`app/actions/matchday.ts:38-55`), et la relation entre un match et sa soirée
est déclarée `onDelete: SetNull` (`prisma/schema.prisma:361`) : tous les matchs
de cette soirée redeviennent orphelins, d'un coup, en silence. Pire, l'action
avale son erreur et répond « c'est fait » quoi qu'il arrive
(`app/actions/matchday.ts:50-54`) — le même défaut que le lot
0006 a réparé pour la suppression d'un match (`APRES-26`), laissé intact ici.

Ce lot rattache à la création ; il ne protège pas contre ce geste-là. Mais un
produit qui recolle d'un côté et détache en masse de l'autre n'a rien réglé :
c'est un lot à lui, et il faudra le faire.

### Qui a le droit de rattacher ?

**Qui peut scorer — tranché par Ibrahima le 17 septembre 2026.** Aujourd'hui
l'asymétrie est nette : *lancer*
un match est ouvert à `canScore`
(`app/api/clubs/[clubId]/matches/route.ts:130-132`), *rattacher* après coup
exige `canManage` (`app/actions/matches.ts:110`), sur le site seulement, et
seulement sur un match terminé (`app/c/[slug]/matches/[id]/edit/page.tsx:16`). Le marqueur du lundi soir peut donc fabriquer un orphelin et ne peut
pas le réparer — un cul-de-sac, que l'article V interdit. Celui qui a le droit
de créer le match a le droit de dire à quel lundi il appartient.

Ce que ça coûte, et que le plan devra peser : le champ « Soirée » vit
aujourd'hui dans le formulaire d'édition, qui porte aussi la date, la saison et
l'homme du match — ouvrir le formulaire entier à `canScore` n'est pas ce qui a
été demandé. C'est le rattachement qui s'ouvre, pas le reste.

### Les matchs programmés rejoignent-ils leur soirée ?

**Oui, même règle — tranché par Ibrahima le 17 septembre 2026.** Aujourd'hui
tous les matchs programmés du club naissent orphelins : l'action serveur
accepte pourtant une soirée et la vérifie (`app/actions/schedule.ts:13-24,47-55`),
mais le seul formulaire qui l'appelle ne la passe jamais
(`app/c/[slug]/matches/schedule/ScheduleMatchForm.tsx:74-81`). Une seule règle pour toutes les naissances d'un match —
c'est l'article III, et laisser cette fabrique ouverte garantissait la prochaine
surprise.

### Les quatre questions que le code avait déjà tranchées

*Cherchées dans le code avant d'être posées, comme la garde l'impose.*

- **Un match contre un adversaire (EXTERNAL) rejoint-il une soirée ?** Oui, et
  le produit le prévoit déjà : la fiche d'une soirée sépare ses matchs internes
  des autres pour le bilan
  (`app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:160`), et le calendrier
  de la saison pose les matchs externes à côté des soirées
  (`app/api/clubs/[clubId]/saison/route.ts:180`). Rien à inventer, rien à distinguer.
- **Une soirée annulée prend-elle un match ?** Non. **Attention, ce n'est pas vrai
  partout, et c'est justement l'endroit où la règle va vivre qui ne le fait
  pas.** Les deux requêtes de l'accueil du *site* excluent bien les soirées
  annulées — la prochaine (`app/c/[slug]/page.tsx:119`) et celles « sans
  résultat » (`app/c/[slug]/page.tsx:247`). Mais la route qui sert l'accueil de
  l'*app* cherche la prochaine soirée **sans filtrer**, et se contente de la
  marquer annulée (`app/api/clubs/[clubId]/accueil/route.ts:40-41`). Un plan
  qui recopierait cette requête-là pour « trouver la soirée du jour »
  rattacherait à une soirée annulée. La règle doit donc exclure explicitement,
  pas hériter.
- **Deux soirées le même jour ?** C'est possible : rien en base ne l'interdit
  — le modèle `MatchDay` ne porte aucune contrainte d'unicité sur le couple
  club + date (`prisma/schema.prisma:269-306`) — et seul le poseur de calendrier
  annuel déduplique (`lib/calendrier-serveur.ts:131,159-162`). **Décision : dans le doute, on ne rattache
  pas.** Le match reste isolé et les écrans proposent — c'est la même règle que
  « rattacher quand il y a un lundi à rejoindre, se taire sinon », et une règle
  qui choisit au hasard entre deux soirées serait pire que pas de règle.
- **Le repli repasse-t-il sur un match déjà en base ?** Non : **à la création
  seulement.** C'est ce qui rend tenable le « Aucune — match isolé » choisi
  exprès : en base, « n'a jamais eu de soirée » et « détaché volontairement »
  sont le même `NULL`, et rien ne les distingue. La seule façon de ne pas
  écraser un choix humain est donc de ne jamais repasser. C'est aussi pour ça
  que le match du 14 septembre se répare à la main, et pas par un balayage.

### L'accueil de l'app, qui ne montre pas les matchs joués ?

**Hors lot** (`APRES-54`), et dit ici pour qu'il ne repasse pas pour un oubli.
C'est un autre trou : la fenêtre de l'accueil mobile est d'un jour, pas de six
semaines, donc le match du lundi en disparaît dès le mardi **même s'il est
correctement rattaché**. Les deux défauts se cumulent sur la même plainte
— « je ne le trouve pas » — mais se réparent séparément, et celui-ci ne fabrique
aucun faux match.

---
## À quoi on saura que c'est fait

*Chaque ligne se vérifie par une commande ou par un écran nommé (constitution,
article VIII). « L'app rattache bien » n'est pas un critère.*

- [ ] **Le serveur rattache, et c'est lui qui décide.** Un match créé sans
      soirée, daté d'un jour où une soirée non annulée existe, ressort avec
      cette soirée. Vérifié par un test sur la fonction partagée, contre la
      base locale — pas par un écran.
- [ ] **Un match d'un jour sans soirée reste isolé.** Le dimanche 13 septembre
      ne doit rejoindre aucun lundi. Même test, cas inverse.
- [ ] **Le jour est celui du club, pas celui du serveur.** Un match joué à
      23:30 un lundi rejoint le lundi ; un match joué à 00:30 le mardi ne le
      rejoint pas. Testé aux deux bornes, dans le fuseau du produit
      (`lib/dates.ts:17`) — c'est le piège que ce fichier raconte déjà avoir
      payé.
- [ ] **Le hors-ligne rejoint le bon lundi.** Un match créé dans la file le
      lundi et rejoué trois jours plus tard rejoint la soirée du lundi, pas
      celle du jour du rejeu. Vérifiable parce que `playedAt` voyage déjà dans
      le payload : test sur la fonction, plus un passage de
      `five-scorer-mobile/scripts/parcours-lecture.mjs`.
- [ ] **Une soirée explicitement demandée gagne toujours.** Passer `matchDayId`
      (rangée « Saisir », fiche de la soirée) reste souverain ; le repli ne
      s'applique qu'à son absence. Et « match isolé » choisi à la main dans le
      formulaire d'édition n'est pas ré-écrasé au prochain passage.
- [ ] **Les trois écrans qui réclament regardent d'abord, et proposent le bon
      geste.** Le calendrier de l'app, le calendrier du site et le bandeau de
      l'accueil du site ne proposent plus « Saisir » sur une soirée dont un
      match du même jour existe sans soirée : ils disent qu'il y en a un et
      proposent de le rattacher. Vérifié en base d'essai avec un match orphelin
      daté du bon jour.
- [ ] **Un match programmé pour un lundi rejoint la soirée de ce lundi.**
      Même règle, même fonction — vérifié par un test sur le chemin de
      programmation, qui aujourd'hui produit des orphelins à tous les coups.
- [ ] **Le marqueur répare son propre match.** Quelqu'un qui peut scorer, sans
      être admin, rattache un match orphelin à sa soirée — et n'obtient pas au
      passage le droit de changer la date, la saison ou l'homme du match.
- [ ] **Le deuxième match d'un lundi reste possible.** « On rejoue » depuis un
      récap, et « Lancer un match » depuis la fiche de la soirée, marchent sur
      une soirée qui a déjà un résultat. Le lot fait taire ce qui *réclame*
      sans qu'on demande, jamais ce qu'on demande exprès. Vérifié à la main,
      sur une soirée d'essai portant déjà un match terminé.
- [ ] **Le match du 14 septembre 2026 porte sa soirée en production**, et les
      trois écrans se sont tus. C'est le seul rattrapage de ce lot ; il se fait
      à la main, avec le geste qui existe.
- [ ] `npx tsc --noEmit` vert des deux côtés · `npm test` (site) et
      `npm run tester` (app) verts · `cd five-scorer-mobile && node scripts/jeu-dessai.mjs
      && node scripts/parcours-lecture.mjs` en TOUT VERT · `npx expo export --platform
      ios` en 0 · `next build` en 0, dans un dossier à côté, jamais dans le
      `.next` d'un serveur de dev vivant.
- [ ] **Vu dans le simulateur, à côté de la page du site** (article VII) : un
      match lancé depuis l'accueil de l'app apparaît dans la soirée du jour,
      des deux côtés, sans autre geste.

---
## Les cas de la base que ce lot referme

*Statuts et gravités rouverts un par un dans `cas.md` le 17 septembre 2026, pas
recopiés. Et la leçon du 16 septembre écrite d'avance plutôt qu'après coup : le
lot 0001 avait annoncé 27 cas « fait » et n'en a refermé que 15. **Ce lot en
annonce un.***

- **`SOIREE-33`** (⚠ faux · *gêne une saison*) — « Lundi 20 h, au gymnase, le
  capitaine lance le match depuis son téléphone » → « le match appartient à la
  soirée du jour ». Ce lot est écrit pour lui. Refermé **à condition de faire
  les deux moitiés** : rattacher, *et* faire taire les trois écrans qui
  réclameraient la feuille. La première moitié seule laisserait les anciens
  orphelins sous un bouton qui fabrique un doublon.

### Débloqués, pas refermés — et c'est différent

Ces quatre cas ont le rattachement pour **prérequis**, pas pour solution. Ils
resteront ouverts après ce lot, et c'est écrit ici pour qu'on ne les coche pas
par enthousiasme.

- **`APRES-06`** (◐ partiel · *bloque un lundi*) — « On rejoue » depuis le
  récap doit relancer « rattaché à la même soirée ». Tant qu'un match n'a pas
  de soirée, son enfant n'en a pas non plus. Ce lot donne une soirée au
  premier ; il ne construit pas l'enchaînement.
- **`COMPO-01`** (◐ partiel · *gêne un lundi*) — la feuille devrait s'ouvrir
  avec la compo préparée jeudi. Connaître la soirée est ce qui manquait pour
  aller la chercher ; aller la chercher reste à faire.
- **`COMPO-08`** (◐ partiel · *gêne une saison*) — un match programmé sur le
  site ne se lance pas depuis l'app.
- **`APRES-54`** (◐ partiel · *confort*) — l'accueil de l'app ne montre pas les
  matchs déjà joués. Même plainte vécue, autre trou : sa fenêtre est d'un jour.

### Explicitement hors lot, et pourquoi

- **`APRES-D3`** (◐ partiel · *gêne une saison*) — « un match ne peut pas être
  daté d'un autre jour que la soirée à laquelle il appartient ». C'est le même
  invariant vu par l'autre bout : nous, on rattache à la création ; lui demande
  qu'on re-vérifie quand la date change **après** coup. Le tenir voudrait dire
  qu'un changement de date re-rattache tout seul — donc qu'il écrase un choix
  humain (« Aucune — match isolé ») fait exprès dans le formulaire d'édition.
  Ce lot pose le dernier mot chez l'humain ; il ne le reprend pas trois écrans
  plus loin. À trancher dans un lot à lui.
- **`SOIREE-54`** (◐ partiel · *confort*) — jusqu'à quand une soirée reste-t-elle
  saisissable ? Ce lot touche les trois écrans qui réclament, mais il ne
  tranche pas leur fenêtre : il leur apprend seulement à ne pas réclamer ce qui
  existe déjà. La question des six semaines reste entière.
- **`SAISON-D1`** (⚠ faux · *gêne une saison*) — un match rattaché à une
  soirée de juin part quand même dans la saison en cours, parce que le serveur
  retombe sur la saison active sans jamais regarder celle de la soirée. Ce lot
  **frôle** ce cas sans le refermer : il rend le rattachement plus fréquent,
  donc il rendra ce trou plus visible. Le tenir voudrait dire faire dépendre la
  saison de la soirée — un second repli, dans la même fonction, qu'il vaut
  mieux peser à part que glisser dans celui-ci.
- **La soirée supprimée qui détache tout** — `deleteMatchDay` fait une
  suppression dure, `onDelete: SetNull` orpheline tous ses matchs en silence,
  et l'action ment sur son succès. Aucun cas de la base ne le décrit ;
  il en faudra un, et un lot.
- **`SOIREE-63`** (◐ partiel · *confort*) et **`SOIREE-70`** (✗ absent · *gêne
  un lundi*) — cités par erreur dans mes premières notes du 17 septembre. Le
  premier demande un bouton « Ajouter une soirée » dans l'app, le second de
  lire les matchs du soir hors ligne. Ni l'un ni l'autre ne parle de
  rattachement.
- **`APRES-15`** (✔ fait) — le rattachement après coup depuis le formulaire
  d'édition. Déjà livré par le lot 0001, tâche 7. Ce lot s'appuie dessus ; il
  ne le refait pas.

## Ce que ça débloque

Le mot de la soirée redevient possible : le mardi matin, la soirée du lundi a
son score, ses buteurs et son homme du match, et il y a quelque chose à coller
dans le groupe. Le calendrier de la saison redevient honnête — un lundi joué
s'affiche joué. Et les trois boutons qui proposaient de refaire une feuille
déjà faite arrêtent de tendre le piège : le classement du club ne dépend plus
de ce que personne ne tape sur « Saisir ».

Pour la suite, ça ouvre la porte à trois choses qui attendaient toutes la même
information : la compo préparée qui s'ouvre toute seule (`COMPO-01`), « On
rejoue » qui reste dans la même soirée (`APRES-06`), et un accueil mobile qui
sait parler du dernier lundi (`APRES-54`).
