-- Jeton du flux iCal, distinct du code d'invitation : un agenda circule, un
-- droit d'entrée dans le club ne doit pas circuler avec.
ALTER TABLE "club" ADD COLUMN "calendarToken" TEXT;
UPDATE "club" SET "calendarToken" = md5(random()::text || id) WHERE "calendarToken" IS NULL;
ALTER TABLE "club" ALTER COLUMN "calendarToken" SET NOT NULL;
CREATE UNIQUE INDEX "club_calendarToken_key" ON "club"("calendarToken");
