# Tâches — corriger un match

*Écrit le 13 septembre 2026, après `spec.md` (10 septembre, révisée) et
`plan.md` (11 septembre), puis passé à la garde `/analyser`. Entre le plan et
aujourd'hui, la spec 0006 a livré l'annulation (`Match.canceledAt`/
`cancelReason`, annuler-ou-supprimer) et un correctif du même jour a fermé
les six gardes serveur pour qu'un `CANCELED` soit aussi figé
(`lib/matches.ts:matchVerrouille`). Ce que ça change ici : l'écart n°5 du
plan (« `CANCELED` n'est pas traité ») est rattrapé pour le serveur, pas pour
le reste — voir la tâche 1 et la tâche 9. Chaque tâche ci-dessous porte sa
vérification par une commande, telle que la constitution l'exige
(article VIII). Aucune tâche ne se signe sans avoir tourné.

*`/analyser` a trouvé deux tâches absentes de toute version antérieure de ce
document — `APRES-04` (tâche 10) et `APRES-07`/`FIN-03` (tâche 13) — et a
confirmé que quatre cas que `plan.md` avait déjà signalés comme manquants à
la liste de `spec.md` (`APRES-09`, `APRES-10`, `APRES-07`, `FIN-03`) le sont
toujours trois jours plus tard. `spec.md` et `cas.md` portent chacun leur
correction datée du 13 septembre.*

---

## 1. Fermer toutes les portes d'écriture locales — mobile ET site

**Pourquoi en premier :** indépendant de tout le reste, et c'est le vrai
défaut du produit aujourd'hui — pas une fonctionnalité manquante, une règle
absente. `spec.md` le dit sans détour : « retirer un but sur un match
terminé est **déjà** possible en local. »

**Ce qui existe :**
- Mobile (`five-scorer-mobile/lib/match/local.ts`) : 3 portes sur 7 gardées
  (`addEvent:411`, `movePlayerTeam:585`, `:626`). 4 non gardées :
  `removeEvent:474`, `setEventAssist:513`, `setEventScorer:545`,
  `undoLastGoalOf:799`.
- Site (`five-scorer/lib/localMatch.ts`) : mêmes 3 portes gardées
  (`addEvent:324`, une pose de joueur `:548`, un changement d'équipe `:496`),
  mêmes fonctions sœurs à vérifier une par une pour les 4 manquantes.
- **Les 3 portes déjà gardées, des deux côtés, ne testent que `FINISHED`** —
  pas `CANCELED`. Depuis 0006, un `CANCELED` a du contenu à perdre ; ces 3
  portes doivent donc, elles aussi, être élargies.

**Précision après `/analyser` :** `five-scorer-mobile/lib/noyau/` existe déjà
et c'est EXACTEMENT le mécanisme pour ce genre de règle — six fichiers purs
(`clock.ts`, `ids.ts`, `theme.ts`, `color.ts`, `balance.ts`, `retro.ts`),
copies octet pour octet de `five-scorer/lib/`, surveillées par
`lib/noyau/copie-conforme.test.ts` (article III). On ne peut PAS y copier
`five-scorer/lib/matches.ts` tel quel : il importe `prisma`, qui n'a rien à
faire dans un bundle React Native. `matchVerrouille` doit d'abord être
extraite dans son propre fichier pur (ex. `lib/matchStatus.ts`, sans import
Prisma), pour pouvoir rejoindre `lib/noyau/`.

**Ce qu'on fait :**
1. Extraire `matchVerrouille` de `lib/matches.ts` vers un fichier pur neuf,
   `five-scorer/lib/matchStatus.ts` (aucun import Prisma) ; `lib/matches.ts`
   l'importe de là. Copier ce fichier vers
   `five-scorer-mobile/lib/noyau/matchStatus.ts` et l'ajouter au tableau
   `FICHIERS` de `copie-conforme.test.ts` — la règle vit maintenant à
   UN endroit, testée par la copie conforme (article III), pas « par projet ».
2. Appliquer cette garde (importée du noyau) aux 4 portes non gardées ET aux
   3 déjà gardées côté mobile (élargissement `FINISHED` → `FINISHED |
   CANCELED`).
3. Côté site, `lib/localMatch.ts` ne peut pas importer le noyau mobile (sens
   inverse à la copie conforme) : il importe `matchStatus.ts` directement,
   qui est SA source de vérité. Même élargissement sur les 7 portes.
4. Écrire le test avec contre-épreuve pour chacune des 7 portes × 2 projets :
   le test échoue si la garde est retirée à la main.

**Vérification :**
```bash
# Mobile : les 7 portes lèvent sur FINISHED et sur CANCELED, aucune garde
# n'a été oubliée. La contre-épreuve tourne dans le même run.
cd five-scorer-mobile && npx vitest run lib/match/local.test.ts

# Site : même exigence, même contre-épreuve.
cd five-scorer && npx vitest run lib/localMatch.test.ts

# Aucune porte n'a été oubliée dans le grep — 7 occurrences des deux côtés.
grep -c "matchVerrouille\|matchEstFige\|matchGeleAuxEcritures" five-scorer/lib/localMatch.ts
grep -c "matchVerrouille\|matchEstFige\|matchGeleAuxEcritures" five-scorer-mobile/lib/match/local.ts
```

---

## 2. Corriger `specs/0000-le-club-et-lapp/regles.md:438`

La base du produit énonce comme un fait : *« la feuille locale refuse
**toute** écriture dans un match FINISHED »*. Faux avant la tâche 1 (3
portes sur 7), et le mot « toute » resterait faux même après si on ne
compte que `FINISHED` — il faut aussi dire `CANCELED`.

**Ce qu'on fait :** réécrire la ligne pour qu'elle cite le compte juste
(7 portes gardées sur 7, `FINISHED` et `CANCELED`) une fois la tâche 1
livrée — pas avant, sinon c'est encore un mensonge daté d'aujourd'hui.

**Vérification :**
```bash
grep -n "toute écriture" specs/0000-le-club-et-lapp/regles.md
# La ligne doit citer FINISHED et CANCELED, et ne plus dire "toute" tant
# que la tâche 1 n'est pas livrée sur les deux projets.
```

---

## 3. Installer vitest côté site, sur les règles pures du lot

Le site n'a aucun test. Un lot qui ouvre un chemin d'écriture sur des
matchs terminés ET annulés ne peut pas se livrer sans preuve rejouable
(article VIII).

**Ce qu'on fait :**
1. `npm install -D vitest` dans `five-scorer/`, script `"test": "vitest run"`.
2. Couvrir au minimum : `matchVerrouille` (les 4 statuts, `FINISHED` et
   `CANCELED` verrouillent, `SCHEDULED` et `LIVE` non — c'est le correctif
   d'aujourd'hui qui gagne enfin son test), `annulerOuSupprimerMatch`
   (contenu → annule, rien → supprime), et le refus d'un buteur/passeur/MVP
   hors feuille une fois la tâche 4 livrée.

**Vérification :**
```bash
cd five-scorer && cat package.json | grep '"test"'
npx vitest run
# Contre-épreuve manuelle : commenter la ligne CANCELED dans matchVerrouille,
# relancer — le test doit rougir.
```

---

## 4. Les trois portes qui posent un joueur vérifient la FEUILLE, pas le club

`spec.md` (Q6) : trois portes écrivent un joueur sur un match et **aucune**
ne vérifie qu'il a joué CE match, seulement qu'il est du club :
- le buteur et le passeur — `events/route.ts:106` (`prisma.player.count({
  where: { id: { in: refs }, clubId } })`)
- l'homme du match par le formulaire — `app/actions/matches.ts:69-71`
  (`prisma.player.findFirst({ where: { id: input.mvpId, clubId } })`)
- l'homme du match par l'API — `app/api/clubs/[clubId]/matches/[matchId]/route.ts:156-162`

**Ce qu'on fait :** les trois vérifient `matchParticipant` (la feuille),
pas seulement `clubId`. Ferme `APRES-20`, `APRES-18`, `APRES-D2`.

**Ajouté après `/analyser` (`TRANS-22`) :** `updateMatchDetails`
(`app/actions/matches.ts:69-77`) valide `matchId` par `idsValides`, mais
PAS `input.mvpId` ni `input.seasonId` avant de les passer dans un `where` —
exactement le trou que `lib/ids.ts` documente lui-même (« un objet passé pour
un id filtrait toutes les fiches libres du club d'un coup »). Les deux
doivent passer par `estIdOuVide` en tête de fonction, avant toute requête.

**Vérification :**
```bash
cd five-scorer && npx vitest run lib/matches.test.ts -t "hors feuille"
npx vitest run app/actions/matches.test.ts -t "identifiant invalide"
# Manuel : POST un but avec playerId d'un joueur du club mais absent de la
# feuille de CE match → 400, pas 200.
```

---

## 5. La désignation MVP à la main ferme le vote

`spec.md` (Q6) : `app/actions/matches.ts` écrit `mvpId` sans regarder
`motmMode`, puis `app/actions/motm.ts:voteMotm` recompte à chaque voix et
l'écrase en silence — c'est l'inverse de ce qu'on veut. Ferme `APRES-17`
(cas.md : « l'admin le pose dans un club qui vote »).

**Ce qu'on fait :**
1. `updateMatchDetails` : quand `mvpId` est posé à la main, marquer le vote
   fermé (nouveau champ — voir tâche 7) pour que `voteMotm` refuse d'écrire
   par-dessus.
2. `voteMotm` : refuser si le vote est fermé, avec un message qui le dit.
3. Le récap affiche « désigné par le capitaine » quand c'est le cas.

**Vérification :**
```bash
cd five-scorer && npx vitest run app/actions/motm.test.ts -t "vote fermé"
# Manuel dans le simulateur : désigner à la main, puis tenter un vote →
# refus explicite, pas un mvpId qui change en silence.
```

---

## 6. La phrase du membre non-admin + confirmations honnêtes

`spec.md` : `page.tsx:376` n'a aucune branche `else` — celui qui a saisi et
ne peut rien corriger ne voit rien (`APRES-12`).

**Ce qu'on fait :**
1. Ajouter la branche manquante : « Seul un administrateur peut corriger un
   match terminé. »
2. `CancelMatchButton.tsx:31` dit juste « Sûr ? » — dire ce qui va se
   passer, comme `DeleteMatchButton.tsx` le fait déjà depuis 0006.

**Vérification :**
```bash
grep -n "Seul un administrateur" "app/c/[slug]/matches/[id]/page.tsx"
grep -n "Sûr ?" "app/c/[slug]/matches/[id]/CancelMatchButton.tsx"
# La deuxième commande ne doit plus rien trouver après la tâche.
```

---

## 7. Migration : `matchDayId`, longueur de nom, marqueur de correction

Trois manques distincts, une seule migration :
1. **`matchDayId` ne s'écrit qu'à la création** (`APRES-15`, `APRES-D3`) —
   ni `EditMatchInput` (`app/actions/matches.ts:28-35`) ni les deux
   `PatchBody` du serveur ne le portent. Ajouter le champ aux trois.
2. **Longueur d'un nom d'équipe** (`APRES-21`) — `updateMatchDetails` n'a
   aucun `slice`, `scheduleMatch` coupe à 40. Même limite, même endroit.
3. **Le marqueur de correction** (`APRES-13`) — `Match.updatedAt` ne peut
   PAS servir (`@updatedAt` bouge à tout, y compris un vote MVP ou un rejeu
   de file hors-ligne). Ajouter `correctedAt DateTime?` et
   `correctedById String?` (FK vers `User`), posés explicitement à chaque
   correction — jamais par un trigger implicite. Le récap affiche « corrigé
   le … par … », sur l'app ET le site.
4. **Le champ « vote fermé »** pour la tâche 5 — `motmLocked Boolean
   @default(false)` sur `Match`, ou équivalent.

**Vérification :**
```bash
cd five-scorer && npx prisma migrate deploy
npx tsc --noEmit
# Le schéma porte les quatre champs :
grep -n "matchDayId\|correctedAt\|correctedById\|motmLocked" prisma/schema.prisma
```

---

## 8. La fenêtre six semaines + saison clôturée, dédupliquée

`spec.md` : deux déclencheurs DISTINCTS, pas un — passé six semaines
(`42 * 86400_000`) ET saison clôturée (`Season.isActive` faux). La fenêtre
vit aujourd'hui à deux endroits (`app/api/clubs/[clubId]/saison/route.ts:127`
et `app/c/[slug]/saison/page.tsx:114`) ; une troisième copie ici serait la
faute que l'article III interdit.

**Ce qu'on fait :**
1. Extraire la fenêtre dans un noyau partagé (`lib/dates.ts` ou équivalent),
   les deux emplacements existants l'important au lieu de la recopier.
2. `/corriger` (tâche 12) pose les deux vérifications séparément, chacune
   avec sa confirmation qui DIT ce qui va se passer.

**Vérification :**
```bash
grep -rn "42 \* 86400_000" five-scorer/app five-scorer/lib
# Une seule occurrence en dehors des deux appelants (la définition), pas
# trois.
cd five-scorer && npx vitest run lib/dates.test.ts -t "six semaines"
```

---

## 9. Rétablir un match annulé

Absent de 0006, absent du plan (écrit avant 0006). `spec.md` le demande
explicitement : « un match annulé peut être rétabli, et revient dans les
stats. » `lib/stats.ts` ne lisant que `FINISHED`, un retour à `FINISHED`
suffit à le remettre dans les chiffres — pas de recalcul à écrire.

**Ce qu'on fait :**
1. Une fonction serveur, symétrique d'`annulerOuSupprimerMatch` :
   `retablirMatch(clubId, matchId)` — refuse si le match n'est pas
   `CANCELED`, sinon repasse `status: "FINISHED"`, efface `canceledAt` et
   `cancelReason`.
2. Un bouton sur le récap d'un match `CANCELED`, visible seulement par
   `canManage` (même doctrine que Corriger/Supprimer).
3. Mobile : même geste, même route.

**Vérification :**
```bash
cd five-scorer && npx vitest run lib/matches.test.ts -t "rétablir"
# Manuel : annuler un match avec des buts, le rétablir, vérifier que
# GET .../stats redonne les mêmes chiffres qu'avant l'annulation.
```

---

## 10. `APRES-04` — la soirée continue d'étiqueter un match annulé « Terminé »

**Trouvé par `/analyser`, absent de toute version antérieure de ce
document.** `spec.md` cite `APRES-04` parmi les 23 cas fermés (groupe
« Annuler au lieu de supprimer »), mais aucune tâche ne le couvrait. Et 0006
n'a corrigé que le récap d'UN match (`page.tsx`, `RecapView.tsx`) — pas les
deux écrans qui listent une SOIRÉE entière, cités par `cas.md` lui-même :

> `app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:184-191` (l'API
> étiquette « Terminé » un match annulé dans la liste de la soirée) et
> `app/c/[slug]/sessions/[id]/page.tsx:335-343` (même défaut côté rendu).

**À vérifier avant de coder** (les citations datent du 10 septembre, à
rouvrir comme le veut `/analyser` §2) : ces lignes existent peut-être encore
sous un autre numéro depuis les mouvements de 0005/0006.

**Ce qu'on fait :** ces deux emplacements doivent lire `status` et afficher
« Annulé » au lieu de « Terminé » — même règle que 0006 a déjà posée sur le
récap d'un match seul, étendue à la vue soirée.

**Vérification :**
```bash
grep -n "Terminé\|status" "app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts" | sed -n '1,30p'
grep -n "Terminé\|status" "app/c/[slug]/sessions/[id]/page.tsx" | sed -n '1,30p'
# Manuel : annuler un match avec contenu, ouvrir la page de SA soirée (pas
# son récap direct) → la ligne dit « Annulé », jamais « Terminé ».
```

---

## 11. ~~Trancher le comportement de la file sur un match annulé~~ — tranché, sans code (`APRES-27`)

**Décidé le 13 septembre : lecture B, sans modification de code.** `spec.md`
demandait « une file rejouée sur un match annulé entre-temps échoue de façon
DIAGNOSTIQUE et ne bloque pas toute la chaîne. » Mais
`five-scorer-mobile/lib/outbox/sync.ts` bloque **délibérément** toute la
chaîne d'un match sur tout 4xx non-rejouable, quelle qu'en soit la raison —
laisser passer la suite reviendrait à exécuter `finishMatch` par-dessus un
but refusé, le rendant irrécupérable (commentaire du fichier, et son propre
test `lib/outbox/sync.test.ts` § « le refus 403 »).

L'argument qui aurait justifié une exception pour `CANCELED` (« clos pour de
bon, pas de suite légitime à protéger ») ne tient pas : la tâche 9 rétablit
un match annulé vers `FINISHED`. Un `CANCELED` n'est donc pas plus définitif
qu'un `FINISHED` ne l'était déjà, et n'a pas plus de raison d'échapper à la
même protection.

Le VRAI besoin du critère — un diagnostic honnête — est déjà satisfait
ailleurs : les tâches 1 et 4 ont mis le message serveur à jour partout
(« Match terminé ou annulé », six gardes + sept portes locales). Ouvrir un
second mécanisme dans `sync.ts` spécifique à `CANCELED` aurait ajouté du
code à maintenir pour un gain nul. `spec.md` porte la décision et sa raison,
datée (article X).

**Vérification (confirme que rien n'a besoin de changer) :**
```bash
cd five-scorer-mobile && npx vitest run lib/outbox/sync.test.ts -t "le refus 403"
grep -rln "Match terminé ou annulé" five-scorer/lib five-scorer-mobile/lib
```

---

## 12. L'écran `/corriger` — le gros morceau

`spec.md` (Q3) : sur le récap, pas un écran séparé qu'on ne trouve pas.
`plan.md` : contrainte dure — **ne peut pas réutiliser `LiveMatch`**
(miroir Dexie local, jamais rempli pour un match qu'on n'a pas soi-même
saisi). Un écran neuf, rendu par le serveur, qui appelle les routes d'API
existantes directement — pas de file d'attente, réseau exigé (Q4).

**Ce qu'on fait :**
1. `/c/[slug]/matches/[id]/corriger`, en regard de `/edit`.
2. Ajouter/retirer un but, changer passeur/buteur (deux gestes : retirer +
   ré-ajouter, écart assumé du plan), recomposer.
3. Sans réseau : message explicite, rien ne part en file (Q4).
4. Après six semaines OU saison clôturée (tâche 8) : confirmation qui dit
   ce qui va se passer avant d'écrire.
5. Chaque écriture pose `correctedAt`/`correctedById` (tâche 7).
6. Le lien depuis le récap (`page.tsx:379`) pointe ici au lieu de `/edit`
   pour les buts — `/edit` garde les à-côtés (noms, date, saison, notes).
7. **Un but ajouté après coup (Q5, aucune minute) se place en FIN de
   chronologie et se marque comme tel** — ni sa place ni son apparence ne
   doivent se confondre avec un but saisi en direct. C'est un attendu de
   `spec.md` qu'aucune tâche ne portait avant `/analyser` : le composant qui
   rend la chronologie (`RecapView.tsx`, à vérifier — pas encore lu ligne à
   ligne pour ce lot) doit trier ces événements après tous ceux qui ont une
   minute, avec une marque visuelle (icône ou libellé « ajouté après coup »).

**Vérification :**
```bash
cd five-scorer && npx tsc --noEmit && npx next build
# Simulateur + navigateur, côte à côte : ajouter un but sur un match
# terminé, score 3-2 → 4-2 sur les DEUX écrans ; GET .../stats change ;
# "corrigé le … par …" s'affiche ; le but ajouté est en fin de liste, marqué.
# Capture jointe au journal.
```

---

## 13. `APRES-07` / `FIN-03` — le bouton mort « Rouvrir le match »

**Trouvé par `/analyser` en rouvrant les citations du plan.** `plan.md`
avait déjà signalé ces deux cas comme absents à tort de la liste de
`spec.md` ; ils décrivent le MÊME défaut sous deux angles :

- `APRES-07` : « le marqueur a tapé Terminer trop tôt, veut rouvrir. »
- `FIN-03` : « attends, c'était 4-3, on veut rouvrir le match. »

Les deux pointent vers le même bouton, qui existe et ne fait rien :
`components/PlayShell.tsx:308-314` (« Rouvrir le match ») repasse en phase
« live », `LiveMatch.tsx:267-273` voit `FINISHED`, rappelle `onFinished`, et
renvoie aussitôt vers le récap — sans rien avoir rouvert. Toute écriture
serait de toute façon refusée (« Match terminé »).

**Ce qu'on fait :** une fois `/corriger` livré (tâche 12), ce bouton n'a
plus de raison d'exister sous cette forme — soit il est retiré (le lien
« Corriger » du récap, `page.tsx:379`, est déjà le bon chemin), soit il
pointe directement vers `/corriger` s'il reste utile comme raccourci depuis
l'écran de saisie en direct.

**Vérification :**
```bash
grep -n "Rouvrir le match" components/PlayShell.tsx
# Soit absent, soit un lien vers /corriger — plus un bouton qui boucle
# silencieusement sur le récap.
```

---

## 14. Rediriger la phrase du cul-de-sac

`EditMatchForm.tsx:181` : *« Pour corriger les buts, ouvre le match et
utilise la timeline »* — pointe vers `LiveMatch.tsx:568`, qui rend `null`
sur un match terminé. Une fois `/corriger` livré (tâche 12), cette phrase
devient vraie si on la fait pointer là.

**Ce qu'on fait :** remplacer par un lien vers `/corriger`.

**Vérification :**
```bash
grep -n "corriger" "app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx"
# Doit être un lien vers /corriger, pas une phrase qui n'en est pas un.
```

---

## 15. Le tour complet — la garde qui ferme le lot

**Ce qu'on fait :**
1. Étendre `five-scorer-mobile/scripts/parcours-lecture.mjs` à ce qui se
   lit après une correction (score, "corrigé le…", chronologie).
2. `tsc --noEmit` vert des deux côtés, `next build` en 0,
   `expo export --platform ios` en 0.
3. `npm run tester` vert dans `five-scorer-mobile`, `npm test` vert dans
   `five-scorer`.
4. Le tour complet (ajouter un but, le retirer, annuler, rétablir, corriger
   les à-côtés) rejoué dans le simulateur iOS, à côté de la page du site —
   capture jointe au journal (article VII). Trois passages d'affilée sans
   régression avant de dire « livré ».
5. `/analyser` une deuxième fois sur le code livré (les « deux gestes qu'on
   oublie »), puis `cas.md` recompté depuis les fichiers, daté.

**Vérification :**
```bash
cd five-scorer-mobile && node scripts/jeu-dessai.mjs && node scripts/parcours-lecture.mjs
cd five-scorer-mobile && npx tsc --noEmit && npx expo export --platform ios
cd five-scorer && npx tsc --noEmit && npx next build
cd five-scorer-mobile && npm run tester
cd five-scorer && npm test
```
