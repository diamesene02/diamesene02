# MOBILE.md — mettre Five Scorer sur un téléphone

> État au 9 septembre 2026. Ce document est le fruit de six enquêtes de lecture du dépôt et de deux contre-enquêtes qui ont tenté de les réfuter. Tous les chiffres cités viennent d'un comptage sur les fichiers, pas d'une estimation. Quand deux enquêtes se contredisent, la contradiction est signalée et tranchée.

---

## 1. Lancer sur mon téléphone

**Réponse courte : il n'existe aujourd'hui aucune commande unique qui mette le code local sur l'iPhone.** Voici l'état réel, du plus immédiat au plus cassé.

### a. L'app de production sur l'iPhone — maintenant, zéro commande

```
Safari → https://five-scorer.vercel.app → Partager → « Ajouter à l'écran d'accueil »
```

C'est la PWA. Elle est déjà outillée : `public/manifest.webmanifest` (`display: standalone`, icônes 192/512 any + maskable) et `public/icons/apple-touch-icon.png`. Icône, plein écran, hors-ligne. C'est ce que décrit déjà `five-scorer-android/STORE.md` §4. **État : fonctionne.**

### b. Le code local sur le téléphone (même Wi-Fi) — une commande, trois réserves

```bash
cd /Users/ibc/diamesene02/five-scorer && pnpm dev
# puis, sur le téléphone : http://192.168.1.192:3000
```

`next dev` écoute sur `0.0.0.0` par défaut (`npx next dev --help` → `-H, --hostname <hostname> (default: 0.0.0.0)`), et l'IP LAN du Mac est `192.168.1.192` (`ipconfig getifaddr en0`). Une configuration existe déjà : `/Users/ibc/diamesene02/five-scorer/.claude/launch.json` (`pnpm dev`, port 3000).

Trois choses bloquent, et **elles bloquent les trois chemins**, puisque tous pointent le même serveur de dev :

1. **Pas de rechargement à chaud.** `next.config.js` ne déclare pas `allowedDevOrigins` ; Next 16 refuse les requêtes dev venant d'une autre origine que localhost (`node_modules/next/dist/esm/server/lib/router-utils/block-cross-site-dev.js`). Les pages s'affichent, mais `_next/webpack-hmr` est refusé : il faut recharger à la main à chaque édition. Correctif d'une ligne : `allowedDevOrigins: ['192.168.1.192']`.
2. **Impossible de se connecter.** `.env` contient `BETTER_AUTH_URL="http://localhost:3000"` et `lib/auth.ts` en dérive ses `trustedOrigins`. Depuis l'IP LAN, Better Auth répond `INVALID_ORIGIN` — et le commentaire de `lib/auth.ts` raconte lui-même le piège : l'écran d'inscription traduisait cette erreur, à tort, par « cet email est déjà utilisé ».
3. **Le hors-ligne ne se teste pas.** `components/RegisterSW.tsx` contient `if (process.env.NODE_ENV !== "production") return;` : le service worker n'est jamais enregistré sous `pnpm dev`. Le mode gymnase se teste contre `pnpm build && pnpm start`, ou contre la prod.

**État : fonctionne pour regarder, pas pour tester.**

### c. Android natif — cassé sur cette machine

```bash
export JAVA_HOME=/usr/local/Cellar/openjdk@21/21.0.12.1/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
cd /Users/ibc/diamesene02/five-scorer-android && npm run build:apk
```

`/usr/libexec/java_home -V` répond « Unable to locate a Java Runtime » : le lien `/Library/Java/JavaVirtualMachines/openjdk-17.jdk` pointe sur un chemin disparu. Le seul JDK réellement installé est OpenJDK 21.0.12.1, hors du PATH. `ANDROID_HOME` est vide, alors que le SDK est bien là (`~/Library/Android/sdk`, build-tools 34.0.0 et 35.0.0). **État : bloqué. Personne n'a relancé ce build depuis le 7 septembre, et les deux lignes d'export ci-dessus n'ont pas été vérifiées — aucune enquête n'a exécuté de build Android.**

### d. iOS — n'existe pas

Il n'y a aucun projet iOS dans le dépôt : pas de dossier `ios/`, pas de `.xcodeproj`, pas de `Podfile`, `@capacitor/ios` absent de `node_modules` et de `package-lock.json`. Le seul dossier nommé `ios` est `/Users/ibc/diamesene02/five-scorer/components/ios/`, qui contient 11 à 12 composants React de style iOS (`Ecusson.tsx`, `Carte.tsx`, `Onglets.tsx`, `BarreClub.tsx`…), pas un projet Xcode.

L'amorce, à faire une fois :

```bash
cd /Users/ibc/diamesene02/five-scorer-android
npm i -D @capacitor/ios@^7   # ^7 impératif : la dernière publiée est 8.5.1, le projet est en 7.6.1
npx cap add ios
npx cap open ios             # régler l'équipe de signature dans Xcode
```

Puis, en théorie, la commande quotidienne :

```bash
npx cap run ios --target 00008110-000E54E01A05801E -l --host 192.168.1.192 --port 3000
```

Le Mac est équipé : Xcode 26.3 (17C529), CocoaPods 1.16.2, Node v20.20.0, pnpm 10.28.2, watchman, eas-cli. L'iPhone est appairé : « iPhone de Diame », iPhone 13 Pro, iOS 26.2.1, UDID `00008110-000E54E01A05801E`. **Mais `npx cap run ios` sur un appareil physique en iOS 26 n'a pas été vérifié** : native-run 2.0.3 utilise sa propre pile d'installation et des tickets Capacitor signalent des échecs sur appareil réel (ionic-team/capacitor#6254, #7149), avec pour repli `npx cap open ios` + bouton Run dans Xcode — ce qui n'est alors plus « une commande ». **État : à amorcer, non vérifié.**

---

## 2. Les trois chemins

| | 1. Coquille Capacitor sur URL distante | 2. Export statique / SPA embarquée | 3. React Native / Expo |
|---|---|---|---|
| **Ce qui marche déjà** | AAB signé prêt à l'envoi (2 932 874 o, 7 sept. 2026) ; Capacitor 7.6.1 ; keystore valide jusqu'en 2056 | 3 pages sur 26 sont exportables : `/hors-ligne`, `/privacy`, `/terms` | Rien. Zéro ligne de React Native ou Expo dans les deux dépôts, sur 103 commits |
| **Reste à écrire** | 0 ligne d'app. Montée en Capacitor 8, icônes, splash, versionCode, suppression de compte | ≈ 7 292 lignes serveur à réécrire + 2 chantiers non comptés | ≈ 21 137 lignes de présentation + 3 593 lignes de couche locale + 51 endpoints |
| **Ce qui survit** | Tout | La logique métier, le schéma, `lib/stats.ts` | ≈ 1 000 lignes sur 28 237 de TS + CSS, soit ≈ 3,5 % |
| **Play Store** | Passe. Mais `targetSdk 35` est refusé depuis le 31 août 2026 | Passe | Passe |
| **App Store** | Risque 4.2 / 2.5.2 élevé — 0 plugin natif, 2 permissions | Meilleur profil 4.2 | Meilleur profil 4.2 |
| **Ordre de grandeur** | Jours | Semaines à mois | Mois |

### Chemin 1 — la coquille Capacitor qui charge l'URL de production

**Ce qui marche.** `/Users/ibc/diamesene02/five-scorer-android/capacitor.config.json` : `"webDir": "shell"`, `"server": { "url": "https://five-scorer.vercel.app", "androidScheme": "https", "errorPath": "index.html" }`. L'AAB `dist/five-scorer-release.aab` (2 932 874 octets, 7 septembre 2026 08:04) est signé par la vraie clé release — `jarsigner -verify` répond « jar verified », `CN=Five Scorer, OU=App, O=Diame, C=FR`, SHA-256 `afcc5084…c51e`. `applicationId dev.diame.fivescorer`, minSdk 23, targetSdk 35, 2 permissions (`INTERNET`, `ACCESS_NETWORK_STATE`).

**Ce que le binaire contient réellement.** `unzip -l` sur l'AAB donne, sous `base/assets/` : `capacitor.config.json` (299 o), `capacitor.plugins.json` (**3 octets — soit `[]`, zéro plugin**), `native-bridge.js` (53 102 o), `public/index.html` (3 624 o = la page « Le serveur est injoignable »), et deux fichiers Cordova de 0 octet. Si le réviseur n'atteint pas `five-scorer.vercel.app` au moment du test, c'est littéralement tout ce qu'il voit.

**Ce qu'il reste à écrire.** Zéro ligne d'application. En revanche : la montée en Capacitor 8 (`targetSdk 36`, `minSdk 24`, Node 22+ — le Mac est en Node 20.20.0) ; le splash, qui est aujourd'hui **le logo Capacitor** (les 11 `splash.png` sous `android/app/src/main/res/drawable-*` datent du 25 mars 17:34, template jamais touché) ; les couleurs natives, jamais appliquées parce que le §5 de `scripts/customize-android.mjs` teste `existsSync(colors.xml)` sur un fichier qui n'existe pas — no-op silencieux, l'app tourne donc avec l'indigo/rose Material par défaut (`colorPrimary #3F51B5` défini dans `node_modules/@capacitor/android/capacitor/src/main/res/values/colors.xml`) ; les icônes adaptatives, générées en 48/72/96/144/192 px alors que le format 108dp demande 108/162/216/324/**432** — soit un upscale subi de 2,25× et un « FS » plein-bord que le masque du launcher rognera ; le `versionCode`, calculé en `AAAAMMJJ` (`versionCode 20260907`), donc identique pour deux builds le même jour, ce que le Play Store refuse.

**Risque store.** Côté **Google**, la règle webview ne mord pas : « We don't allow apps whose primary purpose is to drive affiliate traffic to a website or provide a webview of a website **without permission from the website owner or administrator** » (https://support.google.com/googleplay/android-developer/answer/9899034) — ici le propriétaire du site est le développeur. La vraie contrainte est « Limited Functionality and Content » (https://support.google.com/googleplay/android-developer/answer/9898783), et une app de club avec comptes, scoring live et stats n'en relève pas. Le vrai blocage Play est ailleurs : **API 36 obligatoire depuis le 31 août 2026** pour les nouvelles apps ET les mises à jour (https://support.google.com/googleplay/android-developer/answer/11926878), donc l'AAB du 7 septembre sera très probablement refusé à l'upload — contrôle automatique, pas revue humaine.

Côté **Apple**, la guideline 4.2 dit : « Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or "app-like," it doesn't belong on the App Store. » Et 2.5.2 : « Apps should be self-contained in their bundles… nor may they download, install, or execute code which introduces or changes features or functionality of the app » (https://developer.apple.com/app-store/review/guidelines/, sections relues le 9 septembre 2026). Deux rejets 4.2 documentés et datés : forum Apple **812889** (janvier 2026) — app Capacitor de VTC rejetée alors qu'elle embarquait Core Location natif, la feuille de partage iOS, des deep links Apple Maps et des plugins Swift maison ; forum Apple **806726** (novembre 2025) — dix rejets pour une app qui n'avait plus que 2 ou 3 écrans en WebView. À l'inverse, Median.co revendique publiquement « a 98% approval rate across both the App Store and Google Play » (https://median.co/blog/will-apple-approve-my-webview-app) — chiffre d'éditeur, auto-déclaré, invérifiable, et leur propre doc dit : « If your app is a website wrapped in a webview with nothing native added, expect a Guideline 4.2 or 2.1 rejection. »

**Conclusion honnête : aucun rejet n'est jamais documenté pour le seul motif `server.url`. Le lien `server.url` → rejet est une inférence tirée de 2.5.2, jamais une observation. Mais Five Scorer, avec 0 plugin et 2 permissions, est le profil le plus exposé possible.**

### Chemin 2 — export statique, assets embarqués dans la coquille

**C'est prouvé impossible en l'état, deux fois, par deux enquêteurs indépendants.** La seconde fois sans aucun stub sur les trois premières barrières. Les cinq erreurs, dans l'ordre où le compilateur les crache (Next 16.2.3, Turbopack) :

1. `export const dynamic = "force-static"/export const revalidate not configured on route "/api/clubs/[clubId]/roster" with "output: export"`
2. `Page "/c/[slug]/matches/[id]/live" is missing "generateStaticParams()" so it cannot be used with "output: export" config.`
3. `Server Actions are not supported with static export.` — **contrôle global sur le manifeste** (`node_modules/next/dist/export/index.js:372-377`), lancé avant le rendu de la moindre page : aucune échappatoire page par page.
4. `` Page with `dynamic = "force-dynamic"` couldn't be exported. ``
5. `` Route /c/[slug]/matches avec `dynamic = "error"` couldn't be rendered statically because it used `headers()` `` (et `cookies()`), code `NEXT_STATIC_GEN_BAILOUT`.

Ce qui bloque, compté fichier par fichier : **22** `export const dynamic = "force-dynamic"` (20 pages + `app/api/diagnostic/route.ts:5` et `app/api/cal/[token]/route.ts:4`) ; **32 Server Actions** dans **11 fichiers** de `app/actions/` (1 472 lignes), avec **46** appels `revalidatePath`/`revalidateTag` ; **10 route handlers** (9 sous `app/api/` + `app/session-expiree/route.ts`), dont 8 à segment dynamique ; **19 pages** à segment dynamique et **0** `generateStaticParams` dans tout le dépôt ; **20** pages/layouts qui appellent `cookies()`/`headers()` via `lib/guard.ts` ; **19** fichiers page/layout qui importent Prisma directement.

Et deux pièges que la première enquête n'avait pas vus, tous deux contre l'export :

- **L'échappatoire « generateStaticParams qui renvoie `[]` » est fermée.** Testé : ajouté aux 19 pages dynamiques *et* à `app/c/[slug]/layout.tsx`, le build refuse toujours. La raison est dans le code installé, `node_modules/next/dist/build/index.js:1356-1359` : `hasGenerateStaticParams = workerResult.prerenderedRoutes && workerResult.prerenderedRoutes.length > 0`. Il faut **graver au moins une URL factice par route dynamique** dans l'APK, et faire vivre tout le routage sous ce chemin fantôme (`/c/x/...`) ou en query string.
- **Le service worker se désactive en silence sur l'API.** `public/sw.js:280` : `if (url.origin !== self.location.origin) return;`. L'API partie sur un autre hôte, chaque appel devient cross-origin et sort du service worker : la branche `p.startsWith("/api/")` (`sw.js:283`), le délai `DELAI_API` de 6 s (`sw.js:45`), le repli sur cache et le 503 `{"error":"offline"}` (`sw.js:262-275`) deviennent du code mort. Les URLs concernées sont relatives et en dur : `lib/sync.ts:104` (`` const base = `/api/clubs/${op.clubId}` ``) et `app/c/[slug]/matches/new/NewMatchForm.tsx:90`. Et `lib/auth-client.ts` ne fixe aucun `baseURL`. **Le build ne dirait rien, la pastille de sync ne dirait rien, et la file d'attente échouerait au premier match sans réseau.** Même classe de piège que le middleware, mais sur la fonction qui justifie l'app.

Le middleware, justement : il ne provoque **aucune erreur**, il est désactivé avec un simple avertissement (`node_modules/next/dist/export/index.js` ~ligne 511). La redirection vers `/login`, la sortie `?session=expiree` et le 401 de l'outbox disparaîtraient sans un mot.

**Volume, borne basse corrigée : 7 292 lignes** = 4 363 (20 pages/layouts serveur) + 1 472 (32 actions) + 1 174 (10 route handlers) + 283 (auth + guard + auth-client + middleware), sur 21 712 lignes de TypeScript et 147 fichiers. Soit un tiers du code — et le tiers qui porte l'authentification, les droits et toutes les écritures.

**Quatre pièges classiques n'existent pas ici**, et c'est le seul point où la première enquête était trop pessimiste : 0 `next/image`, 0 `next/font`, 0 `sitemap.ts`/`robots.ts`/`opengraph-image`, 0 route d'interception, et `next.config.js` sans `rewrites`/`redirects`/`headers`. Le layout racine est propre, ce qui confirme `/privacy`, `/terms` et `/hors-ligne` comme exportables.

**Nuance importante que la contre-enquête a levée : ce chemin a déjà été parcouru, et une partie du travail est encore sur le disque.** Le commit `653e7df` a fait passer `capacitor.config.json` de `"webDir": "www"` à `"webDir": "shell"` + `server.url`. `/Users/ibc/diamesene02/five-scorer-android/www/` contient toujours 18 fichiers : `index.html`, `app.css` (35 895 o), `app.bundle.js` (361 053 o, non versionné), deux polices, 5 icônes, et 8 modules dans `www/src/` (`ui.js` 42 911 o, `db.js`, `sync.js`, `shareCard.js`, `audio.js`, `mvp.js`, `entry.js`, `config.js`) — 2 269 lignes. C'est une app autonome complète. Mais **elle vise Supabase, pas le backend actuel**, et `www/src/config.js`, **suivi par git**, contient en clair une URL Supabase, une clé « publishable », le PIN `1234`, et un commentaire indiquant que les tables n'ont aucune RLS. Le README android tranche déjà : « le multi-clubs avec comptes ne peut pas vivre dans un bundle statique. »

**Risque store : c'est le seul chemin qui améliore le dossier Apple sans réécrire l'UI** — un bundle embarqué neutralise 2.5.2 et l'accident 2.1(a) (« crash or exhibit obvious technical problems », et un réviseur hors réseau ne verrait plus la page d'erreur). C'est le bénéfice que la première enquête n'avait pas pesé. Il ne rachète pas les 7 292 lignes.

### Chemin 3 — React Native / Expo

**Ce qui marche : rien.** Aucune occurrence de `react-native` ni de `expo` dans les deux `package.json`, ni dans les 103 commits du dépôt android. Les deux seules mentions dans tout le dépôt sont deux lignes de portfolio dans `/Users/ibc/diamesene02/README.md`.

**Ce qu'il reste à écrire.**

- **L'interface entière : 100 fichiers `.tsx`, 14 612 lignes.** React Native n'a ni `div`, ni `span`, ni `p`, ni `button`, ni `form`. Recensement : 615 `<span`, 499 `<div`, 149 `<button`, 103 `<p`, 58 `<section`, 44 `<input`, 31 `<main`, 31 `<label`, 18 `<svg`, 10 `<form`, 10 `<ul`/12 `<li`, 4 `<details`/3 `<summary`.
- **Le style entier : 6 525 lignes de CSS sur 10 feuilles**, dont `app/globals.css` à 3 256 lignes (84 Ko, 448 sélecteurs, 89 variables CSS, 11 `@keyframes`, 1 `@font-face` de police variable pilotée par l'axe de chasse 62→125 %), plus 1 464 attributs `className`. Trois choses ne se transposent simplement pas : la police variable, les 11 animations (à refaire en Reanimated), et les jetons `--ink-0/--bg-1/--rule` que `lib/theme.ts` (182 lignes) calcule aujourd'hui en chaîne CSS (`theme.ts:165-172`).
- **La couche hors-ligne : 3 593 lignes.** Noyau 1 370 (`lib/localMatch.ts` 707, `lib/sync.ts` 386, `lib/db.ts` 259, `useSyncState.ts` 18) + consommateurs 2 223 (`LiveMatch.tsx` 1 035, `NewMatchForm.tsx` 512, `PlayShell.tsx` 333, `RematchButton.tsx` 141, `SyncBadge.tsx` 109, `OfflinePrimer.tsx` 60, `ReprendreLocal.tsx` 33). Dexie/IndexedDB n'existe pas en RN : 6 tables, 3 versions de schéma avec migration, 4 index composés, **9 transactions `rw`** et **10 `useLiveQuery`** — ce dernier point étant le plus sournois, car aucun moteur SQLite natif ne redessine l'écran gratuitement à chaque but marqué.
- **51 endpoints à créer** : 32 mutations (une par server action) + 19 lectures (18 pages + 1 layout qui interrogent Prisma au rendu, 58 requêtes). Contre 13 méthodes HTTP existantes, écrites pour l'outbox du live et rien d'autre.
- **L'authentification : 233 lignes touchées** + `middleware.ts` supprimé. `better-auth` 1.7.1 **n'exporte pas `./expo`** (exports : react, vue, svelte, solid, lynx, next-js, tanstack-start…) : il faut le paquet séparé `@better-auth/expo`, non installé.
- **Une dizaine de paquets Expo** pour les ponts navigateur : 12 `navigator.vibrate`, 7 `serviceWorker`, 5 `clipboard`, 4 `share`, 4 `onLine`, 6 `AudioContext` (`lib/audio.ts`, 141 lignes de sons synthétisés), 12 `canvas` (`lib/shareCard.ts`, 291 lignes de carte 1080×1350 au Canvas 2D, à reprendre trait par trait en Skia), 6 `localStorage`.
- **Le routage : 46 `revalidatePath`, 90 `<Link>`, 56 `useRouter`, 17 `redirect`, 7 `notFound`, 40 `useTransition` sur 24 composants.** `revalidatePath` n'a aucun équivalent : c'est 46 invalidations de cache client à écrire à la main.

**Ce qui survit : ≈ 881 lignes de métier pur** (`lib/color.ts` 184, `lib/calendrier.ts` 151, `lib/balance.ts` 148, `lib/presences.ts` 143, `lib/elo.ts` 60, `lib/mvp.ts` 53, `lib/ids.ts` 43, `lib/clock.ts` 41, `lib/retro.ts` 28, `lib/slugify.ts` 16, `lib/ini.ts` 14), plus `lib/theme.ts` et `lib/dates.ts` moyennant un changement de sortie. Soit **≈ 1 000 lignes réutilisables sur 28 237 de TS + CSS : 3,5 %.**

**Le seul poste où l'on supprime de la complexité : la PWA.** 369 lignes deviennent sans objet (`public/sw.js` 305, `manifest.webmanifest` 24, `RegisterSW.tsx` 40).

**Ce qui reste web, en parallèle, pour toujours : 589 lignes** — flux iCal (`app/api/cal/[token]/route.ts`, 144), vitrine publique (`app/p/[slug]/page.tsx`, 183), récap partageable (`app/r/[id]/page.tsx`, 133), export (`app/api/clubs/[clubId]/export/route.ts`, 129). Le projet ne devient pas « une app RN », il devient « une app RN **plus** un backend web maintenu en parallèle », avec deux chaînes de déploiement.

**Risque store : le meilleur des trois.** Aucun problème 4.2. En échange, un délai de revue à chaque correctif, là où le bug d'un lundi soir se corrige aujourd'hui dans la soirée.

**Sur « compatible React Native ».** Aucune enquête n'a su ce que le propriétaire entend exactement par là. Si cela veut dire « une app qui ne se fait pas refuser comme un site emballé », Capacitor + du natif perceptible y répond. Si cela veut dire « du code React Native », c'est la réécriture ci-dessus. La voie théorique du partage de composants entre web et natif, `react-strict-dom`, est en version **0.0.55**, dernière publication il y a huit mois : ce n'est pas un socle sur lequel engager un club de five.

### Contradictions entre enquêtes, et comment elles sont tranchées

| Point | Versions | Tranché |
|---|---|---|
| Fichiers important `@/app/actions` | 26 vs 25 | **25** — la contre-enquête a relancé `grep -rln` et a même identifié l'oubli de `app/join/[code]/JoinButton.tsx` dans la liste adverse |
| Lignes de route handlers | 1 122 vs 1 174 | **Les deux** : 9 fichiers sous `app/api/` = 1 122 lignes ; en ajoutant `app/session-expiree/route.ts`, 10 fichiers = 1 174 lignes. Le périmètre pertinent pour l'export est le second |
| Taux de prérendu | 5/38 (13 %) vs 3/36 (8 %) | **3 pages visibles sur 36, soit 8 %** — les 5/38 comptent `/_global-error` et `/_not-found` des deux côtés |
| Origine de la WebView et cookies | « `https://localhost`, cookie Lax non envoyé » vs « same-origin Vercel aujourd'hui » | **La contre-enquête** : `capacitor.config.json` fixe `server.url` sur Vercel, donc les cookies sont same-origin — et c'est précisément pourquoi l'APK actuel fonctionne sans `credentials: "include"` nulle part. La conclusion de la première enquête reste juste **dans le scénario d'export**, sa preuve non |
| Coût du passage en jetons | « sixième réécriture » vs « un plugin + une config » | **Le plugin bearer est déjà livré** (`node_modules/better-auth/dist/plugins/bearer`). Le vrai coût est chez les appelants, pas dans la couche d'auth |
| Capacitor 8 nécessaire pour iOS ? | « SPM par défaut, prépare iOS » vs « Cap 7 est déjà compatible Xcode 26 » | **Non** : « Capacitor itself is fully compatible with Xcode 26 and the iOS 26 SDK… This is entirely a toolchain requirement, not a Capacitor compatibility issue » (https://capawesome.io/blog/xcode-26-requirement-for-capacitor-apps/, 29 avril 2026). Capacitor 8 n'a **qu'une** justification : Play et l'API 36 |
| Suppression de compte : blocage Apple seul ? | « rejet certain iOS » vs « Google l'exige aussi, et double » | **Les deux stores.** Google : « provide users with an in-app path to delete their app accounts and associated data; **and** provide a web link resource where users can request app account deletion » (https://support.google.com/googleplay/android-developer/answer/13327111). Le `STORE.md` déclare aujourd'hui « suppression in-app par les admins » : ce n'est pas un chemin utilisateur, et c'est une déclaration Sécurité des données inexacte |
| Clause Apple 4.7.1 « standard WebKit view » | Citée comme cadre actuel | **Ce texte n'existe plus.** Le 4.7 servi aujourd'hui s'intitule « Mini apps, mini games, streaming games, chatbots, plug-ins, and game emulators » et encadre les logiciels **tiers** proposés dans une app, pas le front qu'on héberge soi-même. L'article opposable à `server.url` est **2.5.2, et lui seul** |
| Modèles Prisma | 18 modèles / 7 enums vs 17 modèles / 8 enums | **Non tranché.** Les 483 lignes de `prisma/schema.prisma` sont confirmées par les deux ; le décompte diffère et personne ne l'a recompté. Sans incidence sur les décisions ci-dessous |
| « On ne peut pas juste éditer `variables.gradle` » | Impossible vs non supporté | **Non supporté**, pas impossible : la doc dit « there's a very strong likelihood that your application will experience issues » (https://capacitorjs.com/docs/android/setting-target-sdk). On monte quand même en Capacitor 8 |

---

## 3. Le chemin retenu

**Chemin 1 — la coquille Capacitor sur URL distante — remise à niveau pour le Play Store, l'iPhone passant par la PWA installée. L'App Store est reporté et conditionné.**

Trois raisons. **Un :** c'est le seul chemin où le livrable existe déjà — un AAB signé de 2,9 Mo, une clé valide jusqu'en 2056, et zéro ligne d'application à écrire ; les chemins 2 et 3 demandent respectivement 7 292 et ~25 000 lignes, c'est-à-dire des semaines à des mois avant le premier écran affiché. **Deux :** le blocage réel du moment n'est ni Apple ni le framework, c'est `targetSdk 35` face à l'API 36 exigée depuis le 31 août 2026 — un contrôle automatique qui refuserait aussi bien une app RN qu'une coquille, et qui se lève par une montée en Capacitor 8. **Trois :** la seule chose qui serve *les trois* chemins est le travail qui n'a jamais été fait — extraire une API HTTP réelle (51 endpoints en face de 13 méthodes existantes) et poser un filet de tests (0 test, 0 CI web aujourd'hui) ; ce travail est utile même si l'on bascule un jour en React Native, alors que réécrire l'UI maintenant ne sert qu'un seul chemin.

**Ce qu'on accepte de perdre en le choisissant :**

- **L'App Store à court terme.** L'iPhone passe par la PWA installée depuis Safari. Rien n'est publié sur l'App Store tant qu'on n'a pas ajouté du natif perceptible ou embarqué le front — et les deux rejets documentés (forum Apple 812889 de janvier 2026, 806726 de novembre 2025) disent qu'ajouter « un peu de natif » ne suffit pas.
- **Toutes les fonctions natives.** 0 plugin Capacitor installé, 2 permissions. Pas de notification push, pas de biométrie, pas de partage natif, pas d'accès fichiers. Le hors-ligne reste celui du service worker, donc identique dans Safari.
- **Le confort de dev natif.** Le rechargement à chaud reste celui de Next, conditionné par `allowedDevOrigins` ; il n'y a pas de Fast Refresh RN, pas de menu dev en secouant l'appareil.
- **Le « compatible React Native » littéral.** On ne l'obtient pas. Ce qu'on préserve, c'est la *portabilité* : les ~881 lignes de `lib/` restent pures (aucun import React/Next/Dexie, aucune API navigateur), et chaque endpoint extrait est un endpoint que RN pourrait consommer tel quel. C'est un chemin ouvert, pas un chemin parcouru.
- **Le contrôle du délai de publication.** Une fois sur le Play Store, tout correctif visuel passe par un déploiement Vercel (immédiat), mais tout changement de coquille passe par une revue.

---

## 4. Le plan

Chaque étape tient dans une exécution de deux heures. Chaque critère de « terminé » se vérifie **sans téléphone**, depuis un terminal ou une CI.

| # | Étape | Terminé quand | État |
|---|---|---|---|
| 1 | Réparer la chaîne Java/Android locale | `java -version` répond, `echo $ANDROID_HOME` est non vide, et `cd five-scorer-android && ./android/gradlew --version` affiche Gradle 8.11.1 | à faire |
| 2 | Ajouter `allowedDevOrigins: ['192.168.1.192']` à `next.config.js` | `pnpm build` passe, et le fichier contient la clé | à faire |
| 3 | CI web minimale | Un workflow `.github/workflows/web.yml` exécute `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` et passe au vert sur une PR | à faire |
| 4 | Nettoyer les deux workflows morts | Il reste **un** workflow Android, il se déclenche réellement, et il n'appelle plus `npm run bundle` (script inexistant) | à faire |
| 5 | Décider du sort de `main` sur `five-scorer-android` et pousser `feat/coquille-capacitor` | `git status -sb` ne dit plus « ahead 3 », et `git show main:capacitor.config.json` contient `server.url` | à faire |
| 6 | Purger les résidus v1 | `www/` ne contient plus que `icons/`, `www/src/config.js` n'est plus suivi par git (`git ls-files www` le confirme) | à faire |
| 7 | Keystore reconstructible en CI | Le workflow décode un secret base64 et produit un AAB dont `apksigner verify --print-certs` affiche le SHA-256 `afcc5084…c51e` | à faire |
| 8 | Montée en Capacitor 8 | `aapt2 dump badging` sur le nouvel AAB affiche `targetSdkVersion='36'` et `minSdkVersion='24'` | à faire |
| 9 | Créer `res/values/colors.xml` au lieu de le patcher | Le fichier existe, `grep 'colorPrimary' android/app/src/main/res/values/colors.xml` renvoie `#0E1211`, et le script ne saute plus son §5 | à faire |
| 10 | Icônes adaptatives aux bonnes tailles | `sips -g pixelWidth mipmap-xxxhdpi/ic_launcher_foreground.png` renvoie 432 (aujourd'hui 192) | à faire |
| 11 | Remplacer le splash Capacitor | Les 11 `splash.png` ont une date postérieure au 25 mars 17:34 et un hash différent du template | à faire |
| 12 | `versionCode` monotone | Deux `npm run build:aab` d'affilée produisent deux codes strictement croissants | à faire |
| 13 | Une seule source pour l'URL de prod | `grep -rc 'five-scorer.vercel.app' capacitor.config.json shell/index.html` ne renvoie qu'une occurrence, ou les deux dérivent d'une variable | à faire |
| 14 | Base de test + `prisma/seed.e2e.ts` | `prisma migrate deploy` puis `prisma migrate diff --exit-code` passent sur une base `five_scorer_e2e` neuve | à faire |
| 15 | Socle Playwright | `pnpm exec playwright test` exécute au moins un spec vert en CI, sur un service `postgres:16` | à faire |
| 16 | `globalSetup` : 3 comptes, 3 `storageState` (owner, admin, member) | Les trois fichiers d'état existent et un spec de fumée passe avec chacun | à faire |
| 17 | Parcours 1 : inscription → création du club → `/c/[slug]` | Spec vert, et une requête Prisma confirme la ligne `Club` et le `Player` du créateur | à faire |
| 18 | Parcours 2 : match hors-ligne + resynchronisation | Spec vert, `Match` et `MatchEvent` présents en base après retour en ligne, **et** rejeu de la même outbox sans doublon | à faire |
| 19 | Écran de suppression de compte + page web de demande | Un spec crée un compte, le supprime par l'UI, et la ligne `User` a disparu de la base | à faire |
| 20 | Parcours 3 à 12 (voir §5) | Un spec vert par parcours | à faire |
| 21 | Premier endpoint de lecture extrait (le plus chargé : `app/c/[slug]/page.tsx`, 11 requêtes Prisma) | L'endpoint répond du JSON, un test vérifie qu'aucun objet Prisma brut ne fuit | à faire |
| 22 | Smoke prod automatisé | 6 requêtes (`/`, `/p/[slug]`, `/privacy`, `/terms`, `/manifest.webmanifest`, `/sw.js`) + `/api/diagnostic` qui doit répondre 401 sans session | à faire |
| 23 | 2 captures d'écran téléphone pour la fiche Play (0 aujourd'hui) | Les fichiers existent dans `store/`, dimensions vérifiées au `sips` | à faire |
| 24 | Flow Maestro Android en CI | Le flow `.maestro/` passe sur un émulateur `reactivecircus/android-emulator-runner`, sans Mac ni téléphone | à faire |
| 25 | Amorce iOS (uniquement si l'adhésion Apple est confirmée active) | `npx cap add ios` a créé `ios/App/App.xcworkspace` et `xcodebuild -scheme App -showBuildSettings` répond sans erreur | bloqué (décision Ibrahima) |

Note sur l'étape 8 : Capacitor 8 exige **Node 22+**, alors que le Mac est en **Node 20.20.0**. Prévoir la montée de Node dans la même exécution.

Note sur l'étape 25 : `~/Library/MobileDevice/Provisioning Profiles/` est vide (0 profil), alors que le trousseau contient 5 identités valides dont « Developer ID Application: Diame SENE (M283R456KQ) » et « Apple Distribution: Diame SENE (M283R456KQ) » — deux certificats qui ne sont délivrés qu'aux membres **payants**. Mais un certificat reste dans le trousseau après expiration de l'adhésion : cela ne prouve rien.

---

## 5. Les tests

### Le dispositif

**Playwright pour le web, Maestro pour l'Android, rien pour iOS tant qu'il n'y a pas de projet.**

Aujourd'hui : **0 fichier de test, 0 script `test`, 0 `data-testid`, 0 CI web.** Playwright et vitest n'apparaissent dans `pnpm-lock.yaml` qu'en `peerDependencies` optionnelles de `next@16.2.3` (ligne 1893) et de `better-auth` (ligne 1078) — ils ne sont pas installés. Le seul dossier nommé « test » est `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`, gabarit de `cap add android`, dans un dossier gitignoré.

**Pourquoi Playwright et pas autre chose.** 95 % du produit est du web servi dans une WebView : le tester au niveau du navigateur coûte une fraction du prix et attrape les mêmes bugs. Le scénario critique — score hors-ligne puis resynchronisation — traverse `public/sw.js`, IndexedDB et l'outbox de `lib/sync.ts` : `context.setOffline(true)` le pilote directement.

**Pourquoi Maestro et pas Detox.** Detox est un harnais greybox conçu pour React Native : il s'injecte dans le runloop de l'app. Sur une coquille 100 % WebView (`capacitor.plugins.json` = `[]`), il n'a rien à instrumenter. Maestro pilote une WebView par l'arbre d'accessibilité, ses flows sont du YAML de quelques lignes, et il tourne sur `ubuntu-latest` avec `reactivecircus/android-emulator-runner` — **sans Mac et sans téléphone**.

**Périmètre du natif : cinq étapes maximum.** Lancer l'APK, attendre que la WebView affiche le nom du club, se connecter, marquer un but, tuer l'app et vérifier que le match est toujours là. Plus l'`errorPath` quand le serveur est injoignable, et le bouton retour Android. Le reste est du web.

**Contrainte à lever d'abord :** l'URL est figée dans le binaire (`server.url`). Un test natif ne peut pas viser un serveur local sans rebuild. Il faut un `capacitor.config.e2e.json`, ou une variable d'environnement lue par `scripts/customize-android.mjs`.

### Les prises pour les sélecteurs

Pas un seul `data-testid` dans le dépôt, mais **65 `aria-label`, 35 `role=`, 58 `name="…"`** dans `app/` + `components/`. Le bouton le plus important est déjà nommé : `components/PlayerTile.tsx:125`, `` aria-label={`${name} — but (maintenir pour annuler)`} ``. Marquer un but s'écrit donc `page.getByRole('button', { name: /— but/ }).first().click()`, **sans toucher au code de l'app**. Deux endroits manqueront de prise : les onglets de `components/ios/Onglets.tsx` (ils ont `role="tab"` mais pas d'identifiant stable) et le bouton « Terminer » de `LiveMatch.tsx:894`, dont le libellé bascule en « Enregistrer » en mode rétro.

### L'authentification dans les tests

`lib/auth.ts` : `emailAndPassword: { enabled: true, minPasswordLength: 8 }`, sans `requireEmailVerification`. Google est conditionnel (`googleConfigured`) donc désactivable en ne renseignant pas `GOOGLE_CLIENT_ID`/`SECRET`.

**Ne jamais forger un cookie de session.** `middleware.ts` ne juge que la *présence* du cookie (« ni signature, ni lecture de base », dit son propre commentaire) ; la vraie garde est `lib/guard.ts`. Un cookie bricolé casserait plus loin, sans message clair. Le `storageState` doit venir d'une **vraie inscription** contre le serveur de test, via `POST /api/auth/sign-up/email`. Et il faut poser `BETTER_AUTH_URL="http://localhost:3000"`, faute de quoi `trustedOrigins` renvoie `INVALID_ORIGIN`.

Bonus : un cas de test à écrire pour ça — supprimer l'utilisateur en base pendant que le cookie vit, et vérifier qu'on atterrit sur `/session-expiree` plutôt que dans une boucle de redirection.

### La base de test

Les 11 migrations sont du PostgreSQL standard : `migration_lock.toml` déclare `provider = "postgresql"`, et aucune n'appelle `CREATE EXTENSION`, `pg_trgm`, `uuid-ossp` ni `citext`. La plus lourde (`20260824190000_v2_platform/migration.sql`, 493 lignes sur 650) conditionne toutes ses insertions de reprise v1 par `WHERE EXISTS (SELECT 1 FROM "Player")` (lignes 451, 455) : **sur une base neuve, elle ne crée aucun club legacy.** Un `services: postgres:16` en CI suffit. En local, `scripts/bootstrap.sh` monte déjà un conteneur `five-scorer-pg` — attention, **Docker est indisponible sur ce Mac** (`docker info` échoue), le script retombe alors sur Homebrew `postgresql@16`.

`prisma/seed.ts` fait 11 lignes et ne contient qu'un `console.log`. Il faut donc deux stratégies : le parcours d'amorçage passe **une fois** par l'UI (c'est le test le plus précieux, il traverse Better Auth, le hook `afterCreateOrganization` et Prisma) ; tous les autres specs partent d'un `prisma/seed.e2e.ts` qui pose directement club + effectif + saison.

### Les douze parcours, nommés d'après les vrais écrans

1. **Amorçage** — `/signup` → création du club → arrivée sur `/c/[slug]`.
2. **Match hors-ligne** — `/c/[slug]/play` (`components/PlayShell.tsx`, « Elle ne demande RIEN au serveur ») : attendre `navigator.serviceWorker.controller`, `setOffline(true)`, compo + 4 buts + mi-temps + terminer, retour en ligne, vérification en base. **Puis rejeu de la même outbox : aucun doublon** — c'est la promesse d'idempotence que `app/api/clubs/[clubId]/matches/[matchId]/events/route.ts` revendique et que rien ne vérifie.
3. **Invitation** — `/join/[code]` → le nouveau membre voit le club (`app/join/[code]/JoinButton.tsx`).
4. **Effectif** — `/c/[slug]/players` (`RosterClient.tsx`, 377 lignes) : ajouter, noter le niveau, marquer gardien, archiver.
5. **Présences** — programmer une soirée puis répondre présent depuis l'accueil (`_accueil/BoutonPresence.tsx`, action `setRsvp` de `app/actions/matchday.ts`).
6. **Composition** — `components/CompoSoiree.tsx` + `app/actions/compo.ts`, y compris « reprendre la compo précédente ».
7. **Match en direct connecté** — `/c/[slug]/matches/[id]/live` (`LiveMatch.tsx`, 1 035 lignes, 44 hooks) : buts, csc, cartons, mi-temps, annuler le dernier, terminer → récap.
8. **Vote MVP** — selon `motmMode` VOTE / ADMIN / OFF (`MotmVotePanel.tsx`, `MvpPicker.tsx`).
9. **Statistiques** — `/c/[slug]/stats` après deux matchs : les trois onglets Tableau / Buteurs / Forme.
10. **Droits** — un `member` avec `membersCanScore=false` est redirigé hors de `/c/[slug]/play` (la garde est explicite dans la page) et ne voit pas l'onglet Réglages.
11. **Pages publiques** — `/p/[slug]` et `/r/[id]` sans session.
12. **Saison et calendrier** — `/c/[slug]/saison` et le flux iCal `/api/cal/[token]`.

Le tout en **viewport iPhone 390×844** : l'app est dessinée mobile-first (`components/ios/`, `BottomNav.tsx`).

### Ce que « autocorrection » veut dire concrètement

**Cadence.** Suite complète (`tsc --noEmit` + `lint` + `build` + `migrate deploy` + Playwright) **à chaque push**. Smoke prod de 6 requêtes **toutes les deux heures** — une dizaine de secondes. Relancer la suite complète toutes les deux heures sans commit ne servirait à rien.

**Périmètre de l'agent.** Il **ouvre une PR, jamais un push sur `main`**, et il se limite aux corrections dont la cause est **mécanique** : une chaîne d'UI qui a changé et casse un sélecteur, un import manquant, une erreur de type, une migration oubliée après un `prisma db push`. Tout le reste remonte à Ibrahima avec le log d'échec.

**Ce qu'aucune CI ne verra, et qu'on assume :**

- **Le réseau dégradé** — le vrai cas du gymnase, que `public/sw.js` décrit lui-même comme « pire que l'absence de réseau ». `setOffline(true)` simule une coupure franche, pas une 4G à 200 ms. Compensation : le CDP Playwright (`Network.emulateNetworkConditions`) avec 400 ms de latence, pour au moins exercer `DELAI_NAV` (4 s), `DELAI_RSC` (4 s) et `DELAI_API` (6 s). C'est une approximation, pas une preuve.
- **`navigator.share`** (`components/PartageFeuille.tsx`) — n'existe pas en Chromium headless.
- **L'installation PWA** — ne se scripte pas.
- **Google OAuth** — exige un compte de test réel.
- **Le rendu réel** — dépend de `public/fonts/archivo-var.woff2` et des safe-areas iPhone. Compensation : des captures Playwright en 390×844 comparées d'un run à l'autre attrapent les régressions de mise en page, pas le ressenti.
- **Le bord-à-bord Android 15/16** — avec `targetSdk` ≥ 35 le système force le mode edge-to-edge ; le layout est le `CoordinatorLayout` + `WebView` par défaut (`activity_main.xml`, sans `fitsSystemWindows`), aucun `@capacitor/status-bar` n'est installé, et la page déclare `viewport-fit=cover`. **Non vérifié** : personne n'a lancé l'app.

Ces six points forment une **checklist manuelle avant chaque publication au store**, à écrire dans `STORE.md` à côté du reste.

---

## 6. À décider par Ibrahima

Rien de ce qui suit ne peut être fait par un agent.

**Comptes et argent**

1. **L'adhésion Apple Developer (team `M283R456KQ`) est-elle encore active ?** C'est la décision la plus structurante du dossier, et elle se vérifie en une minute sur https://developer.apple.com/account. Le trousseau contient un « Developer ID Application » et un « Apple Distribution » à ton nom, qui ne sont **pas** délivrés à une équipe personnelle gratuite — mais un certificat survit à l'expiration de l'adhésion. Si l'adhésion est active : TestFlight et l'App Store sont ouverts, et l'app installée sur l'iPhone ne meurt plus au bout de 7 jours. Si elle ne l'est pas : la voie gratuite impose **7 jours de validité, 3 appareils, 10 App IDs, 3 apps par appareil**, ou 99 $/an pour en sortir.
2. **Le compte Google Play existe-t-il, et est-il personnel ou organisation ?** 25 $ une fois, non remboursés si la vérification d'identité échoue (2 à 5 jours ouvrés ; D-U-N-S exigé pour une organisation). **C'est ce qui décide de la règle des 12 testeurs × 14 jours consécutifs** : elle s'applique aux comptes **personnels** créés après le 13 novembre 2023, pas aux comptes organisation (https://support.google.com/googleplay/android-developer/answer/14151465 ; seuil abaissé de 20 à 12 en décembre 2024, et depuis 2026 Google vérifie aussi que les testeurs ont réellement utilisé l'app). **Le chemin critique Play n'est pas technique, il est calendaire : ~3 semaines minimum entre la création du compte et la production.** À lancer maintenant, pas à la fin. Et attention : `STORE.md` §3.f décrit un « test interne » — ce n'est pas ce que Google exige, c'est un test **fermé**.
3. **Demander l'extension API 36 jusqu'au 1er novembre 2026 ?** La page officielle telle que servie le 9 septembre 2026 dit encore « You'll be able to access your app's extension forms in Play Console later this year » — formulation au futur, peut-être non mise à jour. Sans accès à la console, impossible de trancher. À vérifier **avant** tout upload.

**Sécurité, à traiter indépendamment des stores**

4. **Une clé Supabase et un PIN sont dans l'historique d'un dépôt PUBLIC.** *(Corrigé après vérification : l'enquête disait « fichier versionné », c'est faux — `git ls-files five-scorer-android/` renvoie 0 fichier, tout ce dossier est hors de git. Mais c'est pire que ce que ça suggère.)*

   `five-scorer-android/www/src/config.js` contient en clair une URL Supabase, une clé `sb_publishable_…`, le PIN `1234` et un commentaire disant que les tables n'ont pas de RLS. Le fichier n'est pas suivi aujourd'hui — mais il l'a été, sous `mobile/www/src/config.js`, et il a été retiré au commit `b9c847e` (« chore: remove mobile/ from profile repo »). **Retirer un fichier ne le retire pas de l'historique** : `git log --all -S 'sb_publishable_'` le retrouve, et `github.com/diamesene02/diamesene02` est **public** (`gh repo view` → `"visibility": "PUBLIC"`).

   Donc la clé est lisible par n'importe qui, aujourd'hui, et le restera même si le fichier disparaît du disque. Trois gestes, dans cet ordre : **révoquer la clé côté Supabase** (c'est le seul qui protège vraiment), activer la RLS sur les tables concernées, et seulement ensuite décider s'il vaut la peine de réécrire l'historique git. Le PIN `1234` n'a jamais rien protégé.
5. **Le keystore n'existe que sur ce Mac.** `five-scorer-release.keystore` (2 674 o, PKCS12, alias `five-scorer`, valide du 24/08/2026 au 16/08/2056) et `keystore.properties` sont tous deux gitignorés, et **aucun secret CI ne les reconstruit** — le commentaire du §4 de `scripts/customize-android.mjs` affirme le contraire, c'est faux (`grep -rniE "keystore|signing|base64"` sur les deux workflows : zéro occurrence). Perdre le Mac = perdre la capacité de mettre à jour l'app sur le Play Store. **Deux gestes : activer Play App Signing dès le premier AAB, et sauvegarder le keystore hors du dépôt.**

**Produit et conformité**

6. **Qui a le droit de supprimer un compte, et où ?** Apple 5.1.1(v) et Google exigent tous deux un chemin **dans l'app** pour l'utilisateur lui-même ; Google exige **en plus** une URL web de demande. Aujourd'hui : `grep` sur `app/`, `components/`, `lib/`, `prisma/` → **0 occurrence**. Et le tableau Sécurité des données du `STORE.md` déclare « suppression in-app par les admins », ce qui n'est pas conforme et constitue une déclaration inexacte — motif de suspension à part entière côté Google. Question produit : que devient un joueur supprimé dans les stats historiques du club ?
7. **Le nom sur les stores.** `applicationId` = `dev.diame.fivescorer`, `versionName` 2.1.0. Nom affiché, nom du développeur, catégorie, description : à écrire.
8. **L'icône et le splash.** L'icône actuelle est un « FS » plein-bord sur fond vert, sans zone de sécurité — le masque adaptatif ne garde que le cercle intérieur (66dp sur 108dp) et le rognera. Le splash est **le logo Capacitor sur fond blanc**, avant une app en thème sombre. Un agent peut régénérer aux bonnes dimensions ; il ne peut pas décider du dessin.
9. **Faut-il ouvrir l'App Store, et à quel prix ?** Trois options : (a) ne rien faire, l'iPhone reste en PWA installée — coût 0 € ; (b) soumettre la coquille telle quelle et voir — 99 $/an, risque 4.2 réel et documenté ; (c) financer l'embarquement du front (chemin 2, 7 292 lignes) ou la réécriture RN (chemin 3), ce qui lève 4.2 mais coûte des semaines à des mois.
10. **Que veut dire exactement « compatible React Native » ?** Aucune enquête n'a pu le déterminer, et la réponse change tout : « une app qui ne se fait pas refuser comme un site emballé » se règle avec Capacitor + du natif perceptible ; « du code React Native » est la réécriture du chemin 3.

---

## 7. Journal

*(vide)*

Format d'une entrée :

```
### AAAA-MM-JJ — Titre court de ce qui a été fait
**Étape du plan :** n° et intitulé
**État avant → après :** à faire → fait
**Vérifié par :** la commande exacte et sa sortie (le critère de « terminé » de l'étape)
**Fichiers touchés :** chemins absolus
**Ce qui a surpris :** ce qui ne s'est pas passé comme prévu, ou « rien »
**Reste ouvert :** ce que ça débloque, ce que ça bloque encore
```