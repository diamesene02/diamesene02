# 0003 — Les manches, et ce qui vaut plus d'un point

*État : à valider · Écrite le 10 septembre 2026, après qu'Ibrahima a tranché
« tout, manches comprises ». Chiffres comptés le jour même, commandes données.*

## Le problème

Le moteur ne fait pas du football. Il fait **« deux camps, un événement = un
point »** — et c'est plus étroit qu'il n'y paraît.

Vérifié aux trois seuls endroits où un score se calcule dans les deux dépôts :

- `recomputeScore` **compte** les événements, il n'en somme pas les valeurs :
  `groupBy({ by: ["team"], where: { type: { in: ["GOAL","OWN_GOAL"] } },
  _count: { _all: true } })`
  (`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30`) ;
- `scoreDelta` rend **1 ou 0**, jamais autre chose — deux fois, mot pour mot :
  `five-scorer/lib/localMatch.ts:210-212` et
  `five-scorer-mobile/lib/match/local.ts:174-176`.

Il n'y a **aucun autre endroit** où un score se fabrique.

Trois conséquences, et elles ne coûtent pas du tout la même chose :

**1. Tout sport à un point par action passe déjà.** Futsal, handball, hockey,
ultimate, rugby à toucher, water-polo : rien à changer dans le moteur, seulement
des mots.

**2. Un panier à 2 ou 3 points, un essai à 5 : impossible.** Rien ne porte la
valeur d'un événement. C'est **une colonne et trois fonctions**, dont deux déjà
jumelles.

**3. Un score en manches — volley, badminton, tennis, padel, ping-pong : le
score n'a nulle part où vivre.** `scoreA`/`scoreB` sont deux entiers, et ils
sont partout : **471 occurrences dans 51 fichiers**, dont **12 fichiers du
moteur** (`stats.ts`, `elo.ts`, `mvp.ts`, `soiree.ts`, `shareCard.ts`, `db.ts`,
`localMatch.ts` côté site ; `api.ts`, `outbox/types.ts`, `match/tables.ts`,
`match/local.ts` côté app). Et **le serveur ne connaît aucune notion de
période** : `period` n'existe que dans les deux miroirs locaux
(`five-scorer/lib/db.ts:45`, `five-scorer-mobile/db/schema.sql:104`, plafonné à
2 par `five-scorer-mobile/lib/match/local.ts:726`) et **zéro occurrence dans `five-scorer/prisma/schema.prisma`**.
`HALF_TIME` est un marqueur de chronologie dont le commentaire dit lui-même
« aucun effet sur le score » (`five-scorer/prisma/schema.prisma:420-421`).

Un 25-20 / 22-25 / 15-11 n'a, aujourd'hui, aucun endroit où être écrit.

## Pour qui, et quand

Pour le club, quand il voudra faire autre chose que du foot un soir de la
semaine. Et pour les clubs qu'on n'a pas encore.

**Ce n'est pas urgent.** Personne ne l'attend le lundi prochain. C'est
exactement pour ça que ce lot doit être découpé : un chantier sans urgence qui
casse une soirée est le pire des deux mondes.

## Ce qu'on doit pouvoir faire

1. **Un événement peut valoir plus d'un point.** Un panier à 3, un essai à 5,
   une transformation à 2.
2. **Un match peut se jouer en manches**, chacune avec son score, et le match se
   gagne aux manches et non aux points.
3. **Le classement, l'Élo et les records restent vrais** dans les deux cas.
4. **Rien de tout ça ne change quoi que ce soit pour le foot du lundi.**

## Ce qu'on ne doit PAS faire

- **Livrer d'un bloc.** 471 occurrences dans 51 fichiers, ça ne se fait pas en
  un week-end, et le club joue lundi. Chaque étape ci-dessous est livrable et
  utile seule (voir § « Les étapes »).
- **Toucher au miroir local avant qu'il sache vieillir.** `five-scorer-mobile/db/schema.sql` a un
  `CHECK (type IN ('GOAL','OWN_GOAL','YELLOW_CARD','RED_CARD','HALF_TIME'))`
  fermé, et **aucune version de schéma** : tout est en
  `CREATE TABLE IF NOT EXISTS`, sans `PRAGMA user_version` ni `ALTER TABLE`. Une
  colonne ajoutée aujourd'hui n'atteindra jamais un téléphone déjà installé.
  **C'est un préalable absolu**, et il n'est pas dans cette spec.
- **Poser le sport sur `Club`.** Constitution, article IX : `Club` est 1:1 avec
  l'organisation, donc deux sports = deux clubs = deux effectifs, deux Élo, deux
  caisses pour les mêmes quinze personnes. Le motif à suivre existe et tourne :
  `MatchDay.teamAName` — le club porte le défaut, la soirée l'écrase.
- **Généraliser le vocabulaire tant que personne ne le demande.** Ouvrir les
  mots (« but » → « point ») rend tièdes des écrans qui sont bons parce qu'ils
  sont spécifiques. On attend une demande observée, pas supposée.

## Les étapes

*Chacune est livrable seule, et le foot du lundi ne bouge pas.*

**Préalable — hors de cette spec.** Le miroir local doit savoir vieillir
(`PRAGMA user_version` + migrations ordonnées), et l'app doit pouvoir se mettre
à jour (`expo-updates` est absent de `package.json`). Sans ça, aucune étape
ci-dessous n'atteint un téléphone déjà installé.

**Étape 1 — la valeur d'un événement.** `MatchEvent.points` (défaut 1),
`recomputeScore` somme au lieu de compter, les deux `scoreDelta` rendent la
valeur. `Match.scoreA/scoreB` **reste un entier** : les 471 occurrences ne
bougent pas. *Débloque le basket et le rugby. Coût : une colonne, trois
fonctions.*

**Étape 2 — le sport vit sur le créneau.** Un préréglage porté par `MatchDay`,
écrasable, avec le défaut sur `Club`. Aucun comportement nouveau : on déplace
seulement l'endroit où la question se pose. *Débloque le badminton du jeudi sans
créer un second club.*

**Étape 3 — les manches.** Le gros morceau, et le seul qui touche les 471
occurrences. Il n'est PAS ouvert tant que les deux précédentes ne tournent pas
depuis une saison. **La question à trancher à ce moment-là, et pas avant :**
`scoreA`/`scoreB` deviennent-ils le compte des MANCHES gagnées (auquel cas les
471 occurrences survivent, et seuls les écrans changent), ou faut-il une table
de manches ? *La première réponse est probablement la bonne, et elle rendrait
cette étape dix fois moins chère que ce que ce document annonce. Elle demande
d'être éprouvée, pas devinée.*

## Ce qui casse, sport par sport

*Relevé dans le code, pas supposé. À traiter dans les étapes concernées.*

| | État |
|---|---|
| Futsal, hand, hockey, ultimate, rugby à toucher, water-polo | **Portés aujourd'hui.** Rien à changer dans le moteur. |
| Basket, rugby | Étape 1. |
| Volley, badminton, tennis, padel, ping-pong | Étape 3. |
| Course, natation, escalade | **Hors sujet** — pas deux camps. Un autre produit. |

Et trois choses calibrées sur le football, qui mentent silencieusement dès qu'on
change d'échelle de score :

- **L'Élo sature.** `weight = Math.min(2, 1 + |scoreA − scoreB| / 4)`
  (`five-scorer/lib/elo.ts:39`) : à partir de 4 d'écart le poids est plafonné. Un basket à
  50-46 pèse autant qu'un 80-40, et le K effectif double en permanence sans que
  rien ne l'annonce.
- **L'homme du match est une formule de buteur.** `base = goals * 2`
  (`five-scorer/lib/mvp.ts:38-44`) : à dix paniers par soirée, le meilleur marqueur gagne
  mécaniquement, et le titre cesse d'être un titre.
- **Les paliers sont des ordres de grandeur de foot.**
  `PALIERS_BUTS = [1,5,10,25,50,100,200]` (`five-scorer/lib/stats.ts:942-945`) : un
  basketteur les épuise en vingt lundis, et « encore deux buts » n'a plus rien à
  proposer.

## Les cas de la base que ce lot referme

**Aucun des 549.** Le balayage du 10 septembre portait sur le produit tel qu'il
est — un club de foot à cinq — et n'a pas relevé de cas d'un autre sport.
C'est une extension, pas une réparation, et c'est écrit ici pour que la question
ne se repose pas.

**Ce que ça implique sur l'ordre :** la spec 0000 compte **49 cas qui bloquent
un lundi** et 134 cas faux. Ce lot n'en referme aucun. Il vient donc **après**
eux, sauf décision contraire écrite ici avec sa raison.

## À quoi on saura que c'est fait

*Étape 1 :*

- [ ] Un club en basket saisit un panier à 2 et un à 3 ; le score affiche 5, sur
      l'app ET sur le site.
- [ ] Le foot du lundi est **inchangé** : `points` vaut 1 partout, et
      `parcours-lecture.mjs` rend TOUT VERT sans qu'une seule vérification ait
      été modifiée.
- [ ] Un téléphone qui n'a pas la nouvelle version continue de fonctionner en
      foot — le serveur avance en premier (constitution, article VII).
- [ ] La migration est rejouée sur une base d'avant, avec des matchs existants
      qui gardent leur score.

*Étape 2 :*

- [ ] Un même club tient une soirée de foot le lundi et une de badminton le
      jeudi, **sans second club, sans second effectif, sans second Élo**.
- [ ] Le réglage de sport n'est écrit nulle part sur `Club` sans qu'une soirée
      puisse l'écraser (constitution, article IX).

*Étape 3 — les critères s'écriront quand la question du § « Les étapes » aura
été tranchée. Les inventer maintenant serait deviner.*

## Ce que ça débloque

Le produit cesse de s'appeler par un sport. Mais surtout : l'étape 1 coûte une
colonne, et elle démontre au reste du dépôt que la variabilité se pose là où le
moteur l'attend — sur l'événement, pas sur le club.
