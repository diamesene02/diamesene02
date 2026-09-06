# Five Scorer

Plateforme open source de suivi de matchs pour équipes amateurs — five, futsal, foot à 7 ou à 11. Deux modes de jeu : la session entre potes (matchs internes, équipes tirées du roster) et le mode saison (matchs contre d'autres équipes, classement, barème de points).

## Fonctionnalités

- **Scoring live offline-first** — saisie au bord du terrain sans réseau : événements typés (buts, passes décisives, csc, cartons), timeline corrigeable après coup, synchronisation par outbox idempotente.
- **Clubs multi-équipes** — comptes utilisateurs, invitations par lien, rôles owner / admin / member.
- **Générateur d'équipes équilibrées** — niveau 1 à 5 par joueur, gardiens répartis en premier, re-tirage en un tap.
- **Saisons & stats** — classements buteurs / passeurs / MVP, forme (5 derniers matchs) et séries, bilan contre les adversaires avec barème configurable (points victoire / nul).
- **Sessions & présences** — soirées regroupant plusieurs matchs, RSVP des joueurs.
- **Vote MVP** — élection de l'homme du match par les membres (ou désignation par l'admin).
- **Pages publiques + partage** — page club publique en lecture seule, lien de récap par match, carte image à partager.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- Prisma + Postgres
- Better Auth (plugin organizations)
- Dexie (IndexedDB) pour l'offline
- PWA installable

## Démarrage

### Express

```bash
pnpm install
pnpm bootstrap   # Postgres via Docker ou brew + .env + migrate
pnpm dev
```

### Manuel

```bash
pnpm install
cp .env.example .env
# Remplir :
#   DATABASE_URL / DIRECT_URL   → ton Postgres
#   BETTER_AUTH_SECRET          → openssl rand -hex 32
#   BETTER_AUTH_URL             → http://localhost:3000
pnpm prisma migrate deploy
pnpm dev
```

Ouvre http://localhost:3000, crée un compte puis un club.

Google OAuth optionnel : renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.

## Migration depuis la v1

La migration `v2_platform` conserve les joueurs, matchs et buts existants dans un club « legacy ». Le premier compte qui saisit l'ancien PIN admin depuis `/onboarding` en devient owner — `ADMIN_PIN_HASH` doit rester présent dans l'environnement.

## Architecture

- **Offline-first** : les événements sont écrits dans Dexie (IndexedDB) puis rejoués via une outbox FIFO sur des API idempotentes.
- **Multi-tenant** : un club = une organization Better Auth ; tout le domaine est scopé par club.
- **Autorisation** : rôles owner / admin / member résolus par `lib/guard.ts`.
- **Stats** : calculées en mémoire dans `lib/stats.ts` à partir des matchs terminés du scope (club, saison).

## Déploiement

Vercel + Postgres managé (Supabase conseillé).

- Variables d'env à configurer : `DATABASE_URL` (connexion poolée), `DIRECT_URL` (directe, pour les migrations), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, optionnellement `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` et `ADMIN_PIN_HASH` (migration v1).
- Exécuter `prisma migrate deploy` au build.
