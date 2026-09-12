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
  dans app.json). EAS génère son propre certificat de distribution : celui du
  premier build court jusqu'au **4 mars 2027**. Ne pas confondre avec les
  certificats du trousseau local, plus anciens — c'est le profil embarqué dans
  l'`.ipa` qui fait foi, et on le lit ainsi :

  ```bash
  unzip -q build.ipa && security cms -D -i Payload/*.app/embedded.mobileprovision \
    | plutil -extract ExpirationDate raw -
  ```

  L'équipe personnelle gratuite `5B46ZNYDXV` ne doit jamais être utilisée : un
  build signé avec elle meurt au bout de sept jours.
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

## `runtimeVersion` : la règle qui ne se devine pas

`expo-updates` envoie du **JavaScript**, jamais du natif. Un correctif poussé à
chaud atteint les téléphones en quelques minutes — mais il ne porte ni un module
natif, ni une permission, ni une clé d'`app.json`. S'il atteignait un binaire
incapable de l'exécuter, l'app planterait au démarrage sur tous les téléphones
à la fois, et il n'y aurait plus de chemin pour la réparer.

C'est `runtimeVersion` qui l'empêche : un binaire ne reçoit que les mises à jour
publiées sous **son** `runtimeVersion`.

**La règle, et elle est manuelle :**

> Toute touche à `plugins`, à une permission de l'`infoPlist`, ou à une
> dépendance **native** incrémente `runtimeVersion` dans `app.json`.
> Un correctif JavaScript pur n'y touche **jamais** — c'est ce qui le rend
> éligible à la mise à jour à chaud.

**Pourquoi un entier à la main plutôt qu'une politique automatique.** Les deux
politiques d'Expo ne conviennent pas ici :

- `"policy": "appVersion"` lirait `version` (`"1.0.0"`), qui est figée et que
  `eas.json` ne fait pas monter (`"appVersionSource": "local"`) : elle ne
  bougerait **jamais**, et laisserait donc passer une mise à jour JS sur un
  binaire aux modules natifs changés — exactement ce qu'on veut éviter.
- `"policy": "fingerprint"` calcule une empreinte du projet natif. Plus sûr,
  mais il faudrait comprendre pourquoi l'empreinte a changé chaque fois qu'elle
  change, et on n'en est pas là.

Un entier posé à la main est le seul des trois qu'on relit sans outil.

## Les canaux

| Profil | Canal | Pourquoi |
|---|---|---|
| `lundi` | `production` | Le build interne que le club a sur ses téléphones. |
| `magasin` | `production` | **Le même canal que `lundi`, volontairement** : un correctif poussé pendant que le club joue doit atteindre les deux. |
| `atelier` | `atelier` | Il vise le Mac (`EXPO_PUBLIC_API`), il ne doit jamais recevoir une mise à jour destinée au club. |

Le palier gratuit d'EAS Update porte **1 000 utilisateurs actifs par mois**. Le
club en a quinze. Ce paragraphe est à relire le jour où ce ne sera plus vrai.

## Publier une mise à jour à chaud : `--platform ios`, toujours

```bash
npx eas update --channel production --environment production --platform ios \
  --message "ce que ça corrige" --non-interactive
```

**Les trois drapeaux ne sont pas décoratifs**, chacun vient d'un échec réel :

- `--environment production` — sans lui, `--non-interactive` refuse de partir.
- `--platform ios` — sans lui, `eas update` exporte **toutes** les plateformes,
  y compris le web, et l'export web **échoue** sur le `.wasm` d'`expo-sqlite`
  (`expo-sqlite/web/wa-sqlite.wasm`, tiré par `lib/outbox/baseExpo.ts` →
  `composants/Noyau.tsx`). Rien ne se publie, et le message d'erreur parle d'un
  fichier WebAssembly alors qu'on voulait livrer une correction iOS.
  `npx expo export --platform ios` passe, lui : c'est la porte de vérification
  du dépôt, elle ne voit pas ce défaut.
- `--channel production` — les profils `lundi` et `magasin` visent ce canal.

**Ce qui exige un BUILD et pas une mise à jour** : toute touche à `plugins`, à
une permission, à une dépendance native — donc un changement de
`runtimeVersion`. Le reste est du JavaScript et part en quelques secondes.

*Leçon du 12 septembre 2026 : le build 3 avait été fait AVANT l'arrivée
d'`expo-updates`. Un binaire qui ne contient pas le module natif est hors de
portée de toute mise à jour à chaud, définitivement — `eas channel:list` rendait
vide et rien ne l'aurait signalé. Vérifier `Channel` et `Runtime Version` dans
`eas build:view` : s'ils manquent, ce build ne recevra jamais d'OTA.*
