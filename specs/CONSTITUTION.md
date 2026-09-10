# La constitution

*Ce que le produit tient, quoi qu'il arrive. Toute spec est relue contre ce
document ; une spec qui le contredit est refusée, ou change la constitution —
et alors elle le dit dans son texte, avec la raison.*

*Écrite le 10 septembre 2026, à partir de ce que le projet a appris à ses
dépens. Chaque article est né d'un défaut réel, nommé sous lui.*

---

## I. Le lundi soir ne s'arrête pas

Le gymnase n'a pas de réseau. La feuille se tient sans lui, à une main, par
quelqu'un qui joue aussi. **Rien de ce qui a été tapé ne disparaît**, jamais,
pour aucune raison.

Toute écriture faite au gymnase est locale d'abord, envoyée ensuite. Une
opération n'est retirée de la file **que** sur un accusé de réception de notre
serveur — pas sur un code HTTP.

> *Né de :* `sync.ts:416` retirait une opération sur la foi d'un `res.ok`.

## II. Rien ne s'efface

Un joueur qui part **s'archive**. Un match qui n'a pas eu lieu **s'annule**. Un
membre retiré **laisse ses buts au club**. Un classement de saison ne se
réécrit pas parce que quelqu'un a déménagé.

Toute suppression dure est une dette. Il en reste **sept** au 10 septembre 2026
(spec 0000 § 7.5) ; aucune nouvelle n'est admise, et une spec qui en referme une
le dit.

> *Né de :* la v1 avait un `deletedAt`, la v2 l'a retiré. Supprimer une soirée
> efface qui a payé.

## III. Une règle tenue par l'affichage n'est pas une règle

Toute règle qui protège **un chiffre, un droit ou une personne** est tenue par
le serveur. L'écran peut la répéter pour ne pas proposer un bouton qui sera
refusé ; il ne peut pas en être le seul gardien.

Une règle que le site et l'app partagent vit dans **une seule fonction**,
importée des deux côtés, avec un test qui échoue si elle se dédouble
(`lib/noyau/copie-conforme.test.ts`).

> *Né de :* 39 règles sur 298 ne vivaient que dans du JSX, 33 dans rien du tout.

## IV. Les chiffres doivent être vrais

Le classement, l'Élo, la forme, les records, la caisse : ils ne valent que si on
peut réparer une faute de frappe, et **qu'aucun écran ne raconte autre chose
qu'un autre**.

Un montant, un rang, un total : ce qui est **dû** se fige au moment où il naît.
Ce qui se recalcule à chaque affichage n'est pas un fait, c'est une
reconstitution — et elle change dans le dos des gens.

> *Né de :* la part de terrain, recalculée à chaque rendu depuis les présents du
> moment.

## V. Un refus se dit, en français, et propose une suite

Un 404 muet, une pastille « 3 refusées » qui ne s'ouvre pas, un écran qui ne
réagit pas : ce sont des culs-de-sac. **Tout refus porte un message affichable
et un geste possible.**

Un geste qui ne se rattrape pas se confirme par une phrase qui **dit ce qui va
se passer** — jamais par « Êtes-vous sûr ? ».

## VI. Ce qui touche une personne qui n'a pas choisi d'être là

Le capitaine crée des fiches pour des gens qui n'ont pas de compte, avec leur
nom et leur visage. **Ces gens-là priment sur toute fonctionnalité.**

Rien qui les nomme ou les montre ne sort du club sans authentification. Ce que
`/privacy` promet, le produit le fait — dans les deux sens.

> *Né de :* `lib/stats.ts` ne filtre jamais `isArchived`, et ce classement
> alimente la vitrine publique en CORS `*`.

## VII. On voit avant de livrer

Aucun build sans avoir vu l'écran **dans le simulateur, à côté de la page du
site**. Aucune migration de schéma qui n'ait été rejouée sur une base d'avant.

Le serveur avance en premier, l'app ensuite — jamais l'inverse. Un téléphone qui
envoie un champ qu'un serveur ne lit pas écrit un chiffre faux sans le dire.

## VIII. Ce qui est écrit doit être vérifiable

Chaque affirmation d'une spec porte son `fichier:ligne`. Chaque critère
d'acceptation se vérifie **par une commande**. « L'écran est clair » n'est pas
un critère ; « `parcours-lecture.mjs` rend TOUT VERT » en est un.

Un chiffre recopié d'un document à l'autre **se recompte**. Deux erreurs ont
passé une relecture le 10 septembre 2026 — un comptage de cas, un arrondi de
centimes — parce qu'elles avaient été reprises sans rouvrir le fichier.

## IX. Le sport appartient au créneau, pas au club

`Club` est 1:1 avec l'organisation. Poser un réglage de sport sur `Club`, c'est
condamner les mêmes quinze personnes à deux clubs, deux effectifs, deux Élo,
deux caisses pour le foot du lundi et le badminton du jeudi.

**Aucun réglage de sport n'est posé sur `Club` sans qu'une soirée puisse
l'écraser.** Le motif existe et tourne (`MatchDay.teamAName` : le club porte le
défaut, la soirée l'écrase).

## X. On dit ce qu'on ne fait pas

Ce qu'une spec écarte est une décision, et elle s'écrit. Un périmètre réduit en
silence se lit comme un oubli, et se repaie deux fois.
