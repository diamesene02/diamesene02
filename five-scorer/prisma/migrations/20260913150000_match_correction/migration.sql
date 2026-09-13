-- Pose correctedAt/correctedById sur Match : qui a corrigé un match terminé,
-- et quand (écran `/corriger`, spec 0001). PAS ENCORE BRANCHÉS par ce
-- commit — aucune route n'écrit dedans pour l'instant, ces deux champs sont
-- posés à l'avance pour une tâche ultérieure du même lot (0001).
ALTER TABLE "match" ADD COLUMN "correctedAt" TIMESTAMP(3);
ALTER TABLE "match" ADD COLUMN "correctedById" TEXT;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
