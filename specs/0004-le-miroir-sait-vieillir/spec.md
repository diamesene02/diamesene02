# 0004 — Le miroir sait vieillir

*État : **corrigée après `/analyser`, prête pour le plan** · Écrite le
11 septembre 2026, corrigée le même jour.*

> **Ce que la garde `/analyser` a trouvé dans ce document.** Trois violations de
> l'article VIII — dans la spec qui s'en réclamait en ouverture. Une citation
> fausse (`five-scorer-mobile/db/schema.sql:114-116`, qui désigne la table `participants` ; le `CHECK`
> est en `133-135`). Un recompte faux (« quatre par le code ou la recherche,
> deux par Ibrahima » ; c'est 2 / 2 / 2). Et un chiffre inventé : l'en-tête
> parlait de « trois erreurs de `fichier:ligne` la veille » quand la
> constitution et `COMMENT-ON-TRAVAILLE.md` en comptent **deux**, qui n'étaient
> pas des erreurs de citation. Corrigés. Et deux affirmations de fond étaient
> fausses : voir Q7 et Q8.

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

- **La spec 0001 ne peut pas être livrée** — mais pas pour la raison que
  j'avais écrite, et la nuance change où il faut travailler. J'affirmais que le
  `CHECK` refuserait un match annulé. En réalité **la couche locale n'écrit
  JAMAIS un statut venu du serveur** : `ecrireMatch`
  (`five-scorer-mobile/lib/match/tables.ts:247`) n'est appelée que deux fois
  (`five-scorer-mobile/lib/match/local.ts:275,348`), chaque fois avec
  `status: "LIVE"` **en dur** (`:287,360`), et le seul autre chemin
  (`majFinDeMatch`, `five-scorer-mobile/lib/match/tables.ts:342`) écrit `'FINISHED'` en dur. Un `CANCELED` du
  serveur n'atteint jamais SQLite : le moteur ne refuse rien, **il n'est pas
  sollicité**.

  Le plafond est donc en **trois** endroits, pas un : l'union TypeScript
  `status: "LIVE" | "FINISHED"`
  (`five-scorer-mobile/lib/outbox/types.ts:51`), le `CHECK`
  (`five-scorer-mobile/db/schema.sql:96`), et **l'absence de chemin
  d'écriture**. Le `CHECK` ne mordra qu'au moment où 0001 ouvrira ce chemin — et
  il mordra par une exception dans la transaction, pas par une perte
  silencieuse. C'est toujours bloquant. Ce n'est pas le même travail.
- **La spec 0003 ne peut pas commencer.** Son étape 1 ajoute une valeur à un
  événement, et ses étapes suivantes ajoutent des types. Le miroir déclare
  `type TEXT NOT NULL CHECK (type IN ('GOAL', 'OWN_GOAL', 'YELLOW_CARD',
  'RED_CARD', 'HALF_TIME'))` (`five-scorer-mobile/db/schema.sql:133-135`).
  **Fermé, lui aussi.**

## Le site a un précédent — mais on ne le porte PAS, et c'est important

J'avais écrit « on ne conçoit rien, on porte une pratique qui tourne en
production ». **`/analyser` a montré que c'était faux deux fois.**

Le site déclare bien `this.version(1)`, `(2)` et `(3)`
(`five-scorer/lib/db.ts:210,221,240`), en gardant la déclaration v1. Mais :

1. **Sa seule vraie migration de données EFFACE la file d'attente.**
   `version(2).upgrade()` (`five-scorer/lib/db.ts:231-236`) fait
   `tx.table("roster").clear()`, `tx.table("matches").clear()` et
   `tx.table("outbox").clear()`. C'est **mot pour mot** ce que cette spec
   interdit deux paragraphes plus bas, et ce que l'article I interdit. Le modèle
   que j'invoquais est l'exemple à ne pas suivre.
2. **La doctrine ne se transpose pas.** Dexie ne déclare que des **index** : y
   ouvrir `status` à `CANCELED` ne demandera même pas de `version(4)`. SQLite a
   un schéma rigide et des `CHECK` : la même ouverture y impose une
   **reconstruction de table**. Les deux moteurs n'ont pas le même problème.

Ce lot n'est donc pas un portage, **c'est une conception** — et le dire change
l'estimation du plan.

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
  **Aucun refus, nulle part** — c'est la réponse Q4, et elle ne souffre pas
  d'exception « sauf sur les écritures ».
- **Se contenter du sens « app trop vieille ».** Une app trop RÉCENTE contre un
  serveur en cours de déploiement produit le même silence (`TRANS-38`).

## Questions tranchées

*Cette spec n'avait pas de section « Questions ouvertes ». La garde `/clarifier`
en a trouvé **six implicites** le 11 septembre 2026 — dans un attendu qui admet
deux lectures, ou un critère qu'on ne savait pas vérifier. **Une** tranchée par
le code (Q2), **une** par la recherche (Q1), **deux** par Ibrahima (Q4, Q5),
**deux** ici (Q3, Q6). La garde `/analyser` en a ajouté deux de plus (Q7, Q8),
nées de ses propres trouvailles. Aucune ne reste ouverte.*

- **Q1. Est-ce que la mise à jour à chaud coûte de l'argent ? → non, et de
  loin.** *Tranchée par la recherche.* Le palier gratuit d'EAS Update porte
  **1 000 utilisateurs actifs par mois**. Le club en a quinze : soixante-six
  fois sous le plafond. Le compte EAS existe déjà
  (`five-scorer-mobile/app.json`, `extra.eas.projectId`). La question du coût ne
  se pose pas à cette échelle, et il faut le réécrire ici le jour où le produit
  aurait mille utilisateurs.

- **Q2. Est-ce configuré quelque part ? → nulle part.** *Tranchée par le code.*
  Pas seulement `expo-updates` absent de `package.json` : **aucun
  `runtimeVersion`**, **aucun bloc `updates`** dans `five-scorer-mobile/app.json`,
  et **aucun `channel`** dans `five-scorer-mobile/eas.json`. Ce lot pose les
  trois, pas seulement la dépendance.

- **Q3. Quelle version le serveur compare-t-il ? → une version de PROTOCOLE,
  pas celle de l'app.** *Tranchée ici.* `version` vaut `1.0.0` et
  `ios.buildNumber` vaut `3` — mais ces deux-là bougent pour des raisons
  d'affichage, pas de contrat. Comparer le contrat sur un numéro qui change
  quand on corrige une couleur, c'est prévenir pour rien. Un entier qui
  n'augmente **que** quand le contrat change, et qui voyage dans un en-tête à
  chaque appel.

- **Q4. Que fait le serveur d'une app dépassée ? → il PRÉVIENT, il ne bloque
  jamais.** *Ibrahima, le 11 septembre 2026.* **Un bandeau, jamais un écran, et
  rien n'est refusé — nulle part, ni en lecture ni en écriture.** *(La spec
  portait trois formulations incompatibles de cette réponse : un bandeau, un
  écran, et un refus « sur les écritures ». `/analyser` les a relevées. Celle-ci
  est la seule ; les deux autres sont supprimées.)* **Au gymnase sans réseau, un blocage transformerait une
  incompatibilité en soirée perdue** — et une file bloquée est déjà le
  cul-de-sac que décrit `TRANS-13`. On ne bloque pas ce qui se tape à une main.
  *Le cas symétrique — une app trop RÉCENTE contre un serveur en cours de
  déploiement — dit autre chose, et ne bloque pas non plus.*

- **Q5. Que fait-on d'un plantage ? → un écran, et rien ne sort du club.**
  *Ibrahima, le 11 septembre 2026.* Un `ErrorBoundary` qui dit quoi faire et
  garde la feuille en cours ; le rapport reste **sur le téléphone**, lisible
  depuis les réglages. Aucune donnée ne part chez un tiers (constitution,
  article VI). Conséquence assumée : Ibrahima apprend les plantages par les
  joueurs, comme aujourd'hui — mais avec une trace exploitable au lieu d'un
  récit.
  *Vérifié : il n'existe **aucun** `ErrorBoundary` dans
  `five-scorer-mobile/app/` ni `composants/`, et l'écran d'échec du noyau
  (`five-scorer-mobile/composants/Noyau.tsx:137-154`) ne couvre que l'ouverture
  de la base.*

- **Q6. Où va l'`ErrorBoundary` ? → sur la feuille de match d'abord.**
  *Tranchée ici.* Expo Router en accepte un par route ; les poser tous est un
  travail de ratissage qui n'appartient pas à ce lot. La feuille est le seul
  écran qu'on tient à une main pendant qu'on joue, et le seul dont le plantage
  coûte une soirée. Les autres suivront, et c'est écrit là plutôt que découvert
  dans le diff (article X).

- **Q7. Une migration interrompue ? → une transaction, et le `PRAGMA` hors
  d'elle.** *Tranchée par `/analyser`, le 11 septembre 2026.* `appliquerSchema`
  passe par `db.execAsync()` (`five-scorer-mobile/lib/outbox/baseExpo.ts:31-33`),
  **sans transaction**. Une reconstruction de table coupée entre le
  `INSERT … SELECT` et le `DROP` laisse deux tables et une base à moitié migrée
  — sur le téléphone qui contient la soirée. La voie existe et n'est pas
  utilisée sur ce chemin : `withExclusiveTransactionAsync`
  (`five-scorer-mobile/lib/outbox/baseExpo.ts:48-57`). **Et `PRAGMA
  journal_mode` ne peut pas s'exécuter dans une transaction** : la migration ne
  peut donc pas être simplement collée dans `appliquerSchema`. Trois décisions,
  que le plan doit rendre explicites.

- **Q8. Où vit le schéma d'avant, et que fait-on d'un saut ou d'un retour en
  arrière ? → le plan répond, la spec pose les trois cas.** *Ouverte par
  `/analyser`.* Le critère central exige « une base à l'ancien schéma » : aucun
  fichier ne la conserve. C'est ce que les `version(1).stores({…})` de Dexie
  donnent gratuitement et que SQLite ne donne pas. Trois cas à traiter, et aucun
  n'a de réponse par défaut :
  **le saut** (six mois sans ouvrir l'app = deux ou trois paliers : on enchaîne
  ou on saute à la cible ?) · **le retour en arrière** (un TestFlight qui
  réinstalle un build antérieur sur une base déjà migrée — le cas le PLUS
  probable pour un club qui vit sur des builds internes, et rien ne dit ce qu'un
  `user_version` supérieur à la cible doit provoquer) · **le schéma historique**
  (un fichier par palier, ou une constante ?).

  *Et le schéma vit dans **deux** fichiers, pas un : `db/schema.sql` est la
  source, mais l'app charge `db/schema.ts` — Metro ne sait pas lire un `.sql` —
  généré par `five-scorer-mobile/scripts/schema-vers-ts.mjs`, avec un test
  d'égalité octet pour octet (`five-scorer-mobile/db/schema.test.ts:41-48`). Toute migration touche
  quatre artefacts.*

- **Q9. Quelle politique de `runtimeVersion` ? → un entier posé à la main.**
  *Tranchée ici, après `/analyser`.* C'est la seule chose qui empêche une mise à
  jour à chaud d'atteindre un binaire incapable de la supporter. Une politique
  `appVersion` ne marcherait PAS : `five-scorer-mobile/eas.json` est en
  `"appVersionSource": "local"` et `app.json` fige `version: "1.0.0"` — elle ne
  bougerait jamais. Et Q3 vient de décider que `version` ne dit rien du contrat.
  Donc : **un entier, incrémenté à la main dès qu'on touche à `plugins`, à une
  permission, ou à une dépendance native.** La règle s'écrit dans `EAS.md`.

## Les cas de la base que ce lot referme

*Quatre cas, tous `✗ absent`, tous **bloque un lundi** — vérifiés dans
[`cas.md`](../0000-le-club-et-lapp/cas.md).*

`TRANS-39` (une colonne ajoutée casse les installations existantes) ·
`TRANS-37` (une version part avec un bug le dimanche) · `TRANS-38` (serveur et
app qui divergent, en silence) · `TRANS-40` (l'app plante en plein match, et
personne ne l'apprend jamais).

**Ajouté après `/analyser` : `TRANS-65`** (◐ partiel · bloque un lundi). La base
locale qui ne s'ouvre pas — fichier abîmé, stockage plein, **ou une instruction
du schéma qui passe mal sur une vieille version d'iOS**. C'est littéralement le
résultat d'une migration ratée, et ce lot rend ce cas plus probable. Aujourd'hui
l'écran affiche `e.message`, la phrase anglaise brute de SQLite, sans bouton :
un cul-de-sac qui viole l'article V pendant qu'on voudrait sauver la soirée. Il
ne peut pas rester hors du périmètre d'un lot qui touche au schéma.

**Explicitement PAS dans ce lot** (constitution, article X) :
- `TRANS-13`, la pastille « n refusées » qui ne s'ouvre pas. Cousine — c'est
  l'écran qui dirait *pourquoi* la file est bloquée — mais elle appartient au
  lot de la soirée.
- `COMPTE-51` (un téléphone neuf, un Android, un UDID non enregistré) : il cite
  l'absence de canal OTA que ce lot pose, mais il porte surtout sur la
  distribution Apple. **Touché, pas refermé** — et c'est dit ici pour que
  personne ne le coche.

## À quoi on saura que c'est fait

- [ ] Un test crée une base **à l'ancien schéma**, y enfile une opération en
      attente, applique la migration, et retrouve **l'opération ET la colonne
      neuve**. Il tourne dans `five-scorer-mobile/db/schema.test.ts`, qui
      exécute déjà le vrai DDL sur `node:sqlite` : le même moteur SQLite, dans
      un **autre build**. Donc ce n'est pas une relecture, c'est une exécution —
      mais elle ne dit rien de la version embarquée par iOS, d'où le simulateur
      (article VII) et le cas `TRANS-65`.
- [ ] La contre-épreuve : on retire la migration, le test **échoue**. Une
      migration qu'aucun test ne peut faire tomber n'est pas vérifiée.
- [ ] `status` accepte `CANCELED` et `type` accepte une valeur neuve — **sans
      perte**. Formulation corrigée après `/analyser` : j'avais écrit « ouvertes
      par migration, pas par recréation », or **SQLite ne sait pas modifier un
      `CHECK`** — il n'existe aucun `ALTER TABLE … ALTER CONSTRAINT`. La seule
      voie est la reconstruction : table neuve, `INSERT INTO … SELECT`, `DROP`,
      `RENAME`, puis **recréation des index** (`matches_club`,
      `matches_club_statut`, `matches_joue_le` ; `events_match`,
      `events_cree_le`, `events_match_cree_le`). Ce qui ne doit pas se perdre,
      ce sont les **lignes**, pas la table.
- [ ] **Les deux chemins sont distingués**, parce qu'ils ne coûtent pas pareil :
      `ALTER TABLE ADD COLUMN` suffit pour `TRANS-39` et pour la colonne
      `points` de la spec 0003 ; seule l'ouverture d'un `CHECK` impose la
      reconstruction. Les présenter comme un seul chantier, comme je l'avais
      fait, fausse l'estimation.
- [ ] Un correctif JavaScript poussé le dimanche soir est sur les quinze
      téléphones **sans passer par TestFlight** — et une modification NATIVE ne
      passe pas, bloquée par `runtimeVersion` (Q9).
- [ ] L'app envoie sa version à chaque appel ; le serveur peut en exiger une
      minimale ; l'app affiche alors un **bandeau** qui dit quoi faire — en
      français, avec un geste possible — et **rien n'est refusé** (Q4).
- [ ] Une app trop RÉCENTE contre un serveur plus ancien est traitée aussi, et
      dit autre chose.
- [ ] Un plantage JavaScript pendant un match affiche un écran qui dit quoi
      faire, et la feuille en cours est toujours là après réouverture.
- [ ] La migration s'exécute **dans une transaction**, et un test le prouve en
      la coupant au milieu : la base reste sur l'ancien palier, entière, avec sa
      file (Q7).
- [ ] `TRANS-65` : quand la base refuse de s'ouvrir, l'écran dit quoi faire **en
      français** et porte un bouton « Réessayer » — plus de `e.message` brut
      (constitution, article V).
- [ ] **Les trois réponses de version sont vérifiées par une commande** — app
      trop ancienne, app trop récente, **app sans en-tête** : un script rejoue
      les trois appels et contrôle les trois réponses. Sans le troisième cas,
      les quinze téléphones installés aujourd'hui seraient tous déclarés « trop
      anciens » le jour du déploiement.
- [ ] `npm run tester` et `npm run verifier` verts dans `five-scorer-mobile`,
      `npx expo export --platform ios` en 0. **Côté site, `npx tsc --noEmit` et
      `npx next build`** — il n'y a là-bas ni script de types ni script de test
      (`five-scorer/package.json`), et ce lot n'en installe pas : il ne touche
      au site que pour lire un en-tête.
- [ ] Ce qu'**aucune commande ne peut vérifier** est dit ici plutôt que promis :
      le correctif JavaScript arrivé sur quinze téléphones, et le plantage
      rattrapé en plein match. Les deux se constatent sur un appareil, et la
      capture va au journal (article VII).
- [ ] `node scripts/parcours-lecture.mjs` **TOUT VERT sur trois passages
      d'affilée**, sans qu'une seule vérification existante ait été modifiée :
      ce lot ne change aucun comportement visible.
- [ ] Le tour rejoué dans le simulateur (constitution, article VII).

## Le site n'a presque rien à faire, et il faut le dire

Dexie couvre le mécanisme : **aucune `version(4)` n'est nécessaire** pour ouvrir
`status` à `CANCELED`, parce que Dexie ne déclare que des index, pas des champs.
En ouvrir une pour rien serait du travail inventé. Ce qui devra changer côté
site pour la spec 0001, c'est l'union TypeScript
`status: "LIVE" | "FINISHED"` (`five-scorer/lib/db.ts:37`) — aussi fermée que le
`CHECK` de l'app, et tout aussi invisible.

Le service worker, lui, porte déjà le numéro de build dans le nom de son cache
(`five-scorer/public/sw.js:27-30`) : il se renouvelle tout seul à chaque
déploiement. Rien à faire.

## Ce que ça débloque

Tout le reste. C'est le seul lot de la liste dont la valeur n'est pas ce qu'il
ajoute, mais ce qu'il **rend livrable** : la correction d'un match, l'annulation
au lieu de la suppression, la valeur d'un événement, le renommage — et chaque
colonne qu'on écrira après.
