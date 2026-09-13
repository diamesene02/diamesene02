-- Un match annulé le reste, visible, avec ses buts, sa compo et ses votes
-- intacts (article II, spec 0006). Même précédent que MatchDay.canceledAt /
-- cancelReason.
ALTER TABLE "match" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "match" ADD COLUMN "cancelReason" TEXT;
