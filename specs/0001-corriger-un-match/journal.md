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
