# Plan — le match du lundi appartient au lundi

*Écrit le 17 septembre 2026, après trois conceptions indépendantes soumises à
quatre jurys (constitution, gymnase, dette, vérifiabilité). Résultat :
écriture 27/40, hybride 27/40, lecture 23/40. Ce plan prend la première et lui
greffe ce que les jurys ont volé aux deux autres. Chaque `fichier:ligne` cité
ici a été rouvert.*

---

## Ce que le relevé a renversé

**Trois découvertes changent la forme du lot, et la troisième le rétrécit
beaucoup.**

**1. Le fichier qui devrait parler existe déjà, et il n'a rien à dire.**
`five-scorer/lib/soiree.ts` a été écrit le 10 septembre. Son commentaire de
tête : *« ce qu'on tape à la main dans le groupe WhatsApp le mardi matin, et
qu'on ne tape jamais »*. `motDeLaSoiree` est là, complète, depuis une semaine.
Le mot de la soirée du 14 septembre est vide non pas parce qu'il manque un
générateur, mais parce que la soirée ne contient aucun match. **Le lot ne
construit pas le mot : il lui rend son contenu.** (Conséquence pratique : ce
nom de fichier est pris, la règle ira ailleurs.)

**2. Tout ce qui a un comportement testable doit vivre dans `lib/`.**
`vitest.config.ts:15` ne ramasse que `lib/**/*.test.ts`. Une règle posée dans
`app/` — route, action serveur, page — n'est vérifiable par aucune commande,
et l'article VIII la refuserait. Ça décide de l'architecture avant toute
préférence de goût.

**3. `lib/dates.ts` est inaccessible aux tests, et ce n'est pas une opinion.**
Son premier mot est `import "server-only"` (`lib/dates.ts:1`). Vérifié par
commande, pas supposé :

```
$ node -e "import('server-only').catch(e => console.log(e.message))"
This module cannot be imported from a Client Component module.
```

Le paquet ne rend son module vide que sous la condition d'export
`react-server`, que ni Node ni Vite n'activent — et `vitest.config.ts` ne pose
aucune `resolve.conditions`. Contre-épreuve : **aucun des cinq fichiers `lib/`
couverts par un test n'importe `dates.ts`** (`matches.ts`, `matchEvents.ts`,
`motm.ts`, `localMatch.ts`, `matchStatus.ts` — vérifié un par un). Le fuseau
et la borne du jour doivent donc sortir de ce fichier pour être testables.

**Et une bonne nouvelle, qui supprime la moitié redoutée.** Les six
consommateurs de la règle sont **tous du code serveur Next**, dans le même
dépôt : les deux écritures, les deux pages de calendrier, l'accueil du site, et
la route qui sert le calendrier de l'app. Vérifié : aucun ne porte
`"use client"`. Le téléphone ne tient rien — il n'a ni table de soirées
(`five-scorer-mobile/db/schema.ts:50,68,90,119,136,159` : six tables, aucune
n'est une soirée) ni notion de fuseau. **Donc pas de noyau, pas de copie
conforme, pas de second dépôt à synchroniser.** L'article III se tient ici avec
un seul fichier et un import.

---

## Le contrat serveur

**Ce que le serveur promet : un match qui naît un jour où une seule soirée non
annulée existe porte cette soirée, sans que personne n'ait rien demandé — et il
ne la reperd jamais.**

Le produit n'a que deux écritures de match en base.

### 1. Le point de passage des deux clients

`app/api/clubs/[clubId]/matches/route.ts:204-211` fait aujourd'hui :
« la soirée demandée si elle appartient au club, sinon `null` ». Elle devient
le miroir exact du repli de saison écrit vingt-six lignes plus haut
(`:155-176`) :

| | demandé et valide | rien de demandé |
|---|---|---|
| **saison** (aujourd'hui) | elle gagne | la saison active du club |
| **soirée** (aujourd'hui) | elle gagne | `null`, définitivement |
| **soirée** (après) | elle gagne | `soireeDuJour(clubId, playedAt)` |

Le commentaire de `:155-159` — *« un match rattaché à la saison d'un autre club
disparaissait de toutes les vues saisonnières du sien — corruption silencieuse,
sans erreur ni trace »* — trouve enfin son jumeau à vingt-six lignes de là.

**Le « jamais en repassant » n'est pas une condition à écrire : c'est déjà la
forme de l'upsert.** `:235-239` monte `create: { id, ...data }` /
`update: { teamAName, teamBName }`. `data` porte `matchDayId` ; `update` ne le
porte pas. Un `createMatch` rejoué trois jours plus tard depuis la file ne
réécrit donc pas la soirée, et n'écrase pas un « Aucune — match isolé » posé
entre-temps à la main. **Aucun test « est-ce une création ? » à écrire : la
garantie est structurelle et déjà là.** C'est le point le plus élégant du lot,
et il ne coûte rien.

**Un durcissement gratuit, sur des lignes qu'on touche déjà.** Ce POST ne
valide pas `body.matchDayId` avec `estIdOuVide`, alors que les deux autres
écritures de ce champ le font (`app/actions/matches.ts:101-107`,
`app/api/clubs/[clubId]/matches/[matchId]/route.ts:157`). Un objet passé à sa
place devient un filtre Prisma dans le `where` de `:206`. Une ligne.

### 2. Les matchs programmés

`app/actions/schedule.ts:63` crée le match ; sa résolution de soirée
(`:47-55`) reçoit aujourd'hui un `matchDayId` que **le seul formulaire qui
l'appelle ne passe jamais** (`app/c/[slug]/matches/schedule/ScheduleMatchForm.tsx:74-81`).
Elle retombe sur `soireeDuJour(clubId, scheduledAt)`.

**Aucun formulaire ne bouge.** La fabrique d'orphelins se ferme depuis le
serveur — c'est la démonstration, en un diff, que la règle était au mauvais
étage.

---

## Où vit la règle — et pourquoi pas ailleurs

### `lib/jour.ts` — la borne du jour (fichier neuf)

`FUSEAU` (`lib/dates.ts:17`), `minuit` et `decalageMs` (`:69-95`) y déménagent.
S'y ajoutent `fenetreDuJour(d)` → `[minuit, minuit + 24 h)` et `cleJour(d)` →
`"2026-09-14"`. **`lib/dates.ts` les ré-exporte**, donc aucun de ses
importateurs ne bouge, et il garde son `server-only` pour ses douze formatages.
Le fichier neuf ne contient que de l'`Intl` : testable.

Le fuseau reste **une constante, pas un champ du club** — le commentaire de
`lib/dates.ts:14-16` argumente déjà pourquoi, et l'article IX interdirait
justement de poser ce réglage sur `Club`.

### `lib/matches.ts` — la règle, et la question des écrans

C'est déjà le domicile des règles serveur partagées de ce dépôt :
`SIX_SEMAINES_MS` / `rattrapable` (`:12-16`), `matchDayAppartientAuClub`
(`:68-76`), `nomEquipeTronque` (`:86-95`), `annulerOuSupprimerMatch`,
`retablirMatch`. Les deux écritures en importent déjà. Et il a son test
**contre une vraie base** — `lib/matches.test.ts:4` : *« Contre une vraie base, comme
le veut ce dépôt — pas de mock Prisma »*. C'est exactement ce que
les critères d'acceptation exigent.

Trois ajouts :

- **`soireeDuJour(db, clubId, quand)`** — la règle. Les soirées du club dont
  la date tombe dans `fenetreDuJour(quand)`, `canceledAt: null`, `take: 2`.
  Zéro → `null`. **Deux → `null`** (on ne tranche pas au hasard, spec).
  Une → son identifiant. Le `db` est un paramètre pour que le POST reste dans
  sa transaction. L'index `@@index([clubId, date])`
  (`prisma/schema.prisma:296`) sert la requête.
- **`orphelinsParJour(db, clubId, bornes)`** — la question des écrans, en
  **une seule requête** pour un calendrier entier : `matchDayId: null`,
  `status: { in: ["LIVE", "FINISHED"] }`, `playedAt` dans les bornes, groupés
  par `cleJour`.
- **`soireeReclame(...)`** — le prédicat unique qui remplace les trois
  versions divergentes des écrans.

**La symétrie est littérale, et c'est ainsi que la contrainte de `/analyser`
est tenue :** `soireeDuJour` demande « quelle soirée contient `playedAt` ? »,
`orphelinsParJour` demande « quel orphelin tombe dans la fenêtre de cette
soirée ? ». Même intervalle, même fuseau, même jeu de statuts. Elles ne
peuvent pas diverger, parce qu'elles appellent la même `fenetreDuJour`.

### Ce qui disparaît

Les **deux copies** de la fenêtre glissante — `app/c/[slug]/page.tsx:292-296`
et `app/c/[slug]/matches/[id]/page.tsx:57-61`. Elles ne servaient qu'à décider
d'un `matchDayId` que le serveur calcule désormais lui-même. Les deux boutons
qui les lisaient continuent de passer explicitement la soirée quand ils la
connaissent ; sinon le serveur tranche.

---

## Les trois écrans

Chacun cesse de poser sa propre question et appelle `soireeReclame`. Leurs
trois divergences se referment du même coup.

| écran | sa question aujourd'hui | ce qui change |
|---|---|---|
| calendrier de l'app (`app/api/clubs/[clubId]/saison/route.ts:99,128-133`) | `md.matches.filter(FINISHED)` | prédicat partagé ; `LIVE` compte aussi — une feuille restée ouverte n'est pas « aucun match » |
| calendrier du site (`app/c/[slug]/saison/page.tsx:91,115-119`) | identique, recopié | idem — les deux calendriers étaient déjà le même code écrit deux fois |
| bandeau de l'accueil (`app/c/[slug]/page.tsx:244-258,733-751`) | `matches: { none: LIVE\|FINISHED }` + `42 * 86_400_000` **en dur** | prédicat partagé, et la fenêtre de six semaines passe par `rattrapable` (`lib/matches.ts:12-16`) au lieu d'être recopiée |

**Quand le prédicat trouve un orphelin du bon jour**, l'écran ne propose plus
une feuille vierge : il dit ce qu'il a trouvé et propose de le rattacher
(décision d'Ibrahima du 17 septembre). Le lien `?md=…&joue=1` reste pour le cas
où il n'y a réellement rien — c'est le rattrapage légitime.

**Ce que ça ne touche pas :** la fiche d'une soirée garde ses boutons « Lancer
un match » et « Saisir un match joué », et « On rejoue » n'est jamais bloqué.
Le lot fait taire ce qui *réclame* sans qu'on demande, jamais ce qu'on demande
exprès.

---

## Le geste qui manquait

Rattacher après coup existe (`APRES-15`, lot 0001) mais exige `canManage`
(`app/actions/matches.ts:110`), sur le site, et son lien ne s'affiche que sur
un match terminé. La spec l'ouvre à qui peut scorer — **le rattachement seul,
pas le reste du formulaire.**

Deux portes étroites, sur le modèle exact de ce qui existe :

- **`app/actions/matches.ts`** gagne `rattacherMatch(slug, matchId, matchDayId | null)`,
  gardée `canScore`, qui ne touche que `matchDayId` et réutilise
  `matchDayAppartientAuClub`. `updateMatchDetails` reste `canManage`, `/edit`
  reste `canManage` (`app/c/[slug]/matches/[id]/edit/page.tsx:16`).
- **`app/api/clubs/[clubId]/matches/[matchId]/route.ts`** porte déjà
  `matchDayId` dans son `PatchBody` (`:130`), le valide déjà (`:157`) et
  l'écrit déjà — mais derrière `canManage` (`:211`). On isole une branche
  « rattachement seul » **avant** la garde générique, exactement comme la
  branche « rétablir un match annulé » (`:169-170`) : un corps qui ne porte que
  `matchDayId` passe avec `canScore`.

C'est cette porte qui donne à l'app son chemin de réparation — sans écran neuf
dans `five-scorer-mobile` pour ce lot.

---

## L'hors-ligne

Le gymnase n'a pas de réseau, et rien de ce plan n'en demande.

Le match se crée localement, la file part plus tard, et **`playedAt` voyage
avec elle** (`five-scorer-mobile/lib/match/local.ts:323`) ; le serveur le lit
(`app/api/clubs/[clubId]/matches/route.ts:151`). Un match saisi le lundi et
rejoué le mercredi rejoint donc **le lundi** — ce que la règle d'aujourd'hui,
calée sur `Date.now()`, ne sait pas faire.

Le téléphone, lui, ne change pas d'une ligne pour le rattachement : il ne sait
pas ce qu'est une soirée et n'a pas à l'apprendre.

---

## Les écarts assumés

*Article X : ce qu'on ne fait pas est une décision, et elle s'écrit ici plutôt
que de se découvrir dans le diff.*

1. **Les orphelins déjà en base ne sont pas rattrapés par une migration.** Il y
   en a un (le 17–11 du 14 septembre). Le geste manuel le répare, et les trois
   écrans le signaleront désormais au lieu de proposer un doublon. Une
   migration en masse fabriquerait la soirée mixte, que la spec interdit.
2. **Un match `SCHEDULED` né avant ce lot reste orphelin après son lancement.**
   Le lancement passe par l'upsert, dont le `update` ne réécrit pas
   `matchDayId` — la même garantie qui nous protège joue ici contre nous. Ces
   matchs se rattachent par le geste manuel. Ne pas « réparer » ça est
   délibéré : la seule façon de le faire serait de repasser sur un match
   existant, et alors on écraserait les « match isolé » choisis exprès.
3. **Une soirée annulée ne prend pas de match, et personne ne le dit.** Si le
   gymnase ferme, que la soirée est annulée et qu'on joue quand même, le match
   reste isolé — et les écrans ne le signalent pas, puisqu'ils ignorent les
   soirées annulées. Le geste manuel reste ouvert. Le dire à l'écran demande de
   décider ce qu'est une soirée annulée où l'on a joué : un lot à part.
4. **`deleteMatchDay` continue d'orpheliner en masse.** Suppression dure
   (`app/actions/matchday.ts:38-55`) + `onDelete: SetNull`
   (`prisma/schema.prisma:361`), et l'action ment sur son succès. Ce lot
   recolle ; il ne protège pas contre ce geste-là. C'est nommé dans la spec et
   ça reste un lot à lui.
5. **`APRES-D3` n'est pas refermé** : changer la date d'un match après coup ne
   re-déclenche pas la règle. Voulu — le dernier mot reste à l'humain.
6. **L'app ne gagne aucun écran.** Elle bénéficie de tout par le serveur ; son
   accueil continue de ne montrer que les matchs du jour (`APRES-54`, hors
   lot).

---

## L'ordre

*Serveur d'abord, app ensuite (article VII). Chaque étape a sa vérification.*

1. **`lib/jour.ts`** — extraire `FUSEAU`, `minuit`, `decalageMs` ; ajouter
   `fenetreDuJour`, `cleJour` ; `lib/dates.ts` ré-exporte.
   *Vérif : `lib/jour.test.ts` (bornes 23:30 / 00:30, changement d'heure d'été) ; `npx tsc --noEmit` ; les huit importateurs de `minuit` inchangés.*
2. **`soireeDuJour`** dans `lib/matches.ts`.
   *Vérif : `lib/matches.test.ts` — un jour avec une soirée, un jour sans, un jour à deux soirées, une soirée annulée.*
3. **Les deux écritures** appellent le repli ; `estIdOuVide` sur `body.matchDayId`.
   *Vérif : `lib/matchEvents.test.ts` étendu, puis `parcours-lecture.mjs` en TOUT VERT.*
4. **`orphelinsParJour` + `soireeReclame`**, et les trois écrans les appellent.
   *Vérif : test sur le prédicat ; puis les trois écrans à l'œil, sur le jeu d'essai avec un orphelin daté du bon jour.*
5. **Les deux copies de la fenêtre glissante disparaissent.**
   *Vérif : `grep -rn "12 \* 3600_000" five-scorer/app` rend zéro.*
6. **`rattacherMatch` + la branche étroite du PATCH.**
   *Vérif : test du droit (un `canScore` non-admin rattache ; il ne peut pas changer la date ni l'homme du match).*
7. **Le tour dans le simulateur**, à côté de la page du site (article VII), et
   le rattrapage du 17–11 en production.

---

## Ce que ça ferme, et ce que ça laisse

**Ferme :** `SOIREE-33`, les deux moitiés — rattacher, et faire taire les trois
écrans.

**Rembourse au passage, sans que le lot le promette :** la troisième copie de
la fenêtre de six semaines (`app/c/[slug]/page.tsx:250`, en dur) que le lot 0001 tâche 8
avait manquée ; les deux calendriers qui étaient le même code écrit deux fois ;
et un `estIdOuVide` manquant sur un `where` Prisma.

**Laisse :** les cinq écarts ci-dessus, et les quatre cas que la spec range en
« débloqués, pas refermés » (`APRES-06`, `COMPO-01`, `COMPO-08`, `APRES-54`).
