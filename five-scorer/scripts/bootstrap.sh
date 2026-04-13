#!/usr/bin/env bash
# Bootstrap Five Scorer en local :
#   - démarre un Postgres (Docker en priorité, sinon Homebrew postgresql@16)
#   - crée la DB + user `fivescorer`
#   - génère un .env prêt à l'emploi (hash PIN=1234 avec $ échappés)
#   - lance prisma migrate + seed
#
# Usage :  bash scripts/bootstrap.sh        (depuis five-scorer/)
# Idempotent : ré-exécutable sans casser l'état existant.

set -euo pipefail

# --- 0. Prérequis ---
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "❌ node manquant"; exit 1; }
command -v pnpm >/dev/null || { echo "❌ pnpm manquant — npm i -g pnpm"; exit 1; }

PG_USER="fivescorer"
PG_PASS="fivescorer"
PG_DB="five_scorer"
PG_HOST="localhost"
PG_PORT="5432"

# --- 1. Installer deps ---
if [ ! -d node_modules ]; then
  echo "📦 pnpm install"
  pnpm install
fi

# --- 2. Démarrer Postgres ---
start_pg_docker() {
  if ! docker ps --format '{{.Names}}' | grep -q '^five-scorer-pg$'; then
    if docker ps -a --format '{{.Names}}' | grep -q '^five-scorer-pg$'; then
      echo "🐘 Redémarrage container five-scorer-pg"
      docker start five-scorer-pg >/dev/null
    else
      echo "🐘 Création container Postgres"
      docker run -d --name five-scorer-pg \
        -e POSTGRES_USER="$PG_USER" \
        -e POSTGRES_PASSWORD="$PG_PASS" \
        -e POSTGRES_DB="$PG_DB" \
        -p "${PG_PORT}:5432" \
        postgres:16 >/dev/null
    fi
  else
    echo "🐘 Container five-scorer-pg déjà up"
  fi
  # Attendre que PG accepte les connexions
  for i in $(seq 1 30); do
    if docker exec five-scorer-pg pg_isready -U "$PG_USER" >/dev/null 2>&1; then
      echo "✅ Postgres prêt"; return 0
    fi
    sleep 1
  done
  echo "❌ Postgres n'a pas démarré en 30s"; exit 1
}

start_pg_brew() {
  if ! command -v brew >/dev/null; then
    echo "❌ Ni Docker ni Homebrew disponibles — installe l'un des deux."; exit 1
  fi
  if ! brew list postgresql@16 >/dev/null 2>&1; then
    echo "🍺 brew install postgresql@16"
    brew install postgresql@16
  fi
  brew services start postgresql@16 >/dev/null
  # Attendre
  for i in $(seq 1 20); do
    if pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  # Créer user + DB s'ils n'existent pas
  if ! psql -h "$PG_HOST" -p "$PG_PORT" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" | grep -q 1; then
    createuser -h "$PG_HOST" -p "$PG_PORT" -s "$PG_USER"
  fi
  psql -h "$PG_HOST" -p "$PG_PORT" -d postgres -c "ALTER USER $PG_USER WITH PASSWORD '$PG_PASS';" >/dev/null
  if ! psql -h "$PG_HOST" -p "$PG_PORT" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1; then
    createdb -h "$PG_HOST" -p "$PG_PORT" -O "$PG_USER" "$PG_DB"
  fi
  echo "✅ Postgres (brew) prêt"
}

if command -v pg_isready >/dev/null && pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1; then
  echo "🐘 Postgres déjà up sur ${PG_HOST}:${PG_PORT} — on l'utilise"
  # Créer user + DB s'ils n'existent pas (best effort, requires superuser access)
  ADMIN_URL="postgresql://${PG_HOST}:${PG_PORT}/postgres"
  if ! psql "$ADMIN_URL" -tc "SELECT 1 FROM pg_roles WHERE rolname='$PG_USER'" 2>/dev/null | grep -q 1; then
    psql "$ADMIN_URL" -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS' CREATEDB;" 2>/dev/null \
      || sudo -u postgres psql -c "CREATE USER $PG_USER WITH PASSWORD '$PG_PASS' CREATEDB;" 2>/dev/null \
      || echo "⚠️  Impossible de créer le user $PG_USER — crée-le à la main si besoin"
  fi
  if ! psql "$ADMIN_URL" -tc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" 2>/dev/null | grep -q 1; then
    psql "$ADMIN_URL" -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>/dev/null \
      || sudo -u postgres psql -c "CREATE DATABASE $PG_DB OWNER $PG_USER;" 2>/dev/null \
      || echo "⚠️  Impossible de créer la DB $PG_DB — crée-la à la main si besoin"
  fi
elif command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  start_pg_docker
else
  start_pg_brew
fi

# --- 3. Générer .env si absent ---
if [ ! -f .env ]; then
  echo "🔐 Génération .env (PIN=1234)"
  HASH=$(node -e "console.log(require('bcryptjs').hashSync('1234',10).replace(/\\\$/g,'\\\\\$'))")
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  DB_URL="postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=public"
  cat > .env <<EOF
DATABASE_URL="$DB_URL"
DIRECT_URL="$DB_URL"
SCORING_PIN_HASH="$HASH"
SESSION_SECRET="$SECRET"
EOF
else
  echo "🔐 .env déjà présent (conservé)"
fi

# --- 4. Migrate + seed ---
echo "📐 prisma migrate deploy"
pnpm prisma migrate deploy
echo "🌱 prisma db seed"
pnpm prisma db seed

echo ""
echo "✅ Tout est prêt."
echo "   → Lance :   pnpm dev"
echo "   → Ouvre :   http://localhost:3000   (PIN = 1234)"
