# 0004 — Journal

*Ce qui a divergé du plan, écrit pendant. Ce qu'un commit fait se lit dans son
diff ; ce qu'il a ÉCARTÉ ne se lit nulle part ailleurs qu'ici.*

---

## 11 septembre — `trop-vieux` est inatteignable, et il fallait s'en apercevoir

**Phase 1, à la vérification de T2.** Les quatre `curl` rendent :

```
en-tête 999      → trop-recent
en-tête 0        → ok          ← la tâche T22 attendait « trop-vieux »
en-tête absent   → ok
en-tête abc      → ok
```

`taches.md` T22 posait `["0", "trop-vieux"]` comme cas de test. **C'est la
tâche qui avait tort, pas le code.** `verdictProtocole` traite `0` par la
branche « illisible » (`!Number.isInteger(n) || n < 1`), et il a raison : une
version de protocole commence à 1, donc `0` n'est pas *une vieille app*, c'est
une valeur qui n'a pas de sens. Une app légitimement ancienne envoie soit
**rien** (l'état des quinze téléphones d'aujourd'hui), soit un entier valide
plus petit que `MINIMUM`.

**Et ça révèle mieux que ça ne corrige.** Tant que
`PROTOCOLE_MINIMUM === PROTOCOLE_COURANT === 1`, **aucune valeur ne peut rendre
`trop-vieux`** : il faudrait un entier `≥ 1` et `< 1`. La branche existe, elle
est juste, et elle est structurellement morte jusqu'au jour où `MINIMUM`
montera à 2.

Trois façons de traiter ça, et j'ai choisi la troisième :

1. *Faire rendre `trop-vieux` à `0`* — ce serait mentir sur ce qu'est une
   vieille app, pour le confort d'un test.
2. *Installer `vitest` sur le site pour tester la fonction pure* — le plan
   l'avait exclu (« ce lot ne touche au site que pour lire un en-tête »), et
   l'installer pour une branche morte serait le mauvais moment.
3. **Le dire.** T22 vérifie les trois verdicts atteignables (`trop-recent`,
   `ok` valide, `ok` illisible, `ok` absent) et porte en commentaire la ligne
   qu'il faudra ajouter le jour où `MINIMUM` monte. C'est ce jour-là que la
   quatrième vaudra quelque chose.

**Ce que ça coûte, et je l'assume :** une branche de `verdictProtocole` part en
production sans qu'aucune commande ne l'ait exercée. C'est un écart à
l'article VIII, écrit ici plutôt que découvert plus tard — et il se referme
tout seul à la première montée de `MINIMUM`, qui est précisément le moment où
cette branche cesse d'être décorative.

---

## 11 septembre — le test d'interruption passait pour de mauvaises raisons

**Phase 2, T11.** Première version du décorateur `quiEchoue` : il enveloppait la
base et remplaçait `script()` par une version qui lève au n-ième appel. Le test
échouait — `appliquerPaliers` ne rejetait pas.

**Et c'est le test qui avait tort**, pour une raison que `base.ts` documente
depuis le début : *« le rappel reçoit la base à utiliser — sur expo-sqlite c'est
un objet DISTINCT, et écrire par-dessus l'ancien sortirait silencieusement de la
transaction »*. Mon décorateur passait `fn` à la vraie `transaction()`, qui
appelait le rappel avec la **vraie** base : le `script` qui devait échouer
n'était jamais celui exécuté dans la transaction.

Corrigé en réappliquant l'enveloppe à la base que `transaction()` rend, avec un
compteur **partagé** entre les deux.

**Ce que ça vaut la peine de noter :** si je n'avais pas écrit la contre-épreuve
(T10), ce test serait parti vert en croyant couvrir quelque chose. Il n'aurait
rien coupé du tout. C'est exactement le défaut que l'article VIII vise, attrapé
par le geste que la spec exigeait.

## 11 septembre — la contre-épreuve, faite

**T10.** Migration du palier 1 vidée à la main, `db/paliers.ts` régénéré :
**trois tests tombent** sur les neuf (la convergence, la version, et l'égalité
octet pour octet des paliers). Restauré, régénéré, `git diff` vide, neuf tests
verts à nouveau.

L'échelle est donc vérifiée par des tests qui peuvent tomber — et on l'a vu.

---

## 11 septembre — la preuve sur une vraie base, pas sur un test

**Phases 2 et 3, vérification au simulateur (article VII).**

La base du simulateur a été **créée le 9 septembre à 20 h 49** — deux jours
avant ce lot, par une version de l'app qui ne connaissait aucune version de
schéma. Après une seule ouverture par le nouveau code :

```
PRAGMA user_version → 1
clubs 1 · roster 10 · matches 2 · events 0 · outbox 0
```

Une base d'avant, migrée sur place, sans rien perdre. C'est `TRANS-39`
démontré sur un vrai fichier, pas sur un `:memory:`.

**Puis le cas de la rétrogradation**, en posant `PRAGMA user_version = 99` à la
main sur ce même fichier : l'app affiche

> **Cette version de l'app est trop ancienne**
> Les données de ce téléphone ont été écrites par une version plus récente.
> Rien n'a été touché : installe la dernière version de l'app pour les
> retrouver.
> *La base du téléphone est en version 99, cette app ne connaît que la 1.*

En français, sans bouton « Réessayer » — il ne réparerait rien, c'est le
binaire qui est en retard — et le message technique rangé en petit dessous.
Version remise à 1 : l'app repart sur ses deux clubs, 10 joueurs et 2 matchs
intacts.

**Ce que ça vaut :** les tests de la phase 2 prouvaient le mécanisme sur des
bases fabriquées. Celle-ci avait deux jours de vraie saisie dedans.

---

## 11 septembre — l'`ErrorBoundary` n'attrape PAS ce que la spec 0000 décrivait

**Phase 6.** L'`ErrorBoundary` est posé sur la feuille et il marche : vérifié en
injectant un `throw` dans le rendu de `app/match/[id].tsx`, puis en lisant le
fichier qu'il a écrit sur le simulateur —

```
quand   : 2026-09-11T09:00:29.936Z
où      : la feuille de match
message : plantage simulé — vérification de l'ErrorBoundary
```

Le rapport est sur le téléphone, avec le bon écran, le message et la pile
coupée. (La capture d'écran, elle, n'a pas été possible : en mode développement
la LogBox rouge d'Expo se superpose à l'`ErrorBoundary` et ne se ferme pas. Le
fichier écrit est une meilleure preuve qu'une image — il prouve que le composant
s'est **monté**, pas seulement qu'il existe.)

**Mais il faut dire ce qu'il ne couvre PAS**, et c'est important pour la suite :

Un `ErrorBoundary` React attrape les plantages **de rendu**. Il n'attrape **pas**
le rejet d'une fonction asynchrone. Or `marquer`, `contreSonCamp`,
`donnerCarton` et `terminer` (`five-scorer-mobile/app/match/[id].tsx`) sont
asynchrones et **sans `try/catch`** — c'est ce que la garde `/analyser` avait
relevé sur la spec 0001. Un but refusé par la couche locale ne déclenchera donc
**pas** cet écran : le son partira, la vibration aussi, et rien ne s'écrira.

`TRANS-40` est donc **partiellement** refermé par ce lot, pas entièrement. Le
reste — envelopper les quatre gestes de saisie — appartient au lot de la feuille
(spec 0001), où `/analyser` l'a déjà inscrit. C'est écrit ici plutôt que coché à
tort (constitution, article X).

## 11 septembre — ce que la phase 4 ne peut pas prouver toute seule

`expo-updates` est installé et configuré, et `npx expo config` rend bien
`runtimeVersion: 1` et l'URL d'`updates`. Mais **le critère « un correctif
JavaScript poussé le dimanche soir est sur les quinze téléphones » ne peut pas
être vérifié depuis ce Mac** : il demande un build EAS signé, distribué, puis un
`eas update` réel.

Ce n'est pas un oubli, c'est la nature du critère — la spec le rangeait déjà
parmi « ce qu'aucune commande ne peut vérifier ». Il se constatera le jour du
prochain build, et c'est à ce moment-là qu'il faudra le cocher.

---

## 11 septembre, le soir — la seconde passe `/analyser`, et ce qu'elle a démonté

*Ibrahima a demandé « tu respectes toujours le SDD ? ». Non : `/analyser`
n'avait tourné qu'une fois, alors que la méthode en demande deux — « avant la
première ligne de code, **puis avant de livrer** ». La seconde passe, lancée
après coup sur le code livré, a trouvé six défauts. Voici ceux qui corrigent ce
journal lui-même.*

### Le test de convergence ne peut PAS tomber aujourd'hui

Je l'ai présenté comme « le plus important du lot », et le plan le désignait
comme la preuve de l'invariant « deux chemins, un seul schéma ».

**Il compare le même DDL à lui-même.** `db/paliers/001-schema.sql` est une copie
littérale de `db/schema.sql` — `diff` rend le vide — et `sqlite_master` ne porte
pas `user_version`. Les deux bases qu'il compare sont donc bâties du même texte.

Ce n'est pas inutile : c'est le garde-fou qui parlera au **premier palier non
trivial**, celui qui renommera ou reconstruira une table. Mais présenté comme
une preuve déjà acquise, c'était faux. **C'est un filet tendu pour plus tard,
pas un résultat d'aujourd'hui.**

### Ma description de la contre-épreuve était fausse sur deux noms

J'avais écrit que trois tests tombaient : « la convergence, la version, et
l'égalité octet pour octet des paliers ». Rejoué : trois tombent bien, mais ce
sont *« …et la même version »*, *« rejouer l'ouverture ne remonte rien »* et
*« laisse la base sur le palier précédent »*. **La convergence et l'égalité
octet pour octet passent** — pour la raison ci-dessus. Le compte était juste par
coïncidence.

### Le test d'interruption était faux une SECONDE fois

Je m'étais félicité de l'avoir corrigé. La correction avait déplacé le défaut,
pas supprimé : mon décorateur levait **avant** de déléguer, et
`appliquerPaliers` exécute un palier entier en **un seul** `script()`. La
coupure tombait donc avant que rien ne s'exécute — **le test passait à
l'identique sans aucune transaction.**

Réécrit avec un palier dont la **seconde instruction est invalide**, plus une
contre-épreuve qui montre que sans transaction, la table créée par la première
**reste**. Vérifié en retirant `base.transaction` : le test tombe.

*La leçon, et elle vaut pour la méthode : un test qu'on n'a pas vu échouer ne
prouve rien — et l'avoir vu échouer UNE fois ne suffit pas si on a changé le
test depuis.*

### Ce que j'avais marqué `fait` à tort dans la base

`TRANS-38`, une heure après l'avoir coché — en réparant justement le manquement
à la méthode. `lib/appel.ts` posait bien l'en-tête, mais **le drain de l'outbox
a son propre `fetch`** et ne passait pas par là. Or c'est par le drain que
passent les huit écritures : le seul chemin que ce cas décrit vraiment.

Et `scripts/verif-version.mjs` ne pouvait pas le voir : il envoie des littéraux
avec un `fetch` nu, sans jamais importer l'app. **Il éprouvait le serveur, et
seulement lui.** Cinq tests ajoutés qui touchent vraiment l'app.

### Ce qui reste ouvert, et que je n'ai pas corrigé

- **L'ordre « schéma cible d'abord, échelle ensuite »** (`lib/outbox/base.ts`)
  casse dès qu'un palier renomme une table : le schéma cible la recrée vide
  avant que le palier n'ait renommé l'ancienne, et l'`ALTER TABLE … RENAME TO`
  tombe. Rien ne casse aujourd'hui (un palier, un `PRAGMA`), mais **le premier
  palier non trivial le découvrira**. À trancher avant la spec 0002.
- **Le bandeau n'a jamais été vu à l'écran** — ni test, ni simulateur — et son
  message principal (`trop-vieux`) reste inatteignable tant que
  `PROTOCOLE_MINIMUM` vaut 1.
- **`lirePlantages` n'est branchée à aucun écran** (assumé dans `taches.md`,
  mais absent du plan § 7).
- **`expo-updates` n'est importé nulle part** : le comportement est celui par
  défaut — sonde au lancement, application au démarrage **suivant**. Le critère
  « un correctif du dimanche soir est sur les quinze téléphones » signifie donc,
  tel que câblé, « au deuxième lancement, et seulement avec du réseau ».
