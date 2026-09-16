# 0001 — Journal

*Ce qui a divergé du plan, écrit pendant. Ce qu'un commit fait se lit dans son
diff ; ce qu'il a ÉCARTÉ ne se lit nulle part ailleurs qu'ici.*

---

## 13 septembre — le prérequis que 0006 n'avait pas repris

`plan.md` avait écrit, deux jours avant que 0006 existe : « les gardes qui
testent `status === "FINISHED"` doivent aussi couvrir `CANCELED` ». 0006 a
livré `CANCELED` sans y revenir. Le trou a existé quelques heures en
production — un match « Annulé » acceptait encore des buts d'un membre —
avant le correctif `8399ea37`, sorti seul, avant même `taches.md`. Le lot a
donc commencé par une livraison en urgence, puis seulement par la méthode.

## 13 septembre — `/analyser` sur `taches.md`, avant la première ligne

Quatre choses trouvées, aucune par le code : deux tâches absentes
(`APRES-04` côté soirée, `APRES-07`/`FIN-03` le bouton mort), quatre cas que
`plan.md` signalait déjà comme non cités par `spec.md` et qui manquaient
toujours (23 → 27), deux citations de `cas.md` qui disaient encore
« canScore » alors que Q1 avait tranché `canManage`, et le critère « le
bouton Supprimer a disparu » que 0006 avait livré autrement (un seul bouton
honnête). Tout est écrit dans `spec.md`, daté.

## 13 septembre — la tâche 11 tranchée sans code

Le critère « une file rejouée sur un match annulé ne bloque pas toute la
chaîne » est abandonné : depuis la tâche 9 un match annulé se rétablit, il
n'est pas plus définitif qu'un match terminé, et le blocage total de
`lib/sync.ts` protège du même scénario (un `finishMatch` qui passerait
par-dessus un but refusé). Le message, lui, était déjà juste.

## 13 septembre — deux trous latents trouvés en chemin, pas prévus

- Tâche 7 : un troisième endroit écrivait un nom d'équipe sans plafond (le
  PATCH mobile), trouvé par la vérification indépendante avant le commit.
- Tâche 9 : le PATCH mobile acceptait déjà `{status: "FINISHED"}` sur un
  match `CANCELED` par accident de garde, sans effacer `canceledAt` — un
  match « rétabli » par ce chemin serait resté marqué annulé.

## 16 septembre — la tâche 12 a coûté la limite hebdomadaire

Le workflow à quatre agents lancé le 13 pour l'écran `/corriger` est mort sur
la limite hebdomadaire de sous-agents, sans rien livrer d'autre qu'un
fichier orphelin, `lib/matchEvents.ts`, extrait à moitié. La tâche a été
reprise **en solo** le 16 : le fichier orphelin était fidèle aux trois
handlers, il a servi de base ; le reste (les gestes de composition, le
marquage `correctedAt`, l'écran, les raccords) a été écrit à la main.

**Ce que la spec ne disait pas et que le code a dit :**

- `RecapView.tsx` faisait *hériter* à un but sans minute la minute du but
  précédent — un but ajouté après coup se serait intercalé au milieu du
  match, exactement le contraire de Q5. Corrigé : un but sans minute passe
  en fin de chronologie, marqué « ajouté après coup » — mais seulement si le
  match a par ailleurs des minutes, sinon une feuille rétro (où aucun but
  n'en a) se serait couverte de ce repère.
- Côté route mobile, la chronologie est déjà en ordre de saisie : rien à
  trier, seul le repère `apresCoup` manquait.
- Le marqueur `correctedAt`/`correctedById` se pose dans les fonctions
  partagées, **pour toute correction** — celles de l'app mobile par ses
  routes comme celles du site par `/corriger`. Le plan l'imaginait propre à
  l'écran ; ç'aurait été un marqueur qui ne dit qu'une partie de la vérité.
- Le bouton « Rouvrir le match » (`PlayShell.tsx`) n'a pas été retiré mais
  transformé en lien vers `/corriger` : c'est le seul endroit atteignable
  depuis la feuille de saisie, et « attends, c'était 4-3 » (`FIN-03`) se dit
  là. Un membre y arrive et retombe sur le récap, qui lui dit pourquoi
  (tâche 6).
- L'écran refuse un `CANCELED` (« rétablis-le d'abord ») là où l'API, elle,
  laisserait un admin écrire : l'écran est plus strict que la route, et le
  dit dans son code.

**Ce qui reste vérifié à la main, pas par un test :** le branchement des
routes (mêmes codes, mêmes messages) — mais `five-scorer-mobile` est resté à
305/305 sans qu'un seul test change, ce qui vaut preuve de contrat ; et
l'écran lui-même, vu dans le navigateur : 1–1 → 2–1 par un but ajouté, la
marque « Corrigé le 16 sept. 2026 à 09:16 par Compte de dev », le but en fin
de chronologie sur le récap, puis retiré, 1–1.

## 16 septembre — la tâche 15 : quatre cas comptés fermés qui ne l'étaient pas

`spec.md` promettait « quand le lot est livré, leur état y passe à `fait` »
pour 27 cas. Relus un par un dans `cas.md`, contre le code livré et non
contre la spec : **15 passent à fait, trois passent seulement de faux à
partiel, un ne bouge pas.**

- `APRES-D3` : on peut rattacher ou détacher une soirée (tâche 7), mais rien
  ne compare `playedAt` à la date de la soirée. La moitié « ou alors on le
  détache » est faite ; l'autre moitié n'a jamais eu de tâche.
- `APRES-04` : la ligne d'une soirée ne dit plus « Terminé » pour un match
  annulé (tâche 10), mais le récap mobile ne traite que `ANNULE` — un match
  *programmé* ouvert depuis la soirée y est toujours « 0 – 0 » sans un mot.
- `APRES-14` : la confirmation des six semaines et de la saison close vit sur
  `/corriger` (tâche 8), pas sur `/edit` — le déplacement de saison, qui est
  le cas d'origine, reste muet.
- `APRES-24` : « Rétablir » (tâche 9) rend `CANCELED → FINISHED`. Le cas parle
  d'un match *programmé* annulé, à remettre au programme avec ses
  convocations : `CANCELED → SCHEDULED`, qui n'existe pas, et le bouton ne
  s'affiche pas sur cette vue.

Compteurs recomptés depuis le fichier (`grep -c` sur les en-têtes) :
185 · 153 · 88 · 123, total 549. Avant : 170 · 159 · 89 · 131. Le tableau de
`spec.md` 0000 suit. La leçon est celle de `/analyser` : une liste de cas
« refermés » écrite avant le code est une intention ; elle ne devient un état
qu'en rouvrant chaque entrée.

## 16 septembre — un vert qui ne testait rien, et un trou que l'écran cachait

**Le faux vert.** `pnpm test` côté site est sorti en 0… parce que la
commande finissait par `| tail` et que le code de sortie était celui de
`tail`. En réalité vitest n'avait exécuté **aucun** test : jsdom 30 tire
undici 8, qui ne charge pas sous le Node 20 par défaut de la machine
(`webidl.util.markAsUncloneable is not a function`). Sous Node 22 : 5
fichiers, 62 tests. Un `.nvmrc` (22.22.0) est ajouté à `five-scorer`, comme
le mobile en a un. Règle pour la suite : jamais de `| tail` sur une commande
dont on lit le code de sortie.

**Le trou.** Le parcours de lecture étendu (tâche 15, point 1) a fait ce
qu'aucun test unitaire ne faisait : annuler un match d'essai, puis, en tant
qu'admin, y pousser un but par la route que l'app appelle. **HTTP 201.** Le
but comptait dès le rétablissement. L'écran `/corriger`, lui, refusait avec
« rétablis-le d'abord » — et le journal de la tâche 12 l'avait écrit sans y
voir de faute : « l'écran est plus strict que la route ». C'est une règle
tenue par l'affichage (constitution, article III), et la tâche 12 l'avait
assumée à tort.

Corrigé dans `lib/matchEvents.ts` : une seule garde, `refusEcriture`, pour
les cinq gestes — verrouillé et pas admin → 403 comme avant ; **annulé, admin
compris → 409 « Un match annulé ne se corrige pas : rétablis-le d'abord. »**
L'écran répète le même message par la même constante. Quatre tests, le
parcours, et le 409 est un refus définitif pour les deux files hors-ligne
(`lib/sync.ts`, `lib/outbox/sync.ts`), qui l'affichent avec sa raison : un
téléphone qui rejoue ses buts sur un match annulé entre-temps lit pourquoi,
et « Réessayer » aboutit une fois le match rétabli — ce qui referme, pour le
cas *annulé*, la moitié de `APRES-27` (« rien ne dit pourquoi »).

**Ce que ça ne règle pas, et qu'on dit :** un téléphone dont la file ne
contient plus que le coup de sifflet final (`PATCH {status: "FINISHED"}`)
d'un match annulé entre-temps le *rétablit* en le rejouant — c'est le geste
de la tâche 9, le même que le bouton « Rétablir ». Rare (les buts précèdent
le sifflet dans la file, et bloquent avant lui), mais réel ; noté ici plutôt
que caché.

## 16 septembre — le tour dans le simulateur (article VII)

iPhone 17 Pro, Expo Go, jeu d'essai local, à côté du site en dev. Vu :

- le récap du match d'essai après un but ajouté depuis la route du site :
  « Corrigé le 16 septembre à 20:16 par Compte de dev » au-dessus du score,
  2–2, « Gaël » sans minute dans la liste des buteurs ;
- l'onglet Chronologie : « Gaël · ajouté après coup · 2–2 » en tête, un
  tiret à la place de la minute, les trois autres buts avec les leurs ;
- « 1 but · désigné par le capitaine · 1/1 voix » sous l'homme du match
  (`motmLocked` posé à la main pour la scène) ;
- « Supprimer » → la confirmation de 0006 (« s'il y a des buts ou une compo,
  il reste, marqué annulé ») → le bilan des équipes passe de 0-1-0 à 0-0-0
  et le bouton devient « Rétablir » ; « Rétablir » → 0-1-0, « Supprimer »,
  les quatre buts intacts.

Captures dans `~/Tutos/five-scorer/2026-09-16-recap-*.png` (hors dépôt :
un mégaoctet chacune, données d'essai). La scène est défaite après : but
retiré, `motmLocked` à faux — la trace « corrigé » reste, c'est la règle.

**Ce que le tour a coûté, et qu'il faut savoir :** le premier bundle servi
par Metro ne montrait PAS la ligne « Corrigé le … » — Metro, lancé à 19:36,
était coincé (la requête de bundle restait sans un octet à 0 % CPU) et
servait un bundle d'avant les commits de l'après-midi. Relancé avec un
fichier de log, il a reconstruit (1632 modules, 13 s) et la ligne est
apparue. Leçon : un écran vu dans le simulateur ne prouve le code du jour
que si Metro a été relancé après les commits du jour.

**Trois passages ?** Le parcours de lecture a tourné deux fois vert (avant et
après la règle du 409), les tests des deux côtés une fois chacun après la
règle, le tour simulateur une fois. Pas trois passages du tour lui-même :
dit ici plutôt que compté.
