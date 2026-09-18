# 0006 — Annuler un match, au lieu de l'effacer

*Demandé le 13 septembre 2026 : « donne moi aussi la main de supprimer des
matchs ». Écrit après avoir trouvé que ce que le site appelle « supprimer »
contredit la spec 0001 et l'article II de la constitution.*

---

## Le problème

**Le bouton « Supprimer » du site efface, et l'app n'a rien du tout.**

La spec 0001 avait déjà tranché : *« Rien dans l'app ne supprime. »* La base
produit (`cas.md`, `APRES-25`) montre que le site ne tient pas cette promesse :
sur tout match terminé ou annulé, un admin a un bouton « Supprimer », confirmé
par un seul « Sûr ? », qui fait `prisma.match.delete(...)`. Buts, compo, votes,
convocations partent avec, sans trace, sans corbeille. Les stats, l'Élo et la
forme se recalculent comme si le match n'avait jamais existé.

**Et l'appel peut mentir.** `APRES-26` : la suppression avale toute erreur
(`.catch(() => null)`) et redirige comme si c'était fait — un match qui
survit à un échec de suppression, sans que personne ne le sache.

**Et il n'y a pas d'alternative.** `APRES-23` : un match lancé par erreur
(mauvais soir, test, doublon) ou terminé alors qu'il n'a jamais eu lieu n'a que
deux issues : le supprimer (tout perdre), ou le terminer à 0–0 (un faux match
compte au classement et bouge l'Élo de dix personnes). Le serveur sait déjà
annuler un match — mais seulement s'il est `SCHEDULED`, jamais s'il a démarré.

**Ce qui rend ce lot petit plutôt que gros :** `Match.status` porte déjà la
valeur `CANCELED` dans son énumération (`prisma/schema.prisma:344`). Le
mécanisme existe. Il n'est simplement ouvert qu'à un seul statut de départ.

---

## Pour qui, et quand

**Malik, mardi matin.** Le lundi soir, quelqu'un a lancé un deuxième match par
erreur en tapant deux fois sur « Nouveau match » — deux feuilles vides tournent
en même temps, 0–0. Il veut faire disparaître le doublon proprement, depuis son
téléphone, sans expliquer au club pourquoi le classement a bougé.

**Un admin, sur le site, un mois plus tard.** Un match test créé pendant qu'on
réglait un problème technique traîne dans l'historique. Il n'a jamais compté
pour personne — zéro participant, zéro but. Celui-là, on peut vraiment
l'effacer : il n'y a rien à perdre.

---

## Ce qu'on doit pouvoir faire

1. **Annuler un match LIVE ou FINISHED**, pas seulement SCHEDULED — le geste
   que `APRES-23` réclame. Le match reste visible, marqué annulé, avec une
   raison optionnelle (120 caractères, comme `MatchDay.cancelReason`).
2. **Depuis l'app**, le même geste que le site : aucun aujourd'hui.
3. **Voir un vrai refus** si l'annulation échoue — plus de succès menti
   (`APRES-26`).
4. **Un match jamais joué peut être vraiment effacé.** SCHEDULED, zéro
   participant, zéro événement : rien n'est perdu, la suppression reste ce
   qu'elle est.

## Ce qu'on ne doit PAS faire

- **Effacer un match qui a une feuille** — but, participant, ou vote MVP. Dès
  qu'il y a quelque chose à perdre, le geste devient une annulation, jamais un
  effacement.
- **Changer le sens du bouton sans le dire.** Le mot affiché doit correspondre
  au geste réel : « Annuler » quand ça annule, « Supprimer » seulement quand
  ça efface pour de vrai un match vide.
- **Retirer le pouvoir déjà écrit ailleurs.** `cancelScheduledMatch` continue
  de marcher pour un SCHEDULED — ce lot l'étend, ne le remplace pas.

---

## Questions tranchées

### Annuler ou supprimer : qui décide, et sur quel critère ?

**Le contenu du match, pas son statut.** Un match SCHEDULED sans participant
ni événement n'a rien à préserver — le supprimer est sans perte, exactement
l'article I (rien de saisi ne disparaît) au sens strict : rien n'a été saisi.
Dès qu'un événement ou un participant existe (donc dès LIVE, en pratique),
l'article II impose l'annulation.

**Le même bouton, une seule action serveur qui choisit.** Pas deux boutons à
maintenir, pas un choix laissé à l'utilisateur qui devrait deviner lequel
utiliser : la fonction regarde le match et fait le geste qui préserve ce qu'il
y a à préserver.

### Le champ `cancelReason` — obligatoire ?

**Non, comme sur `MatchDay`.** Le forcer découragerait le geste au moment où
il est le plus utile (au milieu d'un match qu'on vient de comprendre comme un
doublon). Optionnel, 120 caractères, comme le précédent déjà écrit.

### Qui a le droit ?

**`canManage`, comme le site aujourd'hui** (`ctx.canManage` dans
`cancelScheduledMatch` et `deleteMatch`). Annuler un match a le même poids
qu'annuler une soirée entière — pas un geste de simple marqueur.

### Un match annulé peut-il être réactivé ?

**Hors lot.** `APRES-24` le demande pour une SOIRÉE annulée, pas pour un
match — pas mélangé ici. Un match annulé par erreur se relance en créant un
nouveau match ; c'est un geste rare.

*Correction du 18 septembre 2026 : cette décision s'appuyait aussi sur « le
mécanisme de retour n'existe même pas pour les soirées aujourd'hui ». C'était
faux — `retablirSoiree` (`app/actions/calendrier.ts:64`) existait déjà quand
ces lignes ont été écrites, complète et sans un seul appelant. La conclusion
(hors lot) ne change pas ; sa raison, si. Trouvé par la recherche du lot
0008.*

### Le lien public `/r/[id]` d'un match annulé ?

**Hors lot**, et noté pour ne pas repasser pour un oubli. `APRES-28` : un
match supprimé rend une 404 nue au lieu d'un mot pour les quinze personnes
qui ont le lien WhatsApp. Un match ANNULÉ, lui, reste trouvable (il n'est pas
supprimé) — c'est déjà une amélioration silencieuse de ce lot, mais la 404 nue
du cas où un match est vraiment effacé (SCHEDULED vide) reste un défaut, pour
un lot séparé.

---

## À quoi on saura que c'est fait

- [ ] Un match LIVE ou FINISHED s'annule (statut, `canceledAt`, `cancelReason`
      optionnel écrits) ; ses buts, sa compo, ses votes restent en base
      intacts.
- [ ] Un match annulé compte pour **zéro** part­out où `FINISHED` seul comptait
      aujourd'hui — classement, Élo, forme, records, bilan de soirée. Vérifié
      en le regardant, pas en le supposant.
- [ ] Un match SCHEDULED sans participant ni événement s'efface pour de vrai ;
      un SCHEDULED qui EN a un (ou plus) s'annule à la place.
- [ ] **L'écran d'un match annulé distingue les deux origines.** Aujourd'hui
      `app/c/[slug]/matches/[id]/page.tsx:77-96` suppose qu'un match CANCELED
      vient toujours d'un SCHEDULED et affiche « Était prévu le … » — juste
      pour un match jamais joué, faux pour un LIVE/FINISHED annulé après coup.
      Celui-là doit montrer ce qui s'est passé (score, buteurs) sous un
      bandeau « Annulé », pas une fausse convocation.
- [ ] Le refus est vu : un échec de l'action se lit à l'écran, sur le site
      comme sur l'app — plus de redirection silencieuse sur un échec.
- [ ] L'app peut faire le même geste que le site, avec le même critère
      annuler/effacer.
- [ ] `cancelScheduledMatch` (le chemin existant) continue de passer ses cas
      d'usage actuels sans régression.
- [ ] `tsc --noEmit` vert des deux côtés, `npm run tester` vert, `expo export
      --platform ios` en 0, `next build` (à côté, jamais dans le `.next` d'un
      serveur de dev vivant) en 0.
- [ ] Vu dans le simulateur, à côté de la page du site (article VII).

---

## Les cas de la base que ce lot referme

*Comptés en ouvrant `cas.md`, pas de mémoire.*

- **`APRES-25`** (⚠ faux) — la suppression existe, efface tout, sans trace.
  Refermé : l'effacement ne s'applique plus qu'à un match vide ; le reste
  s'annule et reste visible.
- **`APRES-26`** (⚠ faux) — l'échec de suppression est avalé et menti.
  Refermé : le retour de l'action est lu et affiché des deux côtés.
- **`APRES-23`** (✗ absent) — un match lancé par erreur ne peut qu'être
  supprimé ou faussement terminé. Refermé : il s'annule, à tout statut.

**Explicitement laissés hors lot**, pour qu'ils ne repassent pas pour des
oublis : `APRES-24` (réactiver une soirée annulée — un autre objet), `APRES-28`
(page publique d'un match vraiment effacé — reste une 404 nue).

## Ce que ça débloque

Le mot « supprimer » redevient vrai : quand l'app ou le site le disent,
c'est qu'il n'y avait rien à perdre. Et Malik peut nettoyer un doublon du
lundi soir depuis son téléphone, sans avoir à ouvrir un ordinateur.
