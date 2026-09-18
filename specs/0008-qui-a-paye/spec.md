# 0008 — Qui a payé

*État : à valider · Écrite le 18 septembre 2026, juste après la livraison du
lot 0007, qui a nommé ce défaut comme hors lot : « un produit qui recolle d'un
côté et détache en masse de l'autre n'a rien réglé ». Les lignes citées ici ont
été rouvertes le jour même.*

---

## Le problème

**La constitution de ce produit existe à cause de ce défaut, et il est
toujours là.**

L'article II s'appelle « Rien ne s'efface ». Sous lui, la ligne qui l'a fait
naître, mot pour mot :

> *Né de :* la v1 avait un `deletedAt`, la v2 l'a retiré. **Supprimer une
> soirée efface qui a payé.**

Huit jours plus tard, supprimer une soirée efface toujours qui a payé.

### Ce qu'une soirée emporte en tombant

`deleteMatchDay` (`app/actions/matchday.ts:38-55`) fait un
`prisma.matchDay.delete(...)` — une suppression dure, sans corbeille et sans
trace. Trois choses pendent à cette ligne, et la base les emporte :

| ce qui pend | ce qui arrive | où c'est écrit |
|---|---|---|
| **les réponses à la convocation**, et avec elles `hasPaid` — **qui a payé** | `Cascade` : effacées | `prisma/schema.prisma:473,480` |
| **la compo préparée** — les équipes décidées jeudi sur WhatsApp | `Cascade` : effacée | `prisma/schema.prisma:309` |
| **les matchs joués ce soir-là** | `SetNull` : orphelins, d'un coup | `prisma/schema.prisma:361` |

Et le coût du terrain, qui vivait sur la soirée elle-même
(`prisma/schema.prisma:280`), part avec.

La base du produit le dit déjà, à sa manière : parmi les **sept chemins de
suppression dure** qu'elle a relevés, celui-ci est décrit comme « **la soirée
entière**, qui emporte en cascade ses réponses — donc qui a payé — et sa
compo » (`specs/0000-le-club-et-lapp/spec.md:229-233`).

### Le troisième dégât est nouveau, et il défait le lot d'hier

Les matchs deviennent orphelins **en masse**. C'est exactement l'état que le
lot 0007 vient d'interdire à la création : un match qui n'appartient à aucune
soirée disparaît du bilan de son lundi, du mot du mardi matin et du
calendrier. Le produit recolle désormais d'un côté ; ici il détache par
paquets, en un clic, sans que personne soit prévenu.

### Et la confirmation est interdite par la constitution

Avant de supprimer, l'écran demande : **« Sûr ? Les réponses partent avec. »**
(`app/c/[slug]/sessions/[id]/DeleteSessionButton.tsx:36`).

L'article V dit : *« Un geste qui ne se rattrape pas se confirme par une
phrase qui **dit ce qui va se passer** — jamais par “Êtes-vous sûr ?”. »*
Cette phrase-ci est un « Êtes-vous sûr ? », et elle ne dit qu'un tiers de ce
qui va se passer : elle nomme les réponses, pas les paiements, pas la compo,
pas les matchs qu'on va détacher.

### Enfin, l'action ment sur son succès

`.catch(() => null)` puis `return { ok: true }` (`app/actions/matchday.ts:50-54`) :
si la suppression échoue, l'écran dit qu'elle a réussi. C'est le défaut exact
que le lot 0006 a réparé pour la suppression d'un **match** — le cas
`APRES-26` — et qu'il a laissé intact ici, sur l'objet qui emporte le plus.

---

## Pour qui, et quand

**Le capitaine, un mardi de janvier.** Il a posé la saison d'un coup en
septembre, et il y a un lundi de trop : un férié, une semaine où le gymnase
était pris. Il ouvre la soirée, tape « Supprimer », lit « Sûr ? », et
confirme. Il ne sait pas qu'il vient d'effacer qui avait payé les deux
lundis précédents — parce que rien ne le lui a dit, et parce qu'il a tapé sur
la mauvaise soirée.

**Ibrahima, en mars, devant la caisse.** Il veut savoir qui doit encore pour
la saison. Les sommes ne tombent pas juste. Rien à l'écran ne dit qu'il
manque trois soirées — elles n'existent plus, et elles n'ont laissé aucune
trace de leur passage.

**Le club, n'importe quel mardi matin.** Une soirée supprimée par erreur
emporte un match joué. Le match, lui, reste — mais isolé, sans lundi. Le lot
0007 a appris aux écrans à signaler ce cas ; il ne peut rien contre celui qui
le fabrique.

---
## Ce qui rend ce lot petit plutôt que gros

**Le geste juste est déjà écrit, et il n'a jamais été appelé.**

`annulerSoiree` et `retablirSoiree` vivent dans `app/actions/calendrier.ts:43`
et `:64` depuis le jour où le calendrier de saison est né. Elles sont
complètes : gardées par `canManage`, elles vérifient le club, coupent le motif
à 120 caractères et rendent un vrai refus quand la soirée n'existe pas.
**Elles n'ont aucun appelant, nulle part, depuis le premier jour** — vérifié
par recherche exhaustive du dépôt et par `git log -S`, qui ne rend que le
commit qui les a écrites.

Le produit a le bon geste en magasin et n'offre que le mauvais.

**Et la doctrine est écrite aussi — dans le schéma, trois lignes au-dessus du
champ qui l'incarne** (`prisma/schema.prisma:281-283`) :

> *Soirée annulée (terrain fermé, vacances, trop peu de monde). **On ne
> supprime pas** : un calendrier généré pour la saison doit garder la trace de
> ce qui n'a pas eu lieu, sinon on le régénère et le trou revient.*

**L'argument le plus fort n'est donc pas moral, il est mécanique : supprimer
ne marche même pas.** Une soirée née d'un calendrier posé d'un bloc **revient
à la prochaine génération** — vide, sans ses présences, sans ses paiements,
sans sa compo. Le produit défait lui-même la suppression, en ne gardant que
les dégâts. Une soirée annulée, elle, survit à la régénération.

Le même constat est écrit une troisième fois, dans l'export iCal
(`app/api/cal/[token]/route.ts:122-124`) : *« une soirée annulée reste dans le
flux, marquée annulée : la retirer laisserait le créneau vide dans l'agenda
sans dire pourquoi »*. C'est mot pour mot ce que la suppression fait aux
quinze agendas du club.

**Et la base du produit le savait.** `specs/0000-le-club-et-lapp/regles.md:154`
porte déjà : *« On
n'efface pas une soirée d'un calendrier généré : on l'annule, sinon la
régénération la fait revenir. L'annulation existe côté serveur (admins, motif
≤ 120 car.) mais **AUCUN écran ne l'appelle**. »*

Ce lot ne construit donc presque rien. Il branche ce qui existe, et il retire
ce qui n'aurait jamais dû être offert seul.

---

## Ce qu'on doit pouvoir faire

1. **Annuler une soirée, et que ça se voie.** Terrain fermé, vacances, trop
   peu de monde : la soirée reste au calendrier, marquée annulée, avec son
   motif. Ses réponses, ses paiements et sa compo restent là.
2. **Rétablir une soirée annulée.** Le terrain rouvre : on revient en arrière
   sans avoir rien perdu.
3. **Corriger une soirée sans la détruire.** Aujourd'hui, changer l'heure, le
   lieu ou le titre d'une soirée n'est possible que par « supprimer et
   recréer » — c'est le seul usage honnête de la suppression, et il coûte tout
   ce qui pendait à la soirée.
4. **Savoir ce qu'on va perdre avant de le perdre.** Si un geste détruit
   quelque chose, il le nomme — combien de réponses, combien de paiements,
   quelle compo, combien de matchs — avant, et pas par « Êtes-vous sûr ? »
   (constitution, article V).
5. **Ne jamais se faire mentir sur le résultat.** Un échec se dit.

## Ce qu'on ne doit PAS faire

- **Garder une suppression dure « pour les cas où ».** Le calendrier la défait
  tout seul : ce n'est pas un compromis, c'est un geste qui ne tient pas.
- **Fabriquer un cul-de-sac en la retirant.** Tant que corriger l'heure d'une
  soirée passe par « supprimer et recréer », lui retirer la suppression sans
  rien ouvrir d'autre enfermerait le capitaine (article V). Les deux vont
  ensemble.
- **Toucher aux matchs déjà joués.** Un match survit à l'annulation de sa
  soirée, et il garde son rattachement. Ce lot empêche de détacher en masse ;
  il ne détache rien.
- **Inventer une corbeille.** Rien ne s'efface veut dire « on annule », pas
  « on garde trente jours ».

---
## Questions tranchées

### Une soirée peut-elle jamais être vraiment supprimée ?

**Oui — et c'est le contenu qui décide, pas le statut. Tranché par Ibrahima le
18 septembre 2026, sur le précédent du lot 0006.**

Une soirée sans match, sans réponse et sans compo n'a rien à perdre : la
supprimer est sans effet secondaire. Dès qu'il y a quelque chose — une seule
réponse, un seul euro, une compo, un match — elle s'annule et reste au
calendrier, marquée, avec son motif.

C'est mot pour mot ce que 0006 a fait pour les matchs, et c'est le même
vocabulaire : **un seul bouton, une seule fonction serveur qui choisit** — pas
deux boutons « Annuler » et « Supprimer » à côté l'un de l'autre. Le lot 0006
a explicitement tranché contre les deux boutons ; on ne le refait pas.

Ce que ça règle concrètement : le calendrier annuel pose 44 soirées d'un coup,
et un lundi de trop se retire proprement tant que personne n'y a touché.

### Et corriger une soirée, sans la détruire ?

**Dans ce lot — tranché le 18 septembre 2026.** Aujourd'hui, changer l'heure,
le lieu, le titre ou le prix du terrain d'une soirée n'est possible **que**
par « supprimer et recréer » : aucun code n'écrit ces champs après coup.

C'est le seul usage honnête qui restait à la suppression dure. Lui retirer la
suppression sans ouvrir la correction enfermerait le capitaine dans un
cul-de-sac que l'article V interdit. **Les deux vont ensemble, ou ni l'un ni
l'autre.**

### Le geste vit-il aussi dans l'app ?

**Oui, des deux côtés — tranché le 18 septembre 2026.** Aujourd'hui l'app ne
peut ni annuler ni corriger une soirée : aucune route HTTP ne l'expose, et le
seul chemin du produit est un bouton du site réservé aux admins.

**Ce que ça impose, et qui n'est pas négociable :** la règle « annuler ou
supprimer, selon ce qu'il y a à perdre » ne peut pas vivre dans une action
serveur Next, puisque l'app ne les appelle pas. Elle vit dans une fonction
partagée, appelée par les deux portes — exactement comme
`annulerOuSupprimerMatch` pour les matchs (article III). Sans ça, la règle se
dédoublerait à la première ouverture, et diverge­rait à la deuxième.

### Les quatre choses que le code avait déjà tranchées

*Cherchées dans le code avant d'être posées.*

- **Une soirée s'annule, elle ne s'efface pas.** Ce n'est pas une proposition
  de cette spec : c'est écrit dans le schéma, trois lignes au-dessus du champ
  (`prisma/schema.prisma:281-283`), dans l'export iCal
  (`app/api/cal/[token]/route.ts:122-124`) et dans la base du produit
  (`specs/0000-le-club-et-lapp/regles.md:154`). Trois endroits, le même texte,
  et aucun écran qui l'applique.
- **Le mécanisme d'annulation existe déjà, complet.** `annulerSoiree` et
  `retablirSoiree` (`app/actions/calendrier.ts:43,64`) : gardées, vérifiées,
  motif tronqué à 120 caractères, refus explicite. Sans aucun appelant depuis
  le premier jour. Le lot les branche, il ne les écrit pas.
- **Une soirée annulée garde ses présences et ses euros.** `calculerPresences`
  classe titulaires et liste d'attente avant de regarder l'annulation, et le
  bilan de saison somme le prix du terrain de toutes les soirées. L'annulation
  ne coûte donc rien de ce que la suppression détruit.
- **Le bouton client n'est pas en cause pour le succès menti.** Il lit
  `res.ok`, affiche l'erreur et ne navigue qu'en cas de succès
  (`app/c/[slug]/sessions/[id]/DeleteSessionButton.tsx:50-56`). Tout le
  mensonge vit dans l'action
  serveur, qui ne lui envoie jamais `false`. La réparation est à un seul
  endroit.

---
## À quoi on saura que c'est fait

*Chaque ligne se vérifie par une commande ou par un écran nommé
(constitution, article VIII).*

- [ ] **Une soirée qui a quelque chose à perdre ne s'efface plus.** Un match,
      une réponse, un euro ou une compo : elle s'annule, et tout survit.
      Vérifié par un test sur la fonction partagée, contre la base locale —
      les quatre contenus, un par un.
- [ ] **Une soirée vide s'efface pour de vrai.** Aucun match, aucune réponse,
      aucune compo : rien n'est perdu, la suppression reste ce qu'elle est.
      Même test, cas inverse.
- [ ] **Les matchs ne sont plus jamais détachés en masse.** Après le geste,
      aucun match du club n'a perdu sa soirée. Vérifiable en comptant les
      `matchDayId` nuls avant et après, dans le test.
- [ ] **Qui a payé survit.** Une soirée avec des paiements, annulée, les
      rend encore — et le bilan de la caisse ne bouge pas.
- [ ] **Le refus est vu.** Un échec de l'action se lit à l'écran, des deux
      côtés. Plus de `{ ok: true }` sur une erreur avalée.
- [ ] **La confirmation dit ce qui va se passer**, avec les nombres : « trois
      matchs, huit réponses dont cinq payées, une compo ». Jamais « Êtes-vous
      sûr ? » (article V). Vérifié à l'œil, sur une soirée d'essai qui porte
      les quatre.
- [ ] **Une soirée annulée se rétablit**, et retrouve tout.
- [ ] **On corrige une soirée sans la détruire** : heure, lieu, titre, prix du
      terrain. C'est ce qui ferme le dernier usage honnête de la suppression.
- [ ] **La règle vit à un seul endroit**, appelée par le site et par l'app —
      pas recopiée dans une action serveur d'un côté et une route de l'autre
      (article III).
- [ ] **L'app peut annuler et corriger une soirée**, avec les mêmes refus et
      les mêmes messages que le site.
- [ ] `npx tsc --noEmit` vert des deux côtés · `npm test` (site) et
      `npm run tester` (app) verts · `cd five-scorer-mobile && node
      scripts/jeu-dessai.mjs && node scripts/parcours-lecture.mjs` en TOUT
      VERT · `npx expo export --platform ios` en 0 · `next build` en 0, dans
      un dossier à côté.
- [ ] **Vu dans le simulateur, à côté de la page du site** (article VII).

---

## Les cas de la base que ce lot referme

*Statuts et gravités rouverts un par un dans `cas.md` le 18 septembre 2026.
La leçon écrite d'avance : le lot 0001 avait annoncé 27 cas et n'en a refermé
que 15. **Ce lot en annonce trois.***

- **`SOIREE-51`** (⚠ faux · *gêne une saison*) — « le capitaine supprime une
  soirée où trois matchs ont été joués » → « soit refusé, soit dit clairement
  ce qui part ». Refermé des deux façons : refusé quand il y a quelque chose,
  et dit quand il n'y a rien.
- **`SOIREE-D3`** (⚠ faux · *gêne une saison*) — la même chose avec les
  paiements : « trois matchs joués, huit personnes avaient payé » → « rien ne
  doit continuer à compter en orphelin ».
- **`SOIREE-52`** (◐ partiel · *confort*) — l'action ment sur son succès.

### Débloqués, pas refermés

- **`SOIREE-61`** (✗ absent · *gêne un lundi*) et **`REG-71`** (✗ absent ·
  *gêne une saison*) — corriger une soirée. Ce lot ouvre l'heure, le lieu, le
  titre et le prix ; ces deux cas demandent davantage. À rouvrir à la
  livraison pour dire exactement ce qui reste.
- **`SOIREE-47`** (✗ absent · *gêne une saison*) — à relire à la livraison.

### Explicitement hors lot

- **`APRES-24`** (✗ absent · *confort*) — remettre au programme un *match*
  annulé. Un autre objet. La spec 0006 l'avait écarté en écrivant que « le
  mécanisme de retour n'existe même pas pour les soirées » : c'était faux,
  `retablirSoiree` existait déjà. La correction est notée ici ; le cas reste
  ouvert.

### Deux erreurs à corriger dans des specs déjà livrées

*Article VIII : une affirmation vérifiable et fausse dans une spec livrée
envoie travailler au mauvais endroit.*

- **`specs/0007-le-match-du-lundi/spec.md`** écrit, en écartant ce lot :
  « Aucun cas de la base ne le décrit ; il en faudra un, et un lot. »
  **C'est faux** — `SOIREE-51` et `SOIREE-D3` le décrivent depuis le
  10 septembre.
- **`specs/0006-annuler-un-match/spec.md`** écrit, en écartant `APRES-24` :
  « le mécanisme de retour n'existe même pas pour les soirées aujourd'hui ».
  **C'est faux** — `retablirSoiree` existait déjà.

### Et un chiffre de la base à recompter

L'article II de la constitution annonce **sept** suppressions dures restantes,
en citant `specs/0000-le-club-et-lapp/spec.md:229-240`. Ces adresses ont
toutes bougé depuis le 10 septembre, une a été refermée à moitié par 0006, et
au moins une suppression dure n'a jamais été comptée. Le chiffre se recompte à
la livraison, et la constitution se corrige si besoin — c'est ce que son
article VIII exige d'elle-même.

## Ce que ça débloque

Le mot « supprimer » redevient vrai une seconde fois : après les matchs
(lot 0006), les soirées. Quand le produit le dit, c'est qu'il n'y avait rien à
perdre.

Et l'article II de la constitution perd son exemple. Il restera vrai — « rien
ne s'efface » est un vœu qui se paie lot par lot — mais la phrase écrite sous
lui depuis le 10 septembre, *« supprimer une soirée efface qui a payé »*,
cessera de décrire le produit.
