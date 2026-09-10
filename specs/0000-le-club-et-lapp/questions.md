# 0000 — Ce que seul le club peut trancher

*Annexe de la spec produit. 184 questions sorties du balayage du 10 septembre 2026.*

Aucune ne se tranche dans le code : ce sont des choix de club. Elles sont posées avec
ce que le code fait AUJOURD'HUI entre parenthèses, parce qu'un défaut qui dure depuis
un an est déjà une réponse — il faut juste savoir si c'est celle qu'on voulait.

---

## Comptes, connexion, clubs

1. Qui entre dans le club ? Le lien WhatsApp vaut-il accord du capitaine (aujourd'hui : oui, entrée directe et définitive), ou faut-il une validation, une expiration, un usage unique ?

2. Mot de passe oublié : par email (donc un service d'envoi à choisir et payer) ou par le capitaine (il réinitialise, dicte un mot de passe provisoire) ? Et sans email vérifié, comment prouver que c'est bien lui ?

3. Google est-il configuré en production ? Si oui, doit-il exister sur l'app — sinon les comptes Google ne peuvent pas s'y connecter ?

4. Que fait-on de l'adoption automatique d'une fiche par le nom ? Confirmer (« Karim, c'est toi ? »), proposer un choix parmi les fiches libres, ou laisser le capitaine lier à la main ? Et les homonymes ?

5. Après une mauvaise adoption, la fiche vide créée doit-elle être supprimée, archivée, ou fusionnée ? (Rien ne supprime un joueur aujourd'hui.)

6. Un membre peut-il quitter le club de lui-même ? Sa fiche est-elle alors déliée comme pour un retrait ?

7. Le capitaine peut-il passer la main ? À qui, comment, et que devient-il (admin, membre, parti) ?

8. Un compte sans fiche : le capitaine la crée toujours, ou le membre peut-il créer la sienne ? Que peut-il faire entre-temps (répondre à une soirée ?)

9. Sur un téléphone partagé, se déconnecter avec des buts non envoyés : les jeter avec avertissement (aujourd'hui), l'interdire tant que la file n'est pas vide, ou les garder pour le prochain qui se connecte avec le même compte ?

10. Hors ligne au gymnase, l'app doit-elle s'ouvrir sur le club depuis sa mémoire locale, même sans avoir pu vérifier la session ? Quelle est la règle si la session a expiré entre-temps ?

11. Que dit-on à quelqu'un qui a été retiré du club, et que deviennent ses opérations non envoyées ?

12. Le code court affiché aux admins doit-il être saisissable (donc accepté par le serveur), ou ne montre-t-on que le lien ?

13. Faut-il pouvoir supprimer son compte (RGPD) ? Que deviennent sa fiche, ses buts, ses votes ?

14. Les routes génériques de Better Auth (quitter, supprimer le club, inviter par email…) doivent-elles être fermées, ou remplacées par les règles du club ?

15. Changer son nom / son email / son mot de passe : nécessaire pour ce club de 18, ou reporté ?

16. Durée de session : 90 jours renouvelés convient-il, et faut-il voir/fermer ses sessions sur les autres appareils ?

## La soirée

1. Capacité et seuil : quelle est la vraie capacité du créneau à Urban Soccer Guyancourt (10 ? 12 ? 18 ?) et y a-t-il jamais une liste d'attente dans ce club ? Le défaut de 12 place six joueurs « en attente » un lundi à 18 si personne n'a touché au réglage.

2. Qui paie le terrain : ceux qui ont dit venir (règle actuelle), ceux qui ont joué d'après les feuilles, ou le capitaine coche à la main ? L'invité d'un soir paie-t-il sa part ?

3. Annuler : qui peut (admins seulement ?), faut-il un motif, et la soirée annulée doit-elle disparaître de l'accueil et des rappels, ou rester visible barrée jusqu'à sa date ?

4. Faut-il pouvoir supprimer une soirée, ou seulement l'annuler ? Si supprimer reste possible, que fait-on des matchs joués dedans ?

5. Réponse après coup : le mardi, le capitaine doit-il pouvoir corriger « qui était là » (pour la caisse) ? Et un simple membre, jusqu'à quand peut-il répondre ?

6. La file d'attente : re-toucher son propre statut doit-il conserver sa place ? Un joueur qui s'abonne après la création de la soirée prend-il la file derrière ceux qui ont déjà répondu ?

7. Le mot du jeudi : le club veut-il un texte prêt à coller pour WhatsApp avec les équipes, les présents, le lieu et l'heure ? Sous quelle forme (par équipe ? avec les « peut-être » ?)

8. Prévenir : quand la compo est faite, quand on monte de la liste d'attente, quand il manque du monde — par notification push, par le mot WhatsApp, ou pas du tout ?

9. Changer une soirée créée (heure, lieu, titre, consigne) : qui a le droit, et jusqu'à quand ?

10. La compo : tout membre qui peut scorer peut réécrire la compo du capitaine — voulu, ou réservé aux admins ? Un absent déclaré doit-il sortir automatiquement de la compo ?

11. Hors-ligne sur l'app : la réponse de présence doit-elle passer par la file (le capitaine qui règle les présences au gymnase pour la caisse), ou le réseau reste-t-il exigé comme décidé ?

12. Le lundi lancé depuis l'accueil de l'app : faut-il rattacher automatiquement un match à la soirée du jour (par date), ou exiger de passer par la fiche de la soirée ?

13. Une soirée passée de plus de six semaines : encore saisissable partout, nulle part, ou seulement par un admin (même question que Q2 de la spec 0001) ?

14. Deux soirées le même lundi : interdit à la création unitaire, ou toléré (tournoi + soirée) ?

15. Il n'existe aucun test sur lib/presences.ts (la règle du club la plus lue) : la spec doit-elle exiger des cas vérifiables par commande, comme pour 0001 ?

16. Un « peut-être » garde-t-il une place dans la file, ou non ? Aujourd'hui il n'en garde aucune, et personne ne le sait — c'est la réponse la plus honnête qui fait perdre le terrain.

17. Faut-il montrer son rang au remplaçant (« 2e sur la liste ») ou seulement le mot « en attente » ? Le rang est déjà calculé (lib/presences.ts:111) et jeté.

18. L'ancienneté d'un abonné est-elle permanente (il est devant celui qui répond, chaque semaine, pour toujours) ou se remet-elle à zéro à chaque soirée ? Avec douze abonnés et douze places, le club est fermé et l'occasionnel ne joue plus jamais.

19. Une réponse doit-elle pouvoir se RETIRER (revenir à « je n'ai pas répondu »), ou une réponse posée est-elle définitive jusqu'à la suivante ?

20. Y a-t-il un pointage le lundi soir ? Que se passe-t-il entre « j'ai dit oui jeudi » et « je suis sur la feuille de match » — qui libère la place du titulaire qui n'est pas venu, et à quelle heure ?

21. La capacité (12 par défaut) est-elle une capacité de TERRAIN ou de ROTATION ? Un five à 14 qui tourne fait jouer tout le monde ; aujourd'hui les deux derniers sont dits « en attente » et sortis de la caisse.

22. Une convocation de match et une réponse de soirée sont-elles la même réponse ? La base en tient deux, indépendantes, pour le même lundi.

23. Sur quel chiffre un occasionnel se lit-il : les matchs joués, ou les soirées venues ? Le second n'existe nulle part.

24. Le club veut-il savoir qui a posé un lapin — et cette information doit-elle peser sur la file la semaine suivante, ou rester hors de l'app ?

25. Quand une place se libère samedi soir, qui prévient le premier de la file, et par quel moyen pour la moitié du vestiaire qui n'a pas de compte ?

## Le match en direct

1. Reprendre un match sur un autre téléphone que celui qui l'a commencé : jusqu'où ? Descendre la feuille du serveur (la route GET matches/[id] existe pour ça) puis continuer — et si les deux téléphones écrivent, lequel a raison sur un but tapé deux fois ?

2. Deux feuilles en direct pour la même soirée : refuser au coup d'envoi, prévenir et laisser faire, ou est-ce un cas réel (deux terrains loués le même soir) ?

3. Un joueur qui quitte le match (blessé, parti tôt) ou qui finalement n'est pas venu : le retirer de la feuille — et que deviennent son apparition, son résultat, son Élo ?

4. L'invité qui arrive en retard : le créer depuis la feuille, ou exiger de repasser par la compo ?

5. La minute d'un but : chrono de jeu (pauses exclues, comme le site) ou temps depuis le coup d'envoi (comme l'app) ? Une seule réponse pour les deux, et pour la mi-temps.

6. « Déjà joué » à moins de six heures : le choix explicite doit-il primer sur le seuil ? Le seuil de six heures est-il le bon pour un club qui joue de 20h à 22h ?

7. Une soirée saisie comme un seul match cumulé (18-9) : le club veut-il que ça compte comme un match, ou faut-il l'inciter à découper — et que valent alors classement et Élo ?

8. Le vote de l'homme du match a-t-il une fenêtre (la soirée, la semaine) ? Peut-on voter, ou changer son vote, sur un match d'une saison close ?

9. Un carton rouge sort-il le joueur (plus de but possible pour lui) ou n'est-ce qu'une trace ?

10. La saison d'un match rattrapé : celle de la date jouée, ou la saison active au moment de la saisie ?

11. Quand le serveur refuse pour de bon des buts saisis par un membre (match terminé ailleurs, droits retirés), qui répare ? Le membre doit-il pouvoir passer la main à un admin, ou l'admin voir les refus depuis son propre téléphone ?

12. L'app doit-elle rejoindre le site sur « On rejoue — mêmes équipes » et sur le récap local avant réseau, ou le club accepte-t-il de repasser par la compo entre deux matchs ?

13. Le gardien d'un soir : se décide-t-il sur la compo de la soirée (calendrier), au coup d'envoi, ou en cours de match ?

14. Quand le téléphone meurt chrono en marche, le chrono doit-il continuer de courir (temps réel) ou se figer à l'extinction ?

15. Un match programmé sur le site puis lancé depuis l'app : doit-il devenir CE match, ou un nouveau — et que fait-on du programmé resté en plan ?

16. Un but marqué pendant que le chrono est en pause : c'est un but de la 12e minute, ou un but sans minute ? Aujourd'hui la minute vient de l'heure du coup d'envoi et ignore le chrono (lib/match/local.ts:424) — le club veut-il la minute de JEU, ou l'heure de la montre ?

17. Le marqueur joue. Est-ce que le club accepte que les quatre buts d'un match soient tapés à la fin, tous à la même minute — ou est-ce qu'on préfère alors une feuille sans minutes du tout, comme le mode rétro ?

18. Combien de temps une feuille reste-t-elle « reprenable » ? Un match ouvert un lundi et jamais terminé doit-il se fermer tout seul, être réclamé mardi matin, ou rester là jusqu'à ce que quelqu'un s'en occupe ?

19. Quand le téléphone est sur un réseau qui ment (portail captif du gymnase), qu'est-ce qu'on montre au marqueur — et accepte-t-on de retenir la file tant qu'on n'a pas eu une réponse reconnaissable de NOTRE serveur, au prix d'un envoi plus tardif ?

20. Le gardien du soir : la feuille de match doit-elle le montrer ? Et quand ce n'est pas le gardien attitré (il est absent, un joueur de champ prend les gants), qui le dit et à quel moment ?

21. Le marqueur doit-il pouvoir verrouiller la feuille pendant qu'il joue — ou assume-t-on qu'elle reste ouverte et tapable dans le sac ?

22. Deux gestes voisins comptent un but pour deux camps opposés : la dernière tuile d'une colonne et « Contre son camp ». On les éloigne, on confirme le csc, ou on assume ?

23. La mi-temps : le club la siffle-t-il vraiment sur des matchs de 10 minutes joués quatre à huit fois dans la soirée, ou est-ce un reste du foot à 11 qu'on peut retirer de la barre ?

24. L'homme du match se vote-t-il au vestiaire, dans les dix minutes, ou dans la semaine ? La réponse décide si le vote doit entrer dans la file d'attente hors-ligne.

25. Après « Terminer », où doit-on atterrir : sur le récap du match qu'on vient de jouer, ou directement sur la compo du suivant ? Aujourd'hui on atterrit sur la liste des clubs.

26. Le club joue à 10-18. Combien de joueurs par colonne la feuille doit-elle tenir sans défilement — et qu'est-ce qu'on sacrifie pour ça, le score de 132 px ou les photos ?

## Après le match

1. Q1 — Qui corrige un match terminé : l'admin seulement (ce que le serveur impose aujourd'hui avec « Admin requis pour modifier un match terminé »), ou celui qui a le droit de saisir (proposition de la spec 0001) ? Si canScore, faut-il un garde-fou côté serveur qui exige alors la trace « par qui » ?

2. Q2 — Jusqu'à quand peut-on corriger, voter, supprimer ? Aujourd'hui : jamais de limite. Six semaines comme le calendrier de saison ? Jusqu'au match suivant ? Jusqu'à la clôture de la saison ?

3. Q3 — Un match lancé par erreur ou qui n'a pas eu lieu : faut-il un geste « annuler » sur un match LIVE ou FINISHED (il reste visible, il ne compte pas), et retirer la suppression comme le dit la spec 0001 ? Ou la suppression reste-t-elle un outil d'admin, avec une corbeille ou une trace ?

4. Q4 — Un match annulé (ou supprimé) doit-il rester visible dans l'historique et la soirée, marqué comme tel, plutôt que d'y disparaître ou d'y passer pour « Terminé 0–0 » ?

5. Q5 — Le lien public d'un match (/r/[id]) doit-il marcher pour un club qui n'a pas activé sa page publique ? Aujourd'hui oui, et ce n'est écrit nulle part.

6. Q6 — Qui vote pour l'homme du match : tout membre du club, ou seulement ceux qui ont joué ce match ? Peut-on retirer sa voix ? Comment annonce-t-on l'égalité (ordre alphabétique aujourd'hui, en silence) ?

7. Q7 — Quand le vote se ferme-t-il ? Un vote tardif sur une saison close change aujourd'hui le palmarès. Et si l'admin pose un MVP à la main en mode vote, sa décision doit-elle tenir face aux voix suivantes ?

8. Q8 — Sur l'app, après « Terminer » au gymnase : un récap local avec « On rejoue » et « n à envoyer » comme sur le site, ou le retour à l'accueil actuel est-il voulu ?

9. Q9 — Changer un but de buteur : un geste en un tap, ou retirer puis rajouter (ce que le serveur permet) ? Et corriger une minute ?

10. Q10 — Un match saisi le mauvais jour : faut-il pouvoir le rattacher à une autre soirée (aujourd'hui seule la date bouge, pas la soirée) ?

11. Q11 — Deux téléphones sur le même match : les buts arrivés après le coup de sifflet de l'autre sont-ils fusionnés (avec trace) ou refusés — et la même règle quel que soit le rôle de celui qui les tenait ?

12. Q12 — Les notes d'un match : où doivent-elles se lire (récap, carte, mot de la soirée) — ou faut-il retirer le champ ?

13. Q13 — Corriger un match d'une saison close : interdit, ou permis avec un avertissement très visible et une trace ? Et le classement de la saison close doit-il être figé (instantané) plutôt que recalculé ?

14. Q14 — La carte de partage doit-elle exister sur l'app (image native), ou le lien public suffit-il au téléphone ?

## Le vestiaire

1. Q1. À l'adhésion, garde-t-on l'adoption automatique par le nom (club.ts:28-57), ou remplace-t-on la création silencieuse d'une fiche neuve par une question à la première connexion — « Laquelle de ces fiches est la tienne ? » — avec « aucune » comme réponse possible ?

2. Q2. Deux fiches pour la même personne (le doublon de VEST-22, l'invité qui revient de VEST-40) : faut-il pouvoir FUSIONNER deux fiches, qui en a le droit, et que deviennent les matchs, les buts, les votes et les trophées des deux ?

3. Q3. « Ce n'est pas moi » : un membre peut-il délier sa fiche seul, ou seulement le capitaine ? Et le capitaine peut-il rattacher une fiche à un membre pour lui (le serveur sait le faire, aucune interface ne le propose) ?

4. Q4. Un invité qui devient un habitué : promotion de la fiche invitée en fiche normale avec son historique (un geste admin), ou création d'une fiche neuve en repartant de zéro ? Et dans ce cas, l'invité pourra-t-il un jour revendiquer sa fiche ?

5. Q5. Qui peut modifier sa PROPRE fiche : la photo et le surnom au moins ? Le nom ? Le niveau reste-t-il réservé au capitaine ?

6. Q6. Le niveau 1-5 doit-il être visible de tous les membres (étoiles du vestiaire, « Niveau 2 » en sous-titre), ou seulement du capitaine et des admins qui composent les équipes ?

7. Q7. Un joueur ajouté par le capitaine doit-il être abonné aux lundis par défaut ? Et doit-on pouvoir régler l'abonnement dès la création, avant le premier match ?

8. Q8. Archiver un joueur doit-il le désabonner ? Réactivé, revient-il abonné ?

9. Q9. Un abonné qui n'est pas venu depuis N lundis (sans s'être déclaré absent) : le signaler au capitaine, le désabonner automatiquement, ou ne rien faire ?

10. Q10. Hors réseau au gymnase : ajouter un joueur ou prendre sa photo doit-il passer par la file d'attente comme un but, ou exiger le réseau comme les réglages — et dans ce cas, le geste au bord du terrain est-il TOUJOURS l'invité ?

11. Q11. Le vestiaire et les fiches doivent-ils se lire hors réseau depuis le miroir local (qui a déjà les visages), même figés à la dernière synchronisation ?

12. Q12. Les photos sur la vitrine publique : par défaut pour tous, ou à l'accord de chacun (un réglage « ma photo reste dans le club ») ?

13. Q13. Deux prénoms identiques au club : interdire, exiger un surnom ou une initiale, ou laisser faire et compter sur la photo ?

14. Q14. Le même invité d'un lundi à l'autre : quand on tape « + Invité » et un prénom qui existe déjà en invité, proposer de le reprendre ?

15. Q15. Un blessé pour trois mois : faut-il un « absent jusqu'au … » distinct du désabonnement, ou se désabonner et se réabonner suffit ?

16. Q16. Un joueur qui garde souvent mais n'est pas coché « gardien », ou l'inverse : la fiche doit-elle dire pourquoi la carte « Dans les buts » est là ou pas (elle compte les matchs réellement gardés) ?

17. Q17. Quand un match corrigé fait disparaître un trophée (un but retiré sous un palier), faut-il le dire à quelqu'un ?

## La saison et les stats

1. L'équipe A est-elle TOUJOURS Blanc ? Le derby, la ligne « Blanc contre Noir » du bilan et les soirées gagnées comptent par position A/B, pas par chasuble : que doit-il se passer le soir où la feuille a inversé les camps, ou nommé les équipes autrement ?

2. Poser le calendrier de la saison suivante doit-il OUVRIR cette saison (et clôturer l'autre), ou faut-il exiger que la précédente soit clôturée avant ? Aujourd'hui il étire la saison active et ignore le nom tapé.

3. Quand une saison finit-elle vraiment : à la clôture manuelle, ou à une date (31 juillet) ? Et la suivante commence-t-elle au clic ou au 1er septembre ? Qui a la charge de le faire, et que se passe-t-il si personne ne le fait ?

4. Un match saisi après coup appartient-il à la saison de SA DATE ou à la saison active au moment de la saisie (ou de la synchro) ?

5. Que faire des matchs sans saison : les rattacher d'office à la saison qui couvre leur date ? Les montrer comme orphelins quelque part ?

6. Un invité d'un soir doit-il figurer au tableau de la saison et pouvoir remporter un titre du palmarès ? Un joueur archivé doit-il rester dans le tableau de la saison en cours ?

7. Le gardien est-il fixe sur un match, ou tourne-t-il toutes les dix minutes ? La carte Gardiens ne vaut que si isGk désigne celui qui a gardé tout le match.

8. Le barème (3 / 1) doit-il se figer à la clôture d'une saison, ou un changement rejoue-t-il toute l'histoire ?

9. Sur une saison, l'Élo doit-il repartir de 1000 (comportement actuel du sélecteur) ou se cumuler d'une saison à l'autre ? Et où le club veut-il le voir ?

10. La trêve : 24 décembre → 1er janvier suffit-il, ou suit-on les vacances scolaires (Toussaint, Noël deux semaines, février) ? Joue-t-on les lundis fériés (Pâques, Pentecôte) ?

11. Faut-il pouvoir renommer, fusionner ou masquer une saison créée en double ? Et un adversaire mal orthographié ?

12. Faut-il un « défaire » après une pose ratée (mauvais jour, mauvaise heure) : annuler ou supprimer d'un bloc les soirées vides d'une saison ?

13. Sur le téléphone, faut-il lire les stats sans réseau (le dernier tableau connu, daté), et signaler les matchs en attente de synchro qui n'y figurent pas encore ?

14. À quoi sert l'export : le WhatsApp de fin de saison, le tableur du trésorier ? Doit-il partir du téléphone, et contenir les points et l'ordre du tableau ?

15. Le tableau « Adversaires » en poule (le club classé parmi ses adversaires) a-t-il un sens pour un club qui joue contre lui-même quarante lundis par an ?

## Réglages, membres, rôles

1. Q1. Qui a le droit de quoi, exactement ? Aujourd'hui `canManage` ne distingue PAS le capitaine de l'admin (lib/guard.ts:59) : un admin change le barème, les chasubles, le nom du club et régénère le lien d'invitation, tout comme le capitaine. Est-ce que le club veut ça, ou est-ce que certaines lignes — le barème, la page publique, le nom — doivent redescendre au seul capitaine ?

2. Q2. Le capitanat se transmet-il ? Aujourd'hui non, par aucun chemin (REG-31). Si le capitaine arrête le five, que devient le club ? Proposition à trancher : un transfert explicite, accepté par celui qui reçoit, plutôt qu'un second owner créé en silence.

3. Q3. Est-ce qu'on peut supprimer un club ? La spec 0001 a tranché pour les matchs : on annule, on n'efface pas. Même doctrine ici ? Aujourd'hui l'écran ne le propose pas mais l'endpoint Better Auth le fait, en cascade, sans trace (REG-49). Il faut décider — et si c'est non, fermer la porte.

4. Q4. Le barème est-il un réglage de club ou un réglage de saison ? Le changer aujourd'hui réécrit le classement de septembre (REG-09). S'il devient un réglage de saison, que se passe-t-il pour les saisons déjà closes ? S'il reste un réglage de club, faut-il le figer une fois la première soirée jouée ?

5. Q5. Le lien iCal est-il un outil d'admin ou un outil de joueur ? Le code dit qu'il est fait pour que « chacun le colle une fois », et il est enfermé derrière la porte admin (REG-38). S'il descend au niveau du membre, où vit-il : sur l'accueil, sur la page Saison, dans le menu ?

6. Q6. L'apparence Sombre / Clair est-elle un réglage de club ou de personne ? Elle est écrite dans un cookie personnel mais rangée dans les réglages du club, donc inaccessible aux membres (REG-14) — et l'app l'ignore complètement (REG-15).

7. Q7. Comment on entre dans le club : un lien qui suffit, ou une demande à valider ? Aujourd'hui qui a le lien entre (REG-22). Faut-il une date d'expiration, un nombre d'usages, une approbation du capitaine, ou est-ce que la confiance du groupe WhatsApp suffit ?

8. Q8. Que fait-on du profil joueur de celui qui rejoint ? L'adoption par nom donne l'historique d'un homonyme (REG-23) et rate un ancien archivé (REG-24). Proposition à trancher : on ne devine plus, on PROPOSE — « Es-tu le Thomas du vestiaire ? » — et c'est la personne, ou le capitaine, qui confirme.

9. Q9. Un membre peut-il quitter le club lui-même (REG-30) ? Et si oui, son profil joueur est-il délié comme quand un admin le retire, ou reste-t-il lié ?

10. Q10. Un réglage écrêté (200 → 120) : on refuse en le disant, ou on corrige et on montre la correction (REG-04) ? La réponse vaut aussi pour la valeur silencieusement ignorée (format inconnu, couleur invalide) — le serveur y répond « ok » aujourd'hui.

11. Q11. Quelles combinaisons de bornes sont interdites ? Capacité < minimum rend toute soirée impossible à confirmer (REG-07) ; nul > victoire retourne le classement (REG-08). Faut-il les refuser, les avertir, ou les accepter en assumant ?

12. Q12. Un réglage a-t-il une mémoire ? Faut-il savoir qui a changé quoi et quand (REG-46), au moins pour les gestes qui ne se rattrapent pas : régénérer le lien, promouvoir, retirer, clôturer une saison, allumer la page publique ?

13. Q13. La page publique publie les noms des joueurs sans que personne ne le leur ait demandé (REG-12). Est-ce que l'allumer déclenche un mot au vestiaire ? Est-ce qu'un joueur peut demander à ne pas y figurer ?

14. Q14. Les réglages, hors-ligne : on assume qu'ils exigent le réseau (comme le suppose l'app aujourd'hui), ou est-ce qu'un réglage changé au gymnase doit passer par la file d'attente comme la saisie ? Si on assume le réseau, il faut le DIRE avant l'échec, pas après (REG-34, REG-35).

## Transversal

1. Q1. Une session morte, un membre retiré du club, un club inexistant : le serveur répond 404 aux trois (pour ne pas confirmer l'existence d'un club à qui devine un identifiant). L'app ne peut donc pas distinguer « reconnecte-toi » de « tu n'es plus du club ». Comment on tranche : un code distinct pour la session morte (401), un champ « motif » dans le corps du 404, ou l'app appelle systématiquement /api/me en premier ? C'est la question la plus coûteuse du domaine — tout le reste en découle.

2. Q2. Que doit voir quelqu'un qui ouvre l'app au gymnase SANS réseau, sur l'accueil, les stats, les soirées ? Le dernier état connu (il faut alors un miroir de lecture, qui n'existe pas), ou une phrase honnête « pas de réseau, reviens plus tard » ? Aujourd'hui c'est un message technique avec l'URL complète.

3. Q3. Combien de secondes on attend une lecture avant de renoncer ? Le drain dit 8 s, le service worker du site 4 s et 6 s, les écrans de l'app ne disent rien. Un seul chiffre, ou un par usage ?

4. Q4. Se déconnecter avec une soirée non envoyée : on jette (doctrine actuelle de l'app), on garde (doctrine actuelle du site), ou on refuse de partir tant que ce n'est pas parti ? Les deux moitiés du produit font aujourd'hui l'inverse l'une de l'autre, chacune avec son commentaire justificatif.

5. Q5. Où vit l'écran « ce qui n'est pas parti » sur l'app : une ligne dans le menu du club, une bannière sur l'accueil, ou une pastille cliquable comme sur le site ? Et qu'est-ce qu'on y montre — le nombre, ou la liste avec le motif du refus ?

6. Q6. Un membre sans droit de saisie : on lui cache le bouton « Créer » (il faut alors charger le club avant de dessiner la barre du bas), ou on le laisse composer et on refuse au moment d'enregistrer, en ligne ? La deuxième réponse ne coûte rien si l'app est en ligne, et coûte une soirée entière si elle ne l'est pas.

7. Q7. Notifications : est-ce qu'on abandonne la doctrine iCal maintenant qu'il existe une vraie app ? Si oui, pour quels trois moments exactement — la compo est prête, l'annulation de dernière minute, le rappel du dimanche soir ? Le club préfère-t-il continuer sur WhatsApp, qui a l'avantage d'être là où les gens répondent déjà ?

8. Q8. Si on fait des notifications : qui les reçoit pour les joueurs sans compte et les invités d'un soir ? Aujourd'hui la moitié du vestiaire n'a pas de session.

9. Q9. Le fuseau. Une constante Europe/Paris partagée par le site et l'app (donc un `dates.ts` dans le noyau copié conforme, ce qui suppose de le sortir de `server-only`), ou on assume le fuseau du téléphone et on accepte qu'un capitaine en vacances pose un calendrier décalé ?

10. Q10. Un téléphone perdu : le club veut-il pouvoir couper l'accès ? Ça suppose un écran « mes appareils » et un geste de révocation, qui n'existent nulle part. Ou bien on considère qu'un five de dix-huit personnes n'a pas ce problème et on l'écrit ?

11. Q11. Mise à jour de l'app : est-ce qu'on accepte qu'un bug de saisie découvert un dimanche attende la revue App Store, ou est-ce qu'on met en place les mises à jour à chaud (expo-updates) avant la première vraie saison ?

12. Q12. Le miroir local n'a aucune migration. Est-ce qu'on écrit un mécanisme de version, ou est-ce qu'on assume qu'un changement de schéma efface la base locale — en sachant que c'est là que dort la soirée non synchronisée ?

13. Q13. Le lien d'invitation dans WhatsApp doit-il ouvrir l'app quand elle est installée (liens universels) ? Ça change le premier soir de quelqu'un qui rejoint le club, et c'est la seule porte d'entrée du club.

14. Q14. Accessibilité : le club a-t-il un joueur qui utilise VoiceOver ou une grande taille de texte ? Si oui, la feuille de match est déjà étiquetée mais le score ne s'annonce pas, et rien n'a jamais été essayé à 200 %. Si non, on l'écrit et on n'y revient pas cette saison.
