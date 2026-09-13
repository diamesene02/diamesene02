# Plan — corriger un match

*Écrit le 11 septembre 2026, après un relevé de six versants (site, app,
contrat serveur, données dérivées, hors-ligne, cas de la base) : 214 constats,
chacun avec sa citation rouverte par un second lecteur. Cinq chiffres faux ont
été attrapés à cette relecture — c'est écrit au journal.*

---

## Ce que le relevé a renversé

**La spec dit : « un match terminé ne peut plus être corrigé nulle part ». C'est
faux dans les deux sens, et c'est la découverte du lot.**

**Le serveur permet déjà la correction.** Sept gardes « match terminé → réservé
aux admins » existent et sont écrites avec soin — deux de plus que les trois que
la spec citait :

```
app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68, :161, :224
app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:45, :127
app/api/clubs/[clubId]/matches/[matchId]/route.ts:146
app/api/clubs/[clubId]/matches/route.ts:255
```

Une seule d'entre elles dit « non » ; les six autres disent « oui, si tu es
admin ». **Aucune interface ne les atteint.** Le serveur attend depuis des mois
un écran qui n'a jamais été écrit.

**Et l'app écrit déjà dans un match terminé — par quatre portes non gardées.**
`five-scorer-mobile/lib/match/local.ts` porte sept chemins d'écriture. Trois
vérifient le statut (`addEvent:411`, `movePlayerTeam:585`, et `:626`). Quatre ne
le vérifient pas :

| porte | ligne | garde |
|---|---|---|
| `removeEvent` | `lib/match/local.ts:474` | **aucune** |
| `setEventAssist` | `:513` | **aucune** |
| `setEventScorer` | `:545` | **aucune** |
| `undoLastGoalOf` | `:799` | **aucune** (elle délègue à `removeEvent`) |

Elles ne sont pas atteignables parce que l'écran de la feuille se ferme pour un
match terminé — **pas** parce qu'une règle l'interdit. C'est l'article III mot
pour mot : *une règle tenue par l'affichage n'est pas une règle.*

**La base du produit énonce cette règle comme un fait, et c'est un mensonge.**
`specs/0000-le-club-et-lapp/regles.md:438` écrit : *« la feuille locale refuse
**toute** écriture dans un match FINISHED »*, en citant trois lignes. Il y a
sept portes, trois gardées. Le mot « toute » est faux et doit tomber.

*Attention au piège : `grep -c status` sur `setEventScorer` rend 1. Cette
occurrence appartient à `movePlayerTeam`, la fonction SUIVANTE. Un compte de
grep n'est une preuve ni dans un sens ni dans l'autre — il a fallu lire.*

**Ce que ça change pour le lot :** ce n'est pas « construire la correction ».
C'est **brancher une interface sur un serveur qui l'autorise déjà, et fermer
quatre portes qui n'auraient jamais dû être ouvertes.** Le lot rétrécit et se
précise.

---

## La bonne nouvelle, qui supprime la moitié redoutée

**Aucun agrégat n'est stocké.** Le relevé a lu les 483 lignes de
`prisma/schema.prisma`, ses 18 modèles, champ par champ : pas de table de
classement, pas de compteur de buts sur `Player`, pas de total sur `Season` ni
sur `MatchDay`. Le classement, les records, le palmarès et les fiches joueur se
calculent à la lecture.

**Et il n'y a aucun cache.** Pas un `unstable_cache`, pas un `revalidateTag`,
pas un `export const revalidate`, pas un `next: { revalidate }`. Les trois seuls
en-têtes de cache du dépôt sont `no-store` sur l'export CSV, `max-age=3600` sur
le flux iCal (qui ne porte aucun score) et un `access-control-max-age`, qui est
du CORS et pas du cache.

Les seules valeurs dérivées persistées sont `Match.scoreA`, `Match.scoreB` et
`Match.mvpId` — et le schéma dit lui-même à quoi s'en tenir
(`prisma/schema.prisma:371`) : *« Scores dénormalisés — recalculés depuis les
events à chaque mutation. »* `recomputeScore` tient cette promesse
(`app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30`).

**Conséquence : une correction se propage toute seule.** Il n'y a ni rattrapage
à écrire, ni cache à invalider, ni recalcul à déclencher. C'est la moitié du lot
qu'on croyait devoir faire et qu'on ne fera pas.

---

## Le contrat serveur

**Rien de neuf n'est nécessaire pour corriger buts et passes.** Les routes
existent, gardées, et acceptent un admin sur un match terminé :

| geste | route | corps |
|---|---|---|
| ajouter un but | `POST …/matches/[matchId]/events` | `{ type, team, playerId, minute }` |
| retirer un événement | `DELETE …/events?eventId=` | — |
| changer la passe | `PATCH …/events` | `{ eventId, assistPlayerId }` |
| changer le buteur d'un csc | `PATCH …/events` | `{ eventId, scorerPlayerId }` |
| recomposer | `POST …/matches/[matchId]/lineup` | — |
| à-côtés (6 champs) | action serveur `updateMatchDetails` | — |

**Deux manques réels, et ils sont petits :**

1. **Le buteur d'un but NORMAL n'est pas modifiable.** Le `PatchBody` des
   événements n'a que trois champs — `eventId`, `assistPlayerId`,
   `scorerPlayerId` — et `scorerPlayerId` n'est lu que pour un `OWN_GOAL`
   (`local.ts:555` refuse tout autre type). Un but crédité au mauvais joueur se
   corrige donc aujourd'hui en deux gestes : retirer, ré-ajouter. **Le plan
   garde ces deux gestes** plutôt que d'élargir le PATCH : retirer puis
   ré-ajouter passe par `recomputeScore` et laisse la chronologie juste, alors
   qu'un changement de buteur en place devrait rejouer le score à la main.
   C'est un écart assumé, écrit plus bas.

2. **La minute d'un événement existant ne se modifie nulle part** (`APRES-52`).
   Même arbitrage, même raison.

**Un manque qui n'est pas petit : `matchDayId` ne s'écrit qu'à la création.**
Ni `EditMatchInput` (`app/actions/matches.ts:28-35`, six champs), ni les deux
`PatchBody` du serveur ne le portent. Rattacher un match à sa soirée après coup
est donc impossible — c'est `APRES-15` et `APRES-D3`, que la spec ne cite pas.
**Le plan l'ajoute** : un septième champ à `EditMatchInput`. C'est une ligne de
schéma qui ne bouge pas, un champ de formulaire, et ça referme deux cas.

**L'idempotence est un piège à connaître.** Il n'y a aucune clé d'idempotence
transportée — ni en-tête, ni champ. La seule idempotence est l'identifiant
fourni par le client, **et elle est implémentée différemment dans chacune des
cinq routes d'écriture.** Le lot n'y touche pas, mais rien de ce qu'il écrit ne
doit supposer qu'un rejeu est sans effet.

---

## L'écran — le site

**Le point d'accroche existe et il est unique** :
`app/c/[slug]/matches/[id]/page.tsx:361-368`. Pour un admin, sur un match
terminé, deux choses seulement : un lien « Corriger » vers `/edit`, et
« Supprimer ».

**Le cul-de-sac à réparer d'abord.** Le pied du formulaire d'édition
(`EditMatchForm.tsx:180-182`) dit : *« Pour corriger les buts, ouvre le match et
utilise la timeline. »* Cette phrase envoie vers une porte fermée :
`LiveMatch.tsx:568` rend `null` dès que le match est terminé. **Cette phrase est
le lot en une ligne** — l'intention était juste, le chemin n'a jamais été
ouvert.

**Contrainte dure du relevé : la correction NE PEUT PAS réutiliser
`LiveMatch`.** Cet écran ne lit que le miroir local du navigateur
(`LiveMatch.tsx:100`, `useLiveQuery(() => getLocalMatch(matchId))`), et **rien
sur le site ne redescend un match du serveur vers ce miroir** — il n'est rempli
qu'à la création et au lancement d'un match programmé. Un admin qui corrige
depuis un autre navigateur que celui qui a saisi verrait « Match introuvable »
(`LiveMatch.tsx:550-562`).

**Donc :** un écran de correction neuf, rendu par le serveur, qui appelle les
routes d'API directement — pas de Dexie, pas de file d'attente. Il vit à
`/c/[slug]/matches/[id]/corriger`, en regard de `/edit` qui garde les à-côtés.

**Deux dettes d'article V à payer au passage**, les deux relevées et les deux à
une ligne :

- Le membre non-admin ne voit **rien** : la condition de `page.tsx:361` n'a
  aucune branche `else`. Ni bouton grisé, ni phrase. C'est `APRES-12`. Une
  phrase suffit : « Seul un administrateur peut corriger un match terminé. »
- Les deux gestes destructeurs du récap demandent « Sûr ? »
  (`DeleteMatchButton.tsx:28`). Une confirmation doit **dire ce qui va se
  passer**, pas demander si on est sûr.

---

## L'écran — l'app

**Rien à retirer : la suppression d'un match n'existe déjà pas dans l'app** (ni
bouton, ni route `DELETE` appelée). Le critère d'acceptation qui demandait de
l'en retirer est **déjà satisfait** — il faut le dire, pas le faire.

**Ce qu'il y a à faire est l'inverse de ce que la spec imaginait : fermer.** Les
quatre portes non gardées prennent la même garde que leurs trois sœurs. Ce n'est
pas de la prudence théorique : ces fonctions sont exportées par `creerLocal` et
un écran de correction mobile, écrit plus tard sans y penser, écrirait dans un
match terminé sans qu'aucune règle ne s'y oppose.

**La correction depuis le téléphone n'est PAS dans ce lot** — voir l'écart
assumé sur l'hors-ligne, qui en donne la raison.

---

## L'hors-ligne : l'écart assumé le plus lourd

**Il n'existe aucun arbitrage de conflit dans ce dépôt.** Le relevé a cherché
par six biais — `If-Match`, ETag, `precondition`, 412, 409, comparaison
d'`updatedAt` : rien. Deux téléphones qui corrigent le même match hors ligne
puis se reconnectent produisent un **dernier-arrivé-gagne silencieux**,
opération par opération.

S'y ajoute que **`Match.updatedAt` existe et n'est lu par aucun fichier** de
`app/`, `lib/` ou `components/` — le seul marqueur disponible pour arbitrer
dort inutilisé. Et qu'**aucune des huit opérations de la file d'attente ne sait
porter une correction** : les huit sont des gestes du direct.

### La décision : la correction demande du réseau

**Une correction ne se met pas dans la file d'attente. Elle se fait en ligne ou
elle ne se fait pas.**

Pourquoi c'est le bon échange, et pas un renoncement :

- **Le direct doit marcher hors ligne, la correction non.** Au gymnase, sans
  réseau, un but qui n'entre pas est une soirée perdue. Une correction, elle, se
  fait le lendemain, au calme, chez soi. Ce ne sont pas les mêmes contraintes et
  les confondre coûterait un arbitrage de conflit complet pour un besoin qui ne
  l'exige pas.
- **Mettre une correction dans la file sans arbitrage serait pire que de la
  refuser** : deux corrections concurrentes divergeraient en silence, et
  l'article IV (les nombres doivent être vrais) tomberait sans que personne ne
  le voie.
- **Le refus se dit, avec sa suite** (article V) : *« Corriger un match demande
  du réseau. Tu es hors ligne — réessaie quand tu en auras. »* Rien n'est perdu,
  rien n'est mis en attente à l'insu de qui a tapé.

C'est écrit ici pour que la question ne se repose pas, et pour que le jour où on
voudra la correction hors ligne, on sache que le préalable est un arbitrage de
conflit — pas un écran.

---

## Les écarts assumés

1. **Pas de correction depuis le téléphone dans ce lot.** Raison ci-dessus.
2. **Le buteur d'un but normal et la minute d'un but se corrigent en deux
   gestes** (retirer, ré-ajouter), pas en place. Ça passe par `recomputeScore`
   et garde la chronologie honnête.
3. **Aucune trace d'auteur de correction.** `Match` n'a aucune relation vers
   `User` et aucun champ de correction. Le plan **lit** `updatedAt` (gratuit, il
   existe) pour afficher « corrigé le … », et **n'ajoute pas** de journal
   d'audit : ce serait une migration et un modèle de plus, pour un club de
   quinze personnes qui se parlent. À rouvrir le jour où un club ne se parle
   plus.
4. **Aucune réparation des données déjà fausses.** Le lot ferme les portes ; il
   ne répare pas les `mvpId` et les buts déjà crédités hors feuille (`APRES-29`,
   `CONFLIT-01`, `HL-06`). Il faut le dire, sinon on croira le contraire.
5. **`CANCELED` n'est pas traité.** `Match` n'a ni `canceledAt` ni
   `cancelReason` (seul `MatchDay` les porte), aucune fonction ne rétablit un
   match annulé, et `/r/[id]` renvoie 404 pour tout ce qui n'est pas `FINISHED`.
   L'annulation d'un match terminé est un lot à elle seule.

   *Rattrapé en partie depuis — daté, pas réécrit : la spec 0006 (13 septembre
   2026) a donné à `Match` `canceledAt`/`cancelReason` et la logique
   annuler-ou-supprimer ; le même jour, le correctif qui a suivi 0006 a élargi
   les six gardes serveur (`matchVerrouille`, `lib/matches.ts`) pour qu'un
   `CANCELED` soit aussi figé, pas seulement un `FINISHED` — le trou que ce
   point décrivait comme un risque **a existé réellement**, quelques heures,
   avant d'être refermé. Ce qui reste ouvert et que ce lot doit encore
   fermer : aucune fonction ne rétablit un match annulé (`taches.md`), les
   couches locales (site ET app) ne couvrent encore que `FINISHED`, et
   `APRES-27` (une file rejouée sur un match annulé doit échouer
   DIAGNOSTIQUEMENT sans bloquer toute la chaîne) n'est pas tranché — voir
   `taches.md`.*
6. **Aucun garde de saison clôturée.** Le formulaire laisse choisir une saison
   fermée, avec « (active) » sur l'autre pour tout signal. Hors lot, mais relevé.

---

## Ce que ça coûte en vérifiabilité — et la dette à payer

**Le site n'a AUCUN test.** Pas de vitest en dépendances, pas de script `test`,
pas un seul fichier `*.test.ts`. Vérifié en lisant `package.json` en entier et
par un `find` sur tout le projet.

C'est intenable pour un lot qui ouvre un chemin d'écriture sur des matchs
terminés — article VIII : *ce qui est écrit doit être vérifiable.* **Le plan
installe vitest dans `five-scorer/`** et couvre les règles pures que le lot
touche. Pas un harnais complet : les fonctions de décision, et elles seules.

Côté app, le bloc de tests « aucune écriture dans un match terminé » n'en éprouve
que trois portes sur sept. **Les quatre manquantes gagnent leur test**, avec
contre-épreuve : la garde retirée, le test tombe.

---

## Les cas — ce que le lot ferme vraiment

Le critique de complétude a trouvé que **quatre cas que la spec ferme
littéralement n'y sont même pas cités** : `APRES-09`, `APRES-10`, `APRES-07` et
`FIN-03`. Ils décrivent mot pour mot les fonctionnalités n°1 et n°2 et le bouton
mort. À ajouter à la liste.

**Pris en plus par ce plan :** `APRES-15` et `APRES-D3` (rattachement à la
soirée), `APRES-12` (le membre qui ne voit rien), `APRES-21` (longueur d'un nom
d'équipe — `updateMatchDetails` n'a aucun `slice`, alors que `scheduleMatch`
coupe à 40 : la longueur doit se poser au même endroit, sinon elle se posera
trois fois).

**Explicitement hors lot :** `APRES-52` (minute), `APRES-30` (édition
concurrente — c'est l'arbitrage de conflit), `APRES-50`, `APRES-51`.

**Et la base se corrige :** `regles.md:438` perd le mot « toute » et gagne le
compte juste (sept portes, trois gardées → sept gardées à la fin du lot).
`regles.md:446` — *« un match terminé ne se rouvre jamais »* — reste vrai : ce
lot corrige sans rouvrir, le statut ne repasse jamais à `LIVE`.

---

## L'ordre

1. **Fermer les quatre portes de l'app** + leurs tests avec contre-épreuve.
   Indépendant de tout le reste, et c'est le vrai défaut.
2. **Corriger `regles.md:438`** — la base ment, et elle sert de référence.
3. **Installer vitest côté site**, sur les règles du lot.
4. **La phrase du membre non-admin** et les deux confirmations qui disent ce
   qu'elles font. Trois lignes, article V.
5. **`matchDayId` dans `EditMatchInput`** + le champ, + la longueur de nom au
   même endroit que `scheduleMatch`.
6. **L'écran `/corriger`**, rendu serveur, branché sur les routes existantes.
   C'est le gros morceau, et il arrive en dernier parce que tout ce qui précède
   le rend sûr.
7. **Supprimer la phrase du cul-de-sac** de `EditMatchForm.tsx:180-182`, ou la
   faire pointer vers `/corriger` — selon ce que l'écran rend.

Chaque étape a sa vérification dans `taches.md`, et aucune ne se signe sans
avoir été vue à l'écran (article VII).
