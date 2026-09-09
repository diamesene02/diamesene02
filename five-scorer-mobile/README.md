# Five Scorer — l'app React Native

Le portage de Five Scorer en React Native, développé dans **Expo Go**.
L'application web Next.js reste en production pendant toute la bascule : le
club joue tous les lundis.

## Sur ton iPhone

```bash
cd five-scorer-mobile
npm install
npx expo login      # le MÊME compte que dans Expo Go — voir ci-dessous
npx expo start
```

Puis **scanne le QR code avec l'appareil photo de l'iPhone**. Il faut avoir
installé *Expo Go* depuis l'App Store — gratuit, et aucun compte développeur
Apple n'est nécessaire.

**Le piège du SDK 57.** Depuis cette version, il faut être connecté au même
compte Expo **des deux côtés** : dans le terminal (`npx expo login`) et dans
Expo Go sur le téléphone (onglet Home → l'avatar en haut). Sans ça, l'app
refuse de se charger sans dire pourquoi. Le compte Expo est gratuit.

Vérifie aussi qu'Expo Go affiche une version **57.x** : il n'embarque qu'un
seul SDK à la fois, et un décalage de version majeure empêche le projet de
s'ouvrir.

Le téléphone et le Mac doivent être sur le même Wi-Fi. Si le réseau isole les
appareils (Wi-Fi d'entreprise, VPN, réseau invité), passe par le tunnel :

```bash
npx expo start --tunnel
```

## Ce que l'app fait aujourd'hui

Quatre écrans, sur expo-router :

- **la vitrine** — le club sans compte : nom, saison, derniers résultats,
  tableau avec les photos. C'est ce qu'on montre à quelqu'un qui n'est pas du
  club ;
- **la connexion** et l'**inscription**, sur le même écran. Le même Better
  Auth, la même base, les mêmes comptes que le site : un compte créé ici ouvre
  la porte au web, et l'inverse ;
- **tes clubs** — une fois connecté : le rôle, les chasubles, ton profil
  joueur, les réglages du club.

L'aiguillage se fait tout seul : une session trouvée dans le trousseau du
téléphone mène aux clubs, sinon à la vitrine.

Les couleurs ne sont écrites nulle part ici : elles arrivent calculées par
`lib/theme.ts` côté serveur, à partir des deux chasubles du club. Le mobile
porte donc exactement les mêmes que le web, et les suivra tout seul le jour où
le club en change.

## Contre le serveur local

Par défaut l'app parle à la production (`https://five-scorer.vercel.app`).
Pour travailler contre le Next.js local, crée `five-scorer-mobile/.env.local` :

```
EXPO_PUBLIC_API=http://localhost:3000
EXPO_PUBLIC_CLUB=fc-testeurs
```

`localhost` fonctionne : l'app le traduit toute seule en l'adresse du Mac,
celle qui a servi le bundle. Sur un téléphone, `localhost` désigne le
téléphone — c'est le piège classique, il coûte une demi-heure à chaque fois,
et `lib/api.ts` s'en charge (`versLHote`).

Le serveur accepte déjà cette origine : `allowedDevOrigins` dans
`next.config.js`, et `exp://` / `exps://` dans les origines de confiance de
Better Auth — en développement seulement. Et il faut évidemment que
`pnpm dev` tourne sur le Mac.

## Regarder sans téléphone

```bash
npx expo start --web
```

Le même code, rendu dans un navigateur. Pratique pour vérifier une mise en page
sans sortir le téléphone — mais ce n'est PAS une preuve que ça marche sur
l'appareil, et il y a une limite dure à connaître :

**La connexion ne se teste pas dans le navigateur.** Il applique le contrôle
d'origine sur `/api/auth/*`, qui n'a pas d'en-têtes CORS et ne doit pas en
avoir. Le téléphone, lui, n'est pas un navigateur : il n'applique aucun
contrôle d'origine. La vitrine se vérifie ici ; la connexion se vérifie sur
l'appareil, ou en HTTP direct.

## Vérifier

```bash
npm run verifier   # tsc --noEmit
```

## Ce qui reste

Le plan complet est dans `../five-scorer/MOBILE.md` — c'est aussi la mémoire de
l'agent qui travaille sur cette branche toutes les deux heures.
