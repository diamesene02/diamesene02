# 0004 — Plan

*Écrit le 11 septembre 2026, après les gardes `/clarifier` et `/analyser`. Le
**comment**. Pas de code : des contrats, un découpage, et ce qu'on n'écrit pas.*

---

## 1. La forme de la migration

### L'invariant central : deux chemins, un seul schéma

Une base **neuve** naîtra du script `SCHEMA` (`CREATE TABLE IF NOT EXISTS …`).
Une base **existante** montera par une échelle de paliers. **Les deux doivent
arriver au même schéma**, sinon les téléphones du club divergent selon leur date
d'installation — et le défaut ne se verrait qu'à la première requête qui touche
la différence.

C'est l'invariant que le lot doit prouver, et c'est ce qui rend le test de
convergence (§ 6) plus important que les migrations elles-mêmes.

### Où le crochet se pose

`ouvrirBase()` (`five-scorer-mobile/lib/outbox/baseExpo.ts:66-71`) fait
aujourd'hui trois choses : ouvrir le fichier, construire la `BaseExpo`, appeler
`appliquerSchema(base, SCHEMA)`. C'est dans `appliquerSchema`
(`five-scorer-mobile/lib/outbox/base.ts:62-64`) que tout se joue, parce que
c'est le seul point de passage — les tests l'appellent aussi
(`five-scorer-mobile/lib/outbox/sync.test.ts:28,442`), donc ce qu'on y met est
éprouvé par tout ce qui existe déjà.

**L'ordre, et il n'est pas négociable :**

1. **Les `PRAGMA` d'abord, hors transaction.** `journal_mode = WAL`
   (`five-scorer-mobile/db/schema.sql:35`) **ne peut pas s'exécuter dans une
   transaction** — SQLite le refuse. Et `synchronous = NORMAL` (`:38`) doit être
   reposé à chaque connexion, il n'est pas persistant. Ils restent donc là où
   ils sont, en tête du script.
2. **Le script du schéma ensuite**, tel quel. Il est idempotent par
   construction : sur une base existante il ne fait rien, sur une base neuve il
   crée tout.
3. **L'échelle des paliers enfin**, chaque palier **dans sa propre
   transaction** — `base.transaction()`, qui existe déjà dans l'interface
   (`five-scorer-mobile/lib/outbox/base.ts`) et qui passe par
   `withExclusiveTransactionAsync` côté Expo
   (`five-scorer-mobile/lib/outbox/baseExpo.ts:48-57`), aujourd'hui inutilisé
   sur ce chemin.

Un palier interrompu — l'app tuée, la batterie morte — laisse donc la base
**sur son palier précédent, entière, avec sa file**. C'est la réponse à Q7.

### Ce qu'un palier a le droit de faire

Deux gestes, et leur coût n'a rien à voir :

- **`ALTER TABLE … ADD COLUMN`** — suffisant pour ajouter une colonne
  (`TRANS-39`, et la colonne `points` de la spec 0003). Une instruction.
- **La reconstruction complète** — obligatoire pour ouvrir un `CHECK`, puisque
  SQLite n'a pas d'`ALTER TABLE … ALTER CONSTRAINT` : table neuve sous un nom
  temporaire, `INSERT INTO … SELECT`, `DROP` de l'ancienne, `RENAME`, **puis
  recréation des index**. Pour `matches` : `matches_club`,
  `matches_club_statut`, `matches_joue_le`. Pour `events` : `events_match`,
  `events_cree_le`, `events_match_cree_le`.

**Un palier ne vide jamais une table.** C'est la faute du modèle qu'on avait
invoqué (`five-scorer/lib/db.ts:231-236` fait `outbox.clear()`), et l'article I
l'interdit.

### Le numéro de palier

`PRAGMA user_version` — un entier que SQLite range dans l'en-tête du fichier, à
coût nul, et qui vaut **0** sur toute base existante aujourd'hui.

D'où l'ambiguïté à lever : `user_version = 0` signifie **soit** une base neuve,
**soit** une base du club installée avant ce lot. On les distingue en regardant
si une table du schéma existe. Une base vide part directement au palier
courant ; une base peuplée entre dans l'échelle au palier 1.

### La rétrogradation — Q8, et c'est le cas le plus probable

Un `TestFlight` qui réinstalle un build antérieur sur une base déjà migrée : le
club vit sur des builds internes, ça arrivera.

**Règle : si `user_version` est SUPÉRIEUR à la cible du code, on ne touche à
rien.** Pas de migration descendante — elle perdrait forcément ce que la version
supérieure avait ajouté. On ouvre la base en lecture, on laisse la file
tranquille, et on affiche l'écran de `TRANS-65` avec le bon message : *« cette
version de l'app est plus ancienne que les données de ce téléphone »*, et un
geste possible.

### Le saut de paliers

L'échelle s'exécute **palier par palier**, jamais en sautant à la cible. Six
mois sans ouvrir l'app, c'est deux ou trois paliers qui s'enchaînent — et chacun
a été testé contre le précédent, ce qu'un saut direct n'aurait jamais été.

---

## 2. Où vit le schéma d'avant

Le critère central exige « une base à l'ancien schéma ». Rien ne la conserve
aujourd'hui — c'est ce que les `version(1).stores({…})` de Dexie donnent
gratuitement et que SQLite ne donne pas.

**Proposition : `five-scorer-mobile/db/paliers/`**, avec deux fichiers par
palier :

- `NNN-schema.sql` — **l'instantané complet** du schéma tel qu'il était à ce
  palier. C'est ce qui permet de construire une vraie base d'avant dans un test.
- `NNN-<nom>.sql` — **la migration** qui mène du palier `NNN-1` à `NNN`.

`001-schema.sql` est donc une copie du `db/schema.sql` d'aujourd'hui, figée le
jour du lot et **jamais retouchée ensuite**. C'est une archive, pas un fichier
vivant.

**Et la chaîne de génération compte quatre artefacts, pas un.** `db/schema.sql`
est la source, mais l'app charge `db/schema.ts` — Metro ne sait pas lire un
`.sql` — généré par `five-scorer-mobile/scripts/schema-vers-ts.mjs`, avec un
test d'égalité octet pour octet
(`five-scorer-mobile/db/schema.test.ts:41-48`). Les paliers doivent suivre le
même chemin : **un fichier SQL, sa copie TypeScript, et le test qui les tient
égales.** Sinon la migration existe sur le Mac et pas sur le téléphone.

---

## 3. Le contrat serveur : la version de protocole

### Ce que l'app envoie

Un en-tête sur **chaque** appel authentifié, portant un **entier** — pas
`version` (`1.0.0`), pas `buildNumber` (`3`), qui bougent quand on corrige une
couleur (Q3). Il n'augmente **que** quand le contrat change.

Le point de passage existe et est unique : `five-scorer-mobile/lib/appel.ts`.

### Ce que le serveur répond

`five-scorer/lib/guard.ts` connaît deux nombres : le protocole **minimum** qu'il
sert encore, et le protocole **courant**. Il compare, et rend le verdict **dans
un en-tête de la réponse** — jamais par un code d'erreur, jamais par un refus
(Q4).

*Vérifié avant d'écrire les tâches : **28 routes** appellent
`getClubApiContext()` directement (`five-scorer/lib/guard.ts:94-108`), sans
passage commun. Ajouter un champ au corps toucherait 28 fichiers pour une
métadonnée qui n'est pas de la donnée métier — exactement ce que l'article III
déconseille. Le point de passage unique existe déjà côté transport :
`five-scorer/middleware.ts`, qui enveloppe `/api/clubs/**`
(`five-scorer/middleware.ts:39-41`, le matcher `:47-48`) et pose déjà un refus
nu pour ce même préfixe. Le verdict de version s'y pose en un seul endroit, sans toucher une
route métier.*

Trois cas, et le troisième est celui qu'on oublie :

| L'app envoie | Le serveur | L'app affiche |
|---|---|---|
| un entier trop petit | sert normalement | un bandeau « mets à jour » |
| un entier trop grand | sert normalement | un bandeau « le serveur est en cours de déploiement » |
| **rien** | **sert normalement, sans rien dire** | rien |

**Le troisième cas n'est pas un détail : c'est l'état des quinze téléphones
installés aujourd'hui.** Sans cette règle, le jour du déploiement, tout le monde
est déclaré « trop ancien ».

### L'ordre de livraison — article VII

**Le serveur part en premier, seul, et il ne change rien.** Il apprend à lire un
en-tête que personne n'envoie encore : c'est un déploiement sans effet, donc
sans risque. L'app suit au build d'après. L'inverse — une app qui envoie un
en-tête que le serveur ignore — serait inoffensif aussi, mais on tient l'ordre
parce que c'est la règle et qu'elle ne coûte rien ici.

---

## 4. La mise à jour à chaud

`expo-updates`, plus les trois choses qui manquent et que la spec a relevées :
un bloc `updates` dans `app.json`, un `runtimeVersion`, et un `channel` par
profil dans `eas.json` (`lundi`, `atelier`, `magasin`).

**`runtimeVersion` : un entier posé à la main** (Q9). Pas `appVersion` :
`five-scorer-mobile/eas.json` est en `"appVersionSource": "local"` et `app.json`
fige `version: "1.0.0"` — la politique ne bougerait jamais, et laisserait passer
une mise à jour JavaScript sur un binaire dont les modules natifs ont changé.

**La règle s'écrit dans `EAS.md`** : *toute touche à `plugins`, à une
permission, ou à une dépendance native incrémente le `runtimeVersion`.* C'est
une discipline humaine, et il faut qu'elle soit écrite là où on la lira.

Le palier gratuit porte 1 000 utilisateurs actifs par mois ; le club en a
quinze (Q1).

---

## 5. Les deux écrans

**Le bandeau de version.** Discret, en haut, dans l'app entière. Il dit et ne
bloque pas. Il disparaît quand la version redevient bonne.

**L'écran d'échec de la base — `TRANS-65`.** Il existe déjà
(`five-scorer-mobile/composants/Noyau.tsx:137-154`) et il est un cul-de-sac : il
affiche `e.message`, la phrase anglaise brute de SQLite, sans bouton. Il gagne
trois choses : une phrase en français qui dit ce qui se passe, un bouton
**Réessayer**, et le cas de la rétrogradation (§ 1). *Et il n'attrape pas que
l'ouverture de la base : le `try` du fournisseur
(`five-scorer-mobile/composants/Noyau.tsx:63-86`) couvre aussi la création du
match local et du drain.*

**L'`ErrorBoundary`, sur la feuille de match seulement** (Q6). Expo Router en
accepte un par route ; il n'en existe aucun dans tout le dépôt. La feuille est
le seul écran qu'on tient à une main en jouant, et le seul dont le plantage
coûte une soirée. Le rapport **reste sur le téléphone** (Q5).

---

## 6. Comment on vérifie

`five-scorer-mobile/db/schema.test.ts` exécute déjà le vrai DDL sur
`node:sqlite` et sait enfiler une opération d'outbox (`enfiler`, `:30-38`). Tout
s'y branche.

**Le test de convergence — le plus important du lot.** Construire une base à
partir de `db/paliers/001-schema.sql`, faire monter l'échelle ; construire une
base neuve à partir de `db/schema.sql` ; **comparer les deux schémas** (par
`sqlite_master`). S'ils diffèrent, échec. C'est ce test qui protège l'invariant
du § 1.

**Le test de la file.** Base à l'ancien schéma, une opération en attente dedans,
migration, et l'opération est **encore là**, avec la colonne neuve.

**La contre-épreuve.** On retire la migration : le test **doit** échouer. Une
migration qu'aucun test ne peut faire tomber n'est pas vérifiée.

**Le test d'interruption.** Un palier coupé au milieu laisse la base sur le
palier précédent, entière. Faisable parce que `Base` est une interface : on en
fournit une qui échoue à l'instruction choisie.

**Les trois réponses de version.** Un script rejoue les trois appels — entier
trop petit, trop grand, **absent** — et contrôle les trois réponses. C'est le
seul des critères « version » qui soit scriptable sans téléphone, et il couvre
le cas des quinze téléphones d'aujourd'hui.

**Ce qu'aucune commande ne vérifiera**, et qui est dit plutôt que promis : le
correctif JavaScript arrivé sur quinze téléphones, et le plantage rattrapé en
plein match. Les deux se constatent sur un appareil, et la capture va au journal
(article VII).

---

## 7. Ce qu'on ne fait PAS, et pourquoi

- **Aucune migration descendante.** Elle perdrait ce que la version supérieure a
  écrit. On refuse de toucher, on le dit (§ 1).
- **Aucun `PRAGMA integrity_check` automatique à l'ouverture.** Il coûte un
  balayage complet du fichier à chaque démarrage, pour un cas rare. Il a sa
  place derrière le bouton « Réessayer » de `TRANS-65`, pas sur le chemin
  nominal.
- **Aucune trace envoyée nulle part** (Q5, article VI).
- **Aucun `ErrorBoundary` ailleurs que sur la feuille** (Q6). Les autres écrans
  suivront dans leur propre lot.
- **Aucun changement de comportement visible.** Si `parcours-lecture.mjs` doit
  être modifié pour rester vert, c'est le signe qu'on a dépassé le périmètre.
- **Rien sur le site sauf lire un en-tête.** Dexie couvre déjà le mécanisme, et
  **aucune `version(4)` n'est nécessaire** : Dexie ne déclare que des index, pas
  des champs. En ouvrir une serait du travail inventé. Le service worker porte
  déjà le numéro de build dans le nom de son cache
  (`five-scorer/public/sw.js:27-30`).
- **`COMPTE-51` n'est pas refermé.** Ce lot lui donne le canal OTA qui lui
  manquait, mais son sujet est la distribution Apple — un téléphone neuf, un
  Android, un UDID non enregistré.

---

## 8. L'ordre

1. **Le serveur apprend à lire l'en-tête.** Déployé seul, sans effet (§ 3).
2. **L'échelle de migration et ses tests**, à vide : un seul palier, qui ne
   change rien, et le test de convergence qui le prouve. **C'est la pièce
   maîtresse** — tout le reste est du branchement.
3. **`TRANS-65`** : l'écran d'échec cesse d'être un cul-de-sac. Il doit exister
   **avant** que la première vraie migration parte, pas après.
4. **`expo-updates` et `runtimeVersion`**, avec la règle dans `EAS.md`.
5. **L'en-tête côté app, et le bandeau.**
6. **L'`ErrorBoundary` de la feuille.**

Les étapes 1 à 3 sont le cœur ; 4 à 6 sont autonomes et peuvent glisser d'un
week-end sans rien bloquer.

**Et un premier palier qui ne change rien, c'est voulu** : on veut éprouver
l'échelle sur un cas où l'on ne risque rien, pas le jour où elle porte la
colonne dont dépend la spec 0001.
