# 0004 — Le miroir sait vieillir

*État : à valider · Écrite le 11 septembre 2026. Chaque affirmation a été
rouverte dans le code le jour même, et chaque citation est qualifiée par son
dépôt — la règle posée après trois erreurs de `fichier:ligne` la veille.*

## Le problème

**Rien de ce qu'on écrit n'atteint un téléphone déjà installé.**

Ce n'est pas une gêne, c'est un plafond. Tant qu'il tient, les specs 0001
(corriger un match), 0002 (le nom) et 0003 (les manches) ne sont pas
livrables — elles sont écrivables, vérifiables sur le Mac, et bloquées là.

Trois murs, vérifiés :

**1. Le miroir local ne sait pas se mettre à niveau.**
`appliquerSchema` fait `base.script(schema)` **et rien d'autre**
(`five-scorer-mobile/lib/outbox/base.ts:62-64`), sur un DDL entièrement en
`CREATE TABLE IF NOT EXISTS`. Son propre commentaire l'assume : *« le DDL est
tout entier en `CREATE ... IF NOT EXISTS` »*. Il n'existe **aucun**
`PRAGMA user_version` et **aucun** `ALTER TABLE` dans
`five-scorer-mobile/db/` ni `five-scorer-mobile/lib/` — les seuls PRAGMA du
dépôt sont `journal_mode` et `synchronous`
(`five-scorer-mobile/db/schema.sql:35,38`).

Sur une base qui existe déjà, une table modifiée **n'est pas modifiée**. En
silence. Et cette base est celle qui contient la soirée non synchronisée.

**2. Même migré, le code n'arrive pas.**
`expo-updates` est **absent** de `five-scorer-mobile/package.json` (zéro
occurrence). Un correctif passe par un build EAS puis une redistribution à
quinze personnes. Le site, lui, se répare par un déploiement en trois minutes.
**La moitié de l'app qui compte les buts est celle qu'on ne peut pas réparer
vite.**

**3. Personne ne sait qui parle à qui.**
L'app n'annonce pas sa version au serveur, et le serveur n'exige aucune version
minimale. `expo-constants` est bien importé (`five-scorer-mobile/lib/api.ts:1`)
mais seulement pour deviner l'adresse du Mac en développement. Une divergence se
solde par des refus en série sur des opérations que la file **met de côté**, et
l'écran qui l'expliquerait n'existe pas non plus (`TRANS-13`).

## Ce que ce plafond bloque, démontré

Ce n'est pas une crainte : les contraintes du miroir sont **fermées**, et deux
specs déjà écrites se cassent dessus.

- **La spec 0001 ne peut pas être livrée.** Sa décision Q8 remplace la
  suppression d'un match par une **annulation**. Or le miroir déclare
  `status TEXT NOT NULL CHECK (status IN ('LIVE', 'FINISHED'))`
  (`five-scorer-mobile/db/schema.sql:96`) : **un match annulé ne peut pas être
  écrit localement.** Il faut modifier cette contrainte, donc migrer, donc
  savoir migrer.
- **La spec 0003 ne peut pas commencer.** Son étape 1 ajoute une valeur à un
  événement, et ses étapes suivantes ajoutent des types. Le miroir déclare
  `type TEXT NOT NULL CHECK (type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD',
  'RED_CARD', 'HALF_TIME'))` (`five-scorer-mobile/db/schema.sql:114-116`).
  **Fermé, lui aussi.**

## La doctrine existe déjà dans ce dépôt — elle n'a simplement pas été portée

Le site fait tout ça, et depuis longtemps. `five-scorer/lib/db.ts` déclare
`this.version(1)`, `this.version(2)` et `this.version(3)` (`:210`, `:221`,
`:240`), **en gardant la déclaration v1** pour que Dexie sache faire monter une
base ancienne.

On ne conçoit donc rien. On **porte** une pratique qui tourne en production, du
navigateur vers le téléphone.

## Pour qui, et quand

Pour le club, jamais directement — c'est le seul lot de la liste dont personne
ne verra rien. Et c'est exactement ce qui le rend urgent : il ne se remarque que
le jour où il manque, et ce jour-là il est trop tard, parce que la soirée est
déjà dans un téléphone qui ne sait pas la rendre.

## Ce qu'on doit pouvoir faire

1. **Faire évoluer le miroir local sans rien perdre** — et surtout pas la file
   d'attente, qui est ce qui reste d'une soirée jouée sans réseau.
2. **Réparer l'app sans attendre une redistribution** quand le correctif est du
   JavaScript.
3. **Savoir, des deux côtés, à quelle version on parle**, et le dire à
   l'utilisateur quand ça ne colle plus — en français, avec un geste possible
   (constitution, article V).
4. **Rattraper un plantage** au lieu de laisser l'app morte en plein match.

## Ce qu'on ne doit PAS faire

- **Migrer en effaçant.** Une migration qui recrée la base est une perte de
  données déguisée : elle emporterait la soirée non synchronisée, ce que
  l'article I interdit. Toute migration se rejoue **sur une base d'avant**,
  remplie, avec une opération en attente dedans — et on vérifie qu'elle est
  encore là après.
- **Mettre à jour à chaud ce qui n'est pas du JavaScript.** `expo-updates` ne
  remplace pas un build : il ne porte ni un module natif, ni une permission, ni
  un changement d'`app.json`. Promettre l'inverse, c'est préparer une soirée où
  l'on croit avoir corrigé.
- **Faire de la version un mur.** Un serveur qui refuse une app trop ancienne au
  gymnase, sans réseau, transforme un défaut de compatibilité en soirée perdue.
  Le refus n'a de sens que sur une écriture qui part au serveur.
- **Se contenter du sens « app trop vieille ».** Une app trop RÉCENTE contre un
  serveur en cours de déploiement produit le même silence (`TRANS-38`).

## Les cas de la base que ce lot referme

*Quatre cas, tous `✗ absent`, tous **bloque un lundi** — vérifiés dans
[`cas.md`](../0000-le-club-et-lapp/cas.md).*

`TRANS-39` (une colonne ajoutée casse les installations existantes) ·
`TRANS-37` (une version part avec un bug le dimanche) · `TRANS-38` (serveur et
app qui divergent, en silence) · `TRANS-40` (l'app plante en plein match, et
personne ne l'apprend jamais).

**Explicitement PAS dans ce lot** (constitution, article X) : `TRANS-13`, la
pastille « n refusées » qui ne s'ouvre pas. Elle est cousine — c'est l'écran qui
dirait *pourquoi* la file est bloquée — mais elle appartient au lot de la
soirée, où elle a sa place avec les autres écrans.

## À quoi on saura que c'est fait

- [ ] Un test crée une base **à l'ancien schéma**, y enfile une opération en
      attente, applique la migration, et retrouve **l'opération ET la colonne
      neuve**. Il tourne dans `five-scorer-mobile/db/schema.test.ts`, qui
      exécute déjà le vrai DDL sur `node:sqlite` — le même moteur
      qu'`expo-sqlite`, donc ce n'est pas une relecture, c'est une exécution.
- [ ] La contre-épreuve : on retire la migration, le test **échoue**. Une
      migration qu'aucun test ne peut faire tomber n'est pas vérifiée.
- [ ] `status` accepte `CANCELED` et `type` accepte une valeur neuve — les deux
      contraintes qui bloquent les specs 0001 et 0003 sont **ouvertes par
      migration**, pas par recréation.
- [ ] Un correctif JavaScript poussé le dimanche soir est sur les quinze
      téléphones **sans passer par TestFlight**.
- [ ] L'app envoie sa version à chaque appel ; le serveur peut en exiger une
      minimale, et l'app affiche alors un écran qui dit quoi faire — en
      français, avec un bouton.
- [ ] Une app trop RÉCENTE contre un serveur plus ancien est traitée aussi, et
      dit autre chose.
- [ ] Un plantage JavaScript pendant un match affiche un écran qui dit quoi
      faire, et la feuille en cours est toujours là après réouverture.
- [ ] `npm run tester` vert dans `five-scorer-mobile`, `tsc --noEmit` vert des
      deux côtés, `npx expo export --platform ios` en 0.
- [ ] `node scripts/parcours-lecture.mjs` **TOUT VERT sur trois passages
      d'affilée**, sans qu'une seule vérification existante ait été modifiée :
      ce lot ne change aucun comportement visible.
- [ ] Le tour rejoué dans le simulateur (constitution, article VII).

## Ce que ça débloque

Tout le reste. C'est le seul lot de la liste dont la valeur n'est pas ce qu'il
ajoute, mais ce qu'il **rend livrable** : la correction d'un match, l'annulation
au lieu de la suppression, la valeur d'un événement, le renommage — et chaque
colonne qu'on écrira après.
