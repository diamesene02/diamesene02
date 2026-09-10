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

Sur les 298 règles relevées, **39 ne sont tenues que par l'écran qui la
dessine** — une sur huit : un bouton caché, une condition dans du JSX — et
**33 ne sont tenues par personne** : on croit les avoir.

Ce ne sont pas des détails d'architecture. Chacune se paie un lundi soir :

- **« C'est moi » ne s'offre qu'à qui n'a pas déjà une fiche.** L'unicité, elle,
  est bien tenue — par la BASE (`prisma/schema.prisma:242`,
  `@@unique([clubId, userId])`) : un compte ne PEUT pas avoir deux fiches dans
  un club. Ce que le JSX tient seul, c'est le refus d'en **changer** :
  `lib/rattachement.ts` délie la fiche précédente dans la même transaction, si
  bien qu'un membre qui a déjà un historique peut en revendiquer une autre et
  **perdre la sienne sans un mot** — ses buts restent sur la fiche orpheline.
  La condition est dans deux écrans, à recopier à chaque nouvel écran.
- **Un but se crédite à quelqu'un qui a joué CE match** — tenue par personne.
- **L'homme du match est un joueur de la feuille** — tenue par le serveur pour
  le vote, par personne pour la désignation à la main.
- **Un seul match en direct à la fois** — voulu par trois écrans, vérifié à la
  création par aucun.
- **Un même compte n'est membre d'un club qu'une fois** — tenue par
  `lib/rejoindre.ts` sur le seul chemin d'entrée, par **rien** en base
  (`Member` n'a que des `@@index`, aucun `@@unique`), et par **rien** contre
  deux appareils qui entrent en même temps. Avec deux lignes, `lib/guard.ts`
  fait `findFirst` : **le rôle qui gagne est arbitraire**.
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
- **Le but qu'on entend et qui n'existe pas.** Sur l'app, `marquer`
  (`app/match/[id].tsx:270-286`) joue le son AVANT d'écrire — choix délibéré,
  « la tuile répond au doigt, pas à SQLite » — et **n'a aucun `try/catch`**,
  pas plus que `contreSonCamp` ni `donnerCarton`. Or `lib/match/local.ts:410`
  refuse d'écrire sur un match terminé ou pour un joueur hors feuille, et la
  mémoire du téléphone peut être pleine. Le marqueur entend son but, sent la
  vibration, et rien ne bouge. Le site, lui, attrape (`LiveMatch.tsx:344`).
  *Ce cas n'a pas de fiche dans l'annexe : le balayage l'a manqué, la relecture
  l'a trouvé.*
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

- **Un admin peut se mettre lui-même sur « Membre »** et se retirer ses propres
  droits. Pas irréversible — le capitaine ne peut jamais être rétrogradé, donc
  il peut re-promouvoir — mais ça coûte « il faut attendre le capitaine ».
  *(`REG-27`)*
- **Sur le site, un admin peut se retirer lui-même du club** — l'app s'en
  protège, le site non, et son propre commentaire le dit. *(`REG-28`)*
- **Les routes d'organisation de Better Auth sont montées et répondent**
  (`/api/auth/organization/leave`, `remove-member`, `update-member-role`,
  `delete`…), avec les règles de Better Auth et pas celles du club : ni
  déliement de fiche, ni doctrine « rien ne supprime ». *(`REG-49`)*
- **La limite de débit ne couvre que Better Auth.** Il limite ses propres
  routes tout seul en production — 3 tentatives de connexion par 10 s
  (`create-context.mjs:171`, `enabled: … ?? isProduction`) — mais **en
  mémoire**, donc par instance de fonction Vercel : elle fuit dès qu'il y en a
  deux. Et **rien** ne protège `/api/rejoindre`, `/api/clubs/**`, les server
  actions, ni `/api/public/[slug]` (CORS `*`). Le code d'invitation est donc
  bien exposé à la force brute.

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
5. **Rien ne s'efface** (§ 2.3) — et c'est un vœu, pas un état. **Sept chemins
   de suppression dure subsistent**, vérifiés :
   `app/actions/matches.ts:22` et son jumeau `matches/[matchId]/route.ts:217`
   (le même match, par deux portes) · `app/actions/matchday.ts:51`, **la soirée
   entière**, qui emporte en cascade ses réponses — donc qui a payé — et sa
   compo (`schema.prisma:307,455`) · `app/actions/opponents.ts:38` ·
   `app/actions/club.ts:143` et `membres/[memberId]/route.ts:87` (la ligne
   `Member`) · `app/actions/compo.ts:67,130` (toute la compo avant réécriture).
   Le soft delete a existé : `20260512191809_match_soft_delete` ajoutait
   `deletedAt` ; `20260824190000_v2_platform` a supprimé la table. Aucun `.ts`
   ne mentionne `deletedAt` aujourd'hui. Voir la spec
   [0001](../0001-corriger-un-match/spec.md).

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

## 8 bis. Ce que le balayage lui-même avait manqué

*Trouvé par une relecture adverse, le 10 septembre au soir, dont c'était le seul
travail : chercher les angles morts et attaquer les affirmations ci-dessus.
Chacun vérifié dans le code avant d'être écrit ici. Aucun n'a de fiche dans
[cas.md](cas.md) — c'est la première chose à y ajouter.*

### 8bis.1 Quelqu'un qui a quitté le club reste publié, avec sa photo

**`lib/stats.ts` ne contient pas une seule occurrence de `isArchived`.** Le
classement charge `player.findMany({ where: { clubId } })` (`:140`) sans filtrer
les archivés. Ce classement alimente la vitrine publique — `app/p/[slug]` et
`app/api/public/[slug]`, qui renvoie les photos (`:92`) avec
`access-control-allow-origin: *` (`:29`).

Donc : celui qui a quitté le club en janvier garde son nom et son visage sur une
page que n'importe qui peut ouvrir, et sur un endpoint que n'importe quel site
peut lire. Retirer un membre ne l'enlève pas non plus : `app/actions/club.ts:136-144`
délie le compte mais garde la fiche — nom, surnom, photo — rattachée à personne.
L'intéressé a perdu tout accès et **ne peut plus ni voir ni corriger sa propre
fiche**, qui continue d'alimenter la vitrine.

Que l'historique d'un archivé compte encore dans les saisons passées se défend.
Que son visage soit publié sans authentification après son départ, non.

**Et `/privacy` dit autre chose que ce que fait le produit** (`app/privacy/page.tsx`,
daté du 24 août 2026, soit avant la migration qui a introduit les photos) : il ne
mentionne pas les photos, il annonce un hébergement « chez Supabase » quand le
diagnostic ne sait lire qu'un hôte `neon.tech`, et il promet qu'« un admin peut
supprimer joueurs et matchs » au titre du RGPD — or **aucune suppression de
joueur n'existe**, seulement l'archivage.

### 8bis.2 Le site refuse de grossir le texte

`app/layout.tsx:27-28` pose `maximumScale: 1` et `userScalable: false`, et
`app/globals.css:190` `-webkit-text-size-adjust: 100%`. Ce n'est pas neutralisé
comme sur un site ordinaire : le manifeste déclare `"display": "standalone"` et
`appleWebApp.capable`, donc **en PWA installée le verrou s'applique**. La
feuille de match (`live.css`) pose en plus ses tailles en pixels durs.

À 200 % de police système, l'écran du match ne bouge pas d'un pixel. Le club a
des gens de 45 à 55 ans, dans un gymnase, sans leurs lunettes. C'est le seul
endroit du produit qui dit non à quelqu'un de façon définitive.

Côté app, l'inverse et c'est bien — `allowFontScaling={false}` n'apparaît nulle
part — mais les hauteurs sont figées en points (`match/[id].tsx:1128`, une
rangée de 58 pour un texte de 17), donc le texte grossit et déborde.

### 8bis.3 Les deux chasubles ne sont jamais comparées entre elles

`lib/color.ts` mesure très correctement le contraste de chaque chasuble contre
le FOND (APCA-W3 complet). Mais rien ne mesure la distance **entre les deux** :
ni `deltaE`, ni `proche`, nulle part. `lib/reglages-serveur.ts:93-98` ne vérifie
que la forme hexadécimale — **un club peut poser deux fois la même couleur**, et
la palette proposée met un rouge à côté d'un orange et d'un vert, soit le couple
que ne distingue pas un daltonien.

Le repli non chromatique existe sous le score et sur la bande du récap, mais
**pas là où on tape** : les tuiles de joueur et la chronologie ne distinguent
les camps que par la couleur.

### 8bis.4 Le vibreur ne se coupe pas

Le son a son interrupteur, bien placé. La vibration, non : elle part sans
condition, six fois côté site et dix côté app. `sonActif()` ne gouverne que
l'audio. Une soirée à vingt-sept buts, c'est vingt-sept vibrations obligatoires.

### 8bis.5 L'argent n'est qu'un booléen

Le modèle est un coût de terrain sur la soirée et un `hasPaid` sur la réponse.
La part encaissée n'est donc **pas un fait, c'est une reconstitution** :
`MoneyPanel.tsx:53-56` recalcule `Math.ceil(coût ÷ titulaires)` **à chaque
rendu**, depuis la liste des présents du moment. Une réponse qui change après la
soirée change donc *rétroactivement* ce que « a payé » voulait dire — le montant
que quelqu'un a réellement donné n'est écrit nulle part.

> **Correction du 10 septembre au soir.** Une première version de ce paragraphe
> affirmait que `Math.ceil` sur-collecte un euro par soirée (« 48 € pour 7, donc
> 49 € »). **C'est faux, d'un facteur cinquante.** `cost` est en CENTIMES
> (`:46-48`, `:69`) : `Math.ceil(4800 ÷ 7)` fait 686 centimes, soit 6,86 €, et
> sept parts font 48,02 €. Le sur-encaissement est de **deux centimes**, pas
> d'un euro. L'erreur est née d'un arrondi lu à l'euro au lieu du centime, et
> elle avait survécu à une relecture ; c'est une seconde qui l'a vue. Le défaut
> réel est celui du paragraphe ci-dessus — la part n'est pas figée — et il est
> plus grave, parce qu'il est silencieux.

Rien ne porte une dette d'une semaine sur l'autre, rien ne dit qui a avancé,
rien ne permet de payer.

Dans un club de quinze, l'argent est la deuxième cause de friction après les
équipes. Et c'est un **chiffre** : priorité 2 au sens du § 2, pas du confort.

### 8bis.6 La donnée n'a ni entrée ni sortie

Aucune sauvegarde, aucun import, aucune restauration, aucune migration d'un club
vers un autre. Le seul export est un CSV manuel réservé à qui est connecté, et
il n'a pas de porte d'entrée. Ni un compte ni un club ne se suppriment. Un club
qui s'arrête en juillet n'a aucun geste à faire — et rien ne le prévient qu'il
n'y en a pas.

### 8bis.7 Le reste, plus court

- **Ouvrir la vitrine une semaine publie cinq feuilles nominatives pour
  toujours** : `app/p/[slug]` pose cinq liens `/r/<id>` permanents, que
  refermer `isPublic` ne referme pas. Et il n'y a **aucun `robots`** sur `/p/`,
  alors que `/r/` en a un.
- **Un joueur n'a que deux états**, actif ou archivé. Rien pour « blessé jusqu'en
  février » — et l'archivage ne touche pas `abonne`, donc il reste compté présent
  par défaut. Rien non plus pour exclure une personne : le lien d'invitation est
  permanent et le régénérer coupe **tout le club**.
- **Le produit n'a aucun moyen de joindre quelqu'un** : pas un numéro dans le
  schéma. Un gymnase, du contact, et personne à appeler.
- **En paysage, la feuille de match du site n'a pas de sortie** (`position: fixed`,
  `overflow: hidden`, aucune `orientation` au manifeste). L'app, elle, verrouille.

### 8bis.8 Une réserve sur les citations de l'annexe

Le balayage a tourné sur l'arbre d'AVANT la réconciliation de l'après-midi.
**`lib/roster-serveur.ts` est cité 26 fois et n'existe plus** : son contenu vit
désormais dans `lib/joueur.ts` et `lib/rattachement.ts`. De même, la route
`joueurs/[playerId]/lier` s'appelle maintenant `…/rattachement`. Et une
quinzaine de citations pointent au-delà de la fin de leur fichier — la substance
a été revérifiée et tient, les numéros de ligne non. **Les citations de l'annexe
se relisent, elles ne se croient pas.**

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

### Ce que la relecture a corrigé dans ce document

Un regard neuf a relu le balayage le 10 septembre au soir, avec pour seule
mission de le mettre en défaut. Il a trouvé, et six affirmations de cette spec
ont été corrigées : le taux de règles tenues par l'affichage (une sur huit, pas
une sur quatre) · l'unicité d'un profil, que la BASE tient et non l'affichage ·
le membre en double, tenu par un chemin et pas par personne · la limite de débit,
qui existe sur les routes de Better Auth · « sans recours » pour l'admin
rétrogradé, qui a un recours · et surtout `deleteMatch` présenté comme la seule
suppression dure, alors qu'il y en a **sept**, dont la soirée entière avec qui a
payé.

Il a aussi trouvé une incohérence de comptage : les annexes ne portaient que 498
cas quand cette spec en annonçait 549. **C'était un défaut du générateur** — il
jetait silencieusement quatre des six regards. Régénéré : les quatre comptages
indépendants concordent, et la somme des douze groupes fait 549.

Ce que la relecture n'a **pas** remis en cause, et qu'on peut donc croire : le
hors-ligne et la file d'envoi, le fuseau horaire, l'entre-deux-saisons, la
vitrine et le flux d'agenda, le Wake Lock. Elle a vérifié une à une les
affirmations du § 5 et du § 6 : à part les deux corrigées ci-dessus, elles
tiennent mot pour mot.
