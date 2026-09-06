-- Better Auth 1.7 : l'identité d'un account est scopée par issuer.
-- La table account est vide à ce stade (l'auth par comptes arrive avec la
-- v2), donc pas de backfill nécessaire.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT NOT NULL;
