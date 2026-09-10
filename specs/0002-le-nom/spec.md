# 0002 — Le nom

*État : à valider · Écrite le 10 septembre 2026, après qu'Ibrahima a tranché
« on change maintenant ». Tous les chiffres de ce document ont été comptés le
jour même, avec la commande donnée au § 3 — pas repris d'un autre document.*

## Le problème

**« Five » nomme deux choses à la fois : un sport et un nombre de joueurs.**

Le 10 septembre 2026, on a décidé que le sport appartient au créneau et non au
club (constitution, article IX) : le même groupe doit pouvoir faire du foot le
lundi et du badminton le jeudi. Et le moteur porte déjà ça — il ne fait pas du
football, il fait « deux camps, un événement qui marque » : `recomputeScore`
COMPTE des buts (`_count._all`,
`five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30`), il n'en somme
jamais les valeurs. `Club.format` existe avec cinq valeurs et **ne pilote
rien** — aucun branchement dans les deux dépôts.

Un produit qui dit « le sport est un réglage » sous un nom qui dit « c'est du
foot à cinq », c'est une contradiction affichée sur l'écran d'accueil.

**Et le prix de ce nom ne fait que monter.** Quinze téléphones portent
aujourd'hui le build 3. Chaque installation supplémentaire ajoute une personne à
qui il faudra expliquer quelque chose.

## Pour qui, et quand

Pour le club, une fois, un soir qui n'est pas un lundi. Pour tous ceux qui
arriveront après, jamais — ils ne connaîtront que le nouveau nom.

## Ce qu'on doit pouvoir faire

1. **Changer ce que les gens VOIENT** : le nom de l'app sur l'écran d'accueil du
   téléphone, le titre du site, le manifeste, les textes de l'interface, le
   domaine.
2. **Garder tout le monde connecté.** Personne ne doit avoir à retrouver son mot
   de passe — il n'y a d'ailleurs aucun moyen de le faire (spec 0000,
   `COMPTE-05`).
3. **Ne rien perdre de ce qui attend le réseau.** Une soirée non synchronisée
   sur un téléphone doit survivre au changement.
4. **Ne pas dupliquer les agendas.** Quinze personnes ont un abonnement iCal
   dans leur téléphone.

## Ce qu'on ne doit PAS faire

**Renommer les identifiants.** C'est la proposition centrale de cette spec, et
elle va contre l'intuition.

Un identifiant technique n'est pas une marque. Personne ne voit
`com.ibc.fivescorer`, personne ne voit `fivescorer://`, personne ne voit
`five-scorer.db`. Les renommer ne rend le produit ni plus ni moins ouvert aux
autres sports — mais chacun coûte cher, et pour rien :

| Identifiant | Où | Ce que le renommer coûte |
|---|---|---|
| `SCHEMA = "fivescorer"` | `five-scorer-mobile/lib/api.ts:21` | Il sert AUSSI de `storagePrefix` du trousseau (`five-scorer-mobile/lib/auth-client.ts:31-32`) : le changer **déconnecte tout le monde**. Et le serveur ne fait confiance qu'à `fivescorer://` (`five-scorer/lib/auth.ts:49`). |
| `NOM_BASE = "five-scorer.db"` | `five-scorer-mobile/lib/outbox/baseExpo.ts:19` | Nouveau nom = **miroir vide** = la file d'envoi non partie est perdue. |
| `super("five-scorer")` | `five-scorer/lib/db.ts:207` | Idem côté navigateur : la base locale du site repart vide. |
| `UID:${s.id}@five-scorer` | `five-scorer/app/api/cal/[token]/route.ts:115` | **À geler pour toujours** : c'est l'identité d'un événement d'agenda. Le changer duplique toute la saison dans quinze téléphones. |
| `com.ibc.fivescorer` | `app.json` (iOS et Android) | Une **seconde app** à côté de la première, avec un miroir vide. Quinze personnes à qui demander de supprimer l'ancienne icône. |
| `fs-theme`, `fs-sound-enabled` | site et app | Le thème et le son reviennent à leur défaut. Sans gravité, mais sans gain non plus. |

**Aucun de ces six ne change.** Ce sont des noms de choses, pas des noms de
produit — et l'article X demande que ce qu'on ne fait pas soit écrit.

## Ce que ça coûte, mesuré

Compté le 10 septembre 2026, avec :

```
grep -rEoi "five[ _-]?scorer" . --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=.next --exclude-dir=.expo --exclude-dir=dist
```

- **1 114 occurrences dans 76 fichiers** au total ;
- **150 occurrences dans 66 fichiers hors Markdown** — le vrai poids : 32 dans
  l'app, 32 dans le site, 2 à la racine ;
- le reste (964) est dans la documentation, dont `five-scorer/MOBILE.md` à lui
  seul.

Une fois les six identifiants gelés, ce qui bouge vraiment se compte sur les
doigts : `app.json` (`name`), `manifest.webmanifest` (`name`, `short_name`), le
`<title>` du site, les quelques chaînes d'interface qui écrivent le nom, et les
répertoires du dépôt si on veut aller jusque-là.

**Ce n'est pas une journée de code. C'est une soirée.**

## Le nom lui-même

*À trancher par Ibrahima. Trois candidats, avec ce que chacun ferme.*

- **Ardoise** — le tableau où l'on marque à la craie, sans électricité : la
  promesse hors ligne dans le nom même. Et ce qu'on doit (« j'ai une ardoise »),
  qui est le sujet de la caisse. Aucun sport dedans, aucun nombre.
- **Chasuble** — le nom et l'objet sont la même chose : `Club.colorA/colorB` sont
  commentées « Couleurs des chasubles — l'identité visuelle du club »
  (`five-scorer/prisma/schema.prisma:174-178`) et `nomsChasubles()` rend déjà « les
  Orange ». *Mais au badminton du jeudi, on ne met pas de chasuble* — ce nom
  trace la frontière que l'article IX veut effacer.
- **Lundi** — le rythme plutôt que le sport ; le mot est déjà dans le dépôt
  (`eas.json`, le profil de build s'appelle `lundi`). *Mais il enferme dans un
  jour de la semaine ce qu'on veut libérer d'un sport, et il est introuvable
  dans un moteur de recherche.*

**Rien n'a été vérifié** : ni les domaines, ni l'INPI, ni l'App Store. À faire
avant d'annoncer — dix minutes.

## Les cas de la base que ce lot referme

**Aucun.** C'est un lot d'identité, pas de produit : il ne referme aucun des
549 cas de la spec 0000 et n'en ouvre aucun. C'est écrit ici pour que la
question ne se repose pas.

## À quoi on saura que c'est fait

- [ ] Le nom qui s'affiche sous l'icône, dans l'onglet du navigateur et sur
      l'écran de connexion est le nouveau, sur le site ET sur l'app.
- [ ] **Personne n'a été déconnecté** : les quinze téléphones ouvrent l'app sans
      redemander de mot de passe. Vérifié en demandant, pas en supposant.
- [ ] `enAttente` valait zéro sur chaque téléphone avant la bascule, et vaut
      toujours zéro après.
- [ ] Aucun agenda n'a dupliqué la saison — `UID:${s.id}@five-scorer` n'a pas
      bougé d'un octet (`five-scorer/app/api/cal/[token]/route.ts:115`).
- [ ] `grep -rEi "five[ _-]?scorer"` ne rend plus que : les six identifiants
      gelés, l'historique git, et les documents qui racontent le renommage.
      Chaque occurrence restante est **justifiée par une ligne de ce document**.
- [ ] `tsc --noEmit` vert des deux côtés, `next build` en 0,
      `expo export --platform ios` en 0, `npm run tester` vert dans
      `five-scorer-mobile`.
- [ ] Le tour rejoué dans le simulateur, à côté de la page du site
      (constitution, article VII).

## Ce que ça débloque

Rien, techniquement. Et c'est bien pour ça qu'il faut le faire maintenant : le
seul coût qui monte avec le temps, c'est celui-là. Après, on n'en reparle plus.
