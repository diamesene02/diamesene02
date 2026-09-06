-- Compo préparée d'une soirée, annulation ponctuelle, et équipe de départ figée.

-- 1. La soirée porte sa composition et peut être annulée sans être supprimée.
ALTER TABLE "match_day" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "match_day" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "match_day" ADD COLUMN "teamAName" TEXT;
ALTER TABLE "match_day" ADD COLUMN "teamBName" TEXT;

CREATE TABLE "match_day_lineup" (
    "matchDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "team" "Team" NOT NULL,
    "isGk" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "match_day_lineup_pkey" PRIMARY KEY ("matchDayId","playerId")
);
CREATE INDEX "match_day_lineup_playerId_idx" ON "match_day_lineup"("playerId");
ALTER TABLE "match_day_lineup" ADD CONSTRAINT "match_day_lineup_matchDayId_fkey"
  FOREIGN KEY ("matchDayId") REFERENCES "match_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_day_lineup" ADD CONSTRAINT "match_day_lineup_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. L'équipe de départ. Ajoutée nullable, remplie depuis l'équipe courante
--    (seule valeur connue pour l'historique), puis rendue obligatoire.
ALTER TABLE "match_participant" ADD COLUMN "initialTeam" "Team";
UPDATE "match_participant" SET "initialTeam" = "team" WHERE "initialTeam" IS NULL;
ALTER TABLE "match_participant" ALTER COLUMN "initialTeam" SET NOT NULL;
