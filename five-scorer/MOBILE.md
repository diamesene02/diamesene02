# MOBILE.md — Five Scorer en React Native (Expo)

> Ce document **remplace** celui qui recommandait Capacitor. La décision est prise par le propriétaire : on réécrit l'app en React Native, et on développe dans **Expo Go** (scan d'un QR code depuis l'iPhone, pas de build natif au début). Le débat Capacitor n'est pas rouvert ; ce qu'on abandonne en le fermant est écrit noir sur blanc au §2.
>
> Ce fichier est écrit pour être **exécuté par un agent sans contexte**. Chaque étape du §4 a un critère de terminé vérifiable **sans téléphone** : une commande, et la sortie attendue.
>
> Les chiffres marqués « (compté) » ont été obtenus par commande sur le dépôt. Ceux marqués « (enquête) » viennent des enquêtes préparatoires, faites au commit `117176b` ; le HEAD actuel est `9944e84` (« feat(api): la vitrine publique accepte toute origine »), donc un recomptage peut donner ±quelques lignes. **N'invente jamais un chiffre : recompte, ou écris « non mesuré ».**

---

## 1. Lancer sur mon iPhone dans Expo Go

### Où on en est, franchement

**Ce qui marche déjà :**

- L'app web est en production sur https://five-scorer.vercel.app et **y reste** pendant toute la réécriture.
- Les **écritures** du match en direct sont déjà en HTTP et déjà durcies : 10 handlers HTTP sous `app/api/clubs/` (compté), idempotents par identifiant généré côté client (`lib/ids.ts` → cuid2), avec upsert du match, dédoublonnage des événements, PATCH/DELETE tolérants au rejeu. **L'app Expo pourra taper ces routes telles quelles, sans une ligne de serveur à écrire pour la saisie.**
- Le Mac est prêt : Node v20.20.0 (compté) et 22.22.0 via nvm, pnpm 10.28.2, watchman, Xcode 26.3 (build 17C529), simulateurs iOS 18.6 et 26.2 (enquête). Le développement build n'est donc **pas** un mur : c'est une commande.

**Ce qui ne marche pas encore — à savoir avant de taper la première commande :**

- **Le projet Expo n'existe pas.** Il n'y a rien à lancer aujourd'hui : la première étape le crée.
- **Il n'y a aucune API de lecture.** Sur les 10 fichiers `route.ts` (compté), les seuls GET sont `roster`, `export` (CSV), `public/[slug]`, `cal/[token]`, `diagnostic`. Tout le reste des lectures passe par 26 `page.tsx` (compté) en composants serveur et 32 server actions dans 11 fichiers `"use server"` (compté) — deux mécanismes **inatteignables depuis React Native**. Une app native branchée aujourd'hui démarrerait sur une base vide.
- **Better Auth refusera la première connexion** : `trustedOrigins()` dans `lib/auth.ts` ne connaît que l'URL du site et les alias Vercel, et le plugin serveur `expo()` n'est pas monté. Symptôme attendu : `INVALID_ORIGIN` — le piège déjà vécu sur ce projet, où il avait été affiché comme « cet email est déjà utilisé » (commentaire de `lib/auth.ts`).
- **Toute la couche hors-ligne est à réécrire** : Dexie/IndexedDB et le service worker n'existent pas en React Native.

### Les commandes, dans l'ordre

```bash
# 0) Quelle version d'Expo Go l'App Store sert-il aujourd'hui ? C'est ELLE qui fixe le SDK.
curl -s "https://itunes.apple.com/lookup?id=982107779" \
  | python3 -c "import sys,json; a=json.load(sys.stdin)['results'][0]; print(a['version'], a['currentVersionReleaseDate'], a['price'], a['minimumOsVersion'])"
# Attendu (relevé le 2026-09-02) : 57.0.9  2026-09-02T17:00:03Z  0.0  16.4
# Si la version majeure n'est PAS 57, va lire l'encadré « Contradiction tranchée » ci-dessous.

# 1) Node. 20.20.0 suffit pour le SDK 57 ; autant prendre 22 tout de suite,
#    le SDK 58 (react-native 0.87) abandonnera Node 20.
nvm use 22.22.0
node -v            # v22.22.0

# 2) Le projet mobile vit DANS le dépôt, dans mobile/ (voir §3.1).
cd /Users/ibc/diamesene02/five-scorer
mkdir -p mobile && cd mobile
npx create-expo-app@latest . --template default

# 3) VÉRIFICATION OBLIGATOIRE : Expo Go n'embarque qu'UN SDK.
node -p "require('./package.json').dependencies.expo"
# Doit commencer par 57. Sinon : npx expo install expo@^57.0.0 && npx expo install --fix

# 4) Compte Expo. Depuis le SDK 57 il faut être connecté des DEUX côtés, avec le MÊME compte. C'est gratuit.
npx expo login

# 5) Démarrage. Le QR s'affiche dans le terminal.
npx expo start
```

Sur l'iPhone, dans cet ordre :

1. **App Store → « Expo Go »** (éditeur : 650 Industries, Inc.) → installer. Vérifier que la version affichée est **57.x**. iOS 16.4 minimum.
2. Ouvrir Expo Go → onglet **Home** → avatar en haut → **se connecter avec le même compte** qu'à l'étape 4. Sans ça, le SDK 57 refuse de charger le projet.
3. Mac et iPhone sur **le même Wi-Fi** (pas de partage de connexion, pas de réseau « invité » qui isole les clients).
4. Appareil photo iOS → viser le QR → toucher la bannière.

**Si le QR ne donne rien**, dans l'ordre du moins cher au plus cher :

```bash
npx expo start --tunnel     # contourne un Wi-Fi qui isole les appareils (plus lent)
npx expo start   puis  i    # simulateur iOS, aucun iPhone requis
npx expo run:ios --device   # development build local, Xcode 26.3, identifiant Apple GRATUIT suffit
```

> ### Contradiction tranchée : SDK 54 ou SDK 57 ?
>
> Deux enquêtes disent « Expo Go est gelé au SDK 54 depuis la panne d'approbation Apple de mai 2026 », deux autres disent « Expo Go 57.0.9 est revenu sur l'App Store le 2026-09-02 ». Elles ne se contredisent pas dans le temps : les premières s'appuient sur la **documentation et les changelogs d'Expo**, qui datent de la panne et n'ont pas été mis à jour ; la dernière s'appuie sur **l'API d'Apple**, interrogée le 2026-09-09.
>
> **On tranche : SDK 57**, parce qu'une réponse de l'App Store vaut mieux qu'une page de doc périmée, et parce que `expo@57.0.21` est bien la version `latest` du registre npm au 2026-09-08 (enquête). Mais la commande 0 ci-dessus **doit être relancée** : si elle renvoie 54.x, on repasse le projet en SDK 54 (`npx expo install expo@^54.0.0 && npx expo install --fix`), ce qui ne change **aucun** choix de bibliothèque de ce document — tous les modules retenus existent des deux côtés. Le seul cas qui coûte de l'argent est décrit au §6.

---

## 2. Ce qu'on fait, et ce que ça coûte

1. **On réécrit Five Scorer en React Native / Expo**, développement en Expo Go d'abord ; le backend reste le Next.js existant, en production, inchangé pour les écritures.
2. **Le cœur du lundi soir pèse 3 954 lignes** (LiveMatch 1035 + NewMatchForm 512 + PlayShell 333 + PlayerTile 140 + MvpPicker 72 + SyncBadge 109 + localMatch 707 + db 259 + sync 386 + clock 41 + audio 141 + balance 148 + ids 43 + retro 28, enquête), soit **18 % des 21 806 lignes TS/TSX du dépôt** — pour 100 % du parcours « j'arrive, je compose, je siffle, je marque, je termine, on rejoue ».
3. **Ce qui disparaît sans remplacement** : `public/sw.js` (305 lignes, compté), `RegisterSW.tsx`, `app/hors-ligne/`, la gymnastique de `PlayShell` qui devine l'identifiant du match dans l'URL, `navigator.storage.persist()`. En natif, le code est sur le téléphone.
4. **Ce qui coûte plus cher que prévu**, et qu'il faut inscrire au budget dès maintenant : les **32 server actions** sans jumeau HTTP (compté), les **~6 525 lignes de CSS** (enquête) dont rien ne se transpose, `lib/shareCard.ts` (291 lignes de Canvas 2D, compté) et `lib/audio.ts` (141 lignes de Web Audio, compté) qui n'ont aucun équivalent direct.
5. **Pendant tout ce temps, la PWA reste en production et reste l'outil du lundi.** On ne coupe rien. Les deux apps écrivent dans la même base par les mêmes endpoints idempotents ; elles cohabitent tant qu'une seule *saisit* un match donné.

### Ce qu'on abandonne, et ce que ça coûte (pour relire la décision dans six mois)

On abandonne Capacitor, c'est-à-dire : **réutiliser le code web tel quel dans une coquille native**. Le prix payé, en clair :

- **Le CSS est perdu.** ~6 525 lignes, dont 3 256 pour `globals.css` et 599 pour `live.css`, avec 53 `display:grid`, 29 pseudo-éléments et 7 animations `@keyframes` (enquête). Aucune ne survit ; tout se refait en `StyleSheet` + flexbox + Reanimated. C'est le poste que tout le monde sous-estime.
- **Le JSX est perdu.** 26 pages et 34 fichiers `"use client"` deviennent des composants `View`/`Text`.
- **Le rendu serveur est perdu.** C'est lui qui rendait 32 server actions et 26 pages « gratuites » : elles doivent devenir des endpoints HTTP.
- **On perd la mise à jour instantanée** d'une PWA (un `git push` et tout le monde a la nouvelle version) au profit d'un cycle de publication — atténué plus tard par EAS Update, pas supprimé.

Ce qu'on achète en échange, et qui a emporté la décision : le hors-ligne **réel** (l'app s'ouvre sans réseau au bord du terrain, ce que la PWA ne garantit pas), le vrai retour haptique (les 6 appels `navigator.vibrate` ne font probablement rien sur Safari iOS aujourd'hui — non vérifié, voir §6), l'écran qui reste allumé pendant le match (aucun Wake Lock dans le dépôt aujourd'hui, enquête), les notifications push le jeudi pour le lundi, et la disparition de ~355 lignes de contournements navigateur.

---

## 3. L'architecture

### 3.1 Où vit l'app Expo

**Choix retenu : `/Users/ibc/diamesene02/five-scorer-mobile/`, dossier FRÈRE de `five-scorer/`, dans le même dépôt git, avec son propre `node_modules` géré par `npm`.**

*(Écart assumé avec la recommandation d'origine, qui proposait `five-scorer/mobile/`. Le dossier frère a été retenu et l'app y tourne déjà — voir le journal du 9 septembre. Deux raisons : Next.js indexe tout ce qui vit sous sa racine et n'a rien à faire des fichiers Expo ; et la disposition du dépôt est déjà celle-là, `five-scorer` et `five-scorer-android` étant frères. C'est exactement le « repli » que le plan d'origine prévoyait en cas de collision Metro — on l'a pris d'emblée plutôt qu'après la panne.)*

Raison : l'agent qui porte `lib/localMatch.ts` a besoin de lire `../lib/localMatch.ts` juste à côté ; le document, le serveur et l'app partagent une seule histoire git ; et une réécriture qui casse le serveur se voit dans le même diff.

**Ne pas faire de workspace pnpm.** La racine reste en pnpm, `mobile/` reste en npm, et `mobile/node_modules/` va au `.gitignore`. pnpm installe en mode isolé et Metro s'y casse encore les dents sur certaines bibliothèques ; Expo documente le repli `nodeLinker: hoisted` (enquête), mais on n'en a pas besoin si on ne mélange pas.

**Risque connu, et son repli :** Metro remonte l'arborescence pour résoudre les modules et peut tomber sur le `node_modules` pnpm de la racine. Si le bundle échoue avec une résolution étrange, le repli immédiat est un dossier **frère** (`~/diamesene02/five-scorer-native`), tel que recommandé par l'enquête « expo-go ». Ce n'est pas une refonte : c'est un `mv`. À trancher par Ibrahima au §6 si le cas se présente.

### 3.2 Authentification

**Choix retenu : `@better-auth/expo` en version 1.7.1, PAS 1.7.3.**

C'est la seule divergence de fond entre l'enquête et la contre-enquête, et **la contre-enquête a raison — avec une preuve, pas une intuition.**

L'enquête faisait de la montée `better-auth` 1.7.1 → 1.7.3 la « toute première étape » (parce que `@better-auth/expo@1.7.3` exige `better-auth ^1.7.3`), tout en écrivant qu'elle n'avait pas lu le changelog. Or ce projet a appliqué le schéma « issuer » de Better Auth 1.7.0-1.7.2, et **1.7.3 l'a retiré** : `prisma/schema.prisma:57` déclare `issuer String` (requis, compté), la migration `20260824193000_account_issuer` l'a créée en `TEXT NOT NULL`, et `better-auth@1.7.3` ne l'écrit plus. Résultat : **chaque INSERT dans `account` échoue**, donc chaque inscription et chaque rattachement Google, **sur l'app web en production**. Better Auth a même écrit le message d'erreur pour ce cas précis (« Column "issuer" on table "account" is required but Better Auth never writes it, so every insert into "account" fails »).

Et cette montée est **entièrement évitable** : `@better-auth/expo@1.7.1` existe, exige `better-auth ^1.7.1` — la version installée (compté : `^1.7.1` en dépendance, 1.7.1 résolue) — et contient **déjà** les deux choses pour lesquelles l'enquête voulait 1.7.3 : le découpage à 1800 caractères pour le trousseau iOS (`STORAGE_VALUE_LIMIT`) et la réhydratation de session hors ligne (`restoreSessionCache`). Vérifié par extraction du tarball ; le plugin serveur est identique à l'octet près entre les deux versions.

**Conséquence contre-intuitive à ne pas rater :** aujourd'hui `"better-auth": "^1.7.1"` **accepte déjà 1.7.3**. Seul le lockfile protège la production. Un `pnpm update` de routine déclencherait la panne sans que personne l'ait décidé. **La bonne action est d'épingler la version exacte `"1.7.1"`**, pas de la relâcher (étape 2 du plan).

Les trois modifications serveur, dans `lib/auth.ts` :

```ts
import { expo } from "@better-auth/expo";

// plugins : expo() AVANT nextCookies(), qui doit rester en dernier.
// (contrainte explicite dans le code de Better Auth : warnIfCookiePluginNotLast)
plugins: [ organization({ /* inchangé */ }), expo(), nextCookies() ]

function trustedOrigins(): string[] {
  const origins = previewUrls();
  if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL);
  origins.push("fivescorer://");                 // build natif, plus tard
  if (process.env.NODE_ENV === "development") {
    origins.push("exp://", "exps://");           // Expo Go pointé sur le Mac
  }
  return origins;
}
```

- **`exps://` n'est pas un ornement.** Dès qu'on lance `npx expo start --tunnel` — le recours normal quand le téléphone n'est pas sur le Wi-Fi du Mac — `expo-linking` bascule le deep link du callback sur `exps://`, et le motif `exp://` **ne le couvre pas** (testé en exécutant `matchesOriginPattern` du better-auth installé). Sans lui, la connexion Google part en `INVALID_CALLBACK_URL`, avec un message qui ne dit pas pourquoi. À l'inverse, `exp://**` que recommandait l'enquête n'apporte **rien** : mêmes résultats que `exp://` sur les quatre URL d'essai.
- **Jamais `exp://` en production.** Le hook `after` du plugin serveur recopie l'en-tête `set-cookie` — donc le jeton de session en clair — dans le paramètre de query de l'URL de redirection dès que la destination est une origine de confiance à schéma non-http. En production, seul `fivescorer://` doit être de confiance.
- **`allowedDevOrigins` dans `next.config.js`** : Next.js 16 bloque par défaut les requêtes de développement d'origine autre que localhost, et on développera depuis l'IP LAN du Mac (192.168.1.192, enquête).

Côté app :

```ts
// mobile/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL, // http://192.168.1.192:3000 en dev, https://five-scorer.vercel.app sinon
  // ↑ Écrit avant l'écriture du code. Le vrai nom est EXPO_PUBLIC_API (sans
  //   _URL), et l'adresse n'est pas lue directement : `lib/api.ts` la résout
  //   (« localhost » désigne LE TÉLÉPHONE) et la choisit par l'origine, pas
  //   par __DEV__. C'est `API` de lib/api.ts qui est passé ici.
  plugins: [
    organizationClient(),
    expoClient({ scheme: "fivescorer", storagePrefix: "fivescorer", storage: SecureStore }),
  ],
});
```

Et **le point le plus important pour le produit** — appeler nos routes. Le cookie n'est pas envoyé automatiquement en React Native :

```ts
const cookie = await authClient.getCookie();
await fetch(`${API}/api/clubs/${clubId}/matches`, {
  method: "POST",
  credentials: "omit",                                   // impératif
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify(payload),
});
```

**Ce qui ne change pas, et c'est vérifié dans le code, pas supposé :** `middleware.ts` (son matcher exclut déjà `api/auth`, et `getSessionCookie` lit l'en-tête `cookie` brut en essayant `__Secure-better-auth.session_token` puis `better-auth.session_token`) ; `lib/guard.ts`, dont `getClubApiContext` est déjà la variante « API » qui renvoie `null` au lieu de rediriger — c'est la garde dont le mobile a besoin ; `app/api/auth/[...all]/route.ts` (4 lignes) ; et `lib/auth-client.ts` du web, qui reste tel quel.

**Ce qu'il ne faut surtout pas faire :** ajouter le plugin `bearer` (redondant avec le rejeu de cookies, et la doc Better Auth l'assortit d'un avertissement explicite) ; introduire `organization.setActive()` (le club courant est porté par la navigation et revérifié en base à chaque appel — `setActive` imposerait une **écriture serveur pour changer de club**, inutilisable au gymnase) ; appeler `@react-native-google-signin/google-signin` (code natif, development build obligatoire).

**Expo Go :** OUI, sans réserve, pour email/mot de passe. Les cinq dépendances natives de `@better-auth/expo` — `expo-secure-store`, `expo-web-browser`, `expo-linking`, `expo-network`, `expo-constants` — portent toutes `expo-go` dans le front-matter `platforms` de leur page de doc SDK 57, et les versions embarquées (`~57.0.3`, `~57.0.2`, `~57.0.9`, `~57.0.1`, `~57.0.17`) satisfont largement les minima déclarés. Le mécanisme qui rend tout ça possible : en Expo Go, `resolveScheme` d'`expo-linking` **ignore silencieusement** `fivescorer` et renvoie `exp` (« Silently ignore to make bare workflow development easier ») — le même code marche donc en Expo Go et dans un futur build natif, sans branche conditionnelle. **Google : à vérifier sur l'appareil** (voir §6) ; l'email/mot de passe, lui, n'envoie même pas de `callbackURL` et ne passe donc pas par le contrôle qui pose problème.

**Un risque que personne n'avait vu — MESURÉ le 9 septembre : 1 084 octets, soit la moitié de la limite historique d'iOS et bien en deçà du découpage à 1 800 caractères. Le risque est écarté, et le point reste utile à relire si `cookieCache` grossit un jour.** Texte d'origine : `lib/auth.ts` active `cookieCache: { enabled: true, maxAge: 60 * 5 }`, ce qui produit un second cookie `session_data` contenant session + utilisateur encodés. La doc `expo-secure-store` avertit que « Historically, some iOS releases refused values above roughly 2048 bytes ». Le découpage à 1800 caractères existe dans les deux versions du client, mais **personne n'a mesuré la taille réelle de ce cookie**. C'est cinq minutes de travail au premier écran de connexion.

### 3.3 Hors-ligne

**Choix retenu : `expo-sqlite` (~57.0.2), seul, sans ORM lourd, avec `drizzle-orm` (JavaScript pur) uniquement pour la réactivité.**

Verdicts, un par un, avec la source :

| Bibliothèque | Expo Go ? | Pourquoi |
|---|---|---|
| **expo-sqlite** | **OUI** — « Included in Expo Go » | API async complète, `withExclusiveTransactionAsync`, `addDatabaseChangeListener`. SQLCipher et libSQL non supportés en Expo Go — on n'en a pas besoin. |
| **drizzle-orm** | **OUI** (JS pur) | `useLiveQuery` de `drizzle-orm/expo-sqlite` s'abonne à `addDatabaseChangeListener`. Demande `babel-plugin-inline-import` + `sourceExts.push('sql')`. |
| **@paralleldrive/cuid2** | **OUI** (JS pur) | L'idempotence repose dessus, elle ne bouge pas. |
| **@react-native-community/netinfo** | **OUI** | Remplace `navigator.onLine`. |
| **AsyncStorage** | OUI, mais **inadapté au cœur** | Clé/valeur : pas d'index, pas de transaction, pas d'ordre. Une écriture interrompue perd toute la file. |
| **WatermelonDB** | **NON** | JSI natif + plugin de config tiers → development build. |
| **op-sqlite** | **NON** | « You cannot use this library on a expo-go app, you need to pre-build your app ». |
| **react-native-mmkv** | **NON** | « react-native-mmkv is not supported in Expo Go! Use EAS ». |
| **RxDB** | **NON en pratique** | Version SQLite gratuite « not made for production », 500 documents, sans index. Production = RxDB Premium, payant. |

Le modèle se transpose presque tel quel : 6 tables Dexie, 3 versions de schéma, 8 types d'opérations d'outbox, 51 appels `db.<table>.<méthode>`, 9 transactions, 5 sites `useLiveQuery` (enquête ; une contre-enquête annonce 10, c'est le nombre d'**occurrences du mot**, imports compris — on retient **5 sites d'appel** : NewMatchForm 1, LiveMatch 1, ReprendreLocal 1, PlayShell 2).

**Le point à ne surtout pas rater**, et il a été **prouvé expérimentalement** (SQLite 3.43.2, pas déduit d'une doc) : sans `AUTOINCREMENT`, supprimer la ligne 3 puis insérer **redonne l'id 3** — un `finishMatch` se glisserait à la place d'un but déjà parti. Avec `AUTOINCREMENT`, on obtient 4.

```sql
CREATE TABLE outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- OBLIGATOIRE, pas décoratif
  created_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  blocked_at  TEXT,
  match_id    TEXT,                                -- extrait du JSON, monté en colonne
  club_id     TEXT NOT NULL,
  op          TEXT NOT NULL                        -- l'OutboxOp sérialisé, inchangé
);
CREATE INDEX outbox_actives ON outbox(blocked_at, id);
-- PRAGMA journal_mode = WAL; à l'ouverture
```

Les quatre requêtes du drain, qui remplacent les requêtes Dexie de `lib/sync.ts` :

```sql
SELECT * FROM outbox WHERE blocked_at IS NULL ORDER BY id ASC LIMIT 1;     -- prochaine op
DELETE FROM outbox WHERE id = ?;                                            -- succès
UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?;     -- échec réessayable
UPDATE outbox SET blocked_at = ?, last_error = ?
  WHERE match_id = ? AND blocked_at IS NULL;                                -- refus 403/404/409, en cascade
SELECT COUNT(*) FILTER (WHERE blocked_at IS NULL),
       COUNT(*) FILTER (WHERE blocked_at IS NOT NULL) FROM outbox;          -- compteurs de la pastille
```

L'ordre de rejeu se prend **sur la clé primaire, jamais sur l'horodatage** : l'horloge du téléphone peut reculer. Le commentaire de `lib/sync.ts` documente ce bug ; `AUTOINCREMENT` est ce qui empêche de le revivre.

Les 9 `db.transaction("rw", …)` deviennent 9 `withExclusiveTransactionAsync` — pas `withTransactionAsync`, dont la doc Expo précise que « any query that runs while the transaction is active will be included in the transaction ».

**Ce qui se recopie sans une ligne à toucher :** `lib/clock.ts` (41 lignes, compté, « helpers purs, sans I/O » — le chrono se dérive de `elapsedMs` + `runningSince`, donc la suspension des timers par iOS ne casse rien), `lib/useSyncState.ts` (18 lignes, compté), et les ~196 premières lignes de `lib/db.ts` (types et union `OutboxOp`).

**Ce qui se re-câble :** `navigator.onLine` → NetInfo ; `document.visibilitychange` → `AppState` ; la relance exponentielle maison (5 s → 60 s, `2^min(echecs,4)`) survit sans changement — et devient *moins* nécessaire, puisqu'elle avait été écrite parce que l'événement `online` de la WebView Android ne se déclenchait parfois jamais.

**Correction de chiffre :** le rejeu fait **8** appels `fetch`, pas 7 (compté : 9 occurrences de `fetchAvecDelai` dans `lib/sync.ts` = 1 définition + 8 sites d'appel, un par `kind`).

**Le risque de latence qu'il faut mesurer avant d'écrire un écran :** `prisma/schema.prisma` dit que `Player.photo` est une **data-URL JPEG de ~20 ko** (« un club de quinze joueurs, c'est trois cents kilo-octets »), et `getLocalMatch` — la requête branchée sur `useLiveQuery` dans `LiveMatch` et `PlayShell` — les remonte joueur par joueur. Chaque but écrit **deux tables** (`events` et `outbox`) dans la même transaction, et `useLiveQuery` de Drizzle ré-exécute la requête entière sur changement de table : 10 à 14 participants × 20 ko rematérialisés à chaque incrément de score. **Non mesuré.** Si le chiffre est mauvais, la correction est simple : sortir `photo` de la requête live (roster chargé une fois à part), ou stocker les photos via `expo-file-system` en gardant le chemin en base.

**Le piège d'Expo Go pour ce produit précis, et il faut le dire au propriétaire aujourd'hui :** Expo Go charge le bundle depuis Metro, par le réseau. On peut y valider « je charge l'écran, je passe en avion, je saisis, je reviens, la file se vide ». On ne peut **pas** valider le scénario qui compte — « j'ouvre l'app déjà sans réseau, au bord du terrain ». **Expo Go sert à développer, jamais à recetter le hors-ligne.** Ce test-là exige un development build (étape 17).

### 3.4 L'API

**Choix retenu : réutiliser l'écriture telle quelle, n'écrire que des GET.**

L'écriture est déjà là et déjà durcie ; elle a coûté des mois de corrections (idempotence, scoping club revérifié, garde « match terminé → admin », validation anti-injection Prisma via `lib/ids.ts`). Les 8 opérations d'outbox tapent 4 fichiers de route qui ne bougent pas.

**Correction d'un chiffre discuté entre enquêtes :** il y a **10 fichiers `route.ts` au total**, dont **6 sous `/api/clubs/`**, portant **10 handlers HTTP** (compté : `roster` GET, `matches` POST, `matches/[matchId]` PATCH+DELETE, `events` POST+PATCH+DELETE, `lineup` PATCH+POST, `export` GET). L'enquête « auth » annonçait « 8 routes », l'enquête « api » « 9 fichiers et 12 handlers » (elle comptait `auth`, `cal`, `public`, `diagnostic`). On retient les chiffres ci-dessus, recomptés.

**L'affirmation « aucune ligne de serveur à écrire » est fausse** : elle est vraie de l'écriture, fausse de la lecture. Voici la V1 minimale, celle sans laquelle l'app native ne peut rien afficher :

| # | Endpoint | Alimenté par | Pourquoi il est indispensable |
|---|---|---|---|
| 1 | `GET /api/me` | `lib/guard.ts` `getUserClubs` | Liste des clubs avec slug, rôle, `canManage`, `canScore`, couleurs, `myPlayerId`. `/organization/list` de Better Auth ne rend pas le profil Club. |
| 2 | `GET /api/clubs/[clubId]` | `getClubApiContext` + `app/c/[slug]/layout.tsx` | Le bootstrap hors-ligne : couleurs, format, durée, `trackAssists`, `trackCards`, `motmMode`, `membersCanScore`. À écrire en SQLite dès la première ouverture connectée. |
| 3 | `GET .../roster` **(existe, à étendre)** | aligner sur `sessions/[id]/page.tsx` | Ajouter `abonne`, `userId`, `isArchived`. |
| 4 | `GET .../matches?status=LIVE,SCHEDULED` | `app/c/[slug]/page.tsx` | Répond à « y a-t-il déjà un match ouvert ? » — ce qui évite deux feuilles concurrentes sur deux téléphones. |
| 5 | `GET .../matches/[matchId]` | `matches/[id]/page.tsx` | La reprise : téléphone à plat, deuxième personne qui prend la saisie, réinstallation. L'outbox seule ne suffit pas. |
| 6 | `GET .../matchdays/[id]/lineup` | modèle `MatchDayLineup` | La compo préparée. Sans lui, la feuille repart d'une page blanche au coup d'envoi — exactement le problème que cette table a été créée pour supprimer. |

Puis, par ordre d'utilité : `matchdays` (liste et détail), `POST matchdays`, `PUT rsvps`, la compo, les adversaires, le vote MOTM ; ensuite fiches joueurs et statistiques (`lib/stats.ts`) ; l'administration en dernier — elle se fait très bien depuis le navigateur, aucun de ces écrans ne se pratique au bord du terrain.

**Deux règles pour écrire ces endpoints**, tirées de bugs réels du dépôt :

1. Utiliser **`getClubApiContext`** (`lib/guard.ts`), jamais `requireClub` : la variante API renvoie `null` au lieu de rediriger.
2. Valider **tout** identifiant venu du client avec `idsValides` / `estId` (`lib/ids.ts`) avant de le mettre dans un `where` Prisma. Le commentaire de `events/route.ts` raconte le bug : un objet passé pour un filtre, l'API répondant 200 « deduped », et le but tapé jamais écrit.

**Le meilleur chemin, à long terme :** extraire la logique de chaque server action dans une fonction pure de `lib/`, puis l'appeler des deux côtés — la server action pour le web, un route handler pour le natif. Sinon la règle métier existe en deux exemplaires qui divergeront.

**CORS : inutile pour le téléphone, utile pour la cible web.** React Native n'est pas un navigateur : il n'applique pas la politique de même origine et ne fait pas de requête préalable. Sur l'appareil, aucun en-tête `Access-Control-*` n'est nécessaire — et si une connexion échoue, ce n'est PAS CORS, c'est la vérification d'origine propre à Better Auth (§3.2). Ne pas perdre une soirée là-dessus.

Une exception, déjà en place : `/api/public/[slug]` porte `access-control-allow-origin: *`. Non pour le téléphone, mais pour `npx expo start --web`, qui rend le même code dans un navigateur et permet de vérifier une mise en page sans sortir l'iPhone. Les données y sont déjà publiques, la garde `isPublic` s'applique inchangée. Ne pas généraliser ce réglage aux endpoints authentifiés.

### 3.5 Le dessin

**Choix retenu : `StyleSheet` pur, plus un `ThemeProvider` maison qui appelle `themeTokens()` — la fonction existante, non modifiée.** Pas de NativeWind, pas de Tamagui ; Unistyles est de toute façon hors jeu (« Unistyles includes custom native code, which means it does not support Expo Go »).

La raison est structurelle, pas idéologique : ce dessin n'est pas un système d'utilitaires, c'est un système de **jetons calculés**. `lib/theme.ts` (182 lignes) et `lib/color.ts` (184 lignes) — 366 lignes de TypeScript pur, sans un seul `document`/`window`/`navigator` (compté) — dérivent 30 jetons des deux couleurs de chasubles, avec un plancher de contraste APCA à Lc 60. NativeWind et Tamagui veulent une palette déclarée à la compilation ; ici la palette n'existe qu'au runtime, elle change quand un club change sa chasuble. On finirait en style inline de toute façon, en ayant payé la chaîne Babel/Metro — qui a un historique documenté de casse à chaque montée d'Expo SDK.

**Ces 366 lignes se copient verbatim.** C'est la meilleure nouvelle du dossier design.

Trois découvertes qui changent le travail :

1. **La police n'est pas un problème.** Le bloc « SYSTÈME NATIF » de `globals.css` (à partir de la ligne 1997, hors des couches Tailwind) force `font-family: var(--ios-font)` = SF Pro sur `[data-club-theme]`, qui enveloppe **tous** les écrans du club. Archivo n'est pas affichée là. En React Native, sur iOS, **omettre `fontFamily` donne SF Pro** : exactement le rendu de production. On économise `expo-font`, le préchargement, et le mur des polices variables — React Native n'expose ni `fontStretch` ni `fontVariationSettings`, et le `.woff2` est de toute façon inutilisable sur Android.
2. **Le geste signature survit.** Les chiffres de score condensés n'utilisent pas l'axe de chasse : `.score-lourd` fait `transform: scaleX(0.86)` + `font-variant-numeric: tabular-nums`. En RN : `transform: [{ scaleX: 0.86 }]` et `fontVariant: ['tabular-nums']`. Le score du live garde sa forme.
3. **Le verre est un faux problème.** Il n'y a que 6 déclarations `backdrop-filter` réelles, et le dessin s'interdit déjà explicitement le flou là où il compte : « Collé en haut, opaque. Jamais de backdrop-filter : le score se noierait dans ce qui passe dessous ». Les « cartes de verre » sont des `View` avec fond `rgba`, bordure et ombre — du `StyleSheet` ordinaire. `expo-blur` (dans Expo Go) couvre les 6 cas restants ; sur Android il n'est efficace qu'à partir d'Android 12.

**Le vrai coût est la mise en page** : 53 `display:grid`, 43 `grid-template-columns`, 29 pseudo-éléments, 4 `position:sticky` (enquête). Les grilles se refont en flexbox (la plupart sont des rangées à colonnes fixes), les pseudo-éléments deviennent des `View` absolues, les sticky des en-têtes animés sur le `scrollY`. C'est mécanique et fastidieux, pas risqué. Les 1 352 `className` du dépôt ne sont pas 1 352 chaînes à traduire : ce sont **178 classes sémantiques** de `globals.css` réutilisées partout → 178 entrées de `StyleSheet.create`, un fichier, une fois.

Briques de dessin, toutes vérifiées dans Expo Go : `expo-linear-gradient` (linéaire seulement), `react-native-svg` (le repli pour les dégradés radiaux et le grain), `react-native-safe-area-context` (`useSafeAreaInsets()` rend les mêmes nombres que `env(safe-area-inset-*)`), `react-native-reanimated` 4.5.1, `expo-blur`, `expo-glass-effect` (iOS 26+, à garder en tête pour `.menu-club`). `experimental_backgroundImage` du cœur de RN lit `radial-gradient()` depuis RN 0.80 — **mais la syntaxe exacte produite par `crest()` n'a pas été testée sur appareil** ; repli connu et sûr : `<RadialGradient>` de react-native-svg.

**Le thème gagne quelque chose :** le cookie `fs-theme` disparaît (plus de rendu serveur), le choix vit dans le stockage local, et `Appearance`/`useColorScheme` permet enfin de suivre le réglage système de l'iPhone — ce que le cookie ne faisait pas.

### 3.6 Son, partage, retour haptique — les deux sous-systèmes qui ne se portent pas

Aucune enquête ne les avait mis dans son bilan ; ils pèsent **432 lignes** (compté : 141 + 291).

- **`lib/audio.ts` (141 lignes) est synthétisé, pas joué.** `playGoalSound("A")` fait glisser un triangle de 440 → 880 Hz, `("B")` fait l'inverse, avec un commentaire qui dit pourquoi : « le marqueur regarde le jeu, pas l'écran — l'oreille est le seul canal qui reste ». Il n'y a **aucun fichier audio dans le dépôt**. La seule implémentation Web Audio en React Native, `react-native-audio-api` (Software Mansion), est explicitement **hors Expo Go** (« contains native custom code and isn't part of the Expo Go application »). **Décision : pré-rendre 4 fichiers courts (but A, but B, annulation, coup de sifflet) depuis les fréquences exactes du fichier, et les jouer avec `expo-audio` (~57.0.4, dans Expo Go).** `lib/audio.ts` devient la **spécification**, pas du code porté. `playsInSilentMode` vaut `true` par défaut : le son sort téléphone en silencieux, ce qu'on veut. Et `unlockAudio()` disparaît — c'était une cicatrice de navigateur.
- **`lib/shareCard.ts` (291 lignes) est du Canvas 2D** (`getContext("2d")`, `fillText`, `measureText`, `toBlob`, `navigator.share`). **Décision : redessiner la carte en composants React Native et la capturer avec `react-native-view-shot`** (« Included in Expo Go »), puis `expo-sharing`. Plus simple à maintenir que 291 lignes de dessin impératif. (`@shopify/react-native-skia` serait le portage le plus fidèle mais coûte le development build.)
- **Retour haptique : 6 sites d'appel** de `navigator.vibrate` (LiveMatch 448/465/535, PlayerTile 69/74/90 — une contre-enquête annonce 12, ce sont les **occurrences du mot**, garde `typeof` comprise). `expo-haptics` n'accepte **aucune durée en ms** : 12 → `impactAsync(Light)`, 18 → `selectionAsync()`, 30 → `impactAsync(Medium)`, `[12,40,12]` → `notificationAsync(Warning)`. On perd la nuance de durée, on gagne le Taptic Engine.
- **Autres API navigateur à recâbler**, absentes des inventaires : `navigator.clipboard` (5 usages) → `expo-clipboard` ; `navigator.share` (4) → `expo-sharing` ; `localStorage` (6) → `expo-sqlite/kv-store` ou AsyncStorage.
- **Un gain gratuit** : `useKeepAwake()` (`expo-keep-awake`, dans Expo Go). Il n'y a **aucun Wake Lock dans le dépôt** aujourd'hui : l'écran s'éteint à la 20ᵉ minute pendant qu'on regarde le jeu. Une ligne, visible dès la première démo au club.
- **Notifications push : le seul vrai mur, et il tombe tôt.** `expo-notifications` (~57.0.17) est dans Expo Go, mais le push distant y est indisponible sur Android depuis le SDK 53, et sur iOS le jeton serait rattaché au bundle d'Expo Go — inexploitable en production. Les notifications **locales** marchent (« match dans 1 h »). « Qui vient lundi ? » envoyé le jeudi = **development build obligatoire** (étape 17).

---

## 4. Le plan

Règles de lecture pour l'agent :

- **Une étape = une exécution de deux heures maximum.** Si elle déborde, la couper en deux et l'écrire au Journal.
- **Une étape n'est « fait » que si sa commande de vérification a été lancée et a donné la sortie attendue.** Pas de « ça devrait marcher ».
- **Un écran n'est « fait » que s'il a été VU dans le simulateur, à côté du
  rendu du site.** Pas d'après le CSS, pas d'après un rapport d'enquête : on
  ouvre les deux et on compare. La boucle ne demande rien à Ibrahima —
  `npx expo start --port 8090 --ios` installe Expo Go sur le simulateur et
  l'app s'y recharge à chaud ; le site s'ouvre dans le navigateur intégré, où
  `getComputedStyle` donne les valeurs réelles plutôt que devinées.
- **On ne lance jamais un build EAS avant ça.** Un build coûte dix minutes, un
  quota, et une installation à Ibrahima. Le refaire pour un défaut visible en
  dix secondes dans un simulateur, c'est lui faire perdre son temps à notre
  place. Règle posée par lui le 9 septembre 2026, après un build livré dont
  les écrans ne ressemblaient pas au site.
- **Aucune étape ne touche la production** sans figurer explicitement dans le §6.
- États possibles : `à faire` · `en cours` · `fait` · `bloqué`.
- **`mobile/` dans les commandes ci-dessous se lit `five-scorer-mobile/`.** Le tableau a été écrit avant que le dossier frère soit tranché (§3.1) ; les chemins n'ont pas tous été réécrits. Les commandes de vérification se lancent depuis `five-scorer-mobile/`. Corriger chaque ligne au fil des étapes, quand on y touche.

| # | Étape | Critère de terminé (sans téléphone) | État |
|---|---|---|---|
| **1** | **Relever la version d'Expo Go sur l'App Store** et l'inscrire au Journal. Si ≠ 57, appliquer la note « Contradiction tranchée » du §1 et ajuster toutes les versions de ce document. | `curl -s "https://itunes.apple.com/lookup?id=982107779" \| python3 -c "import sys,json;print(json.load(sys.stdin)['results'][0]['version'])"` → affiche une version, notée au Journal. | **fait** — 57.0.9, publiée le 2026-09-02, iOS 16.4 minimum. Le SDK 57 est donc bien celui d'Expo Go. |
| **2** | **Protéger la production.** Épingler `"better-auth": "1.7.1"` (version **exacte**, sans caret) dans `package.json`, relancer l'installation. Ne PAS migrer vers 1.7.3 (§3.2). | `node -p "require('./package.json').dependencies['better-auth']"` → `1.7.1` ; puis `pnpm install --frozen-lockfile` sort en 0 ; puis `pnpm build` sort en 0. | **fait** — commit `99dd37d` sur `main`. Le risque était plus grand qu'annoncé : `vercel.json` installe avec `--frozen-lockfile=false`, donc le lockfile ne protégeait rien au déploiement. |
| **3** | **Créer le projet Expo** dans `five-scorer-mobile/`, SDK 57, TypeScript, expo-router. Poser `"scheme": "fivescorer"` dans `app.json`. | `cd five-scorer-mobile && node -p "require('./package.json').dependencies.expo"` commence par `57` ; `node -p "require('./app.json').expo.scheme"` → `fivescorer` ; `npx tsc --noEmit` sort en 0. | **fait** — SDK 57.0.21, RN 0.86.3, TypeScript, `scheme` = `fivescorer`, expo-router installé et point d'entrée basculé sur `expo-router/entry`. Quatre routes : `index` (aiguillage), `vitrine`, `connexion`, `clubs`. `tsc` vert. |
| **4** | **Serveur : ouvrir la porte à Expo.** Ajouter `@better-auth/expo` aux dépendances du dépôt Next, monter `expo()` avant `nextCookies()`, étendre `trustedOrigins()` avec `fivescorer://` + (`exp://`, `exps://`) en développement seulement, ajouter `allowedDevOrigins` dans `next.config.js`. | `pnpm build` sort en 0 ; puis, `pnpm dev` lancé : `curl -s -X POST -H "Origin: exp://192.168.1.192:8081" ... /api/auth/sign-in/email \| grep -c INVALID_ORIGIN` → `0`. | **fait** — commit `f083477` sur `main`. La requête d'origine `exp://` reçoit `INVALID_EMAIL_OR_PASSWORD`, donc l'origine est acceptée et c'est bien le mot de passe qui est refusé. |
| **5** | **Porter le noyau pur** dans `five-scorer-mobile/lib/noyau/` : `clock.ts` (41 l.), `ids.ts` (43 l.), `theme.ts` (182 l.), `color.ts` (184 l.), `balance.ts` (148 l.), `retro.ts` (28 l.) — copie verbatim — et poser un lanceur de tests. | `cd five-scorer-mobile && npx vitest run` → tous verts, au moins un test par fichier porté ; `npx tsc --noEmit` sort en 0. | **fait** — 626 lignes copiées octet pour octet, 78 tests verts en 7 fichiers, `tsc` vert. Vitest 4.1.11 (pas 5 : voir le journal). Un 7ᵉ fichier de test, `copie-conforme.test.ts`, vérifie l'égalité octet pour octet avec `five-scorer/lib/` et l'absence d'API navigateur : la copie ne peut plus diverger en silence. |
| **6** | **Le schéma SQLite** : traduire les 6 tables de `lib/db.ts` en DDL (`five-scorer-mobile/db/schema.sql`), avec `AUTOINCREMENT` sur `outbox.id`, la colonne `match_id`, l'index `outbox_actives`, et `PRAGMA journal_mode = WAL` à l'ouverture. | Depuis `five-scorer-mobile/` (il n'y a **pas** de binaire `sqlite3` dans le nuage — `node:sqlite` est le même moteur, SQLite 3.51.2) :<br>`node --no-warnings -e "const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs');const d=new DatabaseSync(':memory:');d.exec(fs.readFileSync('db/schema.sql','utf8'));d.exec(\"INSERT INTO outbox(created_at,club_id,op) VALUES('t','c','{}'),('t','c','{}'),('t','c','{}'); DELETE FROM outbox WHERE id=3; INSERT INTO outbox(created_at,club_id,op) VALUES('t','c','{}');\");console.log(d.prepare('SELECT MAX(id) AS m FROM outbox').get().m)"` → **`4`** (et non `3`) ; puis `npx vitest run db` vert. | **fait** — `MAX(id) = 4`, et 19 tests dans `db/schema.test.ts`. Le contre-exemple est testé aussi : une table témoin **sans** `AUTOINCREMENT` redonne bien `3`, donc le mot n'est pas décoratif. Ajouts assumés au plan : un second index `outbox_match (match_id, blocked_at)` pour le blocage en cascade, des `CHECK` qui rejouent en base les unions fermées de `lib/db.ts`, un `UNIQUE (match_id, player_id)` sur `participants`, et `db/schema.ts` — copie conforme du `.sql`, générée par `scripts/schema-vers-ts.mjs` et vérifiée octet pour octet, parce que Metro ne sait pas charger un `.sql` sans plugin Babel. |
| **7** | **Porter le drain de l'outbox** (`lib/sync.ts`) sur une couche d'accès abstraite (une interface `Db` avec deux implémentations : `expo-sqlite` en prod, `node:sqlite`/`better-sqlite3` en test). Garder la machine à états, le backoff 5→60 s, le timeout 8 s, `pending`/`blocked`/`needsAuth`, le blocage en cascade par `match_id`. **8** opérations → **8** appels fetch. | `cd five-scorer-mobile && npx vitest run sync` → vert, dont un test « 50 opérations enfilées, serveur en panne, processus relancé : 0 perdue, 0 dupliquée, ordre conservé » et un test « 403 sur une op → toutes les ops du même match passent `blocked`, aucune supprimée ». | **fait** — 13 tests dans `lib/outbox/sync.test.ts`, dont les deux exigés. L'interface `Base` a quatre méthodes et deux implémentations (`baseExpo.ts` sur le téléphone, `baseNode.ts` dans les tests) ; le SQL vit dans `outbox.ts`, la machine à états dans `sync.ts`. Rien n'est global : `creerDrain(deps)` rend un drain, ce qui permet d'en instancier deux sur le même fichier de base — c'est ce qui rend le test de reprise après crash honnête. **Correction au plan** : la relance après un échec réessayable part à **10 s**, pas 5 — le compteur d'échecs est incrémenté avant la replanification, côté web aussi ; le plancher à 5 s ne sert qu'aux passages qui finissent sans échec en laissant de la file. |
| **8** | **La fonction d'appel authentifié** de l'app : `credentials: "omit"` + en-tête `cookie` issu de `authClient.getCookie()`, URL absolues depuis `EXPO_PUBLIC_API`, 401 → `SessionExpiree`. | `cd five-scorer-mobile && npx vitest run appel` → vert, avec `fetch` moqué : assertions sur `credentials === "omit"`, présence de l'en-tête `cookie`, et `SessionExpiree` sur 401. | **fait** — 17 tests dans `five-scorer-mobile/lib/appel.test.ts`. Le cœur a été **sorti de `lib/api.ts` vers `lib/appel.ts`** : `api.ts` importe `expo-constants` et `expo-linking` dès sa deuxième ligne, donc rien de ce qui vit à côté n'est testable dans le nuage. `creerAppel(deps)` reçoit l'adresse, le cookie et le `fetch` — le procédé de `creerDrain(deps)`, pour la même raison. **Écarts assumés** : `needsAuth` du plan est la classe `SessionExpiree`, qui existait déjà et que `app/clubs.tsx` lit déjà ; une classe `ErreurServeur` porte le `status` sur l'objet (c'est ce que lit `encaisserEchec` du drain) et recopie le `{"error":…}` du serveur dans le message ; `lireCookie()` est extraite pour être **injectée au drain** à l'étape 11, l'app et la file devant rejouer le même cookie. Trois tests relisent `lib/api.ts` en texte pour vérifier qu'il délègue et ne réimplémente ni `fetch` ni `credentials`. |
| **9** | **Serveur : les 3 premiers GET** — `GET /api/me`, `GET /api/clubs/[clubId]`, extension de `GET .../roster` (+`abonne`, `userId`, `isArchived`). Tous via `getClubApiContext`, tous validant les identifiants avec `lib/ids.ts`. | `pnpm build` sort en 0 ; `pnpm test:api` (Vitest, session simulée) → vert ; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/me` sans cookie → `401`. | **fait** — `GET /api/me` (tous mes clubs, l'amorce de la connexion), `GET /api/clubs/[clubId]` (un seul, pour rafraîchir les réglages sans repasser par la connexion ; 404 et non 403 sur un club dont on n'est pas membre, pour ne pas confirmer son existence), et l'effectif étendu (`abonne`, `isArchived`, `?archives=1` qui range les archivés en fin de liste). La forme du club vit dans `lib/clubApi.ts`, partagée par les deux routes : deux copies auraient divergé au premier réglage ajouté. **Écart assumé au plan** : `userId` demandé n'est pas rendu — l'app n'en a besoin que pour « lequel est moi ? » et « ce profil est-il revendiqué ? », on rend `estMoi` et `compteLie` plutôt que l'identifiant de compte de chaque joueur à tous les membres. Les 23 vérifications de `five-scorer-mobile/scripts/parcours-connexion.mjs` passent. |
| **10** | **Écran de connexion** (`mobile/app/(public)/connexion.tsx`) + inscription, avec `authClient.signIn.email` / `signUp.email` (API identique à `LoginForm.tsx`). Aiguillage `index.tsx` : session ? club : bienvenue. | `cd five-scorer-mobile && npx tsc --noEmit` vert ; et la chaîne complète vérifiée sans navigateur (voir le journal du 9 septembre). | **fait** — `connexion.tsx` (connexion + inscription sur le même écran, messages d'erreur en français dont `INVALID_ORIGIN` qui dit quoi corriger), `index.tsx` (aiguillage session → clubs, sinon vitrine), `clubs.tsx` (les clubs de l'utilisateur, leurs réglages, déconnexion). Chaîne complète rejouée sans téléphone par `five-scorer-mobile/scripts/parcours-connexion.mjs` : origine `exp://` acceptée, cookie délivré, `/api/me` servi, 401 sans cookie. **En Expo Go la connexion exige `pnpm dev` sur le Mac** — voir le journal du 9 septembre 10:4x. |
| **11** | **Porter `lib/localMatch.ts`** (707 l., 41 appels Dexie, 9 transactions) sur la couche SQLite, en `withExclusiveTransactionAsync`. La logique métier (calcul de la minute, garde anti-équipe-vide, refus d'écrire dans un match terminé, invités) ne bouge pas. À couper en deux exécutions si nécessaire (lecture puis écriture). | `cd five-scorer-mobile && npx vitest run localMatch` → vert, dont « un but écrit `events` ET `outbox`, ou ni l'un ni l'autre » et « aucune écriture dans un match `FINISHED` ». | **fait** — 54 tests dans `five-scorer-mobile/lib/match/localMatch.test.ts`, dont les deux exigés, **et leur contre-épreuve** : la transaction retirée d'`addEvent` fait tomber le premier, les trois gardes `FINISHED` retirés font tomber le second (sorties collées au journal). Faite en une exécution, pas deux : le SQL est sorti dans `lib/match/tables.ts` (530 l.), la logique dans `lib/match/local.ts` (778 l.). Rien n'est global — `creerMatchLocal(deps)` reçoit la base, l'horloge et le générateur d'identifiants, comme `creerDrain` et `creerAppel`. **Écarts assumés** : (a) `getLocalMatch` lit **hors** transaction, comme le `Promise.all` du web — l'envelopper prendrait un verrou d'écriture (`BEGIN IMMEDIATE`) à chaque re-rendu de l'écran de match, et le drain attendrait derrière l'affichage ; (b) l'entrée de `saveRoster` accepte un `photo` optionnel, que le web n'a pas — l'endpoint de l'effectif l'envoie déjà et la feuille doit montrer les visages sans réseau (§3.3) ; à entrée identique, comportement identique. |
| **12** | **Serveur : les 3 GET restants de la V1** — `matches?status=`, `matches/[matchId]` (feuille complète : participants avec `team` et `initialTeam`, événements ordonnés, mvp, votes, rsvps), `matchdays/[id]/lineup`. | `NEXT_DIST_DIR=.next-verif npx next build` en 0 ; puis, serveur `next dev` lancé sur une base locale : `node scripts/jeu-dessai.mjs && node scripts/parcours-lecture.mjs` (depuis `five-scorer-mobile/`) → **TOUT VERT**, 39 vérifications. **`pnpm test:api` n'existe pas** — le plan l'inventait ; il n'y a aucun harnais Vitest côté web, et l'étape 9 avait déjà dû s'en passer. | **fait** — les trois GET, plus le jeu d'essai qui les rend vérifiables dans le nuage. La forme des réponses est celle de `LocalMatch` / `LocalParticipant` / `LocalEvent` (`lib/outbox/types.ts`) : chaque bloc se recopie tel quel dans sa table SQLite, sans couche de traduction. **Écarts assumés** : (a) les votes MOTM sont rendus **comptés**, jamais nominatifs — `{ total, byPlayer, mine }` — là où le plan disait « votes » ; (b) `?status=` refuse un statut inconnu par un **400** au lieu de l'ignorer ; (c) chaque participant porte déjà sa clé composée `matchId::playerId`, pour que la règle de `pKey` n'existe pas en deux exemplaires. |
| **13** | **Écran « nouveau match »** : compo, équilibrage (`lib/balance.ts`), invités, coup d'envoi → écriture locale + `createMatch` en outbox. | `npx tsc --noEmit` vert, et surtout : la boucle rejouée à la main sur le simulateur, avec vérification en base. | **fait** — `app/compo.tsx`. **Écart assumé au site** : les abonnés arrivent présélectionnés et un bouton « Tous / Personne » double la liste, parce que taper quatorze joueurs un par un debout au bord du terrain est le geste le plus coûteux de la soirée. |
| **14** | **Écran « jouer », partie 1** : la tuile joueur et l'horloge. | `npx tsc --noEmit` vert ; `grep -rc "suppressTapUntil" five-scorer-mobile/` → `0` ; geste vérifié sur simulateur. | **fait** — `app/match/[id].tsx`. Tap = but, appui long 500 ms = retirer son dernier but ; le garde `suppressTapUntil` du web a bien disparu, React Native n'émet pas `onPress` après `onLongPress`. Horloge dérivée du coup d'envoi, tic de 500 ms. Pas de `useKeepAwake` ni de son : `expo-keep-awake` et les fichiers audio restent à faire. |
| **15** | **Écran « jouer », partie 2** : le score, la barre d'invite 15 s, les chemins d'annulation, la confirmation de fin. | `npx tsc --noEmit` vert ; parcours rejoué sur simulateur avec contrôle en base après chaque geste. | **en cours** — faits : le tableau de marque (le camp qui perd s'efface), l'invite 15 s pour la passe décisive ET pour l'auteur d'un csc, deux chemins d'annulation (appui long sur la tuile, bouton « Annuler » pour le dernier événement), la confirmation de fin ; **et, le 9 septembre 22:1x** : la chronologie (feuille du bas, le plus récent en haut, « Annuler » par ligne), les cartons (jaune/rouge par carte d'équipe, si `trackCards`, avec le compteur sur la tuile), l'élection du MVP (feuille du bas, seulement en `motmMode === "ADMIN"`, facultative), et `gestureEnabled: false` sur la route. **Et, le 10 septembre 00:1x** : la correction de composition en cours de match — bandeau « Corriger la composition », tap sur une tuile pour envoyer un joueur dans l'autre camp, « + Faire entrer un joueur » pour le retardataire, éclair de 400 ms sur la tuile déplacée, refus du garde anti-équipe-vide affiché en clair. **Tout le code de l'étape est écrit.** Ce qui la sépare de `fait` n'est plus du code : c'est la **vérification visuelle que le nuage ne peut pas faire** — ces écrans n'ont été VUS par personne (§6, ligne 12). |
| **16** | **Son et retour haptique** : produire 4 fichiers audio courts depuis les fréquences exactes de `lib/audio.ts` (but A montant 440→880, but B descendant 880→440, annulation, double sifflet 1760 Hz), les jouer avec `expo-audio`. | `ls -l mobile/assets/audio/*.m4a \| wc -l` → `4` ; `npx expo export --platform ios` en 0 ; `grep -rc "react-native-audio-api" mobile/package.json` → `0` (interdit en Expo Go). | à faire |
| **17** | **Build installable sur l'iPhone.** Le projet natif est prêt : `expo prebuild` passe, 102 pods installés, `ios/FiveScorer.xcworkspace` existe, `DEVELOPMENT_TEAM = M283R456KQ` (équipe **payante**, pas l'identifiant gratuit — voir le journal). | `npx expo prebuild --platform ios --no-install` en 0 et `ls ios/*.xcworkspace` existe : **atteint**. La compilation, elle, échoue. | **fait** — par EAS, pas en local. Build `9727ecbd`, profil `lundi`, terminé. Vérifié en téléchargeant l'`.ipa` : bundle `com.ibc.fivescorer`, signé par l'équipe payante (`M283R456KQ.com.ibc.fivescorer`), profil ad hoc n'autorisant **que** l'iPhone de Diame, `main.jsbundle` de 2,6 Mo embarqué (donc démarre sans Metro), schéma `fivescorer` enregistré, ATS `NSAllowsArbitraryLoads=false`. Le build local reste impossible sur cette machine — voir le journal. |
| **18** | **Maestro sur simulateur** : 3 parcours (connexion, créer un match, marquer 3 buts et terminer). | `maestro test mobile/.maestro/` → 3 flows `PASSED` sur le simulateur iOS 26.2. | à faire |
| **19+** | **Le reste, par lots** : accueil (847 l.) → liste des matchs + récap + effectif → soirées + calendrier + argent → stats + fiche joueur → réglages. Chaque lot a son GET serveur d'abord, son écran ensuite. `p/[slug]`, `r/[id]`, `privacy`, `terms` **restent sur le web** (669 l. retirées du périmètre) : elles sont faites pour être ouvertes par quelqu'un qui n'a pas l'app. | Par lot : `NEXT_DIST_DIR=.next-verif npx next build` en 0, `node scripts/parcours-lecture.mjs` vert (étendu au lot), `npx expo export --platform ios` en 0. (`pnpm test:api` n'existe pas — voir l'étape 12.) | **en cours, et le tableau était en retard sur le dépôt** — au 9 septembre 22:1x, `five-scorer-mobile/app/` porte déjà `club/[id]/index.tsx` (accueil), `club/[id]/matchs.tsx`, `club/[id]/soirees.tsx`, `club/[id]/stats.tsx`, `recap/[id].tsx` et `soiree/[id].tsx`, avec leurs GET côté serveur (commits `5ace403`, `1360559`, `ae6d84c`). **Aucun des trois n'a d'entrée au journal** : ce qu'ils font est lisible dans le diff, ce qu'ils ont écarté ne l'est pas. Restent au moins l'effectif et les réglages. |
| **3 bis** | **Le premier écran, sans authentification** — pour voir quelque chose de vrai dans Expo Go avant d'avoir porté la connexion. A demandé un endpoint public côté serveur (`GET /api/public/[slug]`, déployé sur `main`) qui rend la vitrine du club ET ses jetons de thème calculés par `lib/theme.ts` : la règle des couleurs ne doit exister qu'à un seul endroit. | `cd five-scorer-mobile && npx tsc --noEmit` en 0 ; `curl -s https://five-scorer.vercel.app/api/public/renault-five-urban-guy \| python3 -c "import sys,json;d=json.load(sys.stdin);print(d['club']['nom'], len(d['classement']))"` → le nom du club et le nombre de joueurs. | **fait** — commits `36ce034`, `9944e84` sur `main` et `2b4ba1b` sur `mobile`. Rendu vérifié avec la cible web d'Expo : le club, les photos et le 18-9 du 7 septembre s'affichent. |
| **X** | **Chantier séparé, sans urgence, jamais sur la prod en premier** : `ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;`, retrait du champ dans `schema.prisma`, essai d'inscription réelle sur une preview, **puis seulement** `better-auth@1.7.3` + `@better-auth/expo@1.7.3`. Aucun index unique à retirer au préalable (vérifié dans le SQL de la migration). | Sur une base de preview : `prisma migrate deploy` en 0, puis une inscription réelle qui renvoie 200, puis `node -p "require('./node_modules/better-auth/package.json').version"` → `1.7.3`. | à faire |
| **Y** | **Chantier séparé** : porter `lib/shareCard.ts` (291 l.) en vues RN + `react-native-view-shot` + `expo-sharing`. | `npx expo export --platform ios` en 0 ; `grep -rc "getContext(\"2d\")" mobile/` → `0`. | à faire |

**Ordre de dépendance en une phrase :** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16, et **à l'issue de l'étape 16 l'app sert un lundi soir**. 17 et 18 la rendent recettable ; 19+ la rendent complète.

---

## 5. Les tests

### Ce qui se teste sans aucun appareil

**Unitaire (Vitest, dans `mobile/`)** — c'est là que doit vivre la confiance, parce que c'est ce qu'un agent peut relancer toutes les deux heures :

- La logique pure portée verbatim : `clock.ts` (dérivation du chrono depuis `elapsedMs` + `runningSince`, y compris horloge qui recule), `balance.ts`, `color.ts`/`theme.ts` (le plancher APCA à Lc 60 est testable : une chasuble claire et une foncée doivent produire des encres différentes). **Fait à l'étape 5 : 78 tests dans `five-scorer-mobile/lib/noyau/`, `npm run tester`.**
- **La non-divergence du noyau** : `copie-conforme.test.ts` compare octet pour octet les 6 fichiers de `lib/noyau/` à ceux de `five-scorer/lib/`, et vérifie qu'aucun n'a acquis de `document.`/`window.`/`navigator.`/`localStorage`. C'est le test qui empêche la réécriture de partir en deux versions de la même règle.
- **Le drain de l'outbox contre un faux serveur** : c'est le test qui valide tout le reste, et il ne demande aucune interface. 50 opérations, serveur en panne, processus tué, relancé : rien de perdu, rien de dupliqué, ordre conservé. Plus le cas 403 → blocage en cascade sans suppression, et le cas 401 → `needsAuth`. **Fait à l'étape 7 : 13 tests dans `five-scorer-mobile/lib/outbox/sync.test.ts`.** « Processus tué » y est deux instances de drain sur le même fichier SQLite, la première abandonnée en pleine panne réseau.
- **Le SQL lui-même**, avec `node:sqlite` — **il n'y a pas de binaire `sqlite3` dans le conteneur du nuage**, et c'est sans importance : `node:sqlite` embarque le même moteur (SQLite 3.51.2, relevé le 9 septembre), celui d'expo-sqlite sur le téléphone. **Fait à l'étape 6 : 19 tests dans `five-scorer-mobile/db/schema.test.ts`.** La réutilisation d'identifiant sans `AUTOINCREMENT` y est un test **et** son contre-exemple : une table témoin sans le mot redonne l'identifiant supprimé. Ce n'est pas une croyance.
- **Les actions de match contre un vrai SQLite**. **Fait à l'étape 11 : 59 tests dans `five-scorer-mobile/lib/match/localMatch.test.ts`** (54 à l'étape 11, +5 pour le coup de sifflet le 9 septembre au soir). Le test qui compte n'est pas « un but est bien écrit », c'est **l'annulation** : une `BaseCapricieuse` refuse tout `INSERT INTO outbox`, et on vérifie qu'il ne reste NI événement NI opération NI point au score. Les deux règles gardées par les tests exigés ont été retirées du code une par une pour voir les tests tomber (journal du 9 septembre 18:1x) — sans cette contre-épreuve, un test vert ne dit rien.
- **La fonction d'appel authentifié** avec `fetch` moqué : `credentials: "omit"` et en-tête `cookie` présents. **Fait à l'étape 8 : 17 tests dans `five-scorer-mobile/lib/appel.test.ts`.** Le test qui compte n'est pas « le cookie est là », c'est « le cookie est une **chaîne**, pas une promesse » : le `await` oublié sur `getCookie()` produit un 401 parfaitement trompeur, et rien à l'écran ne le distingue d'une session réellement expirée.

- **Les endpoints de lecture, contre un vrai serveur et une vraie base.** **Fait à l'étape 12 : 39 vérifications dans `five-scorer-mobile/scripts/parcours-lecture.mjs`.** La découverte de l'étape est ailleurs : **il y a un PostgreSQL 16 complet dans le conteneur du nuage** (`/usr/lib/postgresql/16/bin/postgres`, à lancer sous l'utilisateur `postgres`). Le serveur n'est donc plus une boîte noire ici — on migre, on peuple avec `scripts/jeu-dessai.mjs`, on lance `next dev`, et on lit pour de vrai. Le jeu d'essai refuse toute `DATABASE_URL` qui ne soit pas locale : il écrit, et il ne doit jamais écrire ailleurs.

**Compilation et bundle** — deux commandes qui attrapent 80 % des régressions sans téléphone :

```bash
cd five-scorer-mobile && npx tsc --noEmit          # types
cd five-scorer-mobile && npm run tester            # vitest run
cd five-scorer-mobile && npx expo export --platform ios   # le bundle Metro se construit vraiment
```

**Le serveur se vérifie À CÔTÉ, jamais dans `.next` :**

```bash
cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
```

**`prisma generate` n'est pas facultatif dans un conteneur neuf**, et c'est le
piège qui coûte vingt minutes de fausse alerte : `pnpm build` vaut
`prisma generate && next build` (lire `package.json`), donc la commande de
vérification écrite ici sans lui échoue sur des erreurs qui ressemblent à une
régression du code — `Parameter 'tx' implicitly has an 'any' type` dans
`app/actions/calendrier.ts`, et une dizaine d'autres du même genre. Ce ne sont
pas des régressions : c'est le client Prisma absent, donc `prisma.$transaction`
sans types. Vérifié le 9 septembre : avec `prisma generate` d'abord, le même
build sort en 0.

`next.config.js` lit `NEXT_DIST_DIR` exprès. Sans lui, `pnpm build` écrase le
`.next` du `pnpm dev` en cours.

**Mais la variable ne garde PAS l'arbre propre, contrairement à ce qui était
écrit ici** : `next-env.d.ts` est **suivi par git** et regénéré par Next à
chaque lancement, avec le chemin du dossier de sortie du moment —
`./.next/types/…` après un build normal, `./.next-verif/types/…` après le build
de vérification, `./.next/dev/types/…` après un `next dev`. Les trois se
succèdent dans une exécution d'agent, et le dernier gagne.

C'est ainsi que le commit `399a0b9` (étape 9) a poussé un `next-env.d.ts`
pointant sur `.next-verif/`, un dossier de vérification **gitignoré qui
n'existe ni sur le Mac ni sur Vercel**. Il a repointé là une deuxième fois au
commit `1360559`, le 9 septembre au soir : ce n'est pas un accident isolé mais
la conséquence mécanique de la commande de vérification que ce document
prescrit. Elle reviendra à chaque exécution.

**Correction du 9 septembre 20:4x — la conséquence annoncée ici était fausse.**
Il était écrit qu'« un `tsc` sur un clone neuf cherche un fichier absent ». Ça
ne se reproduit pas. Mesuré, le fichier pointant sur `./.next/types/` et
`.next/` **absent** du disque :

```
$ cd five-scorer && npx tsc --noEmit
TSC EXIT=0
(zéro ligne de sortie)
```

Deux raisons : TypeScript tolère l'import sans effet d'un chemin absent dans un
fichier de déclaration, et surtout `tsconfig.json` inclut **explicitement les
deux** dossiers (`.next/types/**/*.ts` **et** `.next-verif/types/**/*.ts`).
Aucune des deux valeurs ne casse donc le typage.

**Ce qui reste vrai**, et suffit à garder la règle : la valeur qui doit être au
dépôt est `./.next/types/routes.d.ts`, celle que produisent un `next build`
ordinaire et Vercel. Toute autre valeur est du **bruit de diff** qui revient à
chaque commit et brouille la relecture — pas une panne. Ne pas dramatiser, ne
pas négliger.

**La règle, donc :** la commande de vérification du serveur se termine par la
remise en état, dans le même souffle :

```bash
cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
git checkout -- five-scorer/next-env.d.ts   # fait partie de la commande, pas une option
```

Et avant chaque commit, `git diff -- five-scorer/next-env.d.ts` doit être vide.
Ce n'est pas du travail de l'exécution.

**Playwright sur l'app web, qui reste en production** — c'est le filet de sécurité de la migration : chaque endpoint ajouté au serveur pour le mobile doit prouver qu'il n'a rien cassé côté web. Trois parcours suffisent : connexion, création d'un match, saisie de trois buts et fin de match. À lancer avant chaque déploiement du serveur, systématiquement, tant que la PWA est l'outil du lundi.

**Maestro sur simulateur iOS** (18.6 ou 26.2, déjà installés) : les mêmes parcours, côté natif. Le simulateur suffit pour tout sauf le hors-ligne réel et les notifications.

### Ce qui ne se teste que sur un appareil physique

À écrire tel quel dans le Journal quand ça arrivera, pour qu'on ne se raconte pas d'histoires :

- **Ouvrir l'app déjà sans réseau, au bord du terrain.** Impossible en Expo Go (Metro sert le bundle par le réseau). Ce test n'existe qu'à partir de l'étape 17.
- La connexion Google en Expo Go (voir §6).
- La taille réelle du cookie `session_data` dans SecureStore.
- Le rendu du dégradé radial de `crest()` par `experimental_backgroundImage`.
- La latence du cycle « but → `useLiveQuery` → re-rendu » avec 14 photos data-URI.

### Ce que « autocorrection » veut dire pour un agent qui tourne toutes les deux heures

1. **Une exécution = une étape du §4, et une seule.** Pas de « j'en profite pour ».
2. **Toujours finir par la commande de vérification de l'étape, et coller sa sortie réelle au Journal.** Une étape dont la commande n'a pas été lancée reste `en cours`, jamais `fait`.
3. **Si la commande échoue : corriger, relancer, au plus deux fois.** Au troisième échec, passer l'étape en `bloqué`, écrire au Journal ce qui a été essayé et la sortie exacte, et **ouvrir une ligne au §6** si la décision dépasse l'agent. Ne pas contourner, ne pas commenter un test, ne pas ajouter `--force`.
4. **Interdits permanents**, sans exception et sans demander :
   - `pnpm update`, `pnpm up`, ou toute régénération du lockfile à la racine (cf. le piège `issuer` du §3.2) ;
   - toucher à la base de production, ou déployer une migration Prisma ;
   - passer `better-auth` au-dessus de 1.7.1 hors de l'étape X ;
   - ajouter une dépendance qui n'est pas dans ce document sans écrire au Journal **pourquoi**, et sans avoir vérifié son statut Expo Go (bandeau « Included in Expo Go », ou dépôt tiers = development build) ;
   - modifier le comportement d'un endpoint existant sous `/api/clubs/` — on **ajoute**, on ne réécrit pas.
5. **Toujours recompter avant de citer un chiffre.** Le HEAD bouge ; les chiffres de ce document datent de `117176b` ou du 2026-09-09.
6. **Une régression sur `pnpm build` ou sur Playwright arrête tout** : la PWA est l'outil du lundi. Elle passe avant l'app native, toujours.

---

## 6. À décider par Ibrahima

Un agent ne peut trancher aucune de ces lignes.

1. **La version d'Expo Go sur ton iPhone.** Ouvre l'App Store, cherche Expo Go, regarde le numéro. Si c'est **57.x**, tout ce document tient tel quel. Si c'est **54.x**, on fixe le projet en SDK 54 (aucun choix de bibliothèque ne change) — ou on passe par `eas go`, qui exige l'**Apple Developer Program à 99 $/an**. Question directe : **as-tu cette adhésion ?** C'est elle, et elle seule, qui décide si les SDK 55/56/57 sont atteignables sur ton téléphone quand la fenêtre App Store se referme.
2. **Google en Expo Go, ou email/mot de passe d'abord ?** Le chemin Google est plausible et entièrement décrit (§3.2), mais **non testé sur appareil**, et des tickets Better Auth signalent des `state_mismatch` en Expo sans qu'on sache s'ils concernent Expo Go. Ma recommandation : **email/mot de passe pour tout le développement**, Google validé le jour du development build. Ton avis ?
3. **Quand fait-on la migration `issuer` + Better Auth 1.7.3 ?** (étape X). Elle n'est pas urgente, elle touche la production, et elle doit se faire sur une preview avec une vraie session ouverte avant/après. Un soir calme, pas un dimanche.
4. **Est-ce qu'on garde le grain et le dégradé à 4 couches de `.fond-match` ?** Le grain est un motif de points de 5 px à **0,05 d'opacité**. En natif il coûte une image tuilée plein écran sous un ScrollView. Il est possible que la bonne réponse soit simplement de le supprimer — mais c'est ton dessin, ça se juge à l'œil sur l'appareil.
5. **Les photos des joueurs.** Ce sont des data-URL JPEG de ~20 ko en base. Trois options : les garder en base SQLite (simple, mais 200-280 ko rematérialisés à chaque but si on ne sort pas `photo` de la requête live), les déplacer vers `expo-file-system` avec le chemin en base (plus sain), ou ajouter un champ `photoUrl` côté serveur (le plus propre, mais ça touche le web). Ça se décide après la mesure de l'étape 11.
6. **Deux apps qui écrivent en même temps.** Pendant les lots, la PWA et l'app Expo tapent les mêmes endpoints. C'est sûr **tant qu'une seule saisit un match donné**. Est-ce qu'on se donne une règle simple — « le lundi, un seul téléphone tient la feuille » — et laquelle ?
7. **Quand coupe-t-on la PWA ?** Ma recommandation : jamais avant que le hors-ligne réel ait été recetté sur un development build (étape 17), et jamais avant deux lundis consécutifs sans incident.
8. **Le push est-il au programme cette saison ?** « Untel a mis un but », ou « qui vient lundi ? » envoyé le jeudi. C'est le service que la PWA ne rend pas, et c'est ce qui rend le development build obligatoire. Si oui, l'étape 17 remonte dans l'ordre.
9. ~~**`mobile/` dans le dépôt, ou dossier frère ?**~~ **Tranché le 9 septembre : dossier frère `five-scorer-mobile/`**, dans le même dépôt git (donc une seule histoire, pas deux). Voir §3.1. Rien à décider.
10. **Les jetons de thème : calculés par le serveur, ou recalculés sur le téléphone ?** Les deux existent aujourd'hui dans l'app et ne se contredisent pas encore. Le serveur les envoie déjà tout faits (`/api/public/[slug]`, et l'endpoint 2 du §3.4 les enverra pour un club authentifié) ; `lib/noyau/theme.ts` sait aussi les calculer localement depuis les deux chasubles. **Ma recommandation : le serveur reste la source, on met les jetons en cache SQLite au premier bootstrap connecté, et `lib/noyau/theme.ts` ne sert que de repli hors ligne.** On garde une seule règle vivante, et l'app se peint quand même au bord du terrain sans réseau. Ton avis ? Ça se tranche avant l'étape 13.
11. **`iron-session`, `SESSION_SECRET`, `SCORING_PIN_HASH`** sont du **code mort** : zéro import dans tout le dépôt, il n'y a pas de second mécanisme d'authentification à porter. On les supprime du dépôt web au passage ? (Trois lignes, mais c'est ta décision.)
12. **La règle « un écran n'est *fait* que s'il a été VU dans le simulateur » (§4) est aujourd'hui inapplicable dans le nuage — et déjà enfreinte.** Il n'y a ni macOS ni Xcode ici. Cinq écrans sont dans le dépôt sans que personne les ait regardés : `compo` et `match/[id]` (étapes 13-14, marquées *fait*), et les lots `matchs`, `soirées`, `récap` (poussés sans journal). Deux sorties possibles, et c'est toi qui choisis : (a) **la règle tient** — une exécution depuis le Mac fait la revue visuelle de ces cinq écrans côte à côte avec le site, avant qu'on en ajoute un sixième ; (b) **la règle change** — elle dit alors ce que le nuage doit faire à sa place (`tsc`, `expo export`, tests des couches appelées) et réserve le mot *fait* à ce qui a été vu. Ma recommandation : (a) une fois, maintenant, tant qu'il n'y a que cinq écrans — puis (b) pour la suite. Ce qu'il ne faut pas, c'est laisser une règle écrite que personne ne tient : c'est ce qui rend tout le reste du document négociable.


---

## 7. Journal

*Une entrée par exécution d'agent, la plus récente en haut.*

### 2026-09-10 00:1x — Étape 15 : le retardataire et le mauvais camp

- **État** : étape 15 `en cours` → `en cours`. **Tout le code de l'étape est
  écrit** ; ce qui reste n'est pas du code, c'est la revue visuelle que le nuage
  ne peut pas faire (§6, ligne 12, toujours sans réponse). La prochaine
  exécution peut passer à l'étape 16 sans rien laisser derrière elle.
- **Rien n'était cassé au départ**, vérifié avant d'ajouter quoi que ce soit :
  `npx tsc --noEmit` en 0 et 189 tests verts sur un `node_modules` réinstallé
  de zéro (le conteneur arrive vide : `npm install` dans `five-scorer-mobile/`
  et `pnpm install --frozen-lockfile` dans `five-scorer/` font partie de
  l'exécution, pas de la mise en route).
- **Ce que ça règle, et c'est le dernier trou du lundi soir** : deux copains
  dans la même équipe qu'on ne voit qu'au coup d'envoi, et le type qui arrive à
  la 10ᵉ minute. Les deux se terminaient de la même façon — terminer le match
  et tout ressaisir — parce que `addEvent` refuse les buts d'un joueur non
  inscrit. La couche locale savait déjà le faire (`movePlayerTeam`,
  `ajouterJoueurAuMatch`, `joueursAbsentsDuMatch`, testés à l'étape 11) ;
  il n'y avait aucun geste pour l'atteindre.
- **Un mode, pas un geste de plus sur la tuile.** C'est le choix du site et il
  se défend seul : la rangée d'un joueur porte le tap le plus fait de la
  soirée. Lui donner un second sens — même sous un appui long, déjà pris par
  l'annulation — c'est un but non compté un lundi sur trois. Donc un bandeau
  qui dit ce qui est en cours (« Aucun but ne se compte tant que ce bandeau est
  là »), des tuiles qui ne montrent plus que la flèche du camp d'arrivée, ni
  csc ni cartons pendant ce temps, et un bouton « Terminé » pour en sortir.
- **Ce que j'ai ajouté et que le site n'a pas** : le message de refus, affiché
  sous le bandeau. Le garde anti-équipe-vide (« Il faut au moins un joueur de
  chaque côté ») se déclenche par un geste parfaitement ordinaire — le dernier
  joueur d'une colonne — et le site le range dans son `setError` général. Ici,
  muet, le tap passerait pour une tuile mal visée : on retape, et on ne
  comprend pas. Les deux actions attrapent l'exception et l'écrivent en rouge.
- **L'éclair de la tuile déplacée** est un fond clair tenu 400 ms puis retiré,
  là où le site fait un fondu `@keyframes liveArrive`. Sans Reanimated : une
  animation de 400 ms ne justifie pas de brancher la bibliothèque sur cet
  écran, et un fond qui s'éteint d'un coup se voit aussi bien qu'un fondu. En
  correction, les deux colonnes se ressemblent — sans cette trace, on ne sait
  pas si le tap a déplacé le joueur ou manqué la tuile.
- **Le mode n'existe pas sur un match contre un adversaire extérieur.** Sur un
  `EXTERNAL`, l'équipe B n'est pas une équipe du club : `movePlayerTeam` refuse
  déjà d'y envoyer quelqu'un (« Pas d'équipe B à composer sur ce match »).
  Afficher une entrée qui ne mène qu'à un refus, c'est pire que ne rien
  afficher. Même règle que le site, écrite ici à partir du garde plutôt que
  recopiée.
- **Vérifié par** :

  ```
  $ cd five-scorer-mobile && npx tsc --noEmit
  TSC=0

  $ npm run tester
   Test Files  12 passed (12)
        Tests  189 passed (189)

  $ npx expo export --platform ios
  › ios bundles (1):
  _expo/static/js/ios/entry-92a6761d6397167d7e080e58b1f1874b.hbc (3.3MB)
  Exported: dist
  EXPORT=0

  $ cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  BUILD EXIT=0

  $ git checkout -- five-scorer/next-env.d.ts && git status --short
   M five-scorer-mobile/app/match/[id].tsx
  ```

- **Ce qui a surpris** : le journal du 9 septembre 22:1x annonçait
  `app/match/[id].tsx` à **843 lignes**. Recompté sur le commit `0997c2b` :
  **962**. Le chiffre avait dû être pris en cours de travail, pas à la fin.
  Corrigé dans l'entrée elle-même, dans ce commit. Ce n'est pas anodin : ce
  fichier est la seule mémoire, et un chiffre faux y est indiscernable d'un
  chiffre vrai. **Recompter à la fin, jamais pendant.** (Le fichier fait
  1 200 lignes après cette exécution — compté après.)
- **Ce que je n'ai PAS pu vérifier, et qu'il ne faut pas se raconter** : aucun
  de ces gestes n'a été fait par un doigt. `tsc`, les 189 tests des couches
  appelées et le bundle Metro disent que le code tient debout ; ils ne disent
  pas que le bandeau ne recouvre pas le score, ni que la flèche se voit sur une
  chasuble blanche. Deux défauts que dix secondes de simulateur trancheraient.
- **Fichiers touchés** :
  `/home/user/diamesene02/five-scorer-mobile/app/match/[id].tsx`
  `/home/user/diamesene02/five-scorer/MOBILE.md`
- **Reste ouvert** :
  - **le son (étape 16), et c'est maintenant le premier de la liste** : les
    quatre fichiers audio n'existent toujours pas, `useKeepAwake` n'est pas
    posé. Ce sont les deux choses qui se verraient — s'entendraient — au club
    dès la première soirée ;
  - la revue visuelle des six écrans jamais vus (§6, ligne 12) : `compo`,
    `match/[id]`, `matchs`, `soirées`, `récap`, et maintenant le mode
    correction. La question posée le 9 septembre au soir attend toujours ;
  - `lib/soiree.ts` n'a toujours pas de test ;
  - l'opération `movePlayer` et `addParticipant` ont bien un destinataire côté
    serveur (elles sont dans les 8 `kind` du drain, testées à l'étape 7) —
    **jamais rejouées contre un vrai serveur depuis cet écran**, comme
    `HALF_TIME`.

### 2026-09-09 22:1x — Étape 15 : la chronologie, les cartons, le MVP — et un coup de sifflet qui ne partait nulle part

- **État** : étape 15 `en cours` → `en cours` (il reste la correction de
  composition, et la vérification visuelle que le nuage ne peut pas faire).
- **Ce que j'ai trouvé cassé avant d'ajouter quoi que ce soit**, et c'est le
  vrai gain de l'exécution : **`siffletMiTemps` n'inscrivait aucun événement.**
  Il figeait le chrono et passait en seconde période, rien de plus. Côté web,
  `onHalftime` appelle `addEvent({ type: "HALF_TIME" })` juste après. Deux
  conséquences, aucune visible en relisant le code de l'écran : la mi-temps ne
  quittait jamais le téléphone (rien dans la file, donc rien au serveur, donc
  rien dans le récap), et la chronologie que j'allais écrire n'aurait jamais eu
  de ligne « — Mi-temps — » à afficher. Corrigé : le sifflet écrit chrono,
  période, événement et opération **dans une seule transaction**.
- **Et sa réciproque** : annuler une mi-temps ramène en première période.
  Sans ça, un sifflet donné par erreur restait donné — le bouton refuse une
  seconde mi-temps, donc la vraie n'aurait plus pu être sifflée du match. La
  remise à 1 vit dans `removeEvent` (couche locale), pas dans l'écran comme
  côté web : les deux chemins d'annulation (la chronologie et le bouton
  « Annuler ») en héritent sans que la règle existe en deux exemplaires.
- **Ajouté à l'écran** (`app/match/[id].tsx`, 612 → 962 lignes ; *le « 843 » écrit
  ici le 9 septembre était faux — recompté sur le commit `0997c2b` le 10 septembre*) :
  - **la chronologie** — feuille qui monte du bas, ouverte par le bouton rond
    de la barre du haut, le plus récent en haut (c'est celui qu'on vient de se
    tromper), minute, pastille de chasuble ou carton, nom (« csc de Rouges »
    quand personne n'est nommé), passeur en dessous, et « Annuler » par ligne ;
  - **les cartons** — deux cibles sous chaque carte d'équipe, seulement si
    `club.trackCards` ; le choix du joueur se fait dans la même feuille du bas ;
    le compteur apparaît sur la tuile du joueur, parce que « qui est déjà
    averti » se lit en jouant, pas en ouvrant un panneau ;
  - **l'élection du MVP** — seulement en `motmMode === "ADMIN"` (en `VOTE` les
    joueurs votent après coup, en `OFF` personne), facultative comme sur le
    site : on peut terminer sans MVP ;
  - **`gestureEnabled: false`** sur la route `match/[id]`, dans `_layout.tsx` :
    le geste de retour d'iOS part du bord gauche, exactement là où se trouve la
    première tuile de joueur.
- **Un défaut évité par construction, faute de pouvoir le voir** : la feuille
  du bas garde son contenu pendant qu'elle redescend (`derniereFeuille`).
  Sans cette mémoire, fermer le choix d'un carton ferait clignoter
  « Événements » le temps de l'animation. Je ne peux pas regarder un écran ;
  je peux écrire le code qui rend le clignotement impossible.
- **Vérifié par** :

  ```
  $ cd five-scorer-mobile && npx vitest run localMatch
   Test Files  1 passed (1)
        Tests  59 passed (59)

  $ npx tsc --noEmit
  TSC=0

  $ npm run tester
   Test Files  12 passed (12)
        Tests  189 passed (189)

  $ npx expo export --platform ios
  › ios bundles (1):
  _expo/static/js/ios/entry-234c180bc6e05d6b3c0069920ae33a4d.hbc (3.3MB)
  Exported: dist
  EXPORT=0

  $ cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  BUILD EXIT=0
  ```

- **La contre-épreuve, parce qu'un test vert ne dit rien tout seul.** Les deux
  règles neuves ont été retirées du code une par une :

  ```
  # majPeriode(b, matchId, 1) neutralisé dans removeEvent :
  × annuler la mi-temps ramène en première période 12ms
        Tests  1 failed | 58 passed (59)

  # base.transaction() retirée de siffletMiTemps :
  × l'événement et la période tombent ensemble, ou pas du tout 12ms
        Tests  1 failed | 58 passed (59)
  ```

  Deux contre-épreuves intermédiaires n'ont **rien** fait tomber, et c'est
  instructif : écrire le chrono par la poignée `base` au lieu de la poignée
  `b` de la transaction ne change rien, parce que `BaseNode` n'a qu'une
  connexion — SQLite met tout ce qui passe par cette connexion dans la
  transaction ouverte. Seule la disparition complète du `BEGIN` se voit. Le
  test garde donc la bonne propriété (« rien ne survit à l'échec »), pas celle
  que son nom laisse croire (« ces écritures-ci sont dans la transaction »).
- **Une règle que le nuage ne peut pas tenir, et qu'il faut trancher.** Le §4
  dit : « Un écran n'est *fait* que s'il a été VU dans le simulateur ». Il n'y
  a pas de simulateur dans le nuage — pas de macOS, pas de Xcode. Les étapes 13
  et 14 sont pourtant marquées **fait**, et les trois lots de l'étape 19+
  (`matchs`, `soirées`, `récap`) ont été poussés sans entrée de journal du tout.
  Autrement dit : **cinq écrans de cette app n'ont été vus par personne.** Ils
  compilent, le bundle Metro se construit, les couches qu'ils appellent sont
  testées — ce n'est pas la même chose que d'avoir regardé. Je ne coche donc
  pas l'étape 15, et j'ouvre la ligne 12 du §6 : soit la règle vaut pour tout
  le monde et une exécution du Mac doit rattraper la revue visuelle des cinq
  écrans, soit elle est réécrite pour dire ce qu'un agent du nuage doit faire
  à la place. Ce que je ne veux pas, c'est qu'elle reste écrite et ignorée.
- **Fichiers touchés** :
  `/home/user/diamesene02/five-scorer-mobile/lib/match/local.ts`
  `/home/user/diamesene02/five-scorer-mobile/lib/match/localMatch.test.ts`
  `/home/user/diamesene02/five-scorer-mobile/app/match/[id].tsx`
  `/home/user/diamesene02/five-scorer-mobile/app/_layout.tsx`
  `/home/user/diamesene02/five-scorer/MOBILE.md`
- **Reste ouvert** :
  - la correction de composition en cours de match — dernier morceau de
    l'étape 15 ; `movePlayerTeam`, `ajouterJoueurAuMatch` et
    `joueursAbsentsDuMatch` existent et sont testés, il manque l'écran ;
  - le son (étape 16) : les quatre fichiers audio n'existent toujours pas, et
    `useKeepAwake` n'est pas posé — deux lignes qui se verraient au club ;
  - `lib/soiree.ts` n'a toujours pas de test (ouvert par l'exécution de 20:4x) ;
  - le tableau du §4 a menti sur l'étape 19+ jusqu'à cette exécution ; il est
    corrigé, mais la cause reste : **trois commits poussés sans journal**. Ce
    fichier ne se met pas à jour tout seul.
  - à ne pas oublier au premier lancement réel : le serveur accepte bien
    `HALF_TIME` (`app/api/clubs/[clubId]/matches/[matchId]/events/route.ts`,
    ligne 14), donc l'opération neuve a un destinataire — **vérifié dans le
    code, jamais rejoué contre un vrai serveur.**

### 2026-09-09 20:4x — `next-env.d.ts` remis, et une conséquence corrigée

- **État** : aucune étape touchée. Surveillance de la PR #3.
- **Ce qui s'est passé.** Le commit `1360559` (« les soirées », autre session)
  a poussé `next-env.d.ts` pointant de nouveau sur `.next-verif/`. C'est le
  même défaut que le commit `399a0b9` de l'étape 9 — et ce n'est pas de la
  négligence : c'est la commande de vérification que ce document prescrit qui
  réécrit le fichier. Elle le refera à chaque exécution, sur le Mac comme dans
  le nuage.
- **Corrigé** : la valeur est remise à `./.next/types/routes.d.ts`, celle d'un
  `next build` ordinaire et de Vercel. Et le §5 porte désormais la remise en
  état **dans** la commande de vérification, pas en note de bas de page.
- **Ce que j'ai corrigé DANS le document, parce qu'il était en tort.** Le §5
  affirmait qu'un `next-env.d.ts` pointant sur `.next-verif/` fait échouer
  « un `tsc` sur un clone neuf ». **C'est faux.** Mesuré, dans le sens
  inverse — valeur `./.next/types/` et dossier `.next/` absent du disque :

  ```
  $ grep -n routes.d.ts next-env.d.ts
  3:import "./.next/types/routes.d.ts";
  $ ls -d .next
  ls: cannot access '.next': No such file or directory
  $ npx tsc --noEmit
  TSC EXIT=0
  (zéro ligne de sortie)
  ```

  Deux raisons, dont la seconde est décisive : TypeScript tolère l'import sans
  effet d'un chemin absent dans un fichier de déclaration, et `tsconfig.json`
  **inclut explicitement les deux** dossiers (`.next/types/**/*.ts` et
  `.next-verif/types/**/*.ts`). Le vrai coût du va-et-vient est du bruit de
  diff, pas une panne. La règle reste — la valeur du dépôt doit être celle de
  Vercel — mais pour la bonne raison. Une justification fausse finit par faire
  abandonner une règle juste.
- **Vérifié sur ce head** (`1360559`, qui touche l'app web : trois routes
  neuves sous `/api/clubs/[clubId]/soirees/`, et la page de production
  `app/c/[slug]/sessions/[id]/page.tsx` dont le « mot de la soirée » part dans
  `lib/soiree.ts` pour être partagé avec le mobile) :

  ```
  $ cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  BUILD EXIT=0

  $ cd five-scorer-mobile && npx tsc --noEmit
  tsc mobile=0

  $ npm run tester
        Tests  184 passed (184)
  ```

- **Fichiers touchés** : `/home/user/diamesene02/five-scorer/next-env.d.ts`
  (remis à la valeur de Vercel) et
  `/home/user/diamesene02/five-scorer/MOBILE.md` (§5 corrigé + cette entrée).
- **Reste ouvert** : le « mot de la soirée » sort d'une page en production vers
  `lib/soiree.ts`. Le build passe, mais **rien ne prouve que le texte produit
  soit identique** à celui d'avant — c'est un copier-coller de logique, et il
  n'a pas de test. Un test de `lib/soiree.ts` sur une soirée témoin serait le
  bon filet ; il n'exige ni Mac ni téléphone, donc une exécution du nuage peut
  le poser.

### 2026-09-09 20:2x — Étape 12 : les trois GET restants, et un Postgres dans le nuage

- **État** : étape 12 `à faire → fait`
- **Ce que j'ai trouvé en entrant, et qui n'était pas cassé.** Conteneur neuf :
  aucun `node_modules` des deux côtés. Réinstallés, puis les vérifications
  existantes lancées AVANT d'écrire une ligne — tout était vert, il n'y avait
  rien à réparer côté code :

  ```
  $ cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  ƒ Proxy (Middleware)   [exited with code 0]

  $ cd five-scorer-mobile && npx tsc --noEmit && npm run tester
   Test Files  12 passed (12)
        Tests  184 passed (184)
  ```

- **La découverte qui change ce qu'un agent peut vérifier ici : il y a un
  PostgreSQL 16 dans le conteneur du nuage.** `/usr/lib/postgresql/16/bin/`
  existe, `initdb` et `pg_ctl` fonctionnent (sous l'utilisateur `postgres`, pas
  root). Jusqu'ici les endpoints serveur ne se vérifiaient que par « le build
  passe », c'est-à-dire par la compilation — pas par une réponse. Maintenant :

  ```
  $ su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/pgdata -U fivescorer --auth=trust"
  $ su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/pgdata -o '-p 5433 -k /tmp' start"
  server started
  $ npx prisma migrate deploy
  All migrations have been successfully applied.
  ```

  Le `.env` local (jamais commité) pointe sur `postgresql://fivescorer@localhost:5433/five_scorer`.
- **Ce que j'ai écrit** : les trois GET de la V1 (§3.4), et de quoi les
  vérifier. Deux scripts nouveaux, tous deux dans `five-scorer-mobile/scripts/` :
  `jeu-dessai.mjs` fabrique un compte, un club, douze joueurs, une soirée avec
  sa compo, un match terminé et un match en direct ; `parcours-lecture.mjs`
  rejoue ce que l'app appelle, cookie à la main comme en React Native.
  `prisma/seed.ts` ne sème rien (« chaque club se crée depuis l'app »), donc
  sans jeu d'essai il n'y a rien à lire, donc aucune vérification honnête.
- **Vérifié par** :

  ```
  $ cd five-scorer-mobile && node scripts/jeu-dessai.mjs
  { "clubId": "VJU443BGjj3FqUNqYEuPaS5JFQuXdpZe", "joueurs": 12, … }

  $ node scripts/parcours-lecture.mjs
    ok   « y a-t-il déjà un match ouvert ? » → un seul, et il est LIVE  — 1
    ok   un statut inconnu est REFUSÉ, pas ignoré  — HTTP 400
    ok   le joueur qui a changé de camp garde son équipe de départ  — A → B
    ok   l'ordre est celui de la SAISIE, pas celui des minutes  — dernier : HALF_TIME (minute 6)
    ok   mon vote est rendu  — joueur-essai-1
    ok   …mais aucun votant n'est nommé
    ok   les douze joueurs de la compo  — 12
    ok   anonyme sur matches : 401  — HTTP 401
    ok   matches/match-essai-fini : 404, pas 403  — HTTP 404
  TOUT VERT        (39 vérifications)

  $ cd five-scorer && NEXT_DIST_DIR=.next-verif npx next build
  ├ ƒ /api/clubs/[clubId]/matchdays/[matchDayId]/lineup
  ├ ƒ /api/clubs/[clubId]/matches
  ├ ƒ /api/clubs/[clubId]/matches/[matchId]
  [exited with code 0]

  $ cd five-scorer-mobile && npx tsc --noEmit && npm run tester
   Test Files  12 passed (12)
        Tests  184 passed (184)
  ```

- **La contre-épreuve.** Deux gardes retirés, un à la fois, pour voir les
  vérifications tomber — sans ça, « TOUT VERT » ne dit rien :

  ```
  # 1) le contrôle du statut désactivé
  ÉCHEC  un statut inconnu est REFUSÉ, pas ignoré  — HTTP 500
  # 2) les votes bruts remis dans la réponse
  ÉCHEC  …mais aucun votant n'est nommé
  2 ÉCHEC(S)        puis restauration, revérifiée : TOUT VERT
  ```

  **Et elle a corrigé un commentaire que j'avais écrit faux** : je pensais que
  sans le garde, `?status=LVE` rendrait tous les matchs. Non — Prisma refuse la
  valeur d'énumération et le serveur rend **500**. C'est pire que ce que je
  croyais : un 500 est compté comme une panne par la relance exponentielle de
  l'app, donc réessayé en boucle, donc jamais vu. Le commentaire du code dit
  maintenant ce qui se passe vraiment.
- **Ce qui a surpris, et qui était cassé — réparé :**
  1. **`pnpm test:api` n'existe pas.** Le critère de terminé de l'étape 12 (et
     celui de l'étape 9) l'exigeait ; il n'y a aucun script de ce nom dans
     `package.json`, ni le moindre `*.test.ts` côté web. L'étape 9 avait dû
     s'en passer en silence. Le plan dit désormais la vérité, et nomme la
     commande qui existe.
  2. **`next-env.d.ts` était commité cassé depuis l'étape 9** (`399a0b9`) : il
     pointait sur `./.next-verif/types/routes.d.ts`, un dossier de vérification
     **gitignoré**, absent du Mac comme de Vercel. Sans effet sur la production
     (`next build` réécrit le fichier avant de typer), mais faux. Remis à
     `./.next/types/routes.d.ts`, et le §5 explique le piège : la variable
     `NEXT_DIST_DIR` protège le `.next` du `dev`, elle ne garde **pas** l'arbre
     propre, contrairement à ce que ce document affirmait.
  3. **Le hook `afterCreateOrganization` crée déjà le profil joueur du
     fondateur** (`lib/auth.ts:106`). Le jeu d'essai le recréait et se heurtait
     à `@@unique([clubId, userId])`. Bonne nouvelle déguisée en mur : la règle
     « un compte, un joueur par club » tient vraiment.
  4. **Anonyme sur `/api/clubs/**`, c'est 401, pas 404.** `middleware.ts`
     répond avant tout handler. Le 404 « ne pas confirmer l'existence du club »
     ne concerne donc que l'utilisateur **connecté mais non membre** — d'où le
     second compte du jeu d'essai, sans quoi cette garantie n'était pas testée.
- **Fichiers touchés** :
  - `five-scorer/app/api/clubs/[clubId]/matches/route.ts` (GET ajouté ; le POST n'est pas touché)
  - `five-scorer/app/api/clubs/[clubId]/matches/[matchId]/route.ts` (GET ajouté ; PATCH et DELETE ne sont pas touchés)
  - `five-scorer/app/api/clubs/[clubId]/matchdays/[matchDayId]/lineup/route.ts` (nouveau)
  - `five-scorer/next-env.d.ts` (réparation)
  - `five-scorer/MOBILE.md` (étape 12, §5, cette entrée)
  - `five-scorer-mobile/scripts/jeu-dessai.mjs`, `five-scorer-mobile/scripts/parcours-lecture.mjs` (nouveaux)
- **Reste ouvert** :
  - **Aucun écran n'utilise encore ces trois endpoints.** Ils sont servis et
    vérifiés, pas branchés. C'est l'étape 15 et les lots du 19+ qui les
    consommeront — et une autre session travaille en parallèle sur la parité
    des écrans (`b76df9b`, `1fa69bd`, `7e9427f`) ; son entrée de journal, juste
    en dessous, raconte ses dépendances. Les deux se sont croisées dans ce
    fichier : conflit résolu à la main, aucune des deux entrées perdue.
  - **Rien n'a été lancé sur un appareil ni dans un simulateur**, comme
    toujours depuis le nuage.
  - Le point 5 du §6 (les photos des joueurs) n'a toujours pas sa mesure : la
    feuille de match ne renvoie **pas** les photos, c'est l'effectif qui les
    porte. Le choix reste entier.

### 2026-09-09 19:3x-20:0x — Les dépendances de la soirée, vérifiées une par une

- **État** : aucune étape touchée. Cette entrée existe parce que la règle 4 du
  §5 l'exige, pas parce qu'un travail a avancé.
- **Ce qui s'est passé.** Trois dépendances sont entrées dans `package.json` ce
  soir, poussées par la session qui travaille sur le Mac, sans qu'aucune ligne
  de ce document ne les mentionne. Le tableau ci-dessous est le contrôle exigé
  par la contrainte structurante du §1 — Expo Go n'exécute que ses propres
  modules, donc chaque bibliothèque doit être classée avant d'être crue.

  | dépendance | commit | nature | Expo Go |
  |---|---|---|---|
  | `@react-native-community/datetimepicker@9.1.0` | `b76df9b` | module natif tiers | **inclus** (voir la citation ci-dessous) |
  | `react-native-svg@15.15.4` | `7e9427f` | module natif tiers | **inclus** — Expo le documente en `sdk/svg/`, le code natif est déjà dans l'app Expo Go |
  | `@react-navigation/bottom-tabs@^7.18.18` | `7e9427f` | **JavaScript pur** | sans objet — aucun code natif à embarquer ; ses besoins natifs (`react-native-screens`, `react-native-safe-area-context`) étaient déjà là, et expo-router est lui-même bâti sur React Navigation |

  **Conclusion : le développement dans Expo Go n'est pas cassé.** Aucune des
  trois n'impose un development build.

  Une réserve à garder en tête, pas un problème aujourd'hui :
  `@react-navigation/bottom-tabs` est la seule dépendance du projet épinglée
  avec un **caret** (`^7.18.18`). expo-router embarque sa propre version de
  React Navigation ; le jour où le caret laissera passer une majeure
  divergente, le symptôme sera un doublon de paquet, pas une erreur de
  compilation. À figer si ça arrive.

- **Vérifié pour datetimepicker** : la documentation Expo le liste comme
  **inclus dans Expo Go**
  (`https://docs.expo.dev/versions/latest/sdk/date-time-picker/` : « The module
  is part of Expo Go. However, Expo Go may not contain the latest version of
  the module and therefore, the newest features and bugfixes may not be
  available. »).
- **Vérifié sur chaque head**, à chaque arrivée, après `npm install` :

  ```
  $ cd five-scorer-mobile && npx tsc --noEmit
  (aucune sortie, code 0)

  $ npm run tester
   Test Files  12 passed (12)
        Tests  184 passed (184)
  ```

  Et sur le commit `1fa69bd`, qui touchait l'app web (route
  `/api/clubs/[clubId]/accueil`, barème du classement sorti de
  `components/Classement.tsx` vers `lib/classement.ts`), le contrôle qui prime
  sur tous les autres :

  ```
  $ cd five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  ƒ Proxy (Middleware)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  [exited with code 0]
  ```

  La production ne bouge pas. Le réexport de `points` et `trierParPoints`
  depuis `Classement.tsx` garde les appelants existants du site intacts —
  c'était la bonne façon de faire : une route serveur n'a pas à importer un
  composant client pour trier six lignes.

- **Ce que je n'ai PAS pu vérifier**, et il ne faut pas le croire vérifié :
  **que `9.1.0` et `15.15.4` soient bien les versions qu'`expo install` choisit
  pour le SDK 57.** Le classement Expo Go ci-dessus, lui, ne dépend pas de la
  version ; c'est l'accord de version qui reste non mesuré. La commande qui le
  dit interroge l'API de versions d'Expo, et le proxy de sortie de ce conteneur
  la refuse :

  ```
  $ npx expo install --check
  Error: HTTP Proxy Network Error: Forbidden
  ```

  Le risque est réel mais petit : Expo Go embarque **sa** version du module, et
  une version épinglée trop récente se traduit par un écart de comportement
  entre Expo Go et le build natif, pas par un plantage au démarrage. **À faire
  sur le Mac, en une commande** : `npx expo install --check` dans
  `five-scorer-mobile/`, et suivre ce qu'il propose.
- **Fichiers touchés** : `/home/user/diamesene02/five-scorer/MOBILE.md`
  (cette entrée). Aucun code.
- **Reste ouvert** : le journal du commit `b76df9b` lui-même — l'autre session
  n'a pas encore écrit son entrée pour les écrans refaits ; celle-ci ne la
  remplace pas et ne raconte que la dépendance.

### 2026-09-09 18:1x — Étape 11 : les actions de match sur SQLite

- **État** : à faire → **fait**
- **Vérifié par** (depuis `five-scorer-mobile/`) :

  ```
  $ npx vitest run localMatch
   RUN  v4.1.11 /home/user/diamesene02/five-scorer-mobile
   Test Files  1 passed (1)
        Tests  54 passed (54)
     Duration  843ms

  $ npx tsc --noEmit
  (aucune sortie, code 0)

  $ npm run tester
   Test Files  12 passed (12)
        Tests  184 passed (184)
  ```

  Et les vérifications d'entrée d'exécution, lancées AVANT d'écrire une ligne —
  rien n'était cassé, il n'y avait donc rien à réparer :

  ```
  $ npx tsc --noEmit && npm run tester      # five-scorer-mobile/
   Test Files  11 passed (11)
        Tests  130 passed (130)

  $ npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build   # five-scorer/
  ƒ Proxy (Middleware)
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  [exited with code 0]
  ```

- **La contre-épreuve des deux tests exigés.** Un test qui passe du premier coup
  ne prouve rien tant qu'on ne l'a pas vu échouer. Les deux règles qu'il garde
  ont donc été retirées du code, une à la fois, et le test relancé :

  ```
  # 1) addEvent sorti de sa transaction (l'écriture métier ne peut plus être annulée)
  $ npx vitest run localMatch
       × ni l'un ni l'autre, quand l'écriture de la file échoue 14ms
        Tests  1 failed | 53 passed (54)

  # 2) les trois gardes « Match terminé » retirés (3 occurrences)
  $ npx vitest run localMatch
       × un but est refusé, et ne laisse rien derrière lui 12ms
       × un changement de camp est refusé 4ms
       × un retardataire est refusé 3ms
        Tests  3 failed | 51 passed (54)

  # puis restauration, vérifiée par diff : « local.ts restauré à l'identique »
  ```

  Le premier test injecte une `BaseCapricieuse` qui refuse tout
  `INSERT INTO outbox` : le but est saisi, l'enfilage échoue, et on regarde ce
  qui reste sur le disque. Zéro événement, score inchangé, file réduite à la
  seule création du match faite avant. C'est l'annulation qu'on voulait voir,
  pas le chemin heureux.

- **Fichiers touchés** :
  - `/home/user/diamesene02/five-scorer-mobile/lib/match/tables.ts` (530 l., neuf)
  - `/home/user/diamesene02/five-scorer-mobile/lib/match/local.ts` (778 l., neuf)
  - `/home/user/diamesene02/five-scorer-mobile/lib/match/localMatch.test.ts` (1025 l., neuf)
  - `/home/user/diamesene02/five-scorer/MOBILE.md` (étape 11 + cette entrée)

  Rien d'autre. **Aucun fichier de `five-scorer/` n'a été modifié** : le build
  Next vérifié en début d'exécution vaut donc encore au commit.

- **Comment c'est découpé.** Le plan autorisait deux exécutions (lecture puis
  écriture) ; une a suffi, parce que la coupure utile n'était pas là. Le SQL est
  parti dans `lib/match/tables.ts` — les cinq tables, la conversion
  serpent_minuscule ↔ casseChameau à un seul endroit — et la logique portée dans
  `lib/match/local.ts`. C'est exactement le partage `outbox.ts` / `sync.ts` de
  l'étape 7, et pour la même raison : la machine à états doit se relire comme
  une machine à états.

- **Ce qui a surpris** :
  1. **`getLocalMatch` ne doit PAS être mis en transaction**, et c'est
     contre-intuitif. La première version enveloppait les trois lectures pour
     qu'elles voient le même instant. Mais `base.transaction()` est
     *exclusive* — `BEGIN IMMEDIATE` côté Node, `withExclusiveTransactionAsync`
     côté expo-sqlite — donc un **verrou d'écriture pris à chaque re-rendu** de
     l'écran de match, avec le drain de l'outbox qui attend derrière chaque
     affichage. Le web lisait déjà en `Promise.all` hors transaction. Corrigé
     avant le premier commit : un affichage peut être en retard d'un but, il ne
     peut pas être faux.
  2. **Le `put` de Dexie efface les champs absents**, et deux colonnes en
     dépendaient. `createMatch` écrit la feuille sans les trois colonnes du
     chrono ; il fallait donc que `ecrireMatch` soit un `INSERT OR REPLACE`
     complet qui les remette à leur défaut (`0`, `NULL`, `1`), et pas un
     `UPDATE` partiel. Les deux formes sont désormais séparées dans
     `tables.ts` (`ecrire*` remplace, `maj*` ne touche que les colonnes
     nommées) et l'entête du fichier dit pourquoi les confondre coûte un score.
  3. **`saveRoster` côté web perd les photos** : son type d'entrée n'a pas de
     champ `photo`, donc le cache Dexie n'a jamais de visage — alors que
     `getLocalMatch` lit `photo` et que §3.3 veut les visages au bord du
     terrain. Le champ a été ajouté en optionnel côté mobile (écart assumé,
     additif : à entrée identique, comportement identique). Ce n'est pas une
     correction du web ; c'est une ligne de plus pour le §6 si Ibrahima décide
     que la PWA doit aussi les cacher.
  4. **`undoLastGoalOf` demandait un départage explicite.** Dexie prenait
     `.last()` sur l'index `[matchId+createdAt]` : à horodatage égal, l'ordre
     retombait sur la clé primaire. En SQL, l'ordre serait celui du plan de
     requête, c'est-à-dire aucun. D'où `ORDER BY created_at DESC, id DESC` —
     et son miroir `created_at ASC, id ASC` pour la chronologie, parce que
     `sortBy` de Dexie est un tri stable.
  5. Le chiffre du plan est juste : 707 lignes à la source (recompté), 1 308
     lignes portées en deux fichiers — l'écart est du commentaire et de
     l'interface de tables, pas de la logique en plus.

- **Reste ouvert** :
  - **La mesure des photos n'est pas faite** (ligne 5 du §6, « les photos des
    joueurs »). Elle exige un appareil : 14 data-URL de ~20 ko rematérialisées à
    chaque but, ça se mesure à l'œil et au profileur, pas dans un conteneur.
    Ce qui est fait ici la rend possible : `lireJoueurs` est le seul endroit qui
    remonte `photo`, donc le jour où il faut sortir la colonne de la requête
    live, il y a **un** endroit à changer.
  - **Aucune de ces fonctions n'a tourné sur expo-sqlite**, seulement sur le
    même moteur dans Node (SQLite 3.51.2). L'écart est l'asynchronisme réel de
    `BaseExpo` ; il joue dans le bon sens (une base qui sérialise passe a
    fortiori les séquences testées ici), mais il n'est pas *vérifié*. Il le sera
    au premier écran de match, à l'étape 14.
  - **Le chrono n'est pas porté.** `clock_elapsed_ms`, `clock_running_since` et
    `period` existent en colonnes, avec leurs défauts, et `lib/noyau/clock.ts`
    sait les dériver — mais aucune fonction ne les *écrit* : côté web, c'est
    l'écran live qui le fait, pas `localMatch.ts`. Ça vient avec l'étape 14
    (« l'horloge »), pas avant.
  - Prochaine étape faisable depuis le nuage : **12** (les 3 GET serveur
    restants de la V1). L'étape **13** (écran « nouveau match ») en dépend pour
    les données, mais pas pour être écrite.

### 2026-09-09 16:1x — Étape 8 : la fonction d'appel authentifié

- **État** : à faire → **fait**
- **Vérifié par** (depuis `five-scorer-mobile/`) :

  ```
  $ npx vitest run appel
  Test Files  1 passed (1)
       Tests  17 passed (17)

  $ npx tsc --noEmit
  tsc EXIT=0

  $ npm run tester
  Test Files  11 passed (11)
       Tests  130 passed (130)

  $ npx expo export --platform ios
  ios bundles (1): _expo/static/js/ios/entry-ba91913189e9f0f9936240d7048318cd.hbc (2.7MB)
  Exported: dist
  EXPORT EXIT=0

  $ cd ../five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  next build EXIT=0
  ```

- **Fichiers touchés** :

  ```
  five-scorer-mobile/lib/appel.ts        (nouveau — le cœur, sans une ligne d'Expo)
  five-scorer-mobile/lib/appel.test.ts   (nouveau — 17 tests, fetch de papier)
  five-scorer-mobile/lib/api.ts          (modifié — délègue, et expose lireCookie)
  five-scorer/MOBILE.md
  ```

**Ce qui a surpris, et qui corrige ce document.**

**L'étape 8 était déjà écrite — mais pas testable, ce qui n'est pas la même
chose que faite.** `appelAuthentifie` existait dans `lib/api.ts` depuis
l'étape 10 (poussée avant elle, le plan n'ayant pas été suivi dans l'ordre) et
faisait déjà les bonnes choses. Seulement `lib/api.ts` importe `expo-constants`
et `expo-linking` à sa deuxième ligne pour deviner l'adresse du serveur : le
fichier ne se charge pas dans Node, donc pas dans Vitest, donc pas dans le
nuage. Le critère de l'étape — « vert avec `fetch` moqué » — était
**inatteignable sans déplacer le code**. La règle 2 du §5 (« une étape dont la
commande n'a pas été lancée reste `en cours` ») a tranché : le cœur est parti
dans `lib/appel.ts`, où rien n'est deviné et tout est passé en paramètre. C'est
le procédé de `creerDrain(deps)`, adopté pour exactement la même raison à
l'étape 7.

**Le vrai test n'est pas celui que le plan nommait.** « Présence de l'en-tête
`cookie` » passe aussi quand on a oublié le `await` sur `getCookie()` : l'en-tête
est bien là, il contient `[object Promise]`, et le serveur répond 401. Ce 401
est le plus trompeur du projet — il est indiscernable, à l'écran, d'une session
réellement expirée, et il renvoie l'utilisateur vers un formulaire de connexion
qui ne réparera rien. Le test posé ici vérifie donc le **type** de ce qui atterrit
dans l'en-tête, avec un lecteur de cookie volontairement lent. Le journal du 9
septembre 10:4x avait déjà nommé ce piège ; il est maintenant tenu par un test
plutôt que par la mémoire.

**Écarts assumés au plan.**

- **`needsAuth` n'a pas été créé.** Le plan l'écrit en anglais et au conditionnel ;
  la chose existe déjà sous le nom `SessionExpiree`, `app/clubs.tsx` la lit déjà,
  et le drain a déjà son `reconnexionRequise`. Ajouter un troisième nom pour le
  même fait aurait fabriqué la divergence que ce document passe son temps à
  éviter.
- **Une classe `ErreurServeur`**, non prévue. `throw new Error("Le serveur a
  répondu 403.")` perd le code : l'appelant doit relire une phrase française
  pour prendre une décision de machine, et `encaisserEchec` du drain lit
  précisément `err.status` pour trancher réessayable / définitif. Le `status`
  est donc porté par l'objet. Elle recopie aussi le `{"error": "..."}` de nos
  routes dans le message — nos handlers en posent un partout (vérifié dans
  `app/api/clubs/`), et « 400 — Aucun joueur » dit quoi corriger là où « 400 »
  ne dit rien.
- **`lireCookie()` est extraite de la fonction d'appel.** L'étape 7 avait laissé
  ouvert « le câblage sur `authClient.getCookie()` se fera à l'étape 8 » :
  `Dependances.cookie` du drain attend exactement cette signature
  (`() => Promise<string | null>`), et c'est la même fonction qu'on lui passera
  à l'étape 11. Deux lecteurs de cookie, c'étaient deux façons de se tromper.
- **Trois tests lisent `lib/api.ts` en texte** plutôt qu'en module, puisqu'il
  n'est pas importable ici. Ils vérifient qu'il appelle bien `creerAppel`, qu'il
  ne repose plus lui-même `credentials`, et qu'il ne parle à `fetch` que par
  `joindre`. Sans eux, les seize autres testeraient un code que l'app
  n'exécuterait plus — le procédé est celui de `copie-conforme.test.ts`. Le
  premier jet cherchait le mot « credentials » dans le fichier entier et
  rougissait sur un **commentaire** qui explique le contrat : le test ignore
  désormais les lignes de commentaire, faute d'interdire d'expliquer le code
  qu'il protège.

**Ce qui n'a PAS été fait, et pourquoi.**

- **Pas de délai maximal sur l'appel authentifié.** Le drain coupe ses rejeux à
  8 s (`DELAI_REJEU_MS`) ; les lectures de l'app, elles, peuvent pendre tant que
  le système le veut — Mac éteint, Wi-Fi du gymnase. C'est un vrai défaut, mais
  ce n'est pas cette étape, et un écran qui l'affiche n'existe pas encore.
  À reprendre à l'étape 13.
- **Rien n'a été lancé sur un appareil.** Le `fetch` de ces tests est en papier :
  ils prouvent la forme de la requête, pas que le trousseau rende le bon cookie
  sur un iPhone. Cette preuve-là est du 9 septembre 10:4x (cookie de 1 084 octets
  délivré et rejoué en HTTP direct), et elle n'a jamais eu lieu dans Expo Go.

- **Reste ouvert** :
  - **Ce que le plan appelle « la V1 » est à trois étapes** : 11 (porter
    `localMatch.ts`), 12 (les 3 GET restants), 13 (l'écran « nouveau match »).
    L'étape 11 est la prochaine faisable depuis le nuage, et c'est la plus
    grosse du plan (707 lignes, 41 appels Dexie, 9 transactions) : elle est
    explicitement prévue pour être coupée en deux exécutions.
  - Le drain n'est toujours instancié nulle part : `lireCookie` existe, personne
    ne la lui passe encore. Ce câblage vient avec le premier écran qui écrit.
  - Étape 17 toujours `bloqué` (EAS Build depuis une machine connectée au
    compte — hors de portée du nuage), étape 18 idem (simulateur iOS).

### 2026-09-09 14:2x — Étape 7 : le drain de l'outbox

- **État** : à faire → **fait**
- **Vérifié par** (depuis `five-scorer-mobile/`) :

  ```
  $ npx vitest run sync
  Test Files  1 passed (1)
       Tests  13 passed (13)

  $ npx tsc --noEmit
  tsc EXIT=0

  $ npm run tester
  Test Files  10 passed (10)
       Tests  113 passed (113)

  $ npx expo export --platform ios
  ios bundles (1): _expo/static/js/ios/entry-….hbc (2.7MB)
  Exported: dist
  EXPORT EXIT=0

  $ cd ../five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  next build EXIT=0
  ```

- **Fichiers touchés** :

  ```
  five-scorer-mobile/lib/outbox/types.ts        (nouveau — tranche copiée de five-scorer/lib/db.ts)
  five-scorer-mobile/lib/outbox/types.test.ts   (nouveau — la copie ne peut plus diverger en silence)
  five-scorer-mobile/lib/outbox/base.ts         (nouveau — l'interface Base, quatre méthodes)
  five-scorer-mobile/lib/outbox/baseExpo.ts     (nouveau — expo-sqlite, le téléphone)
  five-scorer-mobile/lib/outbox/baseNode.ts     (nouveau — node:sqlite, les tests)
  five-scorer-mobile/lib/outbox/outbox.ts       (nouveau — la file : SQL, et rien d'autre)
  five-scorer-mobile/lib/outbox/sync.ts         (nouveau — le drain porté de lib/sync.ts)
  five-scorer-mobile/lib/outbox/sync.test.ts    (nouveau — 13 tests)
  five-scorer-mobile/package.json               (+ expo-sqlite ~57.0.2)
  five-scorer-mobile/package-lock.json
  five-scorer/MOBILE.md
  ```

**Ce qui a surpris, et qui corrige ce document.**

**La relance ne part pas à 5 secondes, mais à 10.** Le §3.3 et l'étape 7
annoncent « backoff 5 → 60 s ». En lisant `lib/sync.ts` de près : le compteur
`echecs` est incrémenté **avant** que le `finally` n'appelle
`planifierRelance()`. Après le premier échec réessayable, `echecs` vaut donc
déjà 1 et le délai vaut `5000 × 2¹` = 10 s. Le plancher à 5 s n'est atteint que
lorsqu'un passage se termine **sans** échec en laissant de la file — après un
blocage 403, par exemple. Ce n'est pas un bug : le premier essai a déjà eu lieu
tout de suite. Le portage reproduit ce comportement à l'identique, et le test
`la relance double à chaque échec` fige la table (5, 10, 20, 40, 60, 60 s). Mon
premier test attendait 5 s et échouait ; c'est le test qui avait tort, pas le
code — le vérifier avant de « corriger » le portage a évité d'introduire une
divergence avec le web.

**Le modèle ne se copie pas en entier, et ça se répare par un test.**
`five-scorer/lib/db.ts` importe Dexie à sa 7ᵉ ligne : impossible de le traiter
comme les six fichiers de `lib/noyau/`. Mais les lignes 9 à 196 — les six formes
locales et l'union fermée `OutboxOp` — ne dépendent de rien. Elles sont copiées
**octet pour octet** sous un marqueur, et `types.test.ts` relit la tranche à la
source à chaque exécution : le jour où le web ajoute une opération d'outbox sans
la recopier, le test rougit ici plutôt qu'un but se perd au bord du terrain. Il
vérifie aussi les deux ancres (première et dernière ligne de la tranche), sans
quoi un ajout en tête de `db.ts` ferait glisser la fenêtre en silence.

**Écarts assumés au plan.**

- **Rien n'est global.** Le web tient son état dans des variables de module et
  sa base dans un singleton. Ici, `creerDrain(deps)` rend un drain complet.
  Ce n'est pas de l'élégance : c'est la seule façon d'écrire honnêtement le test
  exigé. « Processus relancé » y est **deux instances successives sur le même
  fichier SQLite** (`mkdtemp` + `node:sqlite`), la première tuée en pleine panne
  réseau — pas une simulation de reprise.
- **`enfiler` est dans cette étape**, alors que le plan la range implicitement
  avec `localMatch.ts` (étape 11). Une file qu'on ne peut pas remplir ne se
  teste pas, et l'insertion est ce qui extrait `match_id` du JSON pour le monter
  en colonne — donc ce dont dépend le blocage en cascade.
- **`expo-sqlite ~57.0.2` ajouté aux dépendances.** Prévu au §3.3 (« Included in
  Expo Go »), pas encore installé. `npx expo export --platform ios` sort en 0
  avec, donc Metro le résout.
- **Une méthode `script()` dans l'interface**, en plus des trois attendues :
  `runAsync` d'expo-sqlite refuse les instructions multiples, c'est `execAsync`
  qui prend le schéma et ses PRAGMA. Découper `schema.sql` sur les `;` aurait
  été le vrai piège — un point-virgule dans un commentaire suffit à tout casser.
- **`transaction()` passe la base au rappel.** Sur expo-sqlite, la transaction
  exclusive est un **autre objet de connexion** : écrire par l'ancien sortirait
  silencieusement de la transaction. Le rappel reçoit donc la bonne `Base`.
  Rien ne s'en sert encore dans le drain — chaque instruction y est atomique à
  elle seule — mais l'étape 11 en aura besoin neuf fois.

**Ce qui n'a PAS été porté, et pourquoi.** `initSync()` du web branche
`window.online/offline` et `visibilitychange`. Ils n'existent pas en React
Native : la couture est `definirEnLigne(bool)`, que NetInfo et `AppState`
appelleront quand il y aura un écran pour l'afficher (étape 14-15). Le drain,
lui, est complet.

- **Reste ouvert** :
  - Rien de l'app n'appelle encore ce drain : `baseExpo.ts` n'est importé par
    aucun écran, donc **il n'a jamais tourné sur un vrai expo-sqlite**. La
    logique est éprouvée sur le même moteur SQLite, pas sur le module natif.
    Le premier appel réel viendra avec l'étape 11.
  - Le drain ne relit pas le cookie autrement que par la fonction qu'on lui
    injecte ; le câblage sur `authClient.getCookie()` se fera à l'étape 8, avec
    son test.
  - Les commits `a1c6e1f` et `63ebdba` (EAS Build, `.nvmrc`, `engines`) ont été
    poussés depuis le Mac **sans entrée de journal** : ils achèvent la sortie
    de l'étape 17 décrite plus bas (le projet nuage `@iniestasene/five-scorer`,
    trois profils dans `eas.json`, les explications dans `five-scorer-mobile/EAS.md`).
    L'étape 17 reste `bloqué` — un build EAS demande de lancer `eas build`
    depuis une machine connectée au compte, ce que le nuage ne peut pas faire.

### 2026-09-09 12:2x — Étape 6 : le schéma SQLite

- **État** : à faire → **fait**
- **Vérifié par** (depuis `five-scorer-mobile/`) :

  ```
  $ node --no-warnings -e "…d.exec(fs.readFileSync('db/schema.sql','utf8'))…"
  MAX(id) = 4
  SQLite  = 3.51.2

  $ npx vitest run db
  Test Files  1 passed (1)
       Tests  19 passed (19)

  $ npx tsc --noEmit
  tsc EXIT=0

  $ npx vitest run
  Test Files  8 passed (8)
       Tests  97 passed (97)

  $ cd ../five-scorer && npx prisma generate && NEXT_DIST_DIR=.next-verif npx next build
  next build EXIT=0
  ```

- **Fichiers touchés** :

  ```
  five-scorer-mobile/db/schema.sql          (nouveau, seule source du schéma)
  five-scorer-mobile/db/schema.ts           (nouveau, généré — ne pas éditer)
  five-scorer-mobile/db/schema.test.ts      (nouveau, 19 tests)
  five-scorer-mobile/scripts/schema-vers-ts.mjs  (nouveau, le générateur)
  five-scorer/MOBILE.md
  ```

**Ce qui a surpris, et qui vaut plus que l'étape elle-même.**

**Le `next build` de ce document échoue dans un conteneur neuf, et ça
ressemble à une régression du code.** Onze erreurs de type dans des fichiers
que je n'ai pas touchés, la première étant `Parameter 'tx' implicitly has an
'any' type` à `app/actions/calendrier.ts:65`. La règle 6 du §5 dit qu'une
régression sur le build arrête tout — j'ai donc arrêté, et cherché. Ce n'en
était pas une : `pnpm build` vaut `prisma generate && next build`, et la
commande de vérification écrite au §5 avait perdu la première moitié. Sans
client Prisma généré, `prisma.$transaction` n'a plus de signature typée et son
callback tombe en `any` implicite. Avec `npx prisma generate` d'abord, le même
build sort en 0. **Le §5 est corrigé dans ce commit** — c'est vingt minutes
rendues à la prochaine exécution, qui repartira elle aussi d'un conteneur vide.

**Il n'y a pas de binaire `sqlite3` dans le nuage.** Le critère de l'étape 6
était écrit pour la ligne de commande `sqlite3`. `node:sqlite` la remplace sans
rien concéder : c'est le même moteur, en 3.51.2, et c'est celui d'expo-sqlite
sur l'appareil. Le critère a été réécrit avec la commande réellement lançable
plutôt que laissé faux.

**Le contre-exemple compte autant que le test.** `AUTOINCREMENT` prouvé par
`MAX(id) = 4` ne dit pas *pourquoi* le mot est là. Le test voisin crée une
table témoin **sans** le mot, rejoue les mêmes trois insertions, la même
suppression — et obtient `3`. C'est ce qu'un `finishMatch` ferait à la place
d'un but déjà parti au serveur.

**Écarts assumés au plan** (le plan disait « les 6 tables, `AUTOINCREMENT`,
`match_id`, `outbox_actives`, WAL » ; tout y est, plus ceci) :

- **`outbox_match (match_id, blocked_at)`.** L'index `outbox_actives` sert le
  drain, pas le blocage en cascade, qui cherche par match. Sans lui, un refus
  403 balaie toute la table.
- **Des `CHECK` sur les unions fermées** de `lib/db.ts` (`'A' | 'B'`,
  `'LIVE' | 'FINISHED'`, les cinq types d'événement, `motmMode`, les booléens).
  Le typage TypeScript s'arrête à la frontière de la base ; ces contraintes
  attrapent la faute de portage à l'écriture, pendant l'étape 11, plutôt qu'au
  bord du terrain. Quatre tests le vérifient — dont un qui vérifie l'inverse :
  un but **sans buteur** doit passer, puisque le score part au premier tap et
  que le nom se choisit après.
- **`UNIQUE (match_id, player_id)` sur `participants`.** La clé primaire est la
  chaîne `"matchId::playerId"` héritée de Dexie ; une clé mal formée par le
  portage aurait glissé un doublon sous le nez de la clé primaire.
- **Aucune clé étrangère**, délibérément. Dexie n'en avait pas et
  `lib/localMatch.ts` s'appuie sur ce fait : le cache local n'est jamais
  « incohérent », seulement en retard. Des FK changeraient le comportement
  porté au lieu de le reproduire.
- **`db/schema.ts`, copie conforme générée.** Metro ne sait pas charger un
  `.sql` sans `babel-plugin-inline-import`, et cette chaîne Babel a un
  historique de casse à chaque montée d'Expo SDK. Plutôt que de l'ajouter, le
  `.sql` reste la seule source et `scripts/schema-vers-ts.mjs` en écrit un
  module TypeScript ordinaire ; le premier test du fichier compare les deux
  octet pour octet. C'est exactement le procédé de `lib/noyau/`, qui a déjà
  fait ses preuves. Le générateur a d'ailleurs refusé sa première exécution :
  mes commentaires SQL contenaient des accents graves, qui auraient cassé le
  littéral gabarit. Ils sont passés en guillemets français.
- **`PRAGMA synchronous = NORMAL`** en plus de WAL : un `fsync` de moins par
  transaction, et sur un but on écrit deux tables.

**Ce qui n'a PAS été fait, et pourquoi.** Aucune couche d'accès, aucune
ouverture de base, aucun `expo-sqlite` installé : c'est l'étape 7, et la règle
« une exécution = une étape » vaut mieux qu'une étape 7 à moitié. Le WAL est
vérifié sur un vrai fichier temporaire (en mémoire, SQLite répond « memory » et
refuse WAL) — mais **jamais dans le bac à sable d'Expo Go**, ce qui reste à
vérifier sur l'appareil.

- **Reste ouvert** : l'étape 7 (le drain de l'outbox sur une couche d'accès
  abstraite) est la suivante, et `db/schema.test.ts` y a déjà posé quatre des
  requêtes qu'elle devra porter. Rien de nouveau pour le §6 — aucune décision
  d'Ibrahima n'a été rencontrée cette fois.

### 2026-09-09 11:xx — Étape 17 : le development build iOS

**Ce qui a été établi avant de compiler**, par cinq enquêtes parallèles sur le
code réellement installé, puis des contre-enquêtes chargées de les réfuter.
Plusieurs conclusions de premier tour étaient fausses ; ce sont les corrections
qui comptent.

**L'origine, le point critique.** Il fallait être certain qu'un development
build annonce `fivescorer://` et non `exp://`, faute de quoi la production le
refuserait exactement comme Expo Go. La documentation d'expo-constants
inquiétait : l'énumération `ExecutionEnvironment` décrit `storeClient` comme
couvrant « Expo Go **ou** un development build avec expo-dev-client », et
`expo-linking/build/Schemes.js` renvoie `'exp'` dans cette branche. C'est faux :
le module natif iOS déclare `"bare"` en dur, hors de toute condition
(`expo-constants/ios/EXConstantsService.m:42`). Un build annonce donc bien son
schéma. `lib/api.ts` s'appuie là-dessus et ne regarde plus `__DEV__`.

**Le serveur n'a besoin d'aucun changement.** `trustedOrigins()` contient déjà
`"fivescorer://"`, et le motif couvre les sous-chemins — mesuré en production :
`fivescorer://`, `fivescorer:///` et `fivescorer://expo-development-client`
reçoivent tous 401, pas 403. Surtout, **ne pas écrire `fivescorer://*`** : le
joker est strictement pire, il rejette `fivescorer://auth/callback`.

**La signature.** Il n'existe pas d'équipe `QLQAFH3Q76` — c'est un identifiant
de certificat. Les deux équipes réelles sont `M283R456KQ` (payante) et
`5B46ZNYDXV` (personnelle, gratuite), vérifiées par le champ OU des
certificats. Expo prend la première identité de sa liste, la gratuite : sans
`ios.appleTeamId`, le build serait signé avec un certificat qui **expire le 14
septembre 2026**. La clé est posée.

**Trente jours, pas un an.** Le certificat de l'équipe payante expire le
**9 octobre 2026**. Le premier rapport annonçait un an ; c'est faux, nous
sommes le 9 septembre. Il faudra relancer un build vers cette date.

**Le bundle identifier devait précéder le prebuild.** Sans lui, le CLI ne pose
aucune question : il déduit `com.<compte Expo>.<slug>` et l'écrit dans
app.json. Ici `com.iniestasene.five-scorer`. Posé à `com.ibc.fivescorer` avant
le premier prebuild — et surtout pas `com.ibc.samacours`, qui aurait remplacé
l'autre app sur le téléphone.

**expo-dev-client n'est pas installé, et c'est délibéré.** Il n'est pas requis :
en Debug, l'AppDelegate du gabarit charge déjà le bundle depuis Metro. Ce qu'il
apporte — menu développeur, changement d'adresse de Metro sans recompiler —
coûte cinq paquets natifs de plus à compiler, sur une machine lente et un
disque saturé. Le build destiné aux lundis est de toute façon un **Release**,
où le dev-client est inerte. À reconsidérer quand on voudra recetter le
hors-ligne en changeant de réseau.

**Debug ou Release, la vraie raison.** Ce n'est pas le choix du serveur —
`lib/api.ts` vise la production dans les deux cas. C'est qu'en Debug le bundle
JS n'est pas embarqué : l'app exige Metro allumé sur le Mac, et l'adresse de
Metro est même gravée dans le binaire (`expo/scripts/react-native-xcode.sh`
écrit un `ip.txt`). Pour emporter l'app au terrain : `--configuration Release`.

**LE BLOCAGE, et il n'est pas contournable sur cette machine.**

Le build local échoue, deux fois, à l'identique — pour le simulateur comme
pour l'appareil :

```
node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h:53
error: 'RuntimeScheduler' cannot be annotated with either SWIFT_RETURNS_RETAINED
or SWIFT_RETURNS_UNRETAINED because it is not returning a SWIFT_SHARED_REFERENCE type
```

Ce n'est pas une erreur de configuration du projet. La phase de build qui
échoue s'appelle « Build ExpoModulesJSI xcframework » : Expo livre bien un
`ExpoModulesJSI.xcframework` précompilé avec toutes les tranches utiles
(`ios-arm64`, `ios-arm64_x86_64-simulator`…), mais `build-xcframework.sh`
recalcule un hash de cache qui inclut `xcrun swiftc --version` **et** les
chemins locaux `PODS_ROOT`/`RN_ROOT`. Le hash ne peut donc jamais correspondre
sur une machine d'utilisateur : la première compilation reconstruit toujours ce
framework depuis les sources. Et cette reconstruction échoue sur le Swift
6.2.4 de Xcode 26.3.

Piste écartée : déclarer `retainRuntimeScheduler` / `releaseRuntimeScheduler`
avant la classe (elles ne le sont qu'après, lignes 95-102, alors que
`SWIFT_SHARED_REFERENCE` est posé ligne 90). Essayé, recompilé : l'erreur
persiste, simplement décalée du nombre de lignes insérées. L'en-tête tiers a
été remis en état.

**Et Xcode ne peut pas être mis à jour ici.** Xcode 26.3 (17C529) exige
macOS 15.6 ; Xcode 26.4, 26.5 et 26.6 exigent tous **macOS 26.2**. Cette
machine tourne sous macOS 15.6 (Darwin 24.6.0). Xcode 26.3 est donc le dernier
qu'elle puisse installer, et c'est exactement celui qui ne sait pas compiler
le SDK 57. Passer outre demanderait une mise à niveau de macOS vers Tahoe 26 —
faisable (Tahoe est le dernier macOS à accepter les Mac Intel) mais c'est un
autre chantier.

Un cas voisin est documenté : expo/expo#47539, « Expo 57 fails to compile on
Xcode 26.3 », même toolchain Swift 6.2.4, erreur différente (`sending 'emitter'
risks causing data races`) mais même famille. Notre erreur exacte n'est
indexée nulle part — c'est cohérent avec le fait que presque plus personne ne
compile Expo SDK 57 sur un Mac Intel sous macOS 15.

**Épilogue : ça marche, et ça confirme le diagnostic.** Le même code, le même
commit (`63ebdba`), compilé par EAS avec un Xcode à jour : build `9727ecbd`,
terminé sans erreur. Le blocage n'était donc bien que la version de Xcode.

L'`.ipa` a été téléchargé et ouvert pour vérification avant toute
installation :

| contrôle | résultat |
|---|---|
| bundle | `com.ibc.fivescorer` — pas `com.ibc.samacours`, l'autre app est intacte |
| signature | `M283R456KQ.com.ibc.fivescorer`, équipe « Diame SENE » (payante) |
| appareils | **un seul**, `00008110-000E54E01A05801E` — l'iPhone de Diame |
| expiration | **4 mars 2027** |
| bundle JS | `main.jsbundle`, 2,6 Mo — embarqué, l'app démarre sans Metro |
| schéma | `fivescorer` — celui que la production accepte |
| ATS | `NSAllowsArbitraryLoads=false`, `NSAllowsLocalNetworking=true` |
| iOS minimum | 16.4, contre 26.2.1 sur l'appareil |

**Correction à une alerte donnée trop tôt.** J'avais annoncé une expiration au
9 octobre 2026 — c'est la date du certificat qui traînait dans le trousseau du
Mac. EAS en a généré un neuf : le profil embarqué court jusqu'au **4 mars
2027**. Il n'y a donc rien à refaire avant dix-huit mois.

**La sortie : bâtir dans le nuage.** `eas.json` est écrit, avec trois profils
(`lundi` en distribution interne pour le terrain, `atelier` qui vise le Mac,
`magasin` pour l'App Store le jour venu). EAS compile avec un Xcode à jour et
rend un `.ipa` installable par lien sur les iPhones enregistrés dans l'équipe.
Reste à décider avec Ibrahima : envoyer le code chez Expo et y confier la
gestion des certificats sont deux actions qui lui appartiennent.

**Les obstacles de la machine, qui ont coûté le plus de temps :**

- **CocoaPods exige une locale UTF-8.** Sans `LANG`, `pod install` meurt sur
  `Unicode Normalization not appropriate for ASCII-8BIT`. Toujours lancer avec
  `LANG=en_US.UTF-8`.
- **Le disque était plein** : 872 Mo libres sur 233 Go. Récupérés : les caches
  npm et pnpm (2 Go), les caches de mise à jour des applications (1,8 Go),
  puis — avec l'accord d'Ibrahima — le contenu des simulateurs et le runtime
  iOS 18.6. 19 Go libres au moment de compiler.
- **Le Mac est un Intel i5-8257U à 1,4 GHz**, 8 fils. Un premier build complet
  s'y compte en dizaines de minutes, pas en minutes.
- **Le port 8081 est occupé par un autre projet.** Un build Debug irait
  chercher son bundle chez le mauvais Metro : `--port 8090`.
- **`expo run:ios` ne relance pas le prebuild** quand `ios/` existe. Toute
  modification d'app.json exige donc un `expo prebuild` explicite — sinon elle
  n'atteint jamais le projet Xcode. C'est ce qui a failli laisser
  `DEVELOPMENT_TEAM` absent après l'ajout d'`appleTeamId`.

### 2026-09-09 10:4x — Étape 10 : la connexion, vérifiée de bout en bout

**Le symptôme.** Sur l'iPhone, dans Expo Go : « Le serveur refuse l'origine
de l'app ». Mon propre message d'erreur, en rouge, sur l'écran de connexion.

**La cause, et elle n'est pas un bug.** `.env.local` ayant disparu, l'app
visait la production. Or `trustedOrigins()` n'ajoute `exp://` et `exps://`
que si `NODE_ENV === "development"` — délibérément : le hook `after` du
plugin serveur recopie l'en-tête `set-cookie`, donc le jeton de session en
clair, dans l'URL de redirection dès que la destination est une origine de
confiance à schéma non-http. Faire confiance à `exp://` en production
donnerait à n'importe quelle app Expo un moyen de récupérer une session.
Le refus est le comportement correct. **Cette ligne ne doit pas bouger.**

Mesuré des deux côtés, avec un compte qui n'existe pas (403 = origine
refusée, 401 = origine acceptée et c'est le mot de passe qui ne va pas) :

| serveur | `exp://` | `exps://` | `fivescorer://` |
|---|---|---|---|
| dev (le Mac) | 401 | 401 | 401 |
| production | **403** | — | 401 |

**Ce qui a changé.** Le défaut de `lib/api.ts` devient le serveur du Mac en
développement (`__DEV__`), la production sinon. Ce n'est pas un confort : en
Expo Go, c'est la seule adresse qui puisse accepter une connexion.

**Le mur suivant, franchi avant qu'il ne se présente.** Le compte réel vit en
production ; la base locale ne le connaît pas. Pointer l'app sur le Mac
aurait donc simplement remplacé « origine refusée » par « mot de passe
incorrect ». `five-scorer/scripts/compte-dev.mjs` crée donc un compte d'essai
sur le club local qui ressemble le plus au vrai (`fc-testeurs` — chasubles
blanc et noir, 10 joueurs, 45 soirées, 16 matchs), le rend `owner`, lui
attache un profil joueur, refuse de tourner si `DATABASE_URL` n'est pas
locale, et se rattrape si un essai précédent a laissé un autre mot de passe
(vérifié en cassant volontairement le hachage : `compte : recréé`).
L'écran de connexion le remplit en un tap, sous `__DEV__`.

**Un cas non couvert, trouvé en relisant.** Avec `expo start --tunnel` —
le recours normal quand le téléphone n'est pas sur le Wi-Fi du Mac —
`hostUri` est un domaine `exp.direct`, pas une IP. L'ancienne réécriture y
recopiait le port 3000 et fabriquait une adresse qui n'existe pas. Et de
toute façon, sous tunnel le serveur local est hors d'atteinte. La fonction,
devenue pure sous le nom `resoudreAdresse`, rend maintenant l'URL intacte
**et** la raison, que l'écran de connexion affiche.

**Ce qui est prouvé, sans téléphone :**

- `scripts/verif-adresse.mjs` — 12 cas de traduction d'adresse, tous verts.
- `scripts/parcours-connexion.mjs` — depuis une origine `exp://` : connexion,
  cookie de session délivré, `/api/me` accepté, l'utilisateur reconnu, le
  club complet avec ses droits calculés côté serveur et ses jetons de thème,
  la vitrine publique du même club, et le **401 attendu sans cookie**.
- Le bundle Metro compile pour les deux plateformes : iOS 6360 Ko,
  Android 7050 Ko, HTTP 200.
- Le Mac est joignable depuis le Wi-Fi : `192.168.1.192:3000` (Next) et
  `:8090` (Metro), 200 tous les deux.

**Ce qui reste vrai et qu'il faut redire :** la base locale est une réplique,
pas le vrai club. Pour voir les vraies données sur le téléphone, il faut un
development build (étape 17) : son schéma `fivescorer://` est, lui, une
origine de confiance en production.

Commit `a4bd614` sur `mobile`.

### 2026-09-09 10:1x — Étape 5 : le noyau pur, et le premier filet de tests

- **État** : étape 5 `à faire → fait`
- **Vérifié par** :
  ```
  $ cd five-scorer-mobile && npx vitest run
   RUN  v4.1.11 /home/user/diamesene02/five-scorer-mobile

   Test Files  7 passed (7)
        Tests  78 passed (78)
     Duration  693ms

  $ npx tsc --noEmit
  (aucune sortie, code 0)

  $ cd ../five-scorer && pnpm build
  (…) ƒ Proxy (Middleware) — code 0

  $ for f in clock.ts ids.ts theme.ts color.ts balance.ts retro.ts; do \
      diff -q ../five-scorer/lib/$f lib/noyau/$f && echo "identique: $f"; done
  identique: clock.ts
  identique: ids.ts
  identique: theme.ts
  identique: color.ts
  identique: balance.ts
  identique: retro.ts
  ```
- **Fichiers touchés** :
  - `five-scorer-mobile/lib/noyau/{clock,ids,theme,color,balance,retro}.ts` (copies conformes, 626 lignes)
  - `five-scorer-mobile/lib/noyau/{clock,ids,color,theme,balance,retro,copie-conforme}.test.ts` (nouveaux)
  - `five-scorer-mobile/lib/noyau/LISEZ-MOI.md` (nouveau — la règle « on ne modifie jamais ici »)
  - `five-scorer-mobile/vitest.config.mts` (nouveau), `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`
  - `five-scorer/MOBILE.md`
- **Ce qui a surpris** :
  1. **Vitest 5 est inaccessible sur ce projet, et pas pour la raison qu'on croit.** `better-auth@1.7.1` déclare un peer *optionnel* `vitest@"^2 || ^3 || ^4"`. npm 10.9.7 charge quand même ce peer, résout `vitest@*` vers 5.0.0, va chercher `@vitest/browser-playwright@5.0.0` et **plante dans arborist** : `Cannot read properties of null (reading 'edgesOut')` — un message qui ne nomme ni vitest ni better-auth. Le plantage survient à toute installation dès que vitest entre dans l'arbre, y compris après suppression de `node_modules` et du lockfile. **Correctif retenu : `"overrides": { "vitest": "4.1.11" }` dans `five-scorer-mobile/package.json`**, sans `--force` ni `--legacy-peer-deps`. À relire le jour où on montera `better-auth` (étape X) : l'override pourra probablement sauter.
  2. **La réinstallation propre du mobile a fait bouger 6 versions transitives** : `hermes-parser`/`hermes-estree` 0.35.0 → 0.36.1, `babel-plugin-syntax-hermes-parser` 0.36.0 → 0.36.1, `kysely` 0.28.17 → 0.29.5, `node-releases`, `picomatch`, `react-is`. Toutes dans les fourchettes déclarées, toutes dans `five-scorer-mobile/` — **rien n'a touché le dépôt web ni la production**. `kysely` est une dépendance de `better-auth` que le client Expo n'exécute pas. `tsc` et les 78 tests sont verts derrière.
  3. **Le noyau porté est en `lib/noyau/`, pas à plat dans `lib/`.** Le plan disait `mobile/lib/`. À plat, rien ne distinguait un fichier qu'on ne doit **jamais** éditer (copie du web) d'un fichier propre au mobile (`api.ts`, `auth-client.ts`, `couleurs.ts`). Le sous-dossier + `copie-conforme.test.ts` rendent la règle exécutable : si le web bouge et qu'on ne recopie pas, `npm run tester` le dit à la prochaine exécution.
  4. **Contradiction relevée, non tranchée par moi.** `lib/couleurs.ts` (écrit à l'exécution précédente) dit que les jetons de thème « sont calculés côté serveur, la règle ne doit exister qu'à un seul endroit ». Le §3.5 de ce document dit l'inverse : « ces 366 lignes se copient verbatim », avec un `ThemeProvider` maison. Les deux se justifient et ne servent pas le même cas : le serveur suffit tant qu'on est connecté, la copie locale est indispensable pour peindre un écran **sans réseau**. Elles cohabitent aujourd'hui sans conflit (aucun écran n'utilise encore `lib/noyau/theme.ts`). **À trancher par Ibrahima quand l'étape 13 ou 14 arrivera** : soit le serveur reste la source et on met les jetons en cache SQLite au bootstrap (endpoint 2 du §3.4), soit le mobile recalcule tout localement depuis les deux chasubles. Ligne ajoutée au §6.
  5. **Aucune assertion n'a dû être assouplie.** Les 78 tests sont passés au premier lancement, y compris les planchers de contraste (Lc 60 pour l'encre, Lc 30 pour la bande) sur une chasuble marine `#001A4D`, et l'écart d'équilibrage `≤ 1` sur 20 seeds.
- **Reste ouvert** :
  - Rien n'a été lancé sur un appareil, ni dans Expo Go, ni sur simulateur. Ces 78 tests tournent en Node : ils prouvent la logique, pas le rendu.
  - `npx expo export --platform ios` n'a **pas** été lancé (ce n'est pas le critère de l'étape 5) : le bundle Metro n'est donc pas prouvé depuis cette exécution.
  - **Travail en parallèle, fusionné après coup.** Cette exécution est partie de `2efaba8` ; pendant qu'elle tournait, trois commits sont arrivés sur `mobile` (`a4bd614`, `e27fafd`, `399a0b9`) et ont terminé l'étape 9. Fusion faite ici, un seul conflit — deux entrées de journal du même jour dans `MOBILE.md` — résolu en gardant les deux, la plus récente en haut. Aucun des six fichiers du noyau n'a bougé côté web entre-temps : `copie-conforme.test.ts` est vert après la fusion. **Leçon pour la prochaine exécution : refaire `git pull --ff-only origin mobile` juste AVANT de commiter, pas seulement au démarrage.**
  - La prochaine étape naturelle est la **6** (schéma SQLite), entièrement faisable depuis le cloud : `sqlite3` ou `node:sqlite` suffisent, aucun téléphone requis. Les étapes 7 et 8 suivent, elles aussi sans appareil.

### 2026-09-09 09:2x — Étapes 3, 4, 10 : expo-router et la connexion

- **État** : étape 3 `en cours → fait` · étape 4 `à faire → fait` · étape 9 `à faire → en cours` · étape 10 `à faire → fait`
- **Vérifié par** — la chaîne complète, exercée **sans navigateur**, comme le fera le téléphone :
  ```
  $ curl -s -i -X POST http://localhost:3000/api/auth/sign-in/email \
      -H "Origin: exp://192.168.1.192:8081" -H "content-type: application/json" \
      -d '{"email":"qa-saisie@five.local","password":"..."}'
  HTTP/1.1 200 OK
  cookies reçus : 2
  taille du cookie de session : 1084 octets

  $ curl -s -H "Cookie: $COOKIE" http://localhost:3000/api/me
  utilisateur : QA Saisie · qa-saisie@five.local
  club : Renault Five Urbain Guyancourt | rôle owner | mon joueur Diame

  $ curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/me
  401

  $ cd five-scorer-mobile && npx tsc --noEmit
  (aucune sortie, code 0)
  ```
- **Fichiers touchés** :
  - serveur : `lib/auth.ts` (plugin `expo()`, origines `fivescorer://` + `exp://`/`exps://` en dev), `next.config.js` (`allowedDevOrigins`), `app/api/me/route.ts` (nouveau), `package.json` (`@better-auth/expo@1.7.1`)
  - app : `app/_layout.tsx`, `app/index.tsx`, `app/vitrine.tsx`, `app/connexion.tsx`, `app/clubs.tsx`, `lib/auth-client.ts`, `lib/couleurs.ts`, `composants/Ecran.tsx`, `composants/base.tsx`
- **Ce qui a surpris** :
  1. **`authClient.getCookie()` est ASYNCHRONE.** Le §3.2 le montrait avec `await`, mais l'erreur est facile à faire : sans lui, on pose une promesse dans l'en-tête `cookie` et le serveur voit une requête anonyme — un 401 qui n'a l'air d'expliquer rien. Attrapé par `tsc`, pas à l'exécution.
  2. **La cible web ne peut pas tester la connexion.** Le navigateur applique CORS sur `/api/auth/*`, qui n'en a pas et ne doit pas en avoir. La vitrine publique s'y vérifie, la connexion non — elle se vérifie en HTTP direct, ou sur l'appareil. **Ne pas ajouter d'en-têtes CORS à `/api/auth` pour contourner ça.**
  3. **`main` avait ramassé `five-scorer-mobile/` par accident** (un `git add -A` depuis un sous-dossier ajoute tout l'arbre). La fusion a produit des conflits sur un squelette obsolète. Résolus en faveur de `mobile`, et le squelette mort supprimé.
  4. **La taille du cookie de session est de 1 084 octets** — le point du §3.2 qui n'avait jamais été mesuré. Sous la limite historique d'iOS, sous le seuil de découpage. Réglé.
- **Reste ouvert** :
  - Rien n'a été lancé sur un appareil. La connexion doit être essayée dans Expo Go — c'est la seule chose qui reste à prouver sur ce lot.
  - Étape 9 : `GET /api/clubs/[clubId]` et l'extension du roster.
  - `.env.local` de l'app pointe le serveur LOCAL. Le retirer pour repointer la production.

### 2026-09-09 08:5x — Étapes 1, 2, 3 (partielle) et 3 bis

- **État** : étape 1 `à faire → fait` · étape 2 `à faire → fait` · étape 3 `à faire → en cours` · étape 3 bis `créée → fait`
- **Vérifié par** :
  ```
  $ curl -s "https://itunes.apple.com/lookup?id=982107779" | python3 -c "...['version']"
  57.0.9   (publiée 2026-09-02, iOS 16.4 minimum)

  $ node -p "require('./package.json').dependencies['better-auth']"
  1.7.1

  $ cd five-scorer-mobile && npx tsc --noEmit
  (aucune sortie, code 0)

  $ curl -s https://five-scorer.vercel.app/api/public/renault-five-urban-guy | python3 -c "..."
  club : Renault Five Urban Guy · #FFFFFF #111111
  classement : 10 joueurs · 1er Antoine 6 buts
  derniers : 7 sept. Blanc 18 - 9 Noir
  ```
- **Fichiers touchés** :
  - `five-scorer/package.json`, `five-scorer/pnpm-lock.yaml` (épinglage)
  - `five-scorer/app/api/public/[slug]/route.ts` (nouveau)
  - `five-scorer/middleware.ts` (laisser passer `api/public` et `api/cal`)
  - `five-scorer-mobile/` (projet Expo : `App.tsx`, `lib/api.ts`, `app.json`, `README.md`)
- **Ce qui a surpris** :
  1. **Le risque `better-auth` était plus grand que ce document ne le disait.** Il annonçait « seul le lockfile protège la production » ; en réalité `vercel.json` installe avec `--frozen-lockfile=false`, donc le lockfile ne protégeait **rien** au déploiement. N'importe quel build de routine pouvait résoudre 1.7.3 et casser toute inscription. Épinglé en version exacte.
  2. **`create-expo-app` a effacé ses propres fichiers** en mourant sur une question interactive (« Skip initializing a new git repository? »), à l'intérieur d'un dépôt git existant. Le projet a été recréé **hors du dépôt** puis déplacé — c'est le contournement à retenir.
  3. **Le port 8081 était déjà pris** par un autre projet de la machine (`~/GR59/car-rental-senegal/apps/mobile`). Le bundler a été lancé sur 8090.
- **Reste ouvert** :
  - Étape 3 : le projet est parti du modèle `blank-typescript`, **expo-router n'est pas installé** et il n'y a qu'un écran.
  - L'écran actuel ne demande pas de compte : c'est la vitrine publique. La connexion, c'est l'étape 4 puis 10.
  - Rien n'a été lancé sur un appareil. Le rendu a été vérifié avec `npx expo start --web`, qui exerce l'arbre de composants et l'accès à l'API, mais **n'est pas une preuve** de fonctionnement sur iPhone.

### Format d'une entrée

```markdown
### AAAA-MM-JJ HH:MM — Étape N : <titre de l'étape>

- **État** : <avant> → <après>            (à faire / en cours / fait / bloqué)
- **Vérifié par** :
  ```
  $ <la commande exacte>
  <la sortie réelle, collée, pas résumée>
  ```
- **Fichiers touchés** : <chemins absolus, un par ligne>
- **Ce qui a surpris** : <ce qui ne s'est pas passé comme ce document le prévoyait —
  un chiffre faux, une version différente, un comportement inattendu.
  Si ce document est en tort, le corriger DANS le même commit et le dire ici.>
- **Reste ouvert** : <ce qui n'a pas été fait, ce qui attend une décision du §6,
  ce qui doit être vérifié sur l'appareil>
```

### Exemple

L'entrée réelle de l'étape 6 (2026-09-09 12:2x, plus haut dans ce journal) sert
de modèle : la commande et sa sortie collées telles quelles, les écarts au plan
nommés un par un, et ce qui n'a pas été fait dit franchement.

*(L'exemple fictif qui vivait ici a été retiré le 9 septembre : il décrivait
l'étape 6, désormais faite pour de vrai, avec une commande `sqlite3` qui
n'existe pas dans le nuage et des chemins `mobile/` abandonnés au §3.1. Deux
entrées « étape 6 » dont une fausse, c'était le contraire d'une mémoire.)*
