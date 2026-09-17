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
n'appartient à aucune soirée. La soirée du lundi 14 septembre 19:00 — qui
existe, comme les 43 autres du calendrier annuel — reste vide.

Alors trois choses arrivent, et la troisième est la pire.

**1. La soirée n'a rien à raconter.** Son bilan est vide, son mot aussi. Le
mardi matin, il n'y a rien à coller sur WhatsApp. Le calendrier de la saison
affiche « aucun match » sur un lundi où quinze personnes ont joué.

**2. Le match est difficile à retrouver.** L'accueil de l'app ne demande au
serveur que les matchs du jour ; du mardi au dimanche il dit « Pas encore de
match aujourd'hui », et ne nomme aucun chemin vers ce qui a été joué. Le match
est bien dans l'onglet « Matchs », un onglet plus loin — rien ne le dit.

**3. Trois écrans proposent de saisir une feuille qui existe déjà.** Une soirée
sans match rattaché est une soirée « sans résultat ». Alors le calendrier de
l'app la marque « Saisir », le calendrier du site fait exactement pareil, et
l'accueil du site y ajoute un bandeau en pleine page : « Une soirée sans
résultat · Lundi 14 septembre · Saisir la feuille ». Les trois ouvrent une
feuille **vierge** datée de ce lundi. Les trois **créeraient un second match**,
et ils le proposent pendant six semaines.

Ce n'est pas seulement un faux match de plus. **Le doublon efface le vrai.**
Aujourd'hui le 17–11 reste visible sur l'accueil du site parce que le dernier
match terminé n'a pas de soirée, ce qui fait basculer la requête sur un repli
par jour : « la soirée à laquelle le dernier match est rattaché, *sinon tous
les matchs de ce jour-là* ». Dès qu'un doublon daté de 19:00 et rattaché
devient le dernier match terminé, la requête repart sur la branche « les matchs
de cette soirée » — et ne rend que lui. Le seul écran qui montrait encore le
vrai match cesse de le montrer.

Et il n'y a même pas besoin d'aller au bout. Un match naît `LIVE` : au premier
tap, avant qu'une seule équipe soit composée, les trois alarmes s'éteignent, la
rangée du lundi passe à « En cours », le bouton « Coup d'envoi » disparaît de
l'accueil et « Feuille restée ouverte » apparaît. Un geste hésitant, abandonné
à la deuxième compo, laisse le produit dans un état pire qu'avant — en silence,
et pour toujours.

Enfin, le même écran se contredit. L'accueil du site sait retomber sur le jour :
le 17–11 **est** dans son onglet daté « Lundi 14 ». Le bandeau rouge, juste
au-dessus, dit que cette soirée n'a pas de résultat. L'onglet ne s'ouvre jamais
de lui-même — il y a 44 soirées à venir, et c'est « À venir » qui gagne.

### Ce que la base de production dit, et qui rend ce lot petit

Quatre matchs, lus le 17 septembre :

| Match | Comment il est né | Sa soirée |
|---|---|---|
| lun. 07/09 19:00 — 18–9 | saisi le **mardi** soir, par « Saisir » depuis le calendrier | **rattaché** |
| lun. 14/09 08:06 — 6–7, annulé | lancé le lundi matin, **depuis le site** | **rattaché** |
| **lun. 14/09 18:46 — 17–11** | lancé le lundi soir, **depuis l'app** | **orphelin** |
| dim. 13/09 12:30 — annulé | un dimanche, hors calendrier | orphelin — *et c'est juste* |

Trois choses en sortent.

**La règle existe déjà, et elle marche.** Le match de 08:06 a rejoint la soirée
de 19:00 parce que le site recolle un match lancé le jour d'une soirée — « on
ne recolle que si on est effectivement dedans », dit son commentaire. Mieux :
le produit a déjà tranché *quelle* unité de temps fait foi. La requête ne
regarde que les soirées à partir de minuit du jour courant, et le commentaire
dit pourquoi : « une soirée reste en cours jusqu'à la fin de sa journée, pas
douze heures glissantes — le mardi à 7 h, la soirée du lundi s'affichait encore
comme la prochaine, avec le match du jour qui venait s'y rattacher. » La bonne
unité, c'est **le jour du club**, et ça a déjà été payé une fois. Il n'y a donc
rien à inventer.

**Mais elle est tenue par deux écrans, et elle ne s'applique qu'à un bouton.**
C'est la découverte du balayage 0000, mot pour mot : *une règle tenue par
l'affichage n'est pas une règle* (constitution, article III). Elle est écrite
deux fois en clair, dans deux pages du site, sans constante, sans nom, sans
test. Et sur l'accueil du site elle ne décide que du raccourci « Coup
d'envoi » : les deux liens voisins — « Composer les équipes », « Lancer un
match » — partent sans la soirée. Dans l'app, aucun chemin ne la transmet,
alors que l'écran a la soirée du jour sous la main. Le serveur, lui, ne cherche
jamais : il vérifie la soirée qu'on lui donne et écrit `null` sinon.

**Ce qui rend l'oubli d'autant plus net :** la même fonction, à six lignes
d'écart, traite deux rattachements de deux façons opposées. Pour la saison, si
le champ manque, le serveur retombe sur la saison active du club. Pour la
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
site lui propose, en rouge, de saisir une feuille qu'il a déjà remplie. À un
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
   le lot 0001 ; ce geste doit rester, et rester le dernier mot.

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
rejoint la soirée du même jour, dans le fuseau du club** — ni la veille, ni le
lendemain matin.

Ce qui s'en déduit sans autre débat : un match du dimanche ne rejoint pas le
lundi ; une soirée qui déborde sur 00:30 laisse un orphelin, et c'est le prix
assumé d'une règle qu'on peut expliquer en une phrase.

### Où la règle doit-elle vivre ?

**Dans le serveur.** Deux raisons, et la seconde est décisive.

La première est l'article III : aujourd'hui la règle est écrite deux fois, dans
deux pages du site, sans constante ni test, et elle ne décide que d'un bouton
sur trois de son propre écran. Une règle qui vit à l'écran ne vaut que pour
l'écran qui la porte — il y a dix-huit endroits qui créent un match.

La seconde est le gymnase. **Le téléphone n'a aucune mémoire des soirées** : sa
base locale ne déclare que six tables — clubs, effectif, matchs, participants,
événements, file d'envoi. La colonne `match_day_id` existe bien sur les matchs,
mais il n'y a nulle part où lire « quel est le lundi de ce soir ». Hors réseau,
l'accueil de l'app ne rend qu'une ligne d'erreur, et le bouton « Nouveau
match » n'apparaît même pas. Une règle tenue par l'app ne marcherait donc pas
le seul soir où elle compte (constitution, article I).

Le serveur, lui, a tout ce qu'il faut — et au bon moment : la date du match
(`playedAt`) voyage dans la file d'envoi et il la lit déjà. Un match saisi hors
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
match de ce jour-là ? » Si oui, l'écran ne propose plus d'en créer un : il
propose de rattacher celui qui existe, ou se tait.

Le repli par jour n'est pas à inventer non plus : il est déjà écrit deux fois
dans le dépôt — l'accueil du site l'utilise pour son onglet daté, et la liste
des matchs de l'app groupe les orphelins sous leur jour. Le club a déjà tranché
ce qu'est la soirée d'un match ; il ne l'a simplement jamais fait lire aux
écrans qui réclament.

### Que fait-on du match déjà orphelin ?

**Un geste, pas une migration.** Il y en a un seul en base — le 17–11 du
14 septembre — et le geste qui le répare existe (champ « Soirée » de
« Modifier les infos »). Écrire une migration pour une ligne coûterait plus
cher que de la corriger, et une migration qui rattache en masse fabriquerait le
seul état que la base ne décrit nulle part : **la soirée mixte**, où une partie
des matchs d'un lundi est rattachée et l'autre non. Cet état-là casse deux
écrans d'une façon inédite — l'accueil du site n'a qu'un repli tout ou rien et
masquerait les non-rattachés, la liste de l'app couperait le même lundi en deux
groupes. On n'en fabrique pas.

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
      rejoint pas. Testé aux deux bornes, dans le fuseau du club — c'est le
      piège que `lib/dates.ts` raconte déjà avoir payé.
- [ ] **Le hors-ligne rejoint le bon lundi.** Un match créé dans la file le
      lundi et rejoué trois jours plus tard rejoint la soirée du lundi, pas
      celle du jour du rejeu. Vérifiable parce que `playedAt` voyage déjà dans
      le payload : test sur la fonction, plus un passage de
      `five-scorer-mobile/scripts/parcours-lecture.mjs`.
- [ ] **Une soirée explicitement demandée gagne toujours.** Passer `matchDayId`
      (rangée « Saisir », fiche de la soirée) reste souverain ; le repli ne
      s'applique qu'à son absence. Et « match isolé » choisi à la main dans le
      formulaire d'édition n'est pas ré-écrasé au prochain passage.
- [ ] **Les trois écrans qui réclament regardent d'abord.** Le calendrier de
      l'app, le calendrier du site et le bandeau de l'accueil du site ne
      proposent plus « Saisir » sur une soirée dont un match du même jour
      existe — ils proposent de le rattacher, ou se taisent. Vérifié en base
      d'essai avec un match orphelin daté du bon jour.
- [ ] **Le match du 14 septembre 2026 porte sa soirée en production**, et les
      trois écrans se sont tus. C'est le seul rattrapage de ce lot ; il se fait
      à la main, avec le geste qui existe.
- [ ] `npx tsc --noEmit` vert des deux côtés · `npm test` (site) et
      `npm run tester` (app) verts · `node scripts/jeu-dessai.mjs && node
      scripts/parcours-lecture.mjs` en TOUT VERT · `npx expo export --platform
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
