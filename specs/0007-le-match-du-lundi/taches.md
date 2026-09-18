# Tâches — le match du lundi appartient au lundi

*Écrit le 18 septembre 2026, après `spec.md` (17 septembre, révisée par
`/clarifier` et `/analyser`) et `plan.md` (17 septembre, issu de trois
conceptions jugées). Chaque tâche porte sa vérification par une commande,
comme l'article VIII l'exige — aucune ne se signe sans avoir tourné.*

*Une chose a déjà bougé depuis le plan : **le match du 14 septembre a été
rattaché à sa soirée en production le 17 au soir**, par le formulaire du site.
Les trois alarmes se sont tues, le bilan et le mot de la soirée existent. Le
seul rattrapage prévu par le lot est donc fait ; il reste le défaut lui-même.*

---

## 1. `lib/jour.ts` — sortir la borne du jour de derrière `server-only`

**Pourquoi en premier :** tout le reste en dépend, et c'est la seule tâche
imposée par une contrainte d'outillage plutôt que par le produit.
`lib/dates.ts:1` porte `import "server-only"`, qui **lève** hors React Server
— donc rien de ce qui l'importe n'est testable, et l'article VIII refuserait
une règle invérifiable.

**Ce qu'on fait :** créer `five-scorer/lib/jour.ts` et y déplacer `FUSEAU`
(`lib/dates.ts:17`), `minuit` et `decalageMs` (`:69-95`). Ajouter
`fenetreDuJour(d)` → `{ debut, fin }` sur `[minuit, minuit + 24 h)` et
`cleJour(d)` → `"2026-09-14"`. `lib/dates.ts` **ré-exporte** les trois
déplacés : aucun de ses importateurs ne bouge.

**Vérification :**
```bash
cd five-scorer && npx tsc --noEmit && npx vitest run lib/jour.test.ts
```
Le test couvre : minuit d'un jour d'été et d'un jour d'hiver (le changement
d'heure est le bug que `lib/dates.ts:5-12` raconte avoir payé), un match à
23:30 qui tombe dans le jour, un à 00:30 qui tombe dans le suivant, et
`cleJour` stable des deux côtés d'un changement d'heure.

---

## 2. `soireeDuJour` — la règle, dans `lib/matches.ts`

**Ce qu'on fait :** `soireeDuJour(db, clubId, quand)` → `string | null`. Les
soirées du club dont la `date` tombe dans `fenetreDuJour(quand)`,
`canceledAt: null`, `take: 2`. Zéro → `null`. **Deux → `null`** (spec : on ne
tranche pas au hasard). Une → son identifiant. `db` est un paramètre pour que
l'appelant puisse passer sa transaction.

`lib/matches.ts` est le bon domicile : il porte déjà `rattrapable`,
`matchDayAppartientAuClub`, `nomEquipeTronque`, et son test tourne **contre
une vraie base** (`lib/matches.test.ts:4`).

**Vérification :**
```bash
cd five-scorer && npx vitest run lib/matches.test.ts
```
Quatre cas neufs : un jour avec une soirée → son id ; un jour sans → `null` ;
un jour à deux soirées → `null` ; une soirée annulée ce jour-là → `null`.

---

## 3. Les deux écritures serveur retombent sur la règle

**Ce qu'on fait :**
- `app/api/clubs/[clubId]/matches/route.ts:204-211` : la soirée demandée si
  elle appartient au club, **sinon `soireeDuJour(tx, clubId, playedAt ?? new
  Date())`**. Miroir exact du repli de saison écrit vingt-six lignes plus haut
  (`:155-176`).
- `app/actions/schedule.ts:47-55` : même repli, sur `scheduledAt`. **Aucun
  formulaire ne bouge** — `ScheduleMatchForm.tsx` n'est pas touché.
- Au passage, sur des lignes qu'on édite déjà : `estIdOuVide(body.matchDayId)`
  avant le `where` de `:206`, comme les deux autres écritures de ce champ le
  font déjà.

**Ce qu'on ne fait PAS :** aucune condition « est-ce une création ? ».
L'upsert monte déjà `update: { teamAName, teamBName }` (`:235-239`) : le
champ n'est jamais réécrit sur un match existant. La garantie est
structurelle.

**Vérification :**
```bash
cd five-scorer && npx vitest run lib/
cd five-scorer-mobile && node scripts/jeu-dessai.mjs && node scripts/parcours-lecture.mjs
```
Plus un test neuf dans `lib/matchEvents.test.ts` : un match créé sans soirée,
daté d'un jour de soirée, ressort avec elle ; rejoué à l'identique trois jours
plus tard, il la garde sans la recalculer.

---

## 4. `orphelinsParJour` et `soireeReclame` — la question des écrans

**Ce qu'on fait :** dans `lib/matches.ts`, deux fonctions qui appellent la
**même** `fenetreDuJour` que la règle — c'est ce qui tient la contrainte
nommée par `/analyser` (la règle et les écrans doivent regarder la même
fenêtre, sinon un match de 23:50 laisse sa soirée réclamée).

- `orphelinsParJour(db, clubId, bornes)` : `matchDayId: null`,
  `status: { in: ["LIVE","FINISHED"] }`, `playedAt` dans les bornes, groupés
  par `cleJour` — **une seule requête pour un calendrier entier**.
- `soireeReclame(soiree, orphelins)` : le prédicat unique.

**Vérification :**
```bash
cd five-scorer && npx vitest run lib/matches.test.ts
```
Un orphelin du bon jour est trouvé ; un orphelin de la veille ne l'est pas ;
un match déjà rattaché n'apparaît pas ; un `CANCELED` non plus.

---

## 5. Les trois écrans appellent le prédicat partagé

**Ce qu'on fait :** chacun cesse de poser sa propre question.

| écran | aujourd'hui | après |
|---|---|---|
| calendrier de l'app (`app/api/clubs/[clubId]/saison/route.ts:99,128-133`) | `filter(FINISHED)` | `soireeReclame` ; `LIVE` compte aussi |
| calendrier du site (`app/c/[slug]/saison/page.tsx:91,115-119`) | idem, recopié | idem |
| bandeau de l'accueil (`app/c/[slug]/page.tsx:244-258,733-751`) | prédicat propre + `42 * 86_400_000` **en dur** (`:250`) | `soireeReclame` + `rattrapable` (`lib/matches.ts:12-16`) |

Quand le prédicat trouve un orphelin du bon jour, l'écran **le dit et propose
de le rattacher** — il ne propose plus une feuille vierge. Le lien
`?md=…&joue=1` reste pour le cas où il n'y a réellement rien.

**Vérification :**
```bash
cd five-scorer && grep -rn "42 \* 86_400_000" app/ ; echo "attendu : aucune ligne"
cd five-scorer && npx next build   # dans un dossier à côté, jamais le .next d'un dev vivant
```
Plus, à l'œil sur le jeu d'essai : une soirée passée avec un orphelin du bon
jour propose de rattacher ; une soirée passée sans rien propose toujours de
saisir ; une soirée qui a déjà un match terminé ne propose rien.

---

## 6. Les deux copies de la fenêtre glissante disparaissent

**Ce qu'on fait :** retirer `Math.abs(… - Date.now()) < 12 * 3600_000` de
`app/c/[slug]/page.tsx:292-296` et de
`app/c/[slug]/matches/[id]/page.tsx:57-61`. Les boutons qui les lisaient
continuent de passer explicitement la soirée quand ils la connaissent ; sinon
le serveur tranche, et il tranche mieux (un match de 06:30 qu'elles rataient
est désormais rattaché).

**Vérification :**
```bash
cd five-scorer && grep -rn "12 \* 3600_000" app/ ; echo "attendu : aucune ligne"
cd five-scorer && npx tsc --noEmit
```

---

## 7. `rattacherMatch` — le geste ouvert à qui peut scorer

**Ce qu'on fait :** deux portes étroites, sur le modèle de ce qui existe.
- `app/actions/matches.ts` : `rattacherMatch(slug, matchId, matchDayId | null)`,
  gardée `canScore`, qui ne touche **que** `matchDayId` et réutilise
  `matchDayAppartientAuClub`. `updateMatchDetails` reste `canManage`
  (`:110`), `/edit` reste `canManage` (`app/c/[slug]/matches/[id]/edit/page.tsx:16`).
- `app/api/clubs/[clubId]/matches/[matchId]/route.ts` : une branche
  « rattachement seul » **avant** la garde générique, sur le modèle exact de
  la branche « rétablir » (`:169-170`). Un corps qui ne porte que
  `matchDayId` passe avec `canScore`.

**Vérification :**
```bash
cd five-scorer && npx vitest run lib/ && npx tsc --noEmit
```
Le test : un `canScore` non-admin rattache ; le même ne peut changer ni la
date, ni la saison, ni l'homme du match ; une soirée d'un autre club est
refusée.

---

## 8. Le tour complet

1. `npx tsc --noEmit` vert des deux côtés.
2. `npm test` (site) et `npm run tester` (app) verts — **sous Node 22**
   (`.nvmrc`), sinon vitest ne ramasse rien côté site.
3. `cd five-scorer-mobile && node scripts/jeu-dessai.mjs && node
   scripts/parcours-lecture.mjs` → TOUT VERT.
4. `npx expo export --platform ios` en 0 ; `next build` en 0, dans un dossier
   à côté.
5. Le tour dans le simulateur, à côté de la page du site (article VII) : un
   match lancé depuis l'accueil de l'app apparaît dans la soirée du jour, des
   deux côtés, sans autre geste.
6. `/analyser 0007` une **seconde** fois, sur le code livré.
7. `cas.md` : `SOIREE-33` passe à ✔ fait, compteurs **recomptés depuis le
   fichier**, et `spec.md` 0000 aligné.

**Déjà fait le 17 septembre :** le rattrapage du 17–11 en production.
