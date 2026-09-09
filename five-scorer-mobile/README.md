# Five Scorer — l'app React Native

Le portage de Five Scorer en React Native, développé dans **Expo Go**.
L'application web Next.js reste en production pendant toute la bascule : le
club joue tous les lundis.

## Sur ton iPhone, en trois commandes

```bash
cd /Users/ibc/diamesene02/five-scorer-mobile
npm install
npx expo start
```

Puis **scanne le QR code avec l'appareil photo de l'iPhone**. Il faut avoir
installé *Expo Go* depuis l'App Store — c'est gratuit et ça ne demande aucun
compte développeur.

Le téléphone et le Mac doivent être sur le même Wi-Fi. Si le réseau bloque la
découverte (Wi-Fi d'entreprise, VPN, réseau invité), passe par le tunnel :

```bash
npx expo start --tunnel
```

## Ce que l'app fait aujourd'hui

Elle affiche la **vitrine publique** du club : le nom, la saison, les derniers
résultats et le tableau, avec les photos des joueurs. Elle ne demande aucun
compte.

C'est délibéré. Une app qu'on ouvre dans Expo Go doit montrer quelque chose de
vrai avant qu'on ait porté l'authentification — sinon le premier écran serait
un formulaire de connexion, et on ne saurait pas si le reste tient debout.

Les couleurs ne sont écrites nulle part ici : elles arrivent calculées par
`lib/theme.ts` côté serveur, à partir des deux chasubles du club. Le mobile
porte donc exactement les mêmes que le web, et les suivra tout seul le jour où
le club en change.

## Contre le serveur local

Par défaut l'app parle à la production (`https://five-scorer.vercel.app`).
Pour travailler contre le Next.js local, crée `five-scorer-mobile/.env.local` :

```
EXPO_PUBLIC_API=http://192.168.1.192:3000
EXPO_PUBLIC_CLUB=fc-testeurs
```

Remplace l'adresse par celle du Mac (`ipconfig getifaddr en0`).

## Regarder sans téléphone

```bash
npx expo start --web
```

Le même code, rendu dans un navigateur. Pratique pour vérifier une mise en page
sans sortir le téléphone — mais ce n'est PAS une preuve que ça marche sur
l'appareil : le navigateur applique le contrôle d'origine, pas le téléphone, et
les gestes ne se comportent pas pareil.

## Vérifier

```bash
npm run verifier   # tsc --noEmit
```

## Ce qui reste

Le plan complet est dans `../five-scorer/MOBILE.md` — c'est aussi la mémoire de
l'agent qui travaille sur cette branche toutes les deux heures.
