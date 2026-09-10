# 0000 — Les cas, tous les cas

*Annexe de la spec produit. **549 cas** relevés le 10 septembre 2026 par un balayage
en huit domaines puis six regards. Chaque cas a été vérifié dans le code — la ligne `>` porte
le fichier et la ligne. Les identifiants sont ceux du balayage ; c'est par eux que les specs
numérotées citeront les cas.*

**160 faits · 159 partiels · 96 absents · 134 faux.**
**49 bloquent un lundi · 140 en gênent un · 152 gênent une saison · 208 relèvent du confort.**

**État** — `✔ fait` : ça marche des deux côtés · `◐ partiel` : d'un seul côté, ou à moitié ·
`✗ absent` : rien ne le fait · `⚠ faux` : ça existe et ça se trompe, ce qui est pire.

---

## Comptes, connexion, clubs

*50 cas — 20 faits, 15 partiels, 7 absents, **8 faux**.*

### `COMPTE-11` — ⚠ faux · *bloque un lundi*

**La situation.** Lundi 20h05, pas de réseau dans le gymnase. Le marqueur ouvre l'app (démarrage à froid) pour lancer ou reprendre le match.

**Ce qu'on attend.** L'app s'ouvre sur son club, avec le bouton « Reprendre le match » ou « Nouveau match » — c'est la promesse du hors-ligne réel.

**Où ça en est.** La session survit (restoreSessionCache), mais l'écran suivant exige le réseau : « Impossible de joindre https://… » avec un seul bouton « Réessayer ». Même en arrivant sur l'accueil du club, `club` reste null hors réseau, donc le bouton « Reprendre le match » (gardé par club?.peutScorer, ligne 163) et le menu (ligne 102) n'apparaissent pas. Le miroir local existe (lib/match/local.ts:241-260) mais l'aiguillage ne le lit pas. Seul chemin restant : l'onglet « Créer » → compo, qui a un repli local (compo.tsx:139-160).

> `app : app/index.tsx:35 (session retrouvée dans le trousseau : bon) → app/clubs.tsx:29-49 (chargerMoi obligatoire, aucun repli sur la table locale `clubs`) ; app/club/[id]/index.tsx:49-58, 102, 163 (club vient de chargerMoi ; sans lui ni menu ni bouton)`

### `COMPTE-05` — ✗ absent · *bloque un lundi*

**La situation.** Un joueur a oublié son mot de passe. Il est lundi, sa session de 90 jours a expiré pendant l'été.

**Ce qu'on attend.** Un moyen de le réinitialiser, ou que le capitaine puisse le débloquer.

**Où ça en est.** Aucun service d'envoi d'email n'existe dans le projet. Le seul filet est la session de 90 jours prolongée à chaque visite (lib/auth.ts:93-94). Un joueur qui perd son mot de passe perd son compte, et sa fiche liée avec lui.

> `aucun (lib/auth.ts ne configure ni sendResetPassword ni changePassword ; aucun lien sur /login ni connexion.tsx)`

### `COMPTE-01` — ✔ fait · *bloque un lundi*

**La situation.** Un joueur ouvre le site ou l'app et se connecte avec son email et son mot de passe, un lundi vers 20h.

**Ce qu'on attend.** Il entre, et arrive dans son club.

**Où ça en est.** Même Better Auth des deux côtés, mêmes comptes. Le site envoie vers /onboarding (LoginForm.tsx:24), l'app vers /clubs qui file droit au club s'il n'y en a qu'un (clubs.tsx:32-38).

> `site : app/login/LoginForm.tsx:30-46 ; app : five-scorer-mobile/app/connexion.tsx:43-60, lib/auth-client.ts`

### `COMPTE-35` — ⚠ faux · *gêne un lundi*

**La situation.** Il se déconnecte depuis l'app SANS réseau (au gymnase, il prête son téléphone).

**Ce qu'on attend.** Soit ça marche, soit on lui dit que ça ne peut pas se faire hors ligne — mais pas un entre-deux.

**Où ça en est.** La base locale est vidée, puis `signOut()` lève (pas de réseau), donc `router.replace("/connexion")` n'est jamais atteint et la promesse part dans le vide (`void deconnecter()`). Résultat : toujours connecté, base vide, aucun message. Sur un téléphone prêté, la personne suivante ouvre l'app sur le compte du précédent.

> `app : composants/MenuClub.tsx:73-77 (purger() AVANT signOut()) ; @better-fetch/fetch/dist/index.js:628 (l'erreur réseau est relancée) ; @better-auth/expo/dist/client.js:318-325, 372 (clearSessionCache seulement sur succès de /sign-out)`

### `COMPTE-36` — ⚠ faux · *gêne un lundi*

**La situation.** La session d'Ibrahima a expiré ; l'app renvoie à la connexion ; un autre membre se connecte sur ce téléphone, sans que personne ne se soit « déconnecté ».

**Ce qu'on attend.** Le téléphone repart propre : pas la file ni le match du précédent.

**Où ça en est.** La base locale survit au changement de compte. Les opérations en file du premier partent avec le cookie du second ; s'il est membre du même club, elles passent sous son identité ; sinon elles sont bloquées en 404. Le match en direct du premier apparaît au second (« Reprendre le match »).

> `app : lib/appel.ts:147 + router.replace("/connexion") partout (aucune purge) ; composants/Noyau.tsx:74-79 (purger n'est appelé que par MenuClub.deconnecter) ; lib/outbox/sync.ts:120-135 (le cookie est relu à chaque rejeu)`

### `COMPTE-04` — ◐ partiel · *gêne un lundi*

**La situation.** Pas de réseau (gymnase, cave) au moment où il appuie sur « Se connecter ».

**Ce qu'on attend.** On lui dit que c'est le réseau, pas son mot de passe.

**Où ça en est.** Sur le site, better-fetch relance l'erreur réseau (@better-fetch/fetch/dist/index.js:628, pas de catchAllError) : `await signIn.email` lève, `setLoading(false)` n'est jamais atteint, le bouton reste sur « Connexion… » sans message.

> `app : five-scorer-mobile/app/connexion.tsx:61-71 (fait : adresse du serveur affichée) ; site : app/login/LoginForm.tsx:33 et app/signup/SignupForm.tsx:35 (aucun try/catch)`

### `COMPTE-08` — ◐ partiel · *gêne un lundi*

**La situation.** Un membre n'est pas venu depuis trois mois ; sa session est expirée quand il rouvre.

**Ce qu'on attend.** On lui dit que sa session a expiré et on le ramène à la connexion, sans boucle.

**Où ça en est.** Site : fait, avec la sortie de secours qui casse la boucle de redirections (middleware.ts:14-22). App : l'écran de connexion s'ouvre sans un mot (connexion.tsx ne reçoit aucun paramètre « expirée ») — le joueur ne sait pas pourquoi il est là. Et le retour se fait sur /clubs, pas sur l'écran qu'il regardait.

> `site : lib/guard.ts:31-33 → app/session-expiree/route.ts (efface les cookies, y compris __Secure-) → /login?session=expiree (message page.tsx:31) ; app : lib/appel.ts:147 → SessionExpiree → router.replace("/connexion") dans chaque écran`

### `COMPTE-09` — ◐ partiel · *gêne un lundi*

**La situation.** Au gymnase, en pleine saisie, le serveur ne reconnaît plus la session (expirée, ou compte révoqué).

**Ce qu'on attend.** Les buts saisis ne se perdent pas ; on peut se reconnecter sans quitter le match.

**Où ça en est.** La file est conservée (bon). Mais la pastille est un texte, pas un bouton : pour se reconnecter il faut sortir de la feuille, tomber sur SessionExpiree à l'accueil, se connecter, revenir. Rien ne relance la file après la connexion (connexion.tsx:60 ne touche pas au drain) : elle repart au prochain but tapé ou au prochain retour au premier plan (Noyau.tsx:98-104).

> `app : lib/outbox/sync.ts:318-327 (401 → file conservée, drapeau levé) ; app/match/[id].tsx:1044-1053 (pastille « Reconnecte-toi ») ; site : lib/sync.ts:288-300 équivalent`

### `COMPTE-24` — ◐ partiel · *gêne un lundi*

**La situation.** Un membre n'a pas de fiche joueur (fiche déliée après un retrait puis retour, ou revendication à refaire).

**Ce qu'on attend.** Il peut dire « je viens lundi », voter, et récupérer ou obtenir une fiche.

**Où ça en est.** Il peut revendiquer une fiche libre. Mais s'il n'y en a pas, il ne peut pas créer la sienne (addPlayer exige canManage) : il attend le capitaine, et entre-temps ne peut pas répondre à la soirée — sans message qui le lui dise.

> `site : app/c/[slug]/page.tsx:556 (bouton de présence masqué sans fiche), components/ios/MenuClub.tsx:117 (« Mon profil » → effectif) ; app : clubs.tsx:145 (« pas encore de fiche joueur »), effectif.tsx:177-185 (« C'est moi » si une fiche libre existe) ; app/actions/roster.ts:44-49 (créer une fiche = admins seuls)`

### `COMPTE-28` — ◐ partiel · *gêne un lundi*

**La situation.** Un membre est retiré pendant qu'il a l'app ouverte, un lundi, avec des buts en file.

**Ce qu'on attend.** Qu'on lui dise qu'il n'est plus membre, et ce que deviennent ses opérations en attente.

**Où ça en est.** Rien ne dit « tu as été retiré ». Le 404 volontaire (ne pas confirmer l'existence du club) se retourne ici contre un ancien membre légitime. Ses buts non envoyés restent bloqués dans le téléphone et n'arriveront jamais, sans qu'on sache pourquoi.

> `site : lib/guard.ts:88 (redirect /onboarding, muet) ; app : lib/guard.ts:95-110 → 404 « introuvable » → « Le serveur a répondu 404 — introuvable » sur chaque écran ; lib/outbox/sync.ts:329-345 (404 → chaîne du match bloquée, « N refusées ») ; composants/Noyau.tsx (base locale du club conservée)`

### `COMPTE-34` — ◐ partiel · *gêne un lundi*

**La situation.** Un joueur se déconnecte de l'app alors que des buts n'ont pas encore été envoyés.

**Ce qu'on attend.** Être prévenu, avec le nombre, et pouvoir rester connecté.

**Où ça en est.** Deux boutons « Se déconnecter » avec deux comportements. Celui de l'écran des clubs (visible avec 0 ou ≥2 clubs) laisse la base locale pleine et ne prévient pas. Et « Se déconnecter quand même » jette une soirée entière sans possibilité de la revoir avant.

> `app : composants/MenuClub.tsx:67-88 (fait : Alert « N opérations attendent le réseau », purge, signOut) ; app/clubs.tsx:99-107 (signOut nu : ni avertissement ni purge)`

### `COMPTE-37` — ◐ partiel · *gêne un lundi*

**La situation.** Réinstallation, changement de téléphone, ou déconnexion propre : un match laissé « en direct » sur le serveur la semaine dernière.

**Ce qu'on attend.** Le retrouver pour le terminer, comme le site le propose.

**Où ça en est.** Sur l'app, « Reprendre le match » ne connaît que la base SQLite ; après une purge, le match en direct côté serveur n'apparaît plus nulle part dans l'app.

> `site : app/c/[slug]/page.tsx:707-729 (« Feuille restée ouverte », depuis le serveur) ; app : app/club/[id]/index.tsx:64-70 et app/clubs.tsx:113-121 (uniquement local.getLiveMatchOfClub)`

### `COMPTE-50` — ◐ partiel · *gêne un lundi*

**La situation.** Le capitaine, sur son téléphone, veut lier la fiche « Karim » au compte de Karim (qui a une fiche vide à côté).

**Ce qu'on attend.** Pouvoir le faire depuis l'app comme depuis le site.

**Où ça en est.** Choix assumé : le geste d'admin « lier pour un autre » reste sur le site. Mais comme COMPTE-22 montre que c'est le SEUL recours après une mauvaise adoption automatique, l'app laisse le capitaine sans outil un lundi.

> `site : app/actions/roster.ts:107-135 (linkPlayerToUser avec peutGerer, admin peut lier pour un autre) ; app : app/api/clubs/[clubId]/joueurs/[playerId]/lier/route.ts (soi-même seulement, peutGerer:false, choix argumenté dans le commentaire)`

### `COMPTE-03` — ✔ fait · *gêne un lundi*

**La situation.** Un joueur se trompe de mot de passe, ou tape un email qui n'existe pas.

**Ce qu'on attend.** Un refus clair, sans dire si l'email existe.

**Où ça en est.** Le site nomme toute autre erreur avec le détail serveur, volontairement (commentaire ligne 35-38).

> `site : app/login/LoginForm.tsx:34-42 (401 → « Email ou mot de passe incorrect. ») ; app : connexion.tsx:174-178 (INVALID_EMAIL_OR_PASSWORD)`

### `COMPTE-18` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine lit le code affiché dans ses réglages (« A7K2M9QX ») et le dicte au téléphone à un nouveau, qui le tape dans « Rejoindre un club ».

**Ce qu'on attend.** Ça marche.

**Où ça en est.** Le « code » affiché est un extrait en capitales d'un identifiant complet en minuscules : tapé dans le champ, il donne toujours « Code d'invitation invalide. ». Aucune normalisation (casse, extrait) côté serveur. Seul le lien complet fonctionne.

> `site : app/c/[slug]/settings/page.tsx:79 et app/api/clubs/[clubId]/reglages/route.ts:107 (affichent inviteCode.slice(-8).toUpperCase()) contre app/actions/club.ts:64-66 (findUnique sur le code complet, tel quel) ; app/onboarding/JoinClubForm.tsx`

### `COMPTE-22` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine a créé « Karim » dans l'effectif en septembre ; Karim s'inscrit en novembre sous « Karim Benzema » et rejoint par le lien.

**Ce qu'on attend.** Karim retrouve SA fiche et ses 15 matchs, pas une fiche vide à côté.

**Où ça en est.** Le nom ne correspond pas → une fiche « Karim Benzema » vide est créée. À partir de là, `hasLinkedPlayer`/`aDejaUnProfil` est vrai, donc « C'est moi » n'est plus proposé nulle part : Karim ne peut pas réparer lui-même. Seul un admin, sur le SITE (actions/roster.ts:107 avec peutGerer ; la route mobile lier/route.ts force peutGerer:false), peut le lier à la bonne fiche — et la fiche vide reste dans le vestiaire, ni supprimée ni archivée.

> `site : app/actions/club.ts:38-55 (correspondance exacte du nom normalisé, sinon création d'une nouvelle fiche) ; app/c/[slug]/players/RosterClient.tsx:316 et five-scorer-mobile/app/club/[id]/effectif.tsx:183 (« C'est moi » masqué dès qu'on a une fiche) ; app/api/clubs/[clubId]/effectif/route.ts:52 (aDejaUnProfil)`

### `COMPTE-23` — ⚠ faux · *gêne une saison*

**La situation.** Deux « Sofiane » au club. Le premier à s'inscrire s'appelle Sofiane ; il y a deux fiches « Sofiane » non liées.

**Ce qu'on attend.** On lui demande laquelle est la sienne.

**Où ça en est.** La première fiche dans l'ordre de la base est adoptée en silence. Si c'est la mauvaise, le vrai propriétaire de cette fiche, en s'inscrivant plus tard, recevra une fiche neuve (la sienne est « prise »), et les buts de l'un sont au nom de l'autre — sans qu'aucun écran ne l'ait dit.

> `site : app/actions/club.ts:42-47 (`unlinked.find` : la première qui correspond, sans confirmation)`

### `COMPTE-27` — ⚠ faux · *gêne une saison*

**La situation.** Un admin retire quelqu'un du club (il a quitté le groupe WhatsApp).

**Ce qu'on attend.** Il sort, ses matchs et ses buts restent dans les stats, et on ne peut pas se retirer soi-même par mégarde.

**Où ça en est.** Le déliement de la fiche est fait des deux côtés (bon). Mais sur le site, un admin peut se retirer lui-même en deux clics : il perd l'accès au club sans autre recours qu'un nouveau lien — exactement le cas que la route mobile a été écrite pour éviter (son commentaire dit « Le site ne s'en protège pas »).

> `site : app/actions/club.ts:172-201 (aucun contrôle « soi-même ») + app/c/[slug]/settings/MembersTable.tsx:107-133 (bouton « Retirer » visible sur sa propre ligne, marquée « (toi) ») ; app : app/api/clubs/[clubId]/membres/[memberId]/route.ts:70-78 (refus) + reglages.tsx:517 (bouton masqué)`

### `COMPTE-32` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine, ou quelqu'un avec son cookie, appelle directement POST /api/auth/organization/delete.

**Ce qu'on attend.** « Rien dans l'app ne supprime » — un club ne s'efface pas.

**Où ça en est.** La suppression de l'organisation cascade sur le club, ses joueurs, ses matchs, ses saisons. Aucune règle du club (doctrine « rien ne supprime », spec 0001) ne s'applique aux routes génériques : remove-member sans délier la fiche, update-member-role selon les permissions Better Auth, invite-member par email (table Invitation, jamais utilisée par l'UI).

> `app/api/auth/[...all]/route.ts (toutes les routes du plugin exposées) ; prisma/schema.prisma:153 (Club → Organization onDelete Cascade), :205 (Player → Club Cascade) ; middleware.ts:60 (api/auth hors garde)`

### `COMPTE-06` — ✗ absent · *gêne une saison*

**La situation.** Un membre veut changer son nom (il s'est inscrit « karim b »), son email ou son mot de passe.

**Ce qu'on attend.** Un écran « mon compte ».

**Où ça en est.** Le nom du compte est pourtant ce qui apparaît dans « Salut … » (onboarding/page.tsx:34, clubs.tsx:76) et ce qui sert à adopter une fiche au moment de rejoindre.

> `aucun (ni page site, ni écran app ; grep changeEmail/changePassword/updateUser vide)`

### `COMPTE-07` — ✗ absent · *gêne une saison*

**La situation.** Quelqu'un quitte le club pour de bon et veut que son compte disparaisse.

**Ce qu'on attend.** Pouvoir supprimer son compte, en sachant ce que deviennent ses buts.

**Où ça en est.** Rien dans l'app ne supprime un compte. La politique de confidentialité (/privacy) existe mais aucun geste ne la sert.

> `aucun (deleteUser non activé dans lib/auth.ts ; aucune UI). Le schéma cascade : User → Member/Session (schema.prisma:43,106) ; la fiche Player n'est pas liée en cascade (userId nullable, :217)`

### `COMPTE-19` — ✗ absent · *gêne une saison*

**La situation.** Un nouveau a installé l'app avant de recevoir le lien ; il ouvre le lien depuis WhatsApp sur son iPhone.

**Ce qu'on attend.** L'app s'ouvre et le fait entrer — ou au moins, l'app offre de coller un code.

**Où ça en est.** Le lien ouvre le site dans Safari ; il rejoint là-bas, puis doit revenir dans l'app et tirer pour rafraîchir. Un compte sans club dans l'app est un cul-de-sac : seul « Se déconnecter » est proposé.

> `app : app.json (schéma fivescorer, aucun associatedDomains/intentFilters), aucune route /join, aucun écran de saisie de code ; app/clubs.tsx:83 (« Tu n'es dans aucun club pour l'instant. » sans action)`

### `COMPTE-30` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine arrête le five, ou change de téléphone et perd son compte ; il veut passer la main à un adjoint.

**Ce qu'on attend.** Transférer la capitainerie.

**Où ça en est.** L'owner est verrouillé dans les deux sens : personne ne peut le devenir, il ne peut pas partir. Un club dont le capitaine disparaît n'a plus de capitaine, définitivement — et la revendication v1 ne sert qu'une fois (lib/legacy.ts).

> `site : app/actions/club.ts:154-163 (« owner » refusé comme rôle), :186-188 (owner non retirable) ; app : membres/[memberId]/route.ts:30-33, 66-68 ; aucune UI de transfert`

### `COMPTE-41` — ✗ absent · *gêne une saison*

**La situation.** Une inscription avec une faute de frappe dans l'email (karim@gmal.com).

**Ce qu'on attend.** Qu'on s'en aperçoive, ou qu'on puisse corriger.

**Où ça en est.** Le compte se crée et fonctionne, mais l'email est faux pour toujours : impossible de réinitialiser un jour (COMPTE-05), impossible de corriger (COMPTE-06). Personne ne le voit avant le jour où ça compte.

> `lib/auth.ts:75-78 (pas de requireEmailVerification, pas d'envoi) ; aucun écran de changement d'email`

### `COMPTE-38` — ◐ partiel · *gêne une saison*

**La situation.** Un joueur préfère « Continuer avec Google ».

**Ce qu'on attend.** Ça marche sur le site ET sur l'app, ou nulle part.

**Où ça en est.** Si seul GOOGLE_CLIENT_ID est posé, le bouton s'affiche et échoue. Un compte créé via Google n'a pas de mot de passe (schema.prisma:66, password nullable) : il ne peut PAS se connecter à l'app. Impossible de savoir depuis le code si Google est actif en production.

> `site : lib/auth.ts:13-15, 79-87 (activé si ID ET secret), app/login/page.tsx:35 et app/page.tsx:25 (bouton si ID seul), LoginForm.tsx:49-56 ; app : rien (connexion.tsx n'a que email/mot de passe)`

### `COMPTE-02` — ✔ fait · *gêne une saison*

**La situation.** Quelqu'un que le capitaine a invité crée son compte : nom, email, mot de passe.

**Ce qu'on attend.** Le compte existe, il peut rejoindre le club.

**Où ça en est.** Le site dit « Celui que tes potes connaissent », l'app dit « Ton prénom » : or ce nom sert ensuite à adopter automatiquement une fiche joueur (actions/club.ts:27-56). Les deux consignes divergent sur la donnée qui décide de la fusion.

> `site : app/signup/SignupForm.tsx ; app : five-scorer-mobile/app/connexion.tsx (mode inscription)`

### `COMPTE-16` — ✔ fait · *gêne une saison*

**La situation.** Le capitaine colle le lien sur WhatsApp ; un nouveau l'ouvre sur son téléphone, sans compte.

**Ce qu'on attend.** Il crée son compte et se retrouve dans le club, dans la foulée.

**Où ça en est.** Le `next` n'accepte que des chemins internes (login/page.tsx:19). Tout se passe dans Safari : l'app n'intercepte pas le lien (voir COMPTE-19).

> `site : app/join/[code]/page.tsx:79-97 (signup?next=/join/CODE) → app/actions/club.ts:61-84 → redirect /c/slug ; app/c/[slug]/settings/InviteCard.tsx (lien + bouton WhatsApp)`

### `COMPTE-29` — ✗ absent · *confort*

**La situation.** Un membre veut quitter le club de lui-même.

**Ce qu'on attend.** Un bouton « Quitter le club », qui délie sa fiche comme un retrait.

**Où ça en est.** Par l'interface, impossible ; par un appel direct, possible mais hors des règles du club (la fiche reste liée à un compte parti — au retour, ensureLinkedPlayer la retrouve, donc pas de casse, mais l'invariant « membre ⇔ fiche liée » n'est plus vrai).

> `aucun écran (site ni app). Mais POST /api/auth/organization/leave répond (plugin Better Auth, app/api/auth/[...all]/route.ts), sans délier la fiche`

### `COMPTE-12` — ◐ partiel · *confort*

**La situation.** Après connexion, un joueur qui n'a qu'un club (tout le monde ici) veut arriver directement dessus.

**Ce qu'on attend.** Pas d'écran intermédiaire.

**Où ça en est.** Sur le site, la page d'accueil sait aller droit au club mais le formulaire de connexion, lui, dépose sur « Mes clubs » avec une seule ligne. Un tap de plus, à chaque reconnexion.

> `site : app/page.tsx:19-24 (fait sur /) mais app/login/LoginForm.tsx:24 (destination = /onboarding, liste d'un seul club) ; app : app/clubs.tsx:32-38 (fait)`

### `COMPTE-14` — ◐ partiel · *confort*

**La situation.** Quelqu'un crée un nouveau club (nom, format, deux chasubles).

**Ce qu'on attend.** Le club existe, il en est capitaine, il a sa fiche.

**Où ça en est.** Le club est créé avec les réglages par défaut PUIS les couleurs/format sont posés par updateClubSettings (CreateClubForm.tsx:57-58) : si ce second appel échoue, le club existe sans ses chasubles et on est redirigé quand même. L'app ne sait pas créer de club.

> `site : app/onboarding/CreateClubForm.tsx:40-70 + lib/auth.ts:103-111 (fait) ; app : aucun écran`

### `COMPTE-33` — ◐ partiel · *confort*

**La situation.** Un joueur se déconnecte du site sur un téléphone prêté.

**Ce qu'on attend.** La personne suivante ne voit rien de lui.

**Où ça en est.** Le cache des pages est vidé, mais la base locale du navigateur garde l'effectif, les matchs et la file d'attente du précédent. Le commentaire mobile (Noyau.tsx:31-34) croit que le site vide « son cache hors-ligne » : il vide moins que l'app.

> `site : components/ios/MenuClub.tsx:150-163 et app/c/[slug]/settings/Deconnexion.tsx (PURGE du cache SW puis signOut) ; public/sw.js:156-160 ; lib/db.ts (Dexie jamais purgée hors migration :232-236)`

### `COMPTE-42` — ◐ partiel · *confort*

**La situation.** Un email déjà utilisé à l'inscription.

**Ce qu'on attend.** Le dire.

**Où ça en est.** Le site traduit TOUT 422 par « déjà utilisé », y compris un email mal formé. Le commentaire du fichier (« Ne jamais inventer la cause ») visait justement ce piège. L'app lit le code, pas le statut : juste.

> `site : app/signup/SignupForm.tsx:36-46 (tout 422 → « Cet email est déjà utilisé. ») ; app : connexion.tsx:179-180 (code USER_ALREADY_EXISTS)`

### `COMPTE-47` — ◐ partiel · *confort*

**La situation.** Un compte veut créer un onzième club ; un club reçoit son 101e membre.

**Ce qu'on attend.** Une limite dite en français.

**Où ça en est.** La limite de clubs existe mais son message ment (« réessaie dans un instant »). Sans importance pour un club de 18.

> `lib/auth.ts:103 (organizationLimit: 10 → CreateClubForm.tsx:62-66 « Impossible de créer le club. Réessaie dans un instant. ») ; aucune limite de membres posée dans lib/auth.ts (celle par défaut de Better Auth s'applique, non vérifiée ici)`

### `COMPTE-49` — ◐ partiel · *confort*

**La situation.** Reconnexion après expiration : il était sur la fiche d'un joueur.

**Ce qu'on attend.** Revenir là où il était.

**Où ça en est.** Deux chemins vers /login, un seul garde la destination.

> `site : app/session-expiree/route.ts:31 (→ /login?session=expiree, sans `next`) contre middleware.ts:29-35 (qui, lui, pose `next`) ; app : chaque écran fait router.replace("/connexion") sans mémoire`

### `COMPTE-10` — ✔ fait · *confort*

**La situation.** Le compte a été supprimé en base (maintenance, purge) mais le cookie signé est encore valable 5 minutes.

**Ce qu'on attend.** Ne pas travailler sur un fantôme ; repartir propre.

**Où ça en est.** Le commentaire de guard.ts explique le cas et le coût (écrans vides, clé étrangère).

> `site : lib/guard.ts:48-51 (utilisateurExisteEncore) → /session-expiree ; app : /api/auth/get-session rend null → index.tsx → vitrine ; nos routes → 401 → connexion`

### `COMPTE-13` — ✔ fait · *confort*

**La situation.** Un joueur est dans deux clubs (le lundi et un five du jeudi) et veut passer de l'un à l'autre.

**Ce qu'on attend.** Une liste, un tap.

**Où ça en est.** Sur l'app, avec un seul club, « Mes clubs » rebondit aussitôt sur le club (clubs.tsx:32-38) : l'écran n'est jamais visible, donc son bouton « Se déconnecter » (clubs.tsx:99-107) non plus — celui du menu prend le relais.

> `site : app/onboarding/page.tsx:33-46 + components/ios/MenuClub.tsx:141-144 (« Mes clubs ») ; app : app/clubs.tsx + composants/MenuClub.tsx:167-172`

### `COMPTE-15` — ✔ fait · *confort*

**La situation.** Le nom choisi est déjà pris (« FC Lundi Soir » existe).

**Ce qu'on attend.** Ça marche quand même, ou on le dit.

**Où ça en est.** Toute erreur ne contenant pas « slug » devient « Impossible de créer le club. Réessaie dans un instant. » — y compris la limite de 10 clubs (lib/auth.ts:103), qui mériterait son propre mot.

> `site : app/onboarding/CreateClubForm.tsx:53-69 (suffixe -2 … -5, puis « Ce nom de club est déjà très demandé »)`

### `COMPTE-17` — ✔ fait · *confort*

**La situation.** Quelqu'un déjà connecté ouvre le lien.

**Ce qu'on attend.** Un bouton « Rejoindre », puis le club.

**Où ça en est.** La page montre le nom du club et le nombre de membres à quiconque possède le lien, connecté ou non (page.tsx:54-72).

> `site : app/join/[code]/page.tsx:79-81 + JoinButton.tsx`

### `COMPTE-20` — ✔ fait · *confort*

**La situation.** Le lien a été régénéré entre-temps, ou l'URL est tronquée.

**Ce qu'on attend.** Dire que le lien est mort et demander un nouveau lien au capitaine.

**Où ça en est.** Le message dit bien que les codes peuvent être régénérés.

> `site : app/join/[code]/page.tsx:25-50 (« Lien invalide ou expiré ») ; app/actions/club.ts:66 (« Code d'invitation invalide. »)`

### `COMPTE-21` — ✔ fait · *confort*

**La situation.** Un membre re-clique le lien alors qu'il est déjà dans le club (WhatsApp l'a remonté).

**Ce qu'on attend.** Rien ne casse, il arrive dans le club.

**Où ça en est.** Idempotent.

> `site : app/actions/club.ts:70-80 (existing → pas de doublon de membre) ; ensureLinkedPlayer:34-37 (fiche déjà liée → rien)`

### `COMPTE-25` — ✔ fait · *confort*

**La situation.** Le lien traîne dans un groupe WhatsApp de 40 personnes ; un ami d'ami l'ouvre.

**Ce qu'on attend.** À décider par le club : entrer directement, ou attendre l'accord du capitaine.

**Où ça en est.** Conforme au texte des réglages (« Qui ouvre ce lien rejoint le club »). Le seul recours est de régénérer le code, ce qui invalide le lien pour tout le monde. C'est une décision de club, pas un bug.

> `site : app/actions/club.ts:61-84 (entrée directe, rôle member) ; aucune file d'attente, aucune expiration`

### `COMPTE-26` — ✔ fait · *confort*

**La situation.** Un admin régénère le code d'invitation.

**Ce qu'on attend.** Qu'on lui dise que tous les liens envoyés meurent, et qu'il confirme.

**Où ça en est.** Irréversible et confirmé des deux côtés.

> `site : app/c/[slug]/settings/InviteCard.tsx:60-90 (« L'ancien lien ne marchera plus. Sûr ? ») ; app : app/club/[id]/reglages.tsx:436-457 (Alert explicite) ; serveur : app/actions/club.ts:122-134, api/reglages/invitation`

### `COMPTE-31` — ✔ fait · *confort*

**La situation.** Le capitaine nomme un adjoint (admin) ou lui retire ses droits.

**Ce qu'on attend.** Ça se fait, avec une phrase qui dit ce que ça change.

**Où ça en est.** Le rôle est validé à l'exécution des deux côtés (on ne peut pas se faire owner). Le site change le rôle au premier changement du menu déroulant, sans confirmation.

> `site : app/actions/club.ts:138-168 + MembersTable.tsx (select, sans confirmation) ; app : membres/[memberId]/route.ts:15-50 + reglages.tsx:487-516 (Alert qui explique)`

### `COMPTE-39` — ✔ fait · *confort*

**La situation.** Le capitaine revendique l'historique v1 avec l'ancien PIN (une fois, à la migration).

**Ce qu'on attend.** Il devient capitaine du club historique, avec sa fiche.

**Où ça en est.** Fermé par défaut (LEGACY_CLAIM_OPEN), message explicite. La carte « Ton historique t'attend » s'affiche à TOUS les comptes tant que le club n'est pas revendiqué.

> `site : app/onboarding/page.tsx:48-58 + ClaimLegacyForm.tsx + lib/legacy.ts:46-69 + app/actions/club.ts:89-99`

### `COMPTE-40` — ✔ fait · *confort*

**La situation.** Le même joueur est connecté sur le site (ordinateur) et sur l'app (téléphone) ; il se déconnecte de l'un.

**Ce qu'on attend.** L'autre reste connecté.

**Où ça en est.** Aucun écran ne liste ses sessions ni ne permet de « déconnecter partout ».

> `Better Auth : une session par appareil (table Session, schema.prisma:34-48) ; signOut ne révoque que la session courante`

### `COMPTE-43` — ✔ fait · *confort*

**La situation.** Mot de passe de 5 caractères.

**Ce qu'on attend.** Refus lisible, avant l'envoi.

**Où ça en est.** Borne unique (8), tenue par le serveur.

> `site : SignupForm.tsx:30-33 + minLength ; app : connexion.tsx:39-41 + PASSWORD_TOO_SHORT ; serveur : lib/auth.ts:77`

### `COMPTE-44` — ✔ fait · *confort*

**La situation.** Un admin est rétrogradé membre pendant qu'il a les réglages ouverts.

**Ce qu'on attend.** Ses prochains changements sont refusés clairement.

**Où ça en est.** L'app garde l'écran ouvert jusqu'au prochain chargement, mais chaque écriture est refusée avec le message serveur.

> `site : app/c/[slug]/settings/page.tsx:31 (redirect au prochain rendu), app/actions/club.ts:115 (« Réservé aux admins. ») ; app : api reglages PATCH → 403, reglages.tsx:93-96 (message affiché en bas)`

### `COMPTE-45` — ✔ fait · *confort*

**La situation.** Un connecté retape /login ou /signup dans la barre d'adresse.

**Ce qu'on attend.** On ne lui redemande rien.

**Où ça en est.** Un éventuel `?next=` est perdu dans ce cas, mais aucun parcours ne le produit.

> `site : middleware.ts:24-27 (→ /onboarding), sauf sortie de secours ?session=expiree`

### `COMPTE-46` — ✔ fait · *confort*

**La situation.** Il ouvre l'app depuis Expo Go (développement) contre la production.

**Ce qu'on attend.** Un refus qui explique quoi faire.

**Où ça en est.** Cas de développement, pas de club ; bien tenu.

> `app : connexion.tsx:184-192 (INVALID_ORIGIN traduit), lib/api.ts:100-137 (choix du serveur par l'origine) ; serveur : lib/auth.ts:44-67`

### `COMPTE-48` — ✔ fait · *confort*

**La situation.** Il regarde le club sans compte (« Voir le club sans compte » dans l'app, ou /p/slug sur le site).

**Ce qu'on attend.** Le classement et les derniers résultats, si le club est public ; sinon, un chemin vers la connexion.

**Où ça en est.** L'app ne montre que le club de l'environnement (renault-five-urban-guy par défaut) — assumé par le commentaire.

> `app : app/vitrine.tsx (slug figé par EXPO_PUBLIC_CLUB, lib/api.ts:602 ; 404 → message + « Se connecter ») ; site : app/p/`

## La soirée

*75 cas — 24 faits, 23 partiels, 15 absents, **13 faux**.*

### `SOIREE-01` — ✔ fait · *bloque un lundi*

**La situation.** Un membre, le jeudi, ouvre la fiche de lundi et dit qu'il vient (ou pas).

**Ce qu'on attend.** Un tap, la réponse est enregistrée, le compte des présents bouge.

**Où ça en est.** Segment Présent/Absent sur le site, trois boutons sur l'app, upsert serveur avec garde « pour soi ou gérant ».

> `site : app/c/[slug]/sessions/[id]/SessionRsvpAdmin.tsx:137-160 → app/actions/matchday.ts:61-98 ; app : five-scorer-mobile/app/soiree/[id].tsx:73-84,98-130 → app/api/clubs/[clubId]/soirees/[matchDayId]/rsvp/route.ts`

### `SOIREE-05` — ✔ fait · *bloque un lundi*

**La situation.** Un abonné (« je viens tous les lundis ») ne peut pas venir cette semaine.

**Ce qu'on attend.** Il dit « absent » et cesse d'être compté ; la semaine suivante il est de nouveau présent d'office.

**Où ça en est.** La réponse explicite gagne ; l'écran dit « Présent · abonné » pour ne pas laisser croire qu'il a répondu.

> `lib/presences.ts:77 ; SessionRsvpAdmin.tsx:196-199 (« · abonné ») ; soirees/[matchDayId]/route.ts:123 (viaAbonnement)`

### `SOIREE-16` — ✔ fait · *bloque un lundi*

**La situation.** Le jeudi, savoir si lundi « tient » : 8 présents, il en manque 2.

**Ce qu'on attend.** Une phrase d'état, la même partout.

**Où ça en est.** « confirmée / en attente / annulée », calculée d'un seul endroit, avec les abonnés.

> `lib/presences.ts:117-143 ; SessionRsvpAdmin.tsx:167-169 ; app/soiree/[id].tsx:96 ; accueil/route.ts:108 ; saison/route.ts:150`

### `SOIREE-22` — ✔ fait · *bloque un lundi*

**La situation.** Jeudi, le capitaine pose les deux équipes décidées sur WhatsApp, sur le site.

**Ce qu'on attend.** Une pelouse, un tap par joueur, enregistrer.

**Où ça en est.** Camps A/B, gardien devant la cage, niveaux, sauvegarde en transaction.

> `components/CompoSoiree.tsx:139-149,185-206 → app/actions/compo.ts:18-87`

### `SOIREE-29` — ✔ fait · *bloque un lundi*

**La situation.** Lundi 20 h, coup d'envoi depuis la soirée : la compo et les noms d'équipes doivent arriver tout faits.

**Ce qu'on attend.** La feuille s'ouvre avec Blanc/Noir déjà répartis.

**Où ça en est.** Compo préparée > présélection brute. Les joueurs archivés entre-temps sont filtrés (l.53).

> `CompoSoiree.tsx:303 → app/c/[slug]/matches/new/page.tsx:45-56,104-118 ; NewMatchForm.tsx:121-125`

### `SOIREE-57` — ✔ fait · *bloque un lundi*

**La situation.** Lundi 21 h, la soirée de 20 h est en cours : est-elle « passée » ?

**Ce qu'on attend.** Non : on peut encore lancer un match.

**Où ça en est.** « Passée » = jour civil révolu, en Europe/Paris.

> `lib/dates.ts:69-81,98 (minuit du jour) ; sessions/[id]/page.tsx:196 ; soirees/[matchDayId]/route.ts:212 ; app/c/[slug]/page.tsx:113-120`

### `SOIREE-03` — ⚠ faux · *gêne un lundi*

**La situation.** Sur l'app, la bannière de l'accueil dit « … · Touche pour répondre. »

**Ce qu'on attend.** Toucher la bannière ouvre la soirée ou enregistre la réponse.

**Où ça en est.** La bannière est une View sans onPress ; seul le ✕ (l.134) est tapable. Le texte promet un geste qui ne fait rien. En plus `maReponse` (accueil/route.ts:115) est la réponse brute : un abonné sans réponse lit « Touche pour répondre » chaque semaine.

> `five-scorer-mobile/app/club/[id]/index.tsx:122-138`

### `SOIREE-10` — ⚠ faux · *gêne un lundi*

**La situation.** Déjà présent, je re-touche « Présent » par réflexe (ou l'admin re-touche le même statut).

**Ce qu'on attend.** Rien ne change.

**Où ça en est.** respondedAt est ré-horodaté : quand la soirée est pleine, ce tap fait passer le joueur derrière tous les autres, en liste d'attente.

> `app/actions/matchday.ts:92-96 (upsert update même si statut identique) ; prisma/schema.prisma:463 (respondedAt @updatedAt) ; lib/presences.ts:93,103`

### `SOIREE-20` — ⚠ faux · *gêne un lundi*

**La situation.** Soirée pleine. Un joueur s'abonne le samedi, après que dix personnes ont répondu.

**Ce qu'on attend.** Il prend la file derrière eux.

**Où ça en est.** Un abonné sans réponse est engagé « à la création de la soirée », date qui précède toutes les réponses : s'abonner tard fait sauter la file. Le champ `abonne` n'a pas de date.

> `lib/presences.ts:93 (`repondueLe ?? creeeLe`)`

### `SOIREE-21` — ⚠ faux · *gêne un lundi*

**La situation.** Le capitaine regarde la liste des soirées du site, puis ouvre la fiche : « 1 présent » d'un côté, « 11 présents » de l'autre.

**Ce qu'on attend.** Le même chiffre partout.

**Où ça en est.** La liste du site ignore les abonnés ; le commentaire de l'API (route.ts:19-22) le dit noir sur blanc : « ce doit être le même chiffre ». L'app affiche le bon.

> `app/c/[slug]/sessions/page.tsx:31-33,80 (réponses IN brutes) vs sessions/[id]/page.tsx:77-88 et app/api/clubs/[clubId]/soirees/route.ts:64-79 (calculerPresences)`

### `SOIREE-24` — ⚠ faux · *gêne un lundi*

**La situation.** Accueil mobile, rappel ambre « Dans 3 jours — les équipes ne sont pas faites · préparer la compo maintenant ».

**Ce qu'on attend.** Toucher mène à la préparation de la compo de cette soirée.

**Où ça en est.** Le rappel ouvre « Nouveau match » : son seul débouché est un coup d'envoi (createMatch) — sans soireeId, donc détaché du lundi. Rien n'écrit MatchDayLineup. Le rappel n'est montré qu'aux gérants (l.143 `peutGerer`) alors que le site le montre à qui peut scorer (page.tsx:363-368).

> `five-scorer-mobile/app/club/[id]/index.tsx:143-161 → app/compo.tsx:226-255`

### `SOIREE-50` — ⚠ faux · *gêne un lundi*

**La situation.** Lundi prochain est annulé ; j'ouvre l'accueil de l'app.

**Ce qu'on attend.** L'accueil parle de la soirée suivante, comme le site.

**Où ça en est.** La bannière mobile affiche la soirée annulée avec « Annulée » ; le rappel de compo la saute (index.tsx:143) mais pas la bannière.

> `app/api/clubs/[clubId]/accueil/route.ts:40-42 (pas de filtre canceledAt) vs app/c/[slug]/page.tsx:117-120 (`canceledAt: null`)`

### `SOIREE-76` — ⚠ faux · *gêne un lundi*

**La situation.** Le capitaine a programmé un match dans la soirée de lundi (une convocation). J'ai déjà répondu « Je viens » sur la soirée. J'ouvre la page du match : ma ligne est vide.

**Ce qu'on attend.** Une réponse par lundi. Si j'ai dit que je venais, je l'ai dit.

**Où ça en est.** La table `Rsvp` porte DEUX clés d'unicité indépendantes — `@@unique([matchDayId, playerId])` et `@@unique([matchId, playerId])` (schema.prisma:465-466) — et rien ne les relie. `MatchRsvpPanel` lit et écrit les lignes `matchId` (matches/[id]/page.tsx:161-171, actions/schedule.ts `setMatchRsvp`), `SessionRsvpAdmin` les lignes `matchDayId` : une réponse donnée d'un côté est invisible de l'autre, alors qu'il s'agit du même lundi et du même joueur. Pire, la convocation du match n'appelle pas `calculerPresences` du tout : elle ignore les abonnés et la liste d'attente, et propose trois réponses là où la soirée n'en propose que deux. Et la pré-sélection au coup d'envoi dépend du bouton pressé : `?md=` prend les IN de la soirée, `?scheduled=` prend les IN du match (matches/new/page.tsx:82-87).

> `five-scorer/prisma/schema.prisma:452-467 ; five-scorer/app/c/[slug]/matches/[id]/page.tsx:158-172 ; five-scorer/app/c/[slug]/matches/new/page.tsx:82-87`

### `SOIREE-23` — ✗ absent · *gêne un lundi*

**La situation.** Jeudi, le capitaine veut poser ou relire la compo depuis son téléphone.

**Ce qu'on attend.** La même carte Composition que sur le site, modifiable.

**Où ça en est.** Seul indice : la couleur de l'anneau des avatars dans la liste des présences (l.145). Ni lecture en équipes, ni écriture.

> `five-scorer-mobile/app/soiree/[id].tsx (aucune carte compo ; `fiche.compo` reçu de soirees/[matchDayId]/route.ts:236-248 n'est pas rendu) ; app/api/clubs/[clubId]/matchdays/[matchDayId]/lineup/route.ts (GET seul, aucun appelant mobile) ; aucune route d'écriture de compo hors server action compo.ts`

### `SOIREE-27` — ✗ absent · *gêne un lundi*

**La situation.** Karim est dans la compo enregistrée jeudi ; il dit « absent » dimanche.

**Ce qu'on attend.** La compo le signale (ou le retire) ; le capitaine voit qu'il lui manque un Blanc.

**Où ça en est.** La pelouse ne connaît pas les réponses. Un absent reste sur le terrain jusqu'au coup d'envoi.

> `CompoSoiree.tsx:66-82,118-135 (reçoit `joueurs` sans statut de présence ; alertes = effectif, équipe vide, gardien) ; sessions/[id]/page.tsx:234`

### `SOIREE-37` — ✗ absent · *gêne un lundi*

**La situation.** Jeudi soir, envoyer sur le groupe « lundi 20 h Urban Guyancourt — Blanc : … / Noir : … — il manque 2 ».

**Ce qu'on attend.** Le mot du jeudi, prêt à coller, comme celui du mardi.

**Où ça en est.** C'est exactement le message que le club tape à la main toutes les semaines ; l'app a les données (présents, compo, lieu, heure) et ne rend rien.

> `lib/soiree.ts:52 (null sans match terminé) ; aucun autre composeur`

### `SOIREE-61` — ✗ absent · *gêne un lundi*

**La situation.** Le créneau change : 20 h → 19 h 30, ou terrain 2 → terrain 4.

**Ce qu'on attend.** Modifier l'heure, le lieu, le titre de la soirée.

**Où ça en est.** Il faut supprimer et recréer — donc perdre réponses, compo et caisse (SOIREE-51).

> `aucun writer : grep `matchDay.update` ne trouve que compo.ts:76,134 (noms d'équipes) et calendrier.ts:52,72 (annulation) ; aucune route HTTP`

### `SOIREE-77` — ✗ absent · *gêne un lundi*

**La situation.** Vendredi, la compo est posée. J'ouvre la soirée sur mon téléphone pour savoir si je joue en Blanc ou en Noir — c'est la chasuble que j'emmène dans le sac.

**Ce qu'on attend.** Une carte Composition, ou au minimum « tu es avec les Blancs », lisible sans deviner une couleur.

**Où ça en est.** L'API rend tout ce qu'il faut : `compo.faite`, `compo.nomA`, `compo.nomB` et un `camp` par joueur (route.ts:240-255). L'écran mobile ne rend RIEN de ce bloc — grep « compo » sur app/soiree/[id].tsx ne rend que des imports de chemin. Le seul indice à l'écran est l'anneau de l'avatar, peint en `t.taR` ou `t.tbR` selon `l.camp` (soiree/[id].tsx:143) : une couleur, sans nom d'équipe, sans légende, sans mention pour celui qui n'est dans aucun camp. Sur le site la carte existe (`CompoSoiree`, sessions/[id]/page.tsx). SOIREE-23 parle du capitaine qui veut POSER la compo depuis son téléphone ; ici c'est le joueur qui veut la LIRE, et lui non plus ne peut pas.

> `five-scorer-mobile/app/soiree/[id].tsx:135-155 ; five-scorer/app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:240-255`

### `SOIREE-78` — ✗ absent · *gêne un lundi*

**La situation.** J'ai dit « Je viens » jeudi. Lundi je suis pris dans les bouchons et je ne viens pas. Deux remplaçants attendaient une place.

**Ce qu'on attend.** Quelque chose entre « j'ai répondu jeudi » et « je suis sur la feuille de match » : un pointage, un désistement de dernière minute, ou au moins une trace du lapin.

**Où ça en est.** Le modèle `Rsvp` ne porte que `status` et `hasPaid` : aucun champ d'arrivée, aucun horodatage de présence réelle, et une seule ligne par joueur et par soirée, écrasée à chaque changement d'avis (schema.prisma:452-467). Rien ne rapproche jamais les réponses des `MatchParticipant` réellement inscrits sur les feuilles — la seule chose que le code déduit de la réponse, c'est qui doit payer (`payers = titulaires`, sessions/[id]/page.tsx:97-103). Conséquence concrète pour l'occasionnel : le titulaire qui ne vient pas garde sa place jusqu'à 20 h, le remplaçant ne monte jamais, et le club facture 4,80 € à quelqu'un qui n'était pas là. Aucun écran ne demande, à 19 h 50, « qui est arrivé ? ».

> `five-scorer/prisma/schema.prisma:452-467 ; five-scorer/app/c/[slug]/sessions/[id]/page.tsx:97-103`

### `SOIREE-07` — ◐ partiel · *gêne un lundi*

**La situation.** Le capitaine met à jour la présence d'un joueur sans compte (ou d'un membre qui a répondu sur WhatsApp).

**Ce qu'on attend.** Il touche le joueur et fait tourner présent → peut-être → absent.

**Où ça en est.** Rien sur le téléphone pour répondre à la place d'un autre, alors que le club décide sur WhatsApp et que c'est le capitaine qui reporte.

> `site : SessionRsvpAdmin.tsx:203-213,34-39 → matchday.ts:88-91 (fait) ; app : app/soiree/[id].tsx:73-84 (absent : seul `monPlayerId` peut être visé)`

### `SOIREE-13` — ◐ partiel · *gêne un lundi*

**La situation.** Sur l'app, sans réseau (gymnase, canapé en 3G faible), je réponds présent.

**Ce qu'on attend.** La réponse part quand le réseau revient.

**Où ça en est.** Décision écrite : « exige le réseau, on répond depuis son canapé ». L'erreur affichée est « Impossible de joindre … » ; rien n'est mis en file. La fiche elle-même n'a pas de cache : hors réseau elle est vide.

> `five-scorer-mobile/lib/api.ts:391-403 ; lib/appel.ts:56-67 ; lib/outbox/types.ts:95-180`

### `SOIREE-15` — ◐ partiel · *gêne un lundi*

**La situation.** Le mardi, pour la caisse, le capitaine corrige qui était vraiment là lundi ; ou quelqu'un répond à une soirée annulée.

**Ce qu'on attend.** À trancher : soit permis à l'admin, soit refusé clairement.

**Où ça en est.** Trois comportements différents pour la même règle absente. Sur l'app, le capitaine ne peut plus corriger après coup ; sur le site, n'importe qui peut répondre à une soirée d'il y a six mois.

> `serveur : matchday.ts:77-96, rsvp/route.ts:41-59 (aucune garde de date ni d'annulation) ; app/soiree/[id].tsx:98 (boutons cachés si passée, pas si annulée) ; site : toujours ouvert`

### `SOIREE-19` — ◐ partiel · *gêne un lundi*

**La situation.** Un titulaire se désiste, le premier de la file passe titulaire.

**Ce qu'on attend.** Le nouveau titulaire est prévenu qu'il joue.

**Où ça en est.** Le rang bouge silencieusement ; le remplaçant l'apprend s'il rouvre la fiche.

> `lib/presences.ts:103-115 (recalcul fait) ; aucune notification`

### `SOIREE-30` — ◐ partiel · *gêne un lundi*

**La situation.** Coup d'envoi sans compo préparée : qui est pré-coché ?

**Ce qu'on attend.** Les présents (abonnés compris), comme partout ailleurs.

**Où ça en est.** Le site ne pré-coche que les réponses IN explicites : onze abonnés silencieux = personne de coché. L'app fait l'inverse (et ignore les absents déclarés).

> `app/c/[slug]/matches/new/page.tsx:48,79-84 (rsvps IN brutes) ; app : app/compo.tsx:135-139 (abonnés présélectionnés)`

### `SOIREE-39` — ◐ partiel · *gêne un lundi*

**La situation.** Le capitaine saisit le prix du terrain (48 €).

**Ce qu'on attend.** La part par joueur s'affiche à côté du compte des présents.

**Où ça en est.** Sur le téléphone, aucun moyen de poser le prix ni de cocher qui a payé.

> `site : MoneyPanel.tsx:63-78,100-108 → app/actions/payments.ts:12-44 (fait) ; app : app/soiree/[id].tsx:302-318 (lecture seule, aucune saisie)`

### `SOIREE-49` — ◐ partiel · *gêne un lundi*

**La situation.** Une soirée est annulée (canceledAt posé, par exemple en base) : que voit-on sur sa fiche ?

**Ce qu'on attend.** Un bandeau clair, pas de « Lancer un match », pas de compo à faire, réponses fermées.

**Où ça en est.** Le titre, la date, la compo et les actions ignorent l'annulation.

> `site : sessions/[id]/page.tsx:87 (seul usage de canceledAt), 383-407 (Lancer/Saisir toujours proposés), SessionRsvpAdmin.tsx:167-169 (« Annulée » dans la phrase d'état) ; app : app/soiree/[id].tsx:215 (« Soirée annulée »), 98 (boutons de réponse encore là)`

### `SOIREE-59` — ◐ partiel · *gêne un lundi*

**La situation.** La saison est posée ; quelqu'un ajoute « une soirée » le même lundi à la main.

**Ce qu'on attend.** Refus ou fusion : une seule soirée par lundi.

**Où ça en est.** Deux soirées le même soir : réponses éclatées, deux compos, l'accueil prend la première par date.

> `lib/calendrier-serveur.ts:115-131 (dédoublonne seulement à la génération) ; matchday.ts:25-33 et nouvelle/route.ts:46-57 (aucune garde)`

### `SOIREE-18` — ✔ fait · *gêne un lundi*

**La situation.** Plus de présents que de places : qui joue, qui attend.

**Ce qu'on attend.** Une liste d'attente ordonnée, lisible, et « présents » = ceux qui jouent.

**Où ça en est.** « En attente » affiché, les remplaçants après les titulaires, et ils ne paient pas. MAIS la capacité par défaut est 12 (schema:173) pour un club qui joue à 10-18 : si le club n'a pas réglé la capacité, six joueurs se retrouvent « en attente » un lundi à 18.

> `lib/presences.ts:100-115 ; SessionRsvpAdmin.tsx:95-101,191 ; soirees/[matchDayId]/route.ts:113,121-122 ; MoneyPanel.tsx:41`

### `SOIREE-25` — ✔ fait · *gêne un lundi*

**La situation.** On repart de la compo de lundi dernier et on ajuste.

**Ce qu'on attend.** Un bouton, la compo précédente arrive, joueurs partis exclus.

**Où ça en est.** « Aucune compo précédente à reprendre. » quand il n'y en a pas. Elle écrase la compo courante sans demander.

> `app/actions/compo.ts:92-145 ; CompoSoiree.tsx:173-183 ; sessions/[id]/page.tsx:224-230 (key)`

### `SOIREE-26` — ✔ fait · *gêne un lundi*

**La situation.** On a retenu 14 joueurs, on veut deux équipes équilibrées.

**Ce qu'on attend.** Tirage par niveau, gardiens séparés, re-tirable.

**Où ça en est.** « Retiens d'abord les joueurs de la soirée. » si moins de deux. Ne convoque personne de lui-même (commentaire l.151-152).

> `CompoSoiree.tsx:153-171 (lib/balance) ; app : app/compo.tsx:203-212`

### `SOIREE-36` — ✔ fait · *gêne un lundi*

**La situation.** Mardi matin, coller le résumé de la soirée sur le groupe WhatsApp.

**Ce qu'on attend.** Le mot est prêt : gagnant de la soirée, chaque match, buteurs, homme du match ; un bouton partager.

**Où ça en est.** Une seule composition côté serveur. Repli window.prompt sans presse-papier (site l.21-26).

> `lib/soiree.ts:39-85 ; site : sessions/[id]/MotDeLaSoiree.tsx ; app : app/soiree/[id].tsx:86-91,230-241 (Share natif)`

### `SOIREE-53` — ✔ fait · *gêne un lundi*

**La situation.** Lundi dernier on a joué sans ouvrir la feuille ; on veut rattraper.

**Ce qu'on attend.** Le calendrier le réclame et mène à une saisie datée du bon lundi, rattachée à la soirée.

**Où ça en est.** « Saisir » pendant six semaines, pour qui peut scorer.

> `app/api/clubs/[clubId]/saison/route.ts:123-132 ; app/c/[slug]/saison/page.tsx:114-116 ; five-scorer-mobile/app/club/[id]/saison.tsx:86-96 → app/compo.tsx:64-86,245 ; site : sessions/[id]/page.tsx:386-392`

### `SOIREE-55` — ✔ fait · *gêne un lundi*

**La situation.** Ouvrir une soirée jouée : ce qui s'est passé avant qui venait.

**Ce qu'on attend.** Bilan (matchs gagnés Blanc/Noir), mot, matchs, cracks, puis la préparation.

**Où ça en est.** L'ordre bascule dès qu'un match existe.

> `sessions/[id]/page.tsx:109-134,257-371,410-417 ; soirees/[matchDayId]/route.ts:159-197,263-316 ; app/soiree/[id].tsx:159-185,221-228`

### `SOIREE-33` — ⚠ faux · *gêne une saison*

**La situation.** Lundi 20 h, au gymnase, le capitaine lance le match depuis son téléphone.

**Ce qu'on attend.** Le match appartient à la soirée du jour : bilan, mot, « soirées jouées », calendrier.

**Où ça en est.** Le seul chemin qui rattache est « Saisir » depuis le calendrier de saison (saison.tsx:86-96). Un lundi joué depuis l'accueil mobile = soirée à « 0 match », mot vide, calendrier qui réclame « Saisir » six semaines.

> `five-scorer-mobile/app/soiree/[id].tsx (aucun bouton Lancer / Saisir) ; app/club/[id]/index.tsx:163-173 et app/club/[id]/_layout.tsx:88-104 (→ /compo sans soireeId) ; app/compo.tsx:245 (`matchDayId: soireeId ?? null`) ; app/api/clubs/[clubId]/matches/route.ts:203-209 (ne rattache pas par date)`

### `SOIREE-40` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine coche « a payé » sur Momo, abonné qui n'a rien répondu (le cas normal du club).

**Ce qu'on attend.** Coché.

**Où ça en est.** La caisse liste tous les titulaires mais ne sait cocher que ceux qui ont une ligne Rsvp. Le modèle « abonné » a été ajouté sans mettre la caisse à jour : pour la majorité du club, le tap échoue et se rétracte.

> `app/actions/payments.ts:68-74 (updateMany sur Rsvp inexistant → « Pas de réponse de ce joueur. ») ; sessions/[id]/page.tsx:101-107 (payers = titulaires, abonnés compris) ; MoneyPanel.tsx:80-98`

### `SOIREE-42` — ⚠ faux · *gêne une saison*

**La situation.** Liste des soirées : « 48 € réglé » ou « 48 € à encaisser ».

**Ce qu'on attend.** Réglé quand tous ceux qui jouent ont payé.

**Où ça en est.** Les abonnés silencieux ne comptent ni dans « attendus » ni dans « payés » : « réglé » s'affiche dès que les deux qui ont répondu ont payé. Avec zéro réponse explicite, jamais « réglé ».

> `app/c/[slug]/sessions/page.tsx:80-81 ; app/api/clubs/[clubId]/soirees/route.ts:80-81,98 (IN explicites seulement)`

### `SOIREE-51` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine supprime une soirée où trois matchs ont été joués.

**Ce qu'on attend.** Soit refusé, soit dit clairement ce qui part.

**Où ça en est.** Les matchs survivent mais perdent leur lundi (bilan, mot, « soirées jouées ») ; la caisse (hasPaid) et la compo sont perdues ; la question ne parle que des réponses. Et si la soirée vient d'une saison posée d'un bloc, la régénération la recrée (calendrier-serveur.ts:115-131).

> `sessions/[id]/DeleteSessionButton.tsx:36 (« Sûr ? Les réponses partent avec. ») → matchday.ts:38-55 ; prisma/schema.prisma:358-359 (Match SetNull), 455 et 307 (Rsvp, lineup cascade), 279-283 (doctrine « on ne supprime pas »)`

### `SOIREE-17` — ✗ absent · *gêne une saison*

**La situation.** Dimanche soir, il manque encore 3 joueurs — ou au contraire on est 14.

**Ce qu'on attend.** Quelqu'un est prévenu (le capitaine, le groupe), ou la soirée bascule.

**Où ça en est.** L'état existe, il ne déclenche rien. MOBILE.md §2 annonce des push « le jeudi pour le lundi », non faites.

> `aucun (lib/presences.ts ne fait que calculer ; aucune notification ni automatisme dans app/, lib/, five-scorer-mobile/)`

### `SOIREE-44` — ✗ absent · *gêne une saison*

**La situation.** Qui doit payer : ceux qui ont dit venir, ou ceux qui ont joué d'après les feuilles ?

**Ce qu'on attend.** À trancher par le club ; aujourd'hui aucun rapprochement.

**Où ça en est.** Un abonné qui n'est pas venu sans le dire est facturé ; l'invité qui a joué sans être « présent » ne l'est pas.

> `sessions/[id]/page.tsx:99-107 (titulaires des réponses) ; aucun lien avec MatchParticipant`

### `SOIREE-47` — ✗ absent · *gêne une saison*

**La situation.** Terrain fermé, vacances, trop peu de monde : annuler lundi.

**Ce qu'on attend.** Un bouton « Annuler la soirée » avec un motif ; la soirée reste au calendrier, barrée.

**Où ça en est.** Toute la chaîne d'affichage est prête (presences.ts « annulée », saison/route.ts:107-110, soirees/route.ts:89-90, iCal STATUS:CANCELLED, soirees.tsx barré, soiree/[id].tsx:215) mais personne ne peut poser canceledAt depuis un écran. Le seul geste offert est « Supprimer ».

> `app/actions/calendrier.ts:43-62 (annulerSoiree existe, admins, motif 120 car.) — aucun appelant dans app/ ni components/ ; app : rien (aucune route HTTP d'annulation)`

### `SOIREE-48` — ✗ absent · *gêne une saison*

**La situation.** Finalement le terrain rouvre : rétablir la soirée annulée.

**Ce qu'on attend.** Un bouton « Rétablir ».

**Où ça en est.** Même trou que SOIREE-47.

> `app/actions/calendrier.ts:64-79 (retablirSoiree, sans appelant)`

### `SOIREE-80` — ✗ absent · *gêne une saison*

**La situation.** Je vois que douze personnes sont comptées présentes sans avoir rien dit. Je me demande si je dois cocher « Vient tous les lundis » pour avoir une chance de jouer.

**Ce qu'on attend.** Que l'interrupteur dise ce qu'il fait vraiment : s'abonner, c'est prendre une place d'office dès la naissance de la soirée, devant tous ceux qui répondront.

**Où ça en est.** Le texte d'aide de l'interrupteur ne parle que d'absence : « Compté présent d'office. Tu peux toujours te déclarer absent sur une soirée. » (Abonnement.tsx:48-52). Il ne dit rien de la conséquence qui compte quand il y a plus de monde que de places : `engageA: (e.repondueLe ?? creeeLe)` (presences.ts:93) donne à tout abonné la date de CRÉATION de la soirée, c'est-à-dire une ancienneté que personne ne peut rattraper en répondant. Un club de douze abonnés et douze places est fermé : celui qui vient un lundi sur trois et ne s'abonne pas ne jouera jamais, et rien à l'écran ne le lui explique. C'est aussi la mécanique derrière SOIREE-20 (l'abonné du samedi qui double la file).

> `five-scorer/app/c/[slug]/players/[id]/Abonnement.tsx:45-54 ; five-scorer/lib/presences.ts:92-100`

### `SOIREE-81` — ✗ absent · *gêne une saison*

**La situation.** En février, je veux savoir combien de lundis je suis venu cette saison — c'est le seul chiffre qui me situe dans un club où d'autres viennent toutes les semaines.

**Ce qu'on attend.** « 7 soirées sur 22 » quelque part sur ma fiche.

**Où ça en est.** `LeaderboardRow` ne compte que des MATCHS : `matchesPlayed`, `goals`, `wins`, `form`, `elo` (stats.ts:105-127). `getPlayerDetail` construit tout à partir de `matchParticipant` (stats.ts:397-424) et ne regroupe jamais par `matchDayId` — le mot « soirée » n'apparaît pas dans la fiche. L'occasionnel lit donc « 24 matchs joués » là où il vivait « je suis venu 6 fois », et se compare à un abonné qui affiche 160 matchs pour la même saison. Le chiffre existe en base (chaque `Match` porte un `matchDayId`), il n'est simplement jamais compté.

> `five-scorer/lib/stats.ts:105-127 ; five-scorer/lib/stats.ts:397-455`

### `SOIREE-09` — ◐ partiel · *gêne une saison*

**La situation.** Un nouveau membre a rejoint le club mais son compte n'est lié à aucun profil joueur.

**Ce qu'on attend.** On lui dit qu'il doit revendiquer son profil pour répondre.

**Où ça en est.** Le titre devient « Présences » et le segment disparaît, sans une phrase pour expliquer pourquoi ni où aller.

> `app/c/[slug]/sessions/[id]/page.tsx:66-69,205 ; SessionRsvpAdmin.tsx:136-137 ; soirees/[matchDayId]/route.ts:224-226 ; app/soiree/[id].tsx:98`

### `SOIREE-35` — ◐ partiel · *gêne une saison*

**La situation.** L'invité d'un soir, six lundis plus tard.

**Ce qu'on attend.** Il ne traîne plus dans la liste des présences ni dans « hors compo ».

**Où ça en est.** Chaque invité reste à vie dans les listes de toutes les soirées, sauf archive manuelle.

> `app/api/clubs/[clubId]/roster/route.ts:34-38 (isGuest, non archivé) ; sessions/[id]/page.tsx:60-65 et soirees/[matchDayId]/route.ts:73-76 (tous les non-archivés) ; aucune archive automatique`

### `SOIREE-06` — ✔ fait · *gêne une saison*

**La situation.** Un habitué veut s'abonner (ou se désabonner) aux lundis ; le capitaine veut le faire pour un joueur sans compte.

**Ce qu'on attend.** Un interrupteur sur la fiche du joueur, pour soi ou par un gérant.

**Où ça en est.** Garde « Tu ne peux régler que ton propre abonnement. » pour un membre visant un autre.

> `app/actions/roster.ts:20-42 ; app/c/[slug]/players/[id]/Abonnement.tsx ; app/api/clubs/[clubId]/joueurs/[playerId]/abonnement/route.ts ; five-scorer-mobile/lib/api.ts:589`

### `SOIREE-08` — ✔ fait · *gêne une saison*

**La situation.** Un simple membre tente de répondre pour un autre joueur (requête rejouée ou écran bidouillé).

**Ce qu'on attend.** Refus net.

**Où ça en est.** « Tu ne peux répondre que pour toi. » (403 côté API). Identifiants validés par idsValides avant tout where.

> `app/actions/matchday.ts:88-91 ; rsvp/route.ts:50-53`

### `SOIREE-58` — ✔ fait · *gêne une saison*

**La situation.** Ajouter un lundi hors calendrier (tournoi, rattrapage).

**Ce qu'on attend.** Date, lieu, titre ; on atterrit sur la soirée créée.

**Où ça en est.** Défaut app = prochain lundi 20 h (le modèle du club) ; défaut site = demain 19 h. Date passée acceptée (utile pour saisir après coup).

> `site : app/c/[slug]/matches/new-session/NewSessionForm.tsx → matchday.ts:11-36 ; app : app/soiree/nouvelle.tsx:62-79,165-176 → soirees/nouvelle/route.ts`

### `SOIREE-64` — ✔ fait · *gêne une saison*

**La situation.** Un membre tente de fixer le prix, cocher un paiement, supprimer la soirée.

**Ce qu'on attend.** Refus explicite, et rien de proposé à l'écran.

**Où ça en est.** Garde serveur + écran masqué. La compo, elle, s'ouvre à qui peut scorer (compo.ts:31) — donc à tous les membres si le réglage le permet.

> `payments.ts:24,60 ; matchday.ts:49 (« Réservé aux admins. ») ; MoneyPanel.tsx:113,165 ; sessions/[id]/page.tsx:419 (canManage)`

### `SOIREE-38` — ⚠ faux · *confort*

**La situation.** La soirée comptait un match contre une autre équipe : le mot et le total de buts diffèrent entre le site et l'app.

**Ce qu'on attend.** Le même mot d'où qu'on le copie (c'est le but déclaré de lib/soiree.ts).

**Où ça en est.** Deux filtres différents autour d'une seule fonction. Rare pour ce club, mais contredit l'intention écrite.

> `sessions/[id]/page.tsx:111,122,176 (tous les matchs terminés) vs soirees/[matchDayId]/route.ts:155-156,167,287 (internes seulement)`

### `SOIREE-41` — ⚠ faux · *confort*

**La situation.** Soirée pleine, le capitaine coche « a payé » sur un joueur.

**Ce qu'on attend.** Rien d'autre ne bouge.

**Où ça en est.** La coche ré-horodate la réponse : le joueur passe au bout de la file d'attente. Un lundi ordinaire (capacité non atteinte) ne le voit pas.

> `prisma/schema.prisma:463 (respondedAt @updatedAt) ; payments.ts:68-71 ; lib/presences.ts:93`

### `SOIREE-31` — ✗ absent · *confort*

**La situation.** Deux admins enregistrent une compo différente à trente secondes d'écart.

**Ce qu'on attend.** Le second est prévenu que la compo a changé.

**Où ça en est.** Dernier écrit gagne en silence ; la clé dérivée (page.tsx:227-230) ne réaligne qu'après refresh.

> `app/actions/compo.ts:66-83 (deleteMany + createMany, pas de version)`

### `SOIREE-62` — ✗ absent · *confort*

**La situation.** Une consigne pour lundi : « venez à 19 h 45, terrain 3, maillot blanc ».

**Ce qu'on attend.** Un mot du capitaine sur la fiche, visible par tous.

**Où ça en est.** Le champ existe et s'affiche, personne ne peut le remplir.

> `prisma/schema.prisma:276 (`notes`) ; affiché sessions/[id]/page.tsx:382, soirees/[matchDayId]/route.ts:208, app/soiree/[id].tsx:212-214 ; aucun writer (seules les notes de MATCH s'écrivent, app/actions/matches.ts:80-81)`

### `SOIREE-79` — ✗ absent · *confort*

**La situation.** J'ai touché « Pas là » par réflexe alors que je voulais juste ouvrir la fiche. Je voudrais revenir à « je n'ai pas encore répondu ».

**Ce qu'on attend.** Pouvoir retirer sa réponse, comme on décoche une case.

**Où ça en est.** Les deux seules écritures possibles sont des `upsert` avec un statut obligatoire pris dans `["IN", "OUT", "MAYBE"]` (matchday.ts:66, 88-92 ; rsvp/route.ts:11, 53-58). Il n'existe aucun DELETE sur `Rsvp` côté soirée : une fois la ligne créée, elle ne disparaît plus. Pour un abonné c'est grave — un OUT posé par erreur ne se retire pas, il faut le retourner en IN, ce qui lui fait perdre son ancienneté (presences.ts:93) ; pour l'occasionnel, ça veut dire qu'on ne peut jamais revenir au silence, et que le club ne distingue plus « il a dit non » de « il n'a rien dit ».

> `five-scorer/app/actions/matchday.ts:88-92 ; five-scorer/app/api/clubs/[clubId]/soirees/[matchDayId]/rsvp/route.ts:53-58`

### `SOIREE-04` — ◐ partiel · *confort*

**La situation.** Un joueur ne sait pas encore et veut dire « peut-être » lui-même, sur le site.

**Ce qu'on attend.** Trois réponses possibles, comme sur l'app.

**Où ça en est.** Sur le site, MAYBE n'est atteignable que par le cycle admin (l.34-39). Un joueur mis en « peut-être » par l'admin voit son segment sans bouton actif.

> `site : SessionRsvpAdmin.tsx:137-160 (Présent / Absent seulement) ; app : app/soiree/[id].tsx:100-105 (trois boutons)`

### `SOIREE-12` — ◐ partiel · *confort*

**La situation.** Le capitaine et un admin touchent le même joueur au même moment sur le site.

**Ce qu'on attend.** Le résultat final est clair pour les deux.

**Où ça en est.** Dernier écrit gagne ; le cycle `nextStatus(p.status)` part du statut périmé à l'écran, puis router.refresh() réaligne. Pas de conflit signalé.

> `SessionRsvpAdmin.tsx:80-93,208`

### `SOIREE-14` — ◐ partiel · *confort*

**La situation.** Sur le site, la réponse échoue (réseau coupé, session expirée).

**Ce qu'on attend.** L'écran revient à l'état réel et le dit.

**Où ça en est.** L'optimiste n'est PAS annulé sur échec (contrairement à MoneyPanel.tsx:88-95) ; l'écran garde « Présent » tant que router.refresh() n'a pas réussi.

> `SessionRsvpAdmin.tsx:80-93`

### `SOIREE-34` — ◐ partiel · *confort*

**La situation.** Un pote vient lundi, il n'est pas dans l'effectif : le mettre dans la compo préparée.

**Ce qu'on attend.** Ajouter un invité d'un soir directement dans la compo.

**Où ça en est.** Sur le site il faut d'abord passer par l'effectif.

> `site : CompoSoiree.tsx (pas d'ajout ; `joueurs` = effectif non archivé, page.tsx:60-65) ; app : app/compo.tsx:214-224 (« + Invité », au coup d'envoi seulement)`

### `SOIREE-43` — ◐ partiel · *confort*

**La situation.** Dix ont payé 4,80 € ; deux retardataires se déclarent présents après coup.

**Ce qu'on attend.** L'encaissé reste 48 € ; la part des deux nouveaux se calcule à part.

**Où ça en est.** « A payé » est un booléen, pas un montant : l'encaissé se recalcule avec la nouvelle part (4 €) et affiche 40 € pour 48 € reçus.

> `MoneyPanel.tsx:53-61 ; soirees/[matchDayId]/route.ts:141,148 (encaissé = nb payés × part courante)`

### `SOIREE-46` — ◐ partiel · *confort*

**La situation.** Un membre veut voir la note du terrain et qui a payé.

**Ce qu'on attend.** Il voit le prix, sa part, la liste — sans pouvoir cocher.

**Où ça en est.** L'app reçoit `terrain.payeurs` (route.ts:260) et ne l'affiche pas.

> `site : sessions/[id]/page.tsx:192 (showMoney), MoneyPanel.tsx:132-141,165-181 (fait) ; app : app/soiree/[id].tsx:302-318 (encaissé + jauge, pas de liste par joueur)`

### `SOIREE-52` — ◐ partiel · *confort*

**La situation.** La suppression échoue (soirée déjà supprimée, autre club).

**Ce qu'on attend.** On me le dit.

**Où ça en est.** Retour ok et navigation vers la liste quelle que soit l'issue.

> `app/actions/matchday.ts:50-54 (.catch(() => null) puis ok:true) ; DeleteSessionButton.tsx:50-55`

### `SOIREE-54` — ◐ partiel · *confort*

**La situation.** Un lundi d'il y a deux mois, jamais saisi.

**Ce qu'on attend.** Une règle : encore saisissable, ou définitivement « pas joué ».

**Où ça en est.** Le calendrier se tait, la fiche du site propose toujours, la fiche de l'app jamais. Trois réponses à une question non tranchée (même question Q2 de la spec 0001).

> `saison/route.ts:127 (42 jours, puis silence) ; sessions/[id]/page.tsx:194-196,386 (« Saisir un match joué » sans limite) ; app/soiree/[id].tsx (rien)`

### `SOIREE-56` — ◐ partiel · *confort*

**La situation.** Une soirée d'il y a six mois : on retouche la compo, les présences, le prix.

**Ce qu'on attend.** Possible pour corriger, mais dit très fort (classement déjà lu).

**Où ça en est.** Tout reste ouvert, sans avertissement ni trace de qui a modifié.

> `aucune garde de date : compo.ts, matchday.ts, payments.ts ; sessions/[id]/page.tsx:198-255 (préparation toujours éditable)`

### `SOIREE-60` — ◐ partiel · *confort*

**La situation.** Soirée créée alors qu'aucune saison n'était active, puis une saison est ouverte.

**Ce qu'on attend.** La soirée est visible dans le calendrier de la saison.

**Où ça en est.** Elle reste dans « Les soirées » mais disparaît de « Saison ».

> `matchday.ts:21-29 ; nouvelle/route.ts:37-44 (seasonId null) ; saison/route.ts:54 (filtre par seasonId dès qu'une saison existe)`

### `SOIREE-63` — ◐ partiel · *confort*

**La situation.** Sur l'app, dans « Les soirées », ajouter une soirée.

**Ce qu'on attend.** Un bouton « Ajouter », comme sur le site.

**Où ça en est.** Il faut savoir que ça se trouve sous Saison.

> `five-scorer-mobile/app/club/[id]/soirees.tsx (aucun bouton ; `club.peutMarquer` reçu de soirees/route.ts:130 et inutilisé) ; app/club/[id]/saison.tsx:241-250 (seule entrée)`

### `SOIREE-66` — ◐ partiel · *confort*

**La situation.** Lien profond vers une soirée reçu sur WhatsApp, l'utilisateur est dans deux clubs.

**Ce qu'on attend.** La bonne soirée s'ouvre.

**Où ça en est.** Si la soirée est du second club : 404 « introuvable ».

> `five-scorer-mobile/app/soiree/[id].tsx:50-56 (repli sur clubs[0])`

### `SOIREE-68` — ◐ partiel · *confort*

**La situation.** Une soirée annulée, une fois passée, dans la liste mobile.

**Ce qu'on attend.** On lit qu'elle a été annulée, pas « 0 match ».

**Où ça en est.** Jour barré sur l'app, rien du tout sur le site.

> `five-scorer-mobile/app/club/[id]/soirees.tsx:202-228 (motif seulement dans la branche `aVenir`) ; site : sessions/page.tsx:84-132 (aucune marque d'annulation)`

### `SOIREE-02` — ✔ fait · *confort*

**La situation.** Depuis l'accueil du site, répondre « je serai là » en un tap, sans ouvrir la fiche.

**Ce qu'on attend.** Un bouton, puis le libellé de ma réponse qui mène à la soirée.

**Où ça en est.** Le bouton ne pose que IN ; changer ensuite passe par la fiche. Cohérent avec le commentaire (« l'accueil n'est pas l'endroit pour trois boutons »).

> `app/c/[slug]/_accueil/BoutonPresence.tsx:32-51 ; app/c/[slug]/page.tsx:375-398`

### `SOIREE-11` — ✔ fait · *confort*

**La situation.** Je dis absent lundi matin, puis présent l'après-midi.

**Ce qu'on attend.** Je suis compté présent ; ma place dans la file est celle de ma dernière réponse.

**Où ça en est.** Règle assumée (commentaire l.100-102). À dire dans la spec pour ne pas la découvrir un lundi complet.

> `lib/presences.ts:93 ; matchday.ts:92-96`

### `SOIREE-28` — ✔ fait · *confort*

**La situation.** Compo déséquilibrée (7 contre 5), équipe vide, pas de gardien d'un côté.

**Ce qu'on attend.** Averti avant d'être au bord du terrain.

**Où ça en est.** Trois alertes calculées à l'écran ; n'empêchent pas d'enregistrer (voulu).

> `CompoSoiree.tsx:117-135,310-316`

### `SOIREE-32` — ✔ fait · *confort*

**La situation.** Renommer les équipes de la soirée (« Les vieux » / « Les jeunes »).

**Ce qu'on attend.** Deux champs, 40 caractères, par défaut les chasubles du club.

**Où ça en est.** Le nom repart aux chasubles si vidé. Les matchs héritent (matches/new/page.tsx:115-118).

> `CompoSoiree.tsx:341-373 ; compo.ts:61-64,76-82 ; sessions/[id]/page.tsx:56-58,236-237`

### `SOIREE-45` — ✔ fait · *confort*

**La situation.** Prix vidé, prix négatif, prix « 48,50 », prix absurde.

**Ce qu'on attend.** Vide = plus de suivi ; négatif refusé ; virgule acceptée ; plafond.

**Où ça en est.** « Montant invalide. » à l'écran pour un négatif ; serveur borne 0..100 000 €. Un prix 0 est « suivi » à 0 € chacun (liste le masque, page.tsx:118).

> `MoneyPanel.tsx:63-71 ; payments.ts:9,27-32`

### `SOIREE-65` — ✔ fait · *confort*

**La situation.** Session expirée pendant qu'on répond.

**Ce qu'on attend.** Retour à la connexion, pas un écran muet.

> `app : app/soiree/[id].tsx:58, lib/appel.ts:138 (401 → SessionExpiree) ; site : lib/guard.ts:73 (/session-expiree)`

### `SOIREE-67` — ✔ fait · *confort*

**La situation.** Club neuf, aucune soirée.

**Ce qu'on attend.** Un écran qui explique ce qu'est une soirée et propose d'en créer / de poser la saison.

**Où ça en est.** Le mobile explique mais n'offre pas le bouton (cf. SOIREE-63).

> `app/c/[slug]/sessions/page.tsx:224-245 ; five-scorer-mobile/app/club/[id]/soirees.tsx:97-107`

### `SOIREE-69` — ✔ fait · *confort*

**La situation.** Le capitaine relit la liste des présences d'un club de vingt.

**Ce qu'on attend.** Moi d'abord, ceux qui viennent, le reste replié.

**Où ça en est.** Quatre lignes puis « et N autres présents / sans réponse ». L'app affiche tout sans repli (app/soiree/[id].tsx:136-155).

> `SessionRsvpAdmin.tsx:103-122,221-232 ; soirees/[matchDayId]/route.ts:129-134`

## Le match en direct

*80 cas — 25 faits, 30 partiels, 11 absents, **14 faux**.*

### `HL-04` — ⚠ faux · *bloque un lundi*

**La situation.** Le téléphone du marqueur meurt pour de bon. Quelqu'un d'autre sort le sien pour finir le match.

**Ce qu'on attend.** Descendre la feuille (ce que le serveur en sait) sur le second téléphone et continuer là où on en était.

**Où ça en est.** Le site refuse proprement. L'app fait pire : l'accueil montre le match « En direct » venu du serveur, on le tape, la feuille lit la base locale, ne trouve rien, et reste sur « Un instant… » pour toujours. La route serveur écrite exactement pour ce cas n'est branchée nulle part.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:549-563 (« Match introuvable — n'existe pas dans la mémoire locale de cet appareil ») ; five-scorer-mobile/app/match/[id].tsx:238-247 ; five-scorer-mobile/app/club/[id]/index.tsx:203-207 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:8-14 (GET « c'est la REPRISE », jamais appelé par la feuille)`

### `HL-12` — ⚠ faux · *bloque un lundi*

**La situation.** Lundi 20 h 05. Le téléphone du marqueur se raccroche tout seul au Wi-Fi d'Urban Soccer (réseau déjà connu). Le portail n'a pas été validé ce soir : chaque requête ressort avec la page d'accueil du portail, en HTML, sous un code 200. On saisit la soirée normalement, la pastille dit « À jour ».

**Ce qu'on attend.** La soirée reste dans le téléphone tant qu'elle n'est pas arrivée à NOTRE serveur. Une page de portail n'est pas un accusé de réception.

**Où ça en est.** `leverSiRefus` ne regarde que `res.ok` : « if (res.ok) return; » (sync.ts:417). La redirection vers le portail est suivie par fetch et finit en 200 text/html — donc pas d'erreur, donc `retirer(base, suivante.id!)` (sync.ts:284) supprime l'opération de la file. Une par une, les créations de match, les buts et les fins de match disparaissent, et la pastille passe à « À jour » parce que `enAttente` retombe à zéro. Le site a exactement le même contrôle (lib/sync.ts:186, suppression en :272). Nulle part le `content-type` ni le corps de la réponse ne sont vérifiés. C'est le seul cas où la file d'attente PERD la soirée au lieu de la garder.

> `five-scorer-mobile/lib/outbox/sync.ts:417 et :284 ; five-scorer/lib/sync.ts:186 et :272 ; five-scorer-mobile/lib/appel.ts:139`

### `COMPO-09` — ◐ partiel · *bloque un lundi*

**La situation.** Installation neuve de l'app, jamais ouverte en ligne, et pas de réseau au gymnase.

**Ce qu'on attend.** Un message qui dit clairement qu'il faut ouvrir l'app une fois avec du réseau — pas un écran vide.

**Où ça en est.** L'app se rabat sur le cache ; s'il est vide, elle affiche le message brut de l'erreur réseau (compo.tsx:164). Le site sert la coquille depuis le service worker si elle a déjà été visitée, sinon la page « hors-ligne ». Ni l'un ni l'autre ne dit « ouvre l'app une fois en ligne avant lundi ».

> `five-scorer-mobile/app/compo.tsx:140-165 ; five-scorer/public/sw.js:175-225`

### `DIRECT-34` — ◐ partiel · *bloque un lundi*

**La situation.** 19 h 50. Le match de lundi dernier n'a jamais été terminé (on a rangé le téléphone à la fin). On ouvre l'app, l'accueil du club propose un gros bouton « Reprendre le match ». On tape dessus, dix gars attendent.

**Ce qu'on attend.** Le bouton parle du match de CE SOIR. Une feuille vieille d'une semaine ne se rouvre pas par le geste qu'on fait pour commencer.

**Où ça en est.** `getLiveMatchOfClub` rend le match LIVE local le plus récent, quel que soit son âge (`ORDER BY played_at DESC LIMIT 1`), et l'accueil en fait le libellé du bouton principal. La feuille qui s'ouvre est celle de lundi dernier : `estRetro` est vrai (plus de six heures, lib/noyau/retro.ts:17), donc plus de chrono, les buts tapés ce soir s'inscrivent sans minute dans le match du 1er septembre, et le score de départ est celui de la semaine passée. Le seul signal est la petite légende « lun. 1 sept. · Feuille » dans la barre du haut. Rien ne ferme un match ouvert et abandonné, ni côté téléphone ni côté serveur.

> `five-scorer-mobile/app/club/[id]/index.tsx:76 et 163-173 ; lib/match/tables.ts:287-297 ; app/match/[id].tsx:435-440`

### `DIRECT-01` — ✔ fait · *bloque un lundi*

**La situation.** Coup d'envoi sans aucun réseau au gymnase.

**Ce qu'on attend.** La feuille s'ouvre instantanément, le chrono tourne, rien n'attend le serveur.

**Où ça en est.** Le match est écrit localement avec l'opération createMatch dans la même transaction, l'écran part sans attendre. Sur le site, la navigation client vers /live échoue vite (503 en 4 s) et le service worker sert la coquille /play.

> `five-scorer/lib/localMatch.ts:132-208 ; five-scorer/public/sw.js:208-217 ; five-scorer-mobile/lib/match/local.ts:270-335 ; five-scorer-mobile/app/compo.tsx:247-250`

### `DIRECT-03` — ✔ fait · *bloque un lundi*

**La situation.** Karim marque. Le marqueur, debout, d'une main, tape sur sa tuile sans regarder.

**Ce qu'on attend.** Le score monte tout de suite, un son et une vibration confirment, le buteur compte, une passe décisive est proposée quinze secondes sans bloquer.

**Où ça en est.** Le son part avant l'écriture, l'événement et son opération d'envoi tombent ensemble, l'invite « Passe décisive ? » s'efface seule après 15 s (INVITE_MS).

> `five-scorer/components/PlayerTile.tsx:83-97 ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:305-331 ; five-scorer-mobile/app/match/[id].tsx:270-288`

### `HL-01` — ✔ fait · *bloque un lundi*

**La situation.** Toute la soirée saisie sans réseau ; on rentre chez soi, le wifi revient.

**Ce qu'on attend.** Tout part tout seul, dans l'ordre, sans doublon, sans rien perdre — même si l'app a été tuée entre-temps.

**Où ça en est.** FIFO sur la clé auto-incrémentée, suppression après accusé, serveur idempotent par identifiant client. Déclencheurs : retour du réseau, retour au premier plan, chaque mutation, relance 5 s → 60 s. Test « cinquante opérations, serveur en panne, processus relancé ».

> `five-scorer/lib/sync.ts:237-352,358-386 ; five-scorer-mobile/lib/outbox/sync.ts:266-303 ; five-scorer-mobile/composants/Noyau.tsx:81-104,125-135 ; five-scorer-mobile/lib/outbox/sync.test.ts:420-467`

### `HL-02` — ✔ fait · *bloque un lundi*

**La situation.** Réseau dégradé — une barre qui va et vient, le vrai cas du gymnase.

**Ce qu'on attend.** Rien ne gèle : ni la feuille, ni la pastille, ni la navigation.

**Où ça en est.** 8 s maximum par rejeu, 4 à 6 s côté service worker, échec rapide des navigations client pour retomber sur la coquille en cache.

> `five-scorer/lib/sync.ts:90-100 ; five-scorer/public/sw.js:43-45,239-261 ; five-scorer-mobile/lib/outbox/sync.ts:77-80,123-148`

### `HL-03` — ✔ fait · *bloque un lundi*

**La situation.** Le téléphone meurt à la mi-temps. On le recharge dix minutes et on le rallume.

**Ce qu'on attend.** La feuille est là, avec le score, la compo et le chrono à la bonne valeur.

**Où ça en est.** Base locale persistante (persist() demandé sur le site ; SQLite WAL sur l'app). Si le chrono tournait, il a compté les dix minutes d'extinction (DIRECT-02). Si le match était en pause, il est resté figé.

> `five-scorer/components/OfflinePrimer.tsx:28-30 ; five-scorer/components/ReprendreLocal.tsx ; five-scorer/components/PlayShell.tsx:91-110 ; five-scorer-mobile/composants/Noyau.tsx:81-83 ; five-scorer-mobile/app/club/[id]/index.tsx:73-79 ; five-scorer-mobile/lib/match/localMatch.test.ts:1093-1094`

### `COMPO-02` — ⚠ faux · *gêne un lundi*

**La situation.** Personne n'a fait les équipes ; on tape « Équilibrer » puis « Retirer au sort » jusqu'à ce que ça plaise.

**Ce qu'on attend.** Deux équipes de force égale, gardiens séparés, et un tirage différent d'une semaine à l'autre.

**Où ça en est.** L'algorithme est le même des deux côtés et fait ce qu'il dit. Mais le générateur est déterministe par graine : le site tire la graine au hasard au montage (NewMatchForm.tsx:133-137, commentaire : « on tourne les équipes n'arrivait jamais »), l'app repart de graine 1 à chaque ouverture (compo.tsx:90). Sur l'app, à effectif égal, « Équilibrer » redonne exactement les équipes de la semaine dernière.

> `five-scorer/lib/balance.ts:94-148 ; five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:128-137 ; five-scorer-mobile/app/compo.tsx:90,203-212`

### `DIRECT-23` — ⚠ faux · *gêne un lundi*

**La situation.** Vingtième but de la soirée. Quatorze joueurs, tous avec leur photo. On tape la tuile sans regarder.

**Ce qu'on attend.** Le score monte sous le doigt au vingtième but comme au premier.

**Où ça en est.** Chaque but appelle `relire()` → `getLocalMatch` → `lireJoueurs`, qui fait `SELECT * FROM roster WHERE id IN (…)` — donc la colonne `photo`, une data-URL JPEG d'environ 20 ko par joueur, remonte entière. Le schéma l'interdit noir sur blanc : « À ne PAS remonter dans la requête branchée sur l'affichage du match : quatorze joueurs, c'est ~280 ko rematérialisés à chaque but » (db/schema.sql:67-69). C'est pourtant ce que fait le code, à chaque but, chaque annulation, chaque carton, chaque déplacement de joueur — et une fois de plus à chaque changement de la feuille en mode correction (app/match/[id].tsx:222, effet qui dépend de `vue`). La mesure annoncée dans MOBILE.md §3.3 n'a jamais été faite.

> `five-scorer-mobile/lib/match/local.ts:868 ; lib/match/tables.ts:175-186 ; app/match/[id].tsx:128-131 et 270-283`

### `DIRECT-26` — ⚠ faux · *gêne un lundi*

**La situation.** Le club suit les passes. But de Karim, la bande « Passe décisive ? » s'ouvre. Quinze secondes plus tard, contre-attaque : deuxième but, il faut taper une tuile tout de suite.

**Ce qu'on attend.** Les deux colonnes restent entières : le but suivant se tape au même endroit que le précédent.

**Où ça en est.** La bande est rendue DANS le flux, entre le ScrollView des colonnes et la barre du bas — pas au-dessus. Pendant les 15 secondes d'`INVITE_MS`, elle prend une centaine de pixels que le ScrollView perd : le bas des deux colonnes est rogné, puis revient quand elle disparaît. Les tuiles les plus basses — donc les derniers inscrits, souvent les remplaçants et le retardataire qu'on vient de faire entrer — sont absentes de l'écran exactement pendant la fenêtre où le but suivant arrive. Et la disparition de la bande décale une nouvelle fois la mise en page, sans prévenir le doigt qui descend.

> `five-scorer-mobile/app/match/[id].tsx:717-741, 567 et style `invite` en 1191`

### `DIRECT-28` — ⚠ faux · *gêne un lundi*

**La situation.** 20 h 10, Karim arrive. On ouvre « Corriger la composition », « + Faire entrer un joueur », on le met chez les Blancs. On relève la tête : Momo marque. On tape sa tuile.

**Ce qu'on attend.** Une fois le retardataire entré, un tap sur une tuile compte de nouveau un but.

**Où ça en est.** `faireEntrer` ferme la liste (`setAjoutOuvert(false)`) mais ne sort pas du mode correction : `setCompo(false)` n'est appelé que par le bouton « Terminé » du bandeau. Le mode n'a ni fin automatique après un geste, ni délai. Le tap suivant appelle `deplacer` : Momo part chez les Noirs, son but n'est pas compté — et comme les buts déjà marqués gardent leur camp d'origine (local.ts:571-576), le score ne bouge pas d'un pixel pour le signaler. Le bandeau prévient bien (« Aucun but ne se compte tant que ce bandeau est là »), mais il prévient au moment où on ouvre le mode, pas au moment où on l'a oublié.

> `five-scorer-mobile/app/match/[id].tsx:387-400 (`faireEntrer`) et 552 (le seul `setCompo(false)`)`

### `FIN-03` — ⚠ faux · *gêne un lundi*

**La situation.** « Attends, c'était 4-3. » On veut rouvrir le match qu'on vient de terminer.

**Ce qu'on attend.** Rouvrir la feuille, corriger, refermer — avec une trace.

**Où ça en est.** Le bouton existe sur le site et ne fait rien : il repasse en phase « live », LiveMatch voit FINISHED, appelle onFinished, et on retombe sur le récap. Toute écriture est refusée « Match terminé » de toute façon. C'est l'objet de la spec 0001.

> `five-scorer/components/PlayShell.tsx:312-314 (bouton « Rouvrir le match ») ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:267-273,568 ; five-scorer-mobile : aucun chemin vers un match terminé (lib/match/tables.ts:287-297 ne rend que LIVE)`

### `HL-05` — ⚠ faux · *gêne un lundi*

**La situation.** Deux téléphones saisissent le même match (même identifiant, via un match programmé lancé des deux côtés) et tapent chacun le même but.

**Ce qu'on attend.** Un seul score juste, et les deux écrans d'accord.

**Où ça en est.** Le serveur additionne les événements des deux téléphones (chaque but a son propre identifiant) : le score serveur est le double, et chaque écran ne montre que sa moitié. La compo et le MVP sont protégés, pas les buts. Rien ne redescend du serveur vers les feuilles.

> `five-scorer/app/api/clubs/[clubId]/matches/route.ts:10-16,250-297 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:17-30 ; aucun code de lecture serveur → base locale sur la feuille`

### `RETRO-02` — ⚠ faux · *gêne un lundi*

**La situation.** Il est 21h30, on choisit « Déjà joué » pour le match de 20h qu'on n'a pas saisi en direct.

**Ce qu'on attend.** Une feuille de saisie tranquille, comme pour hier.

**Où ça en est.** « Déjà joué » n'est qu'une date ; ce qui décide, c'est le seuil de six heures. À moins de six heures, la feuille s'ouvre EN DIRECT, chrono lancé à 90:00 et déjà en rouge, et chaque but est tamponné à la 90e minute et au-delà. Le choix explicite de l'utilisateur ne prime pas.

> `five-scorer/lib/retro.ts:17 (six heures) ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:177-189 ; five-scorer-mobile/app/match/[id].tsx:195-202 ; five-scorer-mobile/lib/match/local.ts:428`

### `TRANS-63` — ⚠ faux · *gêne un lundi*

**La situation.** Même Wi-Fi menteur, on ouvre l'accueil du club ou « Les matchs » pour voir qui est là.

**Ce qu'on attend.** « Ce réseau demande une connexion » — la phrase du club, et un chemin (couper le Wi-Fi, ou ouvrir le portail).

**Où ça en est.** `appelAuthentifie` fait `return (await res.json()) as T` sur la page HTML du portail : ça lève « JSON Parse error: Unexpected character: < », que l'écran recopie tel quel dans `erreur`. Les trois situations « pas de réseau », « réseau qui ment » et « serveur en panne » produisent trois messages d'informaticien différents, et aucun ne dit quoi faire. Le drain, lui, croit être en ligne : `definirEnLigne` suit `isInternetReachable` (composants/Noyau.tsx:131), pas une vraie réponse de notre serveur.

> `five-scorer-mobile/lib/appel.ts:138-140 ; app/club/[id]/index.tsx:59-63`

### `COMPO-07` — ✗ absent · *gêne un lundi*

**La situation.** Deux téléphones lancent chacun « Nouveau match » pour la même soirée, à trente secondes d'écart.

**Ce qu'on attend.** Le second est prévenu qu'un match est déjà en cours et le rejoint plutôt que d'en créer un deuxième.

**Où ça en est.** Le commentaire de la route GET dit tout : « rien ne les réconcilie après coup ». L'app ne l'appelle jamais avant le coup d'envoi ; le site cache le bouton d'accueil si le serveur connaît un LIVE mais /matches/new reste atteignable. Résultat : deux tableaux pour un terrain, stats doublées.

> `five-scorer/app/api/clubs/[clubId]/matches/route.ts:10-16 (GET ?status=LIVE prévu pour ça) ; five-scorer-mobile/app/compo.tsx:226-255 ; five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:234-304 ; five-scorer/app/c/[slug]/page.tsx:768`

### `DIRECT-16` — ✗ absent · *gêne un lundi*

**La situation.** Un invité (hors club) arrive en retard, une fois le match lancé.

**Ce qu'on attend.** Le créer et le faire entrer depuis la feuille.

**Où ça en est.** La feuille ne propose que les joueurs du club absents du match. Aucun champ « invité » en cours de match, alors que la route serveur et l'opération addParticipant portent déjà un invité. Ses buts iront à quelqu'un d'autre ou nulle part.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:755-785 ; five-scorer-mobile/app/match/[id].tsx:568-614 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:140-158 (le serveur, lui, sait recevoir un invité en retard)`

### `DIRECT-24` — ✗ absent · *gêne un lundi*

**La situation.** Coup d'envoi. On veut vérifier qu'il y a un gardien de chaque côté — ou, en mode correction, envoyer quelqu'un en face sans se retrouver avec les deux gardiens du même bord.

**Ce qu'on attend.** Un gant sur la tuile, comme au vestiaire.

**Où ça en est.** `LivePlayer.isGk` existe (lib/match/local.ts:152), `getLocalMatch` le remplit depuis les participants (local.ts:883) — et aucune tuile ne l'affiche : la rangée montre l'avatar, le nom, les cartons et le nombre de buts, rien d'autre. Côté site, `PlayerTile` ne reçoit même pas le champ. L'effectif, lui, montre le gant (VEST-01) et l'écran de compo écrit « · gardien » (app/compo.tsx:401). DIRECT-14 promet de « remettre un gardien de chaque côté » à partir d'une information que la feuille ne donne nulle part.

> `five-scorer-mobile/app/match/[id].tsx:604-660 ; five-scorer/components/PlayerTile.tsx (tout le composant)`

### `DIRECT-25` — ✗ absent · *gêne un lundi*

**La situation.** 20 h 08 : le marqueur joue aussi. Il entre sur le terrain, la feuille ouverte, le téléphone dans la poche du short ou posé sur le banc à côté des sacs.

**Ce qu'on attend.** Rien ne se compte tout seul, et on retrouve la feuille exactement comme on l'a laissée.

**Où ça en est.** `useKeepAwake()` est posé sans condition : l'écran ne s'éteint jamais tant qu'on est sur la feuille. Et la feuille entière est un mur de boutons « but » — chaque rangée de 58 px compte un but au premier tap, sans confirmation, avec en prime « Contre son camp » et deux cartons. Aucun verrou, aucune mise en veille volontaire, aucun geste pour « ranger » la feuille le temps d'un match. Une cuisse, une fermeture éclair, un curieux qui prend le téléphone pour regarder le score — et le score bouge. C'est la conséquence directe et non traitée du choix d'empêcher l'écran de s'éteindre.

> `five-scorer-mobile/app/match/[id].tsx:166 (useKeepAwake) et 604-660 (les tuiles)`

### `DIRECT-33` — ✗ absent · *gêne un lundi*

**La situation.** 21 h, quatrième match sur huit. L'écran est allumé sans interruption depuis 19 h 55. Le téléphone est à 8 %, et personne n'a de batterie externe.

**Ce qu'on attend.** Finir la soirée : que l'écran puisse s'éteindre sans que le match s'arrête, et qu'on sache que le chrono continue de tourner.

**Où ça en est.** `useKeepAwake()` ne dépend ni d'un réglage, ni du niveau de batterie, ni du mode économie d'énergie. Or le chrono n'a AUCUN besoin de l'écran : il se dérive de deux colonnes (`clock_elapsed_ms`, `clock_running_since`) et survit déjà à la fermeture de l'app (db/schema.sql:98-104). Le seul moyen d'économiser la batterie aujourd'hui est de quitter la feuille — et le bouton de retour fait `router.replace("/clubs")`, donc on perd l'écran et il faut repasser par l'accueil du club, qui lui exige le réseau.

> `five-scorer-mobile/app/match/[id].tsx:166 ; lib/noyau/clock.ts:11-16`

### `SOIREE-70` — ✗ absent · *gêne un lundi*

**La situation.** 21 h 05, entre le match 3 et le match 4. « On en est à combien, ce soir ? » Pas de réseau au gymnase.

**Ce qu'on attend.** Les matchs de ce soir avec leurs scores, et le compte Blanc / Noir de la soirée — depuis le téléphone qui vient de les saisir.

**Où ça en est.** Les trois matchs sont dans la table `matches` du téléphone, avec leur score et leur statut FINISHED. Aucun écran ne les lit : l'accueil passe par `chargerAccueil`, l'onglet « Les matchs » par `chargerMatchs`, tous deux serveur sans repli local, et la couche locale n'expose que `getLocalMatch(id)` et `getLiveMatchOfClub(clubId)`. Hors réseau, l'app ne sait plus rien de la soirée qu'elle est en train d'enregistrer — pas même combien de matchs ont été joués.

> `five-scorer-mobile/app/club/[id]/index.tsx:51-65 et 84-92 ; app/club/[id]/matchs.tsx:53-58 ; lib/match/local.ts:903-927`

### `COMPO-01` — ◐ partiel · *gêne un lundi*

**La situation.** Lundi 19h55, le capitaine ouvre l'app pour composer. Les équipes ont été décidées jeudi sur WhatsApp et posées dans la compo de la soirée.

**Ce qu'on attend.** La feuille s'ouvre avec les deux équipes déjà faites ; il n'y a rien à taper, juste « Coup d'envoi ».

**Où ça en est.** Le site précharge la compo préparée (matchDay.lineup) et propose « Coup d'envoi » en un tap depuis l'accueil. L'app ignore la compo de la soirée : compo.tsx:137-139 met tous les abonnés dans l'équipe A et il faut retaper les quatorze joueurs un par un. Le paramètre soireeId (ligne 245) ne sert qu'à rattacher le match.

> `five-scorer/app/c/[slug]/matches/new/page.tsx:107-112 + NewMatchForm.tsx:121-125 ; five-scorer/app/c/[slug]/page.tsx:768-787 ; five-scorer-mobile/app/compo.tsx:135-139`

### `DIRECT-05` — ◐ partiel · *gêne un lundi*

**La situation.** On a tapé sur la mauvaise tuile. Appui long sur le joueur pour retirer son dernier but.

**Ce qu'on attend.** Son dernier but disparaît, le score redescend, un son et une vibration franche le disent ; si le joueur n'a rien marqué, on le sent.

**Où ça en est.** Les deux annulent le DERNIER but de ce joueur seulement (jamais ses cartons ni un csc). Le site donne un retour « rien à annuler » quand le joueur n'a pas de but (PlayerTile.tsx:72-77) ; l'app ne fait rien en silence (match/[id].tsx:313).

> `five-scorer/components/PlayerTile.tsx:53-102 ; five-scorer/lib/localMatch.ts:596-609 ; five-scorer-mobile/app/match/[id].tsx:309-319,624-625 ; five-scorer-mobile/lib/match/local.ts:799-807`

### `DIRECT-18` — ◐ partiel · *gêne un lundi*

**La situation.** On regarde le jeu ; le téléphone reste dans la main sans être touché pendant deux minutes.

**Ce qu'on attend.** L'écran ne s'éteint pas pendant la feuille.

**Où ça en est.** L'app tient l'écran allumé. Le site s'éteint au réglage du téléphone, et il faut le réveiller pour compter un but — le commentaire de l'app le dit textuellement.

> `five-scorer-mobile/app/match/[id].tsx:162-166 (useKeepAwake) ; site : aucun Wake Lock (aucune occurrence de wakeLock dans app/, lib/, components/)`

### `DIRECT-20` — ◐ partiel · *gêne un lundi*

**La situation.** Un match a été lancé et jamais terminé (le précédent, ou celui de la semaine dernière) ; on en lance un nouveau.

**Ce qu'on attend.** Soit on est arrêté (« termine d'abord l'autre »), soit l'ancien ne traîne pas comme « en cours » pour toujours.

**Où ça en est.** L'accueil de l'app remplace « Nouveau match » par « Reprendre le match » tant qu'un LIVE est en local, mais la compo reste atteignable par le rappel (ligne 145) et le calendrier. Sur le site, /matches/new est toujours ouvert. Deux LIVE locaux : la coquille prend le plus récent ; l'ancien reste « Match en cours sur ce téléphone » indéfiniment et ses buts restent hors des stats.

> `five-scorer/app/c/[slug]/page.tsx:705,768 ; five-scorer/components/ReprendreLocal.tsx:19-22 ; five-scorer/lib/localMatch.ts:96-106 ; five-scorer-mobile/app/club/[id]/index.tsx:163-173`

### `DIRECT-27` — ◐ partiel · *gêne un lundi*

**La situation.** Lundi de rentrée, dix-huit joueurs : neuf tuiles par colonne. Karim marque, c'est le neuvième nom de la colonne des Blancs.

**Ce qu'on attend.** Tout le monde sous le pouce, sans faire défiler pendant que le jeu continue.

**Où ça en est.** Rangée de joueur : 58 px. Sous elles, dans la même carte, « Contre son camp » (46) et la ligne des cartons (44). Au-dessus, un score de 132 px (lineHeight 138), la ligne des écussons et la barre du haut. Sur un iPhone courant il reste de l'ordre de 420 px de colonne visible : six rangées. Dès sept joueurs par équipe — le cas NORMAL du club, qui joue à 10-18 — les derniers passent sous le pli, et compter leur but demande un défilement puis un tap. Aucun mode compact, aucune réduction du bloc score quand la liste s'allonge, et la bande « Passe décisive ? » retire encore une rangée et demie pendant quinze secondes (cf. DIRECT-26).

> `five-scorer-mobile/app/match/[id].tsx:567 et styles 1113, 1128, 1134, 1139`

### `DIRECT-29` — ◐ partiel · *gêne un lundi*

**La situation.** On siffle la mi-temps, tout le monde boit, on repart. Personne ne retape « Reprendre ».

**Ce qu'on attend.** Le temps de jeu de la seconde période se compte quand même — ou l'écran le réclame très fort, pas d'un mot gris.

**Où ça en est.** `siffletMiTemps` fige le chrono (`figerChrono`, local.ts:727) et RIEN ne le repart : ni le premier but de la seconde période (`marquer` ne touche pas l'horloge), ni un délai, ni l'entrée d'un joueur. L'écran affiche « Pause » en blanc avec un point gris — exactement ce qu'il affiche pour une pause de dix secondes. Deux conséquences en cascade : le double coup de sifflet du temps réglementaire (DIRECT-13, app/match/[id].tsx:170-185) ne part jamais, et la durée enregistrée à la fin ne vaut que la première période.

> `five-scorer-mobile/app/match/[id].tsx:421-426, 416-420, 270-283 ; lib/match/local.ts:721-766`

### `DIRECT-31` — ◐ partiel · *gêne un lundi*

**La situation.** Le doigt manque la dernière tuile de la colonne et tombe deux centimètres plus bas.

**Ce qu'on attend.** Qu'un centimètre ne crédite pas un but à l'équipe d'en face.

**Où ça en est.** La bande « Contre son camp » (46 px) est le voisin immédiat de la dernière rangée de joueur (58 px), dans la même carte, séparée par un filet d'un pixel et sans autre différence que la taille du texte. Un tap y crédite l'équipe d'en face ET ouvre l'invite « Qui l'a mis ? ». Le geste de rattrapage habituel — l'appui long sur la tuile — ne sert à rien ici : le csc n'a pas de buteur, il faut passer par « Annuler » ou par la chronologie. Aucune confirmation, aucune distance de sécurité, alors que c'est le seul bouton de la feuille qui fait monter le score du camp opposé.

> `five-scorer-mobile/app/match/[id].tsx:672-682 et style `csc` en 1134`

### `DROIT-01` — ◐ partiel · *gêne un lundi*

**La situation.** Un membre à qui le club n'a pas ouvert la saisie ouvre la feuille ou tape un but.

**Ce qu'on attend.** Un refus explicite, pas un écran qui ne réagit pas.

**Où ça en est.** Le site redirige avant d'afficher la feuille. L'app cache les boutons mais la feuille et la compo restent atteignables par d'autres chemins ; la saisie part alors en file et revient « 403 — forbidden » (message brut du serveur) en bloquant la chaîne, sans phrase en français.

> `five-scorer/app/c/[slug]/play/page.tsx:19 ; five-scorer/app/c/[slug]/matches/[id]/live/page.tsx:13 ; five-scorer/lib/guard.ts:66 ; five-scorer-mobile/app/club/[id]/index.tsx:163 ; five-scorer/app/api/clubs/[clubId]/matches/route.ts:129-131`

### `FIN-01` — ◐ partiel · *gêne un lundi*

**La situation.** Coup de sifflet final : on tape « Terminer », on confirme, on élit l'homme du match si c'est le marqueur qui tranche, et on enchaîne le match suivant avec les mêmes équipes.

**Ce qu'on attend.** Un écran « Temps plein », un récap immédiat même sans réseau, et « On rejoue — mêmes équipes » en un tap : c'est le geste qu'on fait quatre à huit fois par soirée.

**Où ça en est.** Le site fait tout ça (slate, récap local, rejouer). L'app termine et renvoie à la liste des clubs (ligne 446) : pas de récap, pas de « on rejoue ». Pour le match suivant il faut refaire toute la compo (COMPO-01) — le coût du premier match payé huit fois.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:496-520,1013-1032 ; five-scorer/components/PlayShell.tsx:112-145,295-310 ; five-scorer-mobile/app/match/[id].tsx:428-447`

### `FIN-04` — ◐ partiel · *gêne un lundi*

**La situation.** Match terminé sans réseau ; on veut voir le récap complet (stats, chronologie, feuille).

**Ce qu'on attend.** Un récap local tout de suite ; le récap serveur seulement quand tout est parti — et on nous le dit.

**Où ça en est.** Le site propose le récap serveur seulement quand pendingOpsForMatch vaut 0, sinon « Le récap complet arrive dès que tout est envoyé ». L'app n'a pas de récap local : le récap lit le serveur, et pour un match pas encore parti c'est une erreur « introuvable ».

> `five-scorer/components/PlayShell.tsx:178-333 (RecapLocal, « N à envoyer », lien conditionnel) ; five-scorer-mobile/app/recap/[id].tsx:38-52`

### `FIN-05` — ◐ partiel · *gêne un lundi*

**La situation.** Le club élit l'homme du match par vote (mode VOTE). Dans le vestiaire, chacun vote sur son téléphone.

**Ce qu'on attend.** Voter depuis le récap, changer d'avis, voir le décompte.

**Où ça en est.** Le site vote (match terminé, joueur ayant joué, une voix déplaçable, résultat vivant). L'app affiche le résultat et les voix, l'API mobile rend même « mon vote », mais il n'y a ni bouton ni route pour voter depuis l'app.

> `five-scorer/components/MotmVotePanel.tsx ; five-scorer/app/actions/motm.ts ; five-scorer-mobile/app/recap/[id].tsx:259-283 ; five-scorer/app/api/clubs/[clubId]/matchs/[matchId]/route.ts:234-238`

### `HL-07` — ◐ partiel · *gêne un lundi*

**La situation.** La session expire pendant la soirée (401).

**Ce qu'on attend.** La file s'arrête sans rien perdre, on est invité à se reconnecter, et après reconnexion tout part.

**Où ça en est.** Les deux s'arrêtent et le disent. Sur le site, la file survit à la déconnexion (Dexie reste) et le tap sur la pastille relance. Sur l'app, « Reconnecte-toi » n'est pas tapable ; le chemin visible est « Se déconnecter » dans le menu, qui prévient puis PURGE la base — file comprise. Se reconnecter sans se déconnecter garde la file, mais rien ne le dit.

> `five-scorer/lib/sync.ts:288-303 ; five-scorer/components/SyncBadge.tsx:36-37,54 ; five-scorer/components/UserMenu.tsx:74 ; five-scorer-mobile/lib/outbox/sync.ts:315-326 ; five-scorer-mobile/app/match/[id].tsx:1044-1045 ; five-scorer-mobile/composants/MenuClub.tsx:67-88`

### `COMPO-03` — ✔ fait · *gêne un lundi*

**La situation.** Un copain d'un joueur vient jouer ce soir, il n'est pas dans le club. Pas de réseau au gymnase.

**Ce qu'on attend.** On tape son prénom, il apparaît dans une équipe, ses buts comptent, et le serveur le connaît dès que le réseau revient.

**Où ça en est.** L'invité est créé localement avec un identifiant client, voyage dans le payload de création (guests) et le serveur le crée avant la compo. Niveau 3 par défaut, pas gardien. Un invité tapé puis laissé hors des équipes reste un fantôme dans le cache local (jamais envoyé) et réapparaît dans l'effectif hors-ligne.

> `five-scorer/lib/localMatch.ts:53-69,178-201 ; five-scorer-mobile/lib/match/local.ts:216-234,303-312 ; five-scorer/app/api/clubs/[clubId]/matches/route.ts:181-192`

### `COMPO-05` — ✔ fait · *gêne un lundi*

**La situation.** On tape « Coup d'envoi » avec une équipe vide, ou sans personne.

**Ce qu'on attend.** Refus clair, sans créer de match.

**Où ça en est.** Message « Il faut au moins un joueur dans chaque équipe » et bouton désactivé. Le serveur ne refuse que zéro joueur en tout (« Aucun joueur ») : une équipe B vide sur un match interne passerait par l'API — c'est l'écran qui tient la règle.

> `five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:236-243 ; five-scorer-mobile/app/compo.tsx:228-230,466 ; five-scorer/app/api/clubs/[clubId]/matches/route.ts:138-140`

### `DIRECT-02` — ✔ fait · *gêne un lundi*

**La situation.** Le chrono : il démarre au coup d'envoi, on le met en pause pendant une discussion, on ferme l'app, on la rouvre.

**Ce qu'on attend.** Le temps de jeu affiché est le bon, pauses exclues, et il survit à la fermeture.

**Où ça en est.** L'état vit dans deux colonnes (temps figé, instant du dernier départ) ; rien ne tourne en base. Si le chrono tourne quand le téléphone meurt, il continue de compter le temps réel pendant que le téléphone est éteint — c'est un choix, pas un bug, mais personne ne l'a tranché.

> `five-scorer/lib/clock.ts ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:146-240 ; five-scorer-mobile/lib/match/local.ts:669-707 ; five-scorer-mobile/app/match/[id].tsx:195-210`

### `DIRECT-06` — ✔ fait · *gêne un lundi*

**La situation.** On annule le dernier événement quel qu'il soit (bouton « Annuler »), ou un événement précis depuis la chronologie — y compris la mi-temps sifflée par erreur.

**Ce qu'on attend.** L'événement disparaît, le score suit, une mi-temps annulée ramène en première période.

**Où ça en est.** Sur l'app, la remise en première période est tenue par la couche locale (les deux chemins en héritent) ; sur le site, chaque bouton la refait à la main. Le score ne descend jamais sous zéro.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:525-540,954-968 ; five-scorer-mobile/app/match/[id].tsx:325-338,952-959 ; five-scorer-mobile/lib/match/local.ts:474-509`

### `DIRECT-10` — ✔ fait · *gêne un lundi*

**La situation.** Contre son camp. Sur le terrain, dix secondes de débat sur qui l'a mis.

**Ce qu'on attend.** Le but est compté au bon camp immédiatement ; l'auteur se désigne après, parmi ceux qui l'ont concédé, ou pas du tout.

**Où ça en est.** Écart mineur : sur une feuille rétro l'app ne demande pas l'auteur du csc (match/[id].tsx:304), le site oui (LiveMatch.tsx:410).

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:391-417 ; five-scorer-mobile/app/match/[id].tsx:290-307 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:193-201`

### `DIRECT-12` — ✔ fait · *gêne un lundi*

**La situation.** On siffle la mi-temps, puis on reprend.

**Ce qu'on attend.** Le chrono se fige, la feuille passe en 2de, la mi-temps apparaît dans la chronologie, et on ne peut pas siffler deux fois.

**Où ça en est.** Sur l'app, chrono figé + période + événement tombent dans une seule transaction (testé). Sur le site, le chrono est figé puis l'événement ajouté en deux écritures : si la seconde échoue, la feuille est en 2de sans mi-temps dans la chronologie.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:242-258,682-690 ; five-scorer-mobile/lib/match/local.ts:721-766 ; five-scorer-mobile/app/match/[id].tsx:421-426,511-515`

### `DIRECT-14` — ✔ fait · *gêne un lundi*

**La situation.** Au coup d'envoi on voit que deux copains sont du même côté, ou qu'un camp n'a pas de gardien. Un joueur doit changer de camp.

**Ce qu'on attend.** Un mode « corriger la composition » où un tap envoie un joueur en face, sans risque de compter un but, sans jamais vider un camp ; les buts déjà marqués restent au camp où ils l'ont été.

**Où ça en est.** Le garde « au moins un joueur de chaque côté » est tenu localement et affiché ; le serveur ne l'a pas. Tant qu'aucun événement n'est saisi, la correction corrige aussi l'équipe de départ (celle des stats) ; après, elle ne change que l'équipe affichée.

> `five-scorer/lib/localMatch.ts:476-526 ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:443-459,738-753 ; five-scorer-mobile/lib/match/local.ts:571-610 ; five-scorer-mobile/app/match/[id].tsx:366-383,539-561 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:16-87`

### `DIRECT-15` — ✔ fait · *gêne un lundi*

**La situation.** Un joueur du club arrive à la 10e minute. Il n'est sur aucune feuille.

**Ce qu'on attend.** Le faire entrer dans une équipe depuis la feuille, et compter ses buts.

**Où ça en est.** La liste vient du cache local de l'effectif. Sur l'app, si ce cache est vide, l'entrée « + Faire entrer un joueur » n'apparaît pas du tout (vivier.length > 0, ligne 570) — sans un mot. Il entre comme joueur de champ.

> `five-scorer/lib/localMatch.ts:528-593 ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:461-476,755-785 ; five-scorer-mobile/lib/match/local.ts:612-667 ; five-scorer-mobile/app/match/[id].tsx:385-400,568-614`

### `DIRECT-19` — ✔ fait · *gêne un lundi*

**La situation.** Entre deux matchs, on quitte la feuille pour regarder le classement, puis on veut y revenir.

**Ce qu'on attend.** Le match continue, et on le retrouve depuis l'accueil en un tap.

**Où ça en est.** Les deux retrouvent le match LIVE le plus récent de la base locale. L'app interdit le balayage arrière sur la feuille (un pouce qui glisse partait au milieu du match).

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:636-645 ; five-scorer/components/ReprendreLocal.tsx ; five-scorer/components/PlayShell.tsx:91-110 ; five-scorer-mobile/app/match/[id].tsx:470-475 ; five-scorer-mobile/app/club/[id]/index.tsx:73-79,163-173 ; five-scorer-mobile/app/_layout.tsx:22-27`

### `HL-08` — ✔ fait · *gêne un lundi*

**La situation.** On se déconnecte (téléphone prêté) alors que la soirée n'est pas partie.

**Ce qu'on attend.** Être prévenu avant de perdre deux heures de saisie.

**Où ça en est.** L'app compte ce qui reste (en attente + refusées) et demande confirmation avant de purger. Le site ne purge que le cache du service worker et garde la file — sur un téléphone prêté, la personne suivante rejouera la file sous SA session (refus 403 si elle n'est pas du club).

> `five-scorer-mobile/composants/MenuClub.tsx:56-88 ; five-scorer/components/UserMenu.tsx:70-80`

### `HL-10` — ✔ fait · *gêne un lundi*

**La situation.** L'horloge du téléphone recule (correction automatique, changement de fuseau) en pleine soirée.

**Ce qu'on attend.** La file part quand même dans le bon ordre ; le « terminer » ne double pas des buts encore en file.

**Où ça en est.** L'ordre est pris sur la clé auto-incrémentée, jamais sur l'horodatage (bug vécu, documenté, testé). Les minutes des buts, elles, restent calculées sur l'horloge murale et bougeraient.

> `five-scorer/lib/sync.ts:256-267 ; five-scorer-mobile/lib/outbox/outbox.ts:7-13,66-71 ; five-scorer-mobile/db/schema.sql:9-14,153-155`

### `HL-11` — ✔ fait · *gêne un lundi*

**La situation.** Au bord du terrain, une seule question : « est-ce que ce que je viens de taper est parti ? »

**Ce qu'on attend.** Une pastille qui distingue hors ligne / à envoyer / refusé / à jour, sans jamais dire « OK » sur une file pleine de refus.

**Où ça en est.** Les refusées passent avant tout le reste, en rouge. Sur l'app, elle ne réagit pas au tap (HL-06).

> `five-scorer/components/SyncBadge.tsx:22-46 ; five-scorer/lib/sync.ts:55-64 ; five-scorer-mobile/app/match/[id].tsx:1038-1062 ; five-scorer-mobile/lib/outbox/outbox.ts:127-138`

### `RETRO-07` — ⚠ faux · *gêne une saison*

**La situation.** En septembre, on rattrape la dernière soirée de juin (saison précédente, close).

**Ce qu'on attend.** Le match compte dans la saison de juin, pas dans celle qui vient de commencer.

**Où ça en est.** La saison n'est jamais déduite de la date : le site envoie la saison active, l'app n'en envoie pas et le serveur prend la saison active. Le match de juin atterrit dans le classement de septembre.

> `five-scorer/app/api/clubs/[clubId]/matches/route.ts:154-176 ; five-scorer/app/c/[slug]/matches/new/page.tsx:103 ; five-scorer-mobile/app/compo.tsx:234-246 (aucun seasonId)`

### `APRES-53` — ✗ absent · *gêne une saison*

**La situation.** 22 h 05, vestiaire d'Urban Soccer, pas de réseau. Le club est en mode vote ; chacun sort son téléphone pour l'homme du match, c'est le moment où tout le monde est encore là.

**Ce qu'on attend.** Ma voix part quand le réseau revient, comme un but.

**Où ça en est.** La file connaît huit sortes d'opérations (createMatch, addEvent, removeEvent, setAssist, setScorer, addParticipant, movePlayer, finishMatch) — aucune pour un vote. Et le récap de l'app reçoit déjà `vote: { monVote, candidats }` du serveur sans jamais l'afficher : il ne montre que le décompte sous le nom du lauréat. Sur le téléphone, on ne vote donc ni en ligne ni hors ligne ; le seul écran qui vote est celui du site (components/MotmVotePanel.tsx), qui exige le réseau. Toute l'app est faite pour le gymnase sauf la seule chose qu'on y fait après le dernier match.

> `five-scorer-mobile/lib/outbox/types.ts:97-177 ; app/recap/[id].tsx:259-282 ; lib/api.ts:456-459`

### `COMPO-04` — ✗ absent · *gêne une saison*

**La situation.** Le gardien attitré est absent ; un joueur de champ prend les gants ce soir. On veut que l'équilibrage et les stats de gardien le sachent.

**Ce qu'on attend.** Sur la compo, désigner qui est gardien ce soir, indépendamment de sa fiche.

**Où ça en est.** Les deux écrans de compo recopient le drapeau permanent isGk de la fiche joueur ; aucun bouton « gardien ce soir ». Seul « On rejoue » (RematchButton.tsx:19) distingue gardienCeMatch. Le commentaire de local.ts renvoie la décision à « la compo de la soirée » — c'est-à-dire au calendrier, que l'app ne lit pas (COMPO-01).

> `five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:272-275 ; five-scorer-mobile/app/compo.tsx:239-240 ; five-scorer-mobile/lib/match/local.ts:630-631 (commentaire)`

### `DIRECT-17` — ✗ absent · *gêne une saison*

**La situation.** Un joueur se blesse à la 3e minute et rentre chez lui, ou finalement n'est pas venu alors qu'il était sur la feuille.

**Ce qu'on attend.** Le retirer de la feuille pour qu'il ne compte pas un match joué, une défaite, une variation d'Élo.

**Où ça en est.** Une fois inscrit, un joueur reste sur la feuille. Les stats (lib/stats.ts, participants) lui comptent une apparition et le résultat du camp de départ.

> `aucun (ni opération removeParticipant dans lib/db.ts:81-167 / lib/outbox/types.ts, ni route DELETE dans lineup/route.ts)`

### `COMPO-08` — ◐ partiel · *gêne une saison*

**La situation.** Un match a été programmé sur le site (convocation). Le lundi, on le lance depuis l'app.

**Ce qu'on attend.** Le match programmé passe en direct, avec son identifiant ; il n'en reste pas un fantôme « programmé ».

**Où ça en est.** Le site sait lancer un match programmé (SCHEDULED → LIVE, même id). L'app porte la fonction dans sa couche locale mais aucun écran ne l'appelle : la compo crée toujours un nouveau match, et le programmé reste programmé.

> `five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:277-288 ; five-scorer-mobile/lib/match/local.ts:337-399 (launchScheduledMatch, jamais appelé) ; five-scorer-mobile/app/compo.tsx:234-246`

### `CONFLIT-01` — ◐ partiel · *gêne une saison*

**La situation.** Un membre termine le match sur son téléphone pendant qu'un autre membre a encore trois buts en file sur le sien.

**Ce qu'on attend.** Les trois buts arrivent quand même, ou quelqu'un peut les faire passer.

**Où ça en est.** Les trois buts reçoivent « Admin requis pour modifier un match terminé », la chaîne est bloquée et conservée. Un admin pourrait les faire passer — mais ils sont sur le téléphone du membre, et rien ne les lui transmet. L'écran du second téléphone dit toujours « En direct ».

> `five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:67-73 ; five-scorer/lib/sync.ts:304-338 ; five-scorer-mobile/lib/outbox/sync.ts:328-344`

### `DATA-01` — ◐ partiel · *gêne une saison*

**La situation.** Aucune saison active dans le club (début septembre, la saison n'a pas été créée).

**Ce qu'on attend.** Être prévenu que ce match ne comptera dans aucune saison.

**Où ça en est.** Le match est créé avec seasonId nul sans un mot, et manque à toutes les vues saisonnières.

> `five-scorer/app/api/clubs/[clubId]/matches/route.ts:167-176 ; five-scorer/app/c/[slug]/matches/new/page.tsx:40-44,103`

### `FIN-07` — ◐ partiel · *gêne une saison*

**La situation.** Quelqu'un vote pour l'homme du match d'une soirée d'il y a six mois, saison close.

**Ce qu'on attend.** Le vote est fermé, ou au moins le club sait qu'un palmarès a bougé.

**Où ça en est.** La seule condition est « match terminé ». Aucune fenêtre, aucune saison close : le mvpId d'un match de janvier peut changer en juin.

> `five-scorer/app/actions/motm.ts:27-34`

### `HL-06` — ◐ partiel · *gêne une saison*

**La situation.** Le serveur refuse une opération pour de bon — droits retirés en cours de soirée, ou but envoyé après qu'un autre téléphone a terminé le match.

**Ce qu'on attend.** Rien n'est jeté, on voit combien d'actions sont refusées, et il y a une issue.

**Où ça en est.** Les deux bloquent toute la chaîne du match sans rien supprimer et l'affichent (« N actions refusées » / « N refusée(s) »). Le site offre un tap pour réessayer une fois les droits rétablis. L'app n'a aucune issue : la fonction existe, aucun écran ne l'appelle. Et pour un refus « match terminé » reçu par un simple membre, réessayer échoue à l'infini : personne ne peut passer la main à un admin.

> `five-scorer/lib/sync.ts:304-338 ; five-scorer/components/SyncBadge.tsx:36-56 ; five-scorer-mobile/lib/outbox/sync.ts:328-344,391-397 (rejouerBloquees, jamais appelé) ; five-scorer-mobile/app/match/[id].tsx:1038-1062 (Pastille non tapable)`

### `RETRO-03` — ◐ partiel · *gêne une saison*

**La situation.** On a rangé le téléphone sans terminer le match. Le lendemain, la semaine d'après, six mois plus tard.

**Ce qu'on attend.** Être rappelé qu'une feuille est restée ouverte, pouvoir la terminer, et que ses buts comptent enfin.

**Où ça en est.** Le site rappelle les feuilles ouvertes que le serveur connaît, et celles restées en local. L'app ne rappelle que le LIVE local (« Reprendre le match ») : une feuille ouverte sur un autre téléphone ou depuis le site n'est signalée nulle part. Tant qu'elle est LIVE, ses buts sont hors des stats (lib/stats.ts:52).

> `five-scorer/app/c/[slug]/page.tsx:707-729 (« Feuille restée ouverte ») ; five-scorer/components/ReprendreLocal.tsx ; five-scorer-mobile/app/club/[id]/index.tsx:163-173`

### `RETRO-04` — ◐ partiel · *gêne une saison*

**La situation.** On rattrape une soirée de quatre matchs : après le premier, on saisit le suivant.

**Ce qu'on attend.** « Saisir le match suivant » : mêmes équipes, même soirée, une demi-heure plus tard.

**Où ça en est.** Le site enchaîne feuille après feuille dans la bonne soirée. L'app renvoie à l'accueil ; la compo repart de zéro, la date par défaut est « hier 20h » et la soirée n'est rattachée que si on repasse par le calendrier.

> `five-scorer/app/c/[slug]/matches/[id]/page.tsx:52-61,313-330 ; five-scorer-mobile : aucun (FIN-01)`

### `RETRO-05` — ◐ partiel · *gêne une saison*

**La situation.** Comme le 7 septembre : la soirée entière est saisie comme UN match cumulé, Blanc 18 – Noir 9.

**Ce qu'on attend.** Le club doit savoir ce que ça vaut dans les stats (un seul match joué, une seule victoire), ou être invité à découper.

**Où ça en est.** Accepté sans un mot. Les stats comptent une apparition, une victoire/défaite et un Élo par joueur pour toute la soirée, comme pour un match de dix minutes. Rien n'explique la différence.

> `five-scorer/lib/stats.ts:48-100 ; aucune alerte ni côté site ni côté app`

### `RETRO-01` — ✔ fait · *gêne une saison*

**La situation.** Le téléphone est resté dans le sac lundi. Mardi, on saisit la soirée d'après WhatsApp.

**Ce qu'on attend.** « Déjà joué » + la date, une feuille sans chrono, on tape les buts, « Enregistrer » ; le match se range sous le bon lundi.

**Où ça en est.** Pas de minute sur les buts, pas de passe décisive demandée (la barre bloquerait « Enregistrer » sur vingt-sept buts d'affilée), bouton « Enregistrer ». Le calendrier de la saison envoie la soirée à rattraper avec sa date.

> `five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:141-153,248-263,334-373 ; five-scorer/lib/retro.ts ; five-scorer-mobile/app/compo.tsx:58-96,283-331 ; five-scorer-mobile/app/match/[id].tsx:147,495-521,751-766`

### `DIRECT-04` — ⚠ faux · *confort*

**La situation.** Un but marqué à la 12e minute de jeu, après cinq minutes de pause à la mi-temps.

**Ce qu'on attend.** La chronologie et le récap disent 12′.

**Où ça en est.** Le site tamponne avec le chrono (pauses exclues). L'app n'envoie pas de minute : la couche locale calcule alors « maintenant − coup d'envoi » en temps mural, pauses et mi-temps comprises. Le même but est à 12′ sur le site et à 17′ sur l'app, et c'est la valeur de l'app qui part au serveur. La mi-temps, elle, est bien tamponnée au chrono (local.ts:736) — les deux minutes d'une même feuille ne sont pas sur la même échelle.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:164-167,312 ; five-scorer-mobile/app/match/[id].tsx:276-280 ; five-scorer-mobile/lib/match/local.ts:424-430`

### `FIN-02` — ⚠ faux · *confort*

**La situation.** Le match a duré 14 minutes. Le récap devrait le dire.

**Ce qu'on attend.** La durée réelle est enregistrée avec le match.

**Où ça en est.** Le site appelle finishMatch(matchId, mvpId) sans durée : durationMin part toujours à null depuis le site. L'app envoie la durée du chrono. Le récap de l'app affiche « · N min » quand il existe — donc seulement pour les matchs terminés depuis l'app.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:501 ; five-scorer/lib/localMatch.ts:611-628 ; five-scorer-mobile/app/match/[id].tsx:444 ; five-scorer-mobile/app/recap/[id].tsx:108-111`

### `FIN-08` — ⚠ faux · *confort*

**La situation.** Coup de sifflet à 12:30. On tape « Terminer », on confirme, puis on discute une minute et demie pour désigner l'homme du match.

**Ce qu'on attend.** Le match a duré 12 minutes.

**Où ça en est.** `terminer` calcule `Math.round(ecoule / 60_000)` au moment du DERNIER tap, et rien n'a arrêté le chrono entre-temps : ni la confirmation, ni la feuille du MVP. Toute la cérémonie de fin de match s'ajoute à la durée. Pire, `majFinDeMatch` écrit `status = 'FINISHED'` sans toucher `clock_running_since` : la ligne locale garde une horloge qui court après la fin du match. Le serveur, lui, enregistre fidèlement ce qu'on lui envoie (app/api/clubs/[clubId]/matches/[matchId]/route.ts:190).

> `five-scorer-mobile/app/match/[id].tsx:442-447 ; lib/match/local.ts:809-825 ; lib/match/tables.ts:336-345`

### `DIRECT-07` — ✗ absent · *confort*

**La situation.** On a annulé le mauvais but. On veut le rétablir tel qu'il était (même minute, même passeur).

**Ce qu'on attend.** Un « rétablir », ou au moins la possibilité de remettre le but à sa minute.

**Où ça en est.** removeEvent supprime l'événement ; aucune opération inverse. Il faut retaper le but, qui prend la minute de maintenant et perd sa passe décisive.

> `aucun`

### `DIRECT-09` — ✗ absent · *confort*

**La situation.** Les quinze secondes sont passées, et on se souvient que c'était une passe de Mehdi.

**Ce qu'on attend.** Attacher la passe à un but déjà saisi, depuis la chronologie.

**Où ça en est.** La mécanique existe et est idempotente côté serveur, mais aucun écran ne la propose hors de l'invite éphémère.

> `five-scorer/lib/localMatch.ts:417-440 (setEventAssist existe) ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:936-970 (la chronologie n'offre que « Annuler ») ; five-scorer-mobile/app/match/[id].tsx:922-961`

### `DIRECT-08` — ◐ partiel · *confort*

**La situation.** L'invite « Passe décisive ? » est encore ouverte quand quelqu'un annule le but depuis la chronologie, puis on tape un nom.

**Ce qu'on attend.** On est prévenu que le but n'existe plus et que le nom n'a pas été pris.

**Où ça en est.** La couche locale rend faux dans ce cas des deux côtés. Le site l'affiche (« Ce but n'existe plus — rien n'a été enregistré », ligne 434) ; l'app ignore la valeur de retour (ligne 406-408) et referme l'invite comme si le nom avait été pris.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:420-441 ; five-scorer-mobile/app/match/[id].tsx:402-414 ; five-scorer-mobile/lib/match/local.ts:513-535`

### `DIRECT-21` — ◐ partiel · *confort*

**La situation.** Un match contre une autre équipe (adversaire extérieur), rare pour ce club.

**Ce qu'on attend.** Une colonne « nous » avec les tuiles, un « +1 but adversaire » en face.

**Où ça en est.** Le site le fait. L'app ne propose pas le mode et sa feuille n'a pas de bouton « but adverse » — un match extérieur lancé depuis le site s'ouvrirait sur l'app avec une colonne B vide.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:823-835 ; five-scorer-mobile/app/compo.tsx:39-44 (écart assumé) ; five-scorer-mobile/app/match/[id].tsx:253-256`

### `DIRECT-30` — ◐ partiel · *confort*

**La situation.** Le pouce accroche « 1re · mi-temps › », juste sous le chrono. On annule tout de suite depuis la chronologie.

**Ce qu'on attend.** On revient exactement où on était : première période, et le chrono qui tourne comme avant.

**Où ça en est.** `removeEvent` remet bien la période à 1 — c'est écrit et commenté — mais l'horloge reste figée telle que `siffletMiTemps` l'a laissée : rien ne rejoue `relancerChrono`. La feuille repart donc en première période avec le chrono à l'arrêt, sans autre signal que le mot « Pause ». Le geste qui a tout déclenché est un texte de 13 px avec 8 px de marge de touche, collé sous le chrono (app/match/[id].tsx:504-511).

> `five-scorer-mobile/lib/match/local.ts:491-499 ; app/match/[id].tsx:318-329`

### `HL-09` — ◐ partiel · *confort*

**La situation.** Les réglages du club n'ont jamais été mis en cache (app fraîchement installée, ouverte directement hors-ligne sur un match reçu autrement).

**Ce qu'on attend.** La feuille marche avec les réglages du club, ou dit ce qui manque.

**Où ça en est.** Sans club en cache, l'app dégrade en silence : couleurs par défaut, pas de passes décisives, pas de cartons, pas de sifflet de fin, et le MVP n'est jamais demandé (motmMode inconnu ≠ ADMIN). Le site a toujours les réglages rendus dans la page en cache.

> `five-scorer-mobile/app/match/[id].tsx:142-145,249-251,285,434,686 ; five-scorer/components/PlayShell.tsx:71-89`

### `RETRO-08` — ◐ partiel · *confort*

**La situation.** Une feuille ouverte à 19h55 est encore ouverte à 2h du matin (plus de six heures).

**Ce qu'on attend.** Rien ne change sous les doigts du marqueur.

**Où ça en est.** estRetro est recalculé à chaque rendu : au franchissement, le chrono disparaît, l'état passe à « Saisie », « Terminer » devient « Enregistrer », les minutes deviennent nulles. Improbable un lundi, mais c'est le même seuil que RETRO-02.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:163,574 ; five-scorer-mobile/app/match/[id].tsx:147`

### `SON-01` — ◐ partiel · *confort*

**La situation.** Le téléphone est en silencieux, ou quelqu'un met de la musique à l'échauffement.

**Ce qu'on attend.** Le but s'entend quand même (c'est le seul retour quand on regarde le jeu), sans couper la musique ; et on peut couper le son.

**Où ça en est.** L'app joue en silencieux et se mêle à la musique. Sur le site, l'audio web doit être « déverrouillé » par un premier tap sur une tuile (un csc tapé en premier peut être muet) et le silencieux d'iPhone coupe tout. Le bouton Son/Muet est au même endroit des deux côtés.

> `five-scorer-mobile/lib/son/son.ts:60-73,92-102 ; five-scorer/lib/audio.ts:47-59,100-141 ; five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:924-927`

### `SON-02` — ◐ partiel · *confort*

**La situation.** Le retour haptique : un but, un carton, une annulation.

**Ce qu'on attend.** Trois nuances qu'on distingue sans regarder.

**Où ça en est.** L'app utilise le Taptic Engine avec trois retours distincts (jamais sentis par une main, dit le commentaire). Le site appelle navigator.vibrate, ignoré par Safari iOS.

> `five-scorer-mobile/lib/vibrer.ts ; five-scorer/components/PlayerTile.tsx:69,74,90`

### `SON-03` — ◐ partiel · *confort*

**La situation.** Téléphone en silencieux, comme tous les lundis. Tout premier but du premier match de la soirée.

**Ce qu'on attend.** On l'entend, celui-là comme les vingt-six autres — c'est le seul retour quand on regarde le jeu.

**Où ça en est.** `reglerMode()` n'est appelé que depuis `jouer()`, donc au premier but, et il pose `setAudioModeAsync({ playsInSilentMode: true, … })` sans l'attendre (`void`), juste avant `p.play()`. Le réglage qui décide si le son sort d'un téléphone en silencieux court après le son qu'il est censé autoriser ; le lecteur lui-même est créé à la même milliseconde (`createAudioPlayer`). Rien ne pose le mode audio ni ne préchauffe les lecteurs à l'ouverture de la feuille, où il y aurait tout le temps de le faire.

> `five-scorer-mobile/lib/son/son.ts:57-102`

### `COMPO-06` — ✔ fait · *confort*

**La situation.** Treize joueurs ce soir, ou un seul gardien.

**Ce qu'on attend.** 7 contre 6, le gardien d'un côté, l'écart de force le plus faible possible.

**Où ça en est.** Les gardiens sont distribués d'abord, les tailles rééquilibrées à un joueur d'écart maximum (134-135), puis recherche locale par échanges de paires de même rôle.

> `five-scorer/lib/balance.ts:118-135 ; five-scorer-mobile/lib/noyau/balance.ts (copie conforme)`

### `DIRECT-11` — ✔ fait · *confort*

**La situation.** Carton jaune, puis rouge, pour un joueur — si le club suit les cartons.

**Ce qu'on attend.** Le carton se voit sur la tuile et dans la chronologie, le score ne bouge pas.

**Où ça en est.** Sur l'app la tuile porte la marque du carton (et son nombre) ; sur le site seule la chronologie le montre. Un rouge ne sort pas le joueur : sa tuile compte encore des buts.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:478-494,809-818 ; five-scorer-mobile/app/match/[id].tsx:346-354,686-704,660-661`

### `DIRECT-13` — ✔ fait · *confort*

**La situation.** Le temps réglementaire du club (10 min) est dépassé.

**Ce qu'on attend.** Double coup de sifflet, chrono en rouge, mais le match continue — le club décide quand il s'arrête.

**Où ça en est.** Le sifflet ne joue qu'au franchissement, jamais en rouvrant un match déjà au-delà. La durée vient des réglages du club en cache : si le cache manque (HL-09), pas de sifflet.

> `five-scorer/app/c/[slug]/matches/[id]/live/LiveMatch.tsx:201-216 ; five-scorer-mobile/app/match/[id].tsx:153-188`

### `DIRECT-22` — ✔ fait · *confort*

**La situation.** Les visages sur les tuiles, sans réseau.

**Ce qu'on attend.** On reconnaît les joueurs à la photo, pas seulement au nom.

**Où ça en est.** Les deux mettent la photo en cache à chaque ouverture en ligne. L'app note que la photo (≈20 ko par joueur) est rematérialisée à chaque but — mesure encore à faire.

> `five-scorer/app/c/[slug]/matches/[id]/live/page.tsx:21-33 + LiveMatch.tsx:133-137 ; five-scorer-mobile/lib/match/local.ts:156-172,199-214 ; five-scorer-mobile/db/schema.sql:67-70`

### `FIN-06` — ✔ fait · *confort*

**La situation.** Mode ADMIN : le marqueur choisit le MVP au coup de sifflet, ou termine sans MVP.

**Ce qu'on attend.** Choix facultatif, jamais un MVP au hasard pour sortir de l'écran ; un rejeu tardif ne l'écrase pas.

**Où ça en est.** Facultatif des deux côtés. Le serveur rend inerte un « terminer » rejoué sur un match déjà terminé, pour qu'un finishMatch resté en file n'efface pas le MVP élu.

> `five-scorer/components/MvpPicker.tsx ; five-scorer-mobile/app/match/[id].tsx:796-843 ; five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:165-192`

### `LIM-01` — ✔ fait · *confort*

**La situation.** 0-0, aucun but ; ou 27 buts en une feuille.

**Ce qu'on attend.** Le récap tient debout, le MVP n'est pas inventé.

**Où ça en est.** Le score ne descend jamais sous zéro, le MVP automatique rend null à 0-0, le MVP manuel est facultatif.

> `five-scorer/components/PlayShell.tsx:266-268 (« Aucun but. ») ; five-scorer/lib/mvp.ts:11 ; five-scorer/lib/localMatch.ts:399-402`

### `RETRO-06` — ✔ fait · *confort*

**La situation.** On choisit une date dans le futur pour « Déjà joué ».

**Ce qu'on attend.** Refus.

**Où ça en est.** Le site refuse avec un message ; l'app borne le sélecteur à maintenant et plafonne la date reçue en paramètre.

> `five-scorer/app/c/[slug]/matches/new/NewMatchForm.tsx:258-261 ; five-scorer-mobile/app/compo.tsx:79-86,321`

## Après le match

*52 cas — 8 faits, 26 partiels, 5 absents, **13 faux**.*

### `APRES-05` — ✗ absent · *bloque un lundi*

**La situation.** Au gymnase, sans réseau, le marqueur tape « Terminer » sur l'app et veut voir la feuille refermée avant d'enchaîner.

**Ce qu'on attend.** Le récap s'affiche depuis le téléphone (score, buteurs), avec « n à envoyer » si la file n'est pas vide, comme sur le site.

**Où ça en est.** Site : fait — après le coup de sifflet, PlayShell passe en phase « recap » et RecapLocal lit Dexie, affiche « n à envoyer » et « Le récap complet arrive dès que tout est envoyé ». App : `terminer` fait `router.replace("/clubs")` — retour à la liste des clubs, aucun récap ; et le seul récap de l'app lit le serveur, donc hors ligne il affiche « Impossible de joindre https://… — Network request failed ».

> `five-scorer-mobile/app/match/[id].tsx:442-447 ; five-scorer-mobile/app/recap/[id].tsx:38-52 ; five-scorer-mobile/lib/appel.ts:56-67 ; components/PlayShell.tsx:112-115, 206-330`

### `APRES-06` — ◐ partiel · *bloque un lundi*

**La situation.** Match terminé, il est 21 h 12, les mêmes équipes repartent : « On rejoue ».

**Ce qu'on attend.** Un tap depuis le récap lance le match suivant avec la même compo, rattaché à la même soirée.

**Où ça en est.** Site : fait, avec les gardes (pas si un match est déjà LIVE, pas les joueurs archivés, saison active et non celle du vieux récap, « Saisir le match suivant » en rattrapage). App : absent — aucun « on rejoue » nulle part (grep « rejou » ne trouve que des commentaires) ; il faut refaire toute la compo.

> `app/c/[slug]/matches/[id]/page.tsx:315-345 ; components/RematchButton.tsx ; components/PlayShell.tsx:117-130, 289-303 ; five-scorer-mobile/app/ (aucun)`

### `APRES-01` — ✔ fait · *bloque un lundi*

**La situation.** Mardi matin, un membre ouvre le récap du match 3 d'hier soir : le score, qui a marqué à quelle minute, la chronologie, les stats de duel, la feuille des deux camps, l'homme du match.

**Ce qu'on attend.** Tout est là, identique sur le site et sur l'app, et lisible d'un coup d'œil.

**Où ça en est.** Fait des deux côtés. Petits écarts : la durée du match n'est affichée que sur l'app (recap/[id].tsx:110, jamais passée à RecapView) ; le site montre « Cartons » en une ligne (RecapView.tsx:337), l'app « jaunes » et « rouges » séparés (matchs/[matchId]/route.ts:121-134) ; le récap omet la mi-temps et les cartons de la chronologie des deux côtés (page.tsx:195-196, route.ts:70).

> `app/c/[slug]/matches/[id]/page.tsx ; components/RecapView.tsx ; five-scorer-mobile/app/recap/[id].tsx ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts`

### `APRES-03` — ⚠ faux · *gêne un lundi*

**La situation.** Un membre resté à la maison ouvre depuis son téléphone le match en cours que le marqueur saisit au gymnase.

**Ce qu'on attend.** Il voit le score qui monte, avec la mention « En direct » ; il ne peut rien écrire.

**Où ça en est.** Site : fait — le récap serveur affiche « En direct » et « Reprendre le match en cours » aux marqueurs. App : l'accueil envoie tout match LIVE vers la feuille locale /match/[id] (index.tsx:205-207), qui lit SQLite ; sur un téléphone qui n'a pas saisi, getLocalMatch rend null et l'écran reste sur « Un instant… » pour toujours (match/[id].tsx:238-247). Et le récap serveur de l'app ignore le statut (FicheMatch.statut jamais lu dans recap/[id].tsx) : ni « En direct », ni reprise.

> `five-scorer-mobile/app/club/[id]/index.tsx:205-207 ; five-scorer-mobile/app/match/[id].tsx:128-131, 238-247 ; app/c/[slug]/matches/[id]/page.tsx:294, 307 ; components/RecapView.tsx:188, 270-276`

### `APRES-04` — ⚠ faux · *gêne un lundi*

**La situation.** Depuis la soirée, quelqu'un tape sur un match programmé (pas encore joué) ou sur un match annulé.

**Ce qu'on attend.** Le site le dit : « Match programmé » avec la convocation, ou « Match annulé — était prévu le … ». L'app aussi.

**Où ça en est.** Site (page match) : fait. App : la soirée envoie tout ce qui n'est pas LIVE vers /recap/[id], et le récap n'utilise jamais `statut` : un match programmé ou annulé s'affiche « 0 – 0 », « Aucun but dans ce match. », feuille vide, sans un mot. Pire, la ligne de la soirée l'étiquette « Terminé » pour un match annulé (route.ts:191), et la page soirée du site fait pareil (sessions/[id]/page.tsx:340).

> `app/c/[slug]/matches/[id]/page.tsx:69-181 ; five-scorer-mobile/app/soiree/[id].tsx:247-255 ; five-scorer-mobile/app/recap/[id].tsx ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:184-191 ; app/c/[slug]/sessions/[id]/page.tsx:335-343`

### `APRES-07` — ⚠ faux · *gêne un lundi*

**La situation.** Le marqueur a tapé « Terminer » trop tôt (il restait deux minutes) et veut rouvrir la feuille.

**Ce qu'on attend.** Soit on peut rouvrir, soit le bouton n'existe pas. Pas un bouton qui ne fait rien.

**Où ça en est.** Le site affiche « Rouvrir le match » sur le récap local : il remonte LiveMatch, qui voit le statut FINISHED et rappelle aussitôt onFinished → retour au récap. Le bouton est mort, et le serveur ne connaît de toute façon aucun retour FINISHED → LIVE (PatchBody.status n'admet que « FINISHED »). App : rien.

> `components/PlayShell.tsx:308-310 ; app/c/[slug]/matches/[id]/live/LiveMatch.tsx:267-272, 568 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:113-114 ; five-scorer-mobile/app/match/[id].tsx`

### `APRES-17` — ⚠ faux · *gêne un lundi*

**La situation.** Club en mode vote. L'admin décide de poser lui-même l'homme du match (personne n'a voté, ou pour trancher). Puis un membre vote le lendemain.

**Ce qu'on attend.** Le choix de l'admin tient, ou l'admin est prévenu qu'un vote l'écrasera.

**Où ça en est.** L'édition écrit mvpId sans regarder le mode ; la prochaine voix recompte et réécrit mvpId (motm.ts:68-71). Le choix de l'admin disparaît en silence, et rien dans le formulaire ne dit que le vote est ouvert.

> `app/actions/matches.ts:79 ; app/actions/motm.ts:49-72 ; app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:117-132`

### `APRES-02` — ◐ partiel · *gêne un lundi*

**La situation.** Un but rattrapé après coup, avec une minute antérieure aux buts déjà saisis (ou une feuille où l'on a annulé puis ressaisi).

**Ce qu'on attend.** La chronologie est chronologique, la même sur le site et sur l'app.

**Où ça en est.** Le site retrie par minute (un but sans minute hérite de celle du précédent) ; l'app garde l'ordre de saisie et calcule le score courant dans cet ordre. Le même match donne deux chronologies et deux suites de scores courants. Sans importance tant que la correction n'existe pas, faux dès qu'elle existera.

> `components/RecapView.tsx:104-116 ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts:136-159`

### `APRES-08` — ◐ partiel · *gêne un lundi*

**La situation.** Le lendemain, tout le club lit le récap ; mais la file d'envoi du marqueur a été refusée (403 ou 404) et trois buts ne sont jamais arrivés au serveur.

**Ce qu'on attend.** Quelqu'un est prévenu que ce récap n'est pas le vrai — au minimum le marqueur, idéalement le récap lui-même.

**Où ça en est.** Les opérations refusées sont conservées et comptées (« bloquées ») des deux côtés ; le site le montre sur le récap local (« n à envoyer ») et le SyncBadge, l'app seulement sur la pastille de la feuille en direct. Le récap serveur, lui, affiche le score tronqué comme s'il était juste, pour tout le monde. Une fois « Terminer » passé (le finishMatch est dans la même chaîne bloquée), le marqueur ne revoit jamais la pastille sur l'app.

> `lib/sync.ts:304-338 ; five-scorer-mobile/lib/outbox/sync.ts:328-344 ; components/PlayShell.tsx:220-228 ; five-scorer-mobile/app/match/[id].tsx:1042-1062 ; app/c/[slug]/matches/[id]/page.tsx (rien)`

### `APRES-11` — ◐ partiel · *gêne un lundi*

**La situation.** Corriger les à-côtés : le nom d'une équipe, la date et l'heure, l'homme du match, la saison, une note.

**Ce qu'on attend.** Un admin corrige depuis le récap ; le récap et la liste reflètent le changement, sur le site et l'app.

**Où ça en est.** Site : fait pour un admin (formulaire complet, messages « Date invalide. », « MVP hors du club. », « Saison inconnue. »). App : absent — aucun écran ; et l'API PATCH que l'app pourrait appeler n'accepte ni playedAt ni seasonId (PatchBody route.ts:113-120), seulement noms, notes, MVP et durée.

> `app/c/[slug]/matches/[id]/edit/page.tsx ; app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx ; app/actions/matches.ts:37-88 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:113-205 ; five-scorer-mobile/app/recap/[id].tsx (rien)`

### `APRES-12` — ◐ partiel · *gêne un lundi*

**La situation.** Celui qui a saisi le match (simple membre autorisé à marquer) se rend compte de l'erreur et veut corriger.

**Ce qu'on attend.** Soit il peut, soit il reçoit un refus explicite — pas un écran qui ne réagit pas.

**Où ça en est.** Le lien « Corriger » n'apparaît qu'aux admins ; si le membre tape l'URL /edit, il est renvoyé au récap sans un mot (redirect, edit/page.tsx:15) ; l'action serveur répond « Réservé aux admins. » et l'API « Admin requis pour modifier un match terminé ». Le refus existe côté serveur, mais l'écran, lui, se tait. App : rien à refuser, rien n'existe. La règle elle-même (admin ou canScore) n'est pas tranchée — Q1 de la spec 0001.

> `app/c/[slug]/matches/[id]/page.tsx:361-368 ; app/c/[slug]/matches/[id]/edit/page.tsx:15 ; app/actions/matches.ts:49 ; app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68-73 ; five-scorer-mobile/app/recap/[id].tsx`

### `APRES-15` — ◐ partiel · *gêne un lundi*

**La situation.** Un match a été saisi le mauvais jour (compo lancée un mardi pour la soirée de lundi) ; l'admin corrige la date.

**Ce qu'on attend.** Le match rejoint la bonne soirée ; le récap et le bilan de la soirée suivent.

**Où ça en est.** playedAt est modifiable, matchDayId ne l'est pas. Après correction, le récap continue d'afficher « Soirée du <ancienne date> · Match n » (calculé depuis matchDay), et l'ancienne soirée continue de le compter dans son bilan et son mot. Aucun moyen de rattacher un match à une autre soirée.

> `app/actions/matches.ts:28-35, 78 ; app/c/[slug]/matches/[id]/page.tsx:238-248 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:155-170`

### `APRES-22` — ◐ partiel · *gêne un lundi*

**La situation.** Le terrain est fermé : annuler un match programmé.

**Ce qu'on attend.** Un admin l'annule ; le match reste visible comme annulé, les convocations s'arrêtent.

**Où ça en est.** Site : fait (confirmation « Sûr ? », refus explicite « Seul un match programmé peut être annulé. », les convocations sont closes). App : absent — aucun appel, aucun bouton.

> `app/c/[slug]/matches/[id]/CancelMatchButton.tsx ; app/actions/schedule.ts:89-114 ; app/c/[slug]/matches/[id]/page.tsx:78-101, 174-178 ; five-scorer-mobile/ (rien)`

### `APRES-27` — ◐ partiel · *gêne un lundi*

**La situation.** Un admin supprime un match pendant qu'un téléphone a encore des buts de ce match dans sa file d'envoi.

**Ce qu'on attend.** Le marqueur comprend que le match a été retiré, et sa file ne reste pas bloquée sans explication.

**Où ça en est.** Les rejeux tombent en 404 « Match introuvable », la chaîne entière du match est marquée bloquée (« n refusées ») — conservée, pas perdue, c'est bien. Mais rien ne dit pourquoi, et « Réessayer » rejouera le même 404 indéfiniment.

> `lib/sync.ts:304-338 ; five-scorer-mobile/lib/outbox/sync.ts:328-344 ; app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:64-66`

### `APRES-29` — ◐ partiel · *gêne un lundi*

**La situation.** Deux téléphones ont saisi le même match programmé. A termine ; B, resté hors ligne, a encore deux buts en file.

**Ce qu'on attend.** Une règle claire : les buts de B sont fusionnés, ou refusés avec explication — la même quel que soit le rôle de B.

**Où ça en est.** Si B est membre : 403, chaîne bloquée, ses buts restent sur son téléphone. Si B est admin : « Réessayer les bloquées » les fait passer (le POST accepte un admin sur FINISHED), le score du match terminé change sans que A ni le club ne soient prévenus. La règle dépend du rôle de celui qui tenait le second téléphone.

> `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:68-73 ; app/api/clubs/[clubId]/matches/route.ts:250-257 ; lib/sync.ts:74-86, 304-338 ; five-scorer-mobile/lib/outbox/sync.ts:391-397`

### `APRES-31` — ◐ partiel · *gêne un lundi*

**La situation.** Club en mode vote : le mardi, chacun vote pour l'homme du match d'hier.

**Ce qu'on attend.** Depuis le récap, un tap = ma voix, le résultat vit ; sur le site et sur l'app.

**Où ça en est.** Site : fait (optimiste, refus explicites : « Le vote ouvre à la fin du match. », « Ce joueur n'a pas joué ce match. »). App : le serveur envoie `vote` (mon vote, candidats, voix) dans la fiche, mais l'écran ne le dessine pas, et il n'existe aucune route POST de vote pour l'app. Le téléphone ne vote pas.

> `components/MotmVotePanel.tsx ; app/actions/motm.ts ; app/c/[slug]/matches/[id]/page.tsx:227-236, 347-359 ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts:234-248 ; five-scorer-mobile/app/recap/[id].tsx ; app/api/clubs/[clubId]/ (aucune route de vote)`

### `APRES-38` — ◐ partiel · *gêne un lundi*

**La situation.** 23 h 14, le marqueur veut poster la carte du match (image aux couleurs du club, score, buteurs, homme du match) dans le groupe WhatsApp.

**Ce qu'on attend.** Un tap : la carte part dans WhatsApp, depuis le site comme depuis l'app.

**Où ça en est.** Site : fait — feuille « Partager le récap » avec l'aperçu 4/5, « Partager l'image » (Web Share, repli lien, repli téléchargement), « Enregistrer », « Copier le lien ». App : absent — aucun partage de match ; Share.share ne sert qu'au mot de la soirée, au lien du club et à l'agenda. MOBILE.md:86 le savait : shareCard.ts « n'a aucun équivalent direct ».

> `components/RecapView.tsx:206, 404-425 ; components/PartageFeuille.tsx ; lib/shareCard.ts ; five-scorer-mobile/app/recap/[id].tsx (rien) ; five-scorer-mobile/app/soiree/[id].tsx:86-91`

### `APRES-43` — ✔ fait · *gêne un lundi*

**La situation.** Le mardi matin, coller dans le groupe le résumé de la soirée entière (« Blanc gagne la soirée 4-2, Match 1 : … »).

**Ce qu'on attend.** Le mot est composé, un tap l'envoie ; corrigé un match, le mot suit.

**Où ça en est.** Fait des deux côtés, composé par le serveur (une seule implémentation), Web Share ou presse-papier sur le site, Share.share sur l'app. Reflète les corrections au rechargement. Inclut les matchs EXTERNAL dans la liste mais pas dans le bilan (route.ts:155-156) — cohérent.

> `lib/soiree.ts ; app/c/[slug]/sessions/[id]/MotDeLaSoiree.tsx ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:279 ; five-scorer-mobile/app/soiree/[id].tsx:86-91, 230-241`

### `APRES-14` — ⚠ faux · *gêne une saison*

**La situation.** Un admin corrige (ou déplace vers une autre saison) un match d'une saison clôturée dont le classement a déjà été lu et commenté.

**Ce qu'on attend.** L'app le dit très fort avant, ou le refuse.

**Où ça en est.** Le formulaire liste toutes les saisons du club, marque « (active) » et laisse choisir une saison close sans un mot ; le serveur vérifie seulement que la saison appartient au club. Le classement de la saison close change en silence.

> `app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:133-148 ; app/actions/matches.ts:62-67`

### `APRES-25` — ⚠ faux · *gêne une saison*

**La situation.** Un admin supprime un match terminé.

**Ce qu'on attend.** D'après la spec 0001 : impossible — « Rien dans l'app ne supprime ». Si c'est permis : avec une trace et en connaissance des conséquences.

**Où ça en est.** La suppression existe bel et bien sur le site (bouton « Supprimer » sur tout match terminé ou annulé, pour un admin), contrairement à ce qu'affirme la spec. Cascade en base : buts, compo, votes, convocations partent avec ; les stats, l'Élo et la forme se recalculent sans le match ; aucune trace, aucune corbeille. App : absente (la route DELETE existe, personne ne l'appelle).

> `components/DeleteMatchButton.tsx ; app/actions/matches.ts:9-26 ; app/c/[slug]/matches/[id]/page.tsx:361-368 ; prisma/schema.prisma:407, 427, 455, 473 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:207-220`

### `APRES-33` — ⚠ faux · *gêne une saison*

**La situation.** Six mois plus tard, quelqu'un vote sur un match d'une saison close (en fouillant l'historique, ou par erreur).

**Ce qu'on attend.** Le vote est clos depuis longtemps ; le palmarès de la saison ne bouge plus.

**Où ça en est.** Le seul garde est « match terminé ». La voix tardive recompte, peut changer l'homme du match, donc le compteur mvpCount et le palmarès d'une saison déjà lue. Aucune fenêtre, aucune clôture.

> `app/actions/motm.ts:27-34, 68-71 ; lib/stats.ts (mvpCount)`

### `APRES-13` — ✗ absent · *gêne une saison*

**La situation.** Un score a changé après coup ; au club, quelqu'un demande « qui a touché à ça, et quand ? ».

**Ce qu'on attend.** Le récap porte « corrigé le … par … ».

**Où ça en est.** Aucune trace nulle part. `Match.updatedAt` existe mais bouge aussi à chaque vote MVP (motm.ts:68-71) et au coup de sifflet ; personne ne l'affiche. Aucun champ « par qui ». Une correction est indiscernable d'une saisie.

> `prisma/schema.prisma:379 (updatedAt, jamais lu) ; app/c/[slug]/matches/[id]/page.tsx ; five-scorer-mobile/app/recap/[id].tsx`

### `APRES-23` — ✗ absent · *gêne une saison*

**La situation.** Un match a été lancé par erreur (mauvais soir, test, doublon) ou terminé alors qu'il n'a jamais eu lieu.

**Ce qu'on attend.** On l'annule — il reste dans l'histoire comme annulé — et il ne compte nulle part.

**Où ça en est.** Le serveur n'annule que SCHEDULED. Les deux issues réelles : « Terminer » à 0–0, qui inscrit un nul, un match joué et un mouvement d'Élo à dix personnes pour un match qui n'a pas eu lieu ; ou « Supprimer » (admin), qui efface tout. La spec 0001 dit pourtant « un match qui n'a pas eu lieu s'annule, il ne s'efface pas ».

> `app/actions/schedule.ts:102-108 ; lib/stats.ts:52 ; app/actions/matches.ts:9-26`

### `APRES-09` — ◐ partiel · *gêne une saison*

**La situation.** « Attends, c'était 4-3 » : ajouter un but oublié, avec son buteur, à un match terminé.

**Ce qu'on attend.** Depuis le récap, on ajoute le but ; le score passe de 3-2 à 4-2 sur le site et l'app ; classement, Élo et forme suivent.

**Où ça en est.** Le serveur sait le faire : POST events accepte un admin sur un match FINISHED et recalcule le score. Mais aucun écran ne l'appelle : le formulaire d'édition renvoie vers « la timeline » (« Pour corriger les buts, ouvre le match et utilise la timeline. »), qui n'est accessible que sur la feuille en direct — laquelle refuse de s'afficher sur un match terminé et redirige vers le récap. Impasse. App : rien. Droit serveur : admin, alors que la spec 0001 propose canScore.

> `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:42-130 ; app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:180-182 ; app/c/[slug]/matches/[id]/live/LiveMatch.tsx:267-272 ; five-scorer-mobile/app/recap/[id].tsx (rien)`

### `APRES-10` — ◐ partiel · *gêne une saison*

**La situation.** Retirer un but compté par erreur, ou le rendre au bon buteur (on a tapé sur la mauvaise tuile).

**Ce qu'on attend.** On retire le but, ou on change son auteur, sans toucher au reste.

**Où ça en est.** Serveur : DELETE d'un événement accepté pour un admin sur FINISHED, score recalculé. Changer le buteur : le PATCH `scorerPlayerId` est contraint au type OWN_GOAL (where type: "OWN_GOAL", route.ts:195-197) — pour un but normal il faut supprimer puis recréer, avec un nouvel identifiant et une nouvelle date de saisie (donc une autre place dans la chrono de l'app). Aucun écran ne fait ni l'un ni l'autre.

> `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:190-202, 207-242 ; five-scorer-mobile/app/recap/[id].tsx (rien)`

### `APRES-16` — ⚠ faux · *confort*

**La situation.** L'admin écrit une note sur le match (« petit pont de Karim, but de l'année »).

**Ce qu'on attend.** La note se lit quelque part — sur le récap, la carte, ou le mot de la soirée.

**Où ça en est.** La note est saisie et enregistrée, puis n'est affichée nulle part : ni le récap du site, ni /r, ni la fiche de l'app, ni le mot de la soirée ne la lisent. Le seul lecteur est le formulaire d'édition lui-même (valeur initiale) et l'API de reprise. Un champ qu'on remplit dans le vide.

> `app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:151-160 ; app/actions/matches.ts:80-82 ; app/c/[slug]/matches/[id]/page.tsx (ne la passe pas) ; components/RecapView.tsx (pas de prop) ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts (absente de FicheMatch)`

### `APRES-19` — ⚠ faux · *confort*

**La situation.** Un admin ouvre /edit sur un match en cours (par l'URL, ou depuis un vieil onglet).

**Ce qu'on attend.** Refusé, ou sans effet sur la feuille qui tourne.

**Où ça en est.** Ni la page ni l'action ne regardent le statut. Changer playedAt d'un match LIVE recale la minute des buts (calculée depuis playedAt) et peut faire basculer la feuille en « rétro » (plus de chrono, minutes nulles) au prochain chargement.

> `app/c/[slug]/matches/[id]/edit/page.tsx (aucun garde de statut) ; app/actions/matches.ts:51-54 ; lib/localMatch.ts:337-343 ; lib/retro.ts`

### `APRES-20` — ⚠ faux · *confort*

**La situation.** Un admin ajoute après coup un but à un joueur qui n'était pas sur la feuille de ce match.

**Ce qu'on attend.** Refusé : un but se crédite à quelqu'un qui a joué.

**Où ça en est.** POST events vérifie que le joueur est du club, pas qu'il est participant du match (la feuille locale, elle, le vérifie : localMatch.ts:326-331). Résultat dans les stats : des buts sans match joué. Aucun écran ne le fait aujourd'hui ; la future correction devra le tenir côté serveur.

> `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:97-114 ; lib/stats.ts`

### `APRES-26` — ⚠ faux · *confort*

**La situation.** La suppression échoue (match déjà supprimé par un autre admin, panne de base).

**Ce qu'on attend.** Un message ; on ne fait pas croire que c'est fait.

**Où ça en est.** deleteMatch avale toute erreur (`.catch(() => null)`) puis redirige vers la liste comme si c'était fait ; le bouton n'affiche jamais rien (il ignore la valeur de retour, même « Réservé aux admins. »). Le match est toujours là et personne ne le sait.

> `app/actions/matches.ts:21-25 ; components/DeleteMatchButton.tsx:31-35`

### `APRES-41` — ⚠ faux · *confort*

**La situation.** Partager depuis le récap d'un match encore en cours.

**Ce qu'on attend.** Soit refusé (« attends la fin »), soit une carte qui dit « En direct » et un lien qui marche.

**Où ça en est.** Le bouton Partager est affiché sans condition de statut ; la carte écrit « Terminé » en dur sur un score provisoire ; le lien copié /r/[id] répond 404 tant que le match n'est pas terminé.

> `components/RecapView.tsx:206, 404-409 ; lib/shareCard.ts:190 ; components/PartageFeuille.tsx:129 ; app/r/[id]/page.tsx:62`

### `APRES-47` — ⚠ faux · *confort*

**La situation.** Récap ouvert depuis un lien profond, sans club dans l'URL, par quelqu'un membre de deux clubs.

**Ce qu'on attend.** Le bon match s'ouvre.

**Où ça en est.** Repli sur `clubs[0]` : si le match appartient à l'autre club, l'API répond 404 « introuvable ». La soirée passe bien le clubId (soiree/[id].tsx:253), l'accueil et la liste aussi ; seul un lien externe tombe dedans.

> `five-scorer-mobile/app/recap/[id].tsx:42-45`

### `APRES-24` — ✗ absent · *confort*

**La situation.** Le terrain rouvre finalement : revenir sur l'annulation d'un match programmé.

**Ce qu'on attend.** On le remet au programme, avec ses convocations.

**Où ça en est.** Aucune action CANCELED → SCHEDULED. Le récap d'un match annulé ne propose que « Supprimer » ; il faut supprimer et reprogrammer, en perdant les réponses.

> `app/c/[slug]/matches/[id]/page.tsx:93-97 ; app/actions/schedule.ts`

### `APRES-52` — ✗ absent · *confort*

**La situation.** Corriger la minute d'un but (le marqueur l'a tapé deux minutes après l'action, ou la feuille rétro n'a pas de minutes).

**Ce qu'on attend.** On pose ou corrige la minute d'un but existant.

**Où ça en est.** La minute n'est écrite qu'à la création (POST). Aucun PATCH de minute, aucun écran. Une feuille saisie après coup restera sans minutes pour toujours.

> `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:132-204 (PATCH ne touche que passeur et auteur de csc)`

### `APRES-18` — ◐ partiel · *confort*

**La situation.** L'homme du match désigné n'a pas joué ce match (mauvais clic, ou appel forgé).

**Ce qu'on attend.** Refusé : l'homme du match est un joueur de la feuille.

**Où ça en est.** Le formulaire ne propose que les participants (tenu par l'affichage), mais le serveur accepte n'importe quel joueur du club (« MVP hors du club » est le seul refus). Le vote, lui, exige un participant. Le compteur mvpCount des stats peut donc créditer un absent.

> `app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:126-131 ; app/actions/matches.ts:56-61 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:156-163 ; app/actions/motm.ts:36-41`

### `APRES-21` — ◐ partiel · *confort*

**La situation.** Un nom d'équipe corrigé très long (une phrase entière) ou vide.

**Ce qu'on attend.** Borné comme à la création (40 caractères), jamais vide ; la carte de partage reste lisible.

**Où ça en est.** Le vide est ignoré (trim → champ non modifié), mais aucun plafond de longueur, alors que scheduleMatch coupe à 40. La carte de partage dessine le nom sans le mesurer : un nom long déborde du canvas.

> `app/actions/matches.ts:76-77 ; app/actions/schedule.ts:77-80 ; lib/shareCard.ts:194-200`

### `APRES-28` — ◐ partiel · *confort*

**La situation.** Le lien public du match a été posté sur WhatsApp ; le match est ensuite supprimé, ou corrigé.

**Ce qu'on attend.** Corrigé : le lien montre la version corrigée. Supprimé : une page qui dit que le match a été retiré, pas une 404 nue.

**Où ça en est.** Corrigé : fait (page dynamique, relue à chaque visite). Supprimé : notFound() → la 404 générique du site, pour quinze personnes qui ont le lien.

> `app/r/[id]/page.tsx:50-62`

### `APRES-30` — ◐ partiel · *confort*

**La situation.** Deux admins corrigent le même match en même temps (l'un la date, l'autre le nom d'équipe).

**Ce qu'on attend.** Les deux corrections tiennent, ou le second est prévenu.

**Où ça en est.** Le formulaire renvoie TOUS les champs (noms, date, MVP, saison, notes) tels qu'il les a chargés ; le dernier enregistré écrase les champs de l'autre avec ses valeurs de départ. Aucune version, aucun verrou.

> `app/actions/matches.ts:73-85 ; app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx:59-74`

### `APRES-32` — ◐ partiel · *confort*

**La situation.** Je change d'avis : déplacer ma voix, ou la retirer tout à fait.

**Ce qu'on attend.** Les deux sont possibles, comme le promet le texte « tu peux changer d'avis ».

**Où ça en est.** Déplacer : fait (upsert). Retirer : impossible — aucune suppression de vote, retaper sur mon choix ne fait rien.

> `app/actions/motm.ts:43-47 ; components/MotmVotePanel.tsx:57`

### `APRES-34` — ◐ partiel · *confort*

**La situation.** Un membre qui n'a pas joué ce match (ou qui n'a même pas de fiche joueur) vote.

**Ce qu'on attend.** Une règle tranchée : tout le club vote, ou seulement ceux qui étaient là.

**Où ça en est.** Autorisé : le serveur ne vérifie que l'appartenance au club (requireClub). Le candidat doit avoir joué, pas le votant. Jamais décidé.

> `app/actions/motm.ts:22-47`

### `APRES-35` — ◐ partiel · *confort*

**La situation.** Égalité de voix entre deux joueurs.

**Ce qu'on attend.** Le club sait comment c'est tranché.

**Où ça en est.** Tranché par ordre alphabétique du nom, en silence : le panneau affiche deux joueurs à égalité et une étoile sur celui dont le nom vient en premier, sans explication.

> `app/actions/motm.ts:61-67 ; components/MotmVotePanel.tsx`

### `APRES-39` — ◐ partiel · *confort*

**La situation.** Sur iPhone, « Enregistrer » l'image de la carte dans les photos.

**Ce qu'on attend.** L'image est dans la pellicule, ou l'app dit ce qu'il s'est passé.

**Où ça en est.** Téléchargement par `<a download>` ; le commentaire admet que certains navigateurs refusent le téléchargement déclenché par script et « s'ouvre » à la place ; l'état affiché dit « Image enregistrée. » quoi qu'il arrive. Non vérifiable dans le code, à voir sur l'appareil.

> `lib/shareCard.ts:280-291 ; components/PartageFeuille.tsx:83-89`

### `APRES-40` — ◐ partiel · *confort*

**La situation.** « Copier le lien » du match, puis un invité sans compte l'ouvre — le club n'a pas activé « page publique ».

**Ce qu'on attend.** Décidé et écrit : le lien d'un match marche-t-il pour un club fermé ?

**Où ça en est.** Le lien /r/[id] marche pour tout match terminé, club public ou non (identifiant non devinable, noindex, sans photos) ; seule /p/[slug] obéit à isPublic, dont le commentaire dit « classements + résultats en lecture seule ». Probablement voulu, jamais écrit. Le repli sans presse-papier passe par un prompt().

> `components/PartageFeuille.tsx:90-97 ; app/r/[id]/page.tsx:52-62 ; app/p/[slug]/page.tsx:38 ; prisma/schema.prisma:180-181`

### `APRES-42` — ◐ partiel · *confort*

**La situation.** Soirée folle : six buteurs différents dans le même camp.

**Ce qu'on attend.** La carte les nomme tous, ou dit « et 1 autre ».

**Où ça en est.** Coupé à cinq par camp, en silence : le sixième buteur n'est pas sur la carte, ni sur l'aperçu. Le récap, lui, les affiche tous.

> `lib/shareCard.ts:100 ; components/PartageFeuille.tsx:68`

### `APRES-45` — ◐ partiel · *confort*

**La situation.** Ouvrir le récap d'un match qui n'existe plus, ou qui est dans un autre club.

**Ce qu'on attend.** « Ce match n'existe plus » en français, pas un code.

**Où ça en est.** Site : 404 générique. App : l'écran affiche le message brut « Le serveur a répondu 404 — introuvable » en rouge, sans bouton de retour autre que la barre.

> `app/c/[slug]/matches/[id]/page.tsx:38 ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts:24, 65 ; five-scorer-mobile/app/recap/[id].tsx:48, 87 ; five-scorer-mobile/lib/appel.ts:36-47`

### `APRES-50` — ◐ partiel · *confort*

**La situation.** Le bilan « 9-2-3 » sous chaque écusson, après qu'on a corrigé le nom d'une équipe sur un match.

**Ce qu'on attend.** Le même chiffre sur le site et sur l'app.

**Où ça en est.** Le site ne compte que les matchs aux noms d'équipes identiques ; l'app compte tous les matchs internes de la saison. Un match renommé sort du bilan côté site, pas côté app. Avec deux chasubles fixes c'est invisible ; à la première correction de nom, les deux écrans divergent.

> `app/c/[slug]/matches/[id]/page.tsx:250-270 ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts:89-107`

### `APRES-51` — ◐ partiel · *confort*

**La situation.** Retrouver un match annulé dans l'historique, trois semaines après.

**Ce qu'on attend.** Il apparaît, barré ou marqué « annulé », dans la liste des matchs.

**Où ça en est.** La liste des matchs l'exclut des deux côtés (statuts LIVE/SCHEDULED/FINISHED seulement). Il ne reste joignable que par sa soirée — où il est étiqueté « Terminé » (APRES-04) — ou par l'URL.

> `app/c/[slug]/matches/page.tsx:39-45 ; app/api/clubs/[clubId]/matchs/route.ts:48-73 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:179-191`

### `APRES-36` — ✔ fait · *confort*

**La situation.** Le club passe du mode vote au mode « le marqueur désigne » (ou l'éteint) après des matchs déjà votés.

**Ce qu'on attend.** Les anciens résultats restent ; plus personne ne vote.

**Où ça en est.** Le panneau disparaît, le vote est refusé (« Le vote MVP n'est pas activé. »), les voix et le mvpId élu restent en base.

> `app/actions/motm.ts:23-25 ; app/c/[slug]/matches/[id]/page.tsx:233-236`

### `APRES-37` — ✔ fait · *confort*

**La situation.** Match 0–0, personne n'a marqué : l'homme du match.

**Ce qu'on attend.** En mode vote, on vote quand même ; en mode marqueur, on peut terminer sans MVP ; le récap ne montre pas de carte vide.

**Où ça en est.** Le panneau de vote s'ouvre dès que le match est terminé et a des joueurs ; l'élection admin est facultative ; la carte MVP n'apparaît que si mvpName existe.

> `app/c/[slug]/matches/[id]/page.tsx:233-236 ; five-scorer-mobile/app/match/[id].tsx:796-810 ; components/RecapView.tsx:299`

### `APRES-44` — ✔ fait · *confort*

**La situation.** Un curieux (ou un futur membre) ouvre la vitrine du club : derniers résultats et classement.

**Ce qu'on attend.** Visible si le club l'a voulu ; sinon rien, et l'app explique pourquoi.

**Où ça en est.** Garde isPublic des deux côtés ; les cinq derniers matchs terminés renvoient vers /r/[id] ; l'app dit « Aucun club public à … Vérifie le réglage « Page publique » ». Vide : « Pas encore de match terminé. »

> `app/p/[slug]/page.tsx ; app/api/public/[slug]/route.ts ; five-scorer-mobile/lib/api.ts:647-664 ; five-scorer-mobile/app/vitrine.tsx`

### `APRES-46` — ✔ fait · *confort*

**La situation.** Session expirée pendant qu'on lit un récap.

**Ce qu'on attend.** Retour propre à la connexion, sans écran vide.

**Où ça en est.** App : SessionExpiree → /connexion. Site : redirect /session-expiree (qui efface le cookie).

> `five-scorer-mobile/app/recap/[id].tsx:47 ; lib/guard.ts:73, 86`

### `APRES-48` — ✔ fait · *confort*

**La situation.** Un vieux récap : un des joueurs a été archivé depuis, un autre était un invité d'un soir.

**Ce qu'on attend.** Les noms restent ; « on rejoue » ne réinvite pas l'archivé.

**Où ça en est.** Les noms viennent des participants (jamais supprimés) ; les archivés sont exclus de la relance sur le site. L'app n'a pas de relance (APRES-06).

> `app/c/[slug]/matches/[id]/page.tsx:222-225 ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts:168-182`

### `APRES-49` — ✔ fait · *confort*

**La situation.** Un match sans but, sans homme du match, hors soirée, hors saison.

**Ce qu'on attend.** Le récap reste propre : pas de carte vide, pas de « ? ».

**Où ça en est.** « Aucun but. » / « Aucun but dans ce match. », pas de carte MVP, contexte = date, bilan absent hors saison (app) ou si moins de deux matchs (site).

> `components/RecapView.tsx:346-347, 299 ; app/c/[slug]/matches/[id]/page.tsx:239-248, 269-270 ; five-scorer-mobile/app/recap/[id].tsx:185-188 ; app/api/clubs/[clubId]/matchs/[matchId]/route.ts:89-107`

## Le vestiaire

*62 cas — 38 faits, 12 partiels, 7 absents, **5 faux**.*

### `VEST-34` — ⚠ faux · *gêne un lundi*

**La situation.** Le capitaine vient d'ajouter Kylian, qui viendra tous les lundis ; ou Kylian, nouveau membre, veut s'abonner avant son premier match.

**Ce qu'on attend.** Pouvoir cocher « Vient tous les lundis » dès la fiche créée, pour qu'il compte présent lundi prochain.

**Où ça en est.** L'interrupteur vit DANS le bloc « allTime.matchesPlayed > 0 » des deux fiches ; à zéro match on ne voit que « Aucun match joué pour l'instant ». Le formulaire de fiche n'a volontairement pas le champ. abonne vaut false par défaut. Un joueur neuf n'est donc jamais compté présent — il n'est pas présélectionné dans la compo (compo.tsx:137-139) ni dans la jauge de la soirée — tant qu'il n'a pas joué un match, et pour cela il faut que quelqu'un pense à le cocher à la main.

> `app/c/[slug]/players/[id]/page.tsx:97-184,282-286 ; five-scorer-mobile/app/joueur/[id].tsx:139-206,319-325 ; RosterClient.tsx:31-37 ; fiche.tsx:103-112 ; prisma/schema.prisma:229`

### `VEST-11` — ✗ absent · *gêne un lundi*

**La situation.** Deux Karim au club : le capitaine ajoute le second.

**Ce qu'on attend.** Être prévenu du doublon, ou poussé à mettre un surnom / une initiale pour les distinguer sur la feuille de match.

**Où ça en est.** Aucune vérification d'homonyme à la création ni à la modification. Rien ne signale les doublons dans la liste. La photo est aujourd'hui le seul repère.

> `app/actions/roster.ts:44-57 ; app/api/clubs/[clubId]/joueurs/route.ts:15-51`

### `VEST-38` — ✗ absent · *gêne un lundi*

**La situation.** Au gymnase, sans réseau, le capitaine veut ajouter le joueur qui revient, avec sa photo prise sur place (app).

**Ce qu'on attend.** Que ça parte plus tard, comme un but dans la file d'attente — ou un refus clair qui oriente vers l'invité.

**Où ça en est.** Appel direct, pas d'entrée dans la file ; l'erreur réseau s'affiche telle quelle et la photo choisie reste à l'écran jusqu'au retour. Le contournement est l'invité de la compo (compo.tsx:214-224), qui hérite ensuite du problème VEST-43.

> `five-scorer-mobile/app/joueur/fiche.tsx:113-116 ; lib/outbox/types.ts (aucune opération joueur/photo)`

### `VEST-36` — ◐ partiel · *gêne un lundi*

**La situation.** Un abonné a déménagé il y a six mois ; personne ne l'a archivé ; il est encore abonné.

**Ce qu'on attend.** Ne plus le compter présent, ou au moins le signaler.

**Où ça en est.** Tant qu'il n'est pas archivé, il est « IN via abonnement » chaque lundi et gonfle la jauge « 12 présents ». Rien ne repère un abonné absent depuis N soirées. L'archivage (qui l'exclut du vivier) est le seul remède et il est manuel ; il ne touche pas abonne, donc réactivé il redevient présent d'office.

> `lib/presences.ts:76-96 ; app/c/[slug]/page.tsx:194 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:74 ; RosterClient.tsx:278-286`

### `VEST-01` — ✔ fait · *gêne un lundi*

**La situation.** Un membre ouvre l'effectif un dimanche soir pour voir qui est au vestiaire.

**Ce qu'on attend.** Une rangée par joueur : photo ou initiales, nom, gant si gardien, point vert si compte lié, étoiles du niveau, matchs et buts de toute sa carrière, « invité » le cas échéant ; les archivés à part sous un repli.

**Où ça en est.** Les deux côtés lisent getLeaderboard sans saison (players/page.tsx:26, effectif/route.ts:43) et trient par nom. Le sous-titre « n joueur(s) au vestiaire » est assemblé côté serveur pour l'app (effectif/route.ts:55).

> `app/c/[slug]/players/page.tsx, RosterClient.tsx ; five-scorer-mobile/app/club/[id]/effectif.tsx, app/api/clubs/[clubId]/effectif/route.ts`

### `VEST-02` — ✔ fait · *gêne un lundi*

**La situation.** Un membre ouvre la fiche d'un coéquipier.

**Ce qu'on attend.** La photo cerclée de sa chasuble habituelle, « Blanc · Niveau 4 · gardien · 2e du tableau », quatre chiffres, la carte gardien s'il garde, les prochains paliers, forme / Élo / buts par match, ses derniers matchs cliquables, ses trophées, la saison par saison.

**Où ça en est.** Tout arrive assemblé pour l'app (sous-titre, libellés de paliers, dates courtes). Le rang et le sens de la forme ont été alignés des deux côtés (commentaires players/[id]/page.tsx:56-58,187-190).

> `app/c/[slug]/players/[id]/page.tsx ; five-scorer-mobile/app/joueur/[id].tsx, app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:19-193 ; lib/stats.ts:379-461,947-1066,1095-1160`

### `VEST-03` — ✔ fait · *gêne un lundi*

**La situation.** Le capitaine ajoute un joueur qui revient au club : nom, surnom, niveau, gardien, photo.

**Ce qu'on attend.** Un formulaire, une fiche créée, le joueur apparaît dans la liste ; il comptera au classement.

**Où ça en est.** Même écran pour l'ajout et l'édition des deux côtés. Niveau 3 et « pas gardien » par défaut. Vérifié par parcours-lecture.mjs:419-434.

> `RosterClient.tsx:211-236 + app/actions/roster.ts:44-57 ; five-scorer-mobile/app/joueur/fiche.tsx + app/api/clubs/[clubId]/joueurs/route.ts`

### `VEST-31` — ✔ fait · *gêne un lundi*

**La situation.** Un habitué règle « Vient tous les lundis » pour lui-même, depuis son canapé.

**Ce qu'on attend.** Un interrupteur sur sa fiche ; il est compté présent d'office, et peut toujours se déclarer absent sur une soirée.

**Où ça en est.** Bascule optimiste, retour en arrière et message si le serveur refuse, des deux côtés. Vérifié par parcours-lecture.mjs:227-245.

> `app/c/[slug]/players/[id]/Abonnement.tsx + actions/roster.ts:21-42 ; joueur/[id].tsx:333-395 + abonnement/route.ts ; lib/presences.ts:76-82`

### `VEST-32` — ✔ fait · *gêne un lundi*

**La situation.** Le capitaine abonne un habitué qui n'a pas de compte.

**Ce qu'on attend.** Le même interrupteur, visible pour l'admin, avec la phrase à la troisième personne.

**Où ça en est.** « Momo peut toujours se déclarer absent sur une soirée. »

> `players/[id]/page.tsx:176-184 ; joueurs/[playerId]/route.ts:110 (peutReglerAbonnement) ; actions/roster.ts:35 ; abonnement/route.ts:36`

### `VEST-22` — ⚠ faux · *gêne une saison*

**La situation.** Le même nouveau, mais son compte s'appelle « Kylian Mbappé » (ou « kmbappe » venu de Google) et la fiche « Kylian M. ».

**Ce qu'on attend.** Pouvoir dire « c'est moi » sur la bonne fiche, ou que le capitaine le rattache.

**Où ça en est.** Faute de correspondance, une fiche NEUVE liée est créée à son nom. Dès lors hasLinkedPlayer / aDejaUnProfil est vrai et « C'est moi » n'apparaît plus jamais. Résultat : deux Kylian au vestiaire, son historique sur l'autre, et aucun geste d'admin pour réparer (cf. VEST-27). Comme toute adhésion passe par ensureLinkedPlayer (club.ts:83,97) et que le créateur a d'office sa fiche (lib/auth.ts:108), « C'est moi » ne peut s'afficher pour personne d'entré normalement — le bouton n'est atteignable que par un membre délié (retrait puis retour) ou hérité de la v1.

> `app/actions/club.ts:52-56 ; app/c/[slug]/players/page.tsx:30 ; RosterClient.tsx:316 ; app/api/clubs/[clubId]/effectif/route.ts:48-52 ; effectif.tsx:183`

### `VEST-26` — ✗ absent · *gêne une saison*

**La situation.** Je me suis trompé : « C'est moi » sur la fiche de mon frère. Je veux revenir en arrière.

**Ce qu'on attend.** « Ce n'est pas moi » — délier ma fiche, seul ou avec l'admin.

**Où ça en est.** Aucune action ne remet userId à null sur demande. Une fois lié, la seule réparation est que l'admin retire le membre du club et le réinvite — et l'adhésion recréera peut-être une fiche neuve (VEST-22).

> `aucun (le seul déliement existant est le retrait du membre : app/actions/club.ts:191-199, membres/[memberId]/route.ts:82-88)`

### `VEST-27` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine veut rattacher lui-même la fiche « Momo » au compte de Mohamed, qui n'y arrive pas.

**Ce qu'on attend.** Un geste d'admin « rattacher à … » sur la fiche ou dans les membres.

**Où ça en est.** Le serveur sait le faire (lierJoueurAuCompte avec moi ≠ userId et peutGerer), mais aucune interface ne l'appelle. Le commentaire de la route mobile dit « Ce cas-là reste sur le site » : le site ne l'a pas non plus. C'est la seule issue possible au doublon de VEST-22, et elle n'existe pas.

> `app/actions/roster.ts:107-132 (accepte un userId tiers) ; RosterClient.tsx:319 (n'appelle qu'avec son propre userId) ; app/c/[slug]/settings/MembersTable.tsx:77-80 (affiche seulement « joueur X ») ; lier/route.ts:15-25`

### `VEST-40` — ✗ absent · *gêne une saison*

**La situation.** Un pote est venu jouer trois lundis de suite ; le capitaine veut qu'il entre au vestiaire avec ses matchs et ses buts.

**Ce qu'on attend.** « Faire entrer au vestiaire » : la fiche invitée devient une fiche normale, l'historique suit, il pourra la revendiquer.

**Où ça en est.** Aucun écran n'ôte isGuest — seul un PATCH brut le fait (parcours-lecture.mjs:478,489 s'en sert). Et un invité ne se revendique pas. Le capitaine crée donc une seconde fiche ; les matchs restent sur « Momo · invité », à jamais.

> `lib/roster-serveur.ts:51 (sanitize accepte isGuest) ; RosterClient.tsx:31-37,61-144 ; fiche.tsx:103-112 ; lib/roster-serveur.ts:102-104`

### `VEST-43` — ✗ absent · *gêne une saison*

**La situation.** Un membre veut mettre sa propre photo, changer son surnom ou corriger l'orthographe de son prénom.

**Ce qu'on attend.** Pouvoir le faire lui-même, sur sa fiche, sans passer par le capitaine.

**Où ça en est.** Toute modification de fiche est réservée aux admins. Quinze photos à prendre, c'est le capitaine qui les prend toutes — le cas de figure que le commentaire de setAbonnement (roster.ts:17-20) veut précisément éviter. Le niveau, lui, doit sans doute rester à l'admin.

> `app/actions/roster.ts:71 ; joueurs/[playerId]/route.ts:211 ; joueurs/[playerId]/route.ts:109 (peutModifier: canManage) ; players/[id]/page.tsx:80`

### `VEST-41` — ◐ partiel · *gêne une saison*

**La situation.** Le même invité revient un deuxième lundi ; on tape « + Invité » et son prénom.

**Ce qu'on attend.** Retrouver l'invité de la semaine dernière plutôt qu'en créer un second.

**Où ça en est.** « + Invité » crée toujours un nouvel id. L'invité précédent est bien dans la liste de la compo (le roster sert les invités, en fin de liste) et peut être coché, mais rien ne le propose ni ne signale l'homonyme : à la longue, trois « Momo · invité » aux stats éparpillées.

> `five-scorer-mobile/app/compo.tsx:214-224 ; lib/localMatch.ts:53-69 ; app/api/clubs/[clubId]/roster/route.ts:23-26`

### `VEST-59` — ◐ partiel · *gêne une saison*

**La situation.** Le membre retiré revient un an plus tard par le lien.

**Ce qu'on attend.** Il retrouve sa fiche.

**Où ça en est.** Seulement si le nom de son compte correspond encore au nom ou au surnom de la fiche déliée, non archivée. Si elle a été archivée entre-temps (isArchived: false dans le filtre), ou renommée, une fiche neuve est créée : retour à VEST-22.

> `app/actions/club.ts:37-51`

### `VEST-04` — ✔ fait · *gêne une saison*

**La situation.** Le capitaine corrige une fiche : un surnom, un niveau qui a monté, une nouvelle photo.

**Ce qu'on attend.** « Modifier » sur la fiche, le formulaire pré-rempli, enregistrer.

**Où ça en est.** Sur le site, « Modifier » renvoie vers l'effectif avec ?edit=<id> qui déplie le formulaire en place ; sur l'app, un écran à part. Vérifié par parcours-lecture.mjs:436-447.

> `players/[id]/page.tsx:80-86 → RosterClient.tsx:159-167,249-277 + actions/roster.ts:59-82 ; joueur/[id].tsx:78-94 → fiche.tsx:57-76,95-132 + joueurs/[playerId]/route.ts:201-251`

### `VEST-05` — ✔ fait · *gêne une saison*

**La situation.** Un joueur a déménagé : le capitaine le sort de la liste de ceux qui viennent lundi.

**Ce qu'on attend.** Archiver, pas supprimer : il sort de la liste, ses matchs et ses buts restent, on peut le réactiver.

**Où ça en est.** L'app demande confirmation avec la phrase qui dit la conséquence (fiche.tsx:139-141). Le site archive en un clic depuis le formulaire d'édition, sans confirmation (RosterClient.tsx:279-285).

> `RosterClient.tsx:278-286 + actions/roster.ts:84-104 ; fiche.tsx:134-159,315-324 + joueurs/[playerId]/route.ts:237-243`

### `VEST-06` — ✔ fait · *gêne une saison*

**La situation.** Le joueur archivé revient en septembre : on le réactive.

**Ce qu'on attend.** Un bouton « Réactiver » sous le repli des archivés ; il revient tel quel, avec son historique.

**Où ça en est.** Il revient avec son abonnement d'avant (abonne n'est pas touché par l'archivage). Vérifié par parcours-lecture.mjs:469-475.

> `RosterClient.tsx:359-369 ; effectif.tsx:96-113,208-210`

### `VEST-07` — ✔ fait · *gêne une saison*

**La situation.** Un simple membre tente d'ajouter, de modifier ou d'archiver un joueur (bouton masqué, ou requête rejouée).

**Ce qu'on attend.** Un refus clair, et rien d'écrit.

**Où ça en est.** « Réservé aux admins. » côté serveur des deux côtés ; les boutons sont masqués à l'affichage (canManage / peutGerer / peutModifier). Vérifié par parcours-lecture.mjs:494+ (« Qui n'a rien à y faire »).

> `actions/roster.ts:49,71,96 ; joueurs/route.ts:22-24 ; joueurs/[playerId]/route.ts:211-213 ; RosterClient.tsx:198,211 ; effectif.tsx:156 ; joueur/[id].tsx:81`

### `VEST-12` — ✔ fait · *gêne une saison*

**La situation.** Le capitaine choisit une photo dans la photothèque du téléphone (app).

**Ce qu'on attend.** Recadrage carré, image redressée, réduite, envoyée légère ; le visage s'affiche partout.

**Où ça en est.** L'éditeur système fait le recadrage (allowsEditing, aspect 1:1), applique l'orientation EXIF et décode le HEIC (choisir.ts:16-40) ; réduction à 256 px, boucle de qualité, nettoyage du cache et du bitmap natif (choisir.ts:119-127).

> `five-scorer-mobile/lib/photo/choisir.ts:42-73,87-128 ; lib/photo/contrat.ts ; fiche.tsx:82-93,193-230`

### `VEST-13` — ✔ fait · *gêne une saison*

**La situation.** Le capitaine prend la photo directement à l'appareil, au bord du terrain.

**Ce qu'on attend.** L'appareil s'ouvre, même chaîne que la photothèque.

**Où ça en est.** launchCameraAsync avec les mêmes options. Mais l'enregistrement exige le réseau (cf. VEST-41).

> `five-scorer-mobile/lib/photo/choisir.ts:45-60 ; fiche.tsx:215-220`

### `VEST-14` — ✔ fait · *gêne une saison*

**La situation.** Le capitaine ajoute une photo depuis le site (ordinateur ou navigateur du téléphone).

**Ce qu'on attend.** Choisir un fichier, aperçu, enregistrer.

**Où ça en est.** Réduction en carré centré de 256 px via canvas, JPEG 82 % (PhotoJoueur.tsx:14-27). accept="image/*" sans capture : sur mobile web, le système propose l'appareil.

> `components/ios/PhotoJoueur.tsx ; RosterClient.tsx:90`

### `VEST-21` — ✔ fait · *gêne une saison*

**La situation.** Un nouveau rejoint par le lien WhatsApp ; le capitaine avait déjà créé sa fiche « Kylian » et son compte s'appelle « Kylian ».

**Ce qu'on attend.** Il retrouve sa fiche et ses quinze matchs.

**Où ça en est.** ensureLinkedPlayer adopte la fiche libre, non invitée, non archivée dont le nom OU le surnom normalisé (accents, casse, espaces) égale le nom du compte.

> `app/actions/club.ts:28-51,83`

### `VEST-23` — ✔ fait · *gêne une saison*

**La situation.** Un membre sans profil (délié, ou hérité de la v1) tape « C'est moi » sur sa fiche.

**Ce qu'on attend.** Sa fiche et tout son historique se rattachent à son compte ; le point vert apparaît.

**Où ça en est.** L'app demande confirmation avec la phrase qui explique (« Ta fiche et tout son historique … »). Le site lie en un clic sans confirmation. La liaison met isGuest à false (roster-serveur.ts:133), mais un invité est refusé avant (cf. VEST-29).

> `RosterClient.tsx:311-326 + actions/roster.ts:107-132 ; effectif.tsx:71-94 + lier/route.ts ; lib/roster-serveur.ts:68-150`

### `VEST-08` — ⚠ faux · *confort*

**La situation.** Le capitaine ouvre la fiche d'un joueur ARCHIVÉ sur le site et tape « Modifier » pour corriger son nom avant de le réactiver.

**Ce qu'on attend.** Le formulaire s'ouvre, ou le bouton n'est pas là.

**Où ça en est.** « Modifier » s'affiche pour tout canManage, sans regarder isArchived ; il renvoie vers /players?edit=<id>, mais le formulaire ne se déplie que dans active.map (RosterClient.tsx:248) — pour un archivé, rien ne s'ouvre, sans un mot. Le même défaut que celui corrigé au commentaire :159-162, sur l'autre liste. L'app n'a pas le problème (fiche.tsx charge n'importe quel id) mais y propose « Archiver ce joueur » sur un joueur déjà archivé (fiche.tsx:315-324).

> `app/c/[slug]/players/[id]/page.tsx:80-86 ; RosterClient.tsx:248-249`

### `VEST-19` — ⚠ faux · *confort*

**La situation.** Un joueur sans photo, prénom seul (« Sofiane »).

**Ce qu'on attend.** Les mêmes initiales sur le site et sur l'app.

**Où ça en est.** Le site rend « SO » ; l'app rend « S » : Avatar recalcule à partir du nom (un mot → une lettre) et ignore le champ `initiales` que la route sert précisément « pour que Sofiane donne SO des deux côtés ». MenuClub.tsx:224-230 a bien recopié la règle du site, base.tsx non.

> `lib/ini.ts:2-8 ; components/ios/AvatarAnneau.tsx:32 ; app/api/clubs/[clubId]/effectif/route.ts:62-65 ; five-scorer-mobile/composants/base.tsx:97-102 ; effectif.tsx:252 ; joueur/[id].tsx:119`

### `VEST-39` — ⚠ faux · *confort*

**La situation.** L'app ouvre le formulaire d'édition mais la fiche n'a pas pu être chargée (réseau tombé, 404).

**Ce qu'on attend.** Ne pas pouvoir enregistrer par-dessus une fiche qu'on n'a pas vue.

**Où ça en est.** Le catch pose l'erreur, le finally met occupe à false, et le formulaire s'affiche avec des champs VIDES (nom « », niveau 3, pas gardien, photo null). Taper un nom et « Enregistrer » envoie PATCH {name, nickname:null, skill:3, isGk:false, photo:null} : la photo, le surnom et le niveau du joueur sont effacés.

> `five-scorer-mobile/app/joueur/fiche.tsx:57-76,95-132,187`

### `VEST-37` — ✗ absent · *confort*

**La situation.** Au gymnase, sans réseau, on veut consulter l'effectif ou une fiche (app).

**Ce qu'on attend.** Au moins la liste et les visages, qui sont déjà dans le miroir SQLite.

**Où ça en est.** Les deux écrans ne lisent que le serveur et affichent « Impossible de joindre … ». Le miroir local (rempli par la compo, avec les photos) n'est pas consulté par le vestiaire. Le site n'a pas de hors-ligne pour ces pages.

> `five-scorer-mobile/app/club/[id]/effectif.tsx:46-59 ; app/joueur/[id].tsx:45-60 ; lib/match/tables.ts:114-200 (miroir `roster`) ; app/compo.tsx:140-157 (le repli hors-ligne existe pour la compo)`

### `VEST-09` — ◐ partiel · *confort*

**La situation.** En modifiant une fiche sur le site, le capitaine efface le nom par mégarde et enregistre.

**Ce qu'on attend.** Un refus « Nom requis ».

**Où ça en est.** Seul l'attribut HTML `required` retient ; la server action updatePlayer laisse sanitize ignorer le nom vide, garde l'ancien et répond ok:true — le formulaire se ferme comme si c'était fait. L'API mobile, elle, refuse (joueurs/[playerId]/route.ts:230-234, vérifié par parcours-lecture.mjs:464-465).

> `RosterClient.tsx:94 (required) ; app/actions/roster.ts:76-79 ; lib/roster-serveur.ts:41-43`

### `VEST-10` — ◐ partiel · *confort*

**La situation.** Un nom de 70 caractères ou un surnom de 50 (« Le Roi de Guyancourt et de ses environs »).

**Ce qu'on attend.** Savoir qu'on est coupé, ou une limite visible.

**Où ça en est.** Tronqué à 60/40 en silence côté serveur ; aucun maxLength sur les champs, ni sur le site ni sur l'app.

> `lib/roster-serveur.ts:41,45 ; RosterClient.tsx:94,98 ; fiche.tsx:235-253`

### `VEST-16` — ◐ partiel · *confort*

**La situation.** La photo est refusée par le serveur (trop lourde, mauvais format).

**Ce qu'on attend.** Le savoir tout de suite, pas découvrir une fiche sans visage.

**Où ça en est.** App : refus AVANT le réseau (photoValide, boucle de qualité, « Photo trop lourde : … ») et lecture de `avertissement` avec retrait de la photo à l'écran. Site : la server action met la photo à null en silence et répond ok:true ; RosterClient ferme le formulaire et la photo a disparu sans un mot. Le composant web produit toujours un JPEG ≤ 200 k, donc le cas ne se voit qu'en forçant — mais rien ne le dirait. Vérifié côté API par parcours-lecture.mjs:452-462.

> `lib/roster-serveur.ts:52-54 ; joueurs/route.ts:34-49 ; joueurs/[playerId]/route.ts:235,245-250 ; fiche.tsx:118-126 ; contrat.ts:59-72 ; app/actions/roster.ts:50,78`

### `VEST-17` — ◐ partiel · *confort*

**La situation.** Photo d'iPhone (HEIC) ou photo prise en portrait : visage couché ou image illisible.

**Ce qu'on attend.** Le visage droit, quelle que soit la source.

**Où ça en est.** App : l'éditeur système redresse et transcode (fait, expliqué au commentaire). Site : createImageBitmap(fichier) sans option d'orientation, et un HEIC n'est pas décodé par Chrome/Firefox → « Cette image n'a pas pu être lue. » (PhotoJoueur.tsx:53). Non vérifié sur appareil — le test contrat.test.ts:9-11 le dit lui-même.

> `five-scorer-mobile/lib/photo/choisir.ts:16-40 ; components/ios/PhotoJoueur.tsx:15`

### `VEST-28` — ◐ partiel · *confort*

**La situation.** Un membre qui a déjà sa fiche rejoue la requête « C'est moi » sur une autre fiche libre.

**Ce qu'on attend.** Un refus : on n'a qu'un profil, on ne change pas de fiche en douce.

**Où ça en est.** Le serveur délie l'ancienne et lie la nouvelle sans refuser ; seul l'affichage masque le bouton. Un membre peut donc migrer son compte sur l'historique d'un autre joueur non revendiqué.

> `lib/roster-serveur.ts:116-135 ; RosterClient.tsx:316 ; effectif.tsx:183`

### `VEST-42` — ◐ partiel · *confort*

**La situation.** Au bout d'une saison, quinze invités d'un soir traînent dans la liste active du vestiaire.

**Ce qu'on attend.** Qu'ils n'encombrent pas ceux qui viennent lundi.

**Où ça en est.** Ils sont mêlés aux titulaires, triés par nom, marqués « · invité ». Seul remède : les archiver un par un (admin).

> `RosterClient.tsx:305 ; effectif.tsx:271 ; app/c/[slug]/players/page.tsx:24 ; effectif/route.ts:29`

### `VEST-54` — ◐ partiel · *confort*

**La situation.** Club neuf, vestiaire vide (à part le créateur).

**Ce qu'on attend.** Une phrase qui invite à ajouter les premiers joueurs.

**Où ça en est.** Site : « Personne dans le vestiaire pour l'instant. Ajoute tes premiers joueurs. » App : la carte n'est pas rendue et aucune phrase ne la remplace — seul le sous-titre « 0 joueur au vestiaire » reste. En pratique le créateur a toujours sa fiche (auth.ts:108), donc la liste n'est jamais tout à fait vide.

> `RosterClient.tsx:332-337 ; effectif.tsx:168,146`

### `VEST-55` — ◐ partiel · *confort*

**La situation.** Deux admins modifient la même fiche en même temps (l'un la photo, l'autre le niveau).

**Ce qu'on attend.** Ne rien perdre.

**Où ça en est.** Chaque formulaire renvoie tous ses champs (nom, surnom, niveau, gardien, photo) : le dernier enregistré écrase les cinq. Pas de version ni de détection de conflit. Rare au club.

> `app/actions/roster.ts:76-79 ; joueurs/[playerId]/route.ts:237-243 ; fiche.tsx:106-112`

### `VEST-62` — ◐ partiel · *confort*

**La situation.** L'archivage sur le site, en un clic, depuis le formulaire d'édition.

**Ce qu'on attend.** Une confirmation, comme sur l'app — l'archivage ne se voit pas tout de suite (le joueur passe sous un repli).

**Où ça en est.** Le site archive sans confirmation ; l'app demande « Archiver X ? » avec la conséquence. Réversible (VEST-06), donc peu grave.

> `RosterClient.tsx:278-286 ; fiche.tsx:139-158`

### `VEST-15` — ✔ fait · *confort*

**La situation.** L'accès aux photos ou à l'appareil est refusé sur le téléphone.

**Ce qu'on attend.** Une phrase qui dit quoi faire.

**Où ça en est.** « L'accès aux photos est refusé. Tu peux l'autoriser dans les Réglages. » (et sa variante appareil). Affiché en erreur sur la fiche.

> `five-scorer-mobile/lib/photo/choisir.ts:45-55 ; fiche.tsx:88-89`

### `VEST-18` — ✔ fait · *confort*

**La situation.** Retirer la photo d'un joueur qui ne veut plus y figurer.

**Ce qu'on attend.** Un bouton « Retirer », les initiales reviennent.

**Où ça en est.** Le null traverse sanitize et vide la colonne.

> `PhotoJoueur.tsx:87-96 ; fiche.tsx:221-228 ; lib/roster-serveur.ts:52-54 (photo: null)`

### `VEST-20` — ✔ fait · *confort*

**La situation.** Quelqu'un hors du club ouvre la vitrine publique /p/<slug>.

**Ce qu'on attend.** Ce que le club a choisi de montrer.

**Où ça en est.** Les photos des vingt premiers du classement sont servies sans authentification. Rien ne demande l'accord du joueur ni ne permet de masquer sa photo sur la vitrine seule. C'est une question de spec, pas un bug.

> `app/api/public/[slug]/route.ts:89-92 ; app/p/[slug]/page.tsx:126`

### `VEST-24` — ✔ fait · *confort*

**La situation.** Un membre tape « C'est moi » sur une fiche déjà prise par un coéquipier.

**Ce qu'on attend.** Un refus qui dit pourquoi.

**Où ça en est.** « Ce profil est déjà pris par un autre compte. » ; le bouton est masqué d'avance. Depuis l'app, même un admin est refusé (lier/route.ts:46-48).

> `lib/roster-serveur.ts:106-108 ; RosterClient.tsx:316 (!p.isLinked) ; effectif.tsx:183 (!j.compteLie)`

### `VEST-25` — ✔ fait · *confort*

**La situation.** Deux membres tapent « C'est moi » sur la même fiche à la même seconde.

**Ce qu'on attend.** Un seul la prend ; l'autre est prévenu.

**Où ça en est.** La transaction délie d'abord, puis n'écrit que si la fiche est encore libre ; sinon exception → rollback → « Ce profil vient d'être pris par un autre compte. » Le commentaire :110-113 raconte le bug précédent (déliement committé, profil perdu).

> `lib/roster-serveur.ts:110-147`

### `VEST-29` — ✔ fait · *confort*

**La situation.** « C'est moi » sur un invité.

**Ce qu'on attend.** Refus : un invité n'est pas une fiche à revendiquer.

**Où ça en est.** « Un invité ne peut pas être revendiqué. » Vérifié par parcours-lecture.mjs:477-482.

> `lib/roster-serveur.ts:102-104 ; RosterClient.tsx:316 (!p.isGuest) ; effectif.tsx:183 (!j.invite)`

### `VEST-30` — ✔ fait · *confort*

**La situation.** « C'est moi » sur un archivé.

**Ce qu'on attend.** Refus, ou réactiver d'abord.

**Où ça en est.** « Ce joueur est archivé. » côté serveur ; le bouton n'existe pas dans la liste des archivés.

> `lib/roster-serveur.ts:99-101 ; RosterClient.tsx:345-358 (pas de bouton) ; effectif.tsx:200-211 (pas de bouton)`

### `VEST-33` — ✔ fait · *confort*

**La situation.** Un membre essaie de régler l'abonnement d'un autre.

**Ce qu'on attend.** Refus.

**Où ça en est.** « Tu ne peux régler que ton propre abonnement. » / « Ce n'est pas ton profil. » ; interrupteur masqué à l'affichage.

> `actions/roster.ts:35-37 ; abonnement/route.ts:36-38 ; players/[id]/page.tsx:176 ; joueur/[id].tsx:197`

### `VEST-35` — ✔ fait · *confort*

**La situation.** Régler l'abonnement sans réseau (app).

**Ce qu'on attend.** Un refus explicite — c'est un réglage de canapé, pas de gymnase.

**Où ça en est.** Réseau exigé par choix (commentaire api.ts:586-588) ; l'interrupteur revient en arrière et affiche l'erreur. Le message est technique : « Impossible de joindre https://… — Network request failed ».

> `five-scorer-mobile/lib/api.ts:584-598 ; joueur/[id].tsx:358-370 ; lib/appel.ts:56-67`

### `VEST-44` — ✔ fait · *confort*

**La situation.** Tout le monde voit le niveau 1-5 de tout le monde (les étoiles du vestiaire, « Niveau 2 » en sous-titre).

**Ce qu'on attend.** À trancher : c'est un outil pour équilibrer les équipes, pas forcément une note publique.

**Où ça en est.** Le niveau est affiché à tous les membres, en étoiles et en clair. C'est un choix à confirmer avec le club.

> `RosterClient.tsx:301 ; effectif.tsx:267 ; players/[id]/page.tsx:68 ; joueurs/[playerId]/route.ts:80,102 (le chiffre est aussi la lettre de l'écusson)`

### `VEST-45` — ✔ fait · *confort*

**La situation.** Un gardien attitré (coché « gardien » sur sa fiche) ouvre sa fiche : pas de carte « Dans les buts ». Un joueur de champ qui a gardé une fois en a une.

**Ce qu'on attend.** Comprendre que la carte compte les matchs où il a réellement gardé.

**Où ça en est.** Par construction : la fiche ne fait que guider le générateur (« Le générateur d'équipes les sépare en premier ») ; les stats lisent isGk de la compo, matchs internes seulement. Cohérent des deux côtés, mais rien ne l'explique au joueur qui cherche sa carte.

> `lib/stats.ts:1072-1078,1106-1110 ; RosterClient.tsx:127 ; fiche.tsx:293`

### `VEST-46` — ✔ fait · *confort*

**La situation.** Un joueur décroche son 25e but un lundi ; on ouvre sa fiche.

**Ce qu'on attend.** Le trophée « 25 buts » daté de ce lundi, et le prochain palier « encore 25 buts pour 50 » avec sa barre.

**Où ça en est.** Les paliers sont recalculés à chaque lecture depuis les matchs terminés ; les dates viennent du match qui franchit le seuil. Le libellé « encore 1 but / 3 buts » est assemblé côté serveur pour l'app. Vérifié par parcours-lecture.mjs:219-222.

> `lib/stats.ts:947-1066 ; players/[id]/page.tsx:150-173,247-262 ; joueur/[id].tsx:163-194,279-297 ; joueurs/[playerId]/route.ts:143-162`

### `VEST-47` — ✔ fait · *confort*

**La situation.** Le joueur qui a tout dépassé (plus de 200 buts, 200 matchs, 100 victoires).

**Ce qu'on attend.** Plus de palier à proposer, la carte disparaît proprement.

**Où ça en est.** prochain() rend null quand aucun seuil n'est supérieur ; la carte n'est rendue que si paliers.length > 0.

> `lib/stats.ts:1041-1063 ; players/[id]/page.tsx:150 ; joueur/[id].tsx:163`

### `VEST-48` — ✔ fait · *confort*

**La situation.** Un match est corrigé après coup (spec 0001) : un but ajouté ou retiré.

**Ce qu'on attend.** La fiche, les trophées et les paliers bougent en conséquence.

**Où ça en est.** Rien n'est stocké : un but corrigé change la fiche à la lecture suivante. Un trophée peut donc « disparaître » si le but est retiré — c'est cohérent, mais personne n'en est prévenu.

> `lib/stats.ts:48-88 (tout est recalculé depuis les matchs FINISHED à chaque lecture)`

### `VEST-49` — ✔ fait · *confort*

**La situation.** Nouveau joueur, zéro match : sa fiche.

**Ce qu'on attend.** Une fiche qui existe déjà, avec ce qu'on sait de lui.

**Où ça en est.** « Aucun match joué pour l'instant. Ça se règle sur le terrain. » Le sous-titre garde le niveau, gardien, invité. Mais ni abonnement (VEST-34), ni saison par saison.

> `players/[id]/page.tsx:282-286 ; joueur/[id].tsx:319-325 ; joueurs/[playerId]/route.ts:112-133 (bilan: null)`

### `VEST-50` — ✔ fait · *confort*

**La situation.** Pas de saison active (entre juillet et septembre).

**Ce qu'on attend.** La fiche reste lisible.

**Où ça en est.** Chasuble habituelle et rang tombent sur toutes saisons (seasonId indéfini / null) des deux côtés ; le reste est déjà carrière.

> `players/[id]/page.tsx:34-47 ; joueurs/[playerId]/route.ts:30-54`

### `VEST-51` — ✔ fait · *confort*

**La situation.** Un joueur change de camp en cours de match ; on regarde sa fiche.

**Ce qu'on attend.** Le résultat, l'Élo et la chasuble habituelle comptés avec son équipe de départ.

**Où ça en est.** Tous les agrégats lisent initialTeam. Vérifié par parcours-lecture.mjs:112.

> `lib/stats.ts:30-39,206,447 ; players/[id]/page.tsx:45,52`

### `VEST-52` — ✔ fait · *confort*

**La situation.** Un id de joueur inventé, ou celui d'un joueur d'un autre club.

**Ce qu'on attend.** « Introuvable », sans confirmer que la fiche existe ailleurs.

**Où ça en est.** Vérifié par parcours-lecture.mjs:223-224.

> `joueurs/[playerId]/route.ts:27-28 (404) ; players/[id]/page.tsx:29 (notFound) ; lib/stats.ts:383-397 (filtre clubId)`

### `VEST-53` — ✔ fait · *confort*

**La situation.** Quelqu'un qui n'est pas membre du club ouvre l'effectif (site) ou appelle l'API (app).

**Ce qu'on attend.** Renvoyé vers l'adhésion / 404.

**Où ça en est.** Le site redirige, l'API répond « introuvable ».

> `lib/guard.ts:71-91 (redirect /onboarding) ; lib/guard.ts:94-109 (null → 404) ; effectif/route.ts:24`

### `VEST-56` — ✔ fait · *confort*

**La situation.** Changer d'avis en cours de saisie : annuler l'édition, quitter le formulaire après avoir choisi une photo.

**Ce qu'on attend.** Rien d'écrit, revenir sans bruit.

**Où ça en est.** Rien n'est envoyé avant « Enregistrer ». L'app ne demande pas confirmation en quittant un formulaire modifié — la photo choisie est perdue sans un mot, ce qui est acceptable.

> `RosterClient.tsx:273-276 ; fiche.tsx:174 (retour) ; PhotoJoueur.tsx (l'état vit dans le formulaire)`

### `VEST-57` — ✔ fait · *confort*

**La situation.** Le capitaine renomme « Momo » en « Mohamed » ; on ouvre un match de l'an dernier.

**Ce qu'on attend.** Le nouveau nom partout, l'historique intact.

**Où ça en est.** Rien n'est dénormalisé ; le miroir SQLite de l'app se rafraîchit à la prochaine compo en ligne (compo.tsx:123-124).

> `prisma/schema.prisma:203-243 (le nom vit sur Player, les matchs référencent l'id)`

### `VEST-58` — ✔ fait · *confort*

**La situation.** Le capitaine retire un membre du club (il a quitté le groupe WhatsApp).

**Ce qu'on attend.** Sa fiche joueur reste, déliée, avec son historique ; il ne peut plus se retirer lui-même par mégarde.

**Où ça en est.** Transaction : déliement puis suppression du membre. L'API refuse de se retirer soi-même (:75-80) ; le site ne s'en protège pas (commentaire :72-74).

> `app/actions/club.ts:182-201 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:50-90`

### `VEST-60` — ✔ fait · *confort*

**La situation.** La session a expiré pendant qu'on remplit une fiche.

**Ce qu'on attend.** Retour à la connexion, sans écran figé.

**Où ça en est.** 401 → SessionExpiree → /connexion sur l'app ; /session-expiree sur le site. La saisie en cours est perdue.

> `effectif.tsx:54 ; joueur/[id].tsx:55 ; fiche.tsx:71 ; lib/appel.ts:138 ; lib/guard.ts:31-35,86`

### `VEST-61` — ✔ fait · *confort*

**La situation.** Un appelant forge un identifiant (objet `{in:[…]}` au lieu d'une chaîne) sur une action de fiche.

**Ce qu'on attend.** Refus avant toute requête.

**Où ça en est.** « Identifiant invalide. » Le commentaire de ids.ts raconte l'incident réel (tous les profils libres revendiqués d'un coup).

> `lib/ids.ts:10-43 ; app/actions/roster.ts:26,66,91,116 ; joueurs/[playerId]/route.ts:206 ; lier/route.ts:35 ; abonnement/route.ts:21`

## La saison et les stats

*65 cas — 27 faits, 26 partiels, 5 absents, **7 faux**.*

### `STATS-01` — ✔ fait · *bloque un lundi*

**La situation.** Lundi soir, après le dernier match, un membre ouvre Stats pour voir où il en est dans la saison.

**Ce qu'on attend.** Le tableau de la saison en cours, aux points, avec MJ / V / N / D / B / PTS, chaque rangée menant à la fiche du joueur.

**Où ça en est.** Défaut = saison active (page.tsx:108, route.ts:62). Tri par lib/classement.ts:30-41. L'app reçoit rang et points déjà calculés.

> `site app/c/[slug]/stats/page.tsx:96-113, 341-349 + components/Classement.tsx:68-116 ; API app/api/clubs/[clubId]/stats/route.ts:165, 298-308 ; app app/club/[id]/stats.tsx:166-193`

### `STATS-12` — ✗ absent · *gêne un lundi*

**La situation.** Au gymnase, sans réseau, quelqu'un ouvre Stats sur l'app.

**Ce qu'on attend.** Au moins le dernier tableau vu, avec « hors-ligne » écrit dessus.

**Où ça en est.** Aucun cache. Première ouverture : spinner puis « Impossible de joindre https://… — Network request failed » en rouge, écran vide. Si des données étaient déjà chargées, elles restent affichées sous l'erreur (setD n'est pas vidé), sans dire qu'elles datent.

> `app app/club/[id]/stats.tsx:54-67, 131 ; lib/api.ts:880-883 ; lib/appel.ts:66-70`

### `STATS-13` — ◐ partiel · *gêne un lundi*

**La situation.** On vient de terminer un match sur l'app (file d'attente SQLite) et on ouvre Stats dans la foulée.

**Ce qu'on attend.** Le tableau reflète le match, ou dit qu'un match attend d'être envoyé.

**Où ça en est.** L'écran relit le serveur à chaque retour, mais tant que la file n'a pas drainé le match n'y est pas, et rien n'indique « 1 match en attente ». Le membre voit un tableau vieux d'un match sans le savoir.

> `app stats.tsx:73-78 (recharge au focus) ; lib/stats.ts:48-56 (FINISHED en base seulement)`

### `SAISON-11` — ✔ fait · *gêne un lundi*

**La situation.** Un membre ouvre l'écran Saison en octobre pour voir l'année.

**Ce qu'on attend.** Le calendrier groupé par mois : Jouée / En cours / Saisir / Répondre / Annulée / heure, les matchs extérieurs mêlés aux soirées, chaque rangée menant au bon endroit.

**Où ça en est.** Étiquettes et cibles calculées serveur ; « Saisir » ouvre la compo en mode « déjà joué » datée du bon lundi (saison.tsx:86-96).

> `site app/c/[slug]/saison/page.tsx:76-189, 232-256 ; API app/api/clubs/[clubId]/saison/route.ts:81-219 ; app app/club/[id]/saison.tsx:81-97, 179-239`

### `STATS-02` — ✔ fait · *gêne un lundi*

**La situation.** Le même membre bascule sur « Buteurs » puis sur « Forme ».

**Ce qu'on attend.** Buteurs du plus prolifique au moins, barre proportionnelle au meilleur ; forme = 5 dernières cases, la plus récente à droite, série signée (+3 / −2 / —).

**Où ça en est.** Part de la barre calculée serveur (route.ts:315). Forme inversée pour lire chronologiquement (page.tsx:46, route.ts:322).

> `site stats/page.tsx:238-244, 361-410 ; API stats/route.ts:166-169, 309-324 ; app stats.tsx:196-263`

### `SAISON-03` — ⚠ faux · *gêne une saison*

**La situation.** Personne n'a clôturé 2025-2026 en juillet. En septembre, le capitaine ouvre « Poser toute la saison », tape « Saison 2026-2027 », lundi 20 h, et pose 44 soirées.

**Ce qu'on attend.** Une saison 2026-2027, avec ses 44 lundis, et un tableau qui repart de zéro.

**Où ça en est.** poserCalendrier trouve la saison active (2025-2026), l'ÉTIRE jusqu'en juillet 2027 et y attache les 44 nouvelles soirées. Le nom tapé n'est lu qu'à la création d'une saison (calendrier-serveur.ts:101-106) : il est ignoré sans un mot. Ni le site ni l'app n'envoient de seasonId ni ne disent à quelle saison iront les dates. Résultat : le classement 2026-2027 se mélange à 2025-2026 sous l'étiquette « Saison 25–26 », toute l'année.

> `lib/calendrier-serveur.ts:75-99 ; site app/c/[slug]/saison/CalendrierForm.tsx:103-108 ; app app/calendrier.tsx:132-137 ; app/api/clubs/[clubId]/saison/calendrier/route.ts:39-45`

### `SAISON-13` — ⚠ faux · *gêne une saison*

**La situation.** Match saisi hors-ligne lundi soir sur l'app ; le téléphone ne synchronise que mercredi, après que le capitaine a ouvert la nouvelle saison mardi.

**Ce qu'on attend.** Le match compte dans la saison où il a été joué.

**Où ça en est.** La file d'attente ne porte pas la saison du coup d'envoi ; le serveur prend l'active du moment. Le dernier lundi de l'ancienne saison atterrit dans la nouvelle. Rare, mais exactement le scénario de la rentrée.

> `app/api/clubs/[clubId]/matches/route.ts:153-175 (saison active au moment de la synchro) ; five-scorer-mobile/lib/match/local.ts:108, 279 (seasonId jamais renseigné par app/compo.tsx) ; five-scorer-mobile/lib/outbox/types.ts:43`

### `ADV-03` — ✗ absent · *gêne une saison*

**La situation.** Un adversaire a été tapé avec une faute (« Urbain FC ») ou sous deux graphies (« Urban FC » / « urban fc ») ; le bilan se coupe en deux lignes.

**Ce qu'on attend.** Renommer ou fusionner l'adversaire, ou au moins le retirer.

**Où ça en est.** Aucun carnet d'adversaires : ils ne se listent que dans les formulaires de match. Pas de renommage, pas de fusion ; la suppression existe côté serveur mais aucun bouton ne l'appelle. L'unicité est sensible à la casse et aux accents.

> `app/actions/opponents.ts:16-20 (upsert sur le nom exact), 25-42 (deleteOpponent : aucun appelant dans app/ ni components/) ; prisma/schema.prisma:329`

### `CAL-06` — ✗ absent · *gêne une saison*

**La situation.** Mauvais jour coché (mardi), ou mauvaise heure : 44 soirées fausses viennent d'être créées.

**Ce qu'on attend.** Défaire d'un geste.

**Où ça en est.** Il faut annuler 44 soirées à la main, et elles restent au calendrier barrées. Rien ne supprime une soirée vide.

> `app/actions/calendrier.ts:43-62 (annulerSoiree, une par une) ; aucune suppression ni annulation en bloc ; lib/calendrier-serveur.ts:115-131 (reposer les lundis en crée 44 de plus, les mardis restent)`

### `DERBY-02` — ◐ partiel · *gêne une saison*

**La situation.** Un lundi, celui qui saisit met les Noirs en équipe A (ou nomme les équipes « Les vieux / Les jeunes » pour un soir).

**Ce qu'on attend.** Les victoires des Noirs restent aux Noirs ; le derby garde son titre « Blanc contre Noir ».

**Où ça en est.** Le derby compte par POSITION (A / B), pas par chasuble : rien en base ne dit que A = Blanc. Ce soir-là, les victoires de Noir vont à A. Et le titre de la carte prend les noms du DERNIER match : une soirée aux noms fantaisistes rebaptise le derby de toute la saison.

> `lib/stats.ts:849-853, 867-873 ; prisma/schema.prisma Match.teamAName/teamBName:369-370`

### `SAISON-01` — ◐ partiel · *gêne une saison*

**La situation.** Le capitaine ouvre la nouvelle saison depuis les réglages.

**Ce qu'on attend.** Savoir AVANT de cliquer que la saison en cours va se fermer, et que les matchs d'aujourd'hui comptent déjà dans la nouvelle.

**Où ça en est.** App : Alert « “Saison 2025-2026” sera clôturée : un club n'a jamais deux saisons ouvertes. » — fait. Site : un bouton « Créer » sans confirmation, l'effet de bord n'est écrit nulle part (le commentaire de la route API l'avoue).

> `site app/c/[slug]/settings/SeasonsCard.tsx:93-96, 120-123 ; app/actions/seasons.ts:17-26 ; API saisons/route.ts:9-12, 30-36 ; app app/club/[id]/reglages.tsx:356-366`

### `SAISON-02` — ◐ partiel · *gêne une saison*

**La situation.** Fin juillet, le capitaine clôture la saison.

**Ce qu'on attend.** Savoir que jusqu'à la prochaine ouverture, les matchs et soirées ne s'attacheront à rien ; pouvoir revenir en arrière.

**Où ça en est.** App : prévenu. Site : clic direct, rien d'écrit. Réactiver existe des deux côtés.

> `site SeasonsCard.tsx:67-72 (sans confirmation) ; app/actions/seasons.ts:31-50 ; app reglages.tsx:322-345 (Alert « Le club n'aura plus de saison en cours : … ne s'attacheront plus à rien. ») ; API saisons/[saisonId]/route.ts:55-59`

### `SAISON-04` — ◐ partiel · *gêne une saison*

**La situation.** Des matchs ont été joués pendant qu'aucune saison n'était ouverte (entre la clôture de juillet et l'ouverture de septembre, ou un club qui n'a jamais ouvert de saison).

**Ce qu'on attend.** Les retrouver, et les rattacher d'un geste à la bonne saison.

**Où ça en est.** Rien ne les liste comme orphelins. Le site permet de corriger un match à la fois dans son formulaire d'édition ; l'app ne le permet pas ; aucun rattachement en bloc « tous les matchs entre le 1/09 et le 31/07 → cette saison ».

> `lib/stats.ts:53 (seasonId null → visibles seulement sous « Toutes saisons ») ; app/actions/matches.ts:34, 62-66, 83 (updateMatchDetails accepte seasonId, match par match, site seulement) ; app/actions/seasons.ts:64-73 (réactiver ne les récupère pas)`

### `SAISON-07` — ◐ partiel · *gêne une saison*

**La situation.** En juin, le capitaine ouvre « Saison 2026-2027 » pour préparer la rentrée.

**Ce qu'on attend.** Que la nouvelle saison commence le 1er septembre, et que les lundis de juin-juillet restent dans l'ancienne.

**Où ça en est.** Ouvrir, c'est ouvrir MAINTENANT : les matchs de juin comptent dans 2026-2027. Pas de date de début à venir, pas de bascule programmée. L'app prévient de la clôture, pas de ce déplacement des matchs à venir.

> `app/actions/seasons.ts:17-26 (startsAt = now, endsAt de l'ancienne = now) ; app/api/clubs/[clubId]/saisons/route.ts:30-36`

### `SAISON-08` — ◐ partiel · *gêne une saison*

**La situation.** Deux admins ouvrent la saison en même temps, ou le capitaine double-clique « Créer ».

**Ce qu'on attend.** Une seule saison « Saison 2026-2027 ».

**Où ça en est.** Chaque appel ferme les actives puis crée : on obtient deux saisons du même nom, la première close deux secondes après sa naissance. Aucune garde sur un nom déjà pris ; les libellés « Saison 26–27 » se répètent dans le sélecteur et les clés React du palmarès (PALM-03) se doublonnent. Le site n'a que isPending contre le double-clic ; l'app a l'Alert.

> `app/actions/seasons.ts:17-26 ; app/api/clubs/[clubId]/saisons/route.ts:30-36 ; site SeasonsCard.tsx:31-41 (isPending) ; app reglages.tsx:356-366 (Alert)`

### `SAISON-12` — ◐ partiel · *gêne une saison*

**La situation.** Une soirée d'il y a six mois n'a jamais été saisie ; on veut la rattraper aujourd'hui.

**Ce qu'on attend.** Pouvoir la saisir, et que le match tombe dans la saison de SA DATE.

**Où ça en est.** « Saisir » disparaît après 42 jours (voulu). En passant par « Composer » avec une date manuelle, le match s'attache à la saison ACTIVE, pas à celle qui couvre sa date ; s'il est de la saison précédente, il gonfle la nouvelle. L'app n'envoie jamais de saison : c'est la saison active au moment de la synchro.

> `saison/page.tsx:114 et API saison/route.ts:127 (42 jours) ; site app/c/[slug]/matches/new/page.tsx:103 et app/api/clubs/[clubId]/matches/route.ts:153-175 (saison active) ; app app/compo.tsx (aucun seasonId envoyé) → five-scorer-mobile/lib/match/local.ts:279`

### `STATS-08` — ◐ partiel · *gêne une saison*

**La situation.** Un invité d'un soir met 5 buts ; ou un joueur archivé (parti du club) revient dans le tableau.

**Ce qu'on attend.** À trancher : l'invité marqué « (inv.) » au tableau, mais doit-il pouvoir coiffer le « Meilleur buteur » de la saison ? L'archivé doit-il rester dans le tableau de la saison en cours ?

**Où ça en est.** Tout le monde est dans le tableau et éligible au palmarès. Rien ne permet d'exclure les invités ou les archivés d'une période ; seul le « (inv.) » les signale.

> `lib/stats.ts:140-143 (aucun filtre isGuest / isArchived), 334 ; components/Classement.tsx:90-92 ; API stats/route.ts:301`

### `STATS-09` — ◐ partiel · *gêne une saison*

**La situation.** Le capitaine change le barème (victoire 2 pts) dans les réglages en cours de saison.

**Ce qu'on attend.** À trancher : le nouveau barème ne devrait pas réécrire le tableau des saisons déjà clôturées et commentées.

**Où ça en est.** Les points sont calculés à la lecture avec club.pointsWin / pointsDraw du moment : un changement rejoue toute l'histoire, y compris les saisons clôturées. Aucun barème figé par saison.

> `lib/classement.ts:17-23 ; stats/page.tsx:117, 244, 346-347 ; saison/page.tsx:205`

### `CAL-01` — ✔ fait · *gêne une saison*

**La situation.** Septembre : le capitaine pose tous les lundis à 20 h jusqu'en juillet, à Urban Soccer.

**Ce qu'on attend.** La liste des dates avant de créer, fériés et trêve retirés avec leur motif, chaque date rétablissable ; puis 44 soirées en place, une saison ouverte s'il n'y en avait pas.

**Où ça en est.** Dates calculées sur l'appareil de la personne (son fuseau), envoyées en ISO. Lieu par défaut = celui de la dernière soirée. Mais voir SAISON-03 pour ce qui se passe si une saison est déjà active.

> `lib/calendrier.ts:97-151 ; lib/calendrier-serveur.ts:41-151 ; site app/c/[slug]/saison/CalendrierForm.tsx ; app app/calendrier.tsx ; five-scorer-mobile/lib/calendrier.ts (copie octet pour octet, testée lib/calendrier.test.ts:28-32)`

### `CAL-04` — ✔ fait · *gêne une saison*

**La situation.** En janvier, l'admin relance la pose pour ajouter trois lundis, ou après avoir annulé une soirée.

**Ce qu'on attend.** Rien en double, les compos préparées intactes, la soirée annulée reste annulée.

**Où ça en est.** Idempotence par jour civil ; la saison active s'étire aux nouvelles bornes.

> `lib/calendrier-serveur.ts:36-40, 87-99, 115-131 (aucun filtre canceledAt : l'annulée est « prise » donc laissée)`

### `DERBY-01` — ✔ fait · *gêne une saison*

**La situation.** Blanc contre Noir : combien de victoires chacun sur la saison, combien de soirées gagnées, la série en cours.

**Ce qu'on attend.** La carte du derby avec la jauge, buts marqués, soirées gagnées / partagées, la phrase de série.

**Où ça en est.** Une soirée revient à qui y gagne le plus de matchs, sinon partagée. La série s'arrête au premier nul.

> `lib/stats.ts:843-901 ; site stats/Derby.tsx ; API stats/route.ts:345-373 ; app stats.tsx:313-372`

### `GARD-01` — ✔ fait · *gêne une saison*

**La situation.** Le gardien attitré veut ses chiffres : encaissés, moyenne, matchs sans encaisser, % de victoires quand il garde.

**Ce qu'on attend.** La carte « Les gardiens », site et app.

**Où ça en est.** Lit isGk des compos, matchs internes seulement, encaissé = buts de l'autre camp (un CSC est déjà du bon côté du score, stats.ts:1129-1131).

> `lib/stats.ts:1095-1160 ; site stats/Gardiens.tsx ; API stats/route.ts:374-385 ; app stats.tsx:374-412`

### `PALM-01` — ✔ fait · *gêne une saison*

**La situation.** La saison est clôturée ; le club veut son palmarès complet pour le WhatsApp de fin d'année.

**Ce qu'on attend.** Homme du match, meilleur buteur, meilleur passeur (si comptés), meilleur %V, Élo le plus haut, l'inoxydable — chacun menant à la fiche.

**Où ça en est.** %V exige 5 matchs (stats.ts:339) ; Élo sauté si personne n'a bougé (330, 341) ; un titre à 0 n'apparaît pas (324).

> `lib/stats.ts:304-343 ; site stats/page.tsx:141-147, 421-492 ; API stats/route.ts:98-101, 123-152 ; app stats.tsx:266-292`

### `STATS-03` — ✔ fait · *gêne une saison*

**La situation.** Un membre veut revoir le tableau de l'an dernier, ou de toujours.

**Ce qu'on attend.** Choisir une saison ou « Toutes saisons », et retrouver le même écran.

**Où ça en est.** Sur l'app la pilule n'apparaît que s'il y a plus d'un choix (stats.tsx:107) — « Toutes saisons » compte pour un, donc dès la première saison.

> `site stats/page.tsx:157-161, 248-275 (?saison=) ; app stats.tsx:107-123, 505-542 (feuille par le bas)`

### `STATS-06` — ✔ fait · *gêne une saison*

**La situation.** Un joueur a changé de camp en cours de match (blessure, rééquilibrage à 6-1).

**Ce qu'on attend.** Sa victoire, son Élo et ses buts restent dans l'équipe où il a commencé.

**Où ça en est.** Tous les agrégats lisent initialTeam ; le commentaire du schéma raconte le bug corrigé.

> `lib/stats.ts:30-33, 154-158, 206, 447, 988, 1131 ; prisma/schema.prisma MatchParticipant.initialTeam:398-404`

### `ADV-04` — ⚠ faux · *confort*

**La situation.** Un adversaire est supprimé (en base, ou par un futur bouton) alors qu'on a joué contre lui.

**Ce qu'on attend.** Ses matchs restent et continuent de compter sous son nom.

**Où ça en est.** Les matchs survivent (SetNull), mais divergent : sur Stats ils sortent du face-à-face tout en restant dans les totaux ; sur Saison ils restent sous teamBName. Les deux écrans ne disent plus la même chose.

> `lib/stats.ts:520-541 (if m.opponentId) ; app/c/[slug]/saison/page.tsx:196 (m.opponent?.name ?? m.teamBName) ; prisma Match.opponentId onDelete: SetNull:362`

### `DERBY-03` — ⚠ faux · *confort*

**La situation.** On compare le derby des Stats et la ligne « Blanc contre Noir » de l'onglet Bilan de Saison.

**Ce qu'on attend.** Le même bilan, les mêmes noms.

**Où ça en est.** Le Bilan prend les noms du PREMIER match (le commentaire promet « la majorité », le code fait internes[0]) ; le derby ceux du DERNIER. Deux règles pour la même chose, et le commentaire ment.

> `app/c/[slug]/saison/page.tsx:223-225 ; app/api/clubs/[clubId]/saison/route.ts:272-273 ; lib/stats.ts:849-851`

### `EXP-02` — ⚠ faux · *confort*

**La situation.** Le CSV « classement » est ouvert dans Excel.

**Ce qu'on attend.** Le même tableau que l'écran : dans l'ordre des points, avec la colonne PTS.

**Où ça en est.** getLeaderboard rend les lignes triées aux BUTS, et l'export n'a pas de colonne points (J, V, N, D, %V, Buts, Passes, CSC, Jaunes, Rouges, MVP, Élo). Le fichier appelé « classement » n'est pas le classement du club. Nom de fichier avec l'identifiant technique de la saison, pas son nom (route.ts:56).

> `app/api/clubs/[clubId]/export/route.ts:59-94 ; lib/stats.ts:269-275`

### `REC-03` — ⚠ faux · *confort*

**La situation.** Le « Plus gros score » de l'onglet Bilan (Saison) et « Le match le plus fou » (Stats) ne montrent pas le même match.

**Ce qu'on attend.** Une seule réponse à « le match le plus fou de la saison ».

**Où ça en est.** Le Bilan inclut les matchs contre l'extérieur, les Records les excluent. Un 9-8 contre un autre club est « plus gros score » ici et invisible là.

> `app/c/[slug]/saison/page.tsx:220 ; app/api/clubs/[clubId]/saison/route.ts:269 ; lib/stats.ts:668`

### `SAISON-14` — ⚠ faux · *confort*

**La situation.** Sous-titre de l'écran Saison : « 3 soirées jouées · 44 au calendrier » alors que 4 soirées sont annulées.

**Ce qu'on attend.** Ne pas compter les soirées annulées comme « au calendrier », ou le dire.

**Où ça en est.** soirees.length inclut les annulées.

> `app/c/[slug]/saison/page.tsx:227-230 (soirees.length) ; app/api/clubs/[clubId]/saison/route.ts:305-308`

### `SAISON-06` — ✗ absent · *confort*

**La situation.** Faute de frappe dans le nom (« Saison 2026-2072 ») ; le sélecteur affiche « Saison 26–72 » toute l'année.

**Ce qu'on attend.** Renommer la saison.

**Où ça en est.** Aucune action ni route ne modifie Season.name, ni startsAt / endsAt. Le nom est gravé à la création.

> `app/actions/seasons.ts (createSeason / closeSeason / reopenSeason seulement) ; app/api/clubs/[clubId]/saisons/* (POST / PATCH active) ; app reglages.tsx:274-382`

### `SAISON-09` — ✗ absent · *confort*

**La situation.** Une saison a été créée par erreur (doublon, test) et on veut s'en débarrasser.

**Ce qu'on attend.** La supprimer ou la masquer.

**Où ça en est.** Rien ne supprime (doctrine « rien ne s'efface »), mais rien ne masque non plus : la saison vide reste dans le sélecteur pour toujours et s'affiche « Saison sans relief » dans le palmarès.

> `app/actions/seasons.ts ; app/api/clubs/[clubId]/saisons/* ; prisma/schema.prisma Season:248-263 (cascade sur le club seulement)`

### `ADV-02` — ◐ partiel · *confort*

**La situation.** Programmer un match contre un club extérieur, en créant l'adversaire à la volée.

**Ce qu'on attend.** Le faire depuis le site ou l'app.

**Où ça en est.** Site : fait (canScore ; « Choisis l'équipe adverse. », « Adversaire introuvable. »). App : non porté, assumé en commentaire (« ce club-ci joue contre lui-même tous les lundis »).

> `site app/c/[slug]/matches/schedule/ScheduleMatchForm.tsx:51,74 + app/actions/schedule.ts:12-87 + app/actions/opponents.ts:8-23 ; app app/club/[id]/saison.tsx:250-253`

### `ADV-05` — ◐ partiel · *confort*

**La situation.** Onglet Adversaires : un club rencontré une fois et vainqueur est classé 1er devant nous, qui avons joué dix fois.

**Ce qu'on attend.** À trancher : ce tableau « en poule » a-t-il un sens pour un club qui n'est dans aucune poule ?

**Où ça en est.** Le club et chaque adversaire sont triés aux points puis à la différence de buts, comme un championnat. Fonctionne, mais raconte une compétition qui n'existe pas.

> `app/c/[slug]/saison/page.tsx:205-209 ; app/api/clubs/[clubId]/saison/route.ts:249-254`

### `CAL-02` — ◐ partiel · *confort*

**La situation.** Urban Soccer est ouvert le lundi de Pâques et de Pentecôte, le club y joue.

**Ce qu'on attend.** Dire une fois « on joue les fériés ».

**Où ça en est.** Chaque férié se rétablit d'un tap, un par un ; l'option globale existe dans le générateur mais aucun écran ne l'expose.

> `lib/calendrier.ts:93 (sauterFeries existe) ; CalendrierForm.tsx:68-74 et app/calendrier.tsx:100-108 (jamais passé)`

### `CAL-03` — ◐ partiel · *confort*

**La situation.** La vraie trêve du club, c'est les deux semaines de vacances scolaires ; et on saute aussi la Toussaint et février.

**Ce qu'on attend.** Une trêve à la main du club, pas une règle fixe.

**Où ça en est.** La règle est courte et récitable, assumée en commentaire ; le reste se retire date par date. Pas de zones scolaires, pas de plages à retirer d'un bloc.

> `lib/calendrier.ts:68-75 (24/12 → 1/01 inclus, « volontairement étroit »)`

### `CAL-05` — ◐ partiel · *confort*

**La situation.** Après « Poser 44 soirées », l'admin veut savoir ce qui s'est vraiment passé.

**Ce qu'on attend.** « 41 créées, 3 déjà présentes ».

**Où ça en est.** Le serveur compte, personne ne le montre. En cas de SAISON-03, c'est aussi là qu'on aurait pu dire « attachées à Saison 2025-2026 ».

> `lib/calendrier-serveur.ts:143-150 (crees / ignores renvoyés) ; site CalendrierForm.tsx:109-117 (router.push + refresh, rien affiché) ; app calendrier.tsx:138-143 (router.back())`

### `CAL-07` — ◐ partiel · *confort*

**La situation.** L'admin retire toutes les dates, ou étire « Du / Au » sur trois ans.

**Ce qu'on attend.** Un message clair dans les deux cas.

**Où ça en est.** Zéro : fait. Trop : le générateur s'arrête à 120 occurrences sans le dire — la liste finit avant « Au » et l'utilisateur ne voit pas les lundis manquants ; le message serveur ne peut jamais se produire depuis l'écran.

> `CalendrierForm.tsx:98-100, 263 et app/calendrier.tsx:128, 348 (« Aucune date retenue. », bouton grisé) ; lib/calendrier-serveur.ts:57-60 (« Aucune date à créer. », « Trop de dates (N). ») ; lib/calendrier.ts:118-120 (plafond 120 silencieux)`

### `CAL-11` — ◐ partiel · *confort*

**La situation.** Deux admins posent le calendrier au même instant.

**Ce qu'on attend.** Pas deux soirées le même lundi.

**Où ça en est.** Deux transactions peuvent lire zéro soirée existante et créer chacune les leurs : doublons possibles, rien en base ne l'interdit. Improbable, mais irrattrapable ensuite (CAL-06).

> `lib/calendrier-serveur.ts:65-148 (transaction sans verrou, lecture « existantes » puis createMany) ; prisma/schema.prisma MatchDay:294 (index, pas d'unicité clubId + jour)`

### `CAL-12` — ◐ partiel · *confort*

**La situation.** Mi-juillet, le capitaine veut déjà préparer septembre.

**Ce qu'on attend.** Le formulaire propose la saison à venir.

**Où ça en est.** En juillet il propose les derniers lundis de juillet ; il faut déplacer « Du / Au » à la main. Voulu par le commentaire (« jamais dans le passé »), mais contre l'usage de fin de saison.

> `lib/calendrier.ts:143-149 (juillet → saison qui finit ; août → la suivante)`

### `CAL-13` — ◐ partiel · *confort*

**La situation.** Une soirée créée à la main à 00 h 30 (heure de Paris) et le calendrier reposé le même jour.

**Ce qu'on attend.** Pas de doublon.

**Où ça en est.** Le commentaire dit « le jour du serveur et non UTC », mais le serveur EST en UTC : 00 h 30 Paris = 22 h 30 UTC la veille, l'anti-doublon regarde le mauvais jour. Sans effet à 20 h.

> `lib/calendrier-serveur.ts:153-170 (clé = jour du SERVEUR ; sur Vercel = UTC)`

### `EXP-01` — ◐ partiel · *confort*

**La situation.** Fin de saison, le capitaine veut le classement dans un tableur ou sur WhatsApp.

**Ce qu'on attend.** Exporter en CSV depuis le site ET depuis le téléphone.

**Où ça en est.** Site : lien « Exporter en CSV » sous le tableau, pour la période choisie. App : rien.

> `site stats/page.tsx:246, 350-352 ; app/api/clubs/[clubId]/export/route.ts:58-95 ; app : aucune fonction dans five-scorer-mobile/lib/api.ts, lib/appel.ts:118-119 (« le CSV de export, un jour »)`

### `EXP-03` — ◐ partiel · *confort*

**La situation.** Exporter la liste des matchs de la saison.

**Ce qu'on attend.** Un lien quelque part.

**Où ça en est.** La route existe et marche ; aucun écran ne la propose.

> `app/api/clubs/[clubId]/export/route.ts:97-126 (type=matches) ; aucun appelant hors export/route.ts`

### `SAISON-05` — ◐ partiel · *confort*

**La situation.** Le capitaine a clôturé par erreur ; il réactive la saison.

**Ce qu'on attend.** La saison redevient active, sa date de fin s'efface, l'autre active (s'il y en avait une) se ferme.

**Où ça en est.** Fait des deux côtés. Mais sur le site, réactiver un identifiant inexistant renvoie « ok » (seasons.ts:69-75 sans contrôle de count), là où l'API répond « Saison introuvable. » (route.ts:38-42, qui documente l'écart).

> `app/actions/seasons.ts:52-76 ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts:35-54 ; app reglages.tsx:324-331`

### `SAISON-16` — ◐ partiel · *confort*

**La situation.** L'admin regarde une saison clôturée dont le calendrier est vide, et clique « Poser toute la saison » depuis là.

**Ce qu'on attend.** Les soirées vont dans la saison qu'il regarde.

**Où ça en est.** Les dates vont à la saison ACTIVE, quelle que soit celle affichée. Le serveur sait rattacher à une saison donnée ; aucun écran ne le lui demande ni ne prévient.

> `site CalendrierForm.tsx:103-108 (pas de seasonId) ; app calendrier.tsx:132-137 ; lib/calendrier-serveur.ts:24, 66-73 (seasonId accepté, aucun client ne l'envoie)`

### `STATS-05` — ◐ partiel · *confort*

**La situation.** Le club n'a encore aucun match terminé (club neuf, ou saison choisie vide).

**Ce qu'on attend.** Une feuille vierge reconnaissable, pas une erreur ; un raccourci « Lancer le premier » pour qui peut saisir.

**Où ça en est.** Site : squelette + lien vers matches/new. App : squelette + « Aucun match terminé sur cette période. » sans raccourci, alors que l'API lui envoie peutScorer (stats.tsx:154-156 ne s'en sert pas).

> `site stats/page.tsx:284-328 ; API stats/route.ts:297 (droits.peutScorer) ; app stats.tsx:136-158`

### `STATS-10` — ◐ partiel · *confort*

**La situation.** Un membre cherche son Élo et sa tendance.

**Ce qu'on attend.** Le voir quelque part, et comprendre s'il vaut pour la saison ou pour toujours.

**Où ça en est.** L'Élo n'est ni sur le tableau (9 colonnes) ni sur l'écran Stats, site ou app ; il vit sur la fiche joueur, dans le CSV et dans le palmarès d'une saison clôturée. Sur une saison il repart de 1000 (fold sur le scope, stats.ts:149-163) sans que l'écran le dise.

> `lib/stats.ts:242-251 ; components/Classement.tsx:5-12 ; site app/c/[slug]/players/[id]/page.tsx:206-208 ; export/route.ts:74,91`

### `STATS-14` — ◐ partiel · *confort*

**La situation.** Un membre retiré du club ouvre Stats depuis un lien gardé.

**Ce qu'on attend.** Un refus clair.

**Où ça en est.** Site : redirection vers /onboarding. App : 404 « introuvable » rendu tel quel « Le serveur a répondu 404 — introuvable » — juste, mais pas dans les mots du club.

> `lib/guard.ts:88 (site) ; app/api/clubs/[clubId]/stats/route.ts:42-43 ; app lib/appel.ts:40-49`

### `ADV-01` — ✔ fait · *confort*

**La situation.** Le club a joué quelques matchs contre d'autres clubs cette saison.

**Ce qu'on attend.** Le bilan V/N/D, buts pour/contre, points et forme, puis le face-à-face par adversaire ; et l'onglet Adversaires de la Saison.

**Où ça en est.** Cartes cachées tant qu'aucun match externe n'est terminé.

> `lib/stats.ts:488-547 ; site stats/page.tsx:555-617 et saison/page.tsx:191-209, 275-317 ; API stats/route.ts:395-417 et saison/route.ts:221-254 ; app stats.tsx:456-497 et saison.tsx:276-324`

### `CAL-08` — ✔ fait · *confort*

**La situation.** Nom de saison vide ou d'une lettre.

**Ce qu'on attend.** Refus.

**Où ça en est.** Mais ignoré de fait si une saison est active (SAISON-03) : on peut poser sous un nom vide, puisqu'il ne sert pas.

> `lib/calendrier-serveur.ts:45-46 (« Nom de saison trop court. »)`

### `CAL-09` — ✔ fait · *confort*

**La situation.** Un membre non admin cherche à poser la saison.

**Ce qu'on attend.** Bouton absent, et refus serveur si on force.

**Où ça en est.** Double garde, message dans les mots du club.

> `site saison/page.tsx:267-271 (canManage) ; app saison.tsx:256-272 (peutGerer) ; app/actions/calendrier.ts:31-32 ; API saison/calendrier/route.ts:20-22 (403 « Réservé aux admins. »)`

### `CAL-10` — ✔ fait · *confort*

**La situation.** Pas de réseau au moment de poser depuis l'app.

**Ce qu'on attend.** Une erreur nette ; rien n'est mis en attente (c'est un geste au chaud).

**Où ça en est.** « Impossible de joindre https://… » sous la liste, le bouton se réactive. Choix assumé en commentaire (creerSoiree / poserCalendrier exigent le réseau).

> `five-scorer-mobile/lib/api.ts:960-973 ; app/calendrier.tsx:144-147 ; lib/appel.ts:66-70`

### `EXP-04` — ✔ fait · *confort*

**La situation.** Un membre a nommé son équipe « =WEBSERVICE(…) » ; l'admin ouvre l'export.

**Ce qu'on attend.** Le tableur n'exécute rien.

**Où ça en est.** Premier caractère neutralisé par une apostrophe, cellules quotées.

> `app/api/clubs/[clubId]/export/route.ts:9-25`

### `EXP-05` — ✔ fait · *confort*

**La situation.** Quelqu'un forge l'URL d'export avec l'identifiant d'une saison d'un autre club, ou sans être membre.

**Ce qu'on attend.** Rien ne fuit.

**Où ça en est.** Pas de fuite ; on obtient un fichier vide plutôt qu'un message.

> `app/api/clubs/[clubId]/export/route.ts:47-50 (401) ; lib/stats.ts:50-53 (filtré par clubId ET seasonId → CSV vide)`

### `GARD-02` — ✔ fait · *confort*

**La situation.** Un joueur a mis les gants une seule fois et pris un but ; le régulier en prend 1,8 par match.

**Ce qu'on attend.** Le régulier reste devant : une moyenne sur un match n'est pas une moyenne.

**Où ça en est.** Réguliers classés entre eux, dépanneurs après, la colonne MJ explique.

> `lib/stats.ts:1147-1157 (REGULIER = 3)`

### `PALM-02` — ✔ fait · *confort*

**La situation.** Saison en cours : on regarde qui mène.

**Ce qu'on attend.** Le podium de la période : homme du match, meilleur buteur, meilleur passeur si le club compte les passes.

**Où ça en est.** Volontairement réduit à trois titres tant que la saison est ouverte.

> `site stats/page.tsx:163-211, 494-513 ; API stats/route.ts:109-111, 153-163`

### `PALM-03` — ✔ fait · *confort*

**La situation.** « Toutes saisons » : on veut la liste des saisons finies et leurs lauréats.

**Ce qu'on attend.** Un bandeau par saison clôturée : meilleur buteur et homme du match, ou « Saison sans relief ».

**Où ça en est.** Clé React = nom de saison (page.tsx:520, stats.tsx:298) : deux saisons du même nom (cf. SAISON-08) se télescopent à l'affichage.

> `site stats/page.tsx:148-155, 517-540 ; API stats/route.ts:102-107, 333-344 ; app stats.tsx:294-311`

### `REC-01` — ✔ fait · *confort*

**La situation.** En se rhabillant : « c'était quoi la plus grosse fessée ? qui a mis quatre buts ? avec qui je gagne ? »

**Ce qu'on attend.** Les records du club, chacun renvoyant au match, à la soirée ou à la fiche ; « ça va bouger vite » tant qu'il y a peu de matchs.

**Où ça en est.** Huit records, seuils en règle 17 ; pas de ligne vide.

> `lib/stats.ts:656-813 ; site stats/Records.tsx ; API stats/route.ts:179-286, 386-394 ; app stats.tsx:414-454`

### `REC-02` — ✔ fait · *confort*

**La situation.** Le carton d'un soir a été fait dans un match saisi après coup, non rattaché à une soirée.

**Ce qu'on attend.** Le carton compte ; les records « de soirée » l'ignorent faute de soirée.

**Où ça en est.** Comportement cohérent avec la donnée ; rien ne le signale à l'utilisateur.

> `lib/stats.ts:697, 717-727 (matchDayId null → pas de soirée)`

### `SAISON-10` — ✔ fait · *confort*

**La situation.** Un membre (pas admin) essaie d'ouvrir, clôturer ou réactiver une saison.

**Ce qu'on attend.** Un refus explicite.

**Où ça en est.** Garde serveur des deux côtés, message dans les mots du club.

> `app/actions/seasons.ts:13, 42, 63 (« Réservé aux admins. ») ; API saisons/route.ts:20-22 et saisons/[saisonId]/route.ts:26-28 (403) ; app reglages.tsx:44-47 (écran réservé à qui gère)`

### `SAISON-15` — ✔ fait · *confort*

**La situation.** Onglet Bilan de la saison.

**Ce qu'on attend.** Soirées / matchs / buts, Blanc contre Noir, contre les autres clubs, plus gros score, coût du terrain par soirée.

**Où ça en est.** Lignes cachées quand elles sont vides. Voir DERBY-03 et REC-03 pour les incohérences de définition.

> `site saison/page.tsx:211-225, 319-353 ; API saison/route.ts:256-297, 337-344 ; app saison.tsx:326-348`

### `STATS-04` — ✔ fait · *confort*

**La situation.** Quelqu'un ouvre un vieux lien /stats?saison=<id d'une saison qui n'existe plus ou d'un autre club>.

**Ce qu'on attend.** L'écran s'ouvre quand même, sur la saison en cours.

**Où ça en est.** L'identifiant est vérifié contre les saisons du club, sinon retombe sur active ?? all.

> `site stats/page.tsx:102-108 ; API stats/route.ts:52-62`

### `STATS-07` — ✔ fait · *confort*

**La situation.** Deux joueurs sont à égalité parfaite (mêmes points, victoires, buts).

**Ce qu'on attend.** Ils ne changent pas de place d'un rafraîchissement à l'autre.

**Où ça en est.** Le nom départage en dernier. Note : pas de différence de buts par joueur au five, on départage aux buts marqués.

> `lib/classement.ts:25-41`

### `STATS-11` — ✔ fait · *confort*

**La situation.** Le club a joué contre un club extérieur ce lundi.

**Ce qu'on attend.** V/N/D, buts et MJ de chacun comptent ; l'Élo des nôtres ne bouge pas (pas d'adversaires cotés).

**Où ça en est.** Filtre INTERNAL sur l'Élo seulement ; les participants d'un EXTERNAL sont comptés au tableau.

> `lib/stats.ts:147-151, 201-211`

### `STATS-15` — ✔ fait · *confort*

**La situation.** Un visiteur sans compte regarde la vitrine publique du club.

**Ce qu'on attend.** Le tableau de la saison en cours, sans lien vers les fiches.

**Où ça en est.** Saison active, sinon « Toutes saisons ». Même tri.

> `app/p/[slug]/page.tsx:41-47, 87, 121 (avecFiches=false)`

## Réglages, membres, rôles

*52 cas — 9 faits, 11 partiels, 11 absents, **21 faux**.*

### `REG-27` — ⚠ faux · *bloque un lundi*

**La situation.** Un admin, en manipulant la liste, met SON PROPRE rôle sur « Membre ».

**Ce qu'on attend.** On l'arrête : « tu vas perdre l'accès aux réglages, et seul le capitaine pourra te le rendre ».

**Où ça en est.** `setMemberRole` ne refuse QUE le rôle owner ; rien ne regarde si la cible est soi-même. Le site affiche le `<select>` pour chaque non-owner, y compris la ligne marquée « (toi) », et le changement part au premier relâchement. L'app demande confirmation, mais avec un texte à la troisième personne — « Cette personne ne pourra plus modifier les réglages » — alors que cette personne, c'est lui.

> `app/actions/club.ts:83-115 ; app/c/[slug]/settings/MembersTable.tsx:88-110 ; five-scorer-mobile/app/club/[id]/reglages.tsx:487-511`

### `REG-28` — ⚠ faux · *bloque un lundi*

**La situation.** Un admin appuie sur « Retirer » sur sa propre ligne, sur le site.

**Ce qu'on attend.** Refus : on ne se retire pas soi-même par mégarde.

**Où ça en est.** La route mobile refuse explicitement (« Tu ne peux pas te retirer toi-même. ») et son commentaire dit noir sur blanc « Le site ne s'en protège pas ; ici, si. » C'est toujours vrai : la server action du site n'a aucun garde de ce genre, et le bouton « Retirer » est rendu pour toute ligne non-owner, la sienne comprise. Il perd l'accès au club et ne peut plus fabriquer le lien qui l'y ferait revenir.

> `app/actions/club.ts:117-147 ; app/c/[slug]/settings/MembersTable.tsx:114-130 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:73-80`

### `REG-37` — ⚠ faux · *bloque un lundi*

**La situation.** Un club a « Les membres peuvent scorer » sur non ; un membre ouvre « Mes clubs » dans l'app.

**Ce qu'on attend.** Il entre dans son club — il vient juste lire le classement.

**Où ça en est.** Tout le bloc d'actions, « Ouvrir le club » compris, est enfermé dans `{club.peutScorer && (...)}`. Un membre d'un club où la saisie est réservée aux admins n'a AUCUN bouton pour entrer dans son club depuis cet écran. Un réglage de saisie ferme une porte de navigation.

> `five-scorer-mobile/app/clubs.tsx:189-211`

### `REG-49` — ⚠ faux · *bloque un lundi*

**La situation.** Quelqu'un appelle directement les endpoints d'organisation de Better Auth, montés sous /api/auth/.

**Ce qu'on attend.** Rien de plus que ce que les écrans permettent.

**Où ça en est.** Le plugin `organization` est monté sans restriction, avec ses rôles par défaut : un ADMIN a `organization:["update"]` — il peut donc renommer le club ET changer son slug par `POST /api/auth/organization/update`, ce qu'aucun écran ne permet, et casser toutes les adresses partagées. L'OWNER a `organization:["delete"]` : `POST /api/auth/organization/delete` supprime l'organisation, et le club part EN CASCADE avec ses joueurs, ses saisons, ses soirées et ses matchs. Aucune confirmation, aucune corbeille, aucun écran — mais la porte est ouverte. C'est la même doctrine que la spec 0001 refuse pour les matchs, à l'échelle du club entier.

> `app/api/auth/[...all]/route.ts ; lib/auth.ts:110-124 ; prisma/schema.prisma (Club.organization onDelete: Cascade)`

### `REG-36` — ◐ partiel · *bloque un lundi*

**La situation.** Le capitaine éteint « Les membres peuvent scorer » pendant que la soirée est en cours.

**Ce qu'on attend.** Ceux qui saisissent finissent leur match ; la règle s'applique au suivant.

**Où ça en est.** `canScore` est recalculé à chaque requête : le refus est immédiat. La file locale du téléphone ne perd rien (le 403 n'est plus « empoisonné », la chaîne est bloquée et conservée), mais le message montré est brut : « 403 — Le serveur a répondu 403 — … ». Personne au bord du terrain ne comprend qu'un admin vient de lui couper le droit de saisir.

> `lib/guard.ts:66 ; five-scorer-mobile/lib/outbox/sync.ts:307-343`

### `REG-02` — ⚠ faux · *gêne un lundi*

**La situation.** Un simple membre tape l'adresse /c/renault-five-urban-guy/settings.

**Ce qu'on attend.** On lui dit que les réglages sont réservés au capitaine et aux admins.

**Où ça en est.** `if (!ctx.canManage) redirect(`/c/${slug}`)` — il est renvoyé à l'accueil SANS UN MOT. Il croit à un bug de l'app. La route mobile, elle, répond « Réservé aux admins. » en 403 (app/api/clubs/[clubId]/reglages/route.ts:52) et le commentaire explique pourquoi ce n'est pas un 404.

> `app/c/[slug]/settings/page.tsx:29`

### `REG-05` — ⚠ faux · *gêne un lundi*

**La situation.** Quelqu'un envoie un format inconnu (« RUGBY ») ou un mode homme-du-match inconnu à la route des réglages.

**Ce qu'on attend.** Un refus explicite.

**Où ça en est.** `...(input.format && FORMATS.includes(input.format) ? ... : {})` — une valeur inconnue est SILENCIEUSEMENT ignorée et la route répond 200 `{ok:true}`. L'écran dit « Enregistré » alors que rien n'a bougé.

> `lib/reglages-serveur.ts:61,87 ; app/api/clubs/[clubId]/reglages/route.ts:170`

### `REG-14` — ⚠ faux · *gêne un lundi*

**La situation.** Le capitaine veut choisir Sombre plutôt que Clair — c'est son œil, pas un réglage de club.

**Ce qu'on attend.** Chacun choisit son apparence.

**Où ça en est.** Le sélecteur Sombre/Clair n'existe QUE dans la page Réglages, derrière `if (!ctx.canManage) redirect(...)`. Un membre du club ne peut donc jamais changer d'apparence, alors que le choix est écrit dans SON cookie et ne concerne que lui.

> `app/c/[slug]/settings/page.tsx:29 ; app/c/[slug]/settings/ClubSettingsForm.tsx:225 ; components/ios/ThemeSwitch.tsx:22`

### `REG-18` — ⚠ faux · *gêne un lundi*

**La situation.** Un joueur lit le code d'invitation affiché dans les Réglages et le tape dans « Rejoindre un club ».

**Ce qu'on attend.** Il entre dans le club.

**Où ça en est.** Ce qui est AFFICHÉ n'est pas le code : c'est `inviteCode.slice(-8).toUpperCase()` — huit derniers caractères, en majuscules — alors que le code réel fait 12 caractères (ou 25 pour un club jamais régénéré), en minuscules. `normaliserCode` rabaisse bien la casse, mais huit caractères sur douze ne trouveront jamais rien : « Code d'invitation invalide. » Le seul chemin qui marche est le LIEN complet.

> `app/c/[slug]/settings/page.tsx:94 ; app/api/clubs/[clubId]/reglages/route.ts:108-112 ; lib/rejoindre.ts:56-69 ; app/onboarding/JoinClubForm.tsx:28-34`

### `REG-34` — ⚠ faux · *gêne un lundi*

**La situation.** Le capitaine change un réglage depuis le parking du gymnase, sans réseau, sur le site.

**Ce qu'on attend.** « Pas de réseau — réessaie », et le réglage revient à sa valeur d'avant.

**Où ça en est.** Le service worker n'intercepte que les GET (`if (req.method !== "GET") return;`) : l'appel de la server action part et échoue. `sauver` n'a AUCUN try/catch autour de `await updateClubSettings(...)`, et il n'existe pas un seul `error.tsx` dans tout le dépôt. L'erreur sort de la transition sans filet. Et l'interrupteur, lui, reste dans sa nouvelle position : à l'écran le réglage a l'air changé.

> `app/c/[slug]/settings/ClubSettingsForm.tsx:93-110 ; public/sw.js:279-280 ; aucun app/error.tsx`

### `REG-43` — ⚠ faux · *gêne un lundi*

**La situation.** Le capitaine réactive une saison qui n'existe plus (deux onglets, un identifiant périmé).

**Ce qu'on attend.** « Saison introuvable. »

**Où ça en est.** `reopenSeason` enchaîne deux `updateMany` sans jamais vérifier le compte : elle rend `ok: true` même quand elle n'a rien touché — et elle a quand même clôturé la saison active au passage. `closeSeason` vérifie (`res.count === 0`), la réactivation non. La route mobile a corrigé ce trou de son côté et son commentaire le dit ; le site l'a gardé.

> `app/actions/seasons.ts:52-74 ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts:38-44`

### `REG-21` — ✗ absent · *gêne un lundi*

**La situation.** Le capitaine régénère par erreur, alors que trois personnes avaient le lien et n'ont pas encore cliqué.

**Ce qu'on attend.** Revenir en arrière, ou au moins une période où les deux codes marchent.

**Où ça en est.** `data: { inviteCode: code }` écrase. L'ancien code n'est stocké nulle part, il n'y a ni historique ni délai de grâce. Le seul recours est de renvoyer le nouveau lien à tout le monde.

> `app/actions/club.ts:72-76`

### `REG-33` — ✗ absent · *gêne un lundi*

**La situation.** Deux admins ouvrent les Réglages en même temps et changent chacun une chose.

**Ce qu'on attend.** Les deux changements tiennent, ou on dit qu'il y a eu conflit.

**Où ça en est.** Aucune version, aucun `updatedAt` comparé : le dernier écrit gagne, champ par champ. Pire côté site : le formulaire ne se resynchronise jamais sur les props (`useState(initial)` sans `useEffect`), donc l'un des deux continue d'afficher les valeurs de sa page pendant que la base porte celles de l'autre.

> `lib/reglages-serveur.ts:50-101 ; app/c/[slug]/settings/ClubSettingsForm.tsx:69`

### `REG-03` — ◐ partiel · *gêne un lundi*

**La situation.** Un membre atteint l'écran Réglages de l'app par un lien profond ou l'historique de navigation.

**Ce qu'on attend.** Une phrase claire : « c'est pour les admins », et un chemin de retour.

**Où ça en est.** Le menu cache bien l'entrée (composants/MenuClub.tsx:154), mais si on y arrive quand même, `charger()` attrape l'ErreurServeur et affiche « Le serveur a répondu 403 — Réservé aux admins. » en rouge sous un titre « Réglages » vide. Le code HTTP est dans la phrase montrée au club.

> `five-scorer-mobile/app/club/[id]/reglages.tsx:70-77 ; five-scorer-mobile/lib/appel.ts:30-47`

### `REG-17` — ◐ partiel · *gêne un lundi*

**La situation.** Par erreur, les deux chasubles sont mises sur la même couleur.

**Ce qu'on attend.** On l'empêche, ou on le signale : deux équipes de la même couleur, c'est la feuille de match illisible.

**Où ça en est.** Rien n'interdit colorA == colorB. `nomsChasubles` désambiguïse seulement les NOMS (« Blanc 1 » / « Blanc 2 ») ; les écussons, le fond, les anneaux d'avatar et les barres de score deviennent identiques des deux côtés. Aucun avertissement.

> `lib/reglages-serveur.ts:93-98 ; lib/color.ts:173-184`

### `REG-25` — ◐ partiel · *gêne un lundi*

**La situation.** Quelqu'un ouvre le lien deux fois de suite (deux onglets, ou l'app puis le site).

**Ce qu'on attend.** Il est membre une fois.

**Où ça en est.** `findFirst` puis `addMember` : entre les deux, rien. La table `member` n'a QUE des index, aucun `@@unique([organizationId, userId])`. L'écran de l'app se garde du double appui côté client (son propre commentaire le dit), mais deux appareils simultanés créeraient deux lignes — la personne apparaîtrait deux fois dans la liste des membres, et la retirer une fois ne suffirait pas.

> `lib/rejoindre.ts:141-150 ; prisma/schema.prisma (model Member) ; five-scorer-mobile/app/rejoindre.tsx:35-40`

### `REG-35` — ◐ partiel · *gêne un lundi*

**La situation.** Même geste depuis l'app, dans le gymnase sans réseau.

**Ce qu'on attend.** On sait tout de suite que ça n'est pas parti.

**Où ça en est.** L'erreur est bien attrapée et affichée — mais dans la ligne d'état placée TOUT EN BAS de l'écran, après les six sections. Quelqu'un qui bascule « Passes décisives » (section Match) ne la voit pas. L'interrupteur, lui, revient tout seul à sa valeur serveur, sans explication. Aucune file d'attente : les réglages exigent le réseau, contrairement à la feuille de match.

> `five-scorer-mobile/app/club/[id]/reglages.tsx:86-106 ; five-scorer-mobile/lib/appel.ts:56-66`

### `REG-04` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine tape 200 dans « Durée d'un match » et quitte le champ.

**Ce qu'on attend.** Soit on refuse en le disant, soit on écrête et on MONTRE la valeur retenue.

**Où ça en est.** Le serveur écrête à 120 et répond `ok: true`. Le site affiche « Enregistré » et continue d'afficher 200 : `values` est un `useState(initial)` jamais resynchronisé, même après `router.refresh()`. Le club croit jouer 200 minutes. L'app, elle, relit (`await charger()`) et la valeur retombe à 120 en silence, sans un mot.

> `lib/reglages-serveur.ts:73 ; app/c/[slug]/settings/ClubSettingsForm.tsx:69,101-106`

### `REG-07` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine règle « Il faut au moins 10 joueurs » et « Le terrain tient 8 ».

**Ce qu'on attend.** On l'empêche, ou on lui dit que la soirée ne pourra jamais être confirmée.

**Où ça en est.** Les deux bornes sont écrêtées séparément (2..30 et 0..40), jamais l'une contre l'autre. Or `titulaires` est PLAFONNÉ par la capacité : avec capacité < minimum, `titulaires.length >= minJoueurs` est impossible, et toutes les soirées de l'année affichent « il en manque 2 » quel que soit le monde présent.

> `lib/reglages-serveur.ts:65-72 ; lib/presences.ts:104-130`

### `REG-09` — ⚠ faux · *gêne une saison*

**La situation.** En avril, le capitaine passe la victoire de 3 à 2 points.

**Ce qu'on attend.** Le club sait que ça ne vaut que pour la suite — ou on lui dit très fort que tout le classement change.

**Où ça en est.** Le barème n'est stocké NULLE PART sur la saison ni sur le match : il est relu sur `club` à chaque calcul de classement. Changer le barème réécrit rétroactivement tout le classement de septembre, sans un mot, sans trace, sans retour en arrière possible autre que retaper les anciens chiffres.

> `lib/reglages-serveur.ts:76-82 ; app/c/[slug]/page.tsx:628-631 ; app/api/clubs/[clubId]/stats/route.ts:165,307 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:302-315`

### `REG-23` — ⚠ faux · *gêne une saison*

**La situation.** Un nouveau qui s'appelle comme un joueur du roster (deux « Thomas ») rejoint par le lien.

**Ce qu'on attend.** On lui crée SA fiche ; on ne lui donne pas l'historique d'un autre.

**Où ça en est.** `assurerProfilJoueur` adopte le premier profil non lié dont le nom OU le surnom, normalisés (minuscules, sans accents), correspondent. Le nouveau venu hérite alors des buts, des matchs, des votes et du classement de l'autre Thomas. Aucune confirmation, aucun moyen de défaire.

> `lib/rejoindre.ts:81-113`

### `REG-24` — ⚠ faux · *gêne une saison*

**La situation.** Un ancien du club, dont la fiche a été archivée l'an dernier, revient et rejoint par le lien.

**Ce qu'on attend.** Il retrouve son historique.

**Où ça en est.** La recherche exclut `isArchived: false` — donc un profil archivé n'est jamais adopté. On lui crée une fiche NEUVE, vide, à côté de son historique. Le vestiaire a maintenant deux fois le même joueur, et ses buts sont sur celui qu'on ne voit plus.

> `lib/rejoindre.ts:95`

### `REG-38` — ⚠ faux · *gêne une saison*

**La situation.** Un joueur veut coller le calendrier des lundis dans l'agenda de son téléphone.

**Ce qu'on attend.** Il récupère le lien iCal tout seul — c'est exactement ce pour quoi il existe.

**Où ça en est.** Le lien iCal ne vit QUE dans la page Réglages, derrière `canManage` — des deux côtés. Le commentaire de app/api/cal/[token]/route.ts explique pourtant que l'intérêt est que « chacun le colle une fois » : un simple membre ne peut pas l'obtenir sans passer par un admin qui le lui envoie à la main.

> `app/c/[slug]/settings/page.tsx:29,96-98 ; app/c/[slug]/settings/AgendaCard.tsx ; app/api/clubs/[clubId]/reglages/route.ts:52,114 ; five-scorer-mobile/composants/MenuClub.tsx:154`

### `REG-39` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine partage le lien de l'agenda depuis l'app.

**Ce qu'on attend.** Le téléphone d'en face propose de S'ABONNER au calendrier.

**Où ça en est.** L'app partage `PROD + "/api/cal/<jeton>"` — en `https://`, sans le `.ics`. Le site, lui, sait la règle et l'écrit : « un lien https télécharge un fichier figé qui ne se mettra jamais à jour », d'où son `webcal://`. Le lien partagé par l'app donne donc un calendrier mort, qui n'apprendra jamais qu'un lundi a été annulé.

> `five-scorer-mobile/app/club/[id]/reglages.tsx:553-561 ; app/c/[slug]/settings/AgendaCard.tsx:16-21`

### `REG-41` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine ouvre une nouvelle saison depuis les Réglages du site, en janvier, sans y penser.

**Ce qu'on attend.** On lui dit que la saison en cours va être clôturée.

**Où ça en est.** Le formulaire « Créer » du site n'a AUCUNE confirmation : un appui, et `createSeason` clôture la saison active dans la même transaction. Les soirées et matchs déjà joués gardent leur ancienne saison — l'accueil et le classement retombent à zéro. L'app, elle, le dit avant (« un club n'a jamais deux saisons ouvertes »), et le commentaire de app/api/clubs/[clubId]/saisons/route.ts appelle ça un « EFFET DE BORD À ANNONCER : … le site ne le dit nulle part ».

> `app/c/[slug]/settings/SeasonsCard.tsx:118-146 ; app/actions/seasons.ts:16-27 ; five-scorer-mobile/app/club/[id]/reglages.tsx:359-380`

### `REG-42` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine clôture la saison en cours, alors que le calendrier annuel court jusqu'en juillet.

**Ce qu'on attend.** La saison se ferme proprement, sans effacer ce qui était prévu.

**Où ça en est.** `closeSeason` pose `endsAt: new Date()`, en écrasant la date de fin que le générateur de calendrier avait étirée jusqu'au dernier lundi. Réactiver ensuite (`reopenSeason`, seasons.ts:69-72) pose `endsAt: null` : la période planifiée est perdue dans les deux sens, et la ligne « Saisons » des réglages affiche alors « → en cours » pour une saison dont on connaissait la fin.

> `app/actions/seasons.ts:43-47 ; lib/calendrier-serveur.ts:88-99 ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts:53-57`

### `REG-08` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine met 1 point la victoire et 5 points le nul (doigt qui glisse sur deux champs côte à côte).

**Ce qu'on attend.** On refuse : un nul ne peut pas rapporter plus qu'une victoire.

**Où ça en est.** `pointsWin` écrêté 1..10, `pointsDraw` écrêté 0..5, aucune relation entre les deux. Les deux champs sont collés sur la même rangée « Barème · victoire · nul », sans étiquette individuelle visible — c'est le geste le plus facile à rater de l'écran.

> `lib/reglages-serveur.ts:76-82 ; app/c/[slug]/settings/ClubSettingsForm.tsx:333-355 ; five-scorer-mobile/app/club/[id]/reglages.tsx:319-331`

### `REG-22` — ✗ absent · *gêne une saison*

**La situation.** Le lien d'invitation est transféré hors du club ; un inconnu clique.

**Ce qu'on attend.** Une demande à valider par le capitaine, ou au moins un signalement.

**Où ça en est.** Qui a le lien ENTRE, immédiatement, en rôle `member`, avec un profil joueur créé dans la foulée. Aucune approbation, aucune notification au capitaine, aucune date d'expiration, aucun compteur d'usages. La table `Invitation` de Better Auth existe au schéma mais n'est utilisée par rien.

> `lib/rejoindre.ts:115-158 ; app/join/[code]/JoinButton.tsx`

### `REG-30` — ✗ absent · *gêne une saison*

**La situation.** Un membre veut quitter le club de lui-même (il a déménagé).

**Ce qu'on attend.** Un geste pour partir, sans déranger le capitaine.

**Où ça en est.** Aucun bouton « Quitter ce club », ni sur le site ni sur l'app — et la liste des membres est de toute façon derrière la porte admin. L'endpoint `/api/auth/organization/leave` de Better Auth est monté et fonctionnel, mais aucun écran ne l'appelle ; et lui ne délierait pas le profil joueur, contrairement à `removeMember`.

> `aucun écran ; app/c/[slug]/settings/MembersTable.tsx ; five-scorer-mobile/app/club/[id]/reglages.tsx`

### `REG-31` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine arrête le five et veut passer le brassard à un autre.

**Ce qu'on attend.** Un transfert de capitanat.

**Où ça en est.** Le rôle `owner` est refusé À L'ÉCRITURE des deux côtés (« Rôle inconnu. »), et l'owner ne peut être ni modifié ni retiré (« Impossible de modifier l'owner. »). Il n'existe donc AUCUN chemin, dans le produit, pour changer de capitaine. Better Auth le permettrait par son propre endpoint, mais rien ne l'expose.

> `app/actions/club.ts:99-101 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:33-35`

### `REG-44` — ✗ absent · *gêne une saison*

**La situation.** La saison a été créée avec une faute de frappe (« Saion 2026-2027 »).

**Ce qu'on attend.** La renommer.

**Où ça en est.** Aucune action ni route ne modifie `Season.name` après création — la seule bascule offerte est active/inactive. Une saison créée par erreur ne se supprime pas non plus : elle reste dans la liste des Réglages pour toujours.

> `app/actions/seasons.ts ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts`

### `REG-46` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine veut savoir qui a changé le barème, et quand.

**Ce qu'on attend.** Une trace : quoi, par qui, quand.

**Où ça en est.** `Club.updatedAt` existe et est tenu par Prisma, mais n'est affiché nulle part et ne porte pas d'auteur. Aucun journal des réglages, des promotions, des retraits ni des régénérations de code. Dans un club, un réglage qui change en silence finit en discussion — c'est le même constat que la spec 0001 fait pour les matchs.

> `prisma/schema.prisma (Club.updatedAt) ; lib/reglages-serveur.ts:50-101`

### `REG-12` — ◐ partiel · *gêne une saison*

**La situation.** Le capitaine allume « Page publique » pour partager le classement.

**Ce qu'on attend.** La page s'ouvre, et on sait ce qu'elle montre — dont les noms des joueurs.

**Où ça en est.** L'interrupteur marche et le lien apparaît. Mais l'aide dit seulement « Classement et résultats en lecture seule » : elle ne dit pas que les NOMS des joueurs, leur nombre de buts et l'homme du match deviennent lisibles par n'importe qui, sans compte. Personne dans le vestiaire n'a été consulté.

> `app/c/[slug]/settings/ClubSettingsForm.tsx:358-374 ; app/p/[slug]/page.tsx:38 ; app/api/public/[slug]/route.ts:48`

### `REG-32` — ◐ partiel · *gêne une saison*

**La situation.** Le capitaine ne joue plus, ne se connecte plus, et personne ne peut le joindre.

**Ce qu'on attend.** Le club continue de vivre.

**Où ça en est.** Les admins gardent tout (canManage identique pour owner et admin) : le club tourne. Mais le capitanat est définitivement bloqué sur un compte inactif, et personne ne peut le lui reprendre. Si son compte disparaissait, le club se retrouverait potentiellement sans aucun gérant, sans recours dans le produit.

> `lib/guard.ts:56-68 ; app/actions/club.ts:109-111,133-135`

### `REG-06` — ⚠ faux · *confort*

**La situation.** Une couleur de chasuble mal formée arrive (copier-coller, appel direct).

**Ce qu'on attend.** Un refus, ou une correction annoncée.

**Où ça en est.** Même motif : `input.colorA && isValidHex(...)` — sinon on n'écrit rien et on rend `ok: true`. Un « Enregistré » pour une couleur qui n'a pas changé.

> `lib/reglages-serveur.ts:93-98`

### `REG-48` — ⚠ faux · *confort*

**La situation.** Le même rôle est lu dans l'app, sur le site, et dans les Réglages.

**Ce qu'on attend.** Un seul mot par rôle, celui du club.

**Où ça en est.** Trois vocabulaires pour trois rôles : l'app « Mes clubs » dit Capitaine / Adjoint / Joueur ; la route des réglages dit Capitaine / Admin / Membre ; l'accueil du site dit Capitaine / Admin / Joueur. Et le sous-titre de la page Réglages dit « Propriétaire du club » là où la liste dit « Capitaine ».

> `five-scorer-mobile/app/clubs.tsx:131-135 ; app/api/clubs/[clubId]/reglages/route.ts:124-126 ; app/onboarding/page.tsx:19-23 ; app/c/[slug]/settings/MembersTable.tsx:104-105`

### `REG-10` — ✗ absent · *confort*

**La situation.** Le club s'appelle « Renault Five Urban Guy » ; quelqu'un colle 4 000 caractères dans le champ Nom.

**Ce qu'on attend.** Une borne haute, comme pour le nom d'une saison.

**Où ça en est.** Seule la borne basse existe (`length < 2` → « Nom trop court. »). Aucune borne haute, aucun `.slice()` — alors que le nom de saison est coupé à 60 (app/actions/seasons.ts:15, app/api/clubs/[clubId]/saisons/route.ts:29). Le nom part dans la pilule du club, la barre du haut, le titre iCal et la page publique.

> `lib/reglages-serveur.ts:46-49`

### `REG-15` — ✗ absent · *confort*

**La situation.** Le même capitaine ouvre l'app sur son téléphone en plein soleil et veut le thème clair.

**Ce qu'on attend.** La même apparence que sur le site.

**Où ça en est.** Le serveur envoie pourtant les DEUX jeux de jetons (`theme: { sombre, clair }`), mais chaque écran de l'app fait `themeTokens(..., "dark")` ou `club.theme.sombre` en dur. Le thème clair est calculé, transporté, et jamais utilisé. Aucune ligne « Apparence » dans les réglages de l'app.

> `five-scorer-mobile/app/club/[id]/reglages.tsx:62-64 ; lib/clubApi.ts:40-43`

### `REG-40` — ✗ absent · *confort*

**La situation.** Le lien iCal a circulé trop loin (il finit dans quinze téléphones, le code le dit lui-même).

**Ce qu'on attend.** Le régénérer, comme le code d'invitation.

**Où ça en est.** `calendarToken` n'est écrit nulle part après le `@default(cuid())` : aucune action, aucune route ne le régénère. Le second secret, celui qui est FAIT pour circuler, est le seul des deux qu'on ne puisse pas révoquer.

> `prisma/schema.prisma (Club.calendarToken) ; app/c/[slug]/settings/AgendaCard.tsx`

### `REG-11` — ◐ partiel · *confort*

**La situation.** Le club se renomme « Renault Five Guyancourt ».

**Ce qu'on attend.** Le nom change partout ; l'adresse du club suit, ou au moins on dit qu'elle ne suivra pas.

**Où ça en est.** `ecrireReglages` ne touche qu'à `organization.name`. Le `slug` est figé à la création et n'est modifiable par AUCUN écran. L'adresse `/c/ancien-nom` et la vitrine `/p/ancien-nom` gardent l'ancien nom pour toujours — et c'est cette adresse-là qu'on partage sur WhatsApp.

> `lib/reglages-serveur.ts:52-57 ; lib/slugify.ts ; app/onboarding/CreateClubForm.tsx:50-64`

### `REG-13` — ◐ partiel · *confort*

**La situation.** Le capitaine éteint « Page publique » ; un adversaire avait mis le lien en favori.

**Ce qu'on attend.** Une page qui dit « ce club n'est plus public », pas une erreur.

**Où ça en est.** `notFound()` sec, et 404 `{error:"introuvable"}` côté API. Correct pour ne pas révéler l'existence du club, mais illisible pour celui à qui on avait donné le lien la veille.

> `app/p/[slug]/page.tsx:38 ; app/api/public/[slug]/route.ts:48-53`

### `REG-16` — ◐ partiel · *confort*

**La situation.** Le club joue en Blanc et Noir ; le capitaine veut poser exactement le blanc cassé de ses chasubles depuis son téléphone.

**Ce qu'on attend.** Choisir une couleur libre, comme sur le site.

**Où ça en est.** Le site a un `<input type="color">` en plus des huit pastilles. L'app n'a que les huit pastilles servies par la route (`choix.pastilles`). Une couleur hors palette se règle sur le site et jamais depuis le téléphone.

> `app/c/[slug]/settings/ClubSettingsForm.tsx:130-140 ; five-scorer-mobile/app/club/[id]/reglages.tsx:755-790`

### `REG-47` — ◐ partiel · *confort*

**La situation.** Le capitaine compare « 6 membres · 2 admins » à ses 18 joueurs au vestiaire.

**Ce qu'on attend.** Comprendre que ce sont deux choses : les COMPTES et les JOUEURS.

**Où ça en est.** La liste des membres ne montre que les lignes `member`, donc les comptes. Les joueurs créés par le capitaine et les invités d'un soir n'y sont pas — et rien à l'écran ne l'explique. Le lien « joueur X » sur une ligne membre est le seul indice que les deux mondes se recouvrent.

> `app/c/[slug]/settings/page.tsx:43,88-90 ; app/api/clubs/[clubId]/reglages/route.ts:70,116-118`

### `REG-01` — ✔ fait · *confort*

**La situation.** Le capitaine ouvre Réglages sur le site pour changer la durée d'un match.

**Ce qu'on attend.** L'écran s'ouvre, chaque ligne s'enregistre toute seule quand on la quitte.

**Où ça en est.** Écriture sans bouton « Enregistrer », côté site comme côté app ; le corps unique est lib/reglages-serveur.ts, appelé par la server action et par PATCH /api/clubs/[clubId]/reglages.

> `app/c/[slug]/settings/page.tsx:29 ; ClubSettingsForm.tsx:96-110 ; five-scorer-mobile/app/club/[id]/reglages.tsx:86-106`

### `REG-19` — ✔ fait · *confort*

**La situation.** Un nouveau colle le lien reçu sur WhatsApp (URL entière) dans le champ « code ».

**Ce qu'on attend.** Ça marche : c'est ce que les gens ont réellement sous le pouce.

**Où ça en est.** `normaliserCode` découpe sur `/join/`, retire paramètres, ancre et barre finale, et passe par `estId`. L'app propose le même champ (« Lien ou code »).

> `lib/rejoindre.ts:56-69 ; five-scorer-mobile/app/rejoindre.tsx:78-95`

### `REG-20` — ✔ fait · *confort*

**La situation.** Le capitaine régénère le code parce que le lien a fuité hors du groupe.

**Ce qu'on attend.** L'ancien lien meurt, on est prévenu, et on peut renvoyer le nouveau tout de suite.

**Où ça en est.** Les deux côtés demandent confirmation. L'app dit la conséquence en toutes lettres (« Tous ceux que tu as déjà envoyés, y compris sur WhatsApp, tomberont en panne. ») ; le site se contente de « L'ancien lien ne marchera plus. Sûr ? ».

> `app/actions/club.ts:67-79 ; app/api/clubs/[clubId]/reglages/invitation/route.ts ; app/c/[slug]/settings/InviteCard.tsx:83-105 ; five-scorer-mobile/app/club/[id]/reglages.tsx:434-457`

### `REG-26` — ✔ fait · *confort*

**La situation.** Le capitaine promeut un joueur admin depuis le téléphone.

**Ce qu'on attend.** Une confirmation qui dit ce que ça donne, puis c'est fait.

**Où ça en est.** L'app dit « Cette personne pourra modifier les réglages, l'effectif et le calendrier. » avant d'agir. Le site, lui, fait basculer un `<select>` sans aucune confirmation (MembersTable.tsx:88-110).

> `five-scorer-mobile/app/club/[id]/reglages.tsx:487-514 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:18-47`

### `REG-29` — ✔ fait · *confort*

**La situation.** Le capitaine retire un membre parti du club.

**Ce qu'on attend.** Son compte sort, ses buts et ses matchs restent au club.

**Où ça en est.** Transaction : `player.updateMany({ userId: null })` puis `member.delete`. Les deux côtés le disent à l'écran (« son profil joueur reste au vestiaire, simplement délié de son compte »).

> `app/actions/club.ts:136-144 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:82-90`

### `REG-45` — ✔ fait · *confort*

**La situation.** Le club n'a encore aucune saison ; un admin ouvre les Réglages.

**Ce qu'on attend.** On le dit, et on propose d'en ouvrir une.

**Où ça en est.** « Saison active : aucune » et « Aucune saison pour l'instant — lance la première 👇 ». Ce qui n'est dit ni d'un côté ni de l'autre : sans saison active, les nouveaux matchs ne s'attachent à rien.

> `app/c/[slug]/settings/page.tsx:63-64 ; app/c/[slug]/settings/SeasonsCard.tsx:100-104 ; five-scorer-mobile/app/club/[id]/reglages.tsx:300-306`

### `REG-50` — ✔ fait · *confort*

**La situation.** Un admin change le rôle de quelqu'un pendant que celui-ci a l'app ouverte sur l'accueil du club.

**Ce qu'on attend.** L'écran d'en face se met à jour au prochain regard.

**Où ça en est.** L'app relit `chargerMoi()` à chaque chargement d'écran, donc `peutGerer` et `peutScorer` sont frais. Le site recalcule à chaque requête (`requireClub`). Rien n'est mis en cache trop longtemps de ce côté-là.

> `five-scorer-mobile/app/club/[id]/index.tsx:52-58 ; app/api/clubs/[clubId]/route.ts`

### `REG-51` — ✔ fait · *confort*

**La situation.** Un club est créé avec un nom déjà pris (« Renault Five » existe).

**Ce qu'on attend.** Le club se crée quand même, sous une adresse voisine.

**Où ça en est.** Cinq tentatives avec suffixe (-2 … -5), puis « Ce nom de club est déjà très demandé — essaie une variante. ». Ce qui n'est pas dit : l'adresse obtenue (`fc-lundi-soir-3`) est celle qu'on partagera pour toujours, et elle n'est plus modifiable ensuite (cf. REG-11).

> `app/onboarding/CreateClubForm.tsx:56-74`

### `REG-52` — ✔ fait · *confort*

**La situation.** Un identifiant de membre ou de saison bricolé est envoyé à une action serveur.

**Ce qu'on attend.** Refus net.

**Où ça en est.** `idsValides` est appelé en tête de chaque action et de chaque route du domaine, avant toute requête — et son commentaire rappelle qu'un objet passé pour un identifiant devenait un filtre Prisma. C'est le garde le mieux tenu du domaine.

> `app/actions/club.ts:90-92,123-125 ; app/actions/seasons.ts:36-38,58-60 ; app/api/clubs/[clubId]/membres/[memberId]/route.ts:22-24 ; lib/ids.ts`

## Transversal

*62 cas — 9 faits, 15 partiels, 18 absents, **20 faux**.*

### `TRANS-05` — ⚠ faux · *bloque un lundi*

**La situation.** La session d'un joueur n'est plus reconnue par le serveur (compte purgé, secret changé, ligne de session supprimée) mais le cookie de 90 jours est toujours dans le trousseau. Il ouvre l'app.

**Ce qu'on attend.** L'app le renvoie à la connexion : « Ta session a expiré, reconnecte-toi. »

**Où ça en est.** Le middleware ne juge que la PRÉSENCE du cookie (« ni signature, ni lecture de base », middleware.ts:14). Le cookie étant là, la requête atteint le handler, `getClubApiContext` rend `null`, et la route répond **404 « introuvable »** — pas 401. Or `lib/appel.ts:138` ne lève `SessionExpiree` que sur 401. Résultat : l'app affiche « Le serveur a répondu 404 — introuvable » sur chaque écran, indéfiniment, sans jamais proposer de se reconnecter. Le cas « sans cookie » est testé (scripts/parcours-lecture.mjs:629-636) ; le cas « cookie mort » ne l'est nulle part.

> `five-scorer/middleware.ts:12-14 et 39-41 ; lib/guard.ts:94-109 ; app/api/clubs/[clubId]/accueil/route.ts:28-31 (et 20 autres routes) ; five-scorer-mobile/lib/appel.ts:138`

### `TRANS-10` — ⚠ faux · *bloque un lundi*

**La situation.** Session morte, on ouvre les Réglages, le récap d'un match, une soirée ou une fiche de joueur depuis une liste.

**Ce qu'on attend.** Même sortie que partout ailleurs.

**Où ça en est.** Ces quatre écrans n'appellent `chargerMoi()` que si le `clubId` n'est PAS déjà dans les paramètres de navigation — or il l'est toujours quand on arrive par une liste. Ils ne touchent donc jamais la seule route qui répond 401 : ils reçoivent 404 et restent bloqués sur « Le serveur a répondu 404 — introuvable », sans aucune sortie.

> `five-scorer-mobile/app/club/[id]/reglages.tsx:70-74 ; app/recap/[id].tsx:43-47 ; app/soiree/[id].tsx:53-59 ; app/joueur/[id].tsx:50-56`

### `TRANS-12` — ⚠ faux · *bloque un lundi*

**La situation.** Un membre d'un club où « les membres peuvent saisir » est désactivé ouvre l'app, tape « Créer » dans la barre du bas, compose deux équipes et saisit toute la soirée hors réseau.

**Ce qu'on attend.** Le bouton n'est pas là, ou il dit tout de suite que la saisie est réservée.

**Où ça en est.** La feuille « Créer » du layout n'a que l'`id` du club, pas l'objet club : elle ne peut pas lire `peutScorer` et affiche donc les deux actions à tout le monde. L'accueil, lui, garde son bouton derrière `club?.peutScorer` (index.tsx:163) — deux portes, une seule gardée. `compo.tsx` ne vérifie rien. Le serveur refuse (403) au premier rejeu, et `bloquerChaine` met alors DE CÔTÉ tout le match : deux heures de saisie enfermées dans le téléphone.

> `five-scorer-mobile/app/club/[id]/_layout.tsx:49-56 et 89-104 ; app/compo.tsx:100-170 (aucun contrôle de droit) ; comparer app/club/[id]/index.tsx:163 ; côté serveur app/api/clubs/[clubId]/matches/route.ts:129-131`

### `TRANS-16` — ⚠ faux · *bloque un lundi*

**La situation.** Quelqu'un se déconnecte depuis l'écran « Mes clubs » plutôt que par le menu du club, avec une soirée non synchronisée dans le téléphone.

**Ce qu'on attend.** Le même avertissement et la même purge que par le menu.

**Où ça en est.** Le bouton de clubs.tsx fait `await signOut(); router.replace("/vitrine")` — sans `enAttente()`, sans `purger()`. Le menu du club, lui, fait les deux, et son commentaire dit pourquoi : « se déconnecter la jetterait, et deux heures de saisie disparaîtraient sans un mot ». Deux boutons pour le même geste, un seul protégé. Et la base locale du club précédent reste sur un téléphone prêté.

> `five-scorer-mobile/app/clubs.tsx:100-107 ; comparer composants/MenuClub.tsx:56-88 et composants/Noyau.tsx:26-35`

### `TRANS-47` — ⚠ faux · *bloque un lundi*

**La situation.** Un membre reçoit 404 sur un écran. Il ne sait pas s'il a été retiré du club, si sa session est morte, ou si le club n'existe plus.

**Ce qu'on attend.** Les trois situations ne sont pas la même, et l'app doit pouvoir les distinguer même si l'utilisateur, lui, n'a droit qu'à un message.

**Où ça en est.** `getClubApiContext` rend `null` dans trois cas différents (pas de session, club inexistant, pas membre) et la route les fond en un seul 404. La règle « 404 plutôt que 403 » est bonne face à quelqu'un qui devine un identifiant ; elle prive le client de toute possibilité de réagir correctement à sa propre session morte. Il manque une distinction, pas un message.

> `five-scorer/lib/guard.ts:94-109 ; app/api/clubs/[clubId]/accueil/route.ts:28-31 ; scripts/parcours-lecture.mjs:639-658 ; five-scorer-mobile/lib/appel.ts:136-140`

### `TRANS-13` — ✗ absent · *bloque un lundi*

**La situation.** La pastille de la feuille de match affiche « 3 refusées ». On veut savoir lesquelles et réessayer.

**Ce qu'on attend.** On les voit, on comprend pourquoi, et on peut les relancer une fois le problème réglé — exactement ce que fait le site.

**Où ça en est.** `listerBloquees` et `rejouerBloquees` existent, sont testés, et ne sont appelés par AUCUN écran (vérifié : aucune occurrence hors sync.ts et sync.test.ts). La `Pastille` est un `<Text>`, pas un bouton. Le site, lui, rend sa pastille cliquable et appelle `retryBlockedOps()` — avec le commentaire « Sans ça, “bloqué” n'a aucune sortie et la saisie reste prisonnière » (SyncBadge.tsx:51). Sur l'app, c'est exactement la situation.

> `five-scorer-mobile/lib/outbox/sync.ts:388-397 (listerBloquees, rejouerBloquees) ; app/match/[id].tsx:1042-1062 ; côté site components/SyncBadge.tsx:48-56`

### `TRANS-28` — ✗ absent · *bloque un lundi*

**La situation.** Une soirée est annulée le lundi à 17 h (terrain indisponible).

**Ce qu'on attend.** Tout le monde l'apprend avant de prendre la voiture.

**Où ça en est.** L'annulation est écrite en base et portée par le flux iCal — mais un abonnement iCal se rafraîchit quand le téléphone le décide, souvent plusieurs heures. Aucun envoi immédiat, aucun message. C'est le seul cas de ce domaine qui coûte un déplacement pour rien.

> `five-scorer/app/actions/calendrier.ts:44-60 (annulation) ; app/api/cal/[token]/route.ts:88-90 (canceledAt dans le flux) ; aucun envoi`

### `TRANS-37` — ✗ absent · *bloque un lundi*

**La situation.** Une version de l'app part avec un bug qui casse la saisie, un dimanche.

**Ce qu'on attend.** On corrige et on pousse avant lundi soir.

**Où ça en est.** Aucun mécanisme de mise à jour à chaud. Un correctif passe par un build EAS puis TestFlight ou la revue App Store : au mieux quelques heures, au pire plusieurs jours. Le site, lui, se répare par un déploiement Vercel en trois minutes. La moitié de l'app qui compte les buts est celle qu'on ne peut pas réparer vite.

> `five-scorer-mobile/package.json (pas d'expo-updates) ; app.json (pas de runtimeVersion, pas de canal) ; eas.json:1-30`

### `TRANS-38` — ✗ absent · *bloque un lundi*

**La situation.** Le serveur évolue (un champ obligatoire de plus, une route renommée) pendant qu'un téléphone tourne encore sur la version d'il y a trois mois.

**Ce qu'on attend.** L'app le dit : « Mets à jour l'app pour continuer. »

**Où ça en est.** L'app n'annonce pas sa version au serveur et le serveur n'annonce aucune version minimale. Une divergence se solde par des 400 en série sur des opérations que la file MET DE CÔTÉ (sync.ts:328-344) — la soirée reste dans le téléphone, et l'écran qui l'expliquerait n'existe pas (TRANS-13). Symétriquement, une app trop RÉCENTE contre un serveur en cours de déploiement produit le même silence.

> `aucun — ni /api/version côté site, ni en-tête de version dans five-scorer-mobile/lib/appel.ts:115-141, ni contrôle au lancement`

### `TRANS-39` — ✗ absent · *bloque un lundi*

**La situation.** Une future version de l'app ajoute une colonne au miroir local. Quelqu'un met à jour sans désinstaller.

**Ce qu'on attend.** La base locale se met à niveau sans perdre la file d'attente.

**Où ça en est.** `appliquerSchema` fait `base.script(schema)` et rien d'autre. Le schéma est tout entier en `CREATE TABLE IF NOT EXISTS` : sur une base existante, une table modifiée n'est PAS modifiée. Pas de `PRAGMA user_version`, pas de migration, pas de détection. La première évolution du schéma casse silencieusement les installations existantes — et c'est la base qui contient la soirée non synchronisée.

> `five-scorer-mobile/lib/outbox/base.ts:62-64 ; lib/outbox/baseExpo.ts:60-71 ; db/schema.ts`

### `TRANS-40` — ✗ absent · *bloque un lundi*

**La situation.** L'app plante (erreur JavaScript non rattrapée) pendant un match.

**Ce qu'on attend.** Un écran qui dit quoi faire, et on sait le lendemain que ça a planté.

**Où ça en est.** Expo Router accepte un `export function ErrorBoundary` par route ; aucun n'est déclaré. Aucun Sentry, aucun journal distant. En production, un plantage rend l'app inutilisable sans un mot, et personne ne l'apprend jamais — sauf si quelqu'un le raconte. Le noyau, lui, a bien son écran d'échec (composants/Noyau.tsx:137-154), mais uniquement pour l'ouverture de la base.

> `five-scorer-mobile/app/_layout.tsx:8-32 (aucun `ErrorBoundary` exporté) ; package.json (aucun outil de rapport d'incident)`

### `TRANS-50` — ✔ fait · *bloque un lundi*

**La situation.** Un joueur perd sa session pendant que la file a douze buts à envoyer.

**Ce qu'on attend.** La file s'arrête, garde tout, et le dit.

**Où ça en est.** `encaisserEchec` lève `reconnexionRequise` sur 401, arrête le passage, ne supprime rien, et le drapeau redescend sur la première opération acceptée. Le commentaire raconte le bug d'avant (« le badge restait ambre indéfiniment sans jamais indiquer quoi faire »). C'est tenu et testé.

> `five-scorer-mobile/lib/outbox/sync.ts:307-349 ; lib/outbox/outbox.ts:82-125 ; lib/outbox/sync.test.ts:287-317`

### `TRANS-51` — ✔ fait · *bloque un lundi*

**La situation.** Deux téléphones saisissent le même match programmé ; l'un reste hors réseau et rejoue sa compo le lendemain.

**Ce qu'on attend.** La correction faite en direct n'est pas écrasée.

**Où ça en est.** Trois gardes, chacune avec le récit du bug qu'elle répare : le statut ne se rouvre pas (updateMany conditionnel, :245-248), la compo ne se réécrit que si le match n'en a pas ou s'il est SCHEDULED (:271-275), et un `finishMatch` rejoué est INERTE sur mvpId et durationMin (:181). C'est la partie la plus solide du domaine.

> `five-scorer/app/api/clubs/[clubId]/matches/route.ts:243-299 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:165-192`

### `TRANS-52` — ✔ fait · *bloque un lundi*

**La situation.** L'horloge du téléphone recule pendant la soirée (correction NTP, changement de fuseau).

**Ce qu'on attend.** L'ordre d'envoi ne change pas.

**Où ça en est.** L'ordre se prend sur la clé auto-incrémentée, jamais sur `created_at`, et le mot AUTOINCREMENT est là exprès pour que SQLite ne recycle pas un identifiant libéré. Le commentaire raconte le bug (« un recul suffisait à faire passer le finishMatch devant des buts encore en file »), et un test le prouve.

> `five-scorer-mobile/db/schema.ts (outbox.id AUTOINCREMENT) ; lib/outbox/outbox.ts:9-15 et 66-71 ; db/schema.test.ts`

### `TRANS-53` — ✔ fait · *bloque un lundi*

**La situation.** L'app est tuée en plein milieu d'une soirée hors réseau. On la rouvre le lendemain.

**Ce qu'on attend.** Rien n'est perdu, tout repart.

**Où ça en est.** `void drain.relancer()` est appelé dès l'ouverture de la base. La suppression d'une opération se fait APRÈS l'accusé de réception, le serveur est idempotent, et un test instancie deux drains sur le même fichier pour vérifier que rien ne se perd.

> `five-scorer-mobile/composants/Noyau.tsx:81-83 ; lib/outbox/sync.ts:266-303 ; lib/outbox/sync.test.ts`

### `TRANS-54` — ✔ fait · *bloque un lundi*

**La situation.** Quelqu'un tente de se connecter depuis Expo Go pointé sur la production.

**Ce qu'on attend.** Un refus qu'on comprend, pas « INVALID_ORIGIN ».

**Où ça en est.** La production n'accepte que `fivescorer://` — délibérément, parce que le plugin serveur recopie le jeton de session en clair dans l'URL de redirection pour toute origine de confiance à schéma non-http. L'app traduit le refus en français et dit quoi faire. C'est le seul message d'erreur de l'app qui soit vraiment écrit pour un humain.

> `five-scorer/lib/auth.ts:44-67 ; five-scorer-mobile/app/connexion.tsx:198-218 ; lib/api.ts:73-101`

### `TRANS-55` — ✔ fait · *bloque un lundi*

**La situation.** Le cookie de session grossit (cache de session activé) au-delà de ce que le trousseau iOS accepte.

**Ce qu'on attend.** La session survit.

**Où ça en est.** Le plugin Expo découpe la valeur en morceaux de 1800 caractères et les recolle, et `lireCookie()` est appelé À CHAQUE requête plutôt qu'une fois pour toutes (lib/appel.ts:99-102) — pour qu'une session renouvelée ou une déconnexion se voient au coup d'après.

> `five-scorer-mobile/lib/auth-client.ts:11-15 ; five-scorer/lib/auth.ts:95-97`

### `TRANS-61` — ✔ fait · *bloque un lundi*

**La situation.** Le serveur répond 500 ou 504 (fonction froide, base injoignable) pendant qu'on saisit un but.

**Ce qu'on attend.** On retente, on ne perd rien, et le score continue de monter à l'écran.

**Où ça en est.** Tout est écrit dans la SQLite AVANT d'être envoyé ; le drain classe 5xx, 408, 429 et les erreurs réseau comme réessayables et relance en 5 s → 60 s. `leverSiRefus` conserve le code sur l'objet d'erreur pour que la décision reste une décision de machine. C'est la partie du domaine qui marche le mieux.

> `five-scorer-mobile/lib/outbox/sync.ts:307-349 et 412-430 ; app/match/[id].tsx:282-445`

### `TRANS-01` — ⚠ faux · *gêne un lundi*

**La situation.** Lundi 20 h 05, gymnase d'Urban Guyancourt. Le Wi-Fi ne passe pas derrière les vestiaires. Quelqu'un ouvre l'accueil du club sur l'app pour voir qui est là.

**Ce qu'on attend.** L'app dit « Pas de réseau » dans les mots du club, montre ce qu'elle avait la dernière fois, et propose de réessayer.

**Où ça en est.** `joindre` lève « Impossible de joindre https://five-scorer.vercel.app/api/clubs/xxx/accueil — Network request failed » et l'écran affiche ce texte tel quel en rouge (index.tsx:118). Aucun cache de lecture : seuls la feuille de match et la compo (app/compo.tsx:141-166) ont un miroir local. Le site, lui, a une page /hors-ligne et un service worker qui sert la coquille du club. L'app, qui devait DÉPASSER le site hors-ligne, est en dessous partout sauf sur la feuille.

> `five-scorer-mobile/lib/appel.ts:56-67 et 132-141 ; app/club/[id]/index.tsx:59-62 et 118 ; côté site app/hors-ligne/page.tsx et public/sw.js:1-30`

### `TRANS-03` — ⚠ faux · *gêne un lundi*

**La situation.** On ouvre un onglet du club (Accueil, Matchs, Soirées, Stats, Saison).

**Ce qu'on attend.** Un aller-retour, comme le promet le commentaire d'en-tête de chaque écran.

**Où ça en est.** `useEffect(charger)` ET `useFocusEffect(charger)` se déclenchent tous les deux au montage : deux passages, et chaque passage fait DEUX requêtes (`Promise.all([chargerMoi(), chargerX()])`). Quatre appels au lieu d'un pour ouvrir un onglet — sur le réseau du gymnase, chacun se paie en secondes.

> `five-scorer-mobile/app/club/[id]/stats.tsx:54-78 ; même moule dans index.tsx:67-79, matchs.tsx, soirees.tsx, saison.tsx, effectif.tsx`

### `TRANS-07` — ⚠ faux · *gêne un lundi*

**La situation.** Un joueur tape « Je viens » sur la soirée de lundi, depuis son canapé, et sa session vient d'expirer.

**Ce qu'on attend.** On l'emmène se reconnecter, et sa réponse part une fois reconnecté.

**Où ça en est.** TOUS les gestionnaires de LECTURE testent `e instanceof SessionExpiree` et redirigent. AUCUN gestionnaire d'ÉCRITURE ne le fait : les six cités affichent « Session expirée » comme un message d'erreur ordinaire, sur un écran qui reste là. Le geste est perdu, et rien ne dit quoi faire.

> `five-scorer-mobile/app/soiree/[id].tsx:73-84 ; app/club/[id]/reglages.tsx:104-106 ; app/joueur/fiche.tsx:95-97 et 135-138 ; app/joueur/[id].tsx:385-388 ; app/soiree/nouvelle.tsx:75-77 ; app/calendrier.tsx:144-146`

### `TRANS-09` — ⚠ faux · *gêne un lundi*

**La situation.** Session morte, on ouvre l'accueil du club (ou Matchs, Soirées, Stats, Saison, Effectif).

**Ce qu'on attend.** Toujours le même comportement.

**Où ça en est.** Ces écrans font `Promise.all([chargerMoi(), chargerX(id)])`. `/api/me` répond 401 (donc `SessionExpiree`, donc redirection) et `/api/clubs/.../accueil` répond 404 (donc message brut). `Promise.all` rejette sur la PREMIÈRE des deux qui échoue : le comportement dépend de laquelle revient en premier. Le même écran, la même panne, deux résultats — c'est le pire des deux mondes pour comprendre ce qui se passe.

> `five-scorer-mobile/app/club/[id]/index.tsx:55 ; app/club/[id]/stats.tsx:58 ; five-scorer/app/api/me/route.ts:19-22 vs app/api/clubs/[clubId]/accueil/route.ts:28-31`

### `TRANS-15` — ⚠ faux · *gêne un lundi*

**La situation.** La file s'est fait répondre 401, on se reconnecte, la file est vide (rien à renvoyer). On rouvre une feuille de match.

**Ce qu'on attend.** La pastille dit « À jour ».

**Où ça en est.** `reconnexionRequise` ne redescend QUE sur une opération acceptée (sync.ts:289) ou sur `rejouerBloquees` (:393), jamais appelé. Le drain est créé une fois pour toute la vie de l'app (Noyau.tsx:67) et survit à `router.replace("/connexion")` : la pastille continue donc d'afficher « Reconnecte-toi » en rouge alors qu'on est reconnecté et que tout est parti.

> `five-scorer-mobile/lib/outbox/sync.ts:288-291 et 320-325 ; composants/Noyau.tsx:60-94 ; app/match/[id].tsx:1044`

### `TRANS-42` — ⚠ faux · *gêne un lundi*

**La situation.** On déploie une correction sur le site un lundi à 20 h 30, pendant qu'on saisit un match sur la version web.

**Ce qu'on attend.** La saisie n'est pas interrompue.

**Où ça en est.** Le nouveau service worker appelle `skipWaiting()` à l'installation, prend le contrôle, et `controllerchange` déclenche `window.location.reload()` sur TOUTES les pages ouvertes — feuille de match comprise. Le score est en IndexedDB donc rien n'est perdu, mais l'écran se recharge en plein match, entre deux buts. Le commentaire justifie le rechargement pour la fraîcheur ; personne n'a posé la question du lundi soir.

> `five-scorer/components/RegisterSW.tsx:17-22 ; public/sw.js:104 (skipWaiting) et 109-117`

### `TRANS-02` — ✗ absent · *gêne un lundi*

**La situation.** Réseau à une barre — le vrai cas du gymnase, pire que pas de réseau. On ouvre « Stats ».

**Ce qu'on attend.** Au bout de quelques secondes l'app renonce et le dit, au lieu de tourner.

**Où ça en est.** `joindre` appelle `fetch` sans AbortController ni signal, et aucun écran n'en passe. Le drain de la file coupe à 8 s (DELAI_REJEU_MS, sync.ts:80) et le service worker du site à 4 s / 6 s (sw.js:43-45) — précisément parce que « un fetch sans délai pouvait pendre des minutes ». La moitié lecture de l'app n'a pas cette ceinture : le tourniquet peut tourner indéfiniment.

> `five-scorer-mobile/lib/appel.ts:56-67 et 132-141 ; comparer lib/outbox/sync.ts:77-80 et 123-148 ; côté site public/sw.js:43-53`

### `TRANS-48` — ✗ absent · *gêne un lundi*

**La situation.** On quitte le gymnase, l'app est fermée. Le téléphone reprend la 4G dans la voiture. La soirée n'est pas partie.

**Ce qu'on attend.** Elle part toute seule, sans qu'on y pense.

**Où ça en est.** Le drain ne tourne que quand l'app est vivante : la relance suit `AppState === "active"` (Noyau.tsx:101) et `Network.useNetworkState()` d'un composant monté. Aucune tâche d'arrière-plan. Tant que personne ne ROUVRE l'app, la soirée reste dans le téléphone — et l'accueil du club, pour tout le monde, affiche un score faux.

> `five-scorer-mobile/composants/Noyau.tsx:96-104 et 125-135 ; package.json (pas d'expo-background-task)`

### `TRANS-08` — ◐ partiel · *gêne un lundi*

**La situation.** N'importe quel écran de lecture reçoit un 401 et renvoie vers /connexion.

**Ce qu'on attend.** Le jeton mort est effacé, la base locale est traitée, et on repart propre — comme le fait /session-expiree sur le site.

**Où ça en est.** `router.replace("/connexion")` et rien d'autre : pas de `signOut()`, pas de `purger()`. Le cookie mort reste dans le trousseau, `lireCookie()` continue de le rejouer, et le drain de la file continue de se faire répondre 401. Le site a écrit une route entière pour ce problème (« Un composant serveur ne peut pas effacer un cookie ; une route, si », session-expiree/route.ts:14) ; l'app n'a pas son équivalent.

> `five-scorer-mobile/app/club/[id]/index.tsx:60 (et 9 écrans identiques) ; composants/MenuClub.tsx:67-88 ; côté site app/session-expiree/route.ts:16-51`

### `TRANS-11` — ◐ partiel · *gêne un lundi*

**La situation.** Un simple membre tente un geste réservé aux admins que l'app ne lui a pas caché.

**Ce qu'on attend.** Une phrase du club : « Réservé au capitaine et aux admins. »

**Où ça en est.** `ErreurServeur` compose « Le serveur a répondu 403 — Réservé aux admins. » Le mot du serveur est bien récupéré (`detailDeLErreur`) et il est en français ; mais il est collé derrière un préfixe de machine. On lit un code HTTP au bord d'un terrain.

> `five-scorer-mobile/lib/appel.ts:36-47 et 76-92 ; app/club/[id]/reglages.tsx:105`

### `TRANS-14` — ◐ partiel · *gêne un lundi*

**La situation.** On termine le dernier match, on quitte la feuille, on regarde l'accueil du club. Douze opérations attendent encore le réseau.

**Ce qu'on attend.** L'app le dit, partout, tant que ce n'est pas parti.

**Où ça en est.** `drain.abonner` n'est appelé que dans la feuille de match. Dès qu'on en sort, plus rien n'indique qu'il reste quelque chose à envoyer — sauf si on ouvre le menu et qu'on tente de se déconnecter, qui prévient (MenuClub.tsx:78-87). Sur le site, `SyncBadge` est un composant qu'on pose où l'on veut.

> `five-scorer-mobile/app/match/[id].tsx:137 et 1042-1062 ; composants/MenuClub.tsx:67-88 ; aucun autre écran`

### `TRANS-62` — ✔ fait · *gêne un lundi*

**La situation.** La feuille de match est ouverte, on glisse le pouce depuis le bord gauche en tapant la première tuile.

**Ce qu'on attend.** L'écran de saisie ne s'en va pas au milieu du match.

**Où ça en est.** `gestureEnabled: false` sur `match/[id]`, avec le raisonnement écrit : le geste de retour d'iOS part exactement là où se trouve la première tuile de joueur. C'est le genre de garde qu'on ne trouve qu'en ayant joué avec.

> `five-scorer-mobile/app/_layout.tsx:22-27`

### `TRANS-06` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine retire quelqu'un du club depuis les réglages. La personne rouvre son app.

**Ce qu'on attend.** « Tu ne fais plus partie de ce club » — ou au moins le renvoi vers la liste des clubs.

**Où ça en est.** Le retrait supprime la ligne `member` mais ne touche pas à la session. Sur le SITE, `requireClub` répond `redirect("/onboarding")` (guard.ts:88) : la personne comprend. Sur l'APP, `getClubApiContext` rend `null` et chaque route répond 404 : l'écran affiche « Le serveur a répondu 404 — introuvable ». Les deux moitiés du produit se comportent différemment sur le même événement.

> `five-scorer/app/api/clubs/[clubId]/membres/[memberId]/route.ts:82-88 ; lib/guard.ts:94-109 ; lib/guard.ts:88 (site) ; five-scorer-mobile/app/club/[id]/index.tsx:59-62`

### `TRANS-17` — ⚠ faux · *gêne une saison*

**La situation.** Sur le site, quelqu'un se déconnecte alors que sa file IndexedDB n'est pas vide. Une autre personne se connecte sur le même navigateur.

**Ce qu'on attend.** Une décision claire, la même des deux côtés.

**Où ça en est.** Le site vide le cache du service worker mais garde délibérément Dexie : « une file d'envoi non partie n'est pas à jeter » (UserMenu.tsx:74). L'app fait l'INVERSE : elle purge la SQLite à la déconnexion, « sur un téléphone prêté, la personne suivante ne doit pas ouvrir l'app sur le vestiaire du club précédent » (Noyau.tsx:31-34). Les deux doctrines sont contraires et écrites noir sur blanc. Conséquence côté site : la personne suivante draine la file du précédent sous SON compte.

> `five-scorer/components/UserMenu.tsx:70-82 ; app/c/[slug]/settings/Deconnexion.tsx:12-19 ; lib/sync.ts ; comparer five-scorer-mobile/composants/Noyau.tsx:26-35`

### `TRANS-20` — ⚠ faux · *gêne une saison*

**La situation.** N'importe quel lancement de l'app, y compris un build de production installé sur le téléphone du club.

**Ce qu'on attend.** Rien de personnel ne sort de l'app.

**Où ça en est.** `console.log("[five-scorer] session :", data.user.email)` n'est pas gardé par `__DEV__` — contrairement au bloc du compte de dev (app/connexion.tsx:163) qui l'est explicitement. L'adresse e-mail de l'utilisateur part donc dans le journal système du téléphone à chaque lancement, en production, lisible par Console.app / logcat et par tout outil de collecte de journaux.

> `five-scorer-mobile/app/index.tsx:15-22`

### `TRANS-21` — ⚠ faux · *gêne une saison*

**La situation.** Quelqu'un rejoue à la main la requête de création de match de l'app avec un identifiant qui n'est pas une chaîne.

**Ce qu'on attend.** Refus, comme partout ailleurs : « Toute valeur venue du client et destinée à un `where` doit passer par ici » (lib/ids.ts:23).

**Où ça en est.** La route qui crée un match — celle que la file hors-ligne rejoue en premier — ne passe AUCUN identifiant par `estId` : ni `body.id` (`tx.match.upsert({ where: { id: body.id } })`, :233-238), ni les `playerId` de `teamA`/`teamB` (:195-197), ni `g.id` des invités (:182), ni `seasonId` (:162), `matchDayId` (:206), `opponentId` (:214). La route voisine des buts le fait, et son commentaire raconte le bug que ça a coûté. C'est le trou de la doctrine, à l'endroit le plus exposé.

> `five-scorer/app/api/clubs/[clubId]/matches/route.ts:123-239 (aucun import de lib/ids) ; comparer app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:79-81`

### `TRANS-33` — ⚠ faux · *gêne une saison*

**La situation.** Le téléphone de quelqu'un est resté sur un autre fuseau (vacances, voyage professionnel, téléphone acheté à l'étranger).

**Ce qu'on attend.** « Lundi 7 septembre · 20:00 », comme sur le site et comme sur le terrain.

**Où ça en est.** Aucune des formatations de date de l'app ne passe `timeZone` : elles utilisent le fuseau du téléphone. Le site a un fichier entier pour ça (`lib/dates.ts`, constante `FUSEAU = "Europe/Paris"`) écrit après le bug « une soirée à 19 h s'annonçait à 17 h » — et ce fichier est `import "server-only"`, donc il n'est PAS dans la liste de `lib/noyau/copie-conforme.test.ts`. L'app n'a aucun équivalent. Un téléphone à New York annonce la soirée à 14:00.

> `five-scorer-mobile/app/club/[id]/index.tsx:290-308 ; app/match/[id].tsx:1020-1028 ; app/compo.tsx:307-313 ; app/soiree/nouvelle.tsx:105-111 ; app/calendrier.tsx:153 ; comparer five-scorer/lib/dates.ts:1-20`

### `TRANS-34` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine pose le calendrier de la saison depuis l'app, alors qu'il est en déplacement dans un autre fuseau.

**Ce qu'on attend.** 44 lundis à 20 h, heure de Paris.

**Où ça en est.** Les dates sont construites par `new Date(a, m, j, heures, minutes)` — minuit local du TÉLÉPHONE — puis envoyées en ISO. Le choix est assumé (« la personne qui prépare le calendrier est celle qui joue »), mais il ne tient que si elle est à Paris. Depuis un fuseau à l'ouest de UTC−4, un lundi 20 h local tombe le mardi en UTC : le serveur le range au mauvais jour civil et le site l'affiche « Mardi 02:00 ».

> `five-scorer-mobile/lib/calendrier.ts:9-11 et 105-113 ; app/calendrier.tsx:69-71 et 134 ; côté serveur lib/calendrier-serveur.ts:19 et 159-170`

### `TRANS-35` — ⚠ faux · *gêne une saison*

**La situation.** Le serveur compare deux soirées pour savoir si c'est « le même jour » (anti-doublon du calendrier).

**Ce qu'on attend.** Le jour se juge dans le fuseau du club, Europe/Paris.

**Où ça en est.** Le commentaire promet « Le jour est celui du SERVEUR et non UTC » — mais `d.getFullYear()/getMonth()/getDate()` rendent le jour du PROCESSUS, et lib/dates.ts documente précisément qu'« en production, une fonction Vercel tourne en UTC ». `jourCle`, `debutDeJournee` et `finDeJournee` n'utilisent donc pas `FUSEAU`, alors que `minuit()` et `quantieme()` existent dans lib/dates.ts exactement pour ça. Sans conséquence pour une soirée à 20 h ; faux dès qu'une soirée est saisie après 22 h en hiver ou depuis un fuseau à l'ouest.

> `five-scorer/lib/calendrier-serveur.ts:155-170 ; comparer lib/dates.ts:1-20 et 63-95`

### `TRANS-18` — ✗ absent · *gêne une saison*

**La situation.** Un téléphone est perdu dans le vestiaire, ou volé.

**Ce qu'on attend.** Le capitaine (ou le propriétaire) peut couper l'accès depuis un autre appareil.

**Où ça en est.** La session vaut 90 jours, renouvelée à chaque visite (auth.ts:93). Aucun écran ne liste les appareils connectés, aucun n'appelle `revokeSessions` de Better Auth, et retirer la personne du club (TRANS-06) ne tue pas sa session. Changer son mot de passe n'est pas non plus proposé dans l'app. Il n'existe aucun geste pour reprendre un accès donné.

> `aucun — ni five-scorer/app/c/[slug]/settings, ni five-scorer-mobile/app/club/[id]/reglages.tsx ; lib/auth.ts:87-98`

### `TRANS-25` — ✗ absent · *gêne une saison*

**La situation.** Quelqu'un essaie des codes d'invitation au hasard, ou martèle la connexion.

**Ce qu'on attend.** Le serveur ralentit au bout de quelques essais.

**Où ça en est.** Aucune limite de débit n'est configurée : ni sur Better Auth, ni sur nos routes. Seul le client SAIT lire un 429 (lib/sync.ts:286, sync.ts:312) — mais rien n'en émet. Le code d'invitation est un cuid2 tronqué à 12 caractères, donc pratiquement pas devinable ; l'absence de limite reste une porte ouverte pour saturer les fonctions et la base.

> `five-scorer/lib/auth.ts:69-122 (aucune option `rateLimit`) ; app/api/rejoindre/route.ts ; toutes les routes app/api/clubs/**`

### `TRANS-26` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine poste la compo sur WhatsApp le vendredi. Trois joueurs ne l'ouvrent pas avant lundi.

**Ce qu'on attend.** L'app prévient : « Ta compo est prête », « Il manque une réponse pour lundi ».

**Où ça en est.** Rien n'existe : aucune dépendance, aucune permission déclarée, aucun jeton stocké, aucun envoi. La décision est écrite ailleurs, et elle est assumée : « Construire des notifications, c'est demander une permission, gérer des jetons, tenir un service. Un abonnement iCal fait la même chose avec un lien » (app/api/cal/[token]/route.ts:9-13). La spec doit dire si cette décision tient maintenant qu'il y a une VRAIE app, qui peut recevoir une notification sans service tiers.

> `aucun — ni expo-notifications dans five-scorer-mobile/package.json, ni permission dans app.json, ni route serveur, ni table de jetons dans five-scorer/prisma/schema.prisma`

### `TRANS-27` — ✗ absent · *gêne une saison*

**La situation.** Un joueur veut être rappelé du lundi sans coller un lien iCal à la main.

**Ce qu'on attend.** Un réglage dans l'app : « Rappelle-moi le dimanche soir. »

**Où ça en est.** Le lien iCal existe et l'app sait le partager — mais il est dans les RÉGLAGES, donc réservé à qui gère le club (la route `/reglages` exige `canManage`). Un simple membre n'a aucun moyen de s'abonner au calendrier depuis l'app. Le seul rappel du club est hors de portée de la moitié du club.

> `five-scorer/app/api/cal/[token]/route.ts:6-17 ; five-scorer-mobile/app/club/[id]/reglages.tsx:559 (partage du lien agenda)`

### `TRANS-29` — ✗ absent · *gêne une saison*

**La situation.** Un admin corrige un score après coup (le sujet de la spec 0001).

**Ce qu'on attend.** Ceux que ça concerne l'apprennent — sinon la correction se découvre dans le classement, et ça finit en discussion.

**Où ça en est.** La spec 0001 renvoie explicitement le sujet ici : « rien dans cette spec — WhatsApp existe ; on y reviendra avec les notifications ». Cette spec-ci doit trancher, ou dire qu'on ne tranche pas.

> `aucun ; la spec 0001 le pose déjà en Q7 (specs/0001-corriger-un-match/spec.md)`

### `TRANS-32` — ✗ absent · *gêne une saison*

**La situation.** Quelqu'un a réglé son iPhone sur une grande taille de texte (Accessibilité → Texte plus grand).

**Ce qu'on attend.** L'app reste lisible et utilisable, en particulier la feuille de match.

**Où ça en est.** React Native met à l'échelle tous les `<Text>` par défaut. Les tailles sont posées en dur partout (score à 132 avec `lineHeight: 138`, nom d'équipe 22, tuile de joueur, barre du bas à 64 px de haut avec libellé 13). Rien n'est borné, rien n'est testé à grande taille : à 200 %, la barre du bas et les deux cartes d'équipe se chevauchent. Personne n'a jamais ouvert cet écran dans ces conditions.

> `five-scorer-mobile — aucune occurrence de `allowFontScaling`, `maxFontSizeMultiplier`, `useWindowDimensions` ni `fontScale` dans app/ ou composants/`

### `TRANS-57` — ✗ absent · *gêne une saison*

**La situation.** Un joueur sans compte (créé par le capitaine) ou un invité d'un soir : il n'y a personne à prévenir, et personne à qui demander une réponse.

**Ce qu'on attend.** La spec des notifications dit explicitement que cette moitié du vestiaire ne reçoit rien, et par quoi on la remplace.

**Où ça en est.** Un `Player` sans `userId` n'a ni session, ni appareil, ni adresse. Le RSVP exige d'ailleurs d'être soi-même ou admin (rsvp/route.ts:51). Toute règle de notification devra dire qui répond POUR eux — et c'est exactement le fonctionnement WhatsApp actuel du club.

> `five-scorer/prisma/schema.prisma (Player.userId nullable) ; app/api/clubs/[clubId]/soirees/[matchDayId]/rsvp/route.ts:48-53`

### `TRANS-19` — ◐ partiel · *gêne une saison*

**La situation.** On prête son téléphone à un remplaçant pour qu'il regarde le classement. La session est morte depuis, l'app affiche des erreurs.

**Ce qu'on attend.** Rien du club précédent n'est lisible sans session valide.

**Où ça en est.** La purge n'est déclenchée QUE par le bouton « Se déconnecter » du menu du club. Une session expirée, un compte supprimé, un retrait du club : rien ne purge. La base `five-scorer.db` garde les clubs, l'effectif (noms, photos, niveaux), les matchs, les participants et les buts — et la feuille de match les lit sans jamais interroger le serveur.

> `five-scorer-mobile/composants/Noyau.tsx:38-40 et 74-79 ; lib/outbox/baseExpo.ts:16-19 ; app/match/[id].tsx`

### `TRANS-30` — ◐ partiel · *gêne une saison*

**La situation.** Un joueur malvoyant du club ouvre l'app avec VoiceOver.

**Ce qu'on attend.** Chaque bouton se nomme, chaque état se dit.

**Où ça en est.** La feuille de match est bien étiquetée — c'est l'écran qu'on tape sans regarder, et ça se voit dans le code. Ailleurs c'est très mince : 15 `accessibilityLabel` et 9 `accessibilityRole` pour toute l'app. Aucun `accessibilityHint`, cinq `accessibilityState` en tout. La barre du bas (app/club/[id]/_layout.tsx:129) a un rôle mais pas d'état sélectionné : VoiceOver ne dit pas sur quel onglet on est.

> `five-scorer-mobile/app/match/[id].tsx:627-632, 672-675, 698, 956 ; composants/base.tsx:246 ; composants/Etoiles.tsx:22 ; le reste des écrans`

### `TRANS-41` — ◐ partiel · *gêne une saison*

**La situation.** Le capitaine colle le lien d'invitation dans WhatsApp. Un nouveau, qui a déjà installé l'app, tape dessus.

**Ce qu'on attend.** L'app s'ouvre sur « Rejoindre le club », le code déjà rempli.

**Où ça en est.** Le lien partagé est `https://five-scorer.vercel.app/join/<code>` (reglages.tsx:424). Aucun lien universel n'est déclaré : il ouvre Safari, pas l'app. L'écran `app/rejoindre.tsx` existe et sait recoller un lien complet (lib/rejoindre.ts:56-72 accepte l'URL entière) — il faut donc copier-coller à la main. Le seul schéma déclaré est `fivescorer://` (app.json:38), que personne ne colle dans WhatsApp.

> `five-scorer-mobile/app.json (ni `associatedDomains` iOS, ni `intentFilters` Android) ; app/rejoindre.tsx ; five-scorer/app/join/[code]`

### `TRANS-56` — ◐ partiel · *gêne une saison*

**La situation.** On saisit une soirée d'il y a six mois en mode rétro, dans une saison déjà clôturée.

**Ce qu'on attend.** Une règle claire sur ce qu'on peut encore toucher.

**Où ça en est.** Le serveur ne connaît qu'une seule barrière dans le temps : le statut FINISHED, qui exige `canManage`. Aucune fenêtre, aucune clôture de saison qui verrouille. La seule notion de fenêtre du dépôt est le « rattrapable » du calendrier de saison (six semaines) et elle ne sert qu'à AFFICHER un bouton. La spec 0001 pose la question (Q2) ; ce domaine confirme que le code ne tranche rien.

> `five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:146-154 ; app/api/clubs/[clubId]/saison/route.ts:128 ; specs/0001-corriger-un-match/spec.md (Q2)`

### `TRANS-60` — ◐ partiel · *gêne une saison*

**La situation.** Une requête falsifiée arrive depuis un autre site pendant qu'un admin est connecté au site.

**Ce qu'on attend.** Elle est refusée.

**Où ça en est.** Nos routes ne vérifient aucune origine ni jeton anti-rejeu : elles s'appuient entièrement sur le cookie de session, en SameSite=Lax par défaut de Better Auth, et sur l'absence d'en-têtes CORS (seule /api/public/[slug] en pose). Ça tient — mais c'est une règle tenue par le navigateur, pas par le serveur, et rien ne le dit dans le code. Better Auth, lui, contrôle l'origine sur ses propres routes.

> `five-scorer/middleware.ts ; toutes les routes app/api/clubs/** ; five-scorer/lib/auth.ts:44-67`

### `TRANS-59` — ✔ fait · *gêne une saison*

**La situation.** Quelqu'un tente de poser un calendrier de 500 soirées, ou de zéro.

**Ce qu'on attend.** Un refus qui dit pourquoi.

**Où ça en est.** Le serveur plafonne à 120 soirées et refuse une liste vide, avec un message en français ; le générateur du téléphone a le même plafond. C'est le seul endroit du domaine où les bornes (0, 1, 120) sont explicitement traitées des deux côtés.

> `five-scorer/lib/calendrier-serveur.ts:15 et 52-60 ; five-scorer-mobile/lib/calendrier.ts:118-120`

### `TRANS-36` — ⚠ faux · *confort*

**La situation.** Un admin exporte les matchs de la saison en CSV.

**Ce qu'on attend.** La date de chaque match dans le fuseau du club.

**Où ça en est.** `m.playedAt.toISOString().slice(0, 10)` rend le jour UTC. Un match commencé à 20 h reste au bon jour ; un match saisi tard (ou en mode rétro avec une heure de fin) bascule au lendemain dans le fichier que le club garde comme archive.

> `five-scorer/app/api/clubs/[clubId]/export/route.ts:116 ; comparer lib/dates.ts:60-61 (dateComplete)`

### `TRANS-43` — ⚠ faux · *confort*

**La situation.** On lance l'app dans un navigateur (cible web d'Expo, pour travailler sans téléphone).

**Ce qu'on attend.** Les écrans authentifiés fonctionnent.

**Où ça en est.** Un navigateur INTERDIT de poser l'en-tête `cookie` par script (c'est un en-tête interdit) et `credentials: "omit"` empêche l'envoi automatique. Tous les appels authentifiés partent donc anonymes en cible web : 401 sur tout. Seule la vitrine publique fonctionne — et c'est d'ailleurs pour elle qu'on a mis des en-têtes CORS (app/api/public/[slug]/route.ts:22-27). La cible web ne sert donc qu'à la page publique.

> `five-scorer-mobile/lib/appel.ts:106-141 (`credentials: "omit"`, en-tête `cookie` posé à la main) ; lib/outbox/sync.ts:129-144 ; comparer lib/api.ts:248-265 (chargerVitrine, qui, elle, marche)`

### `TRANS-04` — ✗ absent · *confort*

**La situation.** Sur « Stats », on tape deux fois de suite sur le sélecteur de saison, vite.

**Ce qu'on attend.** Le tableau affiche la dernière saison demandée.

**Où ça en est.** Aucune annulation, aucun jeton de requête : `setD(r)` écrit ce qui arrive, dans l'ordre où ça arrive. La réponse de la saison A peut donc écraser celle de la saison B et le tableau ment jusqu'au prochain rafraîchissement.

> `five-scorer-mobile/app/club/[id]/stats.tsx:54-70 ; app/club/[id]/saison.tsx:49-65`

### `TRANS-31` — ✗ absent · *confort*

**La situation.** VoiceOver actif, on marque un but pendant le match.

**Ce qu'on attend.** Le nouveau score s'annonce.

**Où ça en est.** Le score est deux `<Text>` de 132 points, sans `accessibilityLiveRegion`, sans `accessibilityRole="text"` groupé, sans annonce. La seule confirmation d'un but est visuelle, sonore (lib/son/son.ts) et haptique (lib/vibrer.ts) — la vibration et le son sauvent en partie le cas, mais rien ne dit LE SCORE.

> `five-scorer-mobile/app/match/[id].tsx:493 et 523 (composant Chiffre), 1030-1037`

### `TRANS-45` — ✗ absent · *confort*

**La situation.** Un téléphone est restauré depuis une sauvegarde iCloud sur un autre appareil, ou l'iPhone du club est partagé sur un identifiant Apple familial.

**Ce qu'on attend.** Le vestiaire du club ne se promène pas.

**Où ça en est.** `five-scorer.db` est ouverte par expo-sqlite dans le répertoire Documents, qui est sauvegardé dans iCloud. Rien ne l'en exclut. Elle contient l'effectif complet (noms, surnoms, photos, niveaux), les compos et tous les buts. Le cookie de session, lui, est bien dans le trousseau (expo-secure-store) — donc la donnée voyage sans la clé, ce qui limite la casse.

> `five-scorer-mobile/lib/outbox/baseExpo.ts:16-19 et 66-71 ; app.json (aucune exclusion de sauvegarde)`

### `TRANS-22` — ◐ partiel · *confort*

**La situation.** Le formulaire d'édition d'un match du site envoie un homme du match ou une saison.

**Ce qu'on attend.** Même garde que partout.

**Où ça en est.** `matchId` passe par `idsValides` (:44) mais `input.mvpId` et `input.seasonId` partent directement dans `prisma.player.count({ where: { id: input.mvpId } })` et `prisma.season.count(...)` (:56-67) sans `estIdOuVide`. La conséquence pratique est une erreur 500 plutôt qu'une fuite, mais la règle est enfreinte à l'endroit exact que lib/ids.ts vise.

> `five-scorer/app/actions/matches.ts:44-67 ; lib/ids.ts:39-43`

### `TRANS-23` — ◐ partiel · *confort*

**La situation.** Suppression d'un but par la file hors-ligne.

**Ce qu'on attend.** L'identifiant est contrôlé avant d'entrer dans un `where`.

**Où ça en est.** `eventId` vient de la chaîne de requête — c'est donc toujours une chaîne, l'injection d'objet est impossible et le risque est nul. Mais il n'est ni borné ni passé par `estId`, contrairement au POST (:79) et au PATCH (:169) du même fichier. Trois portes, deux gardées.

> `five-scorer/app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:231-239`

### `TRANS-24` — ◐ partiel · *confort*

**La situation.** Un client envoie `durationMin` sous une forme inattendue en terminant un match.

**Ce qu'on attend.** 400, pas 500.

**Où ça en est.** `body.durationMin` est écrit tel quel dans `prisma.match.update` sans contrôle de type ni de borne. Une valeur absurde (négative, 100000) est acceptée telle quelle et se retrouve dans la durée moyenne des matchs.

> `five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts:113-120 et 190-192`

### `TRANS-44` — ◐ partiel · *confort*

**La situation.** On désassemble le bundle de l'app publiée.

**Ce qu'on attend.** Aucun secret dedans.

**Où ça en est.** La chaîne `demo-five-2026` est un littéral du module, pas un bloc gardé par `__DEV__` : elle est présente dans le bundle de production. À l'exécution `COMPTE_DEV` vaut `null` quand l'adresse n'est pas locale, et le bouton est en plus derrière `__DEV__` (app/connexion.tsx:163). Le commentaire assume : « il n'ouvre rien d'autre qu'un Postgres sur le Mac ». C'est vrai aujourd'hui — la spec doit dire si on veut que ça le reste.

> `five-scorer-mobile/lib/api.ts:765-773 (COMPTE_DEV)`

### `TRANS-46` — ◐ partiel · *confort*

**La situation.** Sur le site, une session expire pendant qu'on lit la page d'un match. On se reconnecte.

**Ce qu'on attend.** On revient exactement là où on était.

**Où ça en est.** Le middleware pose `next=pathname` — sans la chaîne de requête. On revient sur `/c/renault/stats` et pas sur `/c/renault/stats?saison=2026`. `next` est bien validé (`startsWith("/")`, login/page.tsx:19), donc pas de redirection ouverte. C'est un retour approximatif, pas un trou.

> `five-scorer/middleware.ts:32-36 ; app/login/page.tsx:19`

### `TRANS-49` — ◐ partiel · *confort*

**La situation.** On lance l'app hors réseau et on ouvre la feuille du match en cours.

**Ce qu'on attend.** La pastille dit « Hors ligne ».

**Où ça en est.** `etat.enLigne` vaut `true` par défaut (sync.ts:103) et `Reseau` refuse volontairement de déclarer hors ligne sur une inconnue (Noyau.tsx:131, bonne décision pour la file). Conséquence sur l'affichage : la pastille annonce « À jour » pendant le temps du premier sondage d'expo-network, alors qu'on n'a aucun réseau. La décision est juste pour la file, fausse pour ce que l'humain lit.

> `five-scorer-mobile/lib/outbox/sync.ts:102-110 ; composants/Noyau.tsx:125-135 ; app/match/[id].tsx:1042-1053`

### `TRANS-58` — ◐ partiel · *confort*

**La situation.** Un rejeu bloqué est enfin débloqué (droits rétablis, reconnexion), et il y avait aussi des opérations bloquées d'un AUTRE club ou d'une autre soirée.

**Ce qu'on attend.** On relance ce qu'on a compris, pas tout.

**Où ça en est.** `debloquerToutes` fait `UPDATE outbox SET blocked_at = NULL WHERE blocked_at IS NOT NULL` — tous clubs, tous matchs, sans distinction — et remet les compteurs de tentatives à zéro. Sur l'app la question est théorique (rien ne l'appelle, cf. TRANS-13) ; sur le site, un tap sur la pastille relance des opérations qui seront à nouveau refusées, en boucle.

> `five-scorer-mobile/lib/outbox/outbox.ts:148-156 ; lib/outbox/sync.ts:390-397 ; côté site components/SyncBadge.tsx:53-56`

## Regard : le nouveau venu

*13 cas — 0 faits, 0 partiels, 3 absents, **10 faux**.*

### `REG-N01` — ⚠ faux · *bloque un lundi*

**La situation.** Le nouveau n'a pas le lien sous la main. Au téléphone, le capitaine lui lit le code qu'il voit dans ses Réglages — « A7K2M9QX ». Ça ne marche pas. Le capitaine essaie alors de fabriquer le lien avec ce code : la page répond « Lien invalide ou expiré. Demande un nouveau lien au capitaine — les codes peuvent être régénérés. » Il régénère.

**Ce qu'on attend.** Le code affiché est celui qui marche. Et un code qui ne marche pas ne doit pas s'annoncer comme « expiré » : c'est ce mot qui pousse à régénérer.

**Où ça en est.** Les deux Réglages affichent `inviteCode.slice(-8).toUpperCase()` (app/c/[slug]/settings/page.tsx:78 et app/api/clubs/[clubId]/reglages/route.ts:107) : huit lettres majuscules qui ne sont NI le code (un cuid entier, ou 12 caractères après régénération, app/actions/club.ts:73) NI acceptables par `findUnique({ where: { inviteCode } })`. Le champ « Rejoindre » pardonne beaucoup — `normaliserCode` accepte le lien entier et abaisse la casse (lib/rejoindre.ts:56-71) — mais la page /join/[code] n'y passe PAS : elle interroge la base avec le segment d'URL brut (app/join/[code]/page.tsx:20-21). Et son message de refus accuse le lien plutôt que la saisie (:41-46). Le capitaine régénère alors le code — geste irréversible qui tue les liens déjà envoyés à trois autres personnes (REG-21), pour un code qui n'avait jamais expiré.

> `Site : app/c/[slug]/settings/page.tsx:78, app/join/[code]/page.tsx:20-21,41-46, lib/rejoindre.ts:56-71 (`normaliserCode`), app/actions/club.ts:70-79 (`regenerateInviteCode`). App : app/api/clubs/[clubId]/reglages/route.ts:103-107 (`affiche`), five-scorer-mobile/app/club/[id]/reglages.tsx:409-441.`

### `SOIREE-N01` — ⚠ faux · *bloque un lundi*

**La situation.** Le nouveau, samedi, tape « Je serai là » depuis l'accueil. La soirée est déjà complète (douze abonnés, capacité 12) : il est treizième. L'accueil affiche alors sa réponse.

**Ce qu'on attend.** On lui dit qu'il est sur la liste d'attente, pas qu'il est « Présent ». Sinon il prend la voiture lundi pour rien.

**Où ça en est.** `lib/presences.ts` calcule bien `rang` et `enAttente` pour chaque joueur (:38-40, :104-112), et la page de la soirée l'utilise (app/c/[slug]/sessions/[id]/page.tsx:97 → SessionRsvpAdmin affiche « En attente »). Mais l'accueil ne le lit jamais : `maReponse` ne rend que le statut brut du RSVP (app/c/[slug]/page.tsx:398) et `BoutonPresence` le traduit par la table `LIBELLES = { IN: "Présent", … }` (BoutonPresence.tsx:8-12), affichée telle quelle une fois la réponse envoyée (:31-41). `grep attente app/c/[slug]/page.tsx` ne rend RIEN. Côté app c'est pareil : la route accueil calcule `attente: presences.attente.length` (:110) mais rend `maReponse` en statut brut (:115), et la bannière n'affiche que ça (five-scorer-mobile/app/club/[id]/index.tsx:122-133). Le même écran dit « 12 présents · complet » deux lignes plus haut — et « Présent » sur la ligne du treizième.

> `Site : app/c/[slug]/_accueil/BoutonPresence.tsx:8-12,31-41, app/c/[slug]/page.tsx:398, lib/presences.ts:38-40,104-112. App : app/api/clubs/[clubId]/accueil/route.ts:109-115, five-scorer-mobile/app/club/[id]/index.tsx:122-133.`

### `COMPTES-N01` — ⚠ faux · *gêne un lundi*

**La situation.** Jeudi soir. Le nouveau ouvre le lien WhatsApp sur son téléphone, dans un navigateur qui porte encore un vieux cookie Five Scorer (un ancien compte, une session morte pendant l'été, un navigateur partagé). Il n'est plus reconnu, la page d'invitation lui propose donc « Créer un compte et rejoindre ».

**Ce qu'on attend.** Il crée son compte et entre dans le club, comme n'importe qui d'autre. Le code qu'on lui a envoyé ne doit pas se perdre entre deux écrans.

**Où ça en est.** Le lien « Créer un compte et rejoindre » pointe sur /signup?next=%2Fjoin%2F<code> (app/join/[code]/page.tsx:88-91). Le middleware juge la session sur la SEULE PRÉSENCE du cookie (middleware.ts:22 `getSessionCookie`) : il croit l'utilisateur connecté et renvoie sur /onboarding — `NextResponse.redirect(new URL("/onboarding", req.url))` (middleware.ts:26), qui ABANDONNE la chaîne de requête. /onboarding appelle requireUser(), la vraie session est morte, on part sur /session-expiree, qui nettoie les cookies et redirige sur `/login?session=expiree` (app/session-expiree/route.ts:26) — encore sans `next`. Le nouveau se retrouve sur un écran de connexion nu, sans compte et sans code : il doit retourner chercher le lien dans WhatsApp. Le même trou avale `next` pour tout le monde, mais ici c'est la seule porte d'entrée du club.

> `Site : middleware.ts:25-26, app/join/[code]/page.tsx:88-99, app/session-expiree/route.ts:26, app/login/page.tsx:21. App : aucun (le lien n'ouvre pas l'app, cf. TRANS-41).`

### `DIRECT-N01` — ⚠ faux · *gêne un lundi*

**La situation.** Karim est venu trois lundis comme invité : le capitaine tapait « + Invité · Karim » à chaque fois. Ce jeudi il rejoint le club par le lien. Lundi, on compose la feuille : il y a deux « Karim » dans la liste, et au moment du but il faut taper sur la bonne tuile.

**Ce qu'on attend.** Un seul Karim sur la feuille. Ses trois lundis d'invité le suivent, ou au minimum on distingue les deux fiches d'un coup d'œil avant le coup d'envoi.

**Où ça en est.** `assurerProfilJoueur` n'adopte que des fiches `isGuest: false` (lib/rejoindre.ts:97-100) : la fiche invitée de Karim, avec ses trois matchs et ses buts, n'est jamais rattachée — une deuxième fiche vide est créée. Karim ne peut pas non plus la revendiquer : `rattacherJoueur` refuse explicitement (« Un invité ne peut pas être revendiqué. », lib/rattachement.ts:98-103), et aucun geste ne transforme une fiche invitée en fiche normale (`nettoyerJoueur` accepte `isGuest` mais aucun écran ne l'envoie). Les deux fiches arrivent ensemble dans la compo et sur la feuille : la page de la soirée charge tous les joueurs non archivés, invités compris (app/c/[slug]/sessions/[id]/page.tsx:60-64), la route roster aussi (app/api/clubs/[clubId]/roster/route.ts:22-24), et la tuile n'affiche que `name` (components/PlayerTile.tsx:113,134) — deux tuiles « Karim » identiques, l'une avec une photo, l'autre sans. Le premier but du nouveau membre a une chance sur deux d'aller sur la fiche d'un fantôme, et APRES-20 interdira ensuite de le rendre à son auteur.

> `Site : lib/rejoindre.ts:97-100 (l'adoption ignore `isGuest`), app/c/[slug]/sessions/[id]/page.tsx:60-64 (les invités sont dans la liste), components/CompoSoiree.tsx, components/PlayerTile.tsx:113,134, lib/rattachement.ts:98-103. App : five-scorer-mobile/app/compo.tsx, app/api/clubs/[clubId]/roster/route.ts:22-24.`

### `VEST-N01` — ⚠ faux · *gêne un lundi*

**La situation.** Le nouveau s'inscrit. Selon ce qu'il tape — ou ce que Google lui renvoie — son nom peut être « karim  b », « Karim Benzema Junior de Guyancourt », ou coller de 300 caractères. Puis il rejoint le club par le lien.

**Ce qu'on attend.** Le nom qui entre au vestiaire est propre et borné, comme celui qu'un capitaine tape dans une fiche : 60 caractères, sans espaces en trop.

**Où ça en est.** `assurerProfilJoueur` crée la fiche avec `data: { clubId, name: user.name, userId: user.id }` (lib/rejoindre.ts:114-116) : ni `trim`, ni `slice`, ni passage par `nettoyerJoueur` — alors que la MÊME base impose 60 caractères dès qu'un admin remplit une fiche (lib/joueur.ts:44). Rien ne borne le nom en amont non plus : ni le champ du site (app/signup/SignupForm.tsx:82-95), ni celui de l'app (five-scorer-mobile/app/connexion.tsx:90-100), ni Better Auth (lib/auth.ts:76-79). Ce nom s'affiche ensuite en entier sur la tuile de la feuille de match (components/PlayerTile.tsx:113 et 134, `<span className="nom">{name}</span>`), dans le classement, sur la pelouse de la compo et dans la carte de partage. Un seul membre mal inscrit rend la feuille du lundi illisible, et seul un admin peut réparer.

> `Site : lib/rejoindre.ts:114-116 (`prisma.player.create`), lib/joueur.ts:44 (`nettoyerJoueur` : `name?.trim().slice(0, 60)`), app/signup/SignupForm.tsx:82-95 (aucun `maxLength`), components/PlayerTile.tsx:113,134. App : five-scorer-mobile/app/connexion.tsx:90-100 (champ Nom, aucune borne).`

### `VEST-N03` — ⚠ faux · *gêne un lundi*

**La situation.** Le nouveau rejoint le jeudi. Lundi, personne n'a ouvert sa fiche. Le capitaine tape « Équilibrer » pour faire les deux équipes.

**Ce qu'on attend.** Le générateur sait qu'on ne connaît pas encore ce joueur — ou au moins, le capitaine voit qu'il reste des fiches à noter avant de tirer les équipes.

**Où ça en est.** La fiche créée en rejoignant ne porte aucun niveau : elle prend le défaut de la base, `skill Int @default(3)` (prisma/schema.prisma:219), parce que `assurerProfilJoueur` n'écrit que `clubId`, `name` et `userId` (lib/rejoindre.ts:114-116). Or `strength(p) = p.skill + (p.form ?? 0) * 0.5` (lib/balance.ts:31) : l'équilibrage compte ce 3 comme une note, au même titre que le 3 d'un joueur que le capitaine a réellement évalué. Rien dans le schéma ni dans l'affichage ne distingue « niveau 3 » de « jamais noté » : la fiche annonce « Niveau 3 » à tout le club (app/c/[slug]/players/[id]/page.tsx:69) et le vestiaire lui dessine trois étoiles pleines. Le premier lundi d'un nouveau — celui où on ne sait justement pas ce qu'il vaut — est celui où l'équilibrage se trompe le plus, sans le dire.

> `Site : prisma/schema.prisma:219 (`skill Int @default(3)`), lib/rejoindre.ts:114-116, lib/balance.ts:31,47-58, components/CompoSoiree.tsx, app/c/[slug]/players/[id]/page.tsx:69 (« Niveau {player.skill} » dans le sous-titre). App : five-scorer-mobile/lib/noyau/balance.ts, five-scorer-mobile/app/club/[id]/effectif.tsx (étoiles).`

### `COMPTES-N02` — ⚠ faux · *gêne une saison*

**La situation.** Le nouveau crée son compte (depuis l'App Store, ou depuis la page d'accueil) et arrive sur « Mes clubs ». Avant même de savoir où est son club, on lui propose : « L'appli a changé de peau, pas de mémoire. Les matchs et joueurs d'avant la v2 sont dans le club « … ». Saisis l'ancien PIN admin pour en devenir capitaine. »

**Ce qu'on attend.** Un compte neuf ne se voit pas proposer de prendre la capitainerie d'un club qu'il ne connaît pas. Et si la reprise est fermée, on n'en parle pas du tout.

**Où ça en est.** `getUnclaimedLegacyClub()` (lib/legacy.ts:14-21) ne regarde QUE si le club historique existe et n'a aucun membre — il ne consulte jamais `revendicationOuverte()` (lib/legacy.ts:41-42, `LEGACY_CLAIM_OPEN === "1"`). La page d'onboarding affiche donc la carte et le champ PIN à TOUT compte neuf (app/onboarding/page.tsx:49-58), avec le nom du club historique en clair. Le refus n'arrive qu'après l'envoi, dans `claimLegacyClub` (lib/legacy.ts:52-57). Le garde tient — rien n'est pris — mais la première chose que voit un nouveau membre, c'est une invitation à revendiquer l'historique d'un club, avec un code à quatre chiffres pour cible.

> `Site : app/onboarding/page.tsx:29,49-58, lib/legacy.ts:14-21,41-56, app/onboarding/ClaimLegacyForm.tsx. App : aucun écran équivalent (donc rien à corriger côté app).`

### `COMPTES-N03` — ⚠ faux · *gêne une saison*

**La situation.** Le nouveau a entendu parler de l'app avant de recevoir le lien. Il crée son compte depuis la page d'accueil (ou depuis l'app puis passe sur le site). Il arrive sur « Ton club t'attend ».

**Ce qu'on attend.** Le geste normal d'un compte neuf, dans ce club, c'est d'ENTRER dans un club existant. « Rejoindre » passe devant ; « Créer un club » attend qu'on le demande.

**Où ça en est.** Sur /onboarding, la section « Créer un club » est écrite AVANT « Rejoindre un club » (app/onboarding/page.tsx:61 puis :80), et quand le compte n'a aucun club le formulaire de création est DÉPLIÉ d'office (`clubs.length === 0` → `<CreateClubForm />` nu, :63-68) tandis que « Rejoindre » reste un champ de texte en bas de page. L'app mobile fait exactement l'inverse — bouton plein « J'ai un lien d'invitation » quand il n'y a aucun club (five-scorer-mobile/app/clubs.tsx:100-113). Résultat côté site : un nouveau qui n'a pas encore son lien sous la main crée « Renault Five » bis, devient capitaine d'un club vide, et le vrai club a maintenant un jumeau qui ne se supprime pas (aucune suppression de club nulle part, cf. COMPTE-32).

> `Site : app/onboarding/page.tsx:61-79 (Créer) vs 80-89 (Rejoindre), app/onboarding/CreateClubForm.tsx. App : five-scorer-mobile/app/clubs.tsx:100-113 (l'app fait l'inverse, et n'a pas de création de club).`

### `COMPTES-N04` — ✗ absent · *gêne une saison*

**La situation.** Le nouveau installe l'app et tape « Créer mon compte » sur l'écran de connexion.

**Ce qu'on attend.** Il accepte des conditions d'utilisation et sait ce qu'on fait de ses données — comme sur le site, où les deux liens sont sous le bouton.

**Où ça en est.** `grep -rniE "cgu|confidentialit|privacy|terms|conditions"` sur tout five-scorer-mobile (app, lib, composants, app.json) ne rend AUCUNE ligne. L'écran d'inscription de l'app (five-scorer-mobile/app/connexion.tsx:88-140) enchaîne nom / e-mail / mot de passe / « Créer mon compte », sans un mot. Le site, lui, les affiche à l'inscription et sur la page d'accueil (app/page.tsx:38-40). Deux conséquences : la moitié des nouveaux membres (ceux qui entrent par l'app) n'acceptent rien, et une soumission App Store sur un compte utilisateur sans lien de confidentialité se fait renvoyer.

> `App : five-scorer-mobile/app/connexion.tsx (formulaire d'inscription complet, aucune mention). Site : app/signup/SignupForm.tsx (bloc `bv-pied` : « En créant un compte, tu acceptes les CGU et la politique de confidentialité »), app/terms/page.tsx, app/privacy/page.tsx.`

### `VEST-N02` — ✗ absent · *gêne une saison*

**La situation.** Karim a joué trois lundis, le capitaine lui avait fait une fiche « Karim ». Il s'inscrit sous « Karim Benzema » et rejoint par le lien : une deuxième fiche naît. Le capitaine s'en aperçoit et rattache le compte à la BONNE fiche depuis le site.

**Ce qu'on attend.** Une fois le rattachement corrigé, le vestiaire redevient propre : une seule fiche Karim.

**Où ça en est.** `rattacherJoueur` commence par DÉLIER toutes les fiches de ce compte dans le club — `tx.player.updateMany({ where: { clubId, userId }, data: { userId: null } })` (lib/rattachement.ts:126-129) — puis lie la cible. La fiche vide créée au moment de rejoindre survit donc : libre, non archivée, non invitée, zéro match. Elle reste dans le vestiaire, dans la liste des présences de chaque soirée (app/c/[slug]/sessions/[id]/page.tsx:60-64 charge tous les joueurs non archivés), dans le vivier de l'accueil (app/c/[slug]/page.tsx:189-193) et dans la pelouse de la compo. Aucune suppression de joueur n'existe nulle part dans le dépôt : la seule sortie est `setPlayerArchived` (app/actions/roster.ts:86). Le doublon devient un archivé de plus, dépliable, portant le nom d'un joueur bien vivant. Et rien ne signale au capitaine que le doublon existe.

> `Site : lib/rattachement.ts:126-131, app/actions/roster.ts (aucun `deletePlayer` : addPlayer:47, updatePlayer:63, setPlayerArchived:86, linkPlayerToUser:113), app/c/[slug]/players/RosterClient.tsx. App : five-scorer-mobile/app/club/[id]/effectif.tsx (archivage/réactivation seulement).`

### `COMPTES-N05` — ⚠ faux · *confort*

**La situation.** Le nouveau installe l'app avant d'avoir son lien et tape « Voir le club sans compte » pour jeter un œil.

**Ce qu'on attend.** Soit on lui montre le club dont on lui parle, soit on lui demande lequel — pas un club au hasard.

**Où ça en est.** `export const CLUB = process.env.EXPO_PUBLIC_CLUB ?? "renault-five-urban-guy"` (five-scorer-mobile/lib/api.ts:709), et `chargerVitrine(slug = CLUB)` (:754) : le slug est figé dans le bundle publié — la variable d'environnement n'existe qu'au moment du build. Pour ce club-ci, c'est juste par accident. Pour n'importe quel autre nouveau membre — le five du jeudi, un club voisin — « Voir le club sans compte » montre le classement de Renault Five Urban Guy, ou l'erreur « Aucun club public à « renault-five-urban-guy » » (:763) si le club a éteint sa vitrine. L'écran n'offre nulle part de choisir un club.

> `App : five-scorer-mobile/lib/api.ts:709,754, five-scorer-mobile/app/vitrine.tsx:33. Site : app/p/[slug]/page.tsx, app/api/public/[slug]/route.ts (le slug fait partie de l'URL, donc le problème n'existe pas).`

### `SOIREE-N02` — ⚠ faux · *confort*

**La situation.** Le nouveau, curieux, remonte le calendrier et ouvre la soirée du 15 janvier — trois mois avant son arrivée au club.

**Ce qu'on attend.** La liste des présences d'une soirée passée est celle des gens qui étaient au club ce soir-là.

**Où ça en est.** La page de la soirée charge l'effectif D'AUJOURD'HUI — `prisma.player.findMany({ where: { clubId, isArchived: false } })` (app/c/[slug]/sessions/[id]/page.tsx:60-64) — sans jamais regarder la date de la soirée ni `Player.createdAt` (prisma/schema.prisma:232, présent en base et lu nulle part). Chaque joueur devient une entrée de `calculerPresences` (:75-84), donc une ligne « sans réponse » sur une soirée à laquelle il ne pouvait pas répondre. La route mobile fait le même calcul (app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:113-124). Symétriquement, un joueur archivé depuis disparaît de la liste d'une soirée où il a joué. Le nouveau se lit donc absent d'un lundi où il n'existait pas, et le capitaine qui rouvre une vieille soirée pour la caisse voit une liste qui n'est plus celle du soir-là.

> `Site : app/c/[slug]/sessions/[id]/page.tsx:60-64,75-97, lib/presences.ts:66-96, prisma/schema.prisma:232 (`Player.createdAt`, jamais lu). App : app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:113-124.`

### `STATS-N01` — ✗ absent · *confort*

**La situation.** Mardi matin, après son premier lundi. Le nouveau ouvre Stats pour la seule question qui l'intéresse : « je suis où ? ». Le club fait vingt joueurs.

**Ce qu'on attend.** Sa ligne se trouve tout de suite — elle est marquée, ou le tableau s'ouvre dessus.

**Où ça en est.** Le composant `Classement` reçoit `slug`, `lignes`, `avecFiches`, `pointsWin`, `pointsDraw`, `camps` (components/Classement.tsx:44-60) : aucun identifiant de joueur courant, aucune classe de surbrillance, aucun ancrage. `grep -n "moi|estMoi|surbrillance" components/Classement.tsx` ne rend rien. Côté app, l'écran Stats appelle bien `chargerMoi()` (five-scorer-mobile/app/club/[id]/stats.tsx:58) mais uniquement pour retrouver les couleurs du club (:59) — la ligne du joueur n'est pas distinguée non plus. Le contraste est net avec la liste des présences, qui met « moi d'abord » (SOIREE-69). Pour quelqu'un qui a un match au compteur au milieu de vingt lignes triées aux points, se trouver demande de lire tous les noms.

> `Site : components/Classement.tsx:44-60 (aucune notion de « moi »), app/c/[slug]/stats/page.tsx. App : five-scorer-mobile/app/club/[id]/stats.tsx:58-59 (`chargerMoi` n'est lu que pour le thème du club).`

## Regard : le capitaine sur une saison

*14 cas — 0 faits, 0 partiels, 9 absents, **5 faux**.*

### `SOIREE-72` — ✗ absent · *gêne un lundi*

**La situation.** Lundi 21 h 40, au bord du terrain. Trois joueurs tendent leur billet au capitaine, qui a son téléphone à la main et l'app ouverte sur la soirée.

**Ce qu'on attend.** Cocher « a payé » là, tout de suite, depuis le téléphone — c'est le seul moment où l'argent circule vraiment.

**Où ça en est.** La route de la soirée que lit l'app n'expose que `GET` (app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:27) — il n'existe aucune route d'écriture pour le prix ni pour « a payé » : `setFieldCost` et `setRsvpPaid` sont des server actions du site (app/actions/payments.ts:12,47), inatteignables depuis React Native. L'app calcule et envoie pourtant déjà `payeurs` et `encaisseCents` (soirees/[matchDayId]/route.ts:143-148), mais l'écran n'en montre qu'une ligne : « X encaissés sur Y ». Le capitaine encaisse au gymnase et doit rouvrir un navigateur en rentrant.

> `five-scorer-mobile/app/soiree/[id].tsx:302-306 (affichage seul) ; côté site five-scorer/app/c/[slug]/sessions/[id]/MoneyPanel.tsx:110-201 et five-scorer/app/actions/payments.ts`

### `SOIREE-73` — ✗ absent · *gêne un lundi*

**La situation.** Karim paie pour lui et pour Momo qui a oublié son liquide. Un autre soir, quelqu'un donne 10 € sur une part de 4,80 € et on lui doit la monnaie.

**Ce qu'on attend.** Pouvoir écrire ce qui a réellement été donné, et par qui, pas seulement « payé / pas payé ».

**Où ça en est.** `Rsvp.hasPaid` est un `Boolean @default(false)` (schema.prisma:462) : il n'y a nulle part de montant reçu. L'« encaissé » affiché est une déduction, pas de l'argent compté — `collectedCents = paidCount * shareCents` (MoneyPanel.tsx:57), plafonné à la note (l.193). Un joueur qui paie pour deux oblige à cocher une case qui ment sur l'autre ligne, et la monnaie due n'existe dans aucun champ.

> `five-scorer/prisma/schema.prisma:452-468 (Rsvp), five-scorer/app/actions/payments.ts:47-78, five-scorer/app/c/[slug]/sessions/[id]/MoneyPanel.tsx:56-57`

### `SAISON-70` — ⚠ faux · *gêne une saison*

**La situation.** En janvier, Urban change de lot de chasubles : le blanc devient jaune. Le capitaine met à jour les couleurs dans les réglages. En juin, on regarde le derby de la saison et les fiches des joueurs.

**Ce qu'on attend.** Les matchs de septembre à décembre restent « Blanc contre Noir », ceux d'après « Jaune contre Noir », et personne ne se voit attribuer une chasuble qu'il n'a jamais portée.

**Où ça en est.** Le nom d'équipe se DÉDUIT de la couleur (`nomChasuble`, color.ts:137-166) — c'est le bon choix, mais il n'a pas de mémoire. Trois conséquences vérifiées : (1) chaque `Match` fige `teamAName` le jour où il se joue (schema.prisma:369), donc l'histoire garde « Blanc » ; (2) le derby de la saison prend son titre du DERNIER match — `const dernier = matches[matches.length - 1]` puis `nomA: dernier.teamAName` (stats.ts:851-853) — donc « Jaune contre Noir » coiffe rétroactivement les 25 lundis joués en blanc, dont les victoires sont pourtant bien comptées ensemble ; (3) la fiche d'un joueur étiquette TOUTE sa carrière avec les couleurs d'aujourd'hui : `noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB)` appliqué au camp majoritaire de tous ses matchs (players/[id]/page.tsx:54-72). Un joueur qui n'a jamais porté de jaune est annoncé « Jaune · Niveau 4 ».

> `five-scorer/lib/color.ts:137-183 (nomChasuble/nomsChasubles), five-scorer/lib/stats.ts:849-855 (derby), five-scorer/app/c/[slug]/players/[id]/page.tsx:54-72, five-scorer/prisma/schema.prisma:369 ; côté app five-scorer-mobile/app/joueur/[id].tsx via app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:63`

### `SOIREE-74` — ⚠ faux · *gêne une saison*

**La situation.** Le capitaine saisit 48 € le lundi matin. À 17 h, Urban annonce le terrain fermé : la soirée n'a pas lieu. En juin, il regarde l'onglet Bilan pour savoir ce que la saison a coûté.

**Ce qu'on attend.** Le total « Terrain » ne compte que les soirées qui ont eu lieu.

**Où ça en est.** `const terrain = soirees.reduce((s, md) => s + (md.fieldCostCents ?? 0), 0)` somme TOUTES les soirées de la saison, sans filtrer `canceledAt` — alors que la même fonction sait très bien reconnaître une soirée annulée dix lignes plus haut (saison/route.ts:107-111, « Annulée »). `soireesPayantes` (l.271) la compte aussi, donc la moyenne « par soirée » est fausse dans les deux termes. Quatre soirées annulées dans l'année = 192 € fantômes dans le seul chiffre d'argent que le club lit de toute la saison.

> `five-scorer/app/api/clubs/[clubId]/saison/route.ts:270-271 et five-scorer/app/c/[slug]/saison/page.tsx:221-222`

### `SOIREE-75` — ⚠ faux · *gêne une saison*

**La situation.** Le club a 14 abonnés pour 12 places. Toute la saison, ce sont les deux mêmes qui se retrouvent sur la liste d'attente — et personne ne comprend pourquoi eux.

**Ce qu'on attend.** À égalité d'engagement, la place tourne — ou au moins la règle est dite, et elle est la même sur tous les écrans.

**Où ça en est.** Un abonné n'a pas de réponse, donc son engagement vaut `creeeLe` (presences.ts:93). Les 44 soirées étant créées d'un bloc par `createMany` (lib/calendrier-serveur.ts:133), les 14 abonnés sont à ÉGALITÉ PARFAITE sur toute l'année. Le tri `presents.sort((a, b) => a.engageA - b.engageA)` (l.103) est stable : l'ordre d'arrivée du tableau tranche. Or cet ordre n'est pas le même partout — la page de la soirée charge les joueurs `orderBy: { name: "asc" }` (sessions/[id]/page.tsx:44), l'écran Saison les charge SANS `orderBy` (saison/route.ts:44-48). Donc : la liste d'attente est alphabétique toute la saison sur un écran, et dans l'ordre de la base sur l'autre — deux écrans peuvent nommer deux titulaires différents pour le même lundi. Le commentaire (l.100-102) assume l'égalité, mais pas qu'elle se fige pendant dix mois.

> `five-scorer/lib/presences.ts:90-115, five-scorer/app/c/[slug]/sessions/[id]/page.tsx:42-44, five-scorer/app/api/clubs/[clubId]/saison/route.ts:44-48`

### `STATS-70` — ⚠ faux · *gêne une saison*

**La situation.** 15 juillet, dernier lundi joué. Le capitaine ouvre Stats pour sortir le palmarès de l'année et le coller dans le groupe. Il n'a pas encore clôturé la saison — il ne le fera qu'en septembre, comme chaque année.

**Ce qu'on attend.** Le palmarès complet de l'année en cours, ou une phrase qui dit clairement qu'il faut d'abord clôturer.

**Où ça en est.** `getSeasonHonours` n'est appelé QUE si la saison choisie est dans `cloturees` : `cloturees.some((s) => s.id === choisie) ? await getSeasonHonours(...) : null` (stats/route.ts:99-101 ; idem page.tsx:144-147). Tant que la saison est active, la carte s'appelle quand même « Palmarès de la saison » (stats/route.ts:330) mais ne porte que trois titres calculés à la volée — homme du match, buteur, passeur (l.109-111) — sans le meilleur %V, sans l'Élo le plus haut, sans l'inoxydable. Rien ne dit au capitaine que ces trois-là arrivent avec la clôture. Et comme personne ne clôture en juillet (c'est exactement la situation de SAISON-03), le club ne voit jamais son palmarès complet de l'année.

> `five-scorer/app/api/clubs/[clubId]/stats/route.ts:97-101 et 325-331, five-scorer/app/c/[slug]/stats/page.tsx:141-155 et 493-514 ; côté app five-scorer-mobile/app/club/[id]/stats.tsx`

### `TRANS-70` — ⚠ faux · *gêne une saison*

**La situation.** Troisième saison du club, mois de juin : 250 matchs derrière. Au vestiaire, quelqu'un ouvre la fiche d'un joueur sur l'app.

**Ce qu'on attend.** Un écran qui s'ouvre aussi vite qu'au premier lundi de septembre.

**Où ça en est.** `loadFinishedMatches` recharge TOUS les matchs terminés de la portée, participants et événements compris, à chaque appel (stats.ts:48-71) — il n'y a ni pagination ni agrégat stocké. Or `getPlayerDetail` boucle sur les saisons EN SÉRIE : `for (const s of seasons) { await getLeaderboard({ clubId, seasonId: s.id }) }` (stats.ts:430-431). La route de la fiche mobile enchaîne en plus `getGardiens` (toutes saisons), `getTropheesJoueur` et un `getLeaderboard` de la saison (joueurs/[playerId]/route.ts:27-53) : à la troisième saison, une fiche joueur = sept relectures complètes de l'histoire du club, aller-retour après aller-retour vers la base. Même mécanique sur « Toutes saisons » : `Promise.all(closedSeasons.map((s) => getSeasonHonours(clubId, s.id)))` (stats/page.tsx:151-153) refait un classement complet par saison clôturée. L'app ne casse pas — elle ralentit tous les mois, exactement là où le réseau est le plus mauvais.

> `five-scorer/lib/stats.ts:48-71 et 428-434, five-scorer/app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:27-53, five-scorer/app/c/[slug]/stats/page.tsx:148-155`

### `REG-70` — ✗ absent · *gêne une saison*

**La situation.** Le capitaine joue, il ne peut pas tenir la feuille en même temps. Il veut que Momo la tienne tous les lundis — sans que Momo puisse supprimer une soirée, changer le barème ou toucher à la caisse.

**Ce qu'on attend.** Donner à une personne le droit de tenir la feuille, et rien d'autre.

**Où ça en est.** Il n'y a que deux positions : `canScore = canManage || club.membersCanScore` (guard.ts:66). Soit le club ouvre la saisie à TOUS les membres (`membersCanScore`, schema.prisma:163), soit le capitaine nomme Momo admin — et `canManage` ouvre d'un coup les réglages, le roster, les saisons, la caisse, la suppression d'une soirée et le retrait des membres (guard.ts:17-19 le dit noir sur blanc). Les rôles sont figés à owner/admin/member, validés à l'exécution (club.ts:99-101). Sur une saison, le capitaine choisit entre déléguer trop et ne pas déléguer.

> `five-scorer/lib/guard.ts:52-68, five-scorer/app/actions/club.ts:83-115, five-scorer/prisma/schema.prisma:162-163 ; côté app five-scorer-mobile/app/club/[id]/reglages.tsx (section « Membres »)`

### `REG-71` — ✗ absent · *gêne une saison*

**La situation.** En janvier, le créneau change pour le reste de l'année : 20 h devient 19 h 30, ou le club passe du terrain 2 au terrain 4, ou déménage à Urban Vélizy. Il reste 22 lundis au calendrier.

**Ce qu'on attend.** Corriger l'heure et le lieu des lundis qui restent d'un seul geste.

**Où ça en est.** Aucune action ne modifie une soirée existante : `grep matchDay.update` ne rend que la compo (app/actions/compo.ts:76,134) et l'annulation (app/actions/calendrier.ts:52,72). Et reposer le calendrier ne rattrapera rien, par construction : les journées déjà occupées sont sautées, « une compo préparée ne doit jamais être écrasée par une régénération » (calendrier-serveur.ts:115-131) — donc ni l'heure ni le lieu ne sont repassés. Les 22 lundis restants gardent l'ancien créneau, l'agenda iCal de quinze téléphones aussi (app/api/cal/[token]/route.ts:110-133), et la seule sortie est de supprimer les soirées une par une — ce qui emporte leurs réponses.

> `aucun — five-scorer/lib/calendrier-serveur.ts:115-141, five-scorer/app/actions/matchday.ts (create / delete / rsvp seulement), five-scorer/app/actions/calendrier.ts ; côté app five-scorer-mobile/app/club/[id]/saison.tsx, five-scorer-mobile/app/soiree/nouvelle.tsx`

### `SOIREE-71` — ✗ absent · *gêne une saison*

**La situation.** Début septembre, le capitaine pose les 44 lundis à 20 h à Urban Guyancourt. Le terrain coûte 48 € toutes les semaines, comme l'an dernier.

**Ce qu'on attend.** Le prix se pose une fois, avec le lieu et l'heure — quitte à le corriger la semaine où on prend deux terrains.

**Où ça en est.** `poserCalendrier` n'écrit que `clubId, seasonId, date, title, location` (lib/calendrier-serveur.ts:133-141). Le `Club` n'a aucun champ de prix par défaut (schema.prisma:151-201). `setFieldCost` écrit `fieldCostCents` sur UNE soirée (app/actions/payments.ts:12-44). Résultat : 44 saisies du même montant à la main — et une soirée dont personne n'a saisi le prix disparaît de la caisse, du « réglé / à encaisser » de la liste (sessions/page.tsx:118-125) et du bilan de la saison (saison/route.ts:270-271).

> `five-scorer/lib/calendrier-serveur.ts:132-141, five-scorer/prisma/schema.prisma:151-201 (Club), five-scorer/app/actions/payments.ts:12-44 ; côté app five-scorer-mobile/app/club/[id]/reglages.tsx (section « La soirée »)`

### `STATS-71` — ✗ absent · *gêne une saison*

**La situation.** Fin juillet. Le capitaine veut poster le bilan de l'année dans le groupe : tant de soirées, tant de buts, Blanc contre Noir sur la saison, le meilleur buteur, l'homme de l'année.

**Ce qu'on attend.** Un mot de fin de saison prêt à coller, comme le mot du mardi soir.

**Où ça en est.** `motDeLaSoiree` (lib/soiree.ts:39) compose le mot d'UNE soirée, et son en-tête dit pourquoi il existe : « ce qu'on tape à la main dans le groupe WhatsApp le mardi matin, et qu'on ne tape jamais ». Le même geste au niveau de l'année n'a rien : ni bouton de partage, ni copie, ni carte image sur les écrans Stats et Saison, des deux côtés. Le bilan et le palmarès existent à l'écran (saison/route.ts:255-290, stats/route.ts:325-331) — ils ne sortent pas de l'app.

> `aucun — five-scorer/lib/soiree.ts:39-85 (le seul texte prêt à coller), five-scorer/components/PartageFeuille.tsx (un match), five-scorer/app/c/[slug]/stats/page.tsx, five-scorer/app/c/[slug]/saison/page.tsx ; côté app five-scorer-mobile/app/club/[id]/stats.tsx, five-scorer-mobile/app/club/[id]/saison.tsx`

### `VEST-70` — ✗ absent · *gêne une saison*

**La situation.** Karim a une fiche « Karim » créée en septembre, avec 15 matchs et 9 buts. En janvier il rejoint par le lien WhatsApp sous « Karim Benzema » : une seconde fiche naît à côté. Le capitaine veut recoller les deux.

**Ce qu'on attend.** Fusionner les deux fiches : les matchs, les buts, les votes et les trophées se rejoignent sous une seule, l'autre disparaît.

**Où ça en est.** Aucune fusion nulle part dans les deux dépôts (grep `fusionn|merge` ne rend que `tailwind-merge`). `rattacherJoueur` lie un COMPTE à une fiche, il ne réunit pas deux fiches. Les participations, les buts, les passes, les votes MVP et les trophées sont accrochés à `playerId` (schema.prisma:234-240) : deux fiches, c'est deux carrières qui ne se rejoindront jamais, et un classement où le même homme apparaît deux fois. Le seul recours est d'archiver la mauvaise — l'historique reste coupé en deux. Même problème pour un invité d'un soir créé deux fois sous deux orthographes.

> `aucun — five-scorer/app/actions/roster.ts (add / update / archive / link seulement), five-scorer/lib/rattachement.ts ; côté app five-scorer-mobile/app/club/[id]/effectif.tsx`

### `VEST-72` — ✗ absent · *gêne une saison*

**La situation.** En janvier, le capitaine se demande qui vient vraiment : qui répond, qui se décommande le dimanche soir, qui a dit présent quatre fois et n'est venu qu'une. En juin, il refait la liste de ceux qu'il relance en septembre.

**Ce qu'on attend.** Par joueur, sur la saison : combien de soirées il a dit présent, combien il en a jouées.

**Où ça en est.** `lib/stats.ts` ne lit jamais la table `rsvp` : la fiche joueur compte des MATCHS (`matchesPlayed`, via `matchParticipant`), pas des soirées, et ignore totalement les réponses. `Rsvp.respondedAt` (schema.prisma:463) existe mais n'est agrégé nulle part au-delà de l'ordre d'engagement d'UNE soirée (lib/presences.ts:93). Le rapprochement « il a dit oui / il était sur la feuille » n'existe donc à aucune échelle — ni pour la caisse, ni pour la saison. Le capitaine n'a que sa mémoire et le fil WhatsApp.

> `aucun — five-scorer/lib/stats.ts (aucune occurrence de `rsvp`), five-scorer/app/c/[slug]/players/[id]/page.tsx, five-scorer/app/api/clubs/[clubId]/joueurs/[playerId]/route.ts`

### `VEST-71` — ✗ absent · *confort*

**La situation.** Le capitaine crée une fiche par erreur : un doublon vide, un « azerty » de test, un invité tapé deux fois. Zéro match, zéro but.

**Ce qu'on attend.** Effacer une fiche qui n'a jamais rien vécu.

**Où ça en est.** Le seul geste est `setPlayerArchived` (roster.ts:87) — aucune suppression de joueur n'existe côté serveur, ni sur le site ni dans l'API mobile. La doctrine est juste pour un joueur qui a joué ; pour une fiche vide elle laisse une scorie définitive sous le repli des archivés, réactivable par erreur et revendicable (« C'est moi »). Sur une saison, le repli se remplit de fiches qui n'ont jamais existé.

> `five-scorer/app/actions/roster.ts:87-107, five-scorer/app/api/clubs/[clubId]/joueurs/[playerId]/route.ts ; côté app five-scorer-mobile/app/joueur/fiche.tsx`

## Regard : le téléphone

*5 cas — 0 faits, 1 partiels, 1 absents, **3 faux**.*

### `COMPTE-51` — ✗ absent · *bloque un lundi*

**La situation.** Un joueur change de téléphone le dimanche, ou arrive au club avec un Android, ou son iPhone n'a jamais été enregistré dans l'équipe Apple. Il veut l'app pour lundi.

**Ce qu'on attend.** Un chemin pour qu'un téléphone neuf ait l'app avant le coup d'envoi — ou une réponse claire : « sur Android, c'est le site ».

**Où ça en est.** Les trois profils de build ne déclarent que `ios`. `lundi`, celui du terrain, est en distribution interne : elle n'installe que sur les iPhones dont l'UDID est enregistré (`eas-cli device:create`), et ajouter un appareil impose de REFAIRE un build et de rediffuser le lien. Pas de canal OTA non plus (expo-updates n'est pas installé, EAS.md l'écrit). Donc : nouveau téléphone = une manipulation du capitaine plus un build de vingt minutes ; téléphone Android = rien du tout, alors que app.json le configure et que le code n'a aucune branche iOS. Le club n'a nulle part la phrase qui dit qui peut installer l'app et comment.

> `app: five-scorer-mobile/eas.json (aucun profil android) ; five-scorer-mobile/EAS.md (« La distribution interne n'installe que sur les iPhones enregistrés dans l'équipe ») ; five-scorer-mobile/app.json (android.versionCode 1, jamais bâti)`

### `TRANS-65` — ◐ partiel · *bloque un lundi*

**La situation.** La base locale ne s'ouvre pas : fichier abîmé par une coupure en pleine écriture, stockage du téléphone plein, ou une instruction du schéma qui passe mal sur une vieille version d'iOS.

**Ce qu'on attend.** On comprend ce qui se passe, on peut réessayer, et on n'est pas coupé de ce qui est déjà dans le téléphone.

**Où ça en est.** Le fournisseur ne rend ses enfants qu'une fois la base ouverte — décision assumée et bonne — mais l'échec, lui, remplace TOUTE l'app par « Ça n'a pas marché » suivi de `e.message`, c'est-à-dire la phrase anglaise brute de SQLite. Pas de bouton « Réessayer », pas de retour, pas de « ferme et rouvre l'app » : l'écran est un cul-de-sac, et la soirée déjà saisie dans le fichier devient inatteignable au moment précis où on voudrait la sauver. Aucun `PRAGMA integrity_check`, aucune reprise, aucune trace envoyée nulle part.

> `app: five-scorer-mobile/composants/Noyau.tsx:64-90 et 137-152 (Attente) ; five-scorer-mobile/lib/outbox/baseExpo.ts:66-71`

### `TRANS-64` — ⚠ faux · *gêne un lundi*

**La situation.** Le marqueur remet le téléphone dans sa poche en quittant le gymnase, écran verrouillé, pendant que la file finit de se vider ; ou le téléphone vient de redémarrer et n'a pas encore été déverrouillé une fois.

**Ce qu'on attend.** Un cookie qu'on n'a pas pu LIRE n'est pas un cookie REFUSÉ : on réessaie plus tard, sans réclamer une reconnexion à quelqu'un dont la session est parfaitement valable.

**Où ça en est.** `lireCookie()` fait `(await authClient.getCookie()) || null` : trousseau verrouillé, trousseau vidé, valeur découpée incomplète — tout se réduit à `null`. Et le drain le dit noir sur blanc en commentaire (sync.ts:62-68) : « Rendu null quand il n'y en a pas : le rejeu partira quand même et se fera répondre 401, ce qui lève reconnexionRequise ». La requête part donc anonyme, le serveur répond 401, `encaisserEchec` pose `reconnexionRequise = true` et ARRÊTE le passage. La pastille réclame une reconnexion, la soirée reste dans le téléphone, et l'écran de lecture (appel.ts) fait la même confusion en levant `SessionExpiree`. Le trousseau d'expo-secure-store est en accessibilité « quand déverrouillé » par défaut, et rien dans le code ne demande autre chose ni ne distingue les deux cas.

> `app: five-scorer-mobile/lib/api.ts:826-829 (lireCookie) ; five-scorer-mobile/lib/outbox/sync.ts:62-68 et 316-331 (encaisserEchec) ; five-scorer-mobile/lib/appel.ts:19-27 (SessionExpiree)`

### `TRANS-66` — ⚠ faux · *gêne un lundi*

**La situation.** L'horloge du téléphone est fausse : batterie à plat toute la nuit et redémarrage avant la resynchronisation, heure réglée à la main, téléphone acheté à l'étranger. Le marqueur lance le match à 20 h ; le téléphone croit qu'il est 21 h 40, ou qu'on est dimanche.

**Ce qu'on attend.** Le match tombe le bon jour, à la bonne heure, et le chrono part de zéro.

**Où ça en est.** C'est le téléphone qui décide de l'heure du match : `playedAt` est pris sur son horloge, et le serveur le recopie tel quel (`body.playedAt ? new Date(body.playedAt) : undefined`) sans aucune borne — ni « pas dans le futur », ni « pas à plus de N heures de maintenant ». Un téléphone d'un jour en avance range le match sous le mauvais lundi dans les listes triées par `playedAt`. Pire à l'ouverture : quand la feuille a été créée ailleurs (site, autre téléphone), le chrono est amorcé sur `Date.now() − Date.parse(match.playedAt)` — une horloge en avance ouvre donc la feuille au-delà du temps réglementaire, sirène comprise. La garde qui existe ne couvre que le mode rétro. Distinct de TRANS-33/35 (fuseau) et de RETRO-06 (date choisie à la main dans le formulaire) : ici personne ne choisit rien, c'est le téléphone qui ment.

> `app: five-scorer-mobile/lib/match/local.ts:272 et 342 (playedAt = maintenant()) ; five-scorer-mobile/app/match/[id].tsx:196-201 (amorce du chrono) ; site: five-scorer/app/api/clubs/[clubId]/matches/route.ts:150`

### `TRANS-67` — ⚠ faux · *gêne un lundi*

**La situation.** Les données cellulaires ont été coupées pour Five Scorer (iOS le propose quand le forfait chauffe, ou le propriétaire l'a fait sans y penser). Au gymnase, le téléphone affiche quatre barres de 4G.

**Ce qu'on attend.** Le marqueur sait que rien ne part, et pourquoi — pas une pastille verte au-dessus d'une file qui ne bouge pas.

**Où ça en est.** L'état « en ligne » vient de `Network.useNetworkState().isInternetReachable`, qui décrit le TÉLÉPHONE, pas le droit de l'app à sortir. Données coupées pour l'app : `isInternetReachable` reste vrai, le drain se croit en ligne, chaque opération part, attend huit secondes, échoue, et la relance exponentielle réessaie jusqu'à une minute d'écart. La pastille annonce « en ligne » et « n à envoyer » toute la soirée, sans jamais dire que c'est un réglage du téléphone, pas le Wi-Fi du gymnase. Le même aveuglement vaut pour un portail captif : le Wi-Fi d'Urban Soccer se connecte, `isInternetReachable` dit oui, rien ne passe.

> `app: five-scorer-mobile/composants/Noyau.tsx:120-134 (Reseau / Network.useNetworkState) ; five-scorer-mobile/lib/outbox/sync.ts:80 (DELAI_REJEU_MS), 234-241`

## Regard : les données

*19 cas — 0 faits, 0 partiels, 4 absents, **15 faux**.*

### `SAISON-D5` — ⚠ faux · *gêne un lundi*

**La situation.** Le club a joué contre Urban FC et gagné 5-2. On ouvre l'écran Saison, onglet calendrier. La ligne dit : « Urban FC — Renault Five Urban Guy · domicile · 5 – 2 · Victoire ».

**Ce qu'on attend.** Le score se lit dans l'ordre des noms affichés.

**Où ça en est.** Le titre met l'adversaire en premier (`${m.opponent?.name} — ${ctx.org.name}`) et le sous-titre met NOTRE score en premier (`${m.scoreA} – ${m.scoreB}`), puisque lib/stats.ts pose que « le club est toujours l'équipe A d'un match EXTERNAL » (stats.ts:497). L'étiquette « Victoire » est calculée de notre point de vue (scoreA > scoreB). La même ligne annonce donc une victoire sous un score qui se lit comme une défaite. L'export CSV, lui, met bien le club en colonne ÉquipeA (export/route.ts:112-114) : les deux surfaces se contredisent. Le champ `isHome` est purement décoratif — rien n'échange jamais les colonnes.

> `app/c/[slug]/saison/page.tsx:170-171 ; app/api/clubs/[clubId]/saison/route.ts:188-191 (identique dans l'app)`

### `SOIREE-D1` — ⚠ faux · *gêne un lundi*

**La situation.** Terrain à 48 €, sept joueurs. L'app annonce « 6,86 € chacun ». Les sept paient, et la caisse affiche « 48 € / 48 € ».

**Ce qu'on attend.** Ce qui est demandé à chacun, multiplié par le nombre de joueurs, fait le prix du terrain — ni plus ni moins.

**Où ça en est.** La part est arrondie au centime SUPÉRIEUR (`Math.ceil(cost / nbIn)`, MoneyPanel.tsx:55). Sept parts de 686 centimes font 48,02 € pour une note de 48 €. L'encaissé n'est d'ailleurs pas une caisse mais un produit : `paidCount * shareCents` (ligne 57), donc un nombre qui se recalcule tout seul chaque fois que quelqu'un change de réponse — et qui est ensuite masqué par un `Math.min(collectedCents, cost)` à l'affichage (ligne 188). Le club ne peut jamais savoir combien il a réellement reçu, ni qui a versé combien : rien n'enregistre un montant, seulement une case cochée (Rsvp.hasPaid).

> `app/c/[slug]/sessions/[id]/MoneyPanel.tsx:54-60 et 186-190 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts (partCents, encaisseCents)`

### `SOIREE-D2` — ⚠ faux · *gêne un lundi*

**La situation.** Momo a payé lundi. Mardi, on corrige les présences : il n'était finalement pas là, on le passe « absent ». La caisse passe de 48 € encaissés à 43,20 €, et la case « Payé » de Momo a disparu de l'écran.

**Ce qu'on attend.** Ce que le club a encaissé ne bouge pas parce qu'on corrige une présence — et si la personne revient dans la liste, on sait qu'elle avait payé.

**Où ça en est.** `hasPaid` vit sur la ligne Rsvp (prisma/schema.prisma, model Rsvp) et `setRsvp` ne met à jour que `status` (matchday.ts:95) : la case cochée reste en base, invisible. La liste des payeurs est reconstruite à chaque affichage à partir de `presences.titulaires` (page.tsx:101-102), donc quelqu'un qui passe OUT, ou qui bascule en liste d'attente parce qu'un onzième a répondu, sort de la caisse en emportant son paiement. Il y revient plus tard, toujours coché, sans que personne n'ait rien fait. Symétriquement, `setRsvpPaid` accepte de cocher n'importe qui ayant une réponse — y compris un remplaçant en attente qui ne figure pas dans la caisse (payments.ts:66-73, aucun contrôle de titularité).

> `app/actions/matchday.ts:88-96 (setRsvp) ; app/c/[slug]/sessions/[id]/page.tsx:100-107 (payers = titulaires) ; app/actions/payments.ts:66-73 (setRsvpPaid)`

### `APRES-D1` — ⚠ faux · *gêne une saison*

**La situation.** Karim commence chez les Blancs, marque deux buts, puis passe chez les Noirs à la 8e pour rééquilibrer. Mardi, on ouvre le récap du match : il est dans la colonne des Noirs. On ouvre Stats : sa victoire, son Élo et sa chasuble habituelle sont comptés chez les Blancs.

**Ce qu'on attend.** Le même joueur du même côté partout — ou, si les deux lectures ont chacune leur raison, que l'écran le dise (« a commencé chez les Blancs »).

**Où ça en est.** Le champ `MatchParticipant` porte les deux valeurs, et le schéma explique pourquoi (prisma/schema.prisma, commentaire d'initialTeam). Les statistiques lisent `initialTeam` ; les deux récaps lisent `team`. Le même serveur, sur la même ligne de base, répond donc « Noir » à la feuille et « Blanc » au classement. Le vote de l'homme du match et la carte des gardiens ajoutent une troisième lecture : les candidats au vote viennent de `participants` sans camp (matchs/[matchId]/route.ts:238) et `getGardiens` lit `initialTeam` (stats.ts:1131) pour attribuer les buts encaissés — un gardien qui change de camp encaisse donc les buts du camp qu'il a quitté.

> `Récap app : app/api/clubs/[clubId]/matchs/[matchId]/route.ts:171 (`filter(p => p.team === camp)`). Récap site : app/c/[slug]/matches/[id]/page.tsx:183-192. Stats : lib/stats.ts:206, 750, 988, 1131 (initialTeam)`

### `APRES-D2` — ⚠ faux · *gêne une saison*

**La situation.** Un admin corrige un match après coup et attribue par erreur l'homme du match à quelqu'un qui n'a pas joué ce soir-là (ou, plus tard, ajoute un but à la mauvaise personne depuis le récap corrigeable de la spec 0001). On ouvre le tableau de la saison.

**Ce qu'on attend.** Un but et un titre se créditent à quelqu'un qui était sur la feuille — sinon aucune ligne du tableau ne veut plus rien dire.

**Où ça en est.** Les trois portes d'écriture (ajout d'un but, PATCH du match, formulaire d'édition) ne vérifient qu'une chose : que le joueur appartient au CLUB. Aucune ne vérifie qu'il est inscrit au match. Dans lib/stats.ts, `ensure(playerId)` cherche le joueur dans TOUT l'effectif (ligne 162, `byId`) et crée une ligne d'accumulateur au premier but ou au premier titre : le tableau affiche alors une rangée « MJ 0 · 3 buts · 0 V · 0 % », aucun écran ne filtre `matchesPlayed > 0` (vérifié : app/c/[slug]/stats/page.tsx, app/api/clubs/[clubId]/stats/route.ts, l'accueil, la vitrine publique et l'export CSV ne filtrent pas ; seule la fiche de la soirée le fait, sessions/[id]/page.tsx:127). Ce joueur peut être « Meilleur buteur » de la saison (getSeasonHonours, stats.ts:315) et « Homme du match » du palmarès.

> `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts:105-114 ; app/actions/matches.ts:56-61 ; app/api/clubs/[clubId]/matches/[matchId]/route.ts:139-146 ; conséquence dans lib/stats.ts:160-215`

### `APRES-D3` — ⚠ faux · *gêne une saison*

**La situation.** Un admin corrige la date d'un match saisi le mardi pour la soirée de lundi et la met au 15 janvier, alors que le match reste rattaché à la soirée du 12. Puis quelqu'un ouvre la soirée du 12.

**Ce qu'on attend.** Un match ne peut pas être daté d'un autre jour que la soirée à laquelle il appartient — ou alors on le détache.

**Où ça en est.** `updateMatchDetails` écrit `playedAt` sans jamais toucher `matchDayId` ni vérifier la date de la soirée (ligne 79). Le match reste donc listé dans la soirée du 12 (qui trie ses matchs par `playedAt asc`, sessions/[id]/page.tsx:41) tout en portant une autre date, il apparaît une seconde fois dans le calendrier au 15, la « soirée la plus prolifique » se date sur lui, et le bilan de la soirée continue de le compter. Aucun garde-fou ne compare `Match.playedAt` à `MatchDay.date` nulle part dans le dépôt. Le même écran laisse aussi déplacer un match vers une autre saison sans rien dire de sa soirée (ligne 83), ce qui produit exactement SAISON-D1 à la main.

> `app/actions/matches.ts:66-84 (updateMatchDetails) ; app/c/[slug]/matches/[id]/edit/EditMatchForm.tsx ; conséquences dans app/c/[slug]/sessions/[id]/page.tsx:41-50 et lib/stats.ts:696-707`

### `SAISON-D1` — ⚠ faux · *gêne une saison*

**La situation.** Mi-septembre. Le capitaine a ouvert « Saison 2026-2027 ». On rattrape la dernière soirée de juin (qui appartient encore à « Saison 2025-2026 ») : on ouvre le lundi de juin dans le calendrier, on tape « Saisir », on entre les quatre matchs. Puis on regarde l'onglet Bilan de la saison de juin.

**Ce qu'on attend.** Un match rattaché à la soirée du 22 juin appartient à la saison du 22 juin. Le bilan de cette saison compte la soirée ET ses matchs et ses buts.

**Où ça en est.** L'écran de saisie passe `seasonId={activeSeason?.id ?? null}` (matches/new/page.tsx:103) SANS jamais regarder la saison de la soirée qu'il rattrape ; l'app n'envoie pas de seasonId du tout et le serveur retombe sur la saison active (matches/route.ts:167-175). Le match part donc dans 2026-2027, la soirée reste dans 2025-2026. Or le Bilan compte les soirées par leurs matchs, SANS filtre de saison (`soirees.filter(md => md.matches.some(FINISHED))`, saison/page.tsx:214) et les matchs par leur seasonId (ligne 212). Résultat lisible à l'écran : « 1 soirée jouée · 0 matchs · 0 buts » sur juin, et « 0 soirée · 4 matchs » sur septembre. Le même trou apparaît dès qu'une soirée est créée avant l'ouverture d'une saison, ou qu'une saison est ouverte un mardi entre deux lundis.

> `Site : app/c/[slug]/matches/new/page.tsx:103, app/api/clubs/[clubId]/matches/route.ts:159-175, app/c/[slug]/saison/page.tsx:212-215. App : five-scorer-mobile/app/compo.tsx:233-245, app/api/clubs/[clubId]/saison/route.ts:257-260`

### `SAISON-D3` — ⚠ faux · *gêne une saison*

**La situation.** Octobre. Le capitaine s'aperçoit qu'il a clôturé 2025-2026 trop tôt et « réactive » cette saison depuis les réglages pour vérifier un chiffre. Il oublie de rouvrir 2026-2027. Le lundi, on joue quatre matchs.

**Ce qu'on attend.** Les matchs de lundi comptent dans la saison de lundi.

**Où ça en est.** `reopenSeason` remet `isActive: true` sur l'ancienne saison et ferme l'autre. À partir de là, tout match créé prend `seasonId` = la saison ACTIVE (matches/route.ts:167-175) : les quatre matchs de lundi entrent dans le tableau de 2025-2026, à côté de ceux de mars. `Season.startsAt`/`endsAt` existent mais ne servent qu'à trier le sélecteur — aucune requête ne les compare jamais à `playedAt`. Personne n'est prévenu, et rien ne permet de déplacer un lot de matchs d'une saison à l'autre (l'édition ne corrige qu'un match à la fois, app/actions/matches.ts:83).

> `app/actions/seasons.ts:53-79 ; app/api/clubs/[clubId]/saisons/[saisonId]/route.ts:44-54 ; app/api/clubs/[clubId]/matches/route.ts:167-175`

### `SAISON-D4` — ⚠ faux · *gêne une saison*

**La situation.** Un joueur regarde son Élo sur sa fiche : 1043. Le capitaine ouvre le palmarès de la saison : « Élo le plus haut — Karim, 1088 ». Le même exporte le classement en CSV : la colonne Élo dit encore autre chose.

**Ce qu'on attend.** Un mot, un nombre. Ou trois mots pour trois nombres.

**Où ça en est.** `computeElo` rejoue les matchs DU SCOPE en repartant de 1000 (stats.ts:139-160). La fiche appelle `getLeaderboard({clubId})` — donc toutes saisons ; le palmarès et le CSV appellent `getLeaderboard({clubId, seasonId})` — donc la saison seule, avec une base remise à 1000 le 1er septembre. Les trois nombres portent la même étiquette « Élo » et aucun écran ne dit sa portée. Le classement d'une soirée (`getLeaderboard({matchDayId})`, sessions/[id]/page.tsx:126) rejoue même l'Élo sur les quatre matchs du soir seulement.

> `app/c/[slug]/players/[id]/page.tsx:203-210 et app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:130-131 (allTime) ; lib/stats.ts:139-160 et 328-330 (topElo, saison) ; app/api/clubs/[clubId]/export/route.ts:59, 85 (saison demandée)`

### `SAISON-D6` — ⚠ faux · *gêne une saison*

**La situation.** Sur Stats, « La soirée la plus prolifique — 31 buts · 5 matchs · Lundi 12 janvier ». On ouvre la fiche de cette soirée : elle affiche 34 buts, et elle est datée du 15 janvier.

**Ce qu'on attend.** Le même nombre de buts et la même date pour la même soirée.

**Où ça en est.** Deux écarts dans le même record. (1) La date : `parSoiree` prend `date: m.playedAt` du PREMIER match rencontré (stats.ts:698), pas `MatchDay.date` — une soirée saisie après coup, ou dont un admin a corrigé la date d'un match (app/actions/matches.ts:79, qui ne recalcule ni ne revérifie le rattachement à la soirée), est datée du mauvais jour. (2) Les buts : les records ne comptent que les matchs INTERNAL (stats.ts:670) alors que la fiche de la soirée additionne tous les matchs terminés, match contre un club extérieur compris (sessions/[id]/page.tsx:122). L'API de la soirée, elle, ne compte que les internes (soirees/[matchDayId]/route.ts:156) — donc le site et l'app donnent déjà deux totaux différents pour la même soirée, et les records un troisième.

> `lib/stats.ts:670, 696-707 (getClubRecords) ; app/c/[slug]/sessions/[id]/page.tsx:111-122 ; app/api/clubs/[clubId]/soirees/[matchDayId]/route.ts:156, 167`

### `SOIREE-D3` — ⚠ faux · *gêne une saison*

**La situation.** Un admin supprime une soirée créée en double, où trois matchs avaient déjà été joués et où huit personnes avaient payé.

**Ce qu'on attend.** Soit c'est refusé, soit on dit exactement ce qui part — et rien ne doit continuer à compter en orphelin.

**Où ça en est.** La suppression est un `prisma.matchDay.delete(...).catch(() => null)` sans le moindre contrôle du contenu (lignes 49-52), et elle rend `{ ok: true }` même quand rien n'a été supprimé. La cascade détruit définitivement les réponses ET les paiements (Rsvp) ET la compo préparée (MatchDayLineup), pendant que les trois matchs survivent avec `matchDayId: null` : ils continuent de compter au classement, à l'Élo, au derby et aux records, mais n'apparaissent plus sur aucun lundi, ne sont plus dans « soirées jouées », et les records « de soirée » les ignorent (lib/stats.ts:697). Le bilan de saison perd une soirée et garde ses matchs — l'inverse exact de SAISON-D1, et le même écran s'en trouve faux dans les deux sens.

> `app/actions/matchday.ts:37-54 (deleteMatchDay) ; prisma/schema.prisma : Rsvp.matchDay onDelete Cascade, MatchDayLineup onDelete Cascade, Match.matchDay onDelete SetNull`

### `VEST-D1` — ⚠ faux · *gêne une saison*

**La situation.** Sur la fiche d'un joueur, on lit « 12 Buts » dans les quatre chiffres du haut, et juste en dessous « Buts — 11, encore 14 pour 25 ».

**Ce qu'on attend.** Deux fois le même nombre de buts sur le même écran.

**Où ça en est.** `getTropheesJoueur` commence par restreindre les matchs à ceux où le joueur est PARTICIPANT (`matches.filter(m => m.participants.some(...))`, ligne 951) puis compte ses buts dedans ; `getLeaderboard` compte ses buts dans TOUS les matchs du scope, participant ou non (ligne 196). Dès qu'un but est crédité à quelqu'un hors feuille (cf. APRES-D2), le chiffre du haut et le palier du bas divergent définitivement, et le trophée « 25 buts » ne se déclenche jamais. Même chose pour les matchs joués et les victoires, comptés dans deux boucles différentes.

> `lib/stats.ts:951-953 (getTropheesJoueur) contre lib/stats.ts:196-200 (getLeaderboard) ; affiché ensemble par app/c/[slug]/players/[id]/page.tsx:98-110 et 230+, et par app/api/clubs/[clubId]/joueurs/[playerId]/route.ts`

### `VEST-D2` — ⚠ faux · *gêne une saison*

**La situation.** Un joueur ouvre sa fiche en octobre. En haut : « 63 matchs, 41 buts ». Plus bas, la liste saison par saison : 2024-2025 = 22 matchs, 2025-2026 = 30 matchs. Il additionne, il trouve 52.

**Ce qu'on attend.** Les saisons additionnées font la carrière — ou l'écran dit ce qui manque (« 11 matchs hors saison »).

**Où ça en est.** `bySeason` boucle sur les saisons existantes et n'ajoute une ligne que si `getLeaderboard({seasonId})` connaît le joueur ; `allTime` vient de `getLeaderboard({clubId})`, sans saison. Tout match dont `seasonId` est null — et il y en a par construction : joué entre la clôture de juillet et l'ouverture de septembre, ou dans un club qui n'a jamais ouvert de saison (cf. DATA-01 du balayage « match en direct ») — compte dans la carrière et dans AUCUNE ligne de saison. Rien ne nomme ces matchs orphelins nulle part, et aucun écran n'offre de les rattacher.

> `lib/stats.ts:393-399 (bySeason) et 400-401 (allTime) ; app/c/[slug]/players/[id]/page.tsx:265-280 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:160-170`

### `VEST-D3` — ⚠ faux · *gêne une saison*

**La situation.** Le gardien attitré est absent ; Momo, joueur de champ, prend les gants ce soir. Trois matchs, six buts encaissés. Le lendemain, on ouvre la carte « Les gardiens » et la fiche de Momo.

**Ce qu'on attend.** La carte compte les matchs où il a réellement gardé — c'est ce qu'elle annonce.

**Où ça en est.** `MatchParticipant.isGk` n'est jamais choisi pour un soir : au coup d'envoi il recopie `Player.isGk`, c'est-à-dire la case cochée sur la FICHE (NewMatchForm.tsx:200 `isGk: p.isGk ?? false`, compo.tsx:239 idem). La compo préparée de la soirée porte pourtant bien un `isGk` par joueur (MatchDayLineup.isGk, écrit par app/actions/compo.ts:71) — mais l'écran de saisie du site le jette (matches/new/page.tsx:104-107 ne remonte que playerId et team) et l'app ne lit jamais la compo préparée. Et un joueur qui entre en cours de match est toujours inscrit `isGk: false` (local.ts:638, lineup/route.ts:176). Donc : le gardien de fiche absent ce soir-là garde quand même ses buts encaissés sur la carte, Momo n'y apparaît jamais, et « moyenne par match » est fausse pour les deux, pour toujours.

> `lib/stats.ts:1120-1145 (getGardiens lit MatchParticipant.isGk) ; app/c/[slug]/matches/new/NewMatchForm.tsx:200, 272-275 ; app/c/[slug]/matches/new/page.tsx:104-107 ; five-scorer-mobile/app/compo.tsx:239-240 ; five-scorer-mobile/lib/match/local.ts:634-640`

### `DIRECT-D1` — ✗ absent · *gêne une saison*

**La situation.** Deux téléphones saisissent le même match programmé. Sur le premier, on envoie Karim en face ; sur le second, resté hors réseau, on envoie Momo en face. Chacun voit bien qu'il reste du monde des deux côtés. Les deux files partent.

**Ce qu'on attend.** Un match interne garde deux camps non vides — sinon le classement inscrit un résultat à des gens qui n'ont pas joué ce match-là.

**Où ça en est.** La règle « il faut au moins un joueur de chaque côté » est écrite deux fois — dans la couche locale du site et dans celle de l'app — et zéro fois côté serveur. Le PATCH lineup fait un `updateMany` sans compter ce qui reste dans le camp de départ (lignes 76-81) ; le POST /matches ne refuse que `all.length === 0`, jamais un `teamB: []` (lignes 137-139). Un camp vidé passe donc par la file, et lib/stats.ts distribue ensuite un nul 0-0 (ou une défaite) à tous les joueurs restants — exactement le bug que le commentaire de local.ts:594-597 dit vouloir empêcher. Le commentaire décrit une garde qui n'existe que dans le téléphone.

> `Serveur : app/api/clubs/[clubId]/matches/[matchId]/lineup/route.ts:76-81 et app/api/clubs/[clubId]/matches/route.ts:137-146. Garde locale seulement : lib/localMatch.ts:509-515 et five-scorer-mobile/lib/match/local.ts:598-601`

### `DIRECT-D2` — ✗ absent · *gêne une saison*

**La situation.** Le téléphone du marqueur meurt à la mi-temps ; ou l'app est réinstallée ; ou quelqu'un rouvre une feuille laissée ouverte la semaine dernière. On redescend la feuille du serveur pour continuer. Deux joueurs avaient changé de camp en première période.

**Ce qu'on attend.** La feuille redescendue est celle du serveur, équipes de départ comprises : ce qui repart au serveur ne doit pas réécrire l'histoire.

**Où ça en est.** `initialTeam` — le champ dont lib/stats.ts dit qu'il porte TOUS les agrégats — n'a de colonne ni dans le miroir Dexie du site (lib/db.ts:48-55) ni dans le SQLite de l'app (db/schema.ts : `participants(key, match_id, player_id, team, is_gk)`). GET /matches/[matchId] rend bien `initialTeam` (route.ts:86) mais il n'y a nulle part où l'écrire. Conséquence : sur le téléphone, l'équipe de départ n'existe pas ; un `movePlayer` local écrase simplement `team` (local.ts:597) et le camp d'origine est perdu pour toujours côté appareil. Toute reprise, tout récap local, tout écran de feuille repart de l'équipe de fin.

> `lib/db.ts:48-55 (LocalParticipant, site) ; five-scorer-mobile/db/schema.ts, table `participants` ; five-scorer-mobile/lib/outbox/types.ts:60-67 ; l'API l'envoie pourtant : app/api/clubs/[clubId]/matches/[matchId]/route.ts:86`

### `SAISON-D2` — ✗ absent · *gêne une saison*

**La situation.** Deux admins ouvrent la saison au même moment (ou le capitaine double-clique « Créer »). Il y a maintenant deux lignes `isActive: true`. Le lundi suivant, l'un ouvre Stats sur le site, l'autre l'accueil de l'app.

**Ce qu'on attend.** Tout le monde parle de la même « saison en cours », et les matchs de ce soir tombent dedans.

**Où ça en est.** Rien n'interdit deux saisons actives : le schéma porte `@@index([clubId, isActive])`, pas un unique, et la fermeture de l'ancienne (app/actions/seasons.ts:18-22) se fait dans une transaction qui ne verrouille rien. Et surtout, « la saison active » se lit de deux façons dans le dépôt : avec `orderBy: { startsAt: "desc" }` (matches/route.ts:171, matchday.ts:23, schedule.ts:58, players/[id]/page.tsx:36…) et SANS aucun ordre — donc au hasard du plan de requête — dans l'accueil de l'app (accueil/route.ts:33), la fiche joueur de l'app (joueurs/[playerId]/route.ts:30) et la pose du calendrier (calendrier-serveur.ts:84). Trois écrans peuvent donc afficher les chiffres d'une saison pendant que les matchs se rangent dans l'autre.

> `prisma/schema.prisma (model Season) ; app/api/clubs/[clubId]/accueil/route.ts:33-36 ; app/api/clubs/[clubId]/joueurs/[playerId]/route.ts:30-33 ; lib/calendrier-serveur.ts:84-87 ; app/api/clubs/[clubId]/matches/route.ts:169-175`

### `VEST-D4` — ✗ absent · *gêne une saison*

**La situation.** Karim s'inscrit en novembre, tape « C'est moi » sur la fiche de son frère par erreur, s'en aperçoit, puis tape « C'est moi » sur la sienne. Le club a maintenant une personne, deux fiches, et quinze matchs d'un côté, trois de l'autre.

**Ce qu'on attend.** Un joueur, une fiche, un historique. Et quand il y en a deux, un geste pour les recoller.

**Où ça en est.** `rattacherJoueur` délie l'ancien profil en silence (`updateMany({where:{clubId,userId}, data:{userId:null}})`, ligne 116) avant d'écrire le nouveau : aucun refus, aucun avertissement, et la fiche abandonnée garde tous ses matchs, ses buts, ses trophées. `assurerProfilJoueur` (rejoindre.ts:88) crée par ailleurs une fiche neuve à chaque nouveau membre dont le nom ne correspond à rien. Rien dans le dépôt ne recolle deux fiches : les stats de la personne restent coupées en deux, dans deux rangées du tableau, deux Élo, deux séries — définitivement. Même situation dès qu'un invité d'un soir devient membre (VEST-40) ou qu'un ancien archivé revient (REG-24).

> `lib/rattachement.ts:113-121 ; lib/rejoindre.ts:88-113 (assurerProfilJoueur) ; aucune fonction de fusion dans app/ ni lib/ (grep « fusion|merge » : rien)`

### `TRANS-D1` — ⚠ faux · *confort*

**La situation.** Le club ajoute une soirée de rattrapage un dimanche à 00 h 30 (heure de Paris), ou une soirée tombe le 1er du mois juste après minuit. On ouvre l'écran Saison.

**Ce qu'on attend.** Une soirée du 1er octobre est dans le groupe « octobre 2026 ».

**Où ça en est.** La clé de regroupement est `${d.getFullYear()}-${d.getMonth()}` — le fuseau du PROCESSUS, c'est-à-dire UTC sur Vercel — pendant que le titre du groupe est rendu par `D.moisAnnee(d)`, en heure de Paris, et le quantième par `D.quantieme` idem. Une soirée du 1er octobre à 00 h 30 tombe donc dans le groupe de septembre tout en s'affichant « mer. 1 ». C'est la même faute que celle déjà corrigée dans lib/dates.ts (le commentaire d'en-tête la raconte) et que celle qui reste dans l'anti-doublon du calendrier (lib/calendrier-serveur.ts:152-156, `jourCle`) et dans l'export CSV (export/route.ts:110, `toISOString().slice(0,10)`) : trois endroits jugent encore « quel jour c'est » hors du fuseau du club.

> `app/c/[slug]/saison/page.tsx:181-184 ; app/api/clubs/[clubId]/saison/route.ts:209-216 ; à comparer à lib/dates.ts:17 et 60-79 (quantieme, minuit) qui, eux, passent par Europe/Paris`
