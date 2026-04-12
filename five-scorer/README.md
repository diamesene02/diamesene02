# Five Scorer

PWA tactile pour saisir en live les scores et buteurs des **Five hebdo**, avec
historique, classement des buteurs, stats par joueur et élection du MVP.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS**
- **Prisma** + **Postgres** (Supabase conseillé)
- **Zustand** pour l'état live (saisie optimiste)
- **iron-session** + bcrypt pour le gate PIN
- PWA installable sur tablette (manifest + orientation paysage)

## Démarrage

```bash
pnpm install
cp .env.example .env
# Éditer .env : DATABASE_URL, DIRECT_URL, SCORING_PIN_HASH, SESSION_SECRET

# Générer le hash PIN (ex. 1234) :
node -e "console.log(require('bcryptjs').hashSync('1234', 10))"

pnpm prisma migrate dev --name init
pnpm prisma db seed
pnpm dev
```

Ouvre http://localhost:3000 (idéalement DevTools en mode tablette paysage).

## Flux

1. Accueil → **+ Nouveau match**
2. PIN → choix équipes / joueurs / invités
3. Écran live : tap **+1** sur le joueur qui marque, **−** pour annuler
4. **Terminer le match** → choix MVP → récap
5. `/stats/scorers`, `/matches/history`, `/stats/players/[id]`

## Modèle de données

- `Player` (roster + invités `isGuest`)
- `Match` (scores dénormalisés, status `LIVE`/`FINISHED`, MVP)
- `MatchPlayer` (composition équipe A/B)
- `Goal` (un par but → undo précis + top scoreurs)

## Déploiement

Vercel + Supabase Postgres. Penser à configurer :

- `DATABASE_URL` (connexion poolée, `?pgbouncer=true`)
- `DIRECT_URL` (connexion directe pour Prisma migrate)
- `SCORING_PIN_HASH` (bcrypt)
- `SESSION_SECRET` (≥ 32 caractères aléatoires)

## Backlog v2

- Passes décisives
- Supabase Realtime pour multi-tablettes synchronisées
- Export CSV / partage WhatsApp
- Avatars joueurs
