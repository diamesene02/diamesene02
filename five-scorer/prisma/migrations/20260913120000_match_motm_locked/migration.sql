-- Fige mvpId contre l'écrasement par le recomptage du vote quand une
-- désignation manuelle (motmMode ADMIN ou VOTE) a eu lieu (spec 0001, Q6).
ALTER TABLE "match" ADD COLUMN "motmLocked" BOOLEAN NOT NULL DEFAULT false;
