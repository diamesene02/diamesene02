# Bâtir dans le nuage

`eas.json` ne peut pas porter de commentaires — EAS rejette toute clé qu'il ne
connaît pas, `//` compris. Les explications vivent donc ici.

## Pourquoi le nuage plutôt que le Mac

Expo SDK 57 reconstruit `ExpoModulesJSI` depuis ses sources à la première
compilation : le hash de cache de `build-xcframework.sh` inclut
`swiftc --version` **et** les chemins locaux `PODS_ROOT`/`RN_ROOT`, il ne peut
donc jamais correspondre sur une machine d'utilisateur. Cette reconstruction
échoue sur le Swift 6.2.4 de Xcode 26.3 :

```
RuntimeScheduler.h:53 error: 'RuntimeScheduler' cannot be annotated with either
SWIFT_RETURNS_RETAINED or SWIFT_RETURNS_UNRETAINED because it is not returning
a SWIFT_SHARED_REFERENCE type
```

Et Xcode 26.3 est le dernier que ce Mac puisse installer : les versions
suivantes exigent macOS 26.2, la machine tourne sous 15.6. Détail complet dans
`../five-scorer/MOBILE.md`, journal du 9 septembre 2026.

## Les trois profils

Ce qui les distingue n'est pas « dev contre prod » mais deux questions : le
bundle JS est-il embarqué, et l'app peut-elle s'installer sans l'App Store ?

### `lundi` — celui du terrain

```bash
npx eas-cli build --platform ios --profile lundi
```

Distribution **interne** : l'app s'installe par un lien sur les iPhones
enregistrés dans l'équipe, sans passer par l'App Store. Configuration Release,
donc le bundle JS est embarqué et l'app démarre **sans Metro** — indispensable
au gymnase, où le Mac n'est pas là.

Elle vise la production, parce que `lib/api.ts` choisit son serveur d'après
l'origine annoncée : un build annonce `fivescorer://`, que la production
accepte. C'est là que vit le vrai club.

### `atelier` — développer un écran depuis un vrai build

Même chose, mais l'app parle au serveur du Mac. L'adresse est posée ici plutôt
que dans un `.env.local` : ce dernier vaut pour tous les modes et détournerait
aussi Expo Go, qui doit continuer de viser le Mac par son propre chemin (voir
le commentaire de `DEFAUT` dans `lib/api.ts`).

L'IP est celle du Mac sur son réseau ; à changer si le réseau change.

### `magasin` — l'App Store, le jour venu

Rien à en faire aujourd'hui.

## Pas de `channel` pour l'instant

Les profils ne déclarent pas de `channel` : les canaux servent aux mises à
jour à distance (OTA) et exigent `expo-updates`, qui n'est pas installé. On
l'ajoutera le jour où l'on voudra corriger un écran sans refaire un build —
ce sera précieux un lundi soir, mais c'est un module natif de plus et ça peut
attendre.

## Ce qu'il faut savoir avant de lancer

- **Les certificats.** L'équipe payante est `M283R456KQ` (`ios.appleTeamId`
  dans app.json). Son certificat de développement **expire le 9 octobre 2026** —
  il faudra alors relancer un build. L'équipe personnelle gratuite
  `5B46ZNYDXV` ne doit jamais être utilisée : son certificat expire encore plus
  tôt, et un build signé avec elle meurt au bout de sept jours.
- **Les appareils.** La distribution interne n'installe que sur les iPhones
  enregistrés dans l'équipe. `npx eas-cli device:list` les montre,
  `device:create` en ajoute.
- **Ce qui est envoyé.** EAS téléverse les fichiers suivis par git. `.env` est
  ignoré, seul `.env.example` part.

## La version de Node

Le projet exige **Node 22** (`.nvmrc`, `engines` dans package.json). Les tests
du schéma local utilisent `node:sqlite`, module intégré depuis Node 22 : sur
Node 20 le fichier n'échoue pas, il explose à l'import sur « No such built-in
module », ce qui n'accuse rien. `nvm use` dans ce dossier suffit.
