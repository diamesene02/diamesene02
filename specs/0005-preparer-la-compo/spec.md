# 0005 — Préparer les équipes depuis le téléphone

*Demandé le 12 septembre 2026 : « je veux pouvoir préparer les équipes sur
l'app aussi ». Écrit après le lot du même jour, qui a rendu la compo préparée
VISIBLE dans l'app sans la rendre modifiable.*

---

## Le problème

Le club décide ses équipes **trois à quatre jours avant**, sur WhatsApp. Cette
décision a un endroit où s'écrire — la table `MatchDayLineup` — et un seul
chemin pour y arriver : **le site**, `app/actions/compo.ts:18`.

Or la conversation où la décision se prend a lieu **sur le téléphone.** Il faut
donc, aujourd'hui, sortir de WhatsApp, ouvrir un navigateur, se connecter au
site, trouver la soirée. Entre la décision et son écriture il y a quatre gestes
et un changement d'appareil — et c'est exactement le nombre de gestes qui fait
qu'on ne le fait pas, et qu'on recompose debout au bord du terrain le lundi.

**Ce qui existe déjà, et qu'il ne faut pas refaire :**

- La table et le contrat d'écriture (`app/actions/compo.ts:18-86`) : il
  **remplace l'ensemble** de la compo — `deleteMany` puis `createMany` dans une
  transaction. Ce n'est pas une modification partielle.
- La lecture côté app : `/api/clubs/[clubId]/soirees/[matchDayId]` rend déjà
  `compo: { faite, nomA, nomB, joueurs: [{ playerId, nom, photo, niveau,
  gardien, camp }] }` — **tous les joueurs du club**, avec `camp: null` pour
  ceux qui ne sont placés nulle part. C'est déjà la matière d'un éditeur.
- L'équilibrage : `lib/noyau/balance.ts` est dans l'app et `app/compo.tsx`
  s'en sert déjà.
- L'affichage : la carte « Composition » de `app/soiree/[id].tsx`, écrite le
  12 septembre.

**Ce qui manque, et c'est tout :** aucune route d'écriture n'existe pour l'app.
`/api/clubs/[clubId]/matchdays/[matchDayId]/lineup` est en **lecture seule**
(un seul `export async function GET`). L'écriture est une action serveur Next,
donc hors de portée d'un client React Native.

---

## Pour qui, et quand

**Malik, le lundi moins trois jours, dans le métro.** Le groupe WhatsApp vient
de s'accorder : « Karim passe en blanc, Momo au but ». Il bascule sur l'app,
ouvre la soirée, déplace deux joueurs, c'est écrit. Dix secondes.

**Et au gymnase, lundi 19 h 55** — le cas qui décide de l'architecture. Deux
absents de dernière minute, un invité qui arrive. La compo se retouche debout,
sur un réseau qui n'existe pas. **Si l'écran refuse, le lot n'a servi à rien** :
c'est précisément le moment qu'on voulait supprimer.

---

## Ce qu'on doit pouvoir faire

1. **Placer un joueur** dans l'équipe A, dans l'équipe B, ou nulle part — d'un
   tap, comme sur le site et comme dans `/compo`.
2. **Désigner le gardien** de chaque camp. Le contrat le porte (`isGk`), le
   site le pose, et l'app ne l'affiche même pas aujourd'hui.
3. **Équilibrer automatiquement**, avec le moteur qui est déjà là.
4. **Renommer les deux équipes** pour la soirée.
5. **Enregistrer sans réseau**, et que ça parte tout seul au retour du réseau.
6. **Voir ce qui ne va pas** avant de valider : effectif déséquilibré, une
   équipe vide, pas de gardien — les trois avertissements que le site donne.

---

## Ce qu'on ne doit PAS pouvoir faire

- **Composer une soirée d'un autre club.** L'action du site vérifie que chaque
  joueur appartient au club (`compo.ts:52-59`) ; la route neuve doit refaire
  cette vérification, pas s'y fier.
- **Mettre le même joueur dans les deux camps** (`compo.ts:40-43`).
- **Composer une soirée annulée.**
- **Écraser en silence.** Voir la question tranchée ci-dessous.

---

## Questions tranchées

### Hors ligne ou pas ? — **hors ligne, par la file d'attente.**

C'est l'inverse de ce qui a été décidé pour la correction d'un match
(spec 0001), et pour une raison précise : **une compo est une écriture qui
remplace tout, une correction est une écriture qui modifie une partie.**

Le contrat du site remplace l'ensemble (`compo.ts:66-79`). Deux téléphones qui
composent hors ligne puis se reconnectent : le dernier arrivé gagne, et il
gagne **entièrement** — il n'existe aucun état bâtard où la moitié d'une compo
se mélange à la moitié d'une autre. Or c'est exactement ce que fait le groupe
WhatsApp aujourd'hui : le dernier message fait foi.

Refuser hors ligne coûterait le cas du gymnase, qui est la moitié de la valeur
du lot. L'article I (rien de ce qui est saisi ne disparaît) tranche dans le même
sens.

*Ce qui reste vrai et doit être dit : il n'y a toujours aucun arbitrage de
conflit dans ce dépôt. Ici on ne le contourne pas, on constate qu'il n'est pas
nécessaire — la granularité de l'écriture rend le dernier-arrivé-gagne honnête.
Ça ne vaudra pas pour le lot suivant.*

### Qui a le droit ? — **`canScore`, comme le site.**

Tranché par le code : `compo.ts:31` refuse sur `!ctx.canScore`, pas sur
`!canManage`. Qui peut marquer peut composer. L'app expose déjà
`club.peutScorer`. Aucune raison d'être plus sévère que le site.

### Où, dans l'app ? — **sur l'écran soirée.**

Tranché par le modèle de données, pas par le goût. `app/actions/compo.ts:10-14`
l'écrit : *« Elles vivent sur la SOIRÉE, pas sur un match — une soirée enchaîne
quatre à huit matchs avec les deux mêmes équipes, et chacun en hérite. »*
Mettre l'édition dans `/compo` (l'écran « nouveau match ») rattacherait la compo
à un match. La carte « Composition » de `app/soiree/[id].tsx` devient éditable.

### Et « Compo précédente » ? — **hors lot.**

Le site l'a (`compo.ts:92`, `reprendreCompoPrecedente`) et c'est le geste qui
fait gagner le plus de temps. Mais il demande une lecture serveur d'une AUTRE
soirée, donc un aller-retour de plus et un comportement à définir hors ligne.
À faire, pas ici. **C'est dit pour que le manque ne passe pas pour un oubli.**

---

## À quoi on saura que c'est fait

- [ ] Sur l'écran soirée, un tap sur un joueur le fait tourner aucun → A → B →
      aucun, et la carte se met à jour immédiatement.
- [ ] Le gardien de chaque camp se désigne et **s'affiche** — y compris sur la
      carte en lecture seule, qui ne le montre pas aujourd'hui.
- [ ] « Équilibrer » répartit les joueurs choisis et sépare les gardiens.
- [ ] Les trois avertissements apparaissent dans les mêmes cas que sur le site.
- [ ] **En mode avion** : on compose, on enregistre, l'app dit que c'est en
      attente ; on rétablit le réseau, la compo arrive sur le site sans qu'on
      ait rien touché. Vérifié dans le simulateur, réseau coupé.
- [ ] Une compo enregistrée depuis l'app se retrouve **à l'identique** sur la
      page de la soirée du site, et le formulaire « Nouveau match » du site
      s'ouvre avec ces équipes-là.
- [ ] Rejouer deux fois la même opération de la file donne le même résultat
      qu'une fois.
- [ ] `tsc --noEmit` vert des deux côtés, `npm run tester` vert,
      `expo export --platform ios` en 0, `next build` en 0.
- [ ] Vu dans le simulateur à côté de la page du site (article VII).

---

## Les cas de la base que ce lot referme

*Comptés en ouvrant `cas.md` (5 563 lignes), pas de mémoire.*

**`SOIREE-23`** — ✗ absent · *gêne un lundi* — `cas.md:657`
> *« Jeudi, le capitaine veut poser ou relire la compo depuis son téléphone. »*
> **Attendu :** « La même carte Composition que sur le site, modifiable. »

C'est ce lot, écrit avant lui, mot pour mot. Le relevé de la base avait déjà
vu que `fiche.compo` était reçu et non rendu, et qu'aucune route d'écriture
n'existait hors de l'action serveur.

**`SOIREE-24`** — ⚠ faux · *gêne un lundi* — `cas.md:627`
> Le rappel ambre de l'accueil mobile.

**À moitié refermé le 12 septembre** : sa destination ne ment plus. Mais la
base relève un second défaut que la correction du jour n'a PAS touché —
*« Le rappel n'est montré qu'aux gérants (`index.tsx:143` `peutGerer`) alors
que le site le montre à qui peut scorer (`page.tsx:363-368`). »* Un joueur qui
a le droit de composer ne voit pas qu'il faut composer. **Ce lot le referme**,
et c'est cohérent avec le droit tranché plus haut : `canScore`.

**Explicitement HORS lot : `SOIREE-27`** (`cas.md:667`) — *« Karim est dans la
compo enregistrée jeudi ; il dit "absent" dimanche. »* La compo ne connaît pas
les réponses de présence : un absent reste sur le terrain jusqu'au coup
d'envoi. C'est un vrai manque, il touche AUSSI le site (`CompoSoiree.tsx:66-82`
reçoit `joueurs` sans statut de présence), et le réparer des deux côtés est un
lot à lui. **Dit ici pour que le silence ne passe pas pour un oubli.**

---

## Ce que ça débloque

La décision et son écriture reviennent au même endroit. Et le lundi soir, la
feuille s'ouvre avec les équipes déjà faites — ce que le site permet depuis
toujours et que le téléphone ne savait pas atteindre.
