# 0000 — Le club et l'app

*La spec produit. Écrite le 10 septembre 2026, à partir d'un balayage de tout ce
qu'on peut faire avec Five Scorer — huit domaines, puis six regards : le
gymnase, le nouveau venu, le capitaine sur une saison, celui qui vient une fois
sur trois, le téléphone lui-même, et les données. **549 cas**, chacun vérifié
dans le code.*

*État : à valider. Rien n'est à faire tant que les questions du § « Ce que seul
le club peut trancher » n'ont pas de réponse.*

**Annexes** — [les 549 cas](cas.md) · [les 298 règles](regles.md) ·
[les 184 questions](questions.md)

---

## 1. De quoi on parle

Un club de foot à cinq. Une quinzaine de personnes, un gymnase, tous les lundis
soir, de septembre à juillet. On se répartit en deux camps, on joue, on compte
les buts. Quelqu'un tient la feuille — debout, à une main, entre deux matchs,
en jouant aussi.

Five Scorer, c'est deux choses qui doivent dire la même :

- **le site** (`five-scorer.vercel.app`), qui tourne en production et que le
  club utilise vraiment ;
- **l'app** (Expo / React Native), qui est en train de le rejoindre écran par
  écran.

Ce document ne décrit pas ce qu'on aimerait construire. Il décrit **ce que le
club fait déjà**, ce que le code en tient, et où les deux ne se rejoignent pas.

## 2. Ce qui compte, dans l'ordre

Cet ordre-là n'est pas un avis, c'est ce qui sort du balayage. Il sert à
trancher quand deux choses se disputent le même après-midi de travail.

1. **Le lundi soir ne doit pas s'arrêter.** Le gymnase n'a pas de réseau. La
   feuille doit se tenir sans lui, et rien de ce qui a été tapé ne doit
   disparaître.
2. **Les chiffres doivent être vrais.** Le classement, l'Élo, la forme, les
   records : ils ne valent que si on peut réparer une faute de frappe, et
   qu'aucun écran ne raconte autre chose qu'un autre.
3. **Rien ne s'efface.** Un joueur qui part s'archive, un match qui n'a pas eu
   lieu s'annule, un membre retiré laisse ses buts au club. Un classement de
   saison ne se réécrit pas parce que quelqu'un a déménagé.
4. **Personne ne doit rester coincé.** Ni le nouveau devant une liste vide, ni
   celui qui a oublié son mot de passe, ni celui qui s'est trompé de fiche.
5. **Le reste.**

## 3. Où on en est

| | fait | partiel | absent | **faux** |
|---|---|---|---|---|
| **549 cas** | 160 | 159 | 96 | **134** |

- **fait** — ça marche, des deux côtés.
- **partiel** — ça marche d'un seul côté, ou à moitié.
- **absent** — rien ne le fait.
- **faux** — ça existe, et ça se trompe. **C'est la pire des quatre**, parce que
  personne ne va vérifier ce qui a l'air de marcher.

Par gravité : **49 cas bloquent un lundi**, 140 en gênent un, 152 gênent une
saison, 208 relèvent du confort.

## 4. La découverte du balayage

Elle tient en une phrase : **une règle tenue par l'affichage n'est pas une
règle.**

Sur les 298 règles relevées, **une sur quatre n'est tenue que par l'écran qui
la dessine** — un bouton caché, une condition dans du JSX — et **une vingtaine
ne sont tenues par personne** : on croit les avoir.

Ce ne sont pas des détails d'architecture. Chacune se paie un lundi soir :

- **« C'est moi » ne s'offre qu'à qui n'a pas déjà une fiche** — mais le serveur
  laisse un membre qui a déjà un profil en prendre un autre. La règle est dans
  le JSX de deux écrans, à recopier à chaque nouvel écran.
- **Un but se crédite à quelqu'un qui a joué CE match** — tenue par personne.
- **L'homme du match est un joueur de la feuille** — tenue par le serveur pour
  le vote, par personne pour la désignation à la main.
- **Un seul match en direct à la fois** — voulu par trois écrans, vérifié à la
  création par aucun.
- **Un même compte n'est membre d'un club qu'une fois** — tenue par personne.
- **La part du terrain se répartit entre ceux qui jouent** — mais on peut cocher
  « a payé » sur n'importe quelle réponse, liste d'attente comprise.
- **Le résumé des réglages affiche huit caractères en capitales** —
  `inviteCode.slice(-8).toUpperCase()` — **qui ne sont pas un code
  d'invitation.** Le serveur cherche l'identifiant ENTIER
  (`lib/rejoindre.ts:135`, `findUnique({ where: { inviteCode } })`). Le lien
  complet est bien là, dans le volet déplié, avec son bouton « Copier » ; mais
  ce qu'on lit à l'écran quand il est replié ressemble à un code, se lit au
  téléphone comme un code, et ne marche pas. *Vérifié :
  `app/c/[slug]/settings/page.tsx:79` contre `lib/rejoindre.ts:56-78,135`.*

**Ce que ça implique :** avant d'ajouter des écrans, il faut redescendre les
règles là où elles tiennent — dans le serveur, et dans les fonctions partagées
que le site et l'app lisent toutes les deux. Le dépôt sait déjà le faire :
`lib/joueur.ts`, `lib/rattachement.ts`, `lib/rejoindre.ts`, `lib/calendrier.ts`
sont nées de ce mouvement, et `copie-conforme.test.ts` vérifie qu'elles ne se
dédoublent pas.

## 5. Ce qui bloque un lundi

Les 49 cas de gravité maximale, regroupés par ce qu'ils cassent.

### 5.1 On ne peut plus entrer

- **Mot de passe oublié : il n'y a rien.** Aucun email n'est jamais envoyé par
  ce produit — ni vérification, ni réinitialisation, ni invitation. Aucun admin
  ne peut réinitialiser. Une session dure 90 jours : celui qui n'est pas venu de
  l'été revient en septembre devant un mur définitif. *(`COMPTE-05`)*
- **Le nouveau à qui on lit le code au téléphone** entre les huit caractères
  affichés, que le serveur refuse (§ 4). Il faut lui envoyer le LIEN.
  *(`REG-N01`)*
- **Un 404 ne dit pas ce qu'il est** : retiré du club, session morte, ou faute
  de frappe ? Le membre ne peut pas savoir quoi faire. *(`TRANS-47`)*

### 5.2 Le gymnase

- **Démarrage à froid sans réseau** : l'app ne repart pas comme il faudrait sur
  une feuille en cours. *(`COMPTE-11`)*
- **Le téléphone du marqueur meurt** et quelqu'un d'autre sort le sien : la
  feuille en cours est sur l'appareil mort. *(`HL-04`)*
- **Le Wi-Fi d'Urban Soccer se raccroche tout seul** — un réseau connu mais sans
  Internet, ce qui est pire que pas de réseau du tout. *(`HL-12`)*
- **La mémoire du téléphone est pleine** (les photos du week-end) et SQLite
  refuse d'écrire : le but est joué à l'oreille AVANT l'écriture, donc on entend
  le but qui n'a pas été enregistré. *(`DIRECT-24`)*
- **« Terminer » sans réseau** ne referme pas la feuille tant qu'on n'a pas le
  serveur. *(`APRES-05`)*
- **L'app plante en plein match** : rien ne la rattrape. *(`TRANS-40`)*
- **Une pastille dit « 3 refusées »** sans dire lesquelles ni permettre de
  réessayer. *(`TRANS-13`)*

### 5.3 On perd du travail

- **Se déconnecter depuis « Mes clubs »** contourne l'avertissement et la purge
  du menu du club : une soirée non synchronisée part sans un mot. *(`TRANS-16`)*
- **Le site et l'app ont la doctrine INVERSE** sur ce point : le site garde la
  file d'envoi à la déconnexion (« une file non partie n'est pas à moi »),
  l'app vide tout (« un téléphone prêté ne doit pas montrer le club précédent »).
  Les deux se défendent ; il faut choisir.

### 5.4 Les droits

- **Un admin peut se mettre lui-même sur « Membre »**, et se retirer ses propres
  droits sans recours. *(`REG-27`)*
- **Sur le site, un admin peut se retirer lui-même du club** — l'app s'en
  protège, le site non, et son propre commentaire le dit. *(`REG-28`)*
- **Les routes d'organisation de Better Auth sont montées et répondent**
  (`/api/auth/organization/leave`, `remove-member`, `update-member-role`,
  `delete`…), avec les règles de Better Auth et pas celles du club : ni
  déliement de fiche, ni doctrine « rien ne supprime ». *(`REG-49`)*
- **Aucune limite de débit, nulle part** : ni sur la connexion, ni sur le code
  d'invitation, ni sur les routes du club.

### 5.5 Les versions

- **Rien ne se met à jour à distance.** Une version qui part avec un bug le
  dimanche reste sur les téléphones le lundi. *(`TRANS-37`)*
- **L'app ne dit pas sa version, le serveur n'en exige aucune.** Un champ
  obligatoire de plus côté serveur casse les téléphones qui n'ont pas suivi.
  *(`TRANS-38`)*
- **Le miroir local n'a pas de version de schéma** : tout est en
  `CREATE … IF NOT EXISTS`, donc une colonne ajoutée plus tard n'apparaît jamais
  chez ceux qui ont déjà l'app. *(`TRANS-39`)*

## 6. Là où le site et l'app se contredisent

Ce sont les plus coûteuses : deux écrans qui affichent deux chiffres différents
pour la même chose détruisent la confiance dans les deux.

- **La minute d'un but.** Site : le chrono de jeu, pauses exclues. App : le
  temps écoulé depuis le coup d'envoi. Le serveur accepte n'importe quoi.
- **Le fuseau horaire.** Le site pose `Europe/Paris` en constante ; l'app n'a
  aucun équivalent et lit celui du téléphone. Un club qui joue à 20 h vu depuis
  Montréal ne voit pas le même lundi.
- **La déconnexion** (§ 5.3).
- **Un match annulé** est étiqueté « Terminé », score 0–0, par la page soirée du
  site comme par l'API que lit l'app.
- **L'équipe de départ contre l'équipe de fin.** Les statistiques lisent
  `initialTeam` ; la feuille du récap, elle, n'est tenue par personne.
- **Le récap.** L'app le lit toujours au serveur ; le site lit parfois sa base
  locale entre deux matchs.

## 7. Ce que le produit doit tenir, et qui doit le tenir

Ce paragraphe est la seule partie prescriptive de cette spec. Le reste constate.

1. **Toute règle qui protège un chiffre ou un droit est tenue par le serveur.**
   L'écran peut la répéter pour ne pas proposer un bouton qui sera refusé ; il
   ne peut pas en être le seul gardien.
2. **Toute règle que le site et l'app partagent vit dans une fonction unique**,
   importée des deux côtés, avec un test qui échoue si elle se dédouble.
3. **Tout geste qui ne se rattrape pas laisse une trace** : quoi, par qui,
   quand. Aujourd'hui aucun n'en laisse — ni une correction de match, ni un
   changement de rôle, ni un réglage, ni un rattachement de fiche.
4. **Tout refus est écrit en français et dit quoi faire.** Un 404 muet, une
   pastille « 3 refusées », un écran qui ne réagit pas : ce sont des culs-de-sac.
5. **Rien ne s'efface** (§ 2.3). La seule exception qui subsiste, `deleteMatch`,
   doit disparaître — voir la spec [0001](../0001-corriger-un-match/spec.md).

## 8. Ce que seul le club peut trancher

**184 questions** sont sorties du balayage — [questions.md](questions.md). Elles
sont posées avec ce que le code fait aujourd'hui entre parenthèses, parce qu'un
défaut qui dure depuis un an est déjà une réponse : il faut juste savoir si
c'est celle qu'on voulait.

Les cinq qui commandent les autres :

- **Q-A. Qui entre dans le club ?** Aujourd'hui, le lien WhatsApp vaut accord du
  capitaine : entrée directe, définitive, code permanent. Faut-il une
  validation, une expiration, un usage unique ?
- **Q-B. Que fait-on de celui qui a oublié son mot de passe ?** Aucun email
  n'existe dans ce produit. En ouvrir un (vérification, réinitialisation,
  invitation) est un chantier à part entière, et c'est la porte de sortie de
  plusieurs murs.
- **Q-C. Qui peut corriger, et pendant combien de temps ?** Aucune fenêtre
  n'existe : un match d'il y a six mois se corrige, se vote et se supprime comme
  celui d'hier, et une saison clôturée ne protège rien.
- **Q-D. Que garde-t-on à la déconnexion ?** Le site et l'app font l'inverse
  l'un de l'autre, chacun avec une bonne raison (§ 5.3).
- **Q-E. Prévient-on les gens ?** Rien ne notifie personne, jamais. Une soirée
  annulée à 17 h le lundi n'atteint que ceux qui rouvrent l'app.

## 9. Ce qu'on fait de ce document

Il ne se termine pas : il se relit. Chaque lot à venir part d'ici — on prend une
poignée de cas, on écrit une spec numérotée qui les cite par leur identifiant,
et on coche.

Ce document est vrai **au 10 septembre 2026**, dans l'état du dépôt à
`653d3f0`. Chaque cas porte le fichier et la ligne où on l'a vérifié ; quand le
code bouge, c'est là qu'il faut revenir.

## 10. À quoi on saura que le balayage a servi

- [ ] Les 49 cas qui bloquent un lundi sont soit réparés, soit refusés
      explicitement dans ce document avec la raison.
- [ ] Plus aucune règle du § 4 n'est tenue par le seul affichage.
- [ ] Le site et l'app ne se contredisent plus sur aucun des six points du § 6.
- [ ] Les cinq questions du § 8 ont une réponse écrite ici.
- [ ] `scripts/parcours-lecture.mjs` couvre chaque cas réparé, et reste TOUT
      VERT sur trois passages d'affilée.

---

### Ce que ce document n'a pas eu

**La critique de complétude n'a pas tourné** — l'agent chargé de chercher ce que
les quatorze autres avaient manqué est tombé sur la limite de session. Ce
balayage n'a donc pas été relu par un regard neuf. C'est la première chose à
faire avant de considérer la spec close.
