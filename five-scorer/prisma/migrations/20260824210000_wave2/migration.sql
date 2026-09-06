-- Wave 2 : mi-temps dans la timeline, paiements de session.
ALTER TYPE "MatchEventType" ADD VALUE 'HALF_TIME';
ALTER TABLE "match_day" ADD COLUMN "fieldCostCents" INTEGER;
ALTER TABLE "rsvp" ADD COLUMN "hasPaid" BOOLEAN NOT NULL DEFAULT false;
