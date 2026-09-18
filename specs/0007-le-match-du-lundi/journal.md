# 0007 — Journal

*Ce qui a divergé du plan, écrit pendant. Ce qu'un commit fait se lit dans son
diff ; ce qu'il a ÉCARTÉ ne se lit nulle part ailleurs qu'ici.*

---

## 18 septembre — le plan a tenu, sauf sur un point qu'il n'avait pas vu

Les sept tâches sont sorties dans l'ordre prévu, sans surprise de conception.
Ce qui a demandé un arrêt, c'est une compatibilité que ni la spec ni le plan
n'avaient posée.

**Le genre de cible qu'on a failli inventer.** Le plan disait : les trois
écrans proposent de « rattacher ». J'ai commencé par ajouter un genre
`"rattacher"` à la cible que le serveur envoie au calendrier de l'app. Or
`saison.tsx` aiguille sur `cible.quoi` avec **« saisir » en branche par
défaut** : tout téléphone n'ayant pas encore pris la mise à jour aurait reçu
un genre inconnu, serait tombé dans le défaut, et aurait ouvert une feuille
vierge — **le doublon exact que ce lot existe pour empêcher**. `/analyser`
l'avait signalé le 17 comme un risque théorique ; il est devenu concret en une
heure.

Deux corrections, et les deux sont restées :

- le serveur renvoie la cible comme `"match"`, un genre que **toutes** les
  versions comprennent — elles ouvrent le récap de l'orphelin, qui est
  exactement ce qu'on veut montrer ;
- l'app ne traite plus « saisir » comme branche par défaut : un genre inconnu
  ouvre la soirée, jamais une création. C'est le seul changement d'app du lot.

**Le parcours de lecture s'est sali derrière lui, et il me l'a dit.** Mes deux
matchs de vérification naissent `LIVE` : au deuxième passage, l'assertion « y
a-t-il déjà un match ouvert ? » en voyait trois. La leçon était déjà écrite
dans ce fichier — *un test qui ne passe qu'une fois n'est pas un test* — et il
a fallu qu'elle me rattrape. Coup de sifflet ajouté en fin de section ; trois
passages d'affilée verts.

**Ce que la spec avait prévu et qui s'est révélé gratuit.** Le « ne jamais
repasser sur un match existant » — la garantie qui protège un « Aucune — match
isolé » choisi exprès — n'a demandé aucune ligne : l'`update` de l'upsert ne
porte que les noms d'équipe. Le plan l'avait vu ; c'est le seul endroit du lot
où il a fallu écrire un commentaire plutôt qu'un test.

**Un type trop lâche, corrigé en une passe.** `soireeDuJour` reçoit `db` pour
pouvoir lire dans la transaction qui écrit le match. Ma première version
décrivait ce paramètre par une structure à la main ; elle ne tenait pas devant
la signature générique de Prisma. `Pick<Prisma.TransactionClient, "matchDay">`
accepte les deux appelants sans cast.

## 18 septembre — ce qu'on a trouvé en chemin et qui n'est pas de ce lot

**Une erreur d'hydratation sur le site, en développement.** Vue en vérifiant
l'accueil, puis retrouvée à l'identique sur `/players`, une page que ce lot ne
touche pas : elle est antérieure. Pas creusée ici — mais elle ne doit pas
rester non nommée.

## 18 septembre — le tour, vu avant de livrer (article VII)

Sur le jeu d'essai local, une soirée passée et un match joué ce jour-là sans
soirée :

- **l'accueil du site** : « UNE SOIRÉE SANS RÉSULTAT · Mardi 15 septembre ·
  **Ranger le match** » — au lieu de « Saisir la feuille » ;
- **le calendrier du site** : « Gymnase · *un match de ce jour n'a pas de
  soirée* · **Ranger** » — au lieu de « aucun match · Saisir » ;
- **le calendrier de l'app** (par son API) : étiquette « Ranger », ton
  `appel`, cible `match` ;
- **le récap du match** : « Ce match n'appartient à aucune soirée — Soirée du
  Mardi 15 septembre — **Ranger le match ici** ». Un clic, et le match porte
  « Soirée du 15 sept. · Match 1 ». Les trois alarmes se taisent.

La scène a été démontée après.
